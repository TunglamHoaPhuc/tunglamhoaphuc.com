// The three menus (header, footer, sidebar) and their items. The tree is stored to any depth; the public header
// shows two levels. An item always stores the address it leads to in `href`, so the site reads one table.
import { auditStatement, type AuditEntry } from "../audit/log";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminStmt, type Row } from "../db";
import { ApiError, notFound } from "../http/errors";
import { likeWord } from "../http/paging";
import { newId } from "../ids";
import { registerTrashable, trashStatement } from "../trash";
import { categoryPath } from "./categories";
import { iconColumns, iconOf, resolveIcon, usageStatements, type IconFields, type IconPatch } from "./icon";

export const MENU_IDS = ["header", "footer", "sidebar"] as const;
export type MenuId = (typeof MENU_IDS)[number];
/** How many levels the public site shows of each menu (null: not shown yet). */
export const SHOWN_LEVELS: Record<MenuId, number | null> = { header: 2, footer: null, sidebar: null };

const stamp = (ctx: AuthContext) => ctx.now().toISOString();
const audit = (ctx: AuthContext, by: Authed, entry: Pick<AuditEntry, "action" | "entityType" | "entityId" | "before" | "after">) =>
	auditStatement(ctx.db, { ...entry, userId: by.user.id, userEmail: by.user.email, ip: ctx.ip, userAgent: ctx.userAgent }, ctx.now());
const fail = (field: string, message: string, status = 400, code = "invalid_input") => new ApiError(status, code, message, { [field]: message });

export type MenuItemData = IconFields & {
	id: string;
	menuId: string;
	parentId: string | null;
	position: number;
	depth: number;
	label: string;
	linkType: "category" | "page" | "url";
	categoryId: string | null;
	href: string;
	openNewTab: boolean;
	visible: boolean;
};

export type MenuData = { id: string; name: string; items: MenuItemData[]; shownLevels: number | null; warnings: string[] };

function toItem(row: Row, depth: number): MenuItemData {
	return {
		...iconOf(row),
		id: text(row.id),
		menuId: text(row.menu_id),
		parentId: text(row.parent_id) || null,
		position: num(row.position),
		depth,
		label: text(row.label),
		linkType: (["category", "page"].includes(text(row.link_type)) ? text(row.link_type) : "url") as MenuItemData["linkType"],
		categoryId: text(row.category_id) || null,
		href: text(row.href),
		openNewTab: num(row.open_new_tab) !== 0,
		visible: num(row.visible) !== 0,
	};
}

const isMenu = (value: string): value is MenuId => (MENU_IDS as readonly string[]).includes(value);

async function menuRow(ctx: AuthContext, menuId: string): Promise<{ id: MenuId; name: string }> {
	if (!isMenu(menuId)) throw notFound("Menu");
	const row = await ctx.db.prepare("SELECT id, name FROM menu WHERE id = ?").bind(menuId).first();
	if (!row) throw notFound("Menu");
	return { id: menuId, name: text(row.name) };
}

async function liveRows(ctx: AuthContext, menuId: string): Promise<Row[]> {
	const { results } = await ctx.db.prepare("SELECT * FROM menu_item WHERE menu_id = ? AND deleted_at IS NULL ORDER BY position, id").bind(menuId).all();
	return results;
}

/** Rows in tree order with depth. An item whose parent is missing (trashed or in another menu) is shown at the top. */
function inTreeOrder(rows: Row[]): MenuItemData[] {
	const ids = new Set(rows.map((row) => text(row.id)));
	const children = new Map<string, Row[]>();
	for (const row of rows) {
		const parent = text(row.parent_id);
		const key = parent && ids.has(parent) && parent !== text(row.id) ? parent : "";
		children.set(key, [...(children.get(key) ?? []), row]);
	}
	const out: MenuItemData[] = [];
	const seen = new Set<string>();
	const walk = (key: string, depth: number) => {
		for (const row of children.get(key) ?? []) {
			if (seen.has(text(row.id))) continue;
			seen.add(text(row.id));
			out.push(toItem(row, depth));
			walk(text(row.id), depth + 1);
		}
	};
	walk("", 0);
	return out;
}

