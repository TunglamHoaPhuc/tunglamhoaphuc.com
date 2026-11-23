// /events, /events/programs, /events/themes (docs/admin-architecture.md 7.7). Static paths come before ":id".
import { z } from "zod";
import { registerRoutes } from "../http/api";
import { listResponse, pageOf } from "../http/paging";
import { createEvent, deleteEvent, duplicateEvent, eventCategories, getEvent, listEvents, listPrograms, listThemes, lunarOf, nextHomeEvent, REGISTRATION, updateEvent, updateProgram, updateTheme, type EventModel } from "./events";

const str = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`);
const mediaId = z.string().trim().max(80).nullable();
const id = z.string().trim().max(80);

const fields = {
	title: str(160).min(1, "Nhập tiêu đề."),
	slug: str(160),
	subtitle: str(200),
	categoryId: id.nullable(),
	startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng năm-tháng-ngày."),
	endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng năm-tháng-ngày."),
	times: z.array(z.object({ label: str(60), time: str(40) })).max(12, "Tối đa 12 mốc giờ."),
	location: str(200),
	description: str(8000),
	notes: str(4000),
	imageMediaId: mediaId,
	imagePosition: str(30),
	video: z.object({ url: str(300) }).nullable(),
	linkedPostId: id.nullable(),
	registrationStatus: z.enum(REGISTRATION),
	status: z.enum(["draft", "published", "hidden"]),
	lunarManual: z.boolean(),
	lunar: z.object({ day: z.number().int(), month: z.number().int(), year: z.number().int(), leap: z.boolean() }).nullable(),
};

const createSchema = z.object({
	...fields,
	slug: fields.slug.default(""),
	subtitle: fields.subtitle.default(""),
	categoryId: fields.categoryId.default(null),
	endDate: fields.endDate.optional(),
	times: fields.times.default([]),
	location: fields.location.default(""),
	description: fields.description.default(""),
	notes: fields.notes.default(""),
	imageMediaId: mediaId.default(null),
	imagePosition: fields.imagePosition.default("center 50%"),
	video: fields.video.default(null),
	linkedPostId: fields.linkedPostId.default(null),
	registrationStatus: fields.registrationStatus.default("closed"),
	status: fields.status.default("draft"),
	lunarManual: fields.lunarManual.default(false),
	lunar: fields.lunar.default(null),
});

const updateSchema = z.object(fields).partial().extend({ version: z.number().int().min(1) });

const programSchema = z.object({
	title: str(160).min(1),
	subtitle: str(200),
	summary: str(2000),
	time: str(80),
	duration: str(80),
	location: str(200),
	imageMediaId: mediaId,
	imagePosition: str(30),
	position: z.number().int().min(0).max(1000),
}).partial();

const themeSchema = z.object({
	title: str(160),
	posterMediaId: mediaId,
	lines: z.array(str(300)).max(16, "Tối đa 16 dòng."),
	author: str(120),
}).partial();

registerRoutes(
	{
		method: "GET",
		path: "events",
		needs: { module: "events", action: "view" },
		handler: async (call) => {
			const page = pageOf(call.query, 50, 200);
			const { rows, total } = await listEvents(
				call.ctx,
				{
					month: call.query.get("month") ?? undefined,
					from: call.query.get("from") ?? undefined,
					to: call.query.get("to") ?? undefined,
					category: call.query.get("category") ?? undefined,
					status: call.query.get("status") ?? undefined,
					q: call.query.get("q") ?? undefined,
				},
				page,
			);
			return listResponse(rows, page, total);
		},
	},
	{ method: "GET", path: "events/categories", needs: { module: "events", action: "view" }, handler: async (call) => ({ categories: await eventCategories(call.ctx) }) },
	{ method: "GET", path: "events/lunar", needs: { module: "events", action: "view" }, handler: async (call) => lunarOf(call.query.get("date") ?? "") },
	{ method: "GET", path: "events/next", needs: { module: "events", action: "view" }, handler: async (call) => ({ event: await nextHomeEvent(call.ctx) }) },
	{ method: "GET", path: "events/programs", needs: { module: "events", action: "view" }, handler: async (call) => ({ programs: await listPrograms(call.ctx) }) },
	{
		method: "PATCH",
		path: "events/programs/:id",
		needs: { module: "events", action: "update" },
		handler: async (call) => ({ programs: await updateProgram(call.ctx, call.authed!, call.params.id, await call.body(programSchema)) }),
	},
	{ method: "GET", path: "events/themes", needs: { module: "events", action: "view" }, handler: async (call) => ({ themes: await listThemes(call.ctx) }) },
	{
		method: "PUT",
		path: "events/themes/:month",
		needs: { module: "events", action: "update" },
		handler: async (call) => updateTheme(call.ctx, call.authed!, Number(call.params.month), await call.body(themeSchema)),
	},
	{ method: "GET", path: "events/:id", needs: { module: "events", action: "view" }, handler: async (call) => getEvent(call.ctx, call.params.id) },
	{
		method: "POST",
		path: "events",
		needs: { module: "events", action: "create" },
		handler: async (call) => {
			const input = await call.body(createSchema);
			return createEvent(call.ctx, call.authed!, { ...input, endDate: input.endDate ?? input.startDate } as EventModel);
		},
	},
	{
		method: "PATCH",
		path: "events/:id",
		needs: { module: "events", action: "update" },
		own: true,
		handler: async (call) => {
			const { version, ...patch } = await call.body(updateSchema);
			return updateEvent(call.ctx, call.authed!, call.params.id, version, patch as Partial<EventModel>);
		},
	},
	{ method: "POST", path: "events/:id/duplicate", needs: { module: "events", action: "create" }, handler: async (call) => duplicateEvent(call.ctx, call.authed!, call.params.id) },
	{
		method: "DELETE",
		path: "events/:id",
		needs: { module: "events", action: "delete" },
		own: true,
		handler: async (call) => {
			await deleteEvent(call.ctx, call.authed!, call.params.id);
		},
	},
);
