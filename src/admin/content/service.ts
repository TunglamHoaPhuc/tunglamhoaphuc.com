// Posts, Tông Chỉ articles and Giới thiệu pages (docs/admin-architecture.md 7.4): one service for the three kinds
// (kinds.ts says how they differ). Every save is one batch: the change, a revision with the next version (whose
// unique index turns two editors saving at once into a 409), the pictures it uses (media_usage) and the audit entry.
import { auditStatement, type AuditEntry } from "../audit/log";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminDb, type AdminStmt, type Row } from "../db";
import { ApiError, forbidden, notFound } from "../http/errors";
import { likeWord, type Page } from "../http/paging";
import { newId } from "../ids";
import { addressesIn, mediaIdOfSrc } from "../media/ids";
import { mediaPath, replaceUsageStatements } from "../media/service";
import { can } from "../rbac/check";
import { getRevision, listRevisions, revisionStatement } from "../revision";
import { SLUG_MAX, slugify } from "../slug";
import { registerTrashable, trashStatement } from "../trash";
import { cleanPosition, IMAGE_WIDTH, imageAt } from "../../libs/content/media";
import { renderContent } from "../../libs/content/normalize";
import { tongChiMarkdown, type BodyTarget } from "../../libs/content/tongChiBody";
import { extraMediaUses, parseExtra } from "./extra";
import { type HtmlNode, markdownOf, mediaIdsIn, parseSafe, plainText, serialize, textOf } from "./html";
import { checkFrom, checkTo } from "../../libs/redirects";
import { bare } from "../../libs/content/normalize";
import { KINDS, publicPathOf, SECTIONS, SPECIAL_LABELS, STATUS_LABELS, type FieldSpec, type Kind, type Status } from "./kinds";
import { signPreview, verifyPreview } from "./preview";
import { searchTextOf, searchWords } from "./search";

/** An article as the editor sees it: its fields under their API names, plus what only the server sets. */
export type State = Record<string, unknown>;

const iso = (ctx: AuthContext) => ctx.now().toISOString();
/** Today in Vietnam (UTC+7), YYYY-MM-DD. */
export const vietnamToday = (now: Date) => new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/**
 * The status the public site is in: a scheduled article whose time has come is on the site (the reader derives it, there is no job
 * that changes the row), so the admin shows it as published too. The stored status stays "scheduled" until somebody changes it.
 */
export function effectiveStatus(row: Row, now: Date): Status {
	const status = (text(row.status) || "draft") as Status;
	const at = text(row.publish_at);
	return status === "scheduled" && at && at <= now.toISOString() ? "published" : status;
}

const audit = (ctx: AuthContext, by: Authed, entry: Pick<AuditEntry, "action" | "entityType" | "entityId" | "before" | "after">) =>
	auditStatement(ctx.db, { ...entry, userId: by.user.id, userEmail: by.user.email, ip: ctx.ip, userAgent: ctx.userAgent }, ctx.now());