function describe(menuId: MenuId, items: MenuItemData[]): Pick<MenuData, "shownLevels" | "warnings"> {
	const shown = SHOWN_LEVELS[menuId];
	const warnings: string[] = [];
	const deep = items.filter((item) => shown !== null && item.depth >= shown);
	if (deep.length) warnings.push(`Trang công khai chỉ hiển thị ${shown} cấp của menu này. ${deep.length} mục ở cấp sâu hơn được lưu nhưng chưa hiện ra: ${deep.slice(0, 3).map((item) => `"${item.label}"`).join(", ")}${deep.length > 3 ? "…" : ""}.`);
	if (shown === null) warnings.push("Menu này được lưu nhưng trang công khai chưa hiển thị nó.");
	return { shownLevels: shown, warnings };
}

export async function getMenu(ctx: AuthContext, menuId: string): Promise<MenuData> {
	const menu = await menuRow(ctx, menuId);
	const items = inTreeOrder(await liveRows(ctx, menu.id));
	return { id: menu.id, name: menu.name, items, ...describe(menu.id, items) };
}

async function itemRow(ctx: AuthContext, id: string): Promise<Row> {
	const row = await ctx.db.prepare("SELECT * FROM menu_item WHERE id = ? AND deleted_at IS NULL").bind(id).first();
	if (!row) throw notFound("Mục menu");
	return row;
}

// ------------------------------------------------------------------ where an item leads

/** An address an item may have: a path on this site (one slash first) or an https address. Anything else is refused. */
export function checkHref(raw: string): string {
	const href = raw.trim();
	if (!href) throw fail("href", "Nhập địa chỉ liên kết.");
	if (href.length > 500) throw fail("href", "Địa chỉ quá dài (tối đa 500 ký tự).");
	// eslint-disable-next-line no-control-regex
	if (/[\u0000- \u007f\\]/.test(href)) throw fail("href", "Địa chỉ không được có khoảng trắng hoặc ký tự lạ.");
	if (href.startsWith("/")) {
		if (href.startsWith("//")) throw fail("href", "Địa chỉ bắt đầu bằng // không được chấp nhận. Dùng một dấu / cho trang trong web, hoặc https:// cho trang ngoài.");
		return href;
	}
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		throw fail("href", "Địa chỉ chưa đúng. Dùng đường dẫn như /lien-he hoặc địa chỉ đầy đủ https://…");
	}
	if (url.protocol !== "https:") throw fail("href", "Chỉ nhận đường dẫn trong web (bắt đầu bằng /) hoặc địa chỉ https://.");
	return href;
}

export type LinkTarget = { type: "page" | "teaching_article" | "post"; id: string };
const PAGE_TYPES = ["page", "teaching_article", "post"] as const;

/** The public path of a page, a Tông chỉ article or a post, by id. */
async function targetPath(ctx: AuthContext, target: LinkTarget): Promise<string> {
	if (target.type === "page") {
		const row = await ctx.db.prepare("SELECT slug FROM page WHERE id = ? AND deleted_at IS NULL").bind(target.id).first();
		if (!row) throw fail("pageRef", "Trang này không tồn tại.");
		return `/gioi-thieu/${text(row.slug)}`;
	}
	if (target.type === "teaching_article") {
		const row = await ctx.db.prepare("SELECT slug FROM teaching_article WHERE id = ? AND deleted_at IS NULL").bind(target.id).first();
		if (!row) throw fail("pageRef", "Bài này không tồn tại.");
		return `/tong-chi-tu-hoc/${text(row.slug)}`;
	}
	const row = await ctx.db.prepare("SELECT slug, section FROM post WHERE id = ? AND deleted_at IS NULL").bind(target.id).first();
	if (!row) throw fail("pageRef", "Bài viết này không tồn tại.");
	return `/${text(row.section)}/${text(row.slug)}`;
}

