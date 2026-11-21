// Helpers for the operations tests: the usual accounts, a fake backup bucket, rows to put in the trash.
import type { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";
import type { BackupBucket } from "../../../src/admin/ops/backup";
import type { Seed } from "./adminWorld";

export const SEEDS: Seed[] = [
	{ id: "root", email: "root@example.test", roleId: "role-super-admin", name: "Gốc" },
	{ id: "admin", email: "admin@example.test", roleId: "role-admin", name: "Quản trị" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor", name: "Biên tập" },
	{ id: "author", email: "author@example.test", roleId: "role-author", name: "Cộng tác" },
	{ id: "author2", email: "author2@example.test", roleId: "role-author", name: "Cộng tác hai" },
];

/** An R2 bucket in memory. */
export function fakeBucket() {
	const objects = new Map<string, { bytes: Uint8Array; uploaded: Date }>();
	let tick = 0;
	const bucket: BackupBucket = {
		put: async (key, value) => void objects.set(key, { bytes: value, uploaded: new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)) }),
		get: async (key) => {
			const found = objects.get(key);
			if (!found) return null;
			return { size: found.bytes.length, body: new Blob([found.bytes as BlobPart]).stream() as ReadableStream<Uint8Array> };
		},
		list: async ({ prefix = "" } = {}) => ({
			objects: [...objects].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, size: value.bytes.length, uploaded: value.uploaded })),
			truncated: false,
		}),
		delete: async (keys) => void [keys].flat().forEach((key) => objects.delete(key)),
	};
	return { bucket, objects };
}

export type BackupFile = { format: string; version: number; createdAt: string; excluded: string[]; tables: Record<string, { columns: string[]; rows: unknown[][] }> };

export const parseBackup = (bytes: Uint8Array | Buffer): BackupFile => JSON.parse(gunzipSync(bytes).toString("utf8")) as BackupFile;

/** A library picture, in the trash when `deletedAt` is given. */
export function insertMedia(raw: DatabaseSync, row: { id: string; uploadedBy?: string | null; deletedAt?: string; deletedBy?: string | null; r2Key?: string; title?: string }) {
	raw
		.prepare("INSERT INTO media (id, r2_key, filename, title, uploaded_by, created_at, deleted_at, deleted_by) VALUES (?, ?, ?, ?, ?, '2026-01-01', ?, ?)")
		.run(row.id, row.r2Key ?? `cms/${row.id}/v1/${row.id}.png`, `${row.id}.png`, row.title ?? "", row.uploadedBy ?? null, row.deletedAt ?? null, row.deletedBy ?? null);
}

export function insertAudit(raw: DatabaseSync, row: { userId?: string | null; email?: string; action?: string; entityType?: string; entityId?: string; ip?: string; at: string; before?: unknown; after?: unknown }) {
	raw
		.prepare("INSERT INTO audit_log (user_id, user_email, action, entity_type, entity_id, data_before, data_after, ip, user_agent, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'test', '', ?)")
		.run(row.userId ?? null, row.email ?? "", row.action ?? "x.y", row.entityType ?? "thing", row.entityId ?? "1", row.before === undefined ? null : JSON.stringify(row.before), row.after === undefined ? null : JSON.stringify(row.after), row.ip ?? "", row.at);
}

export const count = (raw: DatabaseSync, table: string, where = "1=1") => (raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get() as { n: number }).n;
