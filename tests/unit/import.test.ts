// T23: the import into D1. A real SQLite database with the real migrations (node:sqlite,
// foreign keys on, as D1 has them), small hand-made content for the rules, and the real
// snapshot (when it is copied to data/snapshot, not in git) for the counts the plan asks for.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { buildStatements, countsOf, inlineStatement, type ImportContent, loadContent } from "../../src/db/import";
import { applyMigrations, applyStatements, openDatabase } from "../../src/db/nodeSqlite";
import type { ReadFile } from "../../src/libs/content/sources/files";
import { content, post, statue } from "./helpers/importContent";

function run(db: DatabaseSync, data: ImportContent) {
	const { statements, report } = buildStatements(data);
	applyStatements(db, statements);
	return { statements, report };
}

const tables = (db: DatabaseSync) =>
	(db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name").all() as { name: string }[]).map((row) => row.name);

/** Every table's rows, as one hash: two databases with the same rows have the same dump. */
function dump(db: DatabaseSync): string {
	const hash = createHash("sha1");
	for (const name of tables(db)) {
		hash.update(name);
		for (const row of db.prepare(`select * from "${name}" order by rowid`).all()) hash.update(JSON.stringify(row));
	}
	return hash.digest("hex");
}

const count = (db: DatabaseSync, table: string) => (db.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n;

function fresh(): DatabaseSync {
	const db = openDatabase();
	applyMigrations(db);
	return db;
}

describe("import into D1", () => {
	it("gives the same rows however many times it runs", () => {
		const db = fresh();
		run(db, content());
		const first = dump(db);
		run(db, content());
		run(db, content());
		expect(dump(db)).toBe(first);
		expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
	});

	it("keeps a picture used twice as one media row, and a B2 file by its key", () => {
		const db = fresh();
		run(db, content());
		// The thumbnail and banner of both posts are one file.
		const rows = db.prepare("select r2_key, url, folder, filename from media where r2_key = 'a/thumb.webp'").all();
		expect(rows).toEqual([{ r2_key: "a/thumb.webp", url: null, folder: "a", filename: "thumb.webp" }]);
		const wordpress = db.prepare("select r2_key, url from media where url is not null").all();
		expect(wordpress).toEqual([{ r2_key: null, url: "/anh-goc/wordpress/2026/07/x.jpg" }]);
		expect(db.prepare("select count(*) as n from post where thumbnail_media_id = banner_media_id").get()).toEqual({ n: 2 });
	});

	it("links statues to their area, cluster and assembly by key, with no repeated names", () => {
		const db = fresh();
		run(db, content());
		const rows = db.prepare("select s.id, s.area_id, c.name as cluster, s.assembly_id, g.name as assembly from statue s left join statue_cluster c on c.id = s.cluster_id left join category g on g.id = s.assembly_id order by s.id").all();
		expect(rows).toEqual([
			{ id: "1", area_id: "a1", cluster: "Hoa Nghiêm Tam Thánh", assembly_id: "assembly::chu-phat", assembly: "Chư Phật Hải Hội" },
			// "cong_thap" has no area (config/vuTru.ts), and this statue stands in no cluster.
			{ id: "2", area_id: null, cluster: null, assembly_id: "assembly::chu-phat", assembly: "Chư Phật Hải Hội" },
		]);
		expect(db.prepare("select area_id from statue_cluster").all()).toEqual([{ area_id: "a1" }]);
		// The names exist once: the statue rows have no column for them.
		expect(Object.keys(db.prepare("select * from statue").get() as object)).not.toContain("assembly_name");
	});

	it("writes a row too big for D1 in pieces and gets it back whole", () => {
		const db = fresh();
		// 150,000 characters of 3-byte letters: far over the 100 KB of one statement.
		const body = "ệ".repeat(150_000) + " cuối";
		const { statements, report } = run(db, content({ statues: [statue("1", { text: body })] }));
		expect(report.oversizedRows).toEqual([]);
		for (const statement of statements) expect(Buffer.byteLength(inlineStatement(statement))).toBeLessThan(100_000);
		expect((db.prepare("select body from statue where id = '1'").get() as { body: string }).body).toBe(body);
		// And again: the first piece replaces the row's body, the others are added back.
		run(db, content({ statues: [statue("1", { text: body })] }));
		expect((db.prepare("select body from statue where id = '1'").get() as { body: string }).body).toBe(body);
	});

	it("removes what the source dropped and keeps what the site and the admin wrote", () => {
		const db = fresh();
		run(db, content());
		db.exec("insert into user (id, email, role) values ('u1', 'editor@example.org', 'editor')");
		db.exec("insert into page_view (entity_type, entity_id, date, count) values ('post', '1', '2026-11-17', 5)");
		db.exec(
			"insert into registration (code, event_id, full_name, phone, participants, created_at) values ('TLHP-0001', 'e1', 'Nguyễn Văn A', '0912345678', 2, '2026-11-17T00:00:00Z')",
		);
		// What an editor changed in D1 after the import and the source does not say.
		db.exec("update area set visible = 0 where id = 'a1'");
		db.exec("update calendar_event set registration_open = 1 where id = 'e1'");

		run(db, content({ posts: [post("1")], statues: [statue("1")] }));
		expect(db.prepare("select id from post").all()).toEqual([{ id: "1" }]);
		expect(db.prepare("select id from statue").all()).toEqual([{ id: "1" }]);
		expect(count(db, "user")).toBe(1);
		expect(count(db, "page_view")).toBe(1);
		expect(count(db, "registration")).toBe(1);
		expect(db.prepare("select visible from area").get()).toEqual({ visible: 0 });
		expect(db.prepare("select registration_open from calendar_event").get()).toEqual({ registration_open: 1 });
		expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);
	});

	it("will not drop an event that people registered for", () => {
		const db = fresh();
		run(db, content());
		db.exec(
			"insert into registration (code, event_id, full_name, phone, participants, created_at) values ('TLHP-0001', 'e1', 'Nguyễn Văn A', '0912345678', 2, '2026-11-17T00:00:00Z')",
		);
		const without = content({ schedule: { events: [], programs: [], themes: [], quotes: [] } });
		expect(() => run(db, without)).toThrow(/FOREIGN KEY/i);
		// All or nothing: the failed import left the earlier rows as they were.
		expect(count(db, "calendar_event")).toBe(1);
		expect(count(db, "post")).toBe(2);
	});

	it("counts the content the plan names", () => {
		expect(countsOf(content())).toEqual({ posts: 2, teachingArticles: 0, pages: 0, areas: 1, statues: 2, monks: 1, events: 1, programs: 0, monthThemes: 1 });
	});
});

const SNAPSHOT = ["posts", "tong-chi", "gioi-thieu", "vu-tru", "bao-tuong", "danh-tang", "schedule"];
const hasSnapshot = SNAPSHOT.every((name) => existsSync(`data/snapshot/${name}.json`));

// The real export of the old admin, when it has been copied to data/snapshot/ (not in git).
describe.skipIf(!hasSnapshot)("real snapshot", () => {
	const read: ReadFile = async (name) => (existsSync(`data/snapshot/${name}.json`) ? { version: "snapshot", data: JSON.parse(readFileSync(`data/snapshot/${name}.json`, "utf8")) } : null);

	it("matches the counts of the old admin, imports twice to the same rows, and links by key", async () => {
		const data = await loadContent(read);
		expect(countsOf(data)).toEqual({ posts: 632, teachingArticles: 25, pages: 6, areas: 14, statues: 126, monks: 91, events: 15, programs: 3, monthThemes: 12 });

		const db = fresh();
		const { statements, report } = run(db, data);
		expect(report.oversizedRows).toEqual([]);
		for (const statement of statements) expect(Buffer.byteLength(inlineStatement(statement))).toBeLessThan(100_000);
		for (const [table, rows] of [["post", 632], ["teaching_article", 25], ["page", 6], ["area", 14], ["statue", 126], ["monk", 91], ["calendar_event", 15], ["featured_program", 3], ["month_theme", 12]] as const) {
			expect(count(db, table), table).toBe(rows);
		}
		expect(db.prepare("pragma foreign_key_check").all()).toEqual([]);

		const first = dump(db);
		run(db, data);
		expect(dump(db)).toBe(first);

		// Every statue stands in an area but "Cổng Tháp", which the plan reports and the data does not place.
		const lost = db.prepare("select area_code from statue where area_id is null group by area_code").all() as { area_code: string }[];
		expect(lost.map((row) => row.area_code)).toEqual(["cong_thap"]);
		// No statue is left with a cluster whose name sits on the statue row itself.
		expect(db.prepare("select count(*) as n from statue s join statue_cluster c on c.id = s.cluster_id where c.assembly_id is null").get()).toEqual({ n: 0 });
	}, 120_000);
});