/** Things an item can link to, for the picker: `GET link-targets?type=&q=`. */
export async function searchLinkTargets(ctx: AuthContext, type: string, q: string): Promise<{ type: string; id: string; title: string; path: string }[]> {
	if (!(PAGE_TYPES as readonly string[]).includes(type)) throw fail("type", "Loại liên kết chưa đúng.");
	const like = likeWord(q.trim());
	const sql =
		type === "page"
			? "SELECT id, title, slug, '' AS section FROM page WHERE deleted_at IS NULL AND (title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\') ORDER BY title LIMIT 20"
			: type === "teaching_article"
				? "SELECT id, title, slug, '' AS section FROM teaching_article WHERE deleted_at IS NULL AND (title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\') ORDER BY title LIMIT 20"
				: "SELECT id, title, slug, section FROM post WHERE deleted_at IS NULL AND (title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\') ORDER BY published_date DESC LIMIT 20";
	const { results } = await ctx.db.prepare(sql).bind(like, like).all();
	return results.map((row) => ({
		type,
		id: text(row.id),
		title: text(row.title),
		path: type === "page" ? `/gioi-thieu/${text(row.slug)}` : type === "teaching_article" ? `/tong-chi-tu-hoc/${text(row.slug)}` : `/${text(row.section)}/${text(row.slug)}`,
	}));
}

type Link = { linkType: "category" | "page" | "url"; categoryId: string | null; href: string };

type LinkInput = { linkType?: "category" | "page" | "url"; categoryId?: string | null; pageRef?: LinkTarget; href?: string };

/** What the item leads to, from the link fields sent (or, for a save that changes none of them, from the stored item). */
async function resolveLink(ctx: AuthContext, input: LinkInput, current?: Link): Promise<Link> {
	const touched = input.linkType !== undefined || input.categoryId !== undefined || input.pageRef !== undefined || input.href !== undefined;
	if (!touched && current) return current;
	const linkType = input.linkType ?? current?.linkType ?? "url";
	if (linkType === "category") {
		const id = input.categoryId ?? (current?.linkType === "category" ? current.categoryId : null);
		if (!id) throw fail("categoryId", "Chọn chuyên mục để liên kết tới.");
		const row = await ctx.db.prepare("SELECT kind, section, slug FROM category WHERE id = ? AND deleted_at IS NULL").bind(id).first();
		if (!row) throw fail("categoryId", "Chuyên mục này không tồn tại.");
		return { linkType, categoryId: id, href: categoryPath(text(row.kind), text(row.section), text(row.slug)) };
	}
	if (linkType === "page") {
		if (input.pageRef) return { linkType, categoryId: null, href: await targetPath(ctx, input.pageRef) };
		if (input.href !== undefined) return { linkType, categoryId: null, href: checkHref(input.href) };
		if (current?.linkType === "page") return current;
		throw fail("pageRef", "Chọn trang hoặc bài viết để liên kết tới.");
	}
	const href = input.href ?? (current?.linkType === "url" ? current.href : "");
	return { linkType: "url", categoryId: null, href: checkHref(href) };
}

// ------------------------------------------------------------------ writing

export type ItemInput = LinkInput &
	IconPatch & {
		label: string;
		parentId?: string | null;
		openNewTab?: boolean;
		visible?: boolean;
	};

async function checkParent(ctx: AuthContext, menuId: string, parentId: string | null | undefined, self?: string): Promise<string | null> {
	if (!parentId) return null;
	let cursor: string | null = parentId;
	for (let guard = 0; cursor && guard < 50; guard++) {
		const row: Row | null = await ctx.db.prepare("SELECT id, menu_id, parent_id FROM menu_item WHERE id = ? AND deleted_at IS NULL").bind(cursor).first();
		if (!row || text(row.menu_id) !== menuId) throw fail("parentId", "Mục cha không tồn tại trong menu này.");
		if (self && text(row.id) === self) throw fail("parentId", "Không thể đặt mục vào bên trong chính nhánh của nó.");
		cursor = text(row.parent_id) || null;
	}
	return parentId;
}

