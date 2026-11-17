// A SQLite file or memory database through node:sqlite, for the import's `--db` mode and for
// tests that need the real schema. Node only: the Worker reaches D1 through its binding.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import type { D1Like, D1Statement } from "../libs/content/sources/d1";
import type { Statement } from "./import";

export const MIGRATIONS_DIR = "migrations";

/** Opens a database with foreign keys enforced, as D1 does. */
export function openDatabase(path = ":memory:"): DatabaseSync {
	const db = new DatabaseSync(path);
	db.exec("PRAGMA foreign_keys = ON");
	return db;
}

/** Runs every migrations/*.sql in name order (drizzle-kit's `--> statement-breakpoint` lines are only comments to SQLite). */
export function applyMigrations(db: DatabaseSync, dir = MIGRATIONS_DIR): string[] {
	const files = readdirSync(dir)
		.filter((name) => name.endsWith(".sql"))
		.sort();
	for (const name of files) db.exec(readFileSync(join(dir, name), "utf8"));
	return files;
}

/** Runs the statements in one transaction: all of them, or none when one fails. */
export function applyStatements(db: DatabaseSync, statements: Statement[]): void {
	db.exec("BEGIN");
	try {
		for (const { sql, params } of statements) db.prepare(sql).run(...(params as never[]));
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
}

/** A node:sqlite database as the part of D1 the d1 content source uses, for tests and local runs. */
export function asD1(db: DatabaseSync): D1Like {
	const statement = (sql: string, values: unknown[]): D1Statement => ({
		bind: (...more) => statement(sql, [...values, ...more]),
		all: async <T>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
	});
	return { prepare: (sql) => statement(sql, []) };
}
