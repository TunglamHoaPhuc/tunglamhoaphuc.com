// Statues (Bảo Tượng): the statue itself, its angle pictures, hand-picked related statues and art variations
// (docs/admin-architecture.md 7.7). Every save works on a whole "state" (row + children), so the picture usage,
// the revision and the audit entry are always made from the same data.
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminStmt, type Row } from "../db";
import { ApiError, notFound } from "../http/errors";
import { likeWord, type Page } from "../http/paging";
import { newId } from "../ids";
import { mediaPath, replaceUsageStatements } from "../media/service";
import { revisionStatement } from "../revision";
import { registerTrashable, trashStatement } from "../trash";
import { asBool, audit, checkMedia, checkMediaAll, checkStatusChange, conflictOf, diffOf, invalid, json, mayChange, mayChangeLive, slugFor, stamp, staleVersion, taken } from "./common";
import { cleanBodyHtml } from "./html";

export type StatueCore = {
	code: string;
	slug: string;
	name: string;
	subtitle: string;
	assemblyId: string | null;
	clusterId: string | null;
	areaId: string | null;
	isMain: boolean;
	imageMediaId: string | null;
	imagePosition: string;
	editorialBoard: string;
	specs: Record<string, string>;
	quoteText: string;
	quoteAuthor: string;
	body: string;
	status: "draft" | "pending" | "published" | "scheduled" | "hidden";
	position: number;
};
export type StatueImageEntry = { mediaId: string; label: string; imagePosition: string };
export type VariationEntry = { id: string; variationId: string; title: string; location: string; meaning: string; imageMediaId: string | null; imagePosition: string; artStatueId: string | null };
type State = { core: StatueCore; images: StatueImageEntry[]; related: string[]; variations: VariationEntry[]; areaCode: string };

export type StatueSummaryItem = StatueCore & { id: string; imageUrl: string; assemblyName: string; clusterName: string; areaName: string; version: number; updatedAt: string | null; createdBy: string | null };
export type StatueDetail = StatueSummaryItem & {
	images: (StatueImageEntry & { url: string })[];
	related: { id: string; name: string; code: string; imageUrl: string }[];
	variations: (VariationEntry & { imageUrl: string })[];
};

const SELECT = `SELECT s.*, g.name AS assembly_name, k.name AS cluster_name, a.name AS area_name, m.r2_key AS img_key, m.url AS img_url
	FROM statue s LEFT JOIN category g ON g.id = s.assembly_id LEFT JOIN statue_cluster k ON k.id = s.cluster_id LEFT JOIN area a ON a.id = s.area_id LEFT JOIN media m ON m.id = s.image_media_id`;

const coreOf = (row: Row): StatueCore => ({
	code: text(row.code),
	slug: text(row.slug),
	name: text(row.name),
	subtitle: text(row.subtitle),
	assemblyId: text(row.assembly_id) || null,
	clusterId: text(row.cluster_id) || null,
	areaId: text(row.area_id) || null,
	isMain: asBool(row.is_main),
	imageMediaId: text(row.image_media_id) || null,
	imagePosition: text(row.image_position) || "center 50%",
	editorialBoard: text(row.editorial_board),
	specs: json<Record<string, string>>(row.specs, {}),
	quoteText: text(row.quote_text),
	quoteAuthor: text(row.quote_author),
	body: text(row.body),
	status: (text(row.status) || "published") as StatueCore["status"],
	position: num(row.position),
});

const summaryOf = (row: Row): StatueSummaryItem => ({
	...coreOf(row),
	id: text(row.id),
	imageUrl: mediaPath(text(row.img_key) || null, text(row.img_url) || null),
	assemblyName: text(row.assembly_name),
	clusterName: text(row.cluster_name),
	areaName: text(row.area_name),
	version: num(row.version) || 1,
	updatedAt: text(row.updated_at) || null,
	createdBy: text(row.created_by) || null,
});

// ------------------------------------------------------------------ reading

export type StatueFilter = { q?: string; assembly?: string; area?: string; main?: string; status?: string };

