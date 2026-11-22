// /posts, /teachings and /pages (docs/admin-architecture.md 7.4): the same endpoints for the three kinds.
import { z } from "zod";
import { registerRoutes, type Call, type RouteSpec } from "../http/api";
import { ApiError, notFound } from "../http/errors";
import { listResponse, pageOf } from "../http/paging";
import { text } from "../db";
import { safeHref } from "./html";
import { KINDS, MILESTONES, SECTIONS, STATUSES, type FieldSpec, type Kind } from "./kinds";
import {
	changeStatus, checkSlug, compareRevisions, countByStatus, createItem, duplicateItem, getItem, listItems, previewLink, relatedCandidates, restoreRevision, revisionOf, revisionsOf, setRelated,
	trashItem, updateItem, type ListFilter, type StatusAction,
} from "./service";

const MAX_HTML = 1_000_000;
const MAX_DOC = 1_000_000;

/** The editor's document (TipTap JSON): an object of type "doc", at most about 1 MB. */
const DOCUMENT = z
	.record(z.string(), z.unknown())
	.refine((doc) => doc.type === "doc", "Tài liệu soạn thảo không hợp lệ.")
	.refine((doc) => JSON.stringify(doc).length <= MAX_DOC, "Bài quá dài (hơn 1 MB). Hãy chia nhỏ bài.");

const blankToNull = (value: unknown) => (typeof value === "string" && !value.trim() ? null : value);

function fieldSchema(kind: Kind, spec: FieldSpec): z.ZodType {
	const tooLong = `Tối đa ${spec.max ?? 0} ký tự.`;
	switch (spec.type) {
		case "text":
			return z.string().max(spec.max ?? 1000, tooLong);
		case "nullableText":
			return z.string().max(spec.max ?? 1000, tooLong).nullable();
		case "date":
			return kind.name === "posts" ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày dạng YYYY-MM-DD.") : z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Ngày dạng YYYY-MM-DD.");
		case "media":
		case "album":
			return z.preprocess(blankToNull, z.string().max(120).nullable());
		case "position":
			return z.string().trim().regex(/^[a-z0-9.%\s-]{1,40}$/i, "Vị trí ảnh không hợp lệ (ví dụ: center 50%).");
		case "bool":
			return z.boolean();
		case "int":
			return z.number().int().min(-100_000).max(100_000);
		case "href":
			return z.preprocess(blankToNull, z.string().max(500).refine((value) => safeHref(value) !== null, "Liên kết phải là https, mailto hoặc đường dẫn trong trang.").nullable());
		case "json":
			return spec.schema ?? z.unknown();
	}
}

function inputSchema(kind: Kind, mode: "create" | "update") {
	const shape: Record<string, z.ZodType> = {};
	for (const spec of kind.fields) shape[spec.key] = fieldSchema(kind, spec).optional();
	if (mode === "create") shape.title = z.string().trim().min(1, "Nhập tiêu đề.").max(300, "Tối đa 300 ký tự.");
	shape.slug = z.string().max(200).optional();
	if (kind.hasSection) shape.section = z.string().max(80).optional();
	shape.categoryId = z.preprocess(blankToNull, z.string().max(200).nullable()).optional();
	shape.contentHtml = z.string().max(MAX_HTML, "Bài quá dài (hơn 1 MB). Hãy chia nhỏ bài.").optional();
	shape.contentJson = DOCUMENT.nullable().optional();
	if (kind.hasExtra) shape.extra = z.record(z.string(), z.unknown()).optional();
	if (kind.hasMilestones) shape.milestones = MILESTONES.optional();
	if (mode === "update") shape.version = z.number({ error: "Thiếu số phiên bản." }).int().min(1);
	return z.object(shape);
}

/** A body that may be left out (the status buttons send nothing or `{}`). */
async function optionalBody<S extends z.ZodType>(call: Call, schema: S): Promise<z.infer<S>> {
	if (/^application\/json\b/i.test(call.request.headers.get("content-type") ?? "")) return call.body(schema);
	return schema.parse({});
}

const versionParam = (value: string) => {
	const version = Number(value);
	if (!Number.isInteger(version) || version < 1) throw notFound("Phiên bản");
	return version;
};

function filterOf(call: Call): ListFilter {
	const get = (name: string) => call.query.get(name)?.trim() || undefined;
	const status = get("status");
	if (status && !(STATUSES as readonly string[]).includes(status)) throw new ApiError(400, "invalid_input", "Trạng thái không hợp lệ.", { status: "Trạng thái không hợp lệ." });
	return { section: get("section"), categoryId: get("categoryId"), authorId: get("authorId"), status, from: get("from"), to: get("to"), pinned: get("pinned"), q: get("q")?.slice(0, 200), sort: get("sort") };
}

