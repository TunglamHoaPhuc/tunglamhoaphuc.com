// The dashboard: one answer made of blocks, each present only when the person may view the module it comes from.
import type { AuthContext, Authed } from "../auth/service";
import { num, text } from "../db";
import { mediaStats } from "../media/service";
import { can } from "../rbac/check";
import { vietnamParts } from "./common";

const STATUSES = ["draft", "pending", "published", "scheduled", "hidden"] as const;
const DAYS = 30;

export type Dashboard = {
	posts?: { byStatus: Record<string, number>; total: number; pending: { id: string; title: string; author: string; createdBy: string | null; date: string; link: string }[] };
	events?: { id: string; slug: string; title: string; startDate: string; endDate: string; location: string }[];
	activity?: { days: { date: string; count: number }[]; total: number };
	media?: Awaited<ReturnType<typeof mediaStats>>;
	users?: { total: number; locked: number };
};

export async function dashboard(ctx: AuthContext, by: Authed): Promise<Dashboard> {
	const out: Dashboard = {};
	const now = ctx.now();
	const { date: today } = vietnamParts(now);
	// Only the post counts can honour "view own" (below); every other panel needs scope all, so a stored `:own` there shows nothing.
	const who = { userId: by.user.id, anyOwner: true };

	if (can(by.permissions, "posts", "view", who)) {
		// With "own" rights only the person's own posts are counted and listed (new roles cannot be given posts.view:own any more; old rows are still read safely).
		const own = by.permissions.get("posts.view") === "own";
		const scope = own ? " AND created_by = ?" : "";
		const args = own ? [by.user.id] : [];
		const counts = await ctx.db.prepare(`SELECT status, COUNT(*) AS n FROM post WHERE deleted_at IS NULL${scope} GROUP BY status`).bind(...args).all();
		const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<string, number>;
		for (const row of counts.results) byStatus[text(row.status)] = num(row.n);
		const pending = await ctx.db
			.prepare(`SELECT id, title, author, created_by, published_date, updated_at FROM post WHERE deleted_at IS NULL AND status = 'pending'${scope} ORDER BY updated_at DESC, id LIMIT 10`)
			.bind(...args)
			.all();
		out.posts = {
			byStatus,
			total: Object.values(byStatus).reduce((a, b) => a + b, 0),
			pending: pending.results.map((row) => ({
				id: text(row.id),
				title: text(row.title),
				author: text(row.author),
				createdBy: text(row.created_by) || null,
				date: text(row.published_date),
				link: `/quan-tri/bai-viet/${encodeURIComponent(text(row.id))}`,
			})),
		};
	}

	if (can(by.permissions, "events", "view")) {
		const { results } = await ctx.db
			.prepare("SELECT id, slug, title, start_date, end_date, location FROM calendar_event WHERE deleted_at IS NULL AND status = 'published' AND end_date >= ? ORDER BY start_date, position LIMIT 5")
			.bind(today)
			.all();
		out.events = results.map((row) => ({ id: text(row.id), slug: text(row.slug), title: text(row.title), startDate: text(row.start_date), endDate: text(row.end_date), location: text(row.location) }));
	}

	if (can(by.permissions, "audit", "view")) {
		// Thirty days of Vietnam time, today last; days without activity count zero.
		const since = new Date(now.getTime() - (DAYS - 1) * 24 * 3600_000);
		const first = vietnamParts(since).date;
		const { results } = await ctx.db
			.prepare("SELECT date(created_at, '+7 hours') AS day, COUNT(*) AS n FROM audit_log WHERE created_at >= ? GROUP BY day")
			.bind(new Date(`${first}T00:00:00+07:00`).toISOString())
			.all();
		const counts = new Map(results.map((row) => [text(row.day), num(row.n)]));
		const days = Array.from({ length: DAYS }, (_, i) => {
			const date = vietnamParts(new Date(since.getTime() + i * 24 * 3600_000)).date;
			return { date, count: counts.get(date) ?? 0 };
		});
		out.activity = { days, total: days.reduce((sum, day) => sum + day.count, 0) };
	}

	if (can(by.permissions, "media", "view")) out.media = await mediaStats(ctx);

	if (can(by.permissions, "users", "view")) {
		const row = await ctx.db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(locked_at IS NOT NULL), 0) AS locked FROM user WHERE deleted_at IS NULL").first();
		out.users = { total: num(row?.total), locked: num(row?.locked) };
	}
	return out;
}
