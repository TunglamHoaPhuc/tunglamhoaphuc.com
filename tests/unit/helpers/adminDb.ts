// An AdminDb on node:sqlite with every migration applied: the same SQL the Worker sends to D1, with
// foreign keys on as D1 has them.
import type { DatabaseSync } from "node:sqlite";
import { applyMigrations, openDatabase } from "../../../src/db/nodeSqlite";
import type { AdminDb, AdminStmt } from "../../../src/admin/db";

function statement(db: DatabaseSync, sql: string, values: unknown[] = []): AdminStmt & { exec(): { changes: number | bigint } } {
	return {
		bind: (...more) => statement(db, sql, [...values, ...more]),
		first: async <T,>() => ((db.prepare(sql).get(...(values as never[])) as T | undefined) ?? null),
		all: async <T,>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
		run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(values as never[])).changes) } }),
		exec: () => db.prepare(sql).run(...(values as never[])),
	};
}

export function memoryAdminDb(): { db: AdminDb; raw: DatabaseSync } {
	const raw = openDatabase();
	applyMigrations(raw);
	const db: AdminDb = {
		prepare: (sql) => statement(raw, sql),
		batch: async (statements) => {
			raw.exec("BEGIN");
			try {
				const results = statements.map((item) => (item as ReturnType<typeof statement>).exec());
				raw.exec("COMMIT");
				return results;
			} catch (error) {
				raw.exec("ROLLBACK");
				throw error;
			}
		},
	};
	return { db, raw };
}
