// A node:sqlite database as the AdminDb the admin code uses: for tests and for the local-D1 script.
// Node only: the Worker reaches D1 through its binding.
import type { DatabaseSync } from "node:sqlite";
import type { AdminDb, AdminStmt } from "../admin/db";

type NodeStmt = AdminStmt & { exec(): { changes: number | bigint } };

function statement(db: DatabaseSync, sql: string, values: unknown[] = []): NodeStmt {
	return {
		bind: (...more) => statement(db, sql, [...values, ...more]),
		first: async <T,>() => (db.prepare(sql).get(...(values as never[])) as T | undefined) ?? null,
		all: async <T,>() => ({ results: db.prepare(sql).all(...(values as never[])) as T[] }),
		run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(values as never[])).changes) } }),
		exec: () => db.prepare(sql).run(...(values as never[])),
	};
}

export function asAdminDb(raw: DatabaseSync): AdminDb {
	return {
		prepare: (sql) => statement(raw, sql),
		// Like D1's batch: all of it, or none when one statement fails.
		batch: async (statements) => {
			raw.exec("BEGIN");
			try {
				const results = statements.map((item) => (item as NodeStmt).exec());
				raw.exec("COMMIT");
				return results;
			} catch (error) {
				raw.exec("ROLLBACK");
				throw error;
			}
		},
	};
}