const parseJson = (value: unknown, fallback: unknown): unknown => {
	if (typeof value !== "string" || !value) return fallback;
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Turns a failed batch into what the editor should hear. */
function mapWriteError(error: unknown, kind: Kind): never {
	const message = error instanceof Error ? error.message : String(error);
	if (/UNIQUE constraint failed: revision\./i.test(message)) throw new ApiError(409, "conflict", "Bài vừa được người khác lưu. Hãy tải bản mới nhất rồi sửa tiếp.");
	if (new RegExp(`UNIQUE constraint failed: ${kind.table}\\.(section, ${kind.table}\\.)?slug`, "i").test(message)) {
		throw new ApiError(409, "slug_taken", "Đường dẫn này đã có bài khác dùng.", { slug: "Đường dẫn này đã có bài khác dùng. Hãy chọn đường dẫn khác." });
	}
	throw error;
}

// ------------------------------------------------------------------ reading rows

const SELECT_ONE = (kind: Kind) => `SELECT t.*, c.name AS category_name, c.slug AS category_slug, cu.name AS created_by_name, uu.name AS updated_by_name
	FROM ${kind.table} t
	LEFT JOIN category c ON c.id = t.${kind.categoryColumn}
	LEFT JOIN user cu ON cu.id = t.created_by
	LEFT JOIN user uu ON uu.id = t.updated_by`;

async function findRow(ctx: { db: AdminDb }, kind: Kind, id: string): Promise<Row> {
	const row = await ctx.db.prepare(`${SELECT_ONE(kind)} WHERE t.id = ? AND t.deleted_at IS NULL`).bind(id).first();
	if (!row) throw notFound(kind.label);
	return row;
}

function fieldValue(spec: FieldSpec, row: Row): unknown {
	const value = row[spec.column];
	switch (spec.type) {
		case "text":
		case "date":
			return text(value);
		case "position":
			return cleanPosition(text(value));
		case "nullableText":
		case "media":
		case "album":
		case "href":
			return typeof value === "string" && value ? value : null;
		case "bool":
			return value === 1 || value === true || value === "1";
		case "int":
			return num(value);
		case "json":
			return parseJson(value, spec.fallback);
	}
}

async function milestonesOf(db: AdminDb, pageId: string) {
	const { results } = await db.prepare("SELECT label, title, description FROM milestone WHERE page_id = ? ORDER BY position").bind(pageId).all();
	return results.map((item) => ({ label: text(item.label), title: text(item.title), description: text(item.description) }));
}

/** The Tông Chỉ body (Markdown) as the HTML its page shows; the editor opens it when the article has no editor document yet. */
async function teachingHtml(db: AdminDb, row: Row): Promise<string> {
	const { results } = await db.prepare("SELECT a.slug, a.title, COALESCE(c.slug, '') AS grp FROM teaching_article a LEFT JOIN category c ON c.id = a.group_id WHERE a.deleted_at IS NULL").all();
	const targets: BodyTarget[] = results.map((item) => ({ slug: text(item.slug), title: text(item.title), group: text(item.grp) }));
	return renderContent(tongChiMarkdown(text(row.body), { title: text(row.title), slug: text(row.slug), targets }).markdown);
}

/** The editable state of a row: what a revision keeps and what restoring puts back. */
async function stateOf(db: AdminDb, kind: Kind, row: Row, now: Date = new Date()): Promise<State> {
	const state: State = {};
	for (const spec of kind.fields) state[spec.key] = fieldValue(spec, row);
	state.slug = text(row.slug);
	if (kind.hasSection) state.section = text(row.section);
	state.categoryId = text(row[kind.categoryColumn]) || null;
	// A Tông Chỉ article the editor has saved keeps its HTML in content_html; one it has not is read back from its Markdown.
	state.contentHtml = kind.bodyColumn === "body" ? text(row.content_html) || (await teachingHtml(db, row)) : text(row.content_html);
	state.contentJson = parseJson(row.content_json, null);
	if (kind.hasExtra) state.extra = parseJson(row.extra, {});
	if (kind.hasMilestones) state.milestones = await milestonesOf(db, text(row.id));
	state.status = effectiveStatus(row, now);
	state.publishAt = text(row.publish_at) || null;
	return state;
}

/** The keys a revision keeps and a restore may put back (not the status: restoring never publishes). */
const editableKeys = (kind: Kind) => [
	...kind.fields.map((spec) => spec.key),
	"slug",
	...(kind.hasSection ? ["section"] : []),
	"categoryId",
	"contentHtml",
	"contentJson",
	...(kind.hasExtra ? ["extra"] : []),
	...(kind.hasMilestones ? ["milestones"] : []),
];

// ------------------------------------------------------------------ rights on one row

const ownerOf = (row: Row) => text(row.created_by) || "";

function mayChange(by: Authed, kind: Kind, action: "update" | "delete", row: Row) {
	if (!can(by.permissions, kind.module, action, { userId: by.user.id, ownerId: ownerOf(row) })) throw forbidden();
}

/** A live article (published or scheduled) is changed only by someone who may publish: an author's edit would go out unreviewed. */
function mayEditLive(by: Authed, kind: Kind, row: Row) {
	const status = text(row.status);
	if ((status === "published" || status === "scheduled") && !can(by.permissions, kind.module, "publish")) {
		throw new ApiError(403, "needs_publisher", "Bài đang hiển thị trên trang. Chỉ người có quyền xuất bản mới sửa được; hãy nhờ biên tập viên.");
	}
}

const rightsOn = (by: Authed, kind: Kind, row: Row) => ({
	canUpdate: can(by.permissions, kind.module, "update", { userId: by.user.id, ownerId: ownerOf(row) }) && (!["published", "scheduled"].includes(text(row.status)) || can(by.permissions, kind.module, "publish")),
	canDelete: can(by.permissions, kind.module, "delete", { userId: by.user.id, ownerId: ownerOf(row) }),
	canPublish: can(by.permissions, kind.module, "publish"),
	canSubmit: can(by.permissions, kind.module, "update", { userId: by.user.id, ownerId: ownerOf(row) }),
});

// ------------------------------------------------------------------ media previews

export type MediaPreview = { id: string; url: string; thumbUrl: string; alt: string; mime: string };

/** D1 allows 100 bound values in a statement: a long list of ids is asked for in pieces of 90. */
const ID_CHUNK = 90;

async function mediaPreviews(db: AdminDb, ids: string[]): Promise<Record<string, MediaPreview>> {
	const unique = [...new Set(ids.filter(Boolean))];
	const out: Record<string, MediaPreview> = {};
	for (let start = 0; start < unique.length; start += ID_CHUNK) {
		const chunk = unique.slice(start, start + ID_CHUNK);
		const { results } = await db.prepare(`SELECT id, r2_key, url, alt, mime FROM media WHERE id IN (${chunk.map(() => "?").join(", ")})`).bind(...chunk).all();
		for (const row of results) {
			const url = mediaPath(text(row.r2_key) || null, text(row.url) || null);
			out[text(row.id)] = { id: text(row.id), url, thumbUrl: url && text(row.mime).startsWith("image/") ? imageAt(url, IMAGE_WIDTH.small) : url, alt: text(row.alt), mime: text(row.mime) };
		}
	}
	return out;
}

/** Which of `ids` are rows of the library (the ones a usage row may point at). */
async function existingMediaIds(db: AdminDb, ids: Iterable<string>): Promise<string[]> {
	const unique = [...new Set(ids)];
	const found: string[] = [];
	for (let start = 0; start < unique.length; start += ID_CHUNK) {
		const chunk = unique.slice(start, start + ID_CHUNK);
		const { results } = await db.prepare(`SELECT id FROM media WHERE id IN (${chunk.map(() => "?").join(", ")})`).bind(...chunk).all();
		found.push(...results.map((item) => text(item.id)));
	}
	return found;
}

/** The addresses an article's tree points at with a picture, a sound or a link (the library's pictures it holds by address). */
function addressesInTree(nodes: HtmlNode[], into: Set<string>) {
	for (const node of nodes) {
		if (node.type !== "element") continue;
		for (const key of ["src", "href"]) if (node.attrs[key]) into.add(node.attrs[key]);
		addressesInTree(node.children, into);
	}
}

/**
 * The library pictures an article uses, for `media_usage`: those named by `data-media-id`, and those it holds only by address (the
 * imported ones: a picture in the body, one in the intro or summary text, a book's cover), found by the id the import gave their
 * address. Only rows that exist in the library (a usage row of a missing one would break the save).
 */
async function referencedMedia(db: AdminDb, kind: Kind, state: State, tree: HtmlNode[]): Promise<{ content: string[]; cover: string[] }> {
	const addresses = new Set<string>();
	addressesInTree(tree, addresses);
	for (const key of ["intro", kind.summaryColumn]) if (typeof state[key] === "string") for (const address of addressesIn(state[key] as string)) addresses.add(address);
	const cover = (state.book as { cover?: unknown } | null | undefined)?.cover;
	const coverAddress = typeof cover === "string" && cover ? cover : null;
	const byAddress = new Map<string, string>();
	for (const address of [...addresses, ...(coverAddress ? [coverAddress] : [])].slice(0, 500)) {
		const id = await mediaIdOfSrc(address);
		if (id) byAddress.set(address, id);
	}
	const existing = new Set(await existingMediaIds(db, [...mediaIdsIn(tree), ...byAddress.values()]));
	const content = [...new Set([...mediaIdsIn(tree), ...[...addresses].map((address) => byAddress.get(address) ?? "")])].filter((id) => existing.has(id));
	const coverId = coverAddress ? (byAddress.get(coverAddress) ?? "") : "";
	return { content, cover: existing.has(coverId) ? [coverId] : [] };
}

function mediaUses(kind: Kind, state: State, contentIds: string[], coverIds: string[] = []): { mediaId: string; field: string }[] {
	const uses: { mediaId: string; field: string }[] = [];
	for (const spec of kind.fields) if (spec.type === "media" && typeof state[spec.key] === "string" && state[spec.key]) uses.push({ mediaId: state[spec.key] as string, field: spec.column });
	if (kind.hasExtra) uses.push(...extraMediaUses((state.extra ?? {}) as Record<string, unknown>));
	for (const id of contentIds) uses.push({ mediaId: id, field: "content" });
	for (const id of coverIds) uses.push({ mediaId: id, field: "book.cover" });
	return uses;
}

// ------------------------------------------------------------------ related things (posts)

export type RelatedItem = { type: "post" | "statue"; id: string; title: string; href: string | null };

async function relatedOf(db: AdminDb, postId: string): Promise<RelatedItem[]> {
	const { results } = await db
		.prepare(
			`SELECT r.target_type, r.target_id,
				CASE r.target_type WHEN 'post' THEN (SELECT p.title FROM post p WHERE p.id = r.target_id AND p.deleted_at IS NULL)
					ELSE (SELECT s.name FROM statue s WHERE s.id = r.target_id AND s.deleted_at IS NULL) END AS title,
				CASE r.target_type WHEN 'post' THEN (SELECT '/' || p.section || '/' || p.slug FROM post p WHERE p.id = r.target_id)
					ELSE (SELECT '/bao-tuong/' || s.slug FROM statue s WHERE s.id = r.target_id) END AS href
			 FROM post_related r WHERE r.post_id = ? ORDER BY r.position`,
		)
		.bind(postId)
		.all();
	return results.map((row) => ({ type: text(row.target_type) === "statue" ? "statue" : "post", id: text(row.target_id), title: text(row.title) || "(đã xóa)", href: text(row.href) || null }));
}

// ------------------------------------------------------------------ the API's shapes

export type ContentDetail = State & {
	id: string;
	version: number;
	status: Status;
	publishAt: string | null;
	categoryName: string;
	categorySlug: string;
	createdBy: string | null;
	createdByName: string;
	createdAt: string | null;
	updatedAt: string | null;
	updatedByName: string;
	legacyViews: number | null;
	galleryCount: number | null;
	related?: RelatedItem[];
	media: Record<string, MediaPreview>;
	previewPath: string;
	canUpdate: boolean;
	canDelete: boolean;
	canPublish: boolean;
	canSubmit: boolean;
	/** Only in the answer to a save that sent the body: sanitising changed it, so the editor must reload `contentHtml`. */
	bodyChanged?: boolean;
};

async function detailOf(ctx: AuthContext, by: Authed, kind: Kind, row: Row): Promise<ContentDetail> {
	const state = await stateOf(ctx.db, kind, row, ctx.now());
	const id = text(row.id);
	const mediaIds = mediaUses(kind, state, []).map((use) => use.mediaId);
	return {
		...state,
		id,
		version: num(row.version) || 1,
		status: effectiveStatus(row, ctx.now()),
		publishAt: text(row.publish_at) || null,
		categoryName: text(row.category_name),
		categorySlug: text(row.category_slug),
		createdBy: text(row.created_by) || null,
		createdByName: text(row.created_by_name),
		createdAt: kind.hasCreatedAt ? text(row.created_at) || null : null,
		updatedAt: text(row.updated_at) || null,
		updatedByName: text(row.updated_by_name),
		legacyViews: row.legacy_views === undefined ? null : num(row.legacy_views),
		galleryCount: row.gallery_count === undefined ? null : num(row.gallery_count),
		...(kind.hasRelated ? { related: await relatedOf(ctx.db, id) } : {}),
		media: await mediaPreviews(ctx.db, mediaIds),
		previewPath: `/quan-tri/xem-truoc/${kind.path}/${encodeURIComponent(id)}`,
		...rightsOn(by, kind, row),
	};
}

export async function getItem(ctx: AuthContext, by: Authed, kind: Kind, id: string): Promise<ContentDetail> {
	return detailOf(ctx, by, kind, await findRow(ctx, kind, id));
}

export type ListFilter = {
	section?: string;
	categoryId?: string;
	authorId?: string;
	status?: string;
	from?: string;
	to?: string;
	pinned?: string;
	q?: string;
	sort?: string;
};

export type ListRow = {
	id: string;
	slug: string;
	title: string;
	section: string | null;
	categoryId: string | null;
	categoryName: string;
	author: string;
	status: Status;
	publishAt: string | null;
	publishedDate: string | null;
	pinned: boolean;
	position: number | null;
	thumbUrl: string;
	createdBy: string | null;
	createdByName: string;
	updatedAt: string | null;
	updatedByName: string;
	version: number;
	canUpdate: boolean;
	canDelete: boolean;
};

// SQLite orders NULL first going up and last going down, which is what the lists want.
const SORTS: Record<string, string> = {
	"-updatedAt": "t.updated_at DESC, t.rowid DESC",
	updatedAt: "t.updated_at ASC, t.rowid",
	"-publishedDate": "t.published_date DESC, t.rowid DESC",
	publishedDate: "t.published_date ASC, t.rowid",
	title: "t.title COLLATE NOCASE, t.rowid",
	"-title": "t.title COLLATE NOCASE DESC, t.rowid DESC",
	position: "t.position, t.rowid",
};

function whereOf(kind: Kind, filter: ListFilter, withStatus: boolean, nowIso: string): { clause: string; args: unknown[] } {
	const where = ["t.deleted_at IS NULL"];
	const args: unknown[] = [];
	if (kind.hasSection && filter.section) {
		where.push("t.section = ?");
		args.push(filter.section);
	}
	if (filter.categoryId) {
		if (filter.categoryId === "none") where.push(`t.${kind.categoryColumn} IS NULL`);
		else {
			where.push(`t.${kind.categoryColumn} = ?`);
			args.push(filter.categoryId);
		}
	}
	if (filter.authorId) {
		where.push("t.created_by = ?");
		args.push(filter.authorId);
	}
	if (withStatus && filter.status) {
		// A scheduled article whose time has come is on the site: it counts as published (effectiveStatus).
		if (filter.status === "published") {
			where.push("(t.status = 'published' OR (t.status = 'scheduled' AND t.publish_at <= ?))");
			args.push(nowIso);
		} else if (filter.status === "scheduled") {
			where.push("(t.status = 'scheduled' AND (t.publish_at IS NULL OR t.publish_at > ?))");
			args.push(nowIso);
		} else {
			where.push("t.status = ?");
			args.push(filter.status);
		}
	}
	if (filter.from && /^\d{4}-\d{2}-\d{2}$/.test(filter.from)) {
		where.push(`substr(t.${kind.dateColumn}, 1, 10) >= ?`);
		args.push(filter.from);
	}
	if (filter.to && /^\d{4}-\d{2}-\d{2}$/.test(filter.to)) {
		where.push(`substr(t.${kind.dateColumn}, 1, 10) <= ?`);
		args.push(filter.to);
	}
	if (kind.hasPinned && (filter.pinned === "1" || filter.pinned === "0")) {
		where.push("t.pinned = ?");
		args.push(filter.pinned === "1" ? 1 : 0);
	}
	const words = searchWords(filter.q ?? "");
	if (words.length) {
		// Rows the import left without search text (until fillSearchText runs) are matched on their title as typed.
		where.push(`((${words.map(() => "t.search_text LIKE ?").join(" AND ")}) OR (t.search_text = '' AND t.title LIKE ? ESCAPE '\\'))`);
		args.push(...words.map((word) => `%${word}%`), likeWord(filter.q!.trim()));
	}
	return { clause: where.join(" AND "), args };
}

export async function listItems(ctx: AuthContext, by: Authed, kind: Kind, filter: ListFilter, page: Page): Promise<{ rows: ListRow[]; total: number }> {
	const { clause, args } = whereOf(kind, filter, true, ctx.now().toISOString());
	let sort = filter.sort && SORTS[filter.sort] ? filter.sort : "-updatedAt";
	if ((sort === "position" && !kind.hasPosition) || (sort.endsWith("publishedDate") && kind.dateColumn !== "published_date")) sort = "-updatedAt";
	const order = SORTS[sort];
	const total = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${kind.table} t WHERE ${clause}`).bind(...args).first();
	// Never the body columns: a list stays light however long the articles are.
	const { results } = await ctx.db
		.prepare(
			`SELECT t.id, t.slug, t.title, t.status, t.publish_at, t.version, t.updated_at, t.created_by, t.${kind.categoryColumn} AS category_id,
				${kind.hasSection ? "t.section" : "NULL AS section"}, ${kind.dateColumn === "published_date" ? "t.published_date" : "NULL AS published_date"},
				${kind.hasPinned ? "t.pinned" : "0 AS pinned"}, ${kind.hasPosition ? "t.position" : "NULL AS position"}, ${kind.table === "page" ? "'' AS author" : "t.author"},
				c.name AS category_name, cu.name AS created_by_name, uu.name AS updated_by_name, m.r2_key AS thumb_key, m.url AS thumb_url
			 FROM ${kind.table} t
			 LEFT JOIN category c ON c.id = t.${kind.categoryColumn}
			 LEFT JOIN user cu ON cu.id = t.created_by
			 LEFT JOIN user uu ON uu.id = t.updated_by
			 LEFT JOIN media m ON m.id = ${kind.thumbSql}
			 WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
		)
		.bind(...args, page.pageSize, page.offset)
		.all();
	return {
		rows: results.map((row) => {
			const url = mediaPath(text(row.thumb_key) || null, text(row.thumb_url) || null);
			const rights = rightsOn(by, kind, row);
			return {
				id: text(row.id),
				slug: text(row.slug),
				title: text(row.title),
				section: text(row.section) || null,
				categoryId: text(row.category_id) || null,
				categoryName: text(row.category_name),
				author: text(row.author),
				status: effectiveStatus(row, ctx.now()),
				publishAt: text(row.publish_at) || null,
				publishedDate: text(row.published_date) || null,
				pinned: num(row.pinned) === 1,
				position: row.position == null ? null : num(row.position),
				thumbUrl: url ? imageAt(url, IMAGE_WIDTH.small) : "",
				createdBy: text(row.created_by) || null,
				createdByName: text(row.created_by_name),
				updatedAt: text(row.updated_at) || null,
				updatedByName: text(row.updated_by_name),
				version: num(row.version) || 1,
				canUpdate: rights.canUpdate,
				canDelete: rights.canDelete,
			};
		}),
		total: num(total?.n),
	};
}