export async function listStatues(ctx: AuthContext, filter: StatueFilter, page: Page): Promise<{ rows: StatueSummaryItem[]; total: number }> {
	const where = ["s.deleted_at IS NULL"];
	const args: unknown[] = [];
	if (filter.q) {
		where.push("(s.name LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\' OR s.subtitle LIKE ? ESCAPE '\\')");
		args.push(likeWord(filter.q), likeWord(filter.q), likeWord(filter.q));
	}
	if (filter.assembly) {
		where.push("s.assembly_id = ?");
		args.push(filter.assembly);
	}
	if (filter.area) {
		where.push("s.area_id = ?");
		args.push(filter.area);
	}
	if (filter.main === "1" || filter.main === "0") {
		where.push("s.is_main = ?");
		args.push(Number(filter.main));
	}
	if (filter.status) {
		where.push("s.status = ?");
		args.push(filter.status);
	}
	const clause = where.join(" AND ");
	const total = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM statue s WHERE ${clause}`).bind(...args).first();
	const { results } = await ctx.db.prepare(`${SELECT} WHERE ${clause} ORDER BY s.position, s.code, s.id LIMIT ? OFFSET ?`).bind(...args, page.pageSize, page.offset).all();
	return { rows: results.map(summaryOf), total: num(total?.n) };
}

async function findRow(ctx: AuthContext, id: string): Promise<Row> {
	const row = await ctx.db.prepare(`${SELECT} WHERE s.id = ? AND s.deleted_at IS NULL`).bind(id).first();
	if (!row) throw notFound("Bảo tượng");
	return row;
}

async function loadState(ctx: AuthContext, row: Row): Promise<State> {
	const id = text(row.id);
	const images = await ctx.db.prepare("SELECT media_id, label, image_position FROM statue_image WHERE statue_id = ? ORDER BY position").bind(id).all();
	const related = await ctx.db.prepare("SELECT related_id FROM statue_related WHERE statue_id = ? ORDER BY position, related_id").bind(id).all();
	const variations = await ctx.db.prepare("SELECT * FROM art_variation WHERE statue_id = ? ORDER BY position").bind(id).all();
	return {
		core: coreOf(row),
		areaCode: text(row.area_code),
		images: images.results.map((item) => ({ mediaId: text(item.media_id), label: text(item.label), imagePosition: text(item.image_position) || "center 50%" })),
		related: related.results.map((item) => text(item.related_id)),
		variations: variations.results.map((item) => ({
			id: text(item.id), variationId: text(item.variation_id), title: text(item.title), location: text(item.location), meaning: text(item.meaning),
			imageMediaId: text(item.image_media_id) || null, imagePosition: text(item.image_position) || "center 50%", artStatueId: text(item.art_statue_id) || null,
		})),
	};
}

export async function getStatue(ctx: AuthContext, id: string): Promise<StatueDetail> {
	const row = await findRow(ctx, id);
	const state = await loadState(ctx, row);
	const mediaIds = [...state.images.map((item) => item.mediaId), ...state.variations.flatMap((item) => (item.imageMediaId ? [item.imageMediaId] : []))];
	const urls = new Map<string, string>();
	for (let i = 0; i < mediaIds.length; i += 25) {
		const chunk = mediaIds.slice(i, i + 25);
		const { results } = await ctx.db.prepare(`SELECT id, r2_key, url FROM media WHERE id IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all();
		for (const item of results) urls.set(text(item.id), mediaPath(text(item.r2_key) || null, text(item.url) || null));
	}
	const relatedRows = state.related.length
		? (await ctx.db
				.prepare(`SELECT s.id, s.name, s.code, m.r2_key, m.url FROM statue s LEFT JOIN media m ON m.id = s.image_media_id WHERE s.deleted_at IS NULL AND s.id IN (${state.related.map(() => "?").join(",")})`)
				.bind(...state.related)
				.all()).results
		: [];
	const byId = new Map(relatedRows.map((item) => [text(item.id), item]));
	return {
		...summaryOf(row),
		images: state.images.map((item) => ({ ...item, url: urls.get(item.mediaId) ?? "" })),
		related: state.related.flatMap((relatedId) => {
			const item = byId.get(relatedId);
			return item ? [{ id: relatedId, name: text(item.name), code: text(item.code), imageUrl: mediaPath(text(item.r2_key) || null, text(item.url) || null) }] : [];
		}),
		variations: state.variations.map((item) => ({ ...item, imageUrl: item.imageMediaId ? (urls.get(item.imageMediaId) ?? "") : "" })),
	};
}

