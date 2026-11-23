// T42d (a), second line of defence: what tests/unit/importMerge.test.ts leaves open.
// There, only the post, page, month_theme, album_item, milestone and media rows are shown to
// survive a merge. Here every table the import writes is: the admin's edit stays (and the
// default import, as a control, does overwrite it), what the source dropped stays, what the source
// gained is added and counted as `countNewRows` says; then the rows too big for one statement
// (pieces: each guard of the append, text outside the BMP, the sizes around the cut, a run that was
// interrupted, the statements as the .sql/--batches files write them, a NUL character in the text), the
// unique slugs and what the dry run says about them (mergeReport).
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { buildStatements, countNewRows, type ImportContent, inlineStatement, mergeReport, type Statement } from "../../src/db/import";
import { applyMigrations, applyStatements, openDatabase } from "../../src/db/nodeSqlite";
import type { TongChiEntry } from "../../src/libs/content/tongChi";
import type { AboutTopic } from "../../src/libs/content/types";
import { B2, content, post, statue } from "./helpers/importContent";

// Building and running a row of 100 KB or more takes a second or two.
vi.setConfig({ testTimeout: 60_000 });

// ---------------------------------------------------------------- helpers
const merge = { merge: true };

function run(db: DatabaseSync, data: ImportContent, options: { merge?: boolean } = {}) {
	const result = buildStatements(data, options);
	applyStatements(db, result.statements);
	return result;
}

function fresh(): DatabaseSync {
	const db = openDatabase();
	applyMigrations(db);
	return db;
}

const rows = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Record<string, unknown>[];
const one = (db: DatabaseSync, sql: string) => db.prepare(sql).get() as Record<string, unknown> | undefined;
const count = (db: DatabaseSync, table: string) => (one(db, `select count(*) as n from "${table}"`) as { n: number }).n;
const text = (db: DatabaseSync, sql: string) => Object.values(one(db, sql) ?? {})[0] as string;

const tableNames = (db: DatabaseSync) => rows(db, "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name").map((row) => row.name as string);

/** One table's rows, as one string. */
const tableDump = (db: DatabaseSync, table: string) => rows(db, `select * from "${table}" order by rowid`).map((row) => JSON.stringify(row)).join("\n");

/** Every table's rows, as one hash. */
function dump(db: DatabaseSync): string {
	const hash = createHash("sha1");
	for (const name of tableNames(db)) hash.update(`${name}\n${tableDump(db, name)}`);
	return hash.digest("hex");
}

/** The rows of every table, by table. */
const snapshot = (db: DatabaseSync) => Object.fromEntries(tableNames(db).map((name) => [name, tableDump(db, name)]));

const photo = (n: number) => ({ src: `${B2}/g/${n}.webp`, title: `Ảnh ${n}`, caption: `Chú thích ${n}` });

const topic = (id: string, patch: Partial<AboutTopic> = {}): AboutTopic => ({
	id,
	slug: `trang-${id}`,
	title: `Trang ${id}`,
	subtitle: "",
	tag: "",
	group: { slug: "lich-su-chua", name: "Lịch Sử Chùa" },
	banner: null,
	portrait: null,
	overview: "Tổng quan",
	quote: null,
	milestones: [{ label: "1900", title: `Khởi dựng ${id}`, description: "Mô tả" }],
	contentHtml: "<p>Giới thiệu</p>",
	gallery: [photo(5)],
	book: null,
	...patch,
});

const teaching = (id: string, patch: Partial<TongChiEntry> = {}): TongChiEntry => ({
	id,
	slug: `tong-chi-${id}`,
	title: `Tông chỉ ${id}`,
	name: `Tông chỉ ${id}`,
	subtitle: "",
	group: { slug: "hanh-tri", name: "Phương Pháp Hành Trì" },
	banner: { src: `${B2}/t/${id}.webp`, position: "center 50%" },
	excerpt: "Trích",
	author: "Thầy",
	authorHref: null,
	publishedDate: "2026-10-01",
	views: 3,
	video: null,
	featured: null,
	gallery: [],
	book: null,
	keywords: [],
	seoTitle: "",
	seoDescription: "",
	ogImage: null,
	body: "Nội dung",
	...patch,
});

/** A source with rows in every table the import writes. */
function fullSource(): ImportContent {
	const base = content();
	return content({
		posts: [post("1", { gallery: [photo(1), photo(2)] }), post("2")],
		about: [topic("p1")],
		tongChi: [teaching("t1")],
		statues: [
			statue("1", { art: [{ id: "2", title: "Tranh", location: "Chánh điện", meaning: "Ý nghĩa", image: { src: `${B2}/art/1.webp`, position: "center 50%" }, href: null }] }),
			statue("2", { areaCode: "cong_thap", cluster: "" }),
		],
		schedule: { ...base.schedule, programs: [{ id: "pr1", title: "Đại sám hối", subtitle: "", summary: "Ngày 14", time: "19h", duration: "2 giờ", location: "Chánh điện", image: null }] },
	});
}

