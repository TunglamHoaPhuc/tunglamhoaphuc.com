// /areas (docs/admin-architecture.md 7.7). "featured" comes before ":id".
import { z } from "zod";
import { registerRoutes } from "../http/api";
import { deleteArea, getArea, listAreas, setFeatured, updateArea, type AreaModel } from "./areas";

const str = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`);

const fields = {
	name: str(160).min(1, "Nhập tên khu vực."),
	subtitle: str(300),
	coverMediaId: z.string().trim().max(80).nullable(),
	coverPosition: str(30),
	mapX: z.number().min(0, "Từ 0 đến 100.").max(100, "Từ 0 đến 100.").nullable(),
	mapY: z.number().min(0, "Từ 0 đến 100.").max(100, "Từ 0 đến 100.").nullable(),
	intro: str(2000),
	contentHtml: z.string().max(100_000, "Nội dung quá dài."),
	visible: z.boolean(),
	position: z.number().int().min(0).max(100_000),
};
const updateSchema = z.object(fields).partial().extend({ version: z.number().int().min(1) });

registerRoutes(
	{ method: "GET", path: "areas", needs: { module: "areas", action: "view" }, handler: async (call) => ({ areas: await listAreas(call.ctx) }) },
	{
		method: "PUT",
		path: "areas/featured",
		needs: { module: "areas", action: "update" },
		handler: async (call) => ({ areas: await setFeatured(call.ctx, call.authed!, (await call.body(z.object({ ids: z.array(z.string().trim().min(1).max(80)).max(12, "Tối đa 12 khu vực nổi bật.") }))).ids) }),
	},
	{ method: "GET", path: "areas/:id", needs: { module: "areas", action: "view" }, handler: async (call) => getArea(call.ctx, call.params.id) },
	{
		method: "PATCH",
		path: "areas/:id",
		needs: { module: "areas", action: "update" },
		own: true,
		handler: async (call) => {
			const { version, ...patch } = await call.body(updateSchema);
			return updateArea(call.ctx, call.authed!, call.params.id, version, patch as Partial<AreaModel>);
		},
	},
	{
		method: "DELETE",
		path: "areas/:id",
		needs: { module: "areas", action: "delete" },
		own: true,
		handler: async (call) => {
			await deleteArea(call.ctx, call.authed!, call.params.id);
		},
	},
);
