// The redirect table (`redirect`): addresses the site no longer has and where they lead. The rules are in src/libs/redirects.ts.
// A row's id in the API is its `from_path`; because it holds slashes, the pages send it percent-encoded twice, and `fromId`
// accepts it either way.
import { z } from "zod";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type AdminStmt, type Row } from "../db";
import { ApiError, notFound } from "../http/errors";
import { likeWord, type Page } from "../http/paging";
import { checkFrom, checkTo, makesLoop, MAX_HOPS, pathOf } from "../../libs/redirects";
import { audit, invalid, isUniqueError, stamp } from "./common";

export type RedirectRow = { from: string; to: string; code: 301 | 302; note: string; hits: number; active: boolean; createdBy: string | null; createdAt: string | null };

const toRow = (row: Row): RedirectRow => ({
	from: text(row.from_path),
	to: text(row.to_path),
	code: num(row.code) === 302 ? 302 : 301,
	note: text(row.note),
	hits: num(row.hits),
	active: num(row.active) === 1,
	createdBy: text(row.created_by) || null,
	createdAt: text(row.created_at) || null,
});

/** The row's address from the id in the URL (decoded once by the dispatcher; a second layer is peeled here). */
export function fromId(id: string): string {
	if (id.startsWith("/")) return id;
	try {
		const once = decodeURIComponent(id);
		return once;
	} catch {
		return id;
	}
}

export const redirectInput = z.object({
	from: z.string().max(400, "Đường dẫn cũ quá dài."),
	to: z.string().max(600, "Đường dẫn mới quá dài."),
	code: z.union([z.literal(301), z.literal(302)]).default(301),
	note: z.string().trim().max(200, "Ghi chú tối đa 200 ký tự.").default(""),
	active: z.boolean().default(true),
});

/** A change of an existing row: only what is sent changes (no defaults here, or an unsent field would be reset). */
export const redirectPatch = z.object({
	to: z.string().max(600, "Đường dẫn mới quá dài.").optional(),
	code: z.union([z.literal(301), z.literal(302)]).optional(),
	note: z.string().trim().max(200, "Ghi chú tối đa 200 ký tự.").optional(),
	active: z.boolean().optional(),
});

// ------------------------------------------------------------------ chains

const CHUNK = 90;

/**
 * The active redirects reachable from `paths` by following their destinations, up to the hop limit: from -> to. A handful of
 * indexed queries however many rows are checked (a Worker may only make so many).
 */
async function chainsFrom(ctx: AuthContext, paths: string[]): Promise<Map<string, string>> {
	const known = new Map<string, string>();
	const asked = new Set<string>();
	let frontier = [...new Set(paths)];
	for (let hop = 0; hop <= MAX_HOPS && frontier.length; hop++) {
		const next = new Set<string>();
		for (let i = 0; i < frontier.length; i += CHUNK) {
			const slice = frontier.slice(i, i + CHUNK);
			slice.forEach((path) => asked.add(path));
			const { results } = await ctx.db.prepare(`SELECT from_path, to_path FROM redirect WHERE active = 1 AND from_path IN (${slice.map(() => "?").join(", ")})`).bind(...slice).all();
			for (const row of results) {
				known.set(text(row.from_path), text(row.to_path));
				const onward = pathOf(text(row.to_path));
				if (!asked.has(onward)) next.add(onward);
			}
		}
		frontier = [...next];
	}
	return known;
}

function destinationProblem(from: string, to: string, chains: Map<string, string>): Promise<boolean> {
	return makesLoop(from, to, async (path) => chains.get(path) ?? null);
}

const LOOP_MESSAGE = "Chuyển hướng này tạo thành vòng lặp (đường dẫn mới dẫn ngược về đường dẫn cũ).";

// ------------------------------------------------------------------ reading

