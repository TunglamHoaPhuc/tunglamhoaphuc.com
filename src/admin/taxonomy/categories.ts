// Categories (chuyên mục / chỉ mục): the named groups content falls into. A category's id is
// `${kind}:${section}:${slug}` when it is made and never changes after, because posts, articles, events and statues
// point at the id; changing the slug changes only the `slug` column (and the address menu items built from it).
import { auditStatement, type AuditEntry } from "../audit/log";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminStmt, type Row } from "../db";
import { ApiError, notFound } from "../http/errors";
import { slugify } from "../slug";
import { registerTrashable, trashStatement } from "../trash";
import { iconColumns, iconOf, resolveIcon, usageStatements, type IconFields, type IconPatch } from "./icon";

export const KINDS = ["post", "tong-chi", "about", "event", "assembly"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABELS: Record<Kind, string> = {
	post: "Chuyên mục bài viết",
	"tong-chi": "Nhóm bài Tông chỉ tu học",
	about: "Nhóm trang Giới thiệu",
	event: "Loại sự kiện lịch tu học",
	assembly: "Hội chúng bảo tượng",
};
export const TEMPLATES = ["tin-tuc", "thu-vien-bao-tuong", "trang-tinh", "lich", "tong-chi"] as const;

const stamp = (ctx: AuthContext) => ctx.now().toISOString();
const audit = (ctx: AuthContext, by: Authed, entry: Pick<AuditEntry, "action" | "entityType" | "entityId" | "before" | "after">) =>
	auditStatement(ctx.db, { ...entry, userId: by.user.id, userEmail: by.user.email, ip: ctx.ip, userAgent: ctx.userAgent }, ctx.now());

/** The public page a category leads to: a post category is a filter of its section's list, the others are section pages. */
export function categoryPath(kind: string, section: string, slug: string): string {
	switch (kind) {
		case "post":
			return `/${section}?danh-muc=${encodeURIComponent(slug)}`;
		case "tong-chi":
			return "/tong-chi-tu-hoc";
		case "about":
			return "/gioi-thieu";
		case "event":
			return "/lich-tu-hoc";
		case "assembly":
			return "/bao-tuong-phat-giao";
		default:
			return "/";
	}
}

export type Counts = { posts: number; teachings: number; pages: number; events: number; statues: number; children: number };

export type CategoryItem = IconFields & {
	id: string;
	kind: string;
	section: string;
	slug: string;
	name: string;
	position: number;
	colorToken: string | null;
	parentId: string | null;
	depth: number;
	description: string;
	template: string;
	visible: boolean;
	seoTitle: string;
	seoDescription: string;
	ogMediaId: string | null;
	path: string;
	counts: Counts;
	/** Everything that still uses the category (children not included). */
	used: number;
	updatedAt: string | null;
};

const SELECT = `SELECT c.*,
	(SELECT COUNT(*) FROM post p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS n_posts,
	(SELECT COUNT(*) FROM teaching_article t WHERE t.group_id = c.id AND t.deleted_at IS NULL) AS n_teachings,
	(SELECT COUNT(*) FROM page g WHERE g.group_id = c.id AND g.deleted_at IS NULL) AS n_pages,
	(SELECT COUNT(*) FROM calendar_event e WHERE e.category_id = c.id AND e.deleted_at IS NULL) AS n_events,
	(SELECT COUNT(*) FROM statue s WHERE s.assembly_id = c.id AND s.deleted_at IS NULL) + (SELECT COUNT(*) FROM statue_cluster k WHERE k.assembly_id = c.id) AS n_statues,
	(SELECT COUNT(*) FROM category x WHERE x.parent_id = c.id AND x.deleted_at IS NULL) AS n_children
	FROM category c`;

function toItem(row: Row, depth = 0): CategoryItem {
	const counts: Counts = { posts: num(row.n_posts), teachings: num(row.n_teachings), pages: num(row.n_pages), events: num(row.n_events), statues: num(row.n_statues), children: num(row.n_children) };
	return {
		...iconOf(row),
		id: text(row.id),
		kind: text(row.kind),
		section: text(row.section),
		slug: text(row.slug),
		name: text(row.name),
		position: num(row.position),
		colorToken: text(row.color_token) || null,
		parentId: text(row.parent_id) || null,
		depth,
		description: text(row.description),
		template: text(row.template),
		visible: num(row.visible) !== 0,
		seoTitle: text(row.seo_title),
		seoDescription: text(row.seo_description),
		ogMediaId: text(row.og_media_id) || null,
		path: categoryPath(text(row.kind), text(row.section), text(row.slug)),
		counts,
		used: counts.posts + counts.teachings + counts.pages + counts.events + counts.statues,
		updatedAt: text(row.updated_at) || null,
	};
}

/** The rows in tree order (a parent, then its children), with each one's depth. Rows whose parent is gone are shown at the top. */
function inTreeOrder(rows: Row[]): CategoryItem[] {
	const ids = new Set(rows.map((row) => text(row.id)));
	const children = new Map<string, Row[]>();
	for (const row of rows) {
		const parent = text(row.parent_id);
		const key = parent && ids.has(parent) && parent !== text(row.id) ? parent : "";
		children.set(key, [...(children.get(key) ?? []), row]);
	}
	const out: CategoryItem[] = [];
	const seen = new Set<string>();
	const walk = (key: string, depth: number) => {
		for (const row of children.get(key) ?? []) {
			const id = text(row.id);
			if (seen.has(id)) continue;
			seen.add(id);
			out.push(toItem(row, depth));
			walk(id, depth + 1);
		}
	};
	walk("", 0);
	return out;
}

export async function listCategories(ctx: AuthContext, filter: { kind?: string; section?: string }): Promise<CategoryItem[]> {
	const where = ["c.deleted_at IS NULL"];
	const args: unknown[] = [];
	if (filter.kind) {
		where.push("c.kind = ?");
		args.push(filter.kind);
	}
	if (filter.section !== undefined && filter.section !== "") {
		where.push("c.section = ?");
		args.push(filter.section);
	}
	const { results } = await ctx.db.prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY c.kind, c.section, c.position, c.name, c.id`).bind(...args).all();
	// Each group (kind + section) is its own tree.
	const groups = new Map<string, Row[]>();
	for (const row of results) {
		const key = `${text(row.kind)}\u0000${text(row.section)}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}
	return [...groups.values()].flatMap(inTreeOrder);
}

