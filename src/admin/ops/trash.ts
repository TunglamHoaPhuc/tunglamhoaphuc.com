// The trash screen: lists, restores and removes for good what the modules moved to the trash. The modules register their
// entities in src/admin/trash.ts (when their routes are imported); here are also the three that have no module of their own.
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminStmt } from "../db";
import { ApiError, forbidden, notFound } from "../http/errors";
import type { Page } from "../http/paging";
import type { MediaStore } from "../media/store";
import { can } from "../rbac/check";
import { registerTrashable, trashableOf, trashables, type Trashable } from "../trash";
import { audit, isForeignKeyError, isUniqueError, stamp } from "./common";

// ------------------------------------------------------------------ entities nobody else owns

registerTrashable({
	type: "media",
	label: "Ảnh trong thư viện",
	table: "media",
	titleSql: "COALESCE(NULLIF(title, ''), NULLIF(filename, ''), id)",
	module: "media",
	hasCreatedBy: false,
	purge: (ctx, _by, id) => [ctx.db.prepare("DELETE FROM media_usage WHERE media_id = ?").bind(id), ctx.db.prepare("DELETE FROM media_crop WHERE media_id = ?").bind(id)],
});
registerTrashable({
	type: "user",
	label: "Tài khoản",
	table: "user",
	titleSql: "name || ' <' || email || '>'",
	module: "users",
	hasCreatedBy: false,
	purge: (ctx, _by, id) => [
		ctx.db.prepare("DELETE FROM session WHERE user_id = ?").bind(id),
		ctx.db.prepare("DELETE FROM password_reset WHERE user_id = ?").bind(id),
		ctx.db.prepare("DELETE FROM user_totp WHERE user_id = ?").bind(id),
	],
});
registerTrashable({
	type: "role",
	label: "Vai trò",
	table: "role",
	titleSql: "name",
	module: "roles",
	hasCreatedBy: false,
	purge: (ctx, _by, id) => [ctx.db.prepare("DELETE FROM role_permission WHERE role_id = ?").bind(id)],
});

/** Tables whose trash columns differ from the rule (`deleted_at` and `deleted_by`). */
const WITHOUT_DELETED_BY = new Set(["role"]);
/** The column that says whose a row is, where it is not `created_by`. */
const ownerColumn = (item: Trashable): string | null => (item.type === "media" ? "uploaded_by" : item.hasCreatedBy ? "created_by" : null);

const SAFE_NAME = /^[a-z_][a-z0-9_]*$/;
/** Table and column names come from code, never from a request; this guards against a typo in a registration. */
function safe(item: Trashable): Trashable {
	if (!SAFE_NAME.test(item.table)) throw new Error(`unsafe table name in the trash registry: ${item.table}`);
	return item;
}

export const trashTypes = () => trashables().map(({ type, label }) => ({ type, label })).sort((a, b) => a.label.localeCompare(b.label, "vi"));

// ------------------------------------------------------------------ listing

export type TrashRow = { type: string; typeLabel: string; id: string; title: string; deletedAt: string; deletedBy: string | null; deletedByName: string };