/** The next free code: TP followed by the highest number in use plus one (at least four digits). */
export async function nextStatueCode(ctx: AuthContext): Promise<string> {
	const { results } = await ctx.db.prepare("SELECT code FROM statue WHERE deleted_at IS NULL AND code LIKE 'TP%'").all();
	let max = 0;
	let width = 4;
	for (const row of results) {
		const match = /^TP(\d+)$/i.exec(text(row.code));
		if (!match) continue;
		max = Math.max(max, Number(match[1]));
		width = Math.max(width, match[1].length);
	}
	return `TP${String(max + 1).padStart(width, "0")}`;
}

export async function statueOptions(ctx: AuthContext) {
	const assemblies = await ctx.db.prepare("SELECT id, name FROM category WHERE kind = 'assembly' AND deleted_at IS NULL ORDER BY position, name").all();
	const clusters = await ctx.db.prepare("SELECT id, name, assembly_id, area_id FROM statue_cluster ORDER BY name").all();
	const areas = await ctx.db.prepare("SELECT id, name FROM area WHERE deleted_at IS NULL ORDER BY position, name").all();
	return {
		assemblies: assemblies.results.map((row) => ({ id: text(row.id), name: text(row.name) })),
		clusters: clusters.results.map((row) => ({ id: text(row.id), name: text(row.name), assemblyId: text(row.assembly_id) || null, areaId: text(row.area_id) || null })),
		areas: areas.results.map((row) => ({ id: text(row.id), name: text(row.name) })),
	};
}

export async function createCluster(ctx: AuthContext, by: Authed, input: { name: string; assemblyId?: string | null; areaId?: string | null }) {
	const name = input.name.trim();
	if (await ctx.db.prepare("SELECT 1 AS yes FROM statue_cluster WHERE name = ? COLLATE NOCASE").bind(name).first()) throw new ApiError(409, "name_taken", "Nhóm này đã có.", { name: "Nhóm này đã có." });
	const id = newId("cluster", ctx.now().getTime());
	await ctx.db.batch([
		ctx.db.prepare("INSERT INTO statue_cluster (id, name, assembly_id, area_id, description) VALUES (?, ?, ?, ?, '')").bind(id, name, input.assemblyId || null, input.areaId || null),
		audit(ctx, by, { action: "statue_cluster.create", entityType: "statue_cluster", entityId: id, after: { name } }),
	]);
	return { id, name, assemblyId: input.assemblyId || null, areaId: input.areaId || null };
}

// ------------------------------------------------------------------ validation and writing

const SPEC_LIMIT = 20;

async function validateCore(ctx: AuthContext, core: StatueCore, exceptId?: string): Promise<StatueCore> {
	const name = core.name.trim();
	if (!name) throw invalid("name", "Nhập tên bảo tượng.");
	const code = core.code.trim().toUpperCase();
	if (!/^[A-Z0-9_-]{0,20}$/.test(code)) throw invalid("code", "Mã chỉ gồm chữ, số, gạch nối, tối đa 20 ký tự.");
	if (code && (await taken(ctx, "statue", "code", code, exceptId))) throw new ApiError(409, "code_taken", `Mã ${code} đã có bảo tượng khác dùng.`, { code: `Mã ${code} đã có bảo tượng khác dùng.` });
	const slug = slugFor(core.slug, name);
	if (await taken(ctx, "statue", "slug", slug, exceptId)) throw new ApiError(409, "slug_taken", "Địa chỉ này đã có bảo tượng khác dùng.", { slug: "Địa chỉ này đã có bảo tượng khác dùng." });
	if (core.assemblyId) {
		const row = await ctx.db.prepare("SELECT kind FROM category WHERE id = ? AND deleted_at IS NULL").bind(core.assemblyId).first();
		if (!row || text(row.kind) !== "assembly") throw invalid("assemblyId", "Chúng hội không có trong danh sách.");
	}
	if (core.clusterId && !(await ctx.db.prepare("SELECT 1 AS yes FROM statue_cluster WHERE id = ?").bind(core.clusterId).first())) throw invalid("clusterId", "Nhóm tượng không có trong danh sách.");
	if (core.areaId && !(await ctx.db.prepare("SELECT 1 AS yes FROM area WHERE id = ? AND deleted_at IS NULL").bind(core.areaId).first())) throw invalid("areaId", "Khu vực không tồn tại.");
	await checkMedia(ctx, "imageMediaId", core.imageMediaId);
	const entries = Object.entries(core.specs).map(([key, value]) => [key.trim(), String(value).trim()] as const).filter(([key]) => key);
	if (entries.length > SPEC_LIMIT) throw invalid("specs", `Tối đa ${SPEC_LIMIT} thông số.`);
	if (new Set(entries.map(([key]) => key.toLowerCase())).size !== entries.length) throw invalid("specs", "Có hai thông số trùng tên.");
	for (const [key, value] of entries) if (key.length > 60 || value.length > 300) throw invalid("specs", "Tên thông số tối đa 60 ký tự, giá trị tối đa 300 ký tự.");
	return { ...core, name, code, slug, specs: Object.fromEntries(entries), body: cleanBodyHtml(core.body) };
}