/** How many articles each status tab holds, under the same filters as the list (but any status). */
export async function countByStatus(ctx: AuthContext, kind: Kind, filter: ListFilter): Promise<Record<Status | "all", number>> {
	const nowIso = ctx.now().toISOString();
	const { clause, args } = whereOf(kind, filter, false, nowIso);
	const { results } = await ctx.db
		.prepare(`SELECT CASE WHEN t.status = 'scheduled' AND t.publish_at <= ? THEN 'published' ELSE t.status END AS status, COUNT(*) AS n FROM ${kind.table} t WHERE ${clause} GROUP BY 1`)
		.bind(nowIso, ...args)
		.all();
	const counts = { all: 0, draft: 0, pending: 0, published: 0, scheduled: 0, hidden: 0 };
	for (const row of results) {
		const status = text(row.status) as Status;
		if (status in counts) counts[status] = num(row.n);
		counts.all += num(row.n);
	}
	return counts;
}

// ------------------------------------------------------------------ slugs

async function slugTaken(db: AdminDb, kind: Kind, slug: string, section: string | null, excludeId: string | null): Promise<boolean> {
	const where = ["slug = ?", "deleted_at IS NULL"];
	const args: unknown[] = [slug];
	if (kind.hasSection) {
		where.push("section = ?");
		args.push(section ?? "");
	}
	if (excludeId) {
		where.push("id != ?");
		args.push(excludeId);
	}
	return !!(await db.prepare(`SELECT 1 AS yes FROM ${kind.table} WHERE ${where.join(" AND ")} LIMIT 1`).bind(...args).first());
}

