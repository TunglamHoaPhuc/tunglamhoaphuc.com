// Pieces the special-content services share: the audit statement, picture checks, the publish rule and the
// way a stale save or a taken slug is told apart from any other database error.
import { auditStatement, type AuditEntry } from "../audit/log";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminStmt, type Row } from "../db";
import { ApiError, forbidden } from "../http/errors";
import { can } from "../rbac/check";
import { slugify } from "../slug";

export const stamp = (ctx: AuthContext) => ctx.now().toISOString();

export const audit = (ctx: AuthContext, by: Authed, entry: Pick<AuditEntry, "action" | "entityType" | "entityId" | "before" | "after">): AdminStmt =>
	auditStatement(ctx.db, { ...entry, userId: by.user.id, userEmail: by.user.email, ip: ctx.ip, userAgent: ctx.userAgent }, ctx.now());

export const STATUSES = ["draft", "published", "hidden"] as const;
export type SimpleStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<string, string> = { draft: "Bản nháp", pending: "Chờ duyệt", published: "Đã xuất bản", scheduled: "Hẹn giờ đăng", hidden: "Tạm ẩn" };

/** Moving to or from published/hidden needs the publish right; staying put (or draft -> draft) does not. */
export function checkStatusChange(by: Authed, module: string, from: string | null, to: string): void {
	const live = (status: string | null) => status === "published" || status === "hidden" || status === "scheduled";
	if (from === to) return;
	if ((live(to) || live(from)) && !can(by.permissions, module, "publish")) throw new ApiError(403, "forbidden", "Bạn không có quyền xuất bản hoặc ẩn mục này.");
}

/** The one refusal for "this would go live, or is live, and you may not publish". */
export const needsPublisher = (message: string) => new ApiError(403, "needs_publisher", message);

/**
 * An item that is shown on the site (published event or statue, visible area, active quote; month themes and featured programs always)
 * is edited or trashed only by someone who may publish: a person with plain `update` would otherwise change the live page unreviewed.
 * Same rule as `mayEditLive` for articles in content/service.ts. Pass the state before the change; for a switch that can also
 * turn something ON (quote active, area visible) pass `before || after`.
 */
export function mayChangeLive(by: Authed, module: string, live: boolean): void {
	if (live && !can(by.permissions, module, "publish")) throw needsPublisher("Mục này đang hiển thị trên trang. Chỉ người có quyền xuất bản mới sửa hoặc xóa được; hãy nhờ biên tập viên.");
}

/** Update/delete may be limited to what the person created ("own"). */
export function mayChange(by: Authed, module: string, action: "update" | "delete", createdBy: string | null): void {
	if (!can(by.permissions, module, action, { userId: by.user.id, ownerId: createdBy ?? "" })) throw forbidden();
}

export const invalid = (field: string, message: string) => new ApiError(400, "invalid_input", message, { [field]: message });

/** Fails with 400 when a picture id is not a live library picture. */
export async function checkMedia(ctx: AuthContext, field: string, id: string | null | undefined): Promise<string | null> {
	if (!id) return null;
	const row = await ctx.db.prepare("SELECT 1 AS yes FROM media WHERE id = ? AND deleted_at IS NULL").bind(id).first();
	if (!row) throw invalid(field, "Ảnh không có trong thư viện.");
	return id;
}

export async function checkMediaAll(ctx: AuthContext, field: string, ids: (string | null | undefined)[]): Promise<void> {
	for (const id of new Set(ids.filter((value): value is string => !!value))) await checkMedia(ctx, field, id);
}

/** The slug typed, or made from `title`; "" cannot be a slug. */
export function slugFor(typed: string | undefined, title: string, field = "slug"): string {
	const given = typed?.trim() ?? "";
	// A clean address is kept as it is: imported ones end in "_tp0001" and must not change on the next save.
	if (given.length <= 160 && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(given)) return given;
	const slug = slugify(given || title, 80);
	if (!slug) throw invalid(field, "Không tạo được địa chỉ từ tiêu đề. Hãy nhập địa chỉ có chữ hoặc số.");
	return slug;
}

/** Rows whose column holds `value` among rows not in the trash (and not `exceptId`). */
export async function taken(ctx: AuthContext, table: string, column: string, value: string, exceptId?: string): Promise<boolean> {
	const row = await ctx.db.prepare(`SELECT 1 AS yes FROM ${table} WHERE ${column} = ? AND deleted_at IS NULL AND id != ?`).bind(value, exceptId ?? "").first();
	return !!row;
}

/** Turns what a failed batch throws into the 409 a person can act on; anything else is rethrown. */
export function conflictOf(error: unknown, slugMessage: string, extra: { codeMessage?: string } = {}): never {
	const message = error instanceof Error ? error.message : String(error);
	if (/revision/i.test(message) && /UNIQUE/i.test(message)) throw new ApiError(409, "conflict", "Người khác vừa sửa mục này. Hãy tải lại trang rồi sửa tiếp.");
	if (/\.code\b/.test(message) && /UNIQUE/i.test(message)) throw new ApiError(409, "code_taken", extra.codeMessage ?? "Mã này đã có.", { code: extra.codeMessage ?? "Mã này đã có." });
	if (/\.slug\b/.test(message) && /UNIQUE/i.test(message)) throw new ApiError(409, "slug_taken", slugMessage, { slug: slugMessage });
	throw error;
}

export function staleVersion(row: Row, version: number): void {
	if (num(row.version) !== version) throw new ApiError(409, "conflict", "Người khác vừa sửa mục này. Hãy tải lại trang rồi sửa tiếp.");
}

export const POSITION = /^(left|center|right|\d{1,3}%)( (top|center|bottom|\d{1,3}%))?$/;
export const asBool = (value: unknown) => value === 1 || value === true || value === "1";
export const json = <T>(value: unknown, fallback: T): T => {
	if (typeof value !== "string" || !value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
};
export { num, text };

/** The fields of `after` that differ from `before`, taken from the side asked: for the audit entry. */
export function diffOf(before: object, after: object, side: "before" | "after"): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of Object.keys(after)) {
		const x = (before as Record<string, unknown>)[key];
		const y = (after as Record<string, unknown>)[key];
		if (JSON.stringify(x) !== JSON.stringify(y)) out[key] = side === "before" ? x : y;
	}
	return out;
}
