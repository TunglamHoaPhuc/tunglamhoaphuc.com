// "Lời Thầy dạy" quotations: a short list the editors keep in order and can switch on or off one by one.
import { safeHref } from "../../libs/homeSettings";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type Row } from "../db";
import { notFound } from "../http/errors";
import { likeWord, type Page } from "../http/paging";
import { newId } from "../ids";
import { registerTrashable, trashStatement } from "../trash";
import { asBool, audit, diffOf, invalid, mayChange, stamp } from "./common";

export type QuoteModel = { text: string; author: string; source: string; sourceUrl: string; active: boolean };
export type QuoteItem = QuoteModel & { id: string; position: number; createdBy: string | null; updatedAt: string | null };

const itemOf = (row: Row): QuoteItem => ({
	id: text(row.id),
	text: text(row.text),
	author: text(row.author),
	source: text(row.source),
	sourceUrl: text(row.source_url),
	active: asBool(row.active),
	position: num(row.position),
	createdBy: text(row.created_by) || null,
	updatedAt: text(row.updated_at) || null,
});

export async function listQuotes(ctx: AuthContext, filter: { q?: string; active?: string }, page: Page): Promise<{ rows: QuoteItem[]; total: number }> {
	const where = ["deleted_at IS NULL"];
	const args: unknown[] = [];
	if (filter.q) {
		where.push("(text LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\' OR source LIKE ? ESCAPE '\\')");
		args.push(likeWord(filter.q), likeWord(filter.q), likeWord(filter.q));
	}
	if (filter.active === "1" || filter.active === "0") {
		where.push("active = ?");
		args.push(Number(filter.active));
	}
	const clause = where.join(" AND ");
	const total = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM quote WHERE ${clause}`).bind(...args).first();
	const { results } = await ctx.db.prepare(`SELECT * FROM quote WHERE ${clause} ORDER BY position, id LIMIT ? OFFSET ?`).bind(...args, page.pageSize, page.offset).all();
	return { rows: results.map(itemOf), total: num(total?.n) };
}

async function findRow(ctx: AuthContext, id: string): Promise<Row> {
	const row = await ctx.db.prepare("SELECT * FROM quote WHERE id = ? AND deleted_at IS NULL").bind(id).first();
	if (!row) throw notFound("Lời dạy");
	return row;
}

export async function getQuote(ctx: AuthContext, id: string): Promise<QuoteItem> {
	return itemOf(await findRow(ctx, id));
}

function check(model: QuoteModel): QuoteModel {
	const body = model.text.trim();
	if (!body) throw invalid("text", "Nhập nội dung lời dạy.");
	if (model.sourceUrl && !safeHref(model.sourceUrl.trim())) throw invalid("sourceUrl", "Đường dẫn phải bắt đầu bằng / hoặc https://.");
	return { ...model, text: body, author: model.author.trim(), source: model.source.trim(), sourceUrl: model.sourceUrl.trim() };
}

export async function createQuote(ctx: AuthContext, by: Authed, input: QuoteModel): Promise<QuoteItem> {
	const model = check(input);
	const id = newId("quote", ctx.now().getTime());
	const now = stamp(ctx);
	const last = await ctx.db.prepare("SELECT COALESCE(MAX(position), 0) AS p FROM quote WHERE deleted_at IS NULL").first();
	await ctx.db.batch([
		ctx.db
			.prepare("INSERT INTO quote (id, text, author, source, source_url, position, active, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
			.bind(id, model.text, model.author, model.source, model.sourceUrl, num(last?.p) + 1, model.active ? 1 : 0, by.user.id, by.user.id, now, now),
		audit(ctx, by, { action: "quote.create", entityType: "quote", entityId: id, after: model }),
	]);
	return getQuote(ctx, id);
}

export async function updateQuote(ctx: AuthContext, by: Authed, id: string, patch: Partial<QuoteModel>): Promise<QuoteItem> {
	const row = await findRow(ctx, id);
	mayChange(by, "quotes", "update", text(row.created_by) || null);
	const current = itemOf(row);
	const before: QuoteModel = { text: current.text, author: current.author, source: current.source, sourceUrl: current.sourceUrl, active: current.active };
	const model = check({ ...before, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) });
	await ctx.db.batch([
		ctx.db
			.prepare("UPDATE quote SET text = ?, author = ?, source = ?, source_url = ?, active = ?, updated_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
			.bind(model.text, model.author, model.source, model.sourceUrl, model.active ? 1 : 0, by.user.id, stamp(ctx), id),
		audit(ctx, by, { action: "quote.update", entityType: "quote", entityId: id, before: diffOf(before, model, "before"), after: diffOf(before, model, "after") }),
	]);
	return getQuote(ctx, id);
}

/** Puts the quotes in the order of `ids`; the live quotes not named keep their order after them. */
export async function reorderQuotes(ctx: AuthContext, by: Authed, ids: string[]): Promise<void> {
	if (new Set(ids).size !== ids.length) throw invalid("ids", "Có lời dạy được nêu hai lần.");
	const { results } = await ctx.db.prepare("SELECT id FROM quote WHERE deleted_at IS NULL ORDER BY position, id").all();
	const live = results.map((row) => text(row.id));
	for (const id of ids) if (!live.includes(id)) throw invalid("ids", "Có lời dạy không tồn tại.");
	const order = [...ids, ...live.filter((id) => !ids.includes(id))];
	await ctx.db.batch([
		...order.map((id, index) => ctx.db.prepare("UPDATE quote SET position = ? WHERE id = ?").bind(index + 1, id)),
		audit(ctx, by, { action: "quote.reorder", entityType: "quote", entityId: "order", before: { ids: live }, after: { ids: order } }),
	]);
}

export async function deleteQuote(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const row = await findRow(ctx, id);
	mayChange(by, "quotes", "delete", text(row.created_by) || null);
	await ctx.db.batch([trashStatement(ctx, by, "quote", id), audit(ctx, by, { action: "quote.trash", entityType: "quote", entityId: id, before: { text: row.text, author: row.author } })]);
}

registerTrashable({
	type: "quote",
	label: "Lời Thầy dạy",
	table: "quote",
	titleSql: "substr(text, 1, 80)",
	module: "quotes",
	hasCreatedBy: true,
	purge: () => [],
});
