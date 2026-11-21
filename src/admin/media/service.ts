// The media library (docs/admin-architecture.md 7.5). Files live in R2 under `cms/<id>/v<version>/<name>`;
// a replaced picture keeps its id and gets the next version, so every place that points at the id shows the
// new picture, and because the version is in the address no cache keeps the old one.
import { auditStatement, type AuditEntry } from "../audit/log";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminStmt, type Row } from "../db";
import { ApiError, forbidden, notFound } from "../http/errors";
import { likeWord, type Page } from "../http/paging";
import { newId } from "../ids";
import { MEDIA_BASE, imageAt, IMAGE_WIDTH } from "../../libs/content/media";
import { can } from "../rbac/check";
import { slugify } from "../slug";
import { MAX_IMAGE_BYTES, RATIOS, sniffImage, type Sniffed } from "./files";
import type { MediaStore } from "./store";

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const stamp = (ctx: AuthContext) => ctx.now().toISOString();
const audit = (ctx: AuthContext, by: Authed, entry: Pick<AuditEntry, "action" | "entityType" | "entityId" | "before" | "after">) =>
	auditStatement(ctx.db, { ...entry, userId: by.user.id, userEmail: by.user.email, ip: ctx.ip, userAgent: ctx.userAgent }, ctx.now());

/** The public address of a library picture or of one the old admin left on B2 / WordPress. */
export const mediaPath = (r2Key: string | null, url: string | null): string => (r2Key ? `${MEDIA_BASE}/${r2Key}` : (url ?? ""));

export type MediaItem = {
	id: string;
	url: string;
	thumbUrl: string;
	filename: string;
	title: string;
	alt: string;
	caption: string;
	mime: string;
	width: number | null;
	height: number | null;
	sizeBytes: number | null;
	folderId: string | null;
	version: number;
	usageCount: number;
	createdAt: string | null;
	uploadedBy: string | null;
	/** "cms" for what this library holds, "imported" for what came from the old admin. */
	source: "cms" | "imported";
};

const SELECT = `SELECT m.id, m.r2_key, m.url, m.filename, m.title, m.alt, m.caption, m.mime, m.width, m.height, m.size_bytes, m.folder_id, m.version, m.created_at, m.uploaded_by,
	(SELECT COUNT(*) FROM media_usage u WHERE u.media_id = m.id) AS usage_count FROM media m`;

function toItem(row: Row): MediaItem {
	const url = mediaPath(text(row.r2_key) || null, text(row.url) || null);
	return {
		id: text(row.id),
		url,
		thumbUrl: url ? imageAt(url, IMAGE_WIDTH.small) : "",
		filename: text(row.filename),
		title: text(row.title),
		alt: text(row.alt),
		caption: text(row.caption),
		mime: text(row.mime),
		width: row.width == null ? null : num(row.width),
		height: row.height == null ? null : num(row.height),
		sizeBytes: row.size_bytes == null ? null : num(row.size_bytes),
		folderId: text(row.folder_id) || null,
		version: num(row.version) || 1,
		usageCount: num(row.usage_count),
		createdAt: text(row.created_at) || null,
		uploadedBy: text(row.uploaded_by) || null,
		source: text(row.r2_key).startsWith("cms/") ? "cms" : "imported",
	};
}

// ------------------------------------------------------------------ reading

export type MediaFilter = { folderId?: string; q?: string; unused?: boolean; sort?: string };

export async function listMedia(ctx: AuthContext, filter: MediaFilter, page: Page): Promise<{ rows: MediaItem[]; total: number }> {
	const where = ["m.deleted_at IS NULL"];
	const args: unknown[] = [];
	if (filter.folderId === "none") where.push("m.folder_id IS NULL");
	else if (filter.folderId) {
		where.push("m.folder_id = ?");
		args.push(filter.folderId);
	}
	if (filter.q) {
		where.push("(m.filename LIKE ? ESCAPE '\\' OR m.title LIKE ? ESCAPE '\\' OR m.alt LIKE ? ESCAPE '\\')");
		args.push(likeWord(filter.q), likeWord(filter.q), likeWord(filter.q));
	}
	if (filter.unused) where.push("NOT EXISTS (SELECT 1 FROM media_usage u WHERE u.media_id = m.id)");
	const clause = where.join(" AND ");
	const order = filter.sort === "name" ? "m.filename COLLATE NOCASE, m.id" : filter.sort === "size" ? "m.size_bytes DESC, m.id" : "m.created_at DESC, m.id DESC";
	const total = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM media m WHERE ${clause}`).bind(...args).first();
	const { results } = await ctx.db.prepare(`${SELECT} WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args, page.pageSize, page.offset).all();
	return { rows: results.map(toItem), total: num(total?.n) };
}