async function findRow(ctx: AuthContext, id: string): Promise<Row> {
	const row = await ctx.db.prepare(`${SELECT} WHERE c.id = ? AND c.deleted_at IS NULL`).bind(id).first();
	if (!row) throw notFound("Chuyên mục");
	return row;
}

export const getCategory = async (ctx: AuthContext, id: string) => toItem(await findRow(ctx, id));

// ------------------------------------------------------------------ slugs

/** Tables whose rows have a slug the admin makes from a title, and what makes two of them clash. */
const SLUG_TABLES: Record<string, { table: string; section?: boolean }> = {
	post: { table: "post", section: true },
	page: { table: "page" },
	teaching: { table: "teaching_article" },
	statue: { table: "statue" },
	event: { table: "calendar_event" },
};

export type SlugAnswer = { slug: string; available: boolean; suggestion: string };

/**
 * `GET slug?text=&type=&section=&excludeId=`: the slug for a title and whether it is free. `type` is "category"
 * (then `kind`, default "post", and `section` say which list), "post" (same section), "page", "teaching", "statue"
 * or "event"; `suggestion` is the first free slug (`slug`, `slug-2`, …).
 */
export async function makeSlug(ctx: AuthContext, input: { text: string; type: string; section?: string; kind?: string; excludeId?: string }): Promise<SlugAnswer> {
	const base = slugify(input.text) || "muc";
	const taken = async (slug: string): Promise<boolean> => {
		if (input.type === "category") {
			const row = await ctx.db.prepare("SELECT 1 AS yes FROM category WHERE kind = ? AND section = ? AND slug = ? AND deleted_at IS NULL AND id <> ?").bind(input.kind || "post", input.section ?? "", slug, input.excludeId ?? "").first();
			return Boolean(row);
		}
		const spec = Object.hasOwn(SLUG_TABLES, input.type) ? SLUG_TABLES[input.type] : undefined;
		if (!spec) throw new ApiError(400, "invalid_input", "Loại nội dung chưa đúng.", { type: "Loại nội dung chưa đúng." });
		const sql = `SELECT 1 AS yes FROM ${spec.table} WHERE slug = ? AND deleted_at IS NULL AND id <> ?${spec.section ? " AND section = ?" : ""}`;
		const args: unknown[] = [slug, input.excludeId ?? ""];
		if (spec.section) args.push(input.section ?? "");
		return Boolean(await ctx.db.prepare(sql).bind(...args).first());
	};
	const available = !(await taken(base));
	let suggestion = base;
	for (let n = 2; !available && n < 200 && (await taken(suggestion)); n++) suggestion = `${base}-${n}`.slice(0, 90);
	return { slug: base, available, suggestion };
}