/** The first of `base`, `base-2`, `base-3`… that no live article of the same place uses. */
async function freeSlug(db: AdminDb, kind: Kind, base: string, section: string | null, excludeId: string | null): Promise<string> {
	if (!(await slugTaken(db, kind, base, section, excludeId))) return base;
	for (let n = 2; n < 200; n++) {
		const candidate = `${base.slice(0, 80 - String(n).length - 1)}-${n}`;
		if (!(await slugTaken(db, kind, candidate, section, excludeId))) return candidate;
	}
	return `${base.slice(0, 60)}-${Date.now().toString(36)}`;
}

export async function checkSlug(ctx: AuthContext, kind: Kind, input: { slug?: string; text?: string; section?: string; excludeId?: string }) {
	// A slug made from a title is cut to the limit; one that is asked about is judged as it is (and one the article already has is its own).
	const slug = input.slug ? slugify(input.slug, Number.MAX_SAFE_INTEGER) : slugify(input.text || "");
	if (!slug) throw new ApiError(400, "invalid_input", "Đường dẫn cần có chữ hoặc số.", { slug: "Đường dẫn cần có chữ hoặc số." });
	if (kind.hasSection && !SECTIONS.some((section) => section.slug === input.section)) throw new ApiError(400, "invalid_input", "Chọn chuyên trang.", { section: "Chọn chuyên trang." });
	if (slug.length > SLUG_MAX) {
		const own = input.excludeId ? await ctx.db.prepare(`SELECT slug FROM ${kind.table} WHERE id = ? AND deleted_at IS NULL`).bind(input.excludeId).first() : null;
		if (!own || text(own.slug) !== input.slug) {
			const message = `Đường dẫn tối đa ${SLUG_MAX} ký tự (đang có ${slug.length}). Hãy rút gọn.`;
			throw new ApiError(400, "invalid_input", message, { slug: message });
		}
		return { slug: input.slug, available: true, suggestion: input.slug };
	}
	const taken = await slugTaken(ctx.db, kind, slug, input.section ?? null, input.excludeId || null);
	return { slug, available: !taken, suggestion: taken ? await freeSlug(ctx.db, kind, slug, input.section ?? null, input.excludeId || null) : slug };
}

// ------------------------------------------------------------------ preparing a save

type Prepared = {
	next: State;
	/** Column -> value for the columns that change. */
	columns: Map<string, unknown>;
	changedKeys: string[];
	/** The library pictures the body, intro and summary use, and the cover of a book: what `media_usage` is rebuilt from. */
	contentIds: string[];
	coverIds: string[];
	searchText: string;
	/** Sanitising dropped, unwrapped or rewrote something of the submitted body: the editor must reload the stored HTML. */
	bodyChanged: boolean;
};

function columnValue(spec: FieldSpec, value: unknown): unknown {
	switch (spec.type) {
		case "text":
			return plainText(String(value ?? "")).slice(0, spec.max ?? 1000);
		case "nullableText": {
			const clean = value == null ? "" : plainText(String(value)).slice(0, spec.max ?? 1000);
			return clean || null;
		}
		case "bool":
			return value ? 1 : 0;
		case "int":
			return Math.trunc(Number(value) || 0);
		case "json":
			return value == null ? (spec.fallback == null ? null : JSON.stringify(spec.fallback)) : JSON.stringify(value);
		case "position":
			return String(value ?? "") || "center 50%";
		case "date":
			return String(value ?? "");
		default:
			return value == null || value === "" ? null : value;
	}
}

/** The value as the state keeps it after cleaning (so "changed" compares what is stored). */
function cleanValue(spec: FieldSpec, value: unknown): unknown {
	const column = columnValue(spec, value);
	if (spec.type === "json") return column == null ? null : JSON.parse(column as string);
	if (spec.type === "bool") return column === 1;
	return column;
}

async function checkMediaIds(db: AdminDb, ids: { key: string; id: string }[]) {
	if (!ids.length) return;
	const unique = [...new Set(ids.map((item) => item.id))];
	const { results } = await db.prepare(`SELECT id FROM media WHERE deleted_at IS NULL AND id IN (${unique.map(() => "?").join(", ")})`).bind(...unique).all();
	const found = new Set(results.map((row) => text(row.id)));
	const fields: Record<string, string> = {};
	for (const item of ids) if (!found.has(item.id)) fields[item.key] = "Ảnh không còn trong thư viện. Hãy chọn ảnh khác.";
	if (Object.keys(fields).length) throw new ApiError(400, "invalid_input", "Có ảnh không còn trong thư viện.", fields);
}

async function categoryOf(db: AdminDb, kind: Kind, categoryId: string, section: string | null): Promise<{ slug: string; name: string }> {
	const row = await db.prepare("SELECT slug, name, kind, section FROM category WHERE id = ? AND deleted_at IS NULL").bind(categoryId).first();
	if (!row || text(row.kind) !== kind.categoryKind || (kind.hasSection && text(row.section) !== section)) {
		throw new ApiError(400, "invalid_input", "Chuyên mục không hợp lệ.", { categoryId: kind.hasSection ? "Chọn một chuyên mục của chuyên trang này." : "Chọn một nhóm có trong danh sách." });
	}
	return { slug: text(row.slug), name: text(row.name) };
}

/**
 * Applies `input` over `current` and works out what to store: cleaned values, checked references, the sanitised body
 * (with library pictures pointed at their current address) and the columns that change. `current` is null on create.
 */