/** The same keys as fullSource() plus one new row in every table. */
function grownSource(): ImportContent {
	const base = fullSource();
	return {
		...base,
		posts: [...base.posts, post("9", { gallery: [photo(7)], thumbnail: { src: `${B2}/new/9.webp`, position: "center 50%" }, category: { slug: "moi", name: "Mới" } })],
		about: [...base.about, topic("p2", { slug: "trang-hai", gallery: [photo(8)] })],
		tongChi: [...base.tongChi, teaching("t2")],
		areas: [...base.areas, { ...base.areas[0], id: "a2", slug: "khu-hai", name: "Khu hai" }],
		statues: [
			...base.statues,
			statue("3", { cluster: "Cụm mới", art: [{ id: "x", title: "Mới", location: "", meaning: "", image: null, href: null }] }),
		],
		monks: [...base.monks, { ...base.monks[0], id: "monk-2", name: "Thiền sư Mới" }],
		schedule: {
			...base.schedule,
			events: [...base.schedule.events, { ...base.schedule.events[0], id: "e2", slug: "le-hai", title: "Lễ hai" }],
			programs: [...base.schedule.programs, { ...base.schedule.programs[0], id: "pr2", title: "Chương trình hai" }],
			themes: [...base.schedule.themes, { month: 11, title: "Tháng 11", poster: null, lines: [], author: "" }],
			quotes: [...base.schedule.quotes, { id: "q2", src: `${B2}/q/2.webp`, title: "Pháp ngữ hai" }],
		},
	};
}

/** Nothing: what the source looks like when its files read empty (the script refuses it unless --allow-empty). */
const emptySource = (): ImportContent => ({
	posts: [],
	albums: new Map(),
	schedule: { events: [], programs: [], themes: [], quotes: [] },
	about: [],
	tongChi: [],
	areas: [],
	statues: [],
	monks: [],
});

/** Every table the import writes, with a statement the admin could run on its rows. */
const WRITTEN: [table: string, adminEdit: string][] = [
	["media", "update media set folder = 'ADMIN'"],
	["category", "update category set name = 'ADMIN'"],
	["album", "update album set title = 'ADMIN'"],
	["album_item", "update album_item set title = 'ADMIN'"],
	["area", "update area set name = 'ADMIN'"],
	["statue_cluster", "update statue_cluster set name = 'ADMIN'"],
	["statue", "update statue set name = 'ADMIN', version = 2, updated_by = 'u1'"],
	["art_variation", "update art_variation set title = 'ADMIN'"],
	["post", "update post set title = 'ADMIN', version = 2, updated_by = 'u1'"],
	["teaching_article", "update teaching_article set title = 'ADMIN', version = 2, updated_by = 'u1'"],
	["page", "update page set title = 'ADMIN', version = 2, updated_by = 'u1'"],
	["milestone", "update milestone set title = 'ADMIN'"],
	["monk", "update monk set name = 'ADMIN'"],
	["calendar_event", "update calendar_event set title = 'ADMIN'"],
	["featured_program", "update featured_program set title = 'ADMIN'"],
	["month_theme", "update month_theme set title = 'ADMIN'"],
	["quote_image", "update quote_image set title = 'ADMIN'"],
];

function withAdmin(): DatabaseSync {
	const db = fresh();
	db.exec("insert into user (id, email, role) values ('u1', 'editor@example.org', 'editor')");
	run(db, fullSource());
	return db;
}

