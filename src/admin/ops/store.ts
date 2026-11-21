// The `setting` table as the admin reads and writes it: one row per key, the value as JSON text.
import type { AdminDb, AdminStmt } from "../db";
import { text } from "../db";

export async function getSetting<T = unknown>(db: AdminDb, key: string): Promise<T | null> {
	const row = await db.prepare("SELECT value FROM setting WHERE key = ?").bind(key).first();
	const raw = row ? row.value : undefined;
	if (typeof raw !== "string") return (raw as T | undefined) ?? null;
	try {
		return JSON.parse(text(raw)) as T;
	} catch {
		return null;
	}
}

/** The statement that sets a key; put it in the same batch as its audit entry. */
export function putSettingStatement(db: AdminDb, key: string, value: unknown): AdminStmt {
	return db.prepare("INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, JSON.stringify(value));
}