// ------------------------------------------------------------------ writing

export type CategoryInput = {
	name: string;
	slug?: string;
	description?: string;
	template?: string;
	visible?: boolean;
	colorToken?: string | null;
	parentId?: string | null;
	seoTitle?: string;
	seoDescription?: string;
	ogMediaId?: string | null;
} & IconPatch;

const fail = (field: string, message: string, status = 400, code = "invalid_input") => new ApiError(status, code, message, { [field]: message });

function checkTemplate(template: string | undefined) {
	if (template && !(TEMPLATES as readonly string[]).includes(template)) throw fail("template", "Kiểu hiển thị chưa đúng.");
}

async function checkMedia(ctx: AuthContext, id: string | null | undefined, field: string) {
	if (!id) return;
	if (!(await ctx.db.prepare("SELECT 1 AS yes FROM media WHERE id = ? AND deleted_at IS NULL").bind(id).first())) throw fail(field, "Ảnh này không còn trong thư viện.");
}

/** The parent must be a live category of the same list, and `self` must not be above it. */
async function checkParent(ctx: AuthContext, parentId: string | null | undefined, group: { kind: string; section: string }, self?: string): Promise<string | null> {
	if (!parentId) return null;
	if (parentId === self) throw fail("parentId", "Chuyên mục không thể là con của chính nó.");
	let cursor: string | null = parentId;
	for (let guard = 0; cursor && guard < 50; guard++) {
		const row: Row | null = await ctx.db.prepare("SELECT id, kind, section, parent_id FROM category WHERE id = ? AND deleted_at IS NULL").bind(cursor).first();
		if (!row) throw fail("parentId", "Chuyên mục cha không tồn tại.");
		if (guard === 0 && (text(row.kind) !== group.kind || text(row.section) !== group.section)) throw fail("parentId", "Chuyên mục cha phải cùng nhóm.");
		if (text(row.id) === self) throw fail("parentId", "Không thể đặt chuyên mục vào bên trong chính nhánh của nó.");
		cursor = text(row.parent_id) || null;
	}
	return parentId;
}

async function slugTaken(ctx: AuthContext, kind: string, section: string, slug: string, excludeId: string) {
	return Boolean(await ctx.db.prepare("SELECT 1 AS yes FROM category WHERE kind = ? AND section = ? AND slug = ? AND deleted_at IS NULL AND id <> ?").bind(kind, section, slug, excludeId).first());
}

const conflictSlug = () => fail("slug", "Địa chỉ (slug) này đã có chuyên mục khác dùng. Hãy đổi sang địa chỉ khác.", 409, "slug_taken");

/** A slug is always the plain form of what was typed, so the address never holds accents or spaces. */
function cleanSlug(raw: string | undefined, fallbackName: string): string {
	const slug = slugify(raw?.trim() ? raw : fallbackName);
	if (!slug) throw fail("slug", "Không tạo được địa chỉ từ tên này. Hãy nhập địa chỉ bằng chữ không dấu.");
	return slug;
}

