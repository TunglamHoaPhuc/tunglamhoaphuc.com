// /quotes (docs/admin-architecture.md 7.7). "reorder" comes before ":id".
import { z } from "zod";
import { registerRoutes } from "../http/api";
import { listResponse, pageOf } from "../http/paging";
import { createQuote, deleteQuote, getQuote, listQuotes, reorderQuotes, updateQuote } from "./quotes";

const str = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`);
const fields = { text: str(2000).min(1, "Nhập nội dung lời dạy."), author: str(120), source: str(200), sourceUrl: str(300), active: z.boolean() };
const createSchema = z.object({ ...fields, author: fields.author.default(""), source: fields.source.default(""), sourceUrl: fields.sourceUrl.default(""), active: fields.active.default(true) });

registerRoutes(
	{
		method: "GET",
		path: "quotes",
		needs: { module: "quotes", action: "view" },
		handler: async (call) => {
			const page = pageOf(call.query, 50, 200);
			const { rows, total } = await listQuotes(call.ctx, { q: call.query.get("q") ?? undefined, active: call.query.get("active") ?? undefined }, page);
			return listResponse(rows, page, total);
		},
	},
	{
		method: "POST",
		path: "quotes/reorder",
		needs: { module: "quotes", action: "update" },
		handler: async (call) => {
			await reorderQuotes(call.ctx, call.authed!, (await call.body(z.object({ ids: z.array(z.string().trim().min(1).max(80)).max(500) }))).ids);
		},
	},
	{ method: "GET", path: "quotes/:id", needs: { module: "quotes", action: "view" }, handler: async (call) => getQuote(call.ctx, call.params.id) },
	{ method: "POST", path: "quotes", needs: { module: "quotes", action: "create" }, handler: async (call) => createQuote(call.ctx, call.authed!, await call.body(createSchema)) },
	{
		method: "PATCH",
		path: "quotes/:id",
		needs: { module: "quotes", action: "update" },
		handler: async (call) => updateQuote(call.ctx, call.authed!, call.params.id, await call.body(z.object(fields).partial())),
	},
	{
		method: "DELETE",
		path: "quotes/:id",
		needs: { module: "quotes", action: "delete" },
		handler: async (call) => {
			await deleteQuote(call.ctx, call.authed!, call.params.id);
		},
	},
);