export type MediaDetail = MediaItem & { usage: { entityType: string; entityId: string; field: string }[]; crops: { ratio: string; x: number; y: number; width: number; height: number; url: string }[] };

async function findRow(ctx: AuthContext, id: string): Promise<Row> {
	const row = await ctx.db.prepare(`${SELECT} WHERE m.id = ? AND m.deleted_at IS NULL`).bind(id).first();
	if (!row) throw notFound("Ảnh");
	return row;
}

export async function getMedia(ctx: AuthContext, id: string): Promise<MediaDetail> {
	const item = toItem(await findRow(ctx, id));
	const usage = await ctx.db.prepare("SELECT entity_type, entity_id, field FROM media_usage WHERE media_id = ? ORDER BY entity_type, entity_id LIMIT 100").bind(id).all();
	const crops = await ctx.db.prepare("SELECT ratio, x, y, width, height, r2_key FROM media_crop WHERE media_id = ? ORDER BY ratio").bind(id).all();
	return {
		...item,
		usage: usage.results.map((row) => ({ entityType: text(row.entity_type), entityId: text(row.entity_id), field: text(row.field) })),
		crops: crops.results.map((row) => ({ ratio: text(row.ratio), x: num(row.x), y: num(row.y), width: num(row.width), height: num(row.height), url: mediaPath(text(row.r2_key), null) })),
	};
}

// ------------------------------------------------------------------ rights on one picture

/** Update and delete may be limited to what the person uploaded ("own"). */
function mayChange(by: Authed, action: "update" | "delete", uploadedBy: string | null) {
	if (!can(by.permissions, "media", action, { userId: by.user.id, ownerId: uploadedBy ?? "" })) throw forbidden();
}

// ------------------------------------------------------------------ writing

function checkFile(bytes: Uint8Array): Sniffed {
	if (bytes.length > MAX_IMAGE_BYTES) throw new ApiError(413, "too_large", "Ảnh lớn hơn 15 MB. Hãy thu nhỏ ảnh rồi tải lại.");
	const kind = sniffImage(bytes);
	if (!kind) throw new ApiError(415, "unsupported_file", "Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF còn nguyên vẹn (không nhận SVG).");
	return kind;
}

const fileKey = (id: string, version: number, name: string, ext: string) => `cms/${id}/v${version}/${slugify(name, 60) || "anh"}.${ext}`;
/** A cut file gets a new address each time it is cut again (`stamp`), so no cache holds the old cut. */
const cropKey = (id: string, version: number, ratio: string, ext: string, stamp: number) => `cms/${id}/v${version}/crop-${ratio.replace(":", "x")}-${stamp.toString(36)}.${ext}`;
const baseName = (filename: string) => filename.replace(/\.[A-Za-z0-9]{1,5}$/, "");

async function checkFolder(ctx: AuthContext, folderId: string | null | undefined): Promise<string | null> {
	if (!folderId) return null;
	if (!(await ctx.db.prepare("SELECT 1 AS yes FROM media_folder WHERE id = ?").bind(folderId).first())) throw new ApiError(400, "invalid_input", "Thư mục không tồn tại.", { folderId: "Thư mục không tồn tại." });
	return folderId;
}

