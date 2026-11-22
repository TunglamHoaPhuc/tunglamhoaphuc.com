// Areas (Vũ Trụ Phật Giáo): their texts, cover, pin on the temple map, visibility, and which ones the home page features.
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type Row } from "../db";
import { ApiError, notFound } from "../http/errors";
import { can } from "../rbac/check";
import { mediaPath, replaceUsageStatements } from "../media/service";
import { revisionStatement } from "../revision";
import { registerTrashable, trashStatement } from "../trash";
import { asBool, audit, checkMedia, conflictOf, diffOf, invalid, mayChange, mayChangeLive, needsPublisher, stamp, staleVersion } from "./common";
import { cleanBodyHtml } from "./html";

export type AreaModel = {
	name: string;
	subtitle: string;
	coverMediaId: string | null;
	coverPosition: string;
	mapX: number | null;
	mapY: number | null;
	intro: string;
	contentHtml: string;
	visible: boolean;
	position: number;
};
export type AreaItem = AreaModel & { id: string; slug: string; coverUrl: string; featured: boolean; featuredPosition: number; statueCount: number; version: number; updatedAt: string | null };

const SELECT = `SELECT a.*, m.r2_key AS cover_key, m.url AS cover_url, (SELECT COUNT(*) FROM statue s WHERE s.area_id = a.id AND s.deleted_at IS NULL) AS statue_count
	FROM area a LEFT JOIN media m ON m.id = a.cover_media_id`;

const modelOf = (row: Row): AreaModel => ({
	name: text(row.name),
	subtitle: text(row.subtitle),
	coverMediaId: text(row.cover_media_id) || null,
	coverPosition: text(row.cover_position) || "center 50%",
	mapX: row.map_x == null ? null : num(row.map_x),
	mapY: row.map_y == null ? null : num(row.map_y),
	intro: text(row.intro),
	contentHtml: text(row.content_html),
	visible: asBool(row.visible),
	position: num(row.position),
});

const itemOf = (row: Row): AreaItem => ({
	...modelOf(row),
	id: text(row.id),
	slug: text(row.slug),
	coverUrl: mediaPath(text(row.cover_key) || null, text(row.cover_url) || null),
	featured: asBool(row.featured),
	featuredPosition: num(row.featured_position),
	statueCount: num(row.statue_count),
	version: num(row.version) || 1,
	updatedAt: text(row.updated_at) || null,
});

export async function listAreas(ctx: AuthContext): Promise<AreaItem[]> {
	const { results } = await ctx.db.prepare(`${SELECT} WHERE a.deleted_at IS NULL ORDER BY a.position, a.name, a.id`).all();
	return results.map(itemOf);
}

async function findRow(ctx: AuthContext, id: string): Promise<Row> {
	const row = await ctx.db.prepare(`${SELECT} WHERE a.id = ? AND a.deleted_at IS NULL`).bind(id).first();
	if (!row) throw notFound("Khu vực");
	return row;
}

export async function getArea(ctx: AuthContext, id: string): Promise<AreaItem> {
	return itemOf(await findRow(ctx, id));
}