async function prepare(db: AdminDb, kind: Kind, current: State | null, input: State, currentRow: Row | null, ownId: string | null, trustSlug = false): Promise<Prepared> {
	const next: State = { ...(current ?? {}) };
	const columns = new Map<string, unknown>();
	const changedKeys: string[] = [];
	const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined;
	const mark = (key: string) => void (changedKeys.includes(key) || changedKeys.push(key));
	const mediaToCheck: { key: string; id: string }[] = [];

	for (const spec of kind.fields) {
		if (!has(spec.key)) {
			if (!current) {
				next[spec.key] = cleanValue(spec, spec.type === "json" ? spec.fallback : spec.type === "bool" ? false : spec.type === "int" ? 0 : null);
				columns.set(spec.column, columnValue(spec, next[spec.key]));
			}
			continue;
		}
		const value = cleanValue(spec, input[spec.key]);
		if (current && same(value, current[spec.key])) continue;
		if (spec.type === "media" && typeof value === "string") mediaToCheck.push({ key: spec.key, id: value });
		if (spec.type === "album" && typeof value === "string" && !(await db.prepare("SELECT 1 AS yes FROM album WHERE id = ?").bind(value).first())) {
			throw new ApiError(400, "invalid_input", "Album không tồn tại.", { albumId: "Album không tồn tại." });
		}
		next[spec.key] = value;
		columns.set(spec.column, columnValue(spec, value));
		if (current) mark(spec.key);
	}

	if (!plainText(String(next.title ?? ""))) throw new ApiError(400, "invalid_input", "Nhập tiêu đề.", { title: "Nhập tiêu đề." });

	// A Tông Chỉ article is shown under its `name` (page title, hero, share card, lists). The import made it the title, or "title: subtitle"
	// for articles that share a title; while it is still that, a new title (or subtitle) carries it along. A name somebody wrote is theirs.
	if (kind.table === "teaching_article" && current && !columns.has("name") && (columns.has("title") || columns.has("subtitle"))) {
		const [oldTitle, oldSubtitle, oldName] = [String(current.title ?? ""), String(current.subtitle ?? ""), String(current.name ?? "")];
		const [title, subtitle] = [String(next.title ?? ""), String(next.subtitle ?? "")];
		let name: string | null = null;
		if (!oldName || oldName === oldTitle) name = title;
		else if (oldSubtitle && oldName === `${oldTitle}: ${oldSubtitle}`) name = subtitle ? `${title}: ${subtitle}` : title;
		name = name === null ? null : name.slice(0, 300);
		if (name !== null && name !== oldName) {
			next.name = name;
			columns.set("name", name);
			mark("name");
		}
	}

	// Where it lives: the section (posts), the category, the slug.
	if (kind.hasSection) {
		if (has("section") && input.section !== current?.section) {
			if (!SECTIONS.some((section) => section.slug === input.section)) throw new ApiError(400, "invalid_input", "Chọn chuyên trang.", { section: "Chọn chuyên trang." });
			next.section = input.section;
			columns.set("section", input.section);
			if (current) mark("section");
		}
		if (!next.section) throw new ApiError(400, "invalid_input", "Chọn chuyên trang.", { section: "Chọn chuyên trang." });
	}
	const sectionChanged = !!current && kind.hasSection && next.section !== current.section;
	const section = kind.hasSection ? (next.section as string) : null;
	let categoryChanged = false;
	if (!current || has("categoryId") || sectionChanged) {
		const categoryId = has("categoryId") ? (input.categoryId as string | null) || null : ((next.categoryId as string | null | undefined) ?? null);
		if (categoryId && (!current || categoryId !== current.categoryId || sectionChanged)) await categoryOf(db, kind, categoryId, section);
		if (!current || !same(categoryId, current.categoryId)) {
			next.categoryId = categoryId;
			columns.set(kind.categoryColumn, categoryId);
			categoryChanged = true;
			if (current) mark("categoryId");
		}
	}

	// A slug that arrives as stored is left alone (no slugify, no cutting: 87 of the old site's slugs are longer than the
	// editor's own limit). Only a slug somebody changed is made into a slug; a new one longer than SLUG_MAX is refused, never cut.
	const given = has("slug") ? String(input.slug ?? "") : null;
	if (given !== null && (current || given.trim()) && given !== current?.slug) {
		const slug = slugify(given, Number.MAX_SAFE_INTEGER);
		if (!slug) throw new ApiError(400, "invalid_input", "Đường dẫn cần có chữ hoặc số.", { slug: "Đường dẫn cần có chữ hoặc số." });
		if (slug.length > SLUG_MAX && !trustSlug) {
			const message = `Đường dẫn tối đa ${SLUG_MAX} ký tự (đang có ${slug.length}). Hãy rút gọn.`;
			throw new ApiError(400, "invalid_input", message, { slug: message });
		}
		if (slug !== current?.slug) {
			next.slug = slug;
			columns.set("slug", slug);
			if (current) mark("slug");
		}
	}
	const explicitSlug = given !== null && (!!current || !!given.trim());
	if (!current && !next.slug) next.slug = slugify(String(next.title)) || kind.idPrefix;
	if (!current || columns.has("slug") || sectionChanged) {
		const slug = String(next.slug);
		if (await slugTaken(db, kind, slug, section, ownId)) {
			const suggestion = await freeSlug(db, kind, slug, section, ownId);
			// A slug somebody asked for is theirs to change: the answer carries the free one, nothing is renamed behind their back.
			if (current || explicitSlug) {
				throw new ApiError(409, "slug_taken", "Đường dẫn này đã có bài khác dùng.", { slug: "Đường dẫn này đã có bài khác dùng. Hãy chọn đường dẫn khác." }, undefined, { suggestion: { slug: suggestion } });
			}
			// A new article whose slug came from its title takes the next free one.
			next.slug = suggestion;
		}
		if (!current) columns.set("slug", next.slug);
	}

	// Category fields (posts): checked by the schema of the category; only when they or the category change.
	if (kind.hasExtra && (!current || has("extra") || categoryChanged)) {
		const categoryRow = next.categoryId ? await db.prepare("SELECT slug FROM category WHERE id = ?").bind(next.categoryId).first() : null;
		const parsed = parseExtra(text(categoryRow?.slug), has("extra") ? input.extra : (current?.extra ?? {}));
		if (!parsed.ok) throw new ApiError(400, "invalid_input", "Trường riêng của chuyên mục chưa hợp lệ.", parsed.fields);
		if (!current || !same(parsed.data, current.extra)) {
			const before = (current?.extra ?? {}) as Record<string, unknown>;
			for (const use of extraMediaUses(parsed.data)) if (!extraMediaUses(before).some((old) => old.mediaId === use.mediaId)) mediaToCheck.push({ key: use.field, id: use.mediaId });
			next.extra = parsed.data;
			columns.set("extra", JSON.stringify(parsed.data));
			if (current) mark("extra");
		}
	}

	// The body: sanitised, with library pictures at their current address.
	let bodyTree: HtmlNode[];
	let bodyChanged = false;
	// The editor sends back the body as it was opened: nothing to sanitise, store or write again (the old site's HTML is never rewritten
	// by a save that did not change it).
	const bodyAsOpened = !!current && has("contentHtml") && String(input.contentHtml ?? "") === String(current.contentHtml ?? "");
	if (has("contentHtml") && !bodyAsOpened) {
		const firstChanges: string[] = [];
		const secondChanges: string[] = [];
		const firstPass = parseSafe(String(input.contentHtml ?? ""), { changes: firstChanges });
		const ids = mediaIdsIn(firstPass);
		const known = ids.length ? await mediaPreviews(db, ids) : {};
		const mediaSrc = new Map(Object.values(known).map((item) => [item.id, item.url]));
		const tree = mediaSrc.size ? parseSafe(String(input.contentHtml ?? ""), { mediaSrc, changes: secondChanges }) : firstPass;
		bodyChanged = (mediaSrc.size ? secondChanges : firstChanges).length > 0;
		const html = serialize(tree).trim();
		bodyTree = tree;
		const stored = kind.bodyColumn === "body" ? markdownOf(tree) : html;
		const before = currentRow ? text(currentRow[kind.bodyColumn]) : null;
		// A Tông Chỉ article keeps the editor's HTML as well as the Markdown: the Markdown cannot hold tables, video, sound or
		// captions, so the site shows the HTML when it is there and falls back to the Markdown otherwise.
		const keepsHtmlToo = kind.bodyColumn === "body";
		const htmlChanged = keepsHtmlToo && (currentRow ? text(currentRow.content_html) : "") !== html;
		next.contentHtml = html;
		if (before === null || before !== stored || htmlChanged) {
			columns.set(kind.bodyColumn, stored);
			if (keepsHtmlToo) columns.set("content_html", html);
			if (current) mark("contentHtml");
		}
	} else {
		bodyTree = parseSafe(String(next.contentHtml ?? ""));
		if (!current) {
			next.contentHtml = "";
			columns.set(kind.bodyColumn, "");
		}
	}
	if (has("contentJson") && (!current || !same(input.contentJson ?? null, current.contentJson))) {
		next.contentJson = input.contentJson ?? null;
		columns.set("content_json", next.contentJson == null ? null : JSON.stringify(next.contentJson));
		if (current) mark("contentJson");
	}

	if (kind.hasMilestones && has("milestones") && (!current || !same(input.milestones, current.milestones))) {
		next.milestones = input.milestones;
		if (current) mark("milestones");
	} else if (kind.hasMilestones && !current) next.milestones = [];

	await checkMediaIds(db, mediaToCheck);
	const { content: contentIds, cover: coverIds } = await referencedMedia(db, kind, next, bodyTree);

	const summary = String(next[kind.summaryColumn === "summary" ? "summary" : kind.summaryColumn] ?? "");
	const searchText = searchTextOf(String(next.title ?? ""), String(next.subtitle ?? ""), summary, textOf(parseSafe(String(next.contentHtml ?? ""))));
	return { next, columns, changedKeys, contentIds, coverIds, searchText, bodyChanged };
}

function milestoneStatements(db: AdminDb, pageId: string, milestones: { label: string; title: string; description: string }[]): AdminStmt[] {
	const out: AdminStmt[] = [db.prepare("DELETE FROM milestone WHERE page_id = ?").bind(pageId)];
	// Five values a row: 20 rows keep a statement within D1's 100 bound values.
	for (let start = 0; start < milestones.length; start += 20) {
		const chunk = milestones.slice(start, start + 20);
		out.push(
			db
				.prepare(`INSERT INTO milestone (page_id, position, label, title, description) VALUES ${chunk.map(() => "(?, ?, ?, ?, ?)").join(", ")}`)
				.bind(...chunk.flatMap((item, index) => [pageId, start + index + 1, item.label, item.title, item.description])),
		);
	}
	return out;
}

/**
 * A live article (published or scheduled) whose address changes leaves its old address pointing at the new one, in the same
 * batch as the save. Older redirects to the old address follow the article (no chains), and a redirect that starts at the
 * address it now has is dropped (no loops); one row per old address.
 */