// ---------------------------------------------------------------- every table
describe("import --merge, table by table", () => {
	it("the fixtures put at least one row in every table the import writes", () => {
		const db = withAdmin();
		const { report } = buildStatements(grownSource(), merge);
		expect(report.tables.map((entry) => entry.table).sort()).toEqual(WRITTEN.map(([table]) => table).sort());
		for (const [table] of WRITTEN) expect(count(db, table), table).toBeGreaterThan(0);
	});

	it.each(WRITTEN)("%s: a row the admin edited is not overwritten by the source (and the default import would)", (table, edit) => {
		const db = withAdmin();
		expect(db.prepare(edit).run().changes, `${table}: nothing to edit`).toBeGreaterThan(0);
		const edited = tableDump(db, table);
		run(db, fullSource(), merge);
		expect(tableDump(db, table)).toBe(edited);
		// Control: the same edit does not survive the full import, so the check above can fail.
		run(db, fullSource());
		expect(tableDump(db, table), `${table}: the default import did not overwrite the edit`).not.toBe(edited);
	});

	it("keeps every row of every table when the source has lost all of its own", () => {
		const db = withAdmin();
		for (const [, edit] of WRITTEN) db.exec(edit);
		const before = snapshot(db);
		const { statements, report } = buildStatements(emptySource(), merge);
		expect(statements).toEqual([]);
		expect(report.tables).toEqual([]);
		applyStatements(db, statements);
		expect(snapshot(db)).toEqual(before);
		// Control: the default import empties them.
		// (media is never pruned, by either mode: it holds the library's pictures.)
		run(db, emptySource());
		for (const [table] of WRITTEN.filter(([name]) => name !== "media")) expect(count(db, table), table).toBe(0);
	});

	it("keeps every row of every table when the source keeps only some of them", () => {
		const db = withAdmin();
		const before = snapshot(db);
		const part = { ...fullSource(), posts: [], tongChi: [], statues: [], areas: [], monks: [], about: [] };
		run(db, part, merge);
		expect(snapshot(db)).toEqual(before);
	});

	it("adds the new row of every table, keeps the old ones, and the count it gave beforehand is what was added", () => {
		const db = withAdmin();
		for (const [, edit] of WRITTEN) db.exec(edit);
		const before = snapshot(db);
		const counts = Object.fromEntries(WRITTEN.map(([table]) => [table, count(db, table)]));
		const { report } = buildStatements(grownSource(), merge);
		const predicted = countNewRows(db, report.tables);
		applyStatements(db, buildStatements(grownSource(), merge).statements);
		for (const { table, added } of predicted) {
			expect(added, `${table}: nothing new in the fixture`).toBeGreaterThan(0);
			expect(count(db, table) - counts[table], `${table}: rows added`).toBe(added);
			// What was there is still there, unchanged.
			const now = new Set(tableDump(db, table).split("\n"));
			for (const line of before[table].split("\n")) expect(now.has(line), `${table}: an old row changed or went`).toBe(true);
		}
		expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
		// Once added, a new row is just another row: a second run adds nothing.
		const after = dump(db);
		expect(countNewRows(db, report.tables).every((row) => row.added === 0)).toBe(true);
		run(db, grownSource(), merge);
		expect(dump(db)).toBe(after);
	});

	it("takes the grown source into an empty database as the default import does", () => {
		const merged = fresh();
		run(merged, grownSource(), merge);
		const plain = fresh();
		run(plain, grownSource());
		expect(snapshot(merged)).toEqual(snapshot(plain));
	});

	it("never writes a statement other than an insert that does nothing on conflict, for a source with a row in every table", () => {
		const { statements } = buildStatements(grownSource(), merge);
		expect(statements.length).toBeGreaterThanOrEqual(WRITTEN.length);
		for (const { sql } of statements) expect(sql).toMatch(/^insert into "[a-z_]+" .* on conflict do nothing$/i);
	});

	it("leaves the soft-deleted and the admin-made rows of every table with an audit column alone", () => {
		const db = withAdmin();
		for (const table of ["post", "teaching_article", "page", "statue"]) {
			db.exec(`update ${table} set deleted_at = '2026-11-21T00:00:00Z', deleted_by = 'u1', version = 2`);
		}
		db.exec("update media set deleted_at = '2026-11-21T00:00:00Z', deleted_by = 'u1'");
		const before = snapshot(db);
		run(db, fullSource(), merge);
		for (const table of ["post", "teaching_article", "page", "statue", "media"]) expect(tableDump(db, table), table).toBe(before[table]);
	});

	it("does not touch the site's and the admin's own tables, whatever the source holds", () => {
		const db = withAdmin();
		db.exec("insert into page_view (entity_type, entity_id, date, count) values ('post', '1', '2026-11-17', 5)");
		db.exec("insert into registration (code, event_id, full_name, phone, participants, created_at) values ('TLHP-0001', 'e1', 'Nguyễn Văn A', '0912345678', 2, '2026-11-17T00:00:00Z')");
		const own = ["user", "page_view", "registration", "session", "audit_log", "setting", "role", "role_permission", "revision"];
		const before = Object.fromEntries(own.map((table) => [table, tableDump(db, table)]));
		run(db, grownSource(), merge);
		run(db, emptySource(), merge);
		for (const table of own) expect(tableDump(db, table), table).toBe(before[table]);
	});
});