export async function updateArea(ctx: AuthContext, by: Authed, id: string, version: number, patch: Partial<AreaModel>): Promise<AreaItem> {
	const row = await findRow(ctx, id);
	mayChange(by, "areas", "update", text(row.created_by) || null);
	staleVersion(row, version);
	const before = modelOf(row);
	const model: AreaModel = { ...before, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) };
	mayChangeLive(by, "areas", before.visible || model.visible); // editing a visible area, or switching one on
	model.name = model.name.trim();
	if (!model.name) throw invalid("name", "Nhập tên khu vực.");
	for (const [field, value] of [["mapX", model.mapX], ["mapY", model.mapY]] as const) {
		if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) throw invalid(field, "Vị trí ghim phải từ 0 đến 100 (phần trăm).");
	}
	if ((model.mapX === null) !== (model.mapY === null)) throw invalid("mapX", "Cần nhập cả hai tọa độ của ghim, hoặc để trống cả hai.");
	model.contentHtml = cleanBodyHtml(model.contentHtml);
	await checkMedia(ctx, "coverMediaId", model.coverMediaId);
	const now = stamp(ctx);
	const next = version + 1;
	try {
		await ctx.db.batch([
			ctx.db
				.prepare(
					`UPDATE area SET name = ?, subtitle = ?, cover_media_id = ?, cover_position = ?, map_x = ?, map_y = ?, intro = ?, content_html = ?, visible = ?, position = ?,
					 version = ?, updated_by = ?, updated_at = ? WHERE id = ? AND version = ?`,
				)
				.bind(model.name, model.subtitle, model.coverMediaId, model.coverPosition, model.mapX, model.mapY, model.intro, model.contentHtml, model.visible ? 1 : 0, model.position, next, by.user.id, now, id, version),
			...replaceUsageStatements(ctx, "area", id, model.coverMediaId ? [{ mediaId: model.coverMediaId, field: "cover_media_id" }] : []),
			revisionStatement(ctx, by, "area", id, next, { id, slug: text(row.slug), ...model }, "Sửa khu vực"),
			audit(ctx, by, { action: "area.update", entityType: "area", entityId: id, before: diffOf(before, model, "before"), after: diffOf(before, model, "after") }),
		]);
	} catch (error) {
		conflictOf(error, "Địa chỉ này đã có khu vực khác dùng.");
	}
	return getArea(ctx, id);
}

const MAX_FEATURED = 12;

/** The areas the home page features, in order; every other area is switched off. */
export async function setFeatured(ctx: AuthContext, by: Authed, ids: string[]): Promise<AreaItem[]> {
	// The featured set is live at once (no draft): docs 7.6 puts it under the home page rights, so changing it takes home.publish.
	if (!can(by.permissions, "home", "publish")) throw needsPublisher("Khu vực nổi bật hiện ngay trên trang chủ, nên cần quyền xuất bản trang chủ.");
	if (ids.length > MAX_FEATURED) throw invalid("ids", `Tối đa ${MAX_FEATURED} khu vực nổi bật.`);
	if (new Set(ids).size !== ids.length) throw invalid("ids", "Có khu vực được chọn hai lần.");
	const before = (await listAreas(ctx)).filter((area) => area.featured).sort((a, b) => a.featuredPosition - b.featuredPosition).map((area) => area.id);
	for (const id of ids) if (!(await ctx.db.prepare("SELECT 1 AS yes FROM area WHERE id = ? AND deleted_at IS NULL").bind(id).first())) throw new ApiError(400, "invalid_input", "Có khu vực không tồn tại.", { ids: "Có khu vực không tồn tại." });
	const now = stamp(ctx);
	await ctx.db.batch([
		ctx.db.prepare("UPDATE area SET featured = 0, featured_position = 0 WHERE featured = 1").bind(),
		...ids.map((id, index) => ctx.db.prepare("UPDATE area SET featured = 1, featured_position = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL").bind(index, now, by.user.id, id)),
		audit(ctx, by, { action: "area.featured", entityType: "area", entityId: "featured", before: { ids: before }, after: { ids } }),
	]);
	return listAreas(ctx);
}

export async function deleteArea(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const row = await findRow(ctx, id);
	mayChange(by, "areas", "delete", text(row.created_by) || null);
	mayChangeLive(by, "areas", asBool(row.visible));
	await ctx.db.batch([
		trashStatement(ctx, by, "area", id),
		ctx.db.prepare("UPDATE area SET featured = 0 WHERE id = ?").bind(id),
		audit(ctx, by, { action: "area.trash", entityType: "area", entityId: id, before: { name: row.name } }),
	]);
}

registerTrashable({
	type: "area",
	label: "Khu vực",
	table: "area",
	titleSql: "name",
	module: "areas",
	isLive: (row) => asBool(row.visible),
	hasCreatedBy: true,
	purge: (ctx, _by, id) => [
		ctx.db.prepare("DELETE FROM revision WHERE entity_type = 'area' AND entity_id = ?").bind(id),
		ctx.db.prepare("DELETE FROM media_usage WHERE entity_type = 'area' AND entity_id = ?").bind(id),
	],
});