function redirectStatements(ctx: AuthContext, by: Authed, kind: Kind, current: State, next: State): AdminStmt[] {
	if (!["published", "scheduled"].includes(String(current.status))) return [];
	const from = publicPathOf(kind, (current.section as string | undefined) ?? null, String(current.slug));
	const to = publicPathOf(kind, (next.section as string | undefined) ?? null, String(next.slug));
	if (from === to || !checkFrom(from).ok || !checkTo(to).ok) return [];
	return [
		ctx.db.prepare("DELETE FROM redirect WHERE from_path = ?").bind(to),
		ctx.db.prepare("UPDATE redirect SET to_path = ? WHERE to_path = ?").bind(to, from),
		ctx.db
			.prepare(
				`INSERT INTO redirect (from_path, to_path, code, note, hits, active, created_by, created_at) VALUES (?, ?, 301, ?, 0, 1, ?, ?)
				 ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path, code = 301, active = 1, note = excluded.note`,
			)
			.bind(from, to, "Tự động: bài đổi đường dẫn", by.user.id, iso(ctx)),
	];
}

/**
 * A row the old admin's import made has no revision: its first edit would leave nothing to go back to. This is the statement that
 * keeps the version the row has now (before the edit), in the batch of the edit; none when that version already has one.
 */
async function baseRevision(ctx: AuthContext, kind: Kind, id: string, row: Row, current: State, version: number): Promise<AdminStmt[]> {
	if (await ctx.db.prepare("SELECT 1 AS yes FROM revision WHERE entity_type = ? AND entity_id = ? AND version = ?").bind(kind.entityType, id, version).first()) return [];
	const snapshot = JSON.stringify(snapshotOf(kind, current));
	if (snapshot.length > 1_500_000) return [];
	const created = text(row.created_by) || null;
	return [
		ctx.db
			.prepare("INSERT INTO revision (entity_type, entity_id, version, snapshot, summary, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
			.bind(kind.entityType, id, version, snapshot, created ? "Bản trước khi sửa" : "Bản nhập từ web cũ", created, text(row.updated_at) || text(row.created_at) || iso(ctx)),
	];
}

const snapshotOf = (kind: Kind, state: State): State => Object.fromEntries([...editableKeys(kind), "status", "publishAt"].map((key) => [key, state[key] ?? null]));

const summaryOf = (kind: Kind, keys: string[]) => {
	const labels = [...new Set(keys.map((key) => kind.fields.find((spec) => spec.key === key)?.label ?? SPECIAL_LABELS[key] ?? key))];
	return labels.length ? `Sửa ${labels.join(", ")}` : "Lưu";
};

// ------------------------------------------------------------------ writing

export async function createItem(ctx: AuthContext, by: Authed, kind: Kind, input: State, opts: { summary?: string; action?: string } = {}): Promise<ContentDetail> {
	const prepared = await prepare(ctx.db, kind, null, input, null, null);
	const id = newId(kind.idPrefix, ctx.now().getTime());
	const now = iso(ctx);
	const next: State = { ...prepared.next, status: "draft", publishAt: null };
	if (kind.fields.some((spec) => spec.key === "publishedDate") && !next.publishedDate) {
		next.publishedDate = vietnamToday(ctx.now());
		prepared.columns.set("published_date", next.publishedDate);
	}
	if (kind.table === "teaching_article" && !next.name) prepared.columns.set("name", plainText(String(next.title)));
	const columns = new Map(prepared.columns);
	columns.set("id", id);
	columns.set("status", "draft");
	columns.set("version", 1);
	columns.set("created_by", by.user.id);
	columns.set("updated_by", by.user.id);
	columns.set("updated_at", now);
	columns.set("search_text", prepared.searchText);
	if (kind.hasCreatedAt) columns.set("created_at", now);
	const names = [...columns.keys()];
	const statements: AdminStmt[] = [
		ctx.db.prepare(`INSERT INTO ${kind.table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`).bind(...names.map((name) => columns.get(name))),
		revisionStatement(ctx, by, kind.entityType, id, 1, snapshotOf(kind, next), opts.summary ?? "Tạo mới"),
		...replaceUsageStatements(ctx, kind.entityType, id, mediaUses(kind, next, prepared.contentIds, prepared.coverIds)),
		audit(ctx, by, { action: `${kind.entityType}.${opts.action ?? "create"}`, entityType: kind.entityType, entityId: id, after: { title: next.title, slug: next.slug, section: next.section ?? undefined, categoryId: next.categoryId } }),
	];
	if (kind.hasMilestones) statements.push(...milestoneStatements(ctx.db, id, (next.milestones ?? []) as { label: string; title: string; description: string }[]));
	try {
		await ctx.db.batch(statements);
	} catch (error) {
		mapWriteError(error, kind);
	}
	return { ...(await getItem(ctx, by, kind, id)), bodyChanged: prepared.bodyChanged };
}

export async function updateItem(ctx: AuthContext, by: Authed, kind: Kind, id: string, input: State & { version: number }, opts: { summary?: string; action?: string } = {}): Promise<ContentDetail> {
	const row = await findRow(ctx, kind, id);
	mayChange(by, kind, "update", row);
	mayEditLive(by, kind, row);
	const version = num(row.version) || 1;
	if (input.version !== version) throw new ApiError(409, "conflict", "Bài đã được người khác sửa sau khi bạn mở. Hãy tải bản mới nhất rồi sửa tiếp.", { version: String(version) });
	const current = await stateOf(ctx.db, kind, row, ctx.now());
	const { version: _ignored, ...changes } = input;
	void _ignored;
	const prepared = await prepare(ctx.db, kind, current, changes, row, id, opts.action === "restore");
	if (!prepared.changedKeys.length && !opts.summary) return { ...(await detailOf(ctx, by, kind, row)), bodyChanged: prepared.bodyChanged };

	const next: State = { ...prepared.next, status: current.status, publishAt: current.publishAt };
	const columns = new Map(prepared.columns);
	columns.set("search_text", prepared.searchText);
	columns.set("version", version + 1);
	columns.set("updated_at", iso(ctx));
	columns.set("updated_by", by.user.id);
	const names = [...columns.keys()];
	const before = Object.fromEntries(prepared.changedKeys.map((key) => [key, current[key]]));
	const after = Object.fromEntries(prepared.changedKeys.map((key) => [key, next[key]]));
	const statements: AdminStmt[] = [
		...(await baseRevision(ctx, kind, id, row, current, version)),
		ctx.db
			.prepare(`UPDATE ${kind.table} SET ${names.map((name) => `${name} = ?`).join(", ")} WHERE id = ? AND version = ? AND deleted_at IS NULL`)
			.bind(...names.map((name) => columns.get(name)), id, version),
		revisionStatement(ctx, by, kind.entityType, id, version + 1, snapshotOf(kind, next), opts.summary ?? summaryOf(kind, prepared.changedKeys)),
		...replaceUsageStatements(ctx, kind.entityType, id, mediaUses(kind, next, prepared.contentIds, prepared.coverIds)),
		...(prepared.changedKeys.includes("slug") || prepared.changedKeys.includes("section") ? redirectStatements(ctx, by, kind, current, next) : []),
		audit(ctx, by, { action: `${kind.entityType}.${opts.action ?? "update"}`, entityType: kind.entityType, entityId: id, before, after }),
	];
	if (kind.hasMilestones && prepared.changedKeys.includes("milestones")) statements.push(...milestoneStatements(ctx.db, id, next.milestones as { label: string; title: string; description: string }[]));
	try {
		await ctx.db.batch(statements);
	} catch (error) {
		mapWriteError(error, kind);
	}
	return { ...(await getItem(ctx, by, kind, id)), bodyChanged: prepared.bodyChanged };
}

/** A copy as a new draft: "<slug>-sao-chep", the title marked as a copy; views, album and schedule stay with the original. */
export async function duplicateItem(ctx: AuthContext, by: Authed, kind: Kind, id: string): Promise<ContentDetail> {
	const row = await findRow(ctx, kind, id);
	const state = await stateOf(ctx.db, kind, row);
	const input: State = Object.fromEntries(editableKeys(kind).map((key) => [key, state[key]]));
	input.title = `${String(state.title)} (bản sao)`.slice(0, 300);
	if (kind.table === "teaching_article") input.name = `${String(state.name || state.title)} (bản sao)`.slice(0, 300);
	input.albumId = null;
	if (kind.hasPinned) input.pinned = false;
	const base = `${String(state.slug).slice(0, 70)}-sao-chep`;
	input.slug = await freeSlug(ctx.db, kind, base, (state.section as string) ?? null, null);
	const copy = await createItem(ctx, by, kind, input, { summary: `Nhân bản từ "${String(state.title).slice(0, 120)}"`, action: "duplicate" });
	if (kind.hasRelated) {
		const related = await relatedOf(ctx.db, id);
		if (related.length) await writeRelated(ctx, by, copy.id, related.map((item) => ({ type: item.type, id: item.id })), false);
	}
	return getItem(ctx, by, kind, copy.id);
}

export type StatusAction = "submit" | "publish" | "hide" | "unpublish";

/**
 * The publication date an article gets when it goes out, or null when its date stays. A new article's date is the day it was made
 * (createItem); the day it first goes out replaces that, unless the editors set another by hand. An article that was ever on the site
 * (it is now, or one of its revisions was) keeps its date, a scheduled one that is given another time follows that time.
 */
async function firstPublicationDate(ctx: AuthContext, kind: Kind, id: string, row: Row, nextStatus: Status, publishAt: string | null): Promise<string | null> {
	if (!kind.fields.some((spec) => spec.key === "publishedDate")) return null;
	const date = text(row.published_date);
	const dayOf = (iso: string) => vietnamToday(new Date(iso));
	const goingOut = nextStatus === "scheduled" && publishAt ? dayOf(publishAt) : vietnamToday(ctx.now());
	const status = text(row.status);
	if (status === "scheduled" && text(row.publish_at)) return date === dayOf(text(row.publish_at)) && nextStatus === "scheduled" && goingOut !== date ? goingOut : null;
	if (status === "published") return null;
	const lived = await ctx.db
		.prepare("SELECT 1 AS yes FROM revision WHERE entity_type = ? AND entity_id = ? AND json_extract(snapshot, '$.status') IN ('published', 'scheduled') LIMIT 1")
		.bind(kind.entityType, id)
		.first();
	if (lived) return null;
	if (!date) return goingOut;
	// The day it was made: the row's own stamp, else its first revision's.
	let made = text(row.created_at);
	if (!made) made = text((await ctx.db.prepare("SELECT created_at FROM revision WHERE entity_type = ? AND entity_id = ? AND version = 1").bind(kind.entityType, id).first())?.created_at);
	return made && date === dayOf(made) && date !== goingOut ? goingOut : null;
}

export async function changeStatus(ctx: AuthContext, by: Authed, kind: Kind, id: string, action: StatusAction, input: { publishAt?: string | null; version?: number }): Promise<ContentDetail> {
	const row = await findRow(ctx, kind, id);
	const version = num(row.version) || 1;
	if (input.version !== undefined && input.version !== version) throw new ApiError(409, "conflict", "Bài đã được người khác sửa sau khi bạn mở. Hãy tải bản mới nhất.", { version: String(version) });
	const status = (text(row.status) || "draft") as Status;
	let nextStatus: Status;
	let publishAt: string | null = null;
	let summary: string;
	switch (action) {
		case "submit":
			mayChange(by, kind, "update", row);
			if (status !== "draft") throw new ApiError(409, "invalid_status", "Chỉ gửi duyệt được bài đang là bản nháp.");
			nextStatus = "pending";
			summary = "Gửi duyệt";
			break;
		case "publish": {
			if (input.publishAt) {
				const at = new Date(input.publishAt);
				if (Number.isNaN(at.getTime())) throw new ApiError(400, "invalid_input", "Thời điểm hẹn giờ không hợp lệ.", { publishAt: "Thời điểm hẹn giờ không hợp lệ." });
				if (at.getTime() > ctx.now().getTime() + 60_000) {
					// Scheduling takes the article off the site until the time: not for one that is on it.
					if (effectiveStatus(row, ctx.now()) === "published") {
						throw new ApiError(409, "already_live", "Bài đang hiển thị trên trang, hẹn giờ sẽ gỡ bài khỏi trang cho tới giờ hẹn. Hãy đưa bài về bản nháp trước nếu thật sự muốn hẹn giờ.");
					}
					publishAt = at.toISOString();
					nextStatus = "scheduled";
					summary = `Hẹn giờ đăng ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(at)}`;
					break;
				}
			}
			nextStatus = "published";
			summary = "Xuất bản";
			break;
		}
		case "hide":
			if (status === "hidden") throw new ApiError(409, "invalid_status", "Bài đang ở trạng thái Tạm ẩn.");
			nextStatus = "hidden";
			summary = "Tạm ẩn";
			break;
		case "unpublish":
			if (status === "draft") throw new ApiError(409, "invalid_status", "Bài đang là bản nháp.");
			nextStatus = "draft";
			summary = "Đưa về bản nháp";
			break;
		default:
			throw notFound("Thao tác");
	}
	const state = await stateOf(ctx.db, kind, row, ctx.now());
	const publishedDate = action === "publish" ? await firstPublicationDate(ctx, kind, id, row, nextStatus, publishAt) : null;
	const next = { ...state, status: nextStatus, publishAt, ...(publishedDate ? { publishedDate } : {}) };
	try {
		await ctx.db.batch([
			...(await baseRevision(ctx, kind, id, row, state, version)),
			ctx.db
				.prepare(`UPDATE ${kind.table} SET status = ?, publish_at = ?, ${publishedDate ? "published_date = ?, " : ""}version = ?, updated_at = ?, updated_by = ? WHERE id = ? AND version = ? AND deleted_at IS NULL`)
				.bind(nextStatus, publishAt, ...(publishedDate ? [publishedDate] : []), version + 1, iso(ctx), by.user.id, id, version),
			revisionStatement(ctx, by, kind.entityType, id, version + 1, snapshotOf(kind, next), summary),
			audit(ctx, by, {
				action: `${kind.entityType}.${action}`,
				entityType: kind.entityType,
				entityId: id,
				before: { status, publishAt: state.publishAt, ...(publishedDate ? { publishedDate: state.publishedDate } : {}) },
				after: { status: nextStatus, publishAt, ...(publishedDate ? { publishedDate } : {}) },
			}),
		]);
	} catch (error) {
		mapWriteError(error, kind);
	}
	return getItem(ctx, by, kind, id);
}

export async function trashItem(ctx: AuthContext, by: Authed, kind: Kind, id: string): Promise<void> {
	const row = await findRow(ctx, kind, id);
	mayChange(by, kind, "delete", row);
	await ctx.db.batch([trashStatement(ctx, by, kind.table, id), audit(ctx, by, { action: `${kind.entityType}.delete`, entityType: kind.entityType, entityId: id, before: { title: row.title, slug: row.slug, status: row.status } })]);
}

// ------------------------------------------------------------------ history

export async function revisionsOf(ctx: AuthContext, kind: Kind, id: string) {
	await findRow(ctx, kind, id);
	return listRevisions(ctx, kind.entityType, id);
}

export async function revisionOf(ctx: AuthContext, kind: Kind, id: string, version: number) {
	await findRow(ctx, kind, id);
	return getRevision(ctx, kind.entityType, id, version);
}

/** Two versions side by side; the editor's screen compares them word by word. */
export async function compareRevisions(ctx: AuthContext, kind: Kind, id: string, a: number, b: number) {
	await findRow(ctx, kind, id);
	const [left, right] = await Promise.all([getRevision(ctx, kind.entityType, id, a), getRevision(ctx, kind.entityType, id, b)]);
	const keys = editableKeys(kind);
	const changed = keys.filter((key) => !same((left.snapshot as State)?.[key], (right.snapshot as State)?.[key]));
	return { a: left, b: right, changed, labels: Object.fromEntries(changed.map((key) => [key, kind.fields.find((spec) => spec.key === key)?.label ?? SPECIAL_LABELS[key] ?? key])) };
}

/** Puts an old version's content back as a new version (the status stays as it is now). */
export async function restoreRevision(ctx: AuthContext, by: Authed, kind: Kind, id: string, version: number, expected?: number): Promise<ContentDetail> {
	const row = await findRow(ctx, kind, id);
	const old = await getRevision(ctx, kind.entityType, id, version);
	const snapshot = (old.snapshot ?? {}) as State;
	const input: State = {};
	for (const key of editableKeys(kind)) if (key in snapshot) input[key] = snapshot[key];
	return updateItem(ctx, by, kind, id, { ...input, version: expected ?? (num(row.version) || 1) }, { summary: `Khôi phục phiên bản ${version}`, action: "restore" });
}

// ------------------------------------------------------------------ related things (posts)

async function writeRelated(ctx: AuthContext, by: Authed, postId: string, items: { type: "post" | "statue"; id: string }[], check: boolean): Promise<void> {
	const unique = items.filter((item, index) => items.findIndex((other) => other.type === item.type && other.id === item.id) === index);
	if (check) {
		const fields: Record<string, string> = {};
		for (const [index, item] of unique.entries()) {
			if (item.type === "post" && item.id === postId) fields[`items.${index}`] = "Không chọn chính bài này.";
			const table = item.type === "post" ? "post" : "statue";
			if (!(await ctx.db.prepare(`SELECT 1 AS yes FROM ${table} WHERE id = ? AND deleted_at IS NULL`).bind(item.id).first())) fields[`items.${index}`] ??= item.type === "post" ? "Bài viết không tồn tại." : "Bảo tượng không tồn tại.";
		}
		if (Object.keys(fields).length) throw new ApiError(400, "invalid_input", "Có mục liên quan không hợp lệ.", fields);
	}
	const statements: AdminStmt[] = [ctx.db.prepare("DELETE FROM post_related WHERE post_id = ?").bind(postId)];
	for (let start = 0; start < unique.length; start += 25) {
		const chunk = unique.slice(start, start + 25);
		statements.push(
			ctx.db.prepare(`INSERT INTO post_related (post_id, target_type, target_id, position) VALUES ${chunk.map(() => "(?, ?, ?, ?)").join(", ")}`).bind(...chunk.flatMap((item, index) => [postId, item.type, item.id, start + index + 1])),
		);
	}
	statements.push(audit(ctx, by, { action: "post.related", entityType: "post", entityId: postId, after: { items: unique.map((item) => `${item.type}:${item.id}`) } }));
	await ctx.db.batch(statements);
}

export async function setRelated(ctx: AuthContext, by: Authed, postId: string, items: { type: "post" | "statue"; id: string }[]): Promise<RelatedItem[]> {
	const kind = KINDS.posts;
	const row = await findRow(ctx, kind, postId);
	mayChange(by, kind, "update", row);
	mayEditLive(by, kind, row);
	await writeRelated(ctx, by, postId, items, true);
	return relatedOf(ctx.db, postId);
}

/** Posts and statues to pick from for "related": by title, without accents. */
export async function relatedCandidates(ctx: AuthContext, q: string, excludeId: string | null): Promise<RelatedItem[]> {
	const words = searchWords(q);
	if (!words.length) return [];
	const postWhere = words.map(() => "p.search_text LIKE ?").join(" AND ");
	const { results: found } = await ctx.db
		.prepare(`SELECT p.id, p.title, p.section, p.slug FROM post p WHERE p.deleted_at IS NULL AND p.id != ? AND ${postWhere} ORDER BY p.published_date DESC LIMIT 10`)
		.bind(excludeId ?? "", ...words.map((word) => `%${word}%`))
		.all();
	// Rows the import left without search text (until fillSearchText runs) are matched on their title, without accents, here.
	const { results: unindexed } = await ctx.db
		.prepare("SELECT p.id, p.title, p.section, p.slug FROM post p WHERE p.deleted_at IS NULL AND p.id != ? AND p.search_text = '' ORDER BY p.published_date DESC LIMIT 1000")
		.bind(excludeId ?? "")
		.all();
	const byTitle = unindexed.filter((row) => words.every((word) => bare(text(row.title)).includes(word)));
	const posts = [...found, ...byTitle].slice(0, 10);
	const like = `%${q.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
	const { results: statues } = await ctx.db.prepare("SELECT id, name, slug FROM statue WHERE deleted_at IS NULL AND (name LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\') ORDER BY name LIMIT 10").bind(like, like).all();
	return [
		...posts.map((row) => ({ type: "post" as const, id: text(row.id), title: text(row.title), href: `/${text(row.section)}/${text(row.slug)}` })),
		...statues.map((row) => ({ type: "statue" as const, id: text(row.id), title: text(row.name), href: `/bao-tuong/${text(row.slug)}` })),
	];
}

// ------------------------------------------------------------------ preview

export async function previewLink(ctx: AuthContext, kind: Kind, id: string): Promise<{ url: string; expiresAt: string; version: number }> {
	const row = await findRow(ctx, kind, id);
	const version = num(row.version) || 1;
	const { token, expiresAt } = await signPreview({ kind: kind.name, id, version }, ctx.env.ADMIN_JWT_SECRET, ctx.now());
	return { url: `/quan-tri/xem-truoc/${kind.path}/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, expiresAt, version };
}

