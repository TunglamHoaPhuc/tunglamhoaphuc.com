// A copy of a row each time it is saved (docs/admin-architecture.md 5.3): the editors compare versions and go back.
// A module saves with `revisionStatement` in the same batch as the change, using the new `version` of the row; the
// UNIQUE index (entity_type, entity_id, version) is also what turns two editors saving at once into a 409.
import type { AuthContext, Authed } from "./auth/service";
import { num, text, type AdminStmt } from "./db";
import { ApiError, notFound } from "./http/errors";

const MAX_SNAPSHOT_BYTES = 1_500_000;

export function revisionStatement(ctx: AuthContext, by: Authed, entityType: string, entityId: string, version: number, snapshot: unknown, summary = ""): AdminStmt {
	const json = JSON.stringify(snapshot);
	if (json.length > MAX_SNAPSHOT_BYTES) throw new ApiError(413, "too_large", "Nội dung quá lớn để lưu (hơn 1,5 MB). Hãy chia nhỏ bài.");
	return ctx.db
		.prepare("INSERT INTO revision (entity_type, entity_id, version, snapshot, summary, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
		.bind(entityType, entityId, version, json, summary.slice(0, 200), by.user.id, ctx.now().toISOString());
}

export type RevisionRow = { version: number; summary: string; createdBy: string | null; createdByName: string; createdAt: string };

export async function listRevisions(ctx: AuthContext, entityType: string, entityId: string): Promise<RevisionRow[]> {
	const { results } = await ctx.db
		.prepare("SELECT r.version, r.summary, r.created_by, COALESCE(u.name, '') AS name, r.created_at FROM revision r LEFT JOIN user u ON u.id = r.created_by WHERE r.entity_type = ? AND r.entity_id = ? ORDER BY r.version DESC LIMIT 200")
		.bind(entityType, entityId)
		.all();
	return results.map((row) => ({ version: num(row.version), summary: text(row.summary), createdBy: text(row.created_by) || null, createdByName: text(row.name), createdAt: text(row.created_at) }));
}

export async function getRevision(ctx: AuthContext, entityType: string, entityId: string, version: number): Promise<RevisionRow & { snapshot: unknown }> {
	const row = await ctx.db
		.prepare("SELECT r.version, r.summary, r.created_by, COALESCE(u.name, '') AS name, r.created_at, r.snapshot FROM revision r LEFT JOIN user u ON u.id = r.created_by WHERE r.entity_type = ? AND r.entity_id = ? AND r.version = ?")
		.bind(entityType, entityId, version)
		.first();
	if (!row) throw notFound("Phiên bản");
	return { version: num(row.version), summary: text(row.summary), createdBy: text(row.created_by) || null, createdByName: text(row.name), createdAt: text(row.created_at), snapshot: JSON.parse(text(row.snapshot) || "null") };
}