async function validateChildren(ctx: AuthContext, id: string, state: State): Promise<void> {
	if (state.images.length > 20) throw invalid("images", "Tối đa 20 ảnh các góc.");
	await checkMediaAll(ctx, "images", state.images.map((item) => item.mediaId));
	if (state.related.length > 12) throw invalid("related", "Tối đa 12 bảo tượng liên quan.");
	if (new Set(state.related).size !== state.related.length) throw invalid("related", "Có bảo tượng được chọn hai lần.");
	if (state.related.includes(id)) throw invalid("related", "Không thể chọn chính bảo tượng này.");
	for (const relatedId of state.related) if (!(await ctx.db.prepare("SELECT 1 AS yes FROM statue WHERE id = ? AND deleted_at IS NULL").bind(relatedId).first())) throw invalid("related", "Có bảo tượng liên quan không tồn tại.");
	if (state.variations.length > 30) throw invalid("variations", "Tối đa 30 tác phẩm nghệ thuật.");
	await checkMediaAll(ctx, "variations", state.variations.map((item) => item.imageMediaId));
	for (const item of state.variations) {
		if (item.artStatueId && !(await ctx.db.prepare("SELECT 1 AS yes FROM statue WHERE id = ? AND deleted_at IS NULL").bind(item.artStatueId).first())) throw invalid("variations", "Bảo tượng liên kết của tác phẩm không tồn tại.");
	}
}

const usesOf = (state: State) => [
	...(state.core.imageMediaId ? [{ mediaId: state.core.imageMediaId, field: "image_media_id" }] : []),
	...state.images.map((item, index) => ({ mediaId: item.mediaId, field: `statue_image:${index}` })),
	...state.variations.flatMap((item) => (item.imageMediaId ? [{ mediaId: item.imageMediaId, field: `art_variation:${item.id}` }] : [])),
];