export type PreviewData = {
	kind: Kind;
	id: string;
	version: number;
	state: State;
	media: Record<string, MediaPreview>;
	category: { slug: string; name: string };
	legacyViews: number;
	related: RelatedItem[];
};

/** What the preview page shows: the version the token names (the row itself when it is still current, else that revision). */
export async function loadPreview(db: AdminDb, secret: string, now: Date, kind: Kind, id: string, token: string): Promise<PreviewData | null> {
	const claims = await verifyPreview(token, kind.name, id, secret, now);
	if (!claims) return null;
	const row = await db.prepare(`${SELECT_ONE(kind)} WHERE t.id = ? AND t.deleted_at IS NULL`).bind(id).first();
	if (!row) return null;
	let state: State;
	if ((num(row.version) || 1) === claims.version) state = await stateOf(db, kind, row, now);
	else {
		const revision = await db.prepare("SELECT snapshot FROM revision WHERE entity_type = ? AND entity_id = ? AND version = ?").bind(kind.entityType, id, claims.version).first();
		if (!revision) return null;
		state = parseJson(revision.snapshot, null) as State;
		if (!state) return null;
	}
	const ids = [...mediaUses(kind, state, mediaIdsIn(parseSafe(String(state.contentHtml ?? "")))).map((use) => use.mediaId)];
	let category = { slug: text(row.category_slug), name: text(row.category_name) };
	if (state.categoryId && state.categoryId !== text(row[kind.categoryColumn])) {
		const other = await db.prepare("SELECT slug, name FROM category WHERE id = ?").bind(state.categoryId).first();
		category = { slug: text(other?.slug), name: text(other?.name) };
	}
	return {
		kind,
		id,
		version: claims.version,
		state,
		media: await mediaPreviews(db, ids),
		category,
		legacyViews: num(row.legacy_views),
		related: kind.hasRelated ? await relatedOf(db, id) : [],
	};
}