/** Everything the person may see in the trash, newest first. With only "own" rights: their own rows, of the kinds that have an owner. */
export async function listTrash(ctx: AuthContext, by: Authed, filter: { type?: string }, page: Page): Promise<{ rows: TrashRow[]; total: number }> {
	const ownOnly = by.permissions.get("trash.view") === "own";
	let items = trashables().map(safe);
	if (filter.type) {
		if (!trashableOf(filter.type)) throw new ApiError(400, "invalid_input", "Loại nội dung không có trong thùng rác.", { type: "Loại nội dung không có trong thùng rác." });
		items = items.filter((item) => item.type === filter.type);
	}
	if (ownOnly) items = items.filter((item) => ownerColumn(item));

	let total = 0;
	const found: (TrashRow & { sort: string })[] = [];
	// One small query pair per kind (a database caps how many SELECTs one statement may join), merged here.
	for (const item of items) {
		const owner = ownerColumn(item);
		const scope = ownOnly && owner ? ` AND ${owner} = ?` : "";
		const args = ownOnly ? [by.user.id] : [];
		const count = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${item.table} WHERE deleted_at IS NOT NULL${scope}`).bind(...args).first();
		const n = num(count?.n);
		if (!n) continue;
		total += n;
		const by_ = WITHOUT_DELETED_BY.has(item.table) ? "NULL" : "deleted_by";
		const { results } = await ctx.db
			.prepare(`SELECT id, (${item.titleSql}) AS title, deleted_at, ${by_} AS deleted_by FROM ${item.table} WHERE deleted_at IS NOT NULL${scope} ORDER BY deleted_at DESC, id DESC LIMIT ?`)
			.bind(...args, page.offset + page.pageSize)
			.all();
		for (const row of results) {
			found.push({ type: item.type, typeLabel: item.label, id: text(row.id), title: text(row.title), deletedAt: text(row.deleted_at), deletedBy: text(row.deleted_by) || null, deletedByName: "", sort: text(row.deleted_at) });
		}
	}
	found.sort((a, b) => (a.sort === b.sort ? (a.id < b.id ? 1 : -1) : a.sort < b.sort ? 1 : -1));
	const rows = found.slice(page.offset, page.offset + page.pageSize);
	const ids = [...new Set(rows.map((row) => row.deletedBy).filter((id): id is string => !!id))];
	if (ids.length) {
		const { results } = await ctx.db.prepare(`SELECT id, name, email FROM user WHERE id IN (${ids.map(() => "?").join(", ")})`).bind(...ids).all();
		const names = new Map(results.map((row) => [text(row.id), text(row.name) || text(row.email)]));
		for (const row of rows) row.deletedByName = row.deletedBy ? (names.get(row.deletedBy) ?? "") : "";
	}
	return { rows: rows.map((row): TrashRow => ({ type: row.type, typeLabel: row.typeLabel, id: row.id, title: row.title, deletedAt: row.deletedAt, deletedBy: row.deletedBy, deletedByName: row.deletedByName })), total };
}

// ------------------------------------------------------------------ one row

async function findTrashed(ctx: AuthContext, type: string, id: string): Promise<{ item: Trashable; title: string; owner: string | null }> {
	const item = trashableOf(type);
	if (!item) throw notFound("Loại nội dung");
	safe(item);
	const owner = ownerColumn(item);
	const row = await ctx.db.prepare(`SELECT id, (${item.titleSql}) AS title, deleted_at${owner ? `, ${owner} AS owner` : ""} FROM ${item.table} WHERE id = ?`).bind(id).first();
	if (!row) throw notFound("Mục này");
	if (!text(row.deleted_at)) throw new ApiError(409, "not_in_trash", "Mục này không nằm trong thùng rác.");
	return { item, title: text(row.title), owner: owner ? text(row.owner) || null : null };
}

/** With "own" rights the action is allowed only on a row the person owns (rows of kinds without an owner are never theirs). */
function mayAct(by: Authed, action: "update" | "delete", owner: string | null) {
	if (!can(by.permissions, "trash", action, { userId: by.user.id, ownerId: owner ?? "" })) throw forbidden();
}

export async function restoreTrashed(ctx: AuthContext, by: Authed, type: string, id: string): Promise<{ type: string; id: string; title: string }> {
	const { item, title, owner } = await findTrashed(ctx, type, id);
	mayAct(by, "update", owner);
	const clear = WITHOUT_DELETED_BY.has(item.table) ? "deleted_at = NULL" : "deleted_at = NULL, deleted_by = NULL";
	try {
		await ctx.db.batch([
			ctx.db.prepare(`UPDATE ${item.table} SET ${clear} WHERE id = ? AND deleted_at IS NOT NULL`).bind(id),
			audit(ctx, by, { action: "trash.restore", entityType: item.type, entityId: id, after: { title } }),
		]);
	} catch (error) {
		if (isUniqueError(error)) {
			throw new ApiError(409, "slug_taken", "Không khôi phục được: đã có mục khác đang dùng cùng đường dẫn (slug), mã hoặc tên. Hãy đổi tên hoặc đường dẫn của mục đang dùng rồi khôi phục lại.");
		}
		throw error;
	}
	return { type: item.type, id, title };
}

/** The R2 keys of a library picture's own files (the picture and its cuts); only what the library wrote (`cms/…`). */
async function mediaKeys(ctx: AuthContext, id: string): Promise<string[]> {
	const picture = await ctx.db.prepare("SELECT r2_key FROM media WHERE id = ?").bind(id).first();
	const crops = await ctx.db.prepare("SELECT r2_key FROM media_crop WHERE media_id = ?").bind(id).all();
	return [text(picture?.r2_key), ...crops.results.map((row) => text(row.r2_key))].filter((key) => key.startsWith("cms/"));
}

export async function purgeTrashed(ctx: AuthContext, by: Authed, type: string, id: string, store?: MediaStore): Promise<void> {
	const { item, title, owner } = await findTrashed(ctx, type, id);
	mayAct(by, "delete", owner);
	const keys = item.type === "media" ? await mediaKeys(ctx, id) : [];
	const statements: AdminStmt[] = [
		...item.purge(ctx, by, id),
		ctx.db.prepare(`DELETE FROM ${item.table} WHERE id = ? AND deleted_at IS NOT NULL`).bind(id),
		audit(ctx, by, { action: "trash.purge", entityType: item.type, entityId: id, before: { title }, after: { at: stamp(ctx) } }),
	];
	try {
		// The extra rows and the row itself go in one batch: either all of it or, when something still points at the row, none.
		await ctx.db.batch(statements);
	} catch (error) {
		if (isForeignKeyError(error)) {
			throw new ApiError(409, "in_use", "Không xóa vĩnh viễn được: vẫn còn dữ liệu khác đang dùng mục này (ví dụ bài viết dùng ảnh này, hoặc nhật ký hoạt động của tài khoản). Hãy gỡ chỗ đang dùng trước.");
		}
		throw error;
	}
	// The files go last, once the rows are certainly gone: a file left behind is harmless, a row without its file is not.
	if (keys.length && store) await store.delete(keys).catch((error) => console.error("trash purge: removing files failed", error));
}
