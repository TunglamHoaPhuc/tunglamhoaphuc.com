// The flags of `npm run import` (scripts/import.ts), run as the real script. A flag the script does not
// know used to be ignored without a word, so `--marge` ran the default import that overwrites and
// prunes. Now every flag is checked first, before the source is read or a database is opened, and the
// default mode refuses a database that already holds the admin's data unless it is told --force.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { applyMigrations, openDatabase } from "../../src/db/nodeSqlite";

// Each run starts a Node process and loads the content layer: a few seconds.
vi.setConfig({ testTimeout: 60_000 });

type Result = { status: number | null; out: string; err: string };

function script(args: string[]): Result {
	const run = spawnSync(process.execPath, ["--import", "tsx", "scripts/import.ts", ...args], { encoding: "utf8", timeout: 100_000 });
	return { status: run.status, out: run.stdout, err: run.stderr };
}

const sha = (file: string) => createHash("sha1").update(readFileSync(file)).digest("hex");

/** A migrated SQLite file in a folder of its own, with `setup` run on it, for `body` to run the script against. */
function withDatabase(setup: (db: DatabaseSync) => void, body: (file: string, dir: string) => void) {
	const dir = mkdtempSync(join(tmpdir(), "tlhp-flags-"));
	try {
		const file = join(dir, "d1.sqlite");
		const db = openDatabase(file);
		applyMigrations(db);
		setup(db);
		db.close();
		body(file, dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

const adminUser = (db: DatabaseSync) => db.exec("insert into user (id, email, role) values ('u1', 'editor@example.org', 'editor')");
const adminLog = (db: DatabaseSync) => db.exec("insert into audit_log (action, entity_type, entity_id, created_at) values ('post.update', 'post', '1', '2026-11-20T00:00:00Z')");

const FLAGS_MESSAGE = /--from.*--sql.*--db.*--batches.*--migrate.*--allow-empty.*--merge.*--dry-run.*--force/s;
const hasSnapshot = ["posts", "tong-chi", "gioi-thieu", "vu-tru", "bao-tuong", "danh-tang", "schedule"].every((name) => existsSync(`data/snapshot/${name}.json`));

describe("npm run import, a flag the script does not know", () => {
	it.each([["--marge"], ["--dryrun"], ["-merge"], ["--merge-only"], ["--Merge"], ["--db-path=x"], ["--sql"], ["--merge=false"], ["--dry-run=0"]])("%s: stops with exit 1 and names the flag and the right ones", (flag) => {
		const result = script([flag]);
		expect(result.status).toBe(1);
		expect(result.err).toContain(flag);
		expect(result.err).toMatch(FLAGS_MESSAGE);
		// It stopped before the source was read.
		expect(result.out).toBe("");
	});

	it("an argument that does not start with -- (merge, a path) is refused too", () => {
		for (const argument of ["merge", "data/import.sql"]) {
			const result = script([argument]);
			expect(result.status).toBe(1);
			expect(result.err).toContain(argument);
			expect(result.err).toMatch(FLAGS_MESSAGE);
		}
	});

	it("names every wrong flag at once, even beside right ones", () => {
		const result = script(["--merge", "--marge", "--dryrun", "extra"]);
		expect(result.status).toBe(1);
		for (const wrong of ["--marge", "--dryrun", "extra"]) expect(result.err).toContain(wrong);
	});

	it("touches nothing: no database file is made, none is written, no .sql file appears", () => {
		withDatabase(adminUser, (file, dir) => {
			const before = sha(file);
			const sqlFile = join(dir, "out.sql");
			const absent = join(dir, "never.sqlite");
			for (const args of [[`--db=${file}`, "--marge"], [`--db=${absent}`, "--migrate", "--dryrun"], [`--sql=${sqlFile}`, "-merge"]]) {
				expect(script(args).status, args.join(" ")).toBe(1);
			}
			expect(sha(file)).toBe(before);
			expect(existsSync(absent)).toBe(false);
			expect(existsSync(sqlFile)).toBe(false);
		});
	});

	it("accepts every flag of the list, none of them is called unknown", () => {
		const result = script(["--from=nowhere", "--sql=x", "--db=y", "--batches=z", "--migrate", "--allow-empty", "--merge", "--dry-run", "--force"]);
		// It gets past the flags and stops at the first thing it really checks.
		expect(result.err).toMatch(/--from không hợp lệ/);
		expect(result.err).not.toMatch(/cờ/i);
	});
});

describe("npm run import, the default mode and a database that holds the admin's data", () => {
	const REFUSED = /đã có dữ liệu/;

	it.each([
		["a user", adminUser],
		["a line of the audit log", adminLog],
	])("is refused for a file with %s, and the file is left as it was", (_name, setup) => {
		withDatabase(setup, (file) => {
			const before = sha(file);
			const result = script([`--db=${file}`, "--from=snapshot"]);
			expect(result.status).toBe(1);
			expect(result.err).toMatch(REFUSED);
			expect(result.err).toContain("--merge");
			expect(result.err).toContain("--force");
			expect(result.out).toBe("");
			expect(sha(file)).toBe(before);
		});
	});

	it("is refused whatever the other flags say, except --merge, --dry-run and --force", () => {
		withDatabase(adminUser, (file) => {
			expect(script([`--db=${file}`, "--migrate", "--allow-empty"]).err).toMatch(REFUSED);
		});
	});

	it("is not refused with --merge, with --dry-run or with --force (it goes on to read the source)", () => {
		withDatabase(adminUser, (file) => {
			for (const extra of [["--merge"], ["--dry-run"], ["--force"], ["--merge", "--dry-run"]]) {
				const result = script([`--db=${file}`, "--from=nowhere", ...extra]);
				expect(result.err, extra.join(" ")).not.toMatch(REFUSED);
				expect(result.err, extra.join(" ")).toMatch(/--from không hợp lệ/);
			}
		});
	});

	it("is not refused for a database with no user and no audit line, or one with no such tables, or one that is not there yet", () => {
		withDatabase(
			() => {},
			(file, dir) => {
				expect(script([`--db=${file}`, "--from=nowhere"]).err).not.toMatch(REFUSED);
				expect(script([`--db=${join(dir, "new.sqlite")}`, "--migrate", "--from=nowhere"]).err).not.toMatch(REFUSED);
			},
		);
		const dir = mkdtempSync(join(tmpdir(), "tlhp-flags-"));
		try {
			const file = join(dir, "bare.sqlite");
			const db = new DatabaseSync(file);
			db.exec("create table x (a)");
			db.close();
			expect(script([`--db=${file}`, "--from=nowhere"]).err).not.toMatch(REFUSED);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it.skipIf(!hasSnapshot)(
		"with --force the full import runs on it and the admin's rows are the ones it does not touch",
		() => {
			withDatabase(adminUser, (file) => {
				const result = script([`--db=${file}`, "--from=snapshot", "--force"]);
				expect(result.err).toBe("");
				expect(result.status).toBe(0);
				const db = new DatabaseSync(file);
				expect(db.prepare("select count(*) as n from user").get()).toEqual({ n: 1 });
				expect((db.prepare("select count(*) as n from post").get() as { n: number }).n).toBeGreaterThan(0);
				db.close();
			});
		},
		120_000,
	);
});
