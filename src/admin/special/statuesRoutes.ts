// /statues (docs/admin-architecture.md 7.7). Static paths come before ":id".
import { z } from "zod";
import { registerRoutes } from "../http/api";
import { listResponse, pageOf } from "../http/paging";
import { createCluster, createStatue, deleteStatue, getStatue, listStatues, nextStatueCode, setStatueImages, setStatueRelated, setStatueVariations, statueOptions, updateStatue, type StatueCore } from "./statues";

const str = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`);
const id = z.string().trim().max(80);
const mediaId = z.string().trim().max(80).nullable();
const version = z.number().int().min(1);

const core = {
	code: str(20),
	slug: str(160),
	name: str(200).min(1, "Nhập tên bảo tượng."),
	subtitle: str(300),
	assemblyId: id.nullable(),
	clusterId: id.nullable(),
	areaId: id.nullable(),
	isMain: z.boolean(),
	imageMediaId: mediaId,
	imagePosition: str(30),
	editorialBoard: str(2000),
	specs: z.record(z.string().max(60), z.string().max(300)),
	quoteText: str(1000),
	quoteAuthor: str(200),
	body: z.string().max(100_000, "Bài quá dài."),
	status: z.enum(["draft", "published", "hidden"]),
	position: z.number().int().min(0).max(100_000),
};

const createSchema = z.object({
	name: core.name,
	code: core.code.default(""),
	slug: core.slug.default(""),
	subtitle: core.subtitle.default(""),
	assemblyId: core.assemblyId.default(null),
	clusterId: core.clusterId.default(null),
	areaId: core.areaId.default(null),
	isMain: core.isMain.default(false),
	imageMediaId: mediaId.default(null),
	imagePosition: core.imagePosition.default("center 50%"),
	editorialBoard: core.editorialBoard.default(""),
	specs: core.specs.default({}),
	quoteText: core.quoteText.default(""),
	quoteAuthor: core.quoteAuthor.default(""),
	body: core.body.default(""),
	status: core.status.default("draft"),
	position: core.position.default(0),
});

const updateSchema = z.object(core).partial().extend({ version });

const imagesSchema = z.object({
	version,
	images: z.array(z.object({ mediaId: id.min(1), label: str(60).default(""), imagePosition: str(30).default("center 50%") })).max(20, "Tối đa 20 ảnh."),
});
const relatedSchema = z.object({ version, related: z.array(id.min(1)).max(12, "Tối đa 12 bảo tượng liên quan.") });
const variationsSchema = z.object({
	version,
	variations: z
		.array(
			z.object({
				id: id.optional(),
				title: str(200).default(""),
				location: str(200).default(""),
				meaning: str(2000).default(""),
				imageMediaId: mediaId.default(null),
				imagePosition: str(30).default("center 50%"),
				artStatueId: id.nullable().default(null),
			}),
		)
		.max(30, "Tối đa 30 tác phẩm."),
});

registerRoutes(
	{
		method: "GET",
		path: "statues",
		needs: { module: "statues", action: "view" },
		handler: async (call) => {
			const page = pageOf(call.query, 30, 100);
			const { rows, total } = await listStatues(
				call.ctx,
				{ q: call.query.get("q") ?? undefined, assembly: call.query.get("assembly") ?? undefined, area: call.query.get("area") ?? undefined, main: call.query.get("main") ?? undefined, status: call.query.get("status") ?? undefined },
				page,
			);
			return listResponse(rows, page, total);
		},
	},
	{ method: "GET", path: "statues/next-code", needs: { module: "statues", action: "view" }, handler: async (call) => ({ code: await nextStatueCode(call.ctx) }) },
	{ method: "GET", path: "statues/options", needs: { module: "statues", action: "view" }, handler: async (call) => statueOptions(call.ctx) },
	{
		method: "POST",
		path: "statues/clusters",
		needs: { module: "statues", action: "create" },
		handler: async (call) => createCluster(call.ctx, call.authed!, await call.body(z.object({ name: str(120).min(1, "Nhập tên nhóm."), assemblyId: id.nullable().optional(), areaId: id.nullable().optional() }))),
	},
	{ method: "GET", path: "statues/:id", needs: { module: "statues", action: "view" }, handler: async (call) => getStatue(call.ctx, call.params.id) },
	{
		method: "POST",
		path: "statues",
		needs: { module: "statues", action: "create" },
		handler: async (call) => createStatue(call.ctx, call.authed!, { core: (await call.body(createSchema)) as StatueCore }),
	},
	{
		method: "PATCH",
		path: "statues/:id",
		needs: { module: "statues", action: "update" },
		handler: async (call) => {
			const { version: given, ...patch } = await call.body(updateSchema);
			return updateStatue(call.ctx, call.authed!, call.params.id, given, patch);
		},
	},
	{
		method: "PUT",
		path: "statues/:id/images",
		needs: { module: "statues", action: "update" },
		handler: async (call) => {
			const input = await call.body(imagesSchema);
			return setStatueImages(call.ctx, call.authed!, call.params.id, input.version, input.images);
		},
	},
	{
		method: "PUT",
		path: "statues/:id/related",
		needs: { module: "statues", action: "update" },
		handler: async (call) => {
			const input = await call.body(relatedSchema);
			return setStatueRelated(call.ctx, call.authed!, call.params.id, input.version, input.related);
		},
	},
	{
		method: "PUT",
		path: "statues/:id/variations",
		needs: { module: "statues", action: "update" },
		handler: async (call) => {
			const input = await call.body(variationsSchema);
			return setStatueVariations(call.ctx, call.authed!, call.params.id, input.version, input.variations);
		},
	},
	{
		method: "DELETE",
		path: "statues/:id",
		needs: { module: "statues", action: "delete" },
		handler: async (call) => {
			await deleteStatue(call.ctx, call.authed!, call.params.id);
		},
	},
);