function childStatements(ctx: AuthContext, id: string, before: State | null, after: State): AdminStmt[] {
	const out: AdminStmt[] = [];
	const changed = (a: unknown, b: unknown) => before === null || JSON.stringify(a) !== JSON.stringify(b);
	if (changed(before?.images, after.images)) {
		out.push(ctx.db.prepare("DELETE FROM statue_image WHERE statue_id = ?").bind(id));
		after.images.forEach((item, index) => out.push(ctx.db.prepare("INSERT INTO statue_image (statue_id, position, media_id, label, image_position) VALUES (?, ?, ?, ?, ?)").bind(id, index, item.mediaId, item.label, item.imagePosition)));
	}
	if (changed(before?.related, after.related)) {
		out.push(ctx.db.prepare("DELETE FROM statue_related WHERE statue_id = ?").bind(id));
		after.related.forEach((relatedId, index) => out.push(ctx.db.prepare("INSERT INTO statue_related (statue_id, related_id, position) VALUES (?, ?, ?)").bind(id, relatedId, index)));
	}
	if (changed(before?.variations, after.variations)) {
		out.push(ctx.db.prepare("DELETE FROM art_variation WHERE statue_id = ?").bind(id));
		after.variations.forEach((item, index) =>
			out.push(
				ctx.db
					.prepare("INSERT INTO art_variation (id, statue_id, position, variation_id, art_statue_id, title, location, meaning, image_media_id, image_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
					.bind(item.id, id, index, item.variationId, item.artStatueId, item.title, item.location, item.meaning, item.imageMediaId, item.imagePosition),
			),
		);
	}
	return out;
}

/** An area's own statues use the area code the Bảo Tượng file gave them; a statue moved into an area takes a neighbour's. */
async function areaCodeFor(ctx: AuthContext, areaId: string | null, keep: string, previousArea: string | null): Promise<string> {
	if (areaId === previousArea) return keep;
	if (!areaId) return "";
	const row = await ctx.db.prepare("SELECT area_code FROM statue WHERE area_id = ? AND area_code <> '' AND deleted_at IS NULL LIMIT 1").bind(areaId).first();
	return row ? text(row.area_code) : "";
}

const SLUG_TAKEN = "Địa chỉ này đã có bảo tượng khác dùng.";
const CODE_TAKEN = "Mã này đã có bảo tượng khác dùng.";

export async function createStatue(ctx: AuthContext, by: Authed, input: { core: StatueCore; images?: StatueImageEntry[]; related?: string[]; variations?: Omit<VariationEntry, "id" | "variationId">[] }): Promise<StatueDetail> {
	checkStatusChange(by, "statues", null, input.core.status);
	const id = newId("statue", ctx.now().getTime());
	const core = await validateCore(ctx, input.core);
	const state: State = {
		core,
		areaCode: await areaCodeFor(ctx, core.areaId, "", null),
		images: input.images ?? [],
		related: input.related ?? [],
		variations: (input.variations ?? []).map((item) => {
			const vid = newId("artv", ctx.now().getTime());
			return { ...item, id: vid, variationId: vid };
		}),
	};
	await validateChildren(ctx, id, state);
	const now = stamp(ctx);
	try {
		await ctx.db.batch([
			ctx.db
				.prepare(
					`INSERT INTO statue (id, code, slug, name, subtitle, area_id, area_code, cluster_id, assembly_id, is_main, image_media_id, image_position, quote_text, quote_author, body, position, editorial_board, specs, status, version, created_by, updated_by, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
				)
				.bind(id, core.code, core.slug, core.name, core.subtitle, core.areaId, state.areaCode, core.clusterId, core.assemblyId, core.isMain ? 1 : 0, core.imageMediaId, core.imagePosition, core.quoteText || null, core.quoteText ? core.quoteAuthor : null, core.body, core.position, core.editorialBoard, JSON.stringify(core.specs), core.status, by.user.id, by.user.id, now),
			...childStatements(ctx, id, null, state),
			...replaceUsageStatements(ctx, "statue", id, usesOf(state)),
			revisionStatement(ctx, by, "statue", id, 1, { id, ...state }, "Tạo bảo tượng"),
			audit(ctx, by, { action: "statue.create", entityType: "statue", entityId: id, after: { name: core.name, code: core.code, status: core.status } }),
		]);
	} catch (error) {
		conflictOf(error, SLUG_TAKEN, { codeMessage: CODE_TAKEN });
	}
	return getStatue(ctx, id);
}

type Change = { core?: Partial<StatueCore>; images?: StatueImageEntry[]; related?: string[]; variations?: (Omit<VariationEntry, "id" | "variationId"> & { id?: string })[]; summary: string; action: string };

async function persist(ctx: AuthContext, by: Authed, id: string, version: number, change: Change): Promise<StatueDetail> {
	const row = await findRow(ctx, id);
	mayChange(by, "statues", "update", text(row.created_by) || null);
	mayChangeLive(by, "statues", text(row.status) === "published");
	staleVersion(row, version);
	const before = await loadState(ctx, row);
	const after: State = {
		...before,
		core: { ...before.core, ...Object.fromEntries(Object.entries(change.core ?? {}).filter(([, value]) => value !== undefined)) },
		images: change.images ?? before.images,
		related: change.related ?? before.related,
		variations: change.variations
			? change.variations.map((item) => {
					const known = before.variations.find((old) => old.id === item.id);
					const vid = known?.id ?? newId("artv", ctx.now().getTime());
					return { ...item, id: vid, variationId: known?.variationId ?? vid };
				})
			: before.variations,
	};
	checkStatusChange(by, "statues", before.core.status, after.core.status);
	after.core = await validateCore(ctx, after.core, id);
	await validateChildren(ctx, id, after);
	after.areaCode = await areaCodeFor(ctx, after.core.areaId, before.areaCode, before.core.areaId);
	const core = after.core;
	const now = stamp(ctx);
	const next = version + 1;
	try {
		await ctx.db.batch([
			ctx.db
				.prepare(
					`UPDATE statue SET code = ?, slug = ?, name = ?, subtitle = ?, area_id = ?, area_code = ?, cluster_id = ?, assembly_id = ?, is_main = ?, image_media_id = ?, image_position = ?,
					 quote_text = ?, quote_author = ?, body = ?, position = ?, editorial_board = ?, specs = ?, status = ?, version = ?, updated_by = ?, updated_at = ? WHERE id = ? AND version = ?`,
				)
				.bind(core.code, core.slug, core.name, core.subtitle, core.areaId, after.areaCode, core.clusterId, core.assemblyId, core.isMain ? 1 : 0, core.imageMediaId, core.imagePosition, core.quoteText || null, core.quoteText ? core.quoteAuthor : null, core.body, core.position, core.editorialBoard, JSON.stringify(core.specs), core.status, next, by.user.id, now, id, version),
			...childStatements(ctx, id, before, after),
			...replaceUsageStatements(ctx, "statue", id, usesOf(after)),
			revisionStatement(ctx, by, "statue", id, next, { id, ...after }, change.summary),
			audit(ctx, by, {
				action: change.action,
				entityType: "statue",
				entityId: id,
				before: { ...diffOf(before.core, core, "before"), ...diffOf(before, { images: after.images, related: after.related, variations: after.variations }, "before") },
				after: { ...diffOf(before.core, core, "after"), ...diffOf(before, { images: after.images, related: after.related, variations: after.variations }, "after") },
			}),
		]);
	} catch (error) {
		conflictOf(error, SLUG_TAKEN, { codeMessage: CODE_TAKEN });
	}
	return getStatue(ctx, id);
}

export const updateStatue = (ctx: AuthContext, by: Authed, id: string, version: number, core: Partial<StatueCore>) => persist(ctx, by, id, version, { core, summary: "Sửa bảo tượng", action: "statue.update" });
export const setStatueImages = (ctx: AuthContext, by: Authed, id: string, version: number, images: StatueImageEntry[]) => persist(ctx, by, id, version, { images, summary: "Sửa ảnh các góc", action: "statue.images" });
export const setStatueRelated = (ctx: AuthContext, by: Authed, id: string, version: number, related: string[]) => persist(ctx, by, id, version, { related, summary: "Chọn bảo tượng liên quan", action: "statue.related" });
export const setStatueVariations = (ctx: AuthContext, by: Authed, id: string, version: number, variations: NonNullable<Change["variations"]>) =>
	persist(ctx, by, id, version, { variations, summary: "Sửa tác phẩm nghệ thuật", action: "statue.variations" });

export async function deleteStatue(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const row = await findRow(ctx, id);
	mayChange(by, "statues", "delete", text(row.created_by) || null);
	mayChangeLive(by, "statues", text(row.status) === "published");
	await ctx.db.batch([trashStatement(ctx, by, "statue", id), audit(ctx, by, { action: "statue.trash", entityType: "statue", entityId: id, before: { name: row.name, code: row.code } })]);
}

registerTrashable({
	type: "statue",
	label: "Bảo tượng",
	table: "statue",
	titleSql: "name",
	module: "statues",
	isLive: (row) => text(row.status) === "published",
	hasCreatedBy: true,
	purge: (ctx, _by, id) => [
		ctx.db.prepare("DELETE FROM revision WHERE entity_type = 'statue' AND entity_id = ?").bind(id),
		ctx.db.prepare("DELETE FROM media_usage WHERE entity_type = 'statue' AND entity_id = ?").bind(id),
		ctx.db.prepare("DELETE FROM art_variation WHERE statue_id = ? OR art_statue_id = ?").bind(id, id),
		ctx.db.prepare("DELETE FROM statue_related WHERE statue_id = ? OR related_id = ?").bind(id, id),
	],
});