export async function uploadMedia(
	ctx: AuthContext,
	by: Authed,
	store: MediaStore,
	input: { bytes: Uint8Array; filename: string; folderId?: string | null; alt?: string; title?: string; allowDuplicate?: boolean },
): Promise<MediaItem> {
	const kind = checkFile(input.bytes);
	const folderId = await checkFolder(ctx, input.folderId);
	const checksum = hex(await crypto.subtle.digest("SHA-256", input.bytes as BufferSource));
	if (!input.allowDuplicate) {
		const same = await ctx.db.prepare("SELECT id FROM media WHERE checksum = ? AND deleted_at IS NULL LIMIT 1").bind(checksum).first();
		if (same) throw new ApiError(409, "duplicate", "Ảnh này đã có trong thư viện.", { id: text(same.id) });
	}
	const id = newId("media", ctx.now().getTime());
	const filename = input.filename.trim().slice(0, 120) || `anh.${kind.ext}`;
	const key = fileKey(id, 1, baseName(filename), kind.ext);
	const now = stamp(ctx);
	await store.put(key, input.bytes, kind.mime);
	try {
		await ctx.db.batch([
			ctx.db
				.prepare(
					`INSERT INTO media (id, r2_key, folder, filename, mime, width, height, size_bytes, alt, caption, uploaded_by, created_at, folder_id, title, version, original_filename, checksum, updated_at, updated_by)
					 VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
				)
				.bind(id, key, `${slugify(baseName(filename), 60) || "anh"}.${kind.ext}`, kind.mime, kind.width, kind.height, input.bytes.length, (input.alt ?? "").trim(), by.user.id, now, folderId, (input.title ?? "").trim(), filename, checksum, now, by.user.id),
			audit(ctx, by, { action: "media.upload", entityType: "media", entityId: id, after: { filename, size: input.bytes.length, width: kind.width, height: kind.height, folderId } }),
		]);
	} catch (error) {
		await store.delete([key]).catch(() => undefined);
		throw error;
	}
	return toItem(await findRow(ctx, id));
}

export async function updateMedia(ctx: AuthContext, by: Authed, id: string, input: { alt?: string; title?: string; caption?: string; folderId?: string | null }): Promise<MediaItem> {
	const row = await findRow(ctx, id);
	mayChange(by, "update", text(row.uploaded_by) || null);
	const set: string[] = [];
	const args: unknown[] = [];
	const before: Record<string, unknown> = {};
	const after: Record<string, unknown> = {};
	for (const field of ["alt", "title", "caption"] as const) {
		const value = input[field]?.trim();
		if (value !== undefined && value !== text(row[field])) {
			set.push(`${field} = ?`);
			args.push(value);
			before[field] = text(row[field]);
			after[field] = value;
		}
	}
	if (input.folderId !== undefined) {
		const folderId = await checkFolder(ctx, input.folderId);
		if (folderId !== (text(row.folder_id) || null)) {
			set.push("folder_id = ?");
			args.push(folderId);
			before.folderId = text(row.folder_id) || null;
			after.folderId = folderId;
		}
	}
	if (!set.length) return toItem(row);
	set.push("updated_at = ?", "updated_by = ?");
	args.push(stamp(ctx), by.user.id, id);
	await ctx.db.batch([ctx.db.prepare(`UPDATE media SET ${set.join(", ")} WHERE id = ?`).bind(...args), audit(ctx, by, { action: "media.update", entityType: "media", entityId: id, before, after })]);
	return toItem(await findRow(ctx, id));
}

/** Puts a new file in place of the old one: same id, next version, new address; the old file and its crops go. */
export async function replaceMediaFile(ctx: AuthContext, by: Authed, store: MediaStore, id: string, input: { bytes: Uint8Array; filename: string }): Promise<MediaItem> {
	const row = await findRow(ctx, id);
	mayChange(by, "update", text(row.uploaded_by) || null);
	if (!text(row.r2_key)) throw new ApiError(409, "not_replaceable", "Ảnh này nằm ở nguồn cũ (WordPress). Hãy tải ảnh mới lên thay vì thay thế.");
	const kind = checkFile(input.bytes);
	const version = (num(row.version) || 1) + 1;
	const oldKey = text(row.r2_key);
	const oldCrops = await ctx.db.prepare("SELECT r2_key FROM media_crop WHERE media_id = ?").bind(id).all();
	const key = fileKey(id, version, baseName(input.filename), kind.ext);
	const checksum = hex(await crypto.subtle.digest("SHA-256", input.bytes as BufferSource));
	const now = stamp(ctx);
	await store.put(key, input.bytes, kind.mime);
	try {
		await ctx.db.batch([
			ctx.db
				.prepare("UPDATE media SET r2_key = ?, filename = ?, mime = ?, width = ?, height = ?, size_bytes = ?, version = ?, checksum = ?, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?")
				.bind(key, key.split("/").pop(), kind.mime, kind.width, kind.height, input.bytes.length, version, checksum, now, by.user.id, id, version - 1),
			ctx.db.prepare("DELETE FROM media_crop WHERE media_id = ?").bind(id),
			audit(ctx, by, { action: "media.replace", entityType: "media", entityId: id, before: { version: version - 1, size: row.size_bytes, width: row.width, height: row.height }, after: { version, size: input.bytes.length, width: kind.width, height: kind.height } }),
		]);
	} catch (error) {
		await store.delete([key]).catch(() => undefined);
		throw error;
	}
	// Only after the row points at the new file does the old one go (a failure here leaves a stray file, never a broken picture).
	await store.delete([oldKey, ...oldCrops.results.map((crop) => text(crop.r2_key))]).catch((error) => console.error("media: old file not removed", oldKey, error));
	return toItem(await findRow(ctx, id));
}

export type CropRegion = { x: number; y: number; width: number; height: number };

export async function saveCrop(ctx: AuthContext, by: Authed, store: MediaStore, id: string, ratio: string, input: { bytes: Uint8Array; region: CropRegion }): Promise<MediaDetail> {
	const row = await findRow(ctx, id);
	mayChange(by, "update", text(row.uploaded_by) || null);
	const want = RATIOS[ratio];
	if (!want) throw new ApiError(400, "invalid_input", "Tỷ lệ khung không có trong danh sách.", { ratio: "Chọn 16:9, 4:3, 3:4, 16:10 hoặc 1:1." });
	if (!text(row.r2_key)) throw new ApiError(409, "not_replaceable", "Ảnh này nằm ở nguồn cũ. Hãy tải ảnh lên thư viện trước khi cắt.");
	const { x, y, width, height } = input.region;
	if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 100.01 || y + height > 100.01) {
		throw new ApiError(400, "invalid_input", "Vùng cắt không hợp lệ.", { region: "Vùng cắt phải nằm trong ảnh." });
	}
	const kind = checkFile(input.bytes);
	if (Math.abs(kind.width / kind.height / want - 1) > 0.03) throw new ApiError(400, "invalid_input", `Ảnh đã cắt không đúng tỷ lệ ${ratio}.`, { file: `Ảnh đã cắt không đúng tỷ lệ ${ratio}.` });
	const version = num(row.version) || 1;
	const key = cropKey(id, version, ratio, kind.ext, ctx.now().getTime());
	const previous = await ctx.db.prepare("SELECT r2_key FROM media_crop WHERE media_id = ? AND ratio = ?").bind(id, ratio).first();
	await store.put(key, input.bytes, kind.mime);
	try {
		await ctx.db.batch([
			ctx.db
				.prepare(
					`INSERT INTO media_crop (media_id, ratio, x, y, width, height, r2_key, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT(media_id, ratio) DO UPDATE SET x = excluded.x, y = excluded.y, width = excluded.width, height = excluded.height, r2_key = excluded.r2_key, updated_at = excluded.updated_at`,
				)
				.bind(id, ratio, x, y, width, height, key, stamp(ctx)),
			audit(ctx, by, { action: "media.crop", entityType: "media", entityId: id, after: { ratio, x, y, width, height } }),
		]);
	} catch (error) {
		await store.delete([key]).catch(() => undefined);
		throw error;
	}
	if (previous && text(previous.r2_key) !== key) await store.delete([text(previous.r2_key)]).catch(() => undefined);
	return getMedia(ctx, id);
}

export async function deleteCrop(ctx: AuthContext, by: Authed, store: MediaStore, id: string, ratio: string): Promise<void> {
	const row = await findRow(ctx, id);
	mayChange(by, "update", text(row.uploaded_by) || null);
	const crop = await ctx.db.prepare("SELECT r2_key FROM media_crop WHERE media_id = ? AND ratio = ?").bind(id, ratio).first();
	if (!crop) throw notFound("Bản cắt");
	await ctx.db.batch([ctx.db.prepare("DELETE FROM media_crop WHERE media_id = ? AND ratio = ?").bind(id, ratio), audit(ctx, by, { action: "media.crop_delete", entityType: "media", entityId: id, before: { ratio } })]);
	await store.delete([text(crop.r2_key)]).catch(() => undefined);
}

/** Moves the picture to the trash. A picture in use is refused unless `force` (a person who may delete anyone's). */
export async function deleteMedia(ctx: AuthContext, by: Authed, id: string, force: boolean): Promise<void> {
	const row = await findRow(ctx, id);
	mayChange(by, "delete", text(row.uploaded_by) || null);
	const used = num(row.usage_count);
	if (used > 0) {
		if (!force) throw new ApiError(409, "in_use", `Ảnh đang được dùng ở ${used} chỗ. Hãy gỡ ảnh khỏi những chỗ đó trước, hoặc xác nhận xóa dù đang dùng.`, { usageCount: String(used) });
		if (!can(by.permissions, "media", "delete")) throw forbidden();
	}
	const now = stamp(ctx);
	await ctx.db.batch([
		ctx.db.prepare("UPDATE media SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ?").bind(now, by.user.id, now, id),
		audit(ctx, by, { action: "media.delete", entityType: "media", entityId: id, before: { filename: row.filename, usageCount: used }, after: { forced: used > 0 } }),
	]);
}

// ------------------------------------------------------------------ folders

export type FolderItem = { id: string; parentId: string | null; name: string; slug: string; position: number; count: number };

export async function listFolders(ctx: AuthContext): Promise<{ folders: FolderItem[]; noFolder: number }> {
	const { results } = await ctx.db
		.prepare(
			`SELECT f.id, f.parent_id, f.name, f.slug, f.position, (SELECT COUNT(*) FROM media m WHERE m.folder_id = f.id AND m.deleted_at IS NULL) AS n
			 FROM media_folder f ORDER BY f.position, f.name COLLATE NOCASE`,
		)
		.all();
	const none = await ctx.db.prepare("SELECT COUNT(*) AS n FROM media WHERE folder_id IS NULL AND deleted_at IS NULL").first();
	return {
		folders: results.map((row) => ({ id: text(row.id), parentId: text(row.parent_id) || null, name: text(row.name), slug: text(row.slug), position: num(row.position), count: num(row.n) })),
		noFolder: num(none?.n),
	};
}

async function depthOf(ctx: AuthContext, folderId: string | null): Promise<number> {
	let depth = 0;
	let at = folderId;
	while (at && depth < 10) {
		const row = await ctx.db.prepare("SELECT parent_id FROM media_folder WHERE id = ?").bind(at).first();
		if (!row) throw new ApiError(400, "invalid_input", "Thư mục cha không tồn tại.", { parentId: "Thư mục cha không tồn tại." });
		depth++;
		at = text(row.parent_id) || null;
	}
	return depth;
}

export async function createFolder(ctx: AuthContext, by: Authed, input: { name: string; parentId?: string | null }): Promise<FolderItem> {
	const name = input.name.trim();
	const slug = slugify(name, 60);
	if (!slug) throw new ApiError(400, "invalid_input", "Tên thư mục chưa hợp lệ.", { name: "Tên thư mục cần có chữ hoặc số." });
	const parentId = input.parentId || null;
	if ((await depthOf(ctx, parentId)) >= 3) throw new ApiError(400, "too_deep", "Thư mục chỉ lồng được tối đa 3 cấp.", { parentId: "Thư mục chỉ lồng được tối đa 3 cấp." });
	if (await ctx.db.prepare("SELECT 1 AS yes FROM media_folder WHERE slug = ? AND COALESCE(parent_id, '') = ?").bind(slug, parentId ?? "").first()) throw new ApiError(409, "name_taken", "Đã có thư mục tên này ở đây.", { name: "Đã có thư mục tên này ở đây." });
	const id = newId("mfold", ctx.now().getTime());
	await ctx.db.batch([
		ctx.db.prepare("INSERT INTO media_folder (id, parent_id, name, slug, position, created_at) VALUES (?, ?, ?, ?, 0, ?)").bind(id, parentId, name, slug, stamp(ctx)),
		audit(ctx, by, { action: "media_folder.create", entityType: "media_folder", entityId: id, after: { name, parentId } }),
	]);
	return { id, parentId, name, slug, position: 0, count: 0 };
}

export async function updateFolder(ctx: AuthContext, by: Authed, id: string, input: { name?: string; parentId?: string | null }): Promise<void> {
	const row = await ctx.db.prepare("SELECT id, parent_id, name, slug FROM media_folder WHERE id = ?").bind(id).first();
	if (!row) throw notFound("Thư mục");
	const name = input.name === undefined ? text(row.name) : input.name.trim();
	const slug = slugify(name, 60);
	if (!slug) throw new ApiError(400, "invalid_input", "Tên thư mục chưa hợp lệ.", { name: "Tên thư mục cần có chữ hoặc số." });
	const parentId = input.parentId === undefined ? text(row.parent_id) || null : input.parentId || null;
	if (parentId) {
		// not into itself or one of its own children, and not past three levels
		let at: string | null = parentId;
		while (at) {
			if (at === id) throw new ApiError(400, "invalid_input", "Không thể chuyển thư mục vào chính nó.", { parentId: "Không thể chuyển thư mục vào chính nó." });
			const up: Row | null = await ctx.db.prepare("SELECT parent_id FROM media_folder WHERE id = ?").bind(at).first();
			at = up ? text(up.parent_id) || null : null;
		}
		if ((await depthOf(ctx, parentId)) >= 3) throw new ApiError(400, "too_deep", "Thư mục chỉ lồng được tối đa 3 cấp.", { parentId: "Thư mục chỉ lồng được tối đa 3 cấp." });
	}
	if (await ctx.db.prepare("SELECT 1 AS yes FROM media_folder WHERE slug = ? AND COALESCE(parent_id, '') = ? AND id != ?").bind(slug, parentId ?? "", id).first()) throw new ApiError(409, "name_taken", "Đã có thư mục tên này ở đây.", { name: "Đã có thư mục tên này ở đây." });
	await ctx.db.batch([
		ctx.db.prepare("UPDATE media_folder SET name = ?, slug = ?, parent_id = ? WHERE id = ?").bind(name, slug, parentId, id),
		audit(ctx, by, { action: "media_folder.update", entityType: "media_folder", entityId: id, before: { name: row.name, parentId: row.parent_id }, after: { name, parentId } }),
	]);
}

export async function deleteFolder(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const row = await ctx.db.prepare("SELECT name FROM media_folder WHERE id = ?").bind(id).first();
	if (!row) throw notFound("Thư mục");
	if (await ctx.db.prepare("SELECT 1 AS yes FROM media_folder WHERE parent_id = ?").bind(id).first()) throw new ApiError(409, "folder_not_empty", "Thư mục còn thư mục con.");
	if (await ctx.db.prepare("SELECT 1 AS yes FROM media WHERE folder_id = ? AND deleted_at IS NULL").bind(id).first()) throw new ApiError(409, "folder_not_empty", "Thư mục còn ảnh. Hãy chuyển ảnh sang thư mục khác trước.");
	await ctx.db.batch([ctx.db.prepare("DELETE FROM media_folder WHERE id = ?").bind(id), audit(ctx, by, { action: "media_folder.delete", entityType: "media_folder", entityId: id, before: { name: row.name } })]);
}

// ------------------------------------------------------------------ numbers

export async function mediaStats(ctx: AuthContext) {
	const one = async (sql: string) => (await ctx.db.prepare(sql).first()) ?? {};
	const all = await one("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes, COALESCE(SUM(size_bytes IS NULL), 0) AS unknown FROM media WHERE deleted_at IS NULL");
	const cms = await one("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM media WHERE deleted_at IS NULL AND r2_key LIKE 'cms/%'");
	const unused = await one("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM media m WHERE m.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM media_usage u WHERE u.media_id = m.id)");
	const years = await ctx.db.prepare("SELECT COALESCE(substr(created_at, 1, 4), 'Không rõ') AS year, COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM media WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1 DESC").all();
	const folders = await ctx.db.prepare("SELECT folder_id, COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS bytes FROM media WHERE deleted_at IS NULL AND folder_id IS NOT NULL GROUP BY folder_id").all();
	return {
		total: { count: num(all.n), bytes: num(all.bytes), withoutSize: num(all.unknown) },
		library: { count: num(cms.n), bytes: num(cms.bytes) },
		unused: { count: num(unused.n), bytes: num(unused.bytes) },
		byYear: years.results.map((row) => ({ year: text(row.year), count: num(row.n), bytes: num(row.bytes) })),
		byFolder: folders.results.map((row) => ({ folderId: text(row.folder_id), count: num(row.n), bytes: num(row.bytes) })),
	};
}

/** Statements that make `media_usage` say where an entity uses pictures: call it from the code that saves that entity. */
export function replaceUsageStatements(ctx: AuthContext, entityType: string, entityId: string, uses: { mediaId: string; field: string }[]): AdminStmt[] {
	return [
		ctx.db.prepare("DELETE FROM media_usage WHERE entity_type = ? AND entity_id = ?").bind(entityType, entityId),
		...uses.map((use) => ctx.db.prepare("INSERT OR IGNORE INTO media_usage (media_id, entity_type, entity_id, field) VALUES (?, ?, ?, ?)").bind(use.mediaId, entityType, entityId, use.field)),
	];
}