function routesOf(kind: Kind): RouteSpec[] {
	const base = kind.name;
	const needs = (action: "view" | "create" | "update" | "delete" | "publish") => ({ module: kind.module, action });
	const createSchema = inputSchema(kind, "create");
	const updateSchema = inputSchema(kind, "update");
	const status = (action: StatusAction): RouteSpec => ({
		method: "POST",
		path: `${base}/:id/${action}`,
		needs: needs(action === "submit" ? "update" : "publish"),
		own: action === "submit", // submit checks the owner (changeStatus); publish, hide and unpublish need scope "all"
		handler: async (call) => {
			const body = await optionalBody(call, z.object({ version: z.number().int().min(1).optional(), publishAt: z.string().max(40).nullable().optional() }));
			return changeStatus(call.ctx, call.authed!, kind, call.params.id, action, body);
		},
	});

	return [
		{
			method: "GET",
			path: base,
			needs: needs("view"),
			handler: async (call) => {
				const page = pageOf(call.query, 20, 100);
				const { rows, total } = await listItems(call.ctx, call.authed!, kind, filterOf(call), page);
				return listResponse(rows, page, total);
			},
		},
		{ method: "GET", path: `${base}/counts`, needs: needs("view"), handler: async (call) => countByStatus(call.ctx, kind, { ...filterOf(call), status: undefined }) },
		{
			method: "GET",
			path: `${base}/options`,
			needs: needs("view"),
			handler: async (call) => {
				const { results: categories } = await call.ctx.db
					.prepare("SELECT id, name, slug, section FROM category WHERE kind = ? AND deleted_at IS NULL ORDER BY section, position, name")
					.bind(kind.categoryKind)
					.all();
				const { results: authors } = await call.ctx.db
					.prepare(`SELECT DISTINCT u.id, u.name FROM user u JOIN ${kind.table} t ON t.created_by = u.id WHERE t.deleted_at IS NULL ORDER BY u.name`)
					.all();
				return {
					sections: kind.hasSection ? SECTIONS : [],
					categories: categories.map((row) => ({ id: text(row.id), name: text(row.name), slug: text(row.slug), section: text(row.section) })),
					authors: authors.map((row) => ({ id: text(row.id), name: text(row.name) })),
				};
			},
		},
		{
			method: "GET",
			path: `${base}/slug-check`,
			needs: needs("view"),
			handler: async (call) =>
				checkSlug(call.ctx, kind, {
					slug: call.query.get("slug") ?? undefined,
					text: call.query.get("text") ?? undefined,
					section: call.query.get("section") ?? undefined,
					excludeId: call.query.get("excludeId") ?? undefined,
				}),
		},
		...(kind.hasRelated
			? [
					{
						method: "GET",
						path: `${base}/related-candidates`,
						needs: needs("view"),
						handler: async (call) => relatedCandidates(call.ctx, (call.query.get("q") ?? "").slice(0, 200), call.query.get("excludeId")),
					} satisfies RouteSpec,
				]
			: []),
		{ method: "POST", path: base, needs: needs("create"), handler: async (call) => createItem(call.ctx, call.authed!, kind, await call.body(createSchema)) },
		{ method: "GET", path: `${base}/:id`, needs: needs("view"), handler: async (call) => getItem(call.ctx, call.authed!, kind, call.params.id) },
		{
			method: "PATCH",
			path: `${base}/:id`,
			needs: needs("update"),
			own: true,
			handler: async (call) => {
				const body = (await call.body(updateSchema)) as Record<string, unknown> & { version: number };
				return updateItem(call.ctx, call.authed!, kind, call.params.id, body);
			},
		},
		{
			method: "DELETE",
			path: `${base}/:id`,
			needs: needs("delete"),
			own: true,
			handler: async (call) => {
				await trashItem(call.ctx, call.authed!, kind, call.params.id);
			},
		},
		{ method: "POST", path: `${base}/:id/duplicate`, needs: needs("create"), handler: async (call) => duplicateItem(call.ctx, call.authed!, kind, call.params.id) },
		status("submit"),
		status("publish"),
		status("hide"),
		status("unpublish"),
		{ method: "GET", path: `${base}/:id/revisions`, needs: needs("view"), handler: async (call) => revisionsOf(call.ctx, kind, call.params.id) },
		{ method: "GET", path: `${base}/:id/revisions/:version`, needs: needs("view"), handler: async (call) => revisionOf(call.ctx, kind, call.params.id, versionParam(call.params.version)) },
		{
			method: "GET",
			path: `${base}/:id/revisions/:a/diff/:b`,
			needs: needs("view"),
			handler: async (call) => compareRevisions(call.ctx, kind, call.params.id, versionParam(call.params.a), versionParam(call.params.b)),
		},
		{
			method: "POST",
			path: `${base}/:id/revisions/:version/restore`,
			needs: needs("update"),
			own: true,
			handler: async (call) => {
				const body = await optionalBody(call, z.object({ version: z.number().int().min(1).optional() }));
				return restoreRevision(call.ctx, call.authed!, kind, call.params.id, versionParam(call.params.version), body.version);
			},
		},
		{ method: "POST", path: `${base}/:id/preview-token`, needs: needs("update"), own: true, handler: async (call) => previewLink(call.ctx, call.authed!, kind, call.params.id) },
		...(kind.hasRelated
			? [
					{
						method: "PUT",
						path: `${base}/:id/related`,
						needs: needs("update"),
						own: true,
						handler: async (call) => {
							const body = await call.body(z.object({ items: z.array(z.object({ type: z.enum(["post", "statue"]), id: z.string().min(1).max(120) })).max(20, "Tối đa 20 mục liên quan.") }));
							return setRelated(call.ctx, call.authed!, call.params.id, body.items);
						},
					} satisfies RouteSpec,
				]
			: []),
	];
}

registerRoutes(...routesOf(KINDS.posts), ...routesOf(KINDS.teachings), ...routesOf(KINDS.pages));
