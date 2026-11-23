// /categories, /menus, /menu-items, /icons and /slug (docs/admin-architecture.md 7.3).
import { z } from "zod";
import { registerRoutes } from "../http/api";
import { ApiError, forbidden } from "../http/errors";
import { searchIcons } from "../icons/render";
import { sanitizeSvg, SvgRejected } from "../icons/sanitize";
import { can } from "../rbac/check";
import { createCategory, deleteCategory, getCategory, KINDS, listCategories, makeSlug, reorderCategories, updateCategory } from "./categories";
import { iconInput } from "./icon";
import { createItem, deleteItem, getMenu, saveTree, searchLinkTargets, updateItem } from "./menus";

const nullableId = z.string().max(120).nullable().optional();
const text = (max: number) => z.string().trim().max(max);

const categoryFields = {
	slug: text(90).optional(),
	description: z.string().max(1000).optional(),
	template: text(40).optional(),
	visible: z.boolean().optional(),
	colorToken: z.string().trim().max(40).regex(/^[a-z0-9-]*$/, "Mã màu chưa đúng.").nullable().optional(),
	parentId: nullableId,
	seoTitle: text(200).optional(),
	seoDescription: text(400).optional(),
	ogMediaId: nullableId,
	...iconInput,
};

const createCategoryBody = z.object({
	kind: z.enum(KINDS, { message: "Chọn loại chuyên mục." }),
	section: text(80).optional(),
	name: text(120).min(1, "Nhập tên chuyên mục."),
	...categoryFields,
});
const updateCategoryBody = z.object({ name: text(120).min(1, "Nhập tên chuyên mục.").optional(), ...categoryFields });

const pageRef = z.object({ type: z.enum(["page", "teaching_article", "post"]), id: z.string().min(1).max(120) });
const itemFields = {
	parentId: nullableId,
	linkType: z.enum(["category", "page", "url"], { message: "Chọn kiểu liên kết." }).optional(),
	categoryId: nullableId,
	pageRef: pageRef.optional(),
	href: z.string().max(600).optional(),
	openNewTab: z.boolean().optional(),
	visible: z.boolean().optional(),
	...iconInput,
};
const createItemBody = z.object({ label: text(120).min(1, "Nhập tên mục menu."), ...itemFields });
const updateItemBody = z.object({ label: text(120).min(1, "Nhập tên mục menu.").optional(), ...itemFields });

const treeBody = z.object({ items: z.array(z.object({ id: z.string().min(1).max(120), parentId: nullableId.transform((value) => value ?? null) })).max(1000) });

registerRoutes(
	// ---- categories
	{
		method: "GET",
		path: "categories",
		needs: { module: "categories", action: "view" },
		handler: async (call) => listCategories(call.ctx, { kind: call.query.get("kind") ?? undefined, section: call.query.get("section") ?? undefined }),
	},
	{
		// Registered before "categories/:id" so that "reorder" is not read as an id (the dispatcher takes the first match).
		method: "POST",
		path: "categories/reorder",
		needs: { module: "categories", action: "update" },
		handler: async (call) => {
			const body = await call.body(z.object({ items: z.array(z.object({ id: z.string().min(1).max(120), parentId: nullableId.transform((value) => value ?? null) })).min(1).max(1000) }));
			return reorderCategories(call.ctx, call.authed!, body.items);
		},
	},
	{ method: "GET", path: "categories/:id", needs: { module: "categories", action: "view" }, handler: async (call) => getCategory(call.ctx, call.params.id) },
	{
		method: "POST",
		path: "categories",
		needs: { module: "categories", action: "create" },
		handler: async (call) => createCategory(call.ctx, call.authed!, await call.body(createCategoryBody)),
	},
	{
		method: "PATCH",
		path: "categories/:id",
		needs: { module: "categories", action: "update" },
		handler: async (call) => updateCategory(call.ctx, call.authed!, call.params.id, await call.body(updateCategoryBody)),
	},
	{
		method: "DELETE",
		path: "categories/:id",
		needs: { module: "categories", action: "delete" },
		handler: async (call) => {
			await deleteCategory(call.ctx, call.authed!, call.params.id);
		},
	},

	// ---- menus
	{ method: "GET", path: "menus/:menuId", needs: { module: "menus", action: "view" }, handler: async (call) => getMenu(call.ctx, call.params.menuId) },
	{
		method: "POST",
		path: "menus/:menuId/items",
		needs: { module: "menus", action: "create" },
		handler: async (call) => createItem(call.ctx, call.authed!, call.params.menuId, await call.body(createItemBody)),
	},
	{
		method: "PUT",
		path: "menus/:menuId/tree",
		needs: { module: "menus", action: "update" },
		handler: async (call) => saveTree(call.ctx, call.authed!, call.params.menuId, (await call.body(treeBody)).items),
	},
	{
		method: "PATCH",
		path: "menu-items/:id",
		needs: { module: "menus", action: "update" },
		handler: async (call) => updateItem(call.ctx, call.authed!, call.params.id, await call.body(updateItemBody)),
	},
	{
		method: "DELETE",
		path: "menu-items/:id",
		needs: { module: "menus", action: "delete" },
		handler: async (call) => deleteItem(call.ctx, call.authed!, call.params.id),
	},
	{
		method: "GET",
		path: "link-targets",
		needs: { module: "menus", action: "view" },
		handler: async (call) => searchLinkTargets(call.ctx, call.query.get("type") ?? "page", call.query.get("q") ?? ""),
	},

	// ---- icons
	{
		method: "GET",
		path: "icons",
		needs: "session",
		handler: async (call) => searchIcons(call.query.get("q") ?? "", Math.min(200, Math.max(1, Number(call.query.get("limit")) || 60))),
	},
	{
		method: "POST",
		path: "icons/sanitize-svg",
		needs: "session",
		handler: async (call) => {
			const permissions = call.authed!.permissions;
			if (!can(permissions, "menus", "update") && !can(permissions, "categories", "update")) throw forbidden();
			const { svg } = await call.body(z.object({ svg: z.string().max(400_000, "SVG lớn hơn 50 KB.") }));
			try {
				return { svg: sanitizeSvg(svg) };
			} catch (error) {
				if (error instanceof SvgRejected) throw new ApiError(400, "invalid_svg", error.message, { svg: error.message });
				throw error;
			}
		},
	},

	// ---- slugs
	{
		method: "GET",
		path: "slug",
		needs: "session",
		handler: async (call) =>
			makeSlug(call.ctx, {
				text: call.query.get("text") ?? "",
				type: call.query.get("type") ?? "category",
				section: call.query.get("section") ?? undefined,
				kind: call.query.get("kind") ?? undefined,
				excludeId: call.query.get("excludeId") ?? undefined,
			}),
	},
);