export async function listRedirects(ctx: AuthContext, filter: { q?: string; active?: string }, page: Page): Promise<{ rows: RedirectRow[]; total: number }> {
	const where: string[] = [];
	const args: unknown[] = [];
	if (filter.q) {
		where.push("(from_path LIKE ? ESCAPE '\\' OR to_path LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')");
		args.push(likeWord(filter.q), likeWord(filter.q), likeWord(filter.q));
	}
	if (filter.active === "1" || filter.active === "0") {
		where.push("active = ?");
		args.push(Number(filter.active));
	}
	const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
	const total = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM redirect${clause}`).bind(...args).first();
	const { results } = await ctx.db.prepare(`SELECT * FROM redirect${clause} ORDER BY created_at DESC, from_path LIMIT ? OFFSET ?`).bind(...args, page.pageSize, page.offset).all();
	return { rows: results.map(toRow), total: num(total?.n) };
}

async function findRow(ctx: AuthContext, from: string): Promise<RedirectRow> {
	const row = await ctx.db.prepare("SELECT * FROM redirect WHERE from_path = ?").bind(from).first();
	if (!row) throw notFound("Chuyển hướng");
	return toRow(row);
}

export const getRedirect = (ctx: AuthContext, id: string) => findRow(ctx, fromId(id));

// ------------------------------------------------------------------ writing

export async function createRedirect(ctx: AuthContext, by: Authed, input: z.infer<typeof redirectInput>): Promise<RedirectRow> {
	const from = checkFrom(input.from);
	if (!from.ok) throw invalid("from", from.message);
	const to = checkTo(input.to);
	if (!to.ok) throw invalid("to", to.message);
	if (pathOf(to.value) === from.value) throw invalid("to", "Đường dẫn mới không được trùng đường dẫn cũ.");
	if (await destinationProblem(from.value, to.value, await chainsFrom(ctx, [pathOf(to.value)]))) throw invalid("to", LOOP_MESSAGE);
	try {
		await ctx.db.batch([
			ctx.db
				.prepare("INSERT INTO redirect (from_path, to_path, code, note, hits, active, created_by, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)")
				.bind(from.value, to.value, input.code, input.note, input.active ? 1 : 0, by.user.id, stamp(ctx)),
			audit(ctx, by, { action: "redirect.create", entityType: "redirect", entityId: from.value, after: { to: to.value, code: input.code, active: input.active } }),
		]);
	} catch (error) {
		if (isUniqueError(error)) throw new ApiError(409, "duplicate", "Đã có chuyển hướng cho đường dẫn cũ này.", { from: "Đã có chuyển hướng cho đường dẫn này." });
		throw error;
	}
	return findRow(ctx, from.value);
}

export async function updateRedirect(ctx: AuthContext, by: Authed, id: string, input: z.infer<typeof redirectPatch>): Promise<RedirectRow> {
	const old = await findRow(ctx, fromId(id));
	let to = old.to;
	if (input.to !== undefined) {
		const checked = checkTo(input.to);
		if (!checked.ok) throw invalid("to", checked.message);
		to = checked.value;
	}
	if (pathOf(to) === old.from) throw invalid("to", "Đường dẫn mới không được trùng đường dẫn cũ.");
	const active = input.active ?? old.active;
	if (active && (await destinationProblem(old.from, to, await chainsFrom(ctx, [pathOf(to)])))) throw invalid("to", LOOP_MESSAGE);
	const next = { to, code: input.code ?? old.code, note: input.note ?? old.note, active };
	await ctx.db.batch([
		ctx.db.prepare("UPDATE redirect SET to_path = ?, code = ?, note = ?, active = ? WHERE from_path = ?").bind(next.to, next.code, next.note, next.active ? 1 : 0, old.from),
		audit(ctx, by, { action: "redirect.update", entityType: "redirect", entityId: old.from, before: { to: old.to, code: old.code, active: old.active }, after: { to: next.to, code: next.code, active: next.active } }),
	]);
	return findRow(ctx, old.from);
}

export async function deleteRedirect(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const old = await findRow(ctx, fromId(id));
	await ctx.db.batch([
		ctx.db.prepare("DELETE FROM redirect WHERE from_path = ?").bind(old.from),
		audit(ctx, by, { action: "redirect.delete", entityType: "redirect", entityId: old.from, before: { to: old.to, code: old.code, hits: old.hits } }),
	]);
}

// ------------------------------------------------------------------ import

export const MAX_IMPORT_ROWS = 500;

export const importInput = z.object({
	rows: z
		.array(z.object({ from: z.string().max(400).default(""), to: z.string().max(600).default(""), code: z.union([z.number(), z.string()]).optional() }))
		.min(1, "Chưa có dòng nào để nhập.")
		.max(MAX_IMPORT_ROWS, `Mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} dòng.`),
});

export type ImportLine = { line: number; from: string; status: "created" | "skipped" | "error"; message: string };

/** Checks each row on its own and against the table and the rows accepted before it; adds the good ones in one batch. */
export async function importRedirects(ctx: AuthContext, by: Authed, rows: z.infer<typeof importInput>["rows"]): Promise<{ created: number; skipped: number; errors: number; report: ImportLine[] }> {
	const report: ImportLine[] = [];
	const parsed: { line: number; from: string; to: string; code: 301 | 302 }[] = [];
	const seen = new Set<string>();
	rows.forEach((row, index) => {
		const line = index + 1;
		const from = checkFrom(row.from);
		const to = checkTo(row.to);
		const code = row.code === undefined || row.code === "" ? 301 : Number(row.code);
		const shown = row.from.trim().slice(0, 120);
		if (!from.ok) return void report.push({ line, from: shown, status: "error", message: from.message });
		if (!to.ok) return void report.push({ line, from: shown, status: "error", message: to.message });
		if (code !== 301 && code !== 302) return void report.push({ line, from: shown, status: "error", message: "Mã chuyển hướng chỉ có thể là 301 hoặc 302." });
		if (pathOf(to.value) === from.value) return void report.push({ line, from: shown, status: "error", message: "Đường dẫn mới không được trùng đường dẫn cũ." });
		if (seen.has(from.value)) return void report.push({ line, from: from.value, status: "skipped", message: "Trùng với một dòng trước đó trong tệp." });
		seen.add(from.value);
		parsed.push({ line, from: from.value, to: to.value, code });
	});

	// Which of them exist already: skipped, never overwritten.
	const existing = new Set<string>();
	for (let i = 0; i < parsed.length; i += CHUNK) {
		const slice = parsed.slice(i, i + CHUNK).map((row) => row.from);
		const { results } = await ctx.db.prepare(`SELECT from_path FROM redirect WHERE from_path IN (${slice.map(() => "?").join(", ")})`).bind(...slice).all();
		results.forEach((row) => existing.add(text(row.from_path)));
	}
	const fresh = parsed.filter((row) => {
		if (!existing.has(row.from)) return true;
		report.push({ line: row.line, from: row.from, status: "skipped", message: "Đã có chuyển hướng cho đường dẫn này." });
		return false;
	});

	// Loops, against the table and against the rows of this file that were accepted before.
	const chains = await chainsFrom(ctx, fresh.map((row) => pathOf(row.to)));
	const accepted: typeof fresh = [];
	for (const row of fresh) {
		if (await destinationProblem(row.from, row.to, chains)) {
			report.push({ line: row.line, from: row.from, status: "error", message: LOOP_MESSAGE });
			continue;
		}
		chains.set(row.from, row.to);
		accepted.push(row);
	}

	if (accepted.length) {
		const now = stamp(ctx);
		const statements: AdminStmt[] = accepted.map((row) =>
			ctx.db.prepare("INSERT INTO redirect (from_path, to_path, code, note, hits, active, created_by, created_at) VALUES (?, ?, ?, '', 0, 1, ?, ?)").bind(row.from, row.to, row.code, by.user.id, now),
		);
		statements.push(audit(ctx, by, { action: "redirect.import", entityType: "redirect", entityId: "import", after: { created: accepted.length, rows: rows.length } }));
		try {
			await ctx.db.batch(statements);
		} catch (error) {
			if (isUniqueError(error)) throw new ApiError(409, "duplicate", "Có chuyển hướng vừa được thêm cùng lúc. Hãy nhập lại.");
			throw error;
		}
		accepted.forEach((row) => report.push({ line: row.line, from: row.from, status: "created", message: "Đã thêm." }));
	}
	report.sort((a, b) => a.line - b.line);
	return { created: accepted.length, skipped: report.filter((r) => r.status === "skipped").length, errors: report.filter((r) => r.status === "error").length, report };
}