// ------------------------------------------------------------------ search text of imported rows

/**
 * Fills `search_text` for up to `limit` rows that have none (the old admin's import left it empty), so the admin's
 * search finds them. Meant for the backfill script or a scheduled task; returns how many rows it filled.
 */
export async function fillSearchText(db: AdminDb, kind: Kind, limit = 200): Promise<number> {
	const { results } = await db
		.prepare(`SELECT id, title, subtitle, ${kind.summaryColumn} AS summary, ${kind.bodyColumn} AS body FROM ${kind.table} WHERE search_text = '' LIMIT ?`)
		.bind(limit)
		.all();
	const statements = results.map((item) => {
		const body = kind.bodyColumn === "body" ? text(item.body) : textOf(parseSafe(text(item.body)));
		return db.prepare(`UPDATE ${kind.table} SET search_text = ? WHERE id = ? AND search_text = ''`).bind(searchTextOf(text(item.title), text(item.subtitle), text(item.summary), body) || " ", text(item.id));
	});
	for (let start = 0; start < statements.length; start += 50) await db.batch(statements.slice(start, start + 50));
	return statements.length;
}

// ------------------------------------------------------------------ the trash

for (const kind of Object.values(KINDS)) {
	registerTrashable({
		type: kind.entityType,
		label: kind.label,
		table: kind.table,
		titleSql: "title",
		module: kind.module,
		hasCreatedBy: true,
		purge: (ctx, _by, id) => [
			ctx.db.prepare("DELETE FROM revision WHERE entity_type = ? AND entity_id = ?").bind(kind.entityType, id),
			ctx.db.prepare("DELETE FROM media_usage WHERE entity_type = ? AND entity_id = ?").bind(kind.entityType, id),
			...(kind.table === "post" ? [ctx.db.prepare("DELETE FROM post_related WHERE (target_type = 'post' AND target_id = ?) OR post_id = ?").bind(id, id)] : []),
			...(kind.table === "page" ? [ctx.db.prepare("DELETE FROM milestone WHERE page_id = ?").bind(id)] : []),
		],
	});
}

export { STATUS_LABELS };