export async function createCategory(ctx: AuthContext, by: Authed, input: CategoryInput & { kind: Kind; section?: string }): Promise<CategoryItem> {
	const section = input.kind === "post" ? (input.section ?? "").trim() : "";
	if (input.kind === "post" && !section) throw fail("section", "Chọn mục của trang web mà chuyên mục này thuộc về.");
	checkTemplate(input.template);
	await checkMedia(ctx, input.ogMediaId, "ogMediaId");
	const slug = cleanSlug(input.slug, input.name);
	if (await slugTaken(ctx, input.kind, section, slug, "")) throw conflictSlug();
	const parentId = await checkParent(ctx, input.parentId, { kind: input.kind, section });
	const icon = await resolveIcon(ctx, input);

	// The id keeps the old pattern; if an older row (live, trashed or renamed since) already holds it, a number is added.
	const base = `${input.kind}:${section}:${slug}`;
	let id = base;
	for (let n = 2; await ctx.db.prepare("SELECT 1 AS yes FROM category WHERE id = ?").bind(id).first(); n++) id = `${base}-${n}`;
	const last = await ctx.db.prepare("SELECT COALESCE(MAX(position), 0) AS p FROM category WHERE kind = ? AND section = ? AND COALESCE(parent_id, '') = ? AND deleted_at IS NULL").bind(input.kind, section, parentId ?? "").first();
	const now = stamp(ctx);
	try {
		await ctx.db.batch([
			ctx.db
				.prepare(
					`INSERT INTO category (id, kind, section, slug, name, position, color_token, parent_id, description, icon_type, icon_name, icon_svg, icon_media_id, icon_url, icon_color,
						template, visible, seo_title, seo_description, og_media_id, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					id, input.kind, section, slug, input.name.trim(), num(last?.p) + 1, input.colorToken || null, parentId, input.description ?? "", ...iconColumns(icon),
					input.template ?? "", input.visible === false ? 0 : 1, input.seoTitle || null, input.seoDescription || null, input.ogMediaId || null, now, by.user.id,
				),
			...usageStatements(ctx, "category", id, icon, [{ field: "og_media_id", mediaId: input.ogMediaId ?? null }]),
			audit(ctx, by, { action: "category.create", entityType: "category", entityId: id, after: { kind: input.kind, section, slug, name: input.name.trim() } }),
		]);
	} catch (error) {
		// Two people adding the same slug at once: the unique index (category_live) refuses the second.
		if (/unique|constraint/i.test(String(error))) throw conflictSlug();
		throw error;
	}
	return getCategory(ctx, id);
}

export async function updateCategory(ctx: AuthContext, by: Authed, id: string, input: Partial<CategoryInput>): Promise<CategoryItem> {
	const row = await findRow(ctx, id);
	const kind = text(row.kind);
	const section = text(row.section);
	checkTemplate(input.template);
	if (input.ogMediaId !== undefined) await checkMedia(ctx, input.ogMediaId, "ogMediaId");
	const slug = input.slug !== undefined ? cleanSlug(input.slug, text(row.name)) : text(row.slug);
	if (slug !== text(row.slug) && (await slugTaken(ctx, kind, section, slug, id))) throw conflictSlug();
	const parentId = input.parentId !== undefined ? await checkParent(ctx, input.parentId, { kind, section }, id) : text(row.parent_id) || null;
	const icon = await resolveIcon(ctx, input, iconOf(row));
	const name = input.name !== undefined ? input.name.trim() : text(row.name);
	if (!name) throw fail("name", "Nhập tên chuyên mục.");
	const ogMediaId = input.ogMediaId === undefined ? text(row.og_media_id) || null : input.ogMediaId || null;
	const now = stamp(ctx);
	const statements: AdminStmt[] = [
		ctx.db
			.prepare(
				`UPDATE category SET slug = ?, name = ?, color_token = ?, parent_id = ?, description = ?, icon_type = ?, icon_name = ?, icon_svg = ?, icon_media_id = ?, icon_url = ?, icon_color = ?,
					template = ?, visible = ?, seo_title = ?, seo_description = ?, og_media_id = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`,
			)
			.bind(
				slug, name, input.colorToken === undefined ? text(row.color_token) || null : input.colorToken || null, parentId, input.description ?? text(row.description), ...iconColumns(icon),
				input.template ?? text(row.template), input.visible === undefined ? num(row.visible) : input.visible ? 1 : 0,
				input.seoTitle === undefined ? text(row.seo_title) || null : input.seoTitle || null,
				input.seoDescription === undefined ? text(row.seo_description) || null : input.seoDescription || null, ogMediaId, now, by.user.id, id,
			),
		...usageStatements(ctx, "category", id, icon, [{ field: "og_media_id", mediaId: ogMediaId }]),
	];
	// Menu items that lead to this category keep the address the category has now.
	if (slug !== text(row.slug)) {
		statements.push(ctx.db.prepare("UPDATE menu_item SET href = ?, updated_at = ?, updated_by = ? WHERE category_id = ? AND link_type = 'category' AND deleted_at IS NULL").bind(categoryPath(kind, section, slug), now, by.user.id, id));
	}
	statements.push(
		audit(ctx, by, {
			action: "category.update",
			entityType: "category",
			entityId: id,
			before: { slug: row.slug, name: row.name, parentId: row.parent_id, visible: num(row.visible) !== 0, template: row.template, iconType: row.icon_type },
			after: { slug, name, parentId, visible: input.visible ?? num(row.visible) !== 0, template: input.template ?? row.template, iconType: icon.iconType },
		}),
	);
	try {
		await ctx.db.batch(statements);
	} catch (error) {
		if (/unique|constraint/i.test(String(error))) throw conflictSlug();
		throw error;
	}
	return getCategory(ctx, id);
}

/** Moves a category to the trash. Refused while anything still uses it, with how many, so no page loses its group. */
export async function deleteCategory(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const item = toItem(await findRow(ctx, id));
	const parts = [
		item.counts.posts && `${item.counts.posts} bài viết`,
		item.counts.teachings && `${item.counts.teachings} bài Tông chỉ tu học`,
		item.counts.pages && `${item.counts.pages} trang Giới thiệu`,
		item.counts.events && `${item.counts.events} sự kiện`,
		item.counts.statues && `${item.counts.statues} bảo tượng hoặc nhóm tượng`,
		item.counts.children && `${item.counts.children} chuyên mục con`,
	].filter(Boolean);
	if (parts.length) {
		throw new ApiError(409, "in_use", `Chuyên mục còn ${parts.join(", ")}. Hãy chuyển hoặc xóa những nội dung đó trước.`, { used: String(item.used), children: String(item.counts.children) });
	}
	await ctx.db.batch([
		trashStatement(ctx, by, "category", id),
		audit(ctx, by, { action: "category.delete", entityType: "category", entityId: id, before: { name: item.name, slug: item.slug, kind: item.kind } }),
	]);
}

export type ReorderItem = { id: string; parentId: string | null };

/**
 * Saves the order and the nesting of categories: `items` lists them in the order wanted, each with its parent.
 * Every one must exist, a parent must be in the same list (kind and section) and in this request, and nothing may be
 * its own ancestor. Rows left out keep their place.
 */
export async function reorderCategories(ctx: AuthContext, by: Authed, items: ReorderItem[]): Promise<{ changed: number }> {
	if (new Set(items.map((item) => item.id)).size !== items.length) throw new ApiError(400, "invalid_input", "Danh sách có chuyên mục bị lặp.");
	const rows = new Map<string, Row>();
	for (let i = 0; i < items.length; i += 50) {
		const chunk = items.slice(i, i + 50);
		const { results } = await ctx.db.prepare(`SELECT id, kind, section, parent_id, position FROM category WHERE deleted_at IS NULL AND id IN (${chunk.map(() => "?").join(",")})`).bind(...chunk.map((item) => item.id)).all();
		for (const row of results) rows.set(text(row.id), row);
	}
	for (const item of items) if (!rows.has(item.id)) throw notFound("Chuyên mục");
	const parentOf = new Map(items.map((item) => [item.id, item.parentId]));
	for (const item of items) {
		if (!item.parentId) continue;
		const parent = rows.get(item.parentId);
		const row = rows.get(item.id) as Row;
		if (!parent || !parentOf.has(item.parentId)) throw fail("parentId", "Chuyên mục cha không có trong danh sách gửi lên.");
		if (text(parent.kind) !== text(row.kind) || text(parent.section) !== text(row.section)) throw fail("parentId", "Chuyên mục chỉ được đặt trong cùng nhóm.");
	}
	for (const item of items) {
		let cursor: string | null | undefined = item.parentId;
		for (let guard = 0; cursor; guard++) {
			if (cursor === item.id || guard > items.length) throw new ApiError(400, "cycle", "Không thể đặt chuyên mục vào bên trong chính nhánh của nó.");
			cursor = parentOf.get(cursor);
		}
	}
	// Sibling positions run 1, 2, 3 … per parent, in the order sent.
	const next = new Map<string, number>();
	const now = stamp(ctx);
	const statements: AdminStmt[] = [];
	for (const item of items) {
		const row = rows.get(item.id) as Row;
		const key = `${text(row.kind)}\u0000${text(row.section)}\u0000${item.parentId ?? ""}`;
		const position = (next.get(key) ?? 0) + 1;
		next.set(key, position);
		if (num(row.position) === position && (text(row.parent_id) || null) === item.parentId) continue;
		statements.push(ctx.db.prepare("UPDATE category SET position = ?, parent_id = ?, updated_at = ?, updated_by = ? WHERE id = ?").bind(position, item.parentId, now, by.user.id, item.id));
	}
	if (statements.length) {
		statements.push(audit(ctx, by, { action: "category.reorder", entityType: "category", entityId: "list", after: { changed: statements.length, total: items.length } }));
		await ctx.db.batch(statements);
	}
	return { changed: Math.max(0, statements.length - 1) };
}

registerTrashable({
	type: "category",
	label: "Chuyên mục",
	table: "category",
	titleSql: "name",
	module: "categories",
	isLive: () => false, // no publish state: editing categories never took the publish right
	hasCreatedBy: false,
	purge: (ctx, _by, id) => [
		ctx.db.prepare("DELETE FROM media_usage WHERE entity_type = 'category' AND entity_id = ?").bind(id),
		ctx.db.prepare("UPDATE menu_item SET category_id = NULL WHERE category_id = ?").bind(id),
	],
});
