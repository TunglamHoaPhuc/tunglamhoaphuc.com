// T42d (a): `npm run import -- --merge` only adds. A real SQLite database with the real
// migrations; the "admin" is played by plain SQL on the rows the first import wrote. What the
// admin wrote or changed must survive a second import, and the default mode (no --merge) must
// go on overwriting and pruning as before.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { buildStatements, countNewRows, inlineStatement, type ImportContent, loadContent } from "../../src/db/import";
import { applyMigrations, applyStatements, openDatabase } from "../../src/db/nodeSqlite";
import type { ReadFile } from "../../src/libs/content/sources/files";
import type { AboutTopic } from "../../src/libs/content/types";
import { B2, content, post, statue } from "./helpers/importContent";

type Options = { merge?: boolean };

function run(db: DatabaseSync, data: ImportContent, options: Options = {}) {
	const result = buildStatements(data, options);
	applyStatements(db, result.statements);
	return result;
}

const tables = (db: DatabaseSync) =>
	(db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name").all() as { name: string }[]).map((row) => row.name);

/** Every table's rows, as one hash. */
function dump(db: DatabaseSync): string {
	const hash = createHash("sha1");
	for (const name of tables(db)) {
		hash.update(name);
		for (const row of db.prepare(`select * from "${name}" order by rowid`).all()) hash.update(JSON.stringify(row));
	}
	return hash.digest("hex");
}

const one = (db: DatabaseSync, sql: string) => db.prepare(sql).get() as Record<string, unknown> | undefined;
const all = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Record<string, unknown>[];

function fresh(): DatabaseSync {
	const db = openDatabase();
	applyMigrations(db);
	return db;
}

const photo = (n: number) => ({ src: `${B2}/g/${n}.webp`, title: `Ảnh ${n}`, caption: `Chú thích ${n}` });

const topic = (patch: Partial<AboutTopic> = {}): AboutTopic => ({
	id: "p1",
	slug: "lich-su",
	title: "Lịch sử",
	subtitle: "",
	tag: "",
	group: { slug: "lich-su-chua", name: "Lịch Sử Chùa" },
	banner: null,
	portrait: null,
	overview: "Tổng quan",
	quote: null,
	milestones: [{ label: "1900", title: "Khởi dựng", description: "Mô tả" }],
	contentHtml: "<p>Giới thiệu</p>",
	gallery: [],
	book: null,
	...patch,
});

/** What the old admin's files said when the database was first filled: posts 1, 2 and 4. */
function sourceV1(): ImportContent {
	return content({
		posts: [post("1", { gallery: [photo(1), photo(2)] }), post("2"), post("4")],
		about: [topic()],
	});
}

/** The same source later: post 1 and 2 reworded, 4 gone, 3 new, a third photo, a second milestone. */
function sourceV2(): ImportContent {
	return content({
		posts: [
			post("1", { title: "Bài 1 (nguồn đổi)", contentHtml: "<p>Nguồn đổi</p>", gallery: [photo(1), photo(2), photo(3)] }),
			post("2", { title: "Bài 2 (nguồn đổi)" }),
			post("3"),
		],
		about: [
			topic({
				overview: "Tổng quan (nguồn đổi)",
				milestones: [
					{ label: "1900", title: "Khởi dựng (nguồn đổi)", description: "Mô tả" },
					{ label: "1950", title: "Trùng tu", description: "Mới" },
				],
			}),
		],
		schedule: {
			...content().schedule,
			themes: [{ month: 12, title: "Tháng 12 (nguồn đổi)", poster: `${B2}/p/12.webp`, lines: ["<b>Một</b> dòng"], author: "Thầy" }],
		},
	});
}

/** What the new admin did in D1 after the first import. */
function adminWorks(db: DatabaseSync) {
	db.exec("insert into user (id, email, role) values ('u1', 'editor@example.org', 'editor')");
	// Reworded post 1: new title and body, version up, signed.
	db.exec("update post set title = 'Tiêu đề do admin', content_html = '<p>Admin viết</p>', version = 3, updated_by = 'u1', updated_at = '2026-11-20T00:00:00Z' where id = '1'");
	// A post the admin made.
	db.exec(
		"insert into post (id, slug, title, section, published_date, content_html, created_by, created_at) values ('admin-1', 'bai-admin', 'Bài do admin', 'dong-chay-hoang-phap', '2026-11-20', '<p>Của admin</p>', 'u1', '2026-11-20T00:00:00Z')",
	);
	// A post the admin sent to the trash.
	db.exec("update post set deleted_at = '2026-11-21T00:00:00Z', deleted_by = 'u1', version = 2 where id = '2'");
	// A picture added to an album (post 1 above is the album's owner, already touched by the admin).
	const media = (one(db, "select id from media limit 1") as { id: string }).id;
	db.exec(`insert into album_item (album_id, position, media_id, title, caption) values ('post:1', 9, '${media}', 'Ảnh admin', '')`);
	// The admin saves the page's history as it does in src/admin/content/service.ts: version up, signed, the old
	// steps deleted and the new list written again (positions from 1).
	db.exec("update page set version = 2, updated_by = 'u1', updated_at = '2026-11-20T00:00:00Z' where id = 'p1'");
	db.exec("delete from milestone where page_id = 'p1'");
	db.exec("insert into milestone (page_id, position, label, title, description) values ('p1', 1, '2026', 'Admin viết lại', '')");
	// A month's verse reworded, a picture uploaded.
	db.exec("update month_theme set title = 'Tháng 12 (admin)' where month = 12");
	db.exec("insert into media (id, r2_key, folder, filename, alt, uploaded_by, created_at) values ('m-admin', 'up/x.webp', 'up', 'x.webp', 'Ảnh admin', 'u1', '2026-11-20T00:00:00Z')");
}

describe("import --merge", () => {
	it("on an empty database writes the same rows as the default import", () => {
		const merged = fresh();
		run(merged, sourceV1(), { merge: true });
		const plain = fresh();
		run(plain, sourceV1());
		expect(dump(merged)).toBe(dump(plain));
		expect(merged.prepare("pragma foreign_key_check").all()).toEqual([]);
	});

	it("never updates or deletes: no UPDATE-on-conflict, no DELETE, no prune", () => {
		const { statements } = buildStatements(sourceV2(), { merge: true });
		for (const { sql } of statements) {
			expect(sql).not.toMatch(/^\s*delete\b/i);
			expect(sql).not.toMatch(/^\s*update\b/i);
			expect(sql).not.toMatch(/do update/i);
			expect(sql).toMatch(/^insert into .* on conflict do nothing$/i);
		}
	});

	it("keeps what the admin wrote and changed, adds what the source gained, and drops nothing", () => {
		const db = fresh();
		run(db, sourceV1());
		adminWorks(db);
		const before = {
			post1: one(db, "select * from post where id = '1'"),
			post2: one(db, "select * from post where id = '2'"),
			adminPost: one(db, "select * from post where id = 'admin-1'"),
			theme: one(db, "select * from month_theme where month = 12"),
			page: one(db, "select * from page where id = 'p1'"),
			mediaAdmin: one(db, "select * from media where id = 'm-admin'"),
		};

		run(db, sourceV2(), { merge: true });

		// Reworded by the admin: text and version stay.
		expect(one(db, "select * from post where id = '1'")).toEqual(before.post1);
		expect(one(db, "select title, version, updated_by from post where id = '1'")).toEqual({ title: "Tiêu đề do admin", version: 3, updated_by: "u1" });
		// Made by the admin: still there, untouched.
		expect(one(db, "select * from post where id = 'admin-1'")).toEqual(before.adminPost);
		// In the trash: not brought back, not rewritten by the source.
		expect(one(db, "select * from post where id = '2'")).toEqual(before.post2);
		expect(one(db, "select deleted_at from post where id = '2'")).toEqual({ deleted_at: "2026-11-21T00:00:00Z" });
		// New in the source: added.
		expect(one(db, "select title from post where id = '3'")).toEqual({ title: "Bài 3" });
		// Gone from the source: still here.
		expect(one(db, "select title from post where id = '4'")).toEqual({ title: "Bài 4" });
		// Other rows the admin or the source changed.
		expect(one(db, "select * from month_theme where month = 12")).toEqual(before.theme);
		expect(one(db, "select * from page where id = 'p1'")).toEqual(before.page);
		expect(one(db, "select * from media where id = 'm-admin'")).toEqual(before.mediaAdmin);
		// Child rows of a parent the admin has touched: the admin's list stays as it is, nothing the source
		// has under it (a third photo, a second step) is added and nothing the admin deleted comes back.
		expect(all(db, "select position, title from album_item where album_id = 'post:1' order by position")).toEqual([
			{ position: 0, title: "Ảnh 1" },
			{ position: 1, title: "Ảnh 2" },
			{ position: 9, title: "Ảnh admin" },
		]);
		expect(all(db, "select position, title from milestone where page_id = 'p1' order by position")).toEqual([{ position: 1, title: "Admin viết lại" }]);
		// Nothing the source once gave was removed.
		expect(all(db, "select id from post order by id").map((row) => row.id)).toEqual(["1", "2", "3", "4", "admin-1"]);
		expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
	});

	it("gives the same rows when it runs again", () => {
		const db = fresh();
		run(db, sourceV1());
		adminWorks(db);
		run(db, sourceV2(), { merge: true });
		const first = dump(db);
		run(db, sourceV2(), { merge: true });
		run(db, sourceV2(), { merge: true });
		expect(dump(db)).toBe(first);
		expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
	});

	it("leaves the site's and the admin's own tables alone", () => {
		const db = fresh();
		run(db, sourceV1());
		adminWorks(db);
		db.exec("insert into page_view (entity_type, entity_id, date, count) values ('post', '1', '2026-11-17', 5)");
		db.exec("insert into registration (code, event_id, full_name, phone, participants, created_at) values ('TLHP-0001', 'e1', 'Nguyễn Văn A', '0912345678', 2, '2026-11-17T00:00:00Z')");
		db.exec("update area set visible = 0 where id = 'a1'");
		// The source lost its events: with --merge the event (and the registration) stays.
		run(db, content({ posts: sourceV2().posts, schedule: { events: [], programs: [], themes: [], quotes: [] } }), { merge: true });
		expect(one(db, "select count(*) as n from user")).toEqual({ n: 1 });
		expect(one(db, "select count(*) as n from page_view")).toEqual({ n: 1 });
		expect(one(db, "select count(*) as n from registration")).toEqual({ n: 1 });
		expect(one(db, "select count(*) as n from calendar_event")).toEqual({ n: 1 });
		expect(one(db, "select visible from area")).toEqual({ visible: 0 });
	});

	describe("a row too big for one D1 statement", () => {
		// 150,000 characters of 3-byte letters: far over the 100 KB of one statement.
		const body = `${"ệ".repeat(150_000)} cuối`;
		const big = (id: string, html: string) => content({ posts: [post(id, { contentHtml: html })] });

		it("is written whole when the row is new, in statements D1 accepts", () => {
			const db = fresh();
			const { statements, report } = run(db, big("1", body), { merge: true });
			expect(report.oversizedRows).toEqual([]);
			for (const statement of statements) expect(Buffer.byteLength(inlineStatement(statement))).toBeLessThan(100_000);
			expect((one(db, "select content_html as c from post where id = '1'") as { c: string }).c).toBe(body);
		});

		it("is not appended to when the row exists: the admin's text stays, the second run changes nothing", () => {
			const db = fresh();
			run(db, big("1", "<p>Bản đầu</p>"));
			db.exec("update post set content_html = '<p>Admin viết</p>', version = 2, updated_by = 'u1' where id = '1'");
			run(db, big("1", body), { merge: true });
			expect(one(db, "select content_html as c, version from post where id = '1'")).toEqual({ c: "<p>Admin viết</p>", version: 2 });
			const first = dump(db);
			run(db, big("1", body), { merge: true });
			expect(dump(db)).toBe(first);
		});

		it("is not appended to when the row exists with the whole text already (a second merge of the same big row)", () => {
			const db = fresh();
			run(db, big("1", body), { merge: true });
			run(db, big("1", body), { merge: true });
			expect((one(db, "select content_html as c from post where id = '1'") as { c: string }).c).toBe(body);
		});

		it("is not appended to when the row exists with a different big text of the admin's", () => {
			const db = fresh();
			run(db, big("1", "<p>Bản đầu</p>"));
			const adminBody = `${"ê".repeat(120_000)} của admin`;
			db.prepare("update post set content_html = ?, version = 2 where id = '1'").run(adminBody);
			run(db, big("1", body), { merge: true });
			expect((one(db, "select content_html as c from post where id = '1'") as { c: string }).c).toBe(adminBody);
		});
	});

	it("reports what it would add against a database (the dry run's count)", () => {
		const db = fresh();
		run(db, sourceV1());
		adminWorks(db);
		const { report } = buildStatements(sourceV2(), { merge: true });
		const counts = countNewRows(db, report.tables);
		// Posts 1 and 2 exist, 3 is new. Post 1 and page p1 were touched by the admin, so the photo and the
		// milestone the source gained under them are not added.
		expect(counts.find((row) => row.table === "post")).toEqual({ table: "post", source: 3, added: 1 });
		expect(counts.find((row) => row.table === "album_item")).toEqual({ table: "album_item", source: 3, added: 0 });
		expect(counts.find((row) => row.table === "milestone")).toEqual({ table: "milestone", source: 2, added: 0 });
		expect(counts.find((row) => row.table === "month_theme")).toEqual({ table: "month_theme", source: 1, added: 0 });
		// Counting writes nothing.
		const before = dump(db);
		countNewRows(db, report.tables);
		expect(dump(db)).toBe(before);
	});
});

// R1: the children of a page (milestone), an album (album_item) and a statue (art_variation) have a
// composite or positional key. The admin saves them with DELETE ... WHERE parent = ? and then writes
// the whole list again, so "add the positions that are missing" would bring back what it deleted.
// Merge therefore adds a child only under a parent the admin has never touched.
describe("import --merge, the children of a parent", () => {
	const art = (id: string) => ({ id, title: `Tranh ${id}`, location: "", meaning: "", image: null, href: null });
	const twoMilestones = [
		{ label: "1900", title: "Khởi dựng", description: "" },
		{ label: "1950", title: "Trùng tu", description: "" },
	];

	/** One parent of each kind, each with two children. */
	function source(): ImportContent {
		return content({
			posts: [post("1", { gallery: [photo(1), photo(2)] })],
			about: [topic({ milestones: twoMilestones })],
			statues: [statue("1", { art: [art("2"), art("x")] }), statue("2", { areaCode: "cong_thap", cluster: "" })],
		});
	}

	/** What the admin does when it saves a parent with fewer children (or none): signs it, bumps its version, rewrites the list. */
	function adminSaves(db: DatabaseSync, parent: "post" | "page" | "statue", id: string) {
		db.exec(`update ${parent} set version = version + 1, updated_by = 'u1', updated_at = '2026-11-20T00:00:00Z' where id = '${id}'`);
	}

	function filled(): DatabaseSync {
		const db = fresh();
		db.exec("insert into user (id, email, role) values ('u1', 'editor@example.org', 'editor')");
		run(db, source());
		return db;
	}

	const children = (db: DatabaseSync) => ({
		milestone: all(db, "select page_id, position from milestone order by page_id, position"),
		album_item: all(db, "select album_id, position from album_item order by album_id, position"),
		art_variation: all(db, "select id from art_variation order by id"),
	});

	it("starts from two children under each parent", () => {
		const db = filled();
		expect(db.prepare("select count(*) as n from milestone").get()).toEqual({ n: 2 });
		expect(db.prepare("select count(*) as n from album_item").get()).toEqual({ n: 2 });
		expect(db.prepare("select count(*) as n from art_variation").get()).toEqual({ n: 2 });
	});

	it("does not bring back the last milestone, photo or work the admin deleted", () => {
		const db = filled();
		db.exec("delete from milestone where page_id = 'p1' and position = 1");
		db.exec("delete from album_item where album_id = 'post:1' and position = 1");
		db.exec("delete from art_variation where id = '1:1'");
		adminSaves(db, "page", "p1");
		adminSaves(db, "post", "1");
		adminSaves(db, "statue", "1");
		const before = children(db);
		expect(before.milestone).toHaveLength(1);
		run(db, source(), { merge: true });
		expect(children(db)).toEqual(before);
	});

	it("does not bring back any child when the admin deleted them all", () => {
		const db = filled();
		db.exec("delete from milestone");
		db.exec("delete from album_item");
		db.exec("delete from art_variation");
		adminSaves(db, "page", "p1");
		adminSaves(db, "post", "1");
		adminSaves(db, "statue", "1");
		run(db, source(), { merge: true });
		expect(children(db)).toEqual({ milestone: [], album_item: [], art_variation: [] });
		expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
	});

	it("does not bring them back either when the admin has trashed the parent", () => {
		const db = filled();
		db.exec("delete from milestone");
		db.exec("update page set deleted_at = '2026-11-21T00:00:00Z', deleted_by = 'u1', version = 2 where id = 'p1'");
		run(db, source(), { merge: true });
		expect(children(db).milestone).toEqual([]);
	});

	it("gives a parent that is new in the source all of its children", () => {
		const db = filled();
		adminSaves(db, "page", "p1");
		adminSaves(db, "post", "1");
		adminSaves(db, "statue", "1");
		db.exec("delete from milestone");
		db.exec("delete from album_item");
		db.exec("delete from art_variation");
		const grown = content({
			posts: [post("1", { gallery: [photo(1), photo(2)] }), post("7", { gallery: [photo(3), photo(4), photo(5)] })],
			about: [topic({ milestones: twoMilestones }), topic({ id: "p2", slug: "trang-hai", milestones: [...twoMilestones, { label: "2000", title: "Mới", description: "" }] })],
			statues: [statue("1", { art: [art("2"), art("x")] }), statue("2", { areaCode: "cong_thap", cluster: "" }), statue("3", { art: [art("y"), art("z")] })],
		});
		run(db, grown, { merge: true });
		expect(children(db)).toEqual({
			milestone: [
				{ page_id: "p2", position: 0 },
				{ page_id: "p2", position: 1 },
				{ page_id: "p2", position: 2 },
			],
			album_item: [
				{ album_id: "post:7", position: 0 },
				{ album_id: "post:7", position: 1 },
				{ album_id: "post:7", position: 2 },
			],
			art_variation: [{ id: "3:0" }, { id: "3:1" }],
		});
		expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
	});

	it("gives the new parents of a source the same rows as the default import, in an empty database", () => {
		const merged = fresh();
		run(merged, source(), { merge: true });
		const plain = fresh();
		run(plain, source());
		expect(children(merged)).toEqual(children(plain));
		expect(children(merged).milestone).toHaveLength(2);
	});

	it("changes nothing when it runs a second time", () => {
		const db = filled();
		adminSaves(db, "page", "p1");
		db.exec("delete from milestone where page_id = 'p1' and position = 0");
		const grown = content({ ...source(), about: [topic({ milestones: twoMilestones }), topic({ id: "p2", slug: "trang-hai" })] });
		run(db, grown, { merge: true });
		const first = dump(db);
		run(db, grown, { merge: true });
		expect(dump(db)).toBe(first);
	});

	it("writes a child only through an insert that looks at its parent, never a plain insert or an update", () => {
		const { statements } = buildStatements(source(), { merge: true });
		for (const table of ["milestone", "album_item", "art_variation"]) {
			const own = statements.filter(({ sql }) => new RegExp(`^insert into "${table}" `, "i").test(sql));
			expect(own.length, table).toBeGreaterThan(0);
			for (const { sql } of own) expect(sql, table).toMatch(/ where exists \(.*\) on conflict do nothing$/i);
		}
	});

	it("finishes a child that is missing under a parent nobody has touched (an import cut off half way)", () => {
		// The parent is told "untouched" by version 1 and no signature: that is also what a page left by an
		// interrupted earlier import looks like, so this is how a half-written import is finished.
		const db = filled();
		db.exec("delete from milestone where page_id = 'p1' and position = 1");
		run(db, source(), { merge: true });
		expect(children(db).milestone).toEqual([
			{ page_id: "p1", position: 0 },
			{ page_id: "p1", position: 1 },
		]);
	});

	it("skips the children of a parent that a unique slug turned away, instead of failing on the foreign key", () => {
		const db = fresh();
		db.exec("insert into page (id, slug, title) values ('admin-x', 'lich-su', 'Admin')");
		run(db, content({ about: [topic({ milestones: twoMilestones })], statues: [], areas: [] }), { merge: true });
		expect(all(db, "select id from page")).toEqual([{ id: "admin-x" }]);
		expect(children(db).milestone).toEqual([]);
	});
});

describe("import without --merge (the default)", () => {
	it("still overwrites what the source says and removes what it dropped", () => {
		const db = fresh();
		run(db, sourceV1());
		adminWorks(db);
		run(db, sourceV2());
		// The source's words replace the admin's edit.
		expect(one(db, "select title, content_html as c from post where id = '1'")).toEqual({ title: "Bài 1 (nguồn đổi)", c: "<p>Nguồn đổi</p>" });
		expect(one(db, "select title from post where id = '2'")).toEqual({ title: "Bài 2 (nguồn đổi)" });
		// A post the source never had goes, and so does the one it dropped.
		expect(all(db, "select id from post order by id").map((row) => row.id)).toEqual(["1", "2", "3"]);
		// Children are written again from the source.
		expect(one(db, "select count(*) as n from album_item where album_id = 'post:1'")).toEqual({ n: 3 });
		expect(one(db, "select count(*) as n from milestone where page_id = 'p1'")).toEqual({ n: 2 });
		expect(one(db, "select title from month_theme where month = 12")).toEqual({ title: "Tháng 12 (nguồn đổi)" });
	});

	it("builds the same statements with and without an options argument", () => {
		const plain = buildStatements(sourceV2()).statements;
		expect(buildStatements(sourceV2(), {}).statements).toEqual(plain);
		expect(buildStatements(sourceV2(), { merge: false }).statements).toEqual(plain);
		expect(plain.some(({ sql }) => /^\s*delete\b/i.test(sql))).toBe(true);
		expect(plain.some(({ sql }) => /do update/i.test(sql))).toBe(true);
	});

	it("keeps writing a big row in pieces that replace the old text", () => {
		const db = fresh();
		const body = `${"ệ".repeat(150_000)} cuối`;
		run(db, content({ statues: [statue("1", { text: body })] }));
		run(db, content({ statues: [statue("1", { text: body })] }));
		expect((one(db, "select body from statue where id = '1'") as { body: string }).body).toBe(body);
	});
});

// The flags of the script itself, on the real snapshot when it is there (not in git).
const hasSnapshot = ["posts", "tong-chi", "gioi-thieu", "vu-tru", "bao-tuong", "danh-tang", "schedule"].every((name) => existsSync(`data/snapshot/${name}.json`));

describe.skipIf(!hasSnapshot)("npm run import --dry-run", () => {
	function script(args: string[]): string {
		return execFileSync(process.execPath, ["--import", "tsx", "scripts/import.ts", ...args], { encoding: "utf8", timeout: 100_000 });
	}

	it("reads, counts and reports what --merge would add, and writes nothing", () => {
		const dir = mkdtempSync(join(tmpdir(), "tlhp-import-"));
		try {
			const file = join(dir, "d1.sqlite");
			const sqlFile = join(dir, "out.sql");
			// A database holding the snapshot but for one post, which stands for "the admin has the rest".
			const db = openDatabase(file);
			applyMigrations(db);
			db.close();
			script([`--db=${file}`, "--from=snapshot"]);
			const raw = new DatabaseSync(file);
			raw.exec("delete from post where id = (select id from post order by id limit 1)");
			raw.close();
			const before = createHash("sha1").update(readFileSync(file)).digest("hex");

			const output = script(["--dry-run", "--merge", `--db=${file}`, `--sql=${sqlFile}`]);
			expect(output).toMatch(/--dry-run/);
			expect(output).toMatch(/post\s*:?\s*632 trong nguồn, 1 sẽ thêm/);
			// Nothing written: not the database, not the .sql file.
			expect(createHash("sha1").update(readFileSync(file)).digest("hex")).toBe(before);
			expect(existsSync(sqlFile)).toBe(false);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}, 120_000);

	it("warns of a source post that an admin's post with its address turns away, and does not count it as added", () => {
		const dir = mkdtempSync(join(tmpdir(), "tlhp-import-"));
		try {
			const file = join(dir, "d1.sqlite");
			const db = openDatabase(file);
			applyMigrations(db);
			db.close();
			script([`--db=${file}`, "--from=snapshot"]);
			const raw = new DatabaseSync(file);
			const first = raw.prepare("select id, slug, section from post order by id limit 1").get() as { id: string; slug: string; section: string };
			raw.exec(`delete from post where id = '${first.id}'`);
			raw.prepare("insert into post (id, slug, title, section, published_date, created_by) values ('admin-1', ?, 'Bài của admin', ?, '2026-11-20', NULL)").run(first.slug, first.section);
			raw.close();

			const output = script(["--dry-run", "--merge", `--db=${file}`]);
			expect(output).toMatch(/post\s*:?\s*632 trong nguồn, 0 sẽ thêm/);
			expect(output).toMatch(/Cảnh báo: 1 dòng nguồn trùng/);
			expect(output).toContain(`post ${first.id}: trùng (section, slug = ${first.section}, ${first.slug}) với dòng admin-1`);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}, 120_000);
});

describe.skipIf(!hasSnapshot)("import --merge on the real snapshot", () => {
	const read: ReadFile = async (name) => (existsSync(`data/snapshot/${name}.json`) ? { version: "snapshot", data: JSON.parse(readFileSync(`data/snapshot/${name}.json`, "utf8")) } : null);

	it("on an empty database gives what the full import gives, and on a filled one changes nothing", async () => {
		const data = await loadContent(read);
		const merged = fresh();
		const { statements, report } = run(merged, data, { merge: true });
		expect(report.oversizedRows).toEqual([]);
		for (const statement of statements) expect(Buffer.byteLength(inlineStatement(statement))).toBeLessThan(100_000);
		const plain = fresh();
		run(plain, data);
		expect(dump(merged)).toBe(dump(plain));
		expect(merged.prepare("pragma foreign_key_check").all()).toEqual([]);
		// Again, and on top of the full import: the rows are the same.
		const first = dump(merged);
		run(merged, data, { merge: true });
		expect(dump(merged)).toBe(first);
		run(plain, data, { merge: true });
		expect(dump(plain)).toBe(first);
	}, 120_000);
});