// ---------------------------------------------------------------- what comes back, on purpose
describe("import --merge, what is not in the database", () => {
	// The merge can tell "never imported" from "deleted for good" only by the row being gone, so a
	// row purged from the trash (a hard delete) is taken for a new one. This pins that down so a
	// change of mind shows up here, and the dry run counts it (so the owner sees it before it runs).
	// (A child row is the exception: the admin deletes those by saving its parent, which marks the parent
	// as touched, and then they stay deleted; here post 1 was not touched, so its photo is added again.)
	it("adds back a row the admin deleted for good, and the dry run counts it", () => {
		const db = withAdmin();
		db.exec("delete from album_item where album_id = 'post:1' and position = 1");
		db.exec("delete from post where id = '2'");
		const { report, statements } = buildStatements(fullSource(), merge);
		const predicted = countNewRows(db, report.tables);
		expect(predicted.find((row) => row.table === "post")?.added).toBe(1);
		expect(predicted.find((row) => row.table === "album_item")?.added).toBe(1);
		applyStatements(db, statements);
		expect(one(db, "select title from post where id = '2'")).toEqual({ title: "Bài 2" });
		expect(one(db, "select title from album_item where album_id = 'post:1' and position = 1")).toEqual({ title: "Ảnh 2" });
	});

	// Since migration 0004 a post's (section, slug) is unique among the posts not in the trash, and the
	// merge writes with a bare `on conflict do nothing`, which covers every unique index and not only
	// the id: a source post that collides with an admin's post is skipped without a word.
	const adminPost = (section: string, extra = "") =>
		`insert into post (id, slug, title, section, published_date, created_by${extra ? ", deleted_at" : ""}) values ('admin-1', 'bai-9', 'Bài của admin', '${section}', '2026-11-20', 'u1'${extra})`;

	it("skips, without an error, a post that has the section and slug of an admin's post, and keeps the admin's", () => {
		const db = withAdmin();
		db.exec(adminPost("dong-chay-hoang-phap"));
		const before = tableDump(db, "post");
		run(db, content({ posts: [post("9")] }), merge);
		expect(tableDump(db, "post")).toBe(before);
		expect(rows(db, "select id from post where slug = 'bai-9'").map((row) => row.id)).toEqual(["admin-1"]);
	});

	it("adds a post with that slug when the other post is in another section or in the trash", () => {
		const other = withAdmin();
		other.exec(adminPost("tri-tue-phat-phap"));
		run(other, content({ posts: [post("9")] }), merge);
		expect(rows(other, "select id from post where slug = 'bai-9' order by id").map((row) => row.id)).toEqual(["9", "admin-1"]);

		const trashed = withAdmin();
		trashed.exec(adminPost("dong-chay-hoang-phap", ", '2026-11-21T00:00:00Z'"));
		run(trashed, content({ posts: [post("9")] }), merge);
		expect(rows(trashed, "select id from post where slug = 'bai-9' order by id").map((row) => row.id)).toEqual(["9", "admin-1"]);
	});

	// Found by the mutation run: the dry run used to say "1 sẽ thêm" for a row that the unique index makes
	// the merge skip, because countNewRows looked at the primary key only. It now checks the unique
	// indexes too (the block "the dry run's unique indexes" below does it for every table).
	it("counts, for a post the unique slug will turn away, one row fewer than its id alone says", () => {
		const db = withAdmin();
		db.exec(adminPost("dong-chay-hoang-phap"));
		const data = content({ posts: [post("9")] });
		const { report, statements } = buildStatements(data, merge);
		const predicted = countNewRows(db, report.tables).find((row) => row.table === "post")?.added;
		const before = count(db, "post");
		applyStatements(db, statements);
		expect(predicted).toBe(count(db, "post") - before);
		expect(predicted).toBe(0);
	});
});

describe("import --merge, a unique slug or code that the admin's row already holds", () => {
	/** An admin-made row with the slug (or code) of a row the source has under another id. */
	const OWNERS: Record<string, { insert: string; source: () => ImportContent; check: string }> = {
		page: {
			insert: "insert into page (id, slug, title) values ('admin-x', 'trang-p1', 'Admin')",
			source: () => content({ about: [topic("p1")], statues: [], areas: [] }),
			check: "select id from page where slug = 'trang-p1'",
		},
		teaching_article: {
			insert: "insert into teaching_article (id, slug, title) values ('admin-x', 'tong-chi-t1', 'Admin')",
			source: () => content({ tongChi: [teaching("t1")], statues: [], areas: [] }),
			check: "select id from teaching_article where slug = 'tong-chi-t1'",
		},
		area: {
			insert: "insert into area (id, slug, name) values ('admin-x', 'tam-bao', 'Admin')",
			source: () => content({ statues: [] }),
			check: "select id from area where slug = 'tam-bao'",
		},
		"statue (slug)": {
			insert: "insert into statue (id, slug, name) values ('admin-x', 'tuong-1_tp1', 'Admin')",
			source: () => content({ statues: [statue("1", { art: [{ id: "x", title: "Tranh", location: "", meaning: "", image: null, href: null }] })] }),
			check: "select id from statue where slug = 'tuong-1_tp1'",
		},
		"statue (code)": {
			insert: "insert into statue (id, slug, name, code) values ('admin-x', 'admin-slug', 'Admin', 'TP1')",
			source: () => content({ statues: [statue("1")] }),
			check: "select id from statue where code = 'TP1'",
		},
		category: {
			insert: "insert into category (id, kind, section, slug, name) values ('admin-x', 'post', 'dong-chay-hoang-phap', 'cong-tu', 'Admin')",
			source: () => content({ posts: [post("1")], statues: [], areas: [] }),
			check: "select id from category where slug = 'cong-tu'",
		},
	};

	// The source's row is turned away by the unique index, and what points at it (milestones, art
	// variations, the post's category) then points at nothing. The run is one transaction, so the
	// outcome is a refusal that changes nothing, never a half-written import.
	it.each(Object.keys(OWNERS))("%s: the admin's row stays and the run either finishes consistent or is refused as a whole", (name) => {
		const { insert, source, check } = OWNERS[name];
		const db = fresh();
		db.exec("insert into user (id, email, role) values ('u1', 'editor@example.org', 'editor')");
		db.exec(insert);
		const before = snapshot(db);
		let failed: unknown;
		try {
			run(db, source(), merge);
		} catch (error) {
			failed = error;
		}
		expect(rows(db, check)).toEqual([{ id: "admin-x" }]);
		if (failed) {
			expect(String(failed)).toMatch(/constraint/i);
			expect(snapshot(db)).toEqual(before);
		} else {
			expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
		}
	});

	// The dry run (mergeReport) sees the turned-away row beforehand: it lists it and its count agrees with what
	// the run adds; where the run fails on a foreign key (a post whose category was turned away), it says so.
	it.each(Object.keys(OWNERS))("%s: the dry run lists the row the unique index turns away and counts what the run adds", (name) => {
		const { insert, source } = OWNERS[name];
		const db = fresh();
		db.exec("insert into user (id, email, role) values ('u1', 'editor@example.org', 'editor')");
		db.exec(insert);
		const { report, statements } = buildStatements(source(), merge);
		const { rows: counted, conflicts } = mergeReport(db, report.tables);
		expect(conflicts.filter((conflict) => conflict.reason === "unique").map((conflict) => conflict.detail).join(" | ")).toMatch(/admin-x/);
		const before = Object.fromEntries(counted.map((row) => [row.table, count(db, row.table)]));
		let failed = false;
		try {
			applyStatements(db, statements);
		} catch {
			failed = true;
		}
		if (failed) {
			expect(conflicts.some((conflict) => conflict.reason === "foreign-key"), "the run failed and the dry run did not warn").toBe(true);
		} else {
			for (const row of counted) expect(count(db, row.table) - before[row.table], row.table).toBe(row.added);
		}
	});

	it("a row in the trash does not hold its slug: the source's row is added next to it", () => {
		const db = fresh();
		db.exec("insert into page (id, slug, title, deleted_at) values ('admin-x', 'trang-p1', 'Đã xóa', '2026-11-21T00:00:00Z')");
		run(db, content({ about: [topic("p1")], statues: [], areas: [] }), merge);
		expect(rows(db, "select id from page order by id").map((row) => row.id)).toEqual(["admin-x", "p1"]);
	});
});