export async function createItem(ctx: AuthContext, by: Authed, menuId: string, input: ItemInput): Promise<MenuItemData> {
	const menu = await menuRow(ctx, menuId);
	const label = input.label.trim();
	if (!label) throw fail("label", "Nhập tên mục menu.");
	const parentId = await checkParent(ctx, menu.id, input.parentId);
	const link = await resolveLink(ctx, input);
	const icon = await resolveIcon(ctx, input);
	const id = newId("mi", ctx.now().getTime());
	const last = await ctx.db.prepare("SELECT COALESCE(MAX(position), 0) AS p FROM menu_item WHERE menu_id = ? AND COALESCE(parent_id, '') = ? AND deleted_at IS NULL").bind(menu.id, parentId ?? "").first();
	const now = stamp(ctx);
	await ctx.db.batch([
		ctx.db
			.prepare(
				`INSERT INTO menu_item (id, menu_id, parent_id, position, label, link_type, category_id, href, open_new_tab, visible, icon_type, icon_name, icon_svg, icon_media_id, icon_url, icon_color,
					updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(id, menu.id, parentId, num(last?.p) + 1, label, link.linkType, link.categoryId, link.href, input.openNewTab ? 1 : 0, input.visible === false ? 0 : 1, ...iconColumns(icon), now, by.user.id),
		...usageStatements(ctx, "menu_item", id, icon),
		audit(ctx, by, { action: "menu_item.create", entityType: "menu_item", entityId: id, after: { menu: menu.id, label, linkType: link.linkType, href: link.href } }),
	]);
	return toItem(await itemRow(ctx, id), 0);
}

export async function updateItem(ctx: AuthContext, by: Authed, id: string, input: Partial<ItemInput>): Promise<MenuItemData> {
	const row = await itemRow(ctx, id);
	const menuId = text(row.menu_id);
	const current = toItem(row, 0);
	const label = input.label !== undefined ? input.label.trim() : current.label;
	if (!label) throw fail("label", "Nhập tên mục menu.");
	const parentId = input.parentId !== undefined ? await checkParent(ctx, menuId, input.parentId, id) : current.parentId;
	const link = await resolveLink(ctx, input, { linkType: current.linkType, categoryId: current.categoryId, href: current.href });
	const icon = await resolveIcon(ctx, input, iconOf(row));
	const now = stamp(ctx);
	await ctx.db.batch([
		ctx.db
			.prepare(
				`UPDATE menu_item SET parent_id = ?, label = ?, link_type = ?, category_id = ?, href = ?, open_new_tab = ?, visible = ?, icon_type = ?, icon_name = ?, icon_svg = ?, icon_media_id = ?,
					icon_url = ?, icon_color = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`,
			)
			.bind(
				parentId, label, link.linkType, link.categoryId, link.href, (input.openNewTab ?? current.openNewTab) ? 1 : 0, (input.visible ?? current.visible) ? 1 : 0, ...iconColumns(icon), now, by.user.id, id,
			),
		...usageStatements(ctx, "menu_item", id, icon),
		audit(ctx, by, {
			action: "menu_item.update",
			entityType: "menu_item",
			entityId: id,
			before: { label: current.label, href: current.href, visible: current.visible, parentId: current.parentId, iconType: current.iconType },
			after: { label, href: link.href, visible: input.visible ?? current.visible, parentId, iconType: icon.iconType },
		}),
	]);
	return toItem(await itemRow(ctx, id), 0);
}

/** The item and everything below it. */
async function branch(ctx: AuthContext, menuId: string, rootId: string): Promise<string[]> {
	const rows = await liveRows(ctx, menuId);
	const children = new Map<string, string[]>();
	for (const row of rows) children.set(text(row.parent_id), [...(children.get(text(row.parent_id)) ?? []), text(row.id)]);
	const out = [rootId];
	for (let i = 0; i < out.length && out.length < 2000; i++) out.push(...(children.get(out[i]) ?? []).filter((child) => !out.includes(child)));
	return out;
}

/** Moves the item and its children to the trash. */
export async function deleteItem(ctx: AuthContext, by: Authed, id: string): Promise<{ removed: number }> {
	const row = await itemRow(ctx, id);
	const ids = await branch(ctx, text(row.menu_id), id);
	await ctx.db.batch([
		...ids.map((one) => trashStatement(ctx, by, "menu_item", one)),
		audit(ctx, by, { action: "menu_item.delete", entityType: "menu_item", entityId: id, before: { label: row.label, href: row.href, menu: row.menu_id }, after: { removed: ids.length } }),
	]);
	return { removed: ids.length };
}

export type TreeItem = { id: string; parentId: string | null };

/**
 * Saves the whole drag-and-drop result of one menu. `items` must be every live item of the menu, in the order wanted,
 * each with its parent: if someone added or removed an item meanwhile the lists differ and the save is refused (409),
 * so no one's change is lost without notice.
 */
export async function saveTree(ctx: AuthContext, by: Authed, menuId: string, items: TreeItem[]): Promise<MenuData> {
	const menu = await menuRow(ctx, menuId);
	const rows = await liveRows(ctx, menu.id);
	const known = new Map(rows.map((row) => [text(row.id), row]));
	const sent = new Set(items.map((item) => item.id));
	if (sent.size !== items.length) throw new ApiError(400, "invalid_input", "Danh sách có mục bị lặp.");
	for (const item of items) if (!known.has(item.id)) throw new ApiError(409, "conflict", "Menu đã được người khác thay đổi (có mục mới hoặc đã bị xóa). Hãy tải lại trang rồi sắp xếp lại.");
	if (items.length !== known.size) throw new ApiError(409, "conflict", "Menu đã được người khác thay đổi (có mục mới hoặc đã bị xóa). Hãy tải lại trang rồi sắp xếp lại.");
	const parentOf = new Map(items.map((item) => [item.id, item.parentId]));
	for (const item of items) {
		if (item.parentId && !sent.has(item.parentId)) throw fail("parentId", "Mục cha không thuộc menu này.");
	}
	for (const item of items) {
		let cursor: string | null | undefined = item.parentId;
		for (let guard = 0; cursor; guard++) {
			if (cursor === item.id || guard > items.length) throw new ApiError(400, "cycle", "Không thể đặt mục vào bên trong chính nhánh của nó.");
			cursor = parentOf.get(cursor);
		}
	}
	const next = new Map<string, number>();
	const now = stamp(ctx);
	const statements: AdminStmt[] = [];
	for (const item of items) {
		const key = item.parentId ?? "";
		const position = (next.get(key) ?? 0) + 1;
		next.set(key, position);
		const row = known.get(item.id) as Row;
		if (num(row.position) === position && (text(row.parent_id) || null) === item.parentId) continue;
		statements.push(ctx.db.prepare("UPDATE menu_item SET position = ?, parent_id = ?, updated_at = ?, updated_by = ? WHERE id = ? AND menu_id = ? AND deleted_at IS NULL").bind(position, item.parentId, now, by.user.id, item.id, menu.id));
	}
	if (statements.length) {
		statements.push(audit(ctx, by, { action: "menu.tree", entityType: "menu", entityId: menu.id, after: { changed: statements.length, total: items.length } }));
		await ctx.db.batch(statements);
	}
	return getMenu(ctx, menu.id);
}

registerTrashable({
	type: "menu_item",
	label: "Mục menu",
	table: "menu_item",
	titleSql: "label",
	module: "menus",
	isLive: () => false, // no publish state: editing menus never took the publish right
	hasCreatedBy: false,
	purge: (ctx, _by, id) => [ctx.db.prepare("DELETE FROM media_usage WHERE entity_type = 'menu_item' AND entity_id = ?").bind(id)],
});
