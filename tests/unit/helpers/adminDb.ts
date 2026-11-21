// An AdminDb on node:sqlite with every migration applied: the same SQL the Worker sends to D1, with
// foreign keys on as D1 has them.
import type { DatabaseSync } from "node:sqlite";
import type { AdminDb } from "../../../src/admin/db";
import { asAdminDb } from "../../../src/db/nodeAdminDb";
import { applyMigrations, openDatabase } from "../../../src/db/nodeSqlite";

export function memoryAdminDb(): { db: AdminDb; raw: DatabaseSync } {
	const raw = openDatabase();
	applyMigrations(raw);
	return { db: asAdminDb(raw), raw };
}