// ---------------------------------------------------------------- rows too big for one statement
describe("import --merge, a row too big for one D1 statement", () => {
	const sized = (id: string, html: string) => content({ posts: [post(id, { contentHtml: html })] });
	const bodyOf = (db: DatabaseSync, id = "1") => text(db, `select content_html from post where id = '${id}'`);

	/** The statements up to the first piece (the inserts) and the pieces (the guarded updates). */
	function split(data: ImportContent) {
		const { statements } = buildStatements(data, merge);
		const isPiece = ({ sql }: Statement) => /^update/i.test(sql);
		return { inserts: statements.filter((statement) => !isPiece(statement)), pieces: statements.filter(isPiece), all: statements };
	}

	/** What the row holds after its insert: the first piece of the text. */
	function firstPiece(data: ImportContent): string {
		const db = fresh();
		applyStatements(db, split(data).inserts);
		return bodyOf(db);
	}

	const big = `${"ệ".repeat(60_000)} cuối`;

	it("makes the piece statements guarded updates and nothing else that writes an existing row", () => {
		const { pieces } = split(sized("1", big));
		expect(pieces.length).toBeGreaterThan(1);
		for (const { sql } of pieces) {
			expect(sql).toMatch(/^update "post" set "content_html" = "post"\."content_html" \|\| \? where /i);
			expect(sql).toMatch(/length\(/i);
			expect(sql.match(/substr\(/gi)).toHaveLength(2);
		}
	});

	describe.each([
		["a body with 4-byte characters (outside the BMP): SQLite counts a character, JavaScript counts halves", () => `${"😀".repeat(25_000)} 🙏 cuối`],
		["a body of quotes, backslashes and line breaks", () => `${`'"\\\n\r% _ ? ;`.repeat(8_000)}'`],
		["a body of plain ASCII", () => `${"a".repeat(130_000)}z`],
	])("%s", (_name, make) => {
		const body = make();

		it("is written whole when the row is new", () => {
			const db = fresh();
			run(db, sized("1", body), merge);
			expect(bodyOf(db)).toBe(body);
		});

		it("is written whole through the statements of the .sql and --batches files", () => {
			const db = fresh();
			for (const statement of buildStatements(sized("1", body), merge).statements) db.exec(inlineStatement(statement));
			expect(bodyOf(db)).toBe(body);
			for (const statement of buildStatements(sized("1", body), merge).statements) {
				expect(Buffer.byteLength(inlineStatement(statement))).toBeLessThan(100_000);
			}
		});

		it("leaves the text of an existing row alone, run again and again", () => {
			const db = fresh();
			run(db, sized("1", body), merge);
			const first = dump(db);
			run(db, sized("1", body), merge);
			run(db, sized("1", body), merge);
			expect(dump(db)).toBe(first);
			expect(bodyOf(db)).toBe(body);
		});

		it("leaves an existing row alone when the statements run as the .sql file writes them", () => {
			const db = fresh();
			run(db, sized("1", "<p>Bản đầu</p>"));
			db.exec("update post set version = 2, updated_by = NULL");
			const before = dump(db);
			for (const statement of buildStatements(sized("1", body), merge).statements) db.exec(inlineStatement(statement));
			expect(dump(db)).toBe(before);
		});
	});

	describe("the guard of an append checks the length, the first and the last characters on their own", () => {
		const data = sized("1", big);
		const first = firstPiece(data);
		const chars = [...first];

		/** An existing row holding `held` where the source's insert would have put the first piece; then the whole import runs. */
		function against(held: string, id = "1") {
			const db = fresh();
			run(db, sized(id, "<p>Bản đầu</p>"));
			db.prepare(`update post set content_html = ?, version = 2 where id = '${id}'`).run(held);
			run(db, data, merge);
			return bodyOf(db, id);
		}

		it("the fixture's first piece is long enough to tell the three apart", () => {
			expect(chars.length).toBeGreaterThan(1000);
		});

		it("refuses a text with the right length and last characters but another beginning", () => {
			const held = `X${chars.slice(1).join("")}`;
			expect([...held]).toHaveLength(chars.length);
			expect(against(held)).toBe(held);
		});

		it("refuses a text with the right length and beginning but other last characters", () => {
			const held = `${chars.slice(0, -1).join("")}X`;
			expect([...held]).toHaveLength(chars.length);
			expect(against(held)).toBe(held);
		});

		it("refuses a text with the right beginning and end but a length that is one more", () => {
			const middle = Math.floor(chars.length / 2);
			const held = `${chars.slice(0, middle).join("")}X${chars.slice(middle).join("")}`;
			expect([...held]).toHaveLength(chars.length + 1);
			expect(against(held)).toBe(held);
		});

		it("refuses a text with the right beginning and end but a length that is one less", () => {
			const middle = Math.floor(chars.length / 2);
			const held = `${chars.slice(0, middle).join("")}${chars.slice(middle + 1).join("")}`;
			expect([...held]).toHaveLength(chars.length - 1);
			expect(against(held)).toBe(held);
		});

		it("refuses a text with the right length and ends that only differ in the 200th character from either end", () => {
			const head = [...chars];
			head[199] = "X";
			const tail = [...chars];
			tail[tail.length - 200] = "X";
			expect(against(head.join(""))).toBe(head.join(""));
			expect(against(tail.join(""))).toBe(tail.join(""));
		});

		it("takes the row an earlier, interrupted run left with the first piece, and finishes it", () => {
			// The same text on hold: this is the row the first insert of a new import writes.
			expect(against(first)).toBe(big);
		});
	});

	describe("a run cut off in the middle (D1 batches go one after the other)", () => {
		const data = sized("1", big);
		const { inserts, pieces } = split(data);

		it("is finished by the next run without a letter twice or missing", () => {
			for (const done of [0, 1, Math.floor(pieces.length / 2), pieces.length - 1]) {
				const db = fresh();
				applyStatements(db, inserts);
				applyStatements(db, pieces.slice(0, done));
				run(db, data, merge);
				expect(bodyOf(db), `${done} pieces written before the cut`).toBe(big);
				// And one more run changes nothing.
				const after = dump(db);
				run(db, data, merge);
				expect(dump(db)).toBe(after);
			}
		});

		it("does not lend its pieces to another row that holds the same first piece", () => {
			// B was cut off holding the first piece of its text, which A's text starts with too.
			const shared = "ệ".repeat(30_000);
			const db = fresh();
			applyStatements(db, split(content({ posts: [post("B", { contentHtml: `${shared}B` })] })).inserts);
			run(db, content({ posts: [post("A", { contentHtml: `${shared}A` }), post("B", { contentHtml: `${shared}B` })] }), merge);
			expect(bodyOf(db, "A")).toBe(`${shared}A`);
			expect(bodyOf(db, "B")).toBe(`${shared}B`);
		});

		it("is not made worse by running the pieces again by themselves", () => {
			const db = fresh();
			run(db, data, merge);
			const after = dump(db);
			applyStatements(db, pieces);
			applyStatements(db, pieces);
			expect(dump(db)).toBe(after);
		});
	});

	describe("around the sizes where a row is cut", () => {
		// A row is cut above 90,000 bytes of JSON, into pieces of 40,000 bytes of UTF-8.
		it.each([89_900, 90_500, 130_001])("%i ASCII characters: written whole, the same on a second run, and not appended to once there", (size) => {
			const body = "a".repeat(size - 1) + "z";
			const db = fresh();
			const { report } = run(db, sized("1", body), merge);
			expect(report.oversizedRows).toEqual([]);
			expect(bodyOf(db)).toBe(body);
			run(db, sized("1", body), merge);
			expect(bodyOf(db)).toBe(body);
		});

		it("a body whose last piece is a single character", () => {
			// 40,000 bytes of piece, 3 bytes a letter: 13,333 letters fill one piece with a byte over; pick a length with a 1-letter rest.
			for (const letters of [13_333 * 3 + 1, 13_333 * 7 + 1]) {
				const body = "ệ".repeat(letters);
				const db = fresh();
				run(db, sized("1", body), merge);
				expect(bodyOf(db), `${letters} letters`).toBe(body);
				run(db, sized("1", body), merge);
				expect(bodyOf(db), `${letters} letters, again`).toBe(body);
			}
		});
	});

	describe("other tables", () => {
		const bigText = `${"ệ".repeat(60_000)} cuối`;
		const cases: [table: string, column: string, data: (body: string) => ImportContent, edit: string][] = [
			["statue", "body", (body) => content({ statues: [statue("1", { text: body })] }), "update statue set version = 2"],
			["page", "content_html", (body) => content({ about: [topic("p1", { contentHtml: body })], statues: [] }), "update page set version = 2"],
			["teaching_article", "body", (body) => content({ tongChi: [teaching("t1", { body })], statues: [] }), "update teaching_article set version = 2"],
			["monk", "bio", (body) => content({ monks: [{ ...content().monks[0], bio: body }], statues: [] }), "update monk set sect = 'ADMIN'"],
		];

		it.each(cases)("%s: a big text is written whole when new and not appended to when the row exists", (table, column, data, edit) => {
			const db = fresh();
			run(db, data(bigText), merge);
			expect(text(db, `select ${column} from ${table}`)).toBe(bigText);
			// The admin shortened it: a second merge of the long text does not lengthen it.
			db.prepare(`update ${table} set ${column} = ?`).run("Ngắn");
			db.exec(edit);
			const before = dump(db);
			run(db, data(bigText), merge);
			expect(dump(db)).toBe(before);
			expect(text(db, `select ${column} from ${table}`)).toBe("Ngắn");
		});
	});

	it("keeps three big rows apart: one new, one the admin edited, one from an earlier merge", () => {
		const db = fresh();
		run(db, content({ posts: [post("1", { contentHtml: "<p>Bản đầu</p>" }), post("3", { contentHtml: big })] }), merge);
		db.exec("update post set content_html = '<p>Admin viết</p>', version = 2 where id = '1'");
		const data = content({ posts: [post("1", { contentHtml: big }), post("2", { contentHtml: `${big}2` }), post("3", { contentHtml: big })] });
		run(db, data, merge);
		expect(bodyOf(db, "1")).toBe("<p>Admin viết</p>");
		expect(bodyOf(db, "2")).toBe(`${big}2`);
		expect(bodyOf(db, "3")).toBe(big);
	});

	it("does not append a text to a row of the same id and another table's key when the insert did nothing", () => {
		// Page p1 exists with its own long text; the source's page p1 is also long: not lengthened.
		const db = fresh();
		run(db, content({ about: [topic("p1", { contentHtml: "<p>Ngắn</p>" })], statues: [] }));
		const longer = topic("p1", { contentHtml: big });
		run(db, content({ about: [longer], statues: [] }), merge);
		expect(text(db, "select content_html from page where id = 'p1'")).toBe("<p>Ngắn</p>");
		expect(count(db, "milestone")).toBe(1);
	});
});

// ---------------------------------------------------------------- the dry run's count
describe("countNewRows", () => {
	it("counts a row with a composite key by every column of its key", () => {
		const db = withAdmin();
		// Album 'post:1' has positions 0 and 1; the source also has an album 'page:p2' that the database lacks.
		const grown = grownSource();
		const { report } = buildStatements(grown, merge);
		const items = countNewRows(db, report.tables).find((row) => row.table === "album_item");
		const lacking = report.tables.find((entry) => entry.table === "album_item")?.keys.filter(([albumId, position]) => !one(db, `select 1 from album_item where album_id = '${albumId}' and position = ${position}`));
		expect(items?.added).toBe(lacking?.length);
		expect(items?.added).toBeGreaterThan(0);
	});

	it("counts nothing for a database that already holds every row, and everything for an empty one", () => {
		const db = withAdmin();
		const { report } = buildStatements(fullSource(), merge);
		expect(countNewRows(db, report.tables).every((row) => row.added === 0)).toBe(true);
		const empty = fresh();
		for (const row of countNewRows(empty, report.tables)) expect(row.added, row.table).toBe(row.source);
	});

	it("gives an empty list for a source with no rows", () => {
		expect(countNewRows(fresh(), buildStatements(emptySource(), merge).report.tables)).toEqual([]);
	});

	it("counts the integer key of month_theme and not its text form", () => {
		const db = withAdmin();
		const { report } = buildStatements(grownSource(), merge);
		expect(countNewRows(db, report.tables).find((row) => row.table === "month_theme")).toEqual({ table: "month_theme", source: 2, added: 1 });
	});

	it("only reads: the database is the same afterwards", () => {
		const db = withAdmin();
		const before = dump(db);
		countNewRows(db, buildStatements(grownSource(), merge).report.tables);
		expect(dump(db)).toBe(before);
	});
});

// ---------------------------------------------------------------- the statements themselves
describe("buildStatements with merge", () => {
	it("is the same list of statements every time (a .sql file made twice is the same file)", () => {
		const a = buildStatements(grownSource(), merge).statements.map(inlineStatement);
		const b = buildStatements(grownSource(), merge).statements.map(inlineStatement);
		expect(a).toEqual(b);
	});

	it("does not change the statements of the default mode when merge is off, for a source with a row in every table", () => {
		const plain = buildStatements(grownSource()).statements;
		expect(buildStatements(grownSource(), { merge: false }).statements).toEqual(plain);
		expect(plain.filter(({ sql }) => /^\s*delete\b/i.test(sql)).length).toBeGreaterThanOrEqual(13);
		expect(plain.some(({ sql }) => /do update set/i.test(sql))).toBe(true);
	});

	it("keeps every statement under D1's limit of 100 bound values only by inlining (no statement binds more than the file mode inlines)", () => {
		const statements: Statement[] = buildStatements(grownSource(), merge).statements;
		for (const statement of statements) expect(inlineStatement(statement)).toMatch(/;$/);
	});
});

// ---------------------------------------------------------------- the dry run's unique indexes
describe("mergeReport, the dry run's unique indexes", () => {
	it("warns of the post whose category is turned away, because the run would fail as a whole", () => {
		const db = fresh();
		db.exec("insert into category (id, kind, section, slug, name) values ('admin-x', 'post', 'dong-chay-hoang-phap', 'cong-tu', 'Admin')");
		const { report, statements } = buildStatements(content({ posts: [post("1")], statues: [], areas: [] }), merge);
		const { conflicts } = mergeReport(db, report.tables);
		expect(conflicts.map((conflict) => [conflict.table, conflict.reason])).toEqual([
			["category", "unique"],
			["post", "foreign-key"],
		]);
		expect(conflicts[1].detail).toMatch(/category_id.*category post:dong-chay-hoang-phap:cong-tu/);
		expect(() => applyStatements(db, statements)).toThrow(/constraint/i);
	});

	it("does not warn when a database has nothing in the way", () => {
		const db = withAdmin();
		const { report } = buildStatements(grownSource(), merge);
		expect(mergeReport(db, report.tables).conflicts).toEqual([]);
		expect(mergeReport(fresh(), report.tables).conflicts).toEqual([]);
	});

	it("tells a statue's code from its slug: an empty code is not in the index", () => {
		const db = fresh();
		run(db, content({ statues: [statue("1", { code: "" }), statue("2", { code: "" })] }));
		const { report } = buildStatements(content({ statues: [statue("1", { code: "" }), statue("3", { code: "" })] }), merge);
		expect(mergeReport(db, report.tables).rows.find((row) => row.table === "statue")).toEqual({ table: "statue", source: 2, added: 1 });
		expect(mergeReport(db, report.tables).conflicts).toEqual([]);
	});

	it("counts a second source row with the slug of an earlier one once, as the run adds it", () => {
		const db = fresh();
		const data = content({ posts: [post("1"), post("2", { slug: "bai-1" })], statues: [], areas: [] });
		const { report, statements } = buildStatements(data, merge);
		const { rows: counted, conflicts } = mergeReport(db, report.tables);
		expect(counted.find((row) => row.table === "post")).toEqual({ table: "post", source: 2, added: 1 });
		expect(conflicts.map((conflict) => conflict.reason)).toEqual(["duplicate"]);
		applyStatements(db, statements);
		expect(count(db, "post")).toBe(1);
	});

	it("does not count the children the admin keeps out: a touched parent adds none, a new one adds all", () => {
		const db = withAdmin();
		db.exec("update page set version = 2, updated_by = 'u1' where id = 'p1'");
		const grown = grownSource();
		const { report } = buildStatements(grown, merge);
		const { rows: counted } = mergeReport(db, report.tables);
		// p1 was touched: its photo (gallery of 1) and its milestone stay as they are; p2 is new: its photo and milestone come.
		expect(counted.find((row) => row.table === "milestone")).toEqual({ table: "milestone", source: 2, added: 1 });
		const before = count(db, "milestone");
		applyStatements(db, buildStatements(grown, merge).statements);
		expect(count(db, "milestone") - before).toBe(1);
	});
});

// ---------------------------------------------------------------- a NUL character in a long text
describe("a text too long for one statement that holds U+0000", () => {
	// SQLite's length() and substr() stop at a NUL, JavaScript does not: the pieces and the guard that joins
	// them would disagree and the text would be cut short without a word, so the import refuses to build it.
	const nul = `${"a".repeat(100_000)}\0${"b".repeat(1_000)}`;
	const sized = (html: string) => content({ posts: [post("1", { contentHtml: html })] });

	it("is refused by merge, naming the row and the problem", () => {
		expect(() => buildStatements(sized(nul), merge)).toThrow(/post 1.*NUL/);
	});

	it("is refused by the default import too", () => {
		expect(() => buildStatements(sized(nul))).toThrow(/post 1.*NUL/);
	});

	it("is refused when the NUL is in the first piece or the last", () => {
		expect(() => buildStatements(sized(`\0${"a".repeat(100_000)}`), merge)).toThrow(/NUL/);
		expect(() => buildStatements(sized(`${"a".repeat(100_000)}\0`), merge)).toThrow(/NUL/);
	});

	it("does not stop a text that needs no cutting, and does not stop a long one without it", () => {
		expect(() => buildStatements(sized("<p>Một\0hai</p>"), merge)).not.toThrow();
		expect(() => buildStatements(sized("a".repeat(100_000)), merge)).not.toThrow();
	});
});
