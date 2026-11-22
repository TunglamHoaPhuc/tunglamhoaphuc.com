// Calendar events, the regular programs and the month themes (docs/admin-architecture.md 7.7).
import { todayInVietnam } from "../../libs/calendar";
import { youtubeId } from "../../libs/homeSettings";
import { lunarDate } from "../../libs/lunar";
import { nextEvent } from "../../libs/nextEvent";
import type { AuthContext, Authed } from "../auth/service";
import { num, text, type Row } from "../db";
import { ApiError, notFound } from "../http/errors";
import { likeWord, type Page } from "../http/paging";
import { newId } from "../ids";
import { mediaPath, replaceUsageStatements } from "../media/service";
import { revisionStatement } from "../revision";
import { registerTrashable, trashStatement } from "../trash";
import { asBool, audit, checkMedia, checkStatusChange, conflictOf, diffOf, invalid, json, mayChange, mayChangeLive, slugFor, stamp, staleVersion, taken, type SimpleStatus } from "./common";

export const REGISTRATION = ["closed", "open", "full"] as const;
export type EventTime = { label: string; time: string };
export type Lunar = { day: number; month: number; year: number; leap: boolean };

export type EventModel = {
	title: string;
	slug: string;
	subtitle: string;
	categoryId: string | null;
	startDate: string;
	endDate: string;
	times: EventTime[];
	location: string;
	description: string;
	notes: string;
	imageMediaId: string | null;
	imagePosition: string;
	video: { url: string } | null;
	linkedPostId: string | null;
	registrationStatus: (typeof REGISTRATION)[number];
	status: SimpleStatus | "pending" | "scheduled";
	lunarManual: boolean;
	lunar: Lunar | null;
};

export type EventItem = Omit<EventModel, "video" | "lunar"> & {
	id: string;
	categoryName: string;
	categorySlug: string;
	imageUrl: string;
	video: { id: string; url: string } | null;
	lunar: (Lunar & { manual: boolean }) | null;
	version: number;
	createdBy: string | null;
	createdAt: string | null;
	updatedAt: string | null;
};

const SELECT = `SELECT e.*, c.name AS cat_name, c.slug AS cat_slug, m.r2_key AS img_key, m.url AS img_url
	FROM calendar_event e LEFT JOIN category c ON c.id = e.category_id LEFT JOIN media m ON m.id = e.image_media_id`;

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function toItem(row: Row): EventItem {
	const hasLunar = row.lunar_day != null && row.lunar_month != null && row.lunar_year != null;
	return {
		id: text(row.id),
		title: text(row.title),
		slug: text(row.slug),
		subtitle: text(row.subtitle),
		categoryId: text(row.category_id) || null,
		categoryName: text(row.cat_name),
		categorySlug: text(row.cat_slug),
		startDate: text(row.start_date),
		endDate: text(row.end_date),
		times: json<EventTime[]>(row.times, []),
		location: text(row.location),
		description: text(row.description),
		notes: text(row.notes),
		imageMediaId: text(row.image_media_id) || null,
		imageUrl: mediaPath(text(row.img_key) || null, text(row.img_url) || null),
		imagePosition: text(row.image_position) || "center 50%",
		video: json<{ id: string; url: string } | null>(row.video, null),
		linkedPostId: text(row.linked_post_id) || null,
		registrationStatus: (REGISTRATION as readonly string[]).includes(text(row.registration_status)) ? (text(row.registration_status) as EventModel["registrationStatus"]) : "closed",
		status: (text(row.status) || "published") as EventModel["status"],
		lunarManual: asBool(row.lunar_manual),
		lunar: hasLunar ? { day: num(row.lunar_day), month: num(row.lunar_month), year: num(row.lunar_year), leap: asBool(row.lunar_leap), manual: asBool(row.lunar_manual) } : null,
		version: num(row.version) || 1,
		createdBy: text(row.created_by) || null,
		createdAt: text(row.created_at) || null,
		updatedAt: text(row.updated_at) || null,
	};
}

/** The lunar date of a solar day, for the form. */
export function lunarOf(date: string): Lunar {
	if (!isDate(date)) throw invalid("date", "Ngày phải có dạng năm-tháng-ngày, ví dụ 2026-11-21.");
	return lunarDate(date);
}

// ------------------------------------------------------------------ reading

export type EventFilter = { month?: string; from?: string; to?: string; category?: string; status?: string; q?: string };

export async function listEvents(ctx: AuthContext, filter: EventFilter, page: Page): Promise<{ rows: EventItem[]; total: number }> {
	const where = ["e.deleted_at IS NULL"];
	const args: unknown[] = [];
	let { from, to } = filter;
	if (filter.month) {
		if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(filter.month)) throw invalid("month", "Tháng phải có dạng năm-tháng, ví dụ 2026-11.");
		from = `${filter.month}-01`;
		to = `${filter.month}-31`;
	}
	if (from) {
		where.push("e.end_date >= ?");
		args.push(from);
	}
	if (to) {
		where.push("e.start_date <= ?");
		args.push(to);
	}
	if (filter.category) {
		where.push("(e.category_id = ? OR c.slug = ?)");
		args.push(filter.category, filter.category);
	}
	if (filter.status) {
		where.push("e.status = ?");
		args.push(filter.status);
	}
	if (filter.q) {
		where.push("(e.title LIKE ? ESCAPE '\\' OR e.location LIKE ? ESCAPE '\\')");
		args.push(likeWord(filter.q), likeWord(filter.q));
	}
	const clause = where.join(" AND ");
	const total = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM calendar_event e LEFT JOIN category c ON c.id = e.category_id WHERE ${clause}`).bind(...args).first();
	const { results } = await ctx.db.prepare(`${SELECT} WHERE ${clause} ORDER BY e.start_date, e.end_date, e.position, e.id LIMIT ? OFFSET ?`).bind(...args, page.pageSize, page.offset).all();
	return { rows: results.map(toItem), total: num(total?.n) };
}

async function findRow(ctx: AuthContext, id: string): Promise<Row> {
	const row = await ctx.db.prepare(`${SELECT} WHERE e.id = ? AND e.deleted_at IS NULL`).bind(id).first();
	if (!row) throw notFound("Sự kiện");
	return row;
}

export async function getEvent(ctx: AuthContext, id: string): Promise<EventItem> {
	return toItem(await findRow(ctx, id));
}

/** The event the home page counts down to: the same rule as the public page (src/libs/nextEvent.ts), over published events. */
export async function nextHomeEvent(ctx: AuthContext): Promise<EventItem | null> {
	const { results } = await ctx.db.prepare(`${SELECT} WHERE e.deleted_at IS NULL AND e.status = 'published' ORDER BY e.start_date, e.end_date, e.position, e.id`).all();
	const items = results.map((row) => ({ ...toItem(row), start: text(row.start_date) }));
	return nextEvent(items, todayInVietnam(ctx.now())) ?? null;
}

export async function eventCategories(ctx: AuthContext): Promise<{ id: string; slug: string; name: string }[]> {
	const { results } = await ctx.db.prepare("SELECT id, slug, name FROM category WHERE kind = 'event' AND deleted_at IS NULL ORDER BY position, name").all();
	return results.map((row) => ({ id: text(row.id), slug: text(row.slug), name: text(row.name) }));
}

// ------------------------------------------------------------------ writing

const toModel = (item: EventItem): EventModel => ({
	title: item.title, slug: item.slug, subtitle: item.subtitle, categoryId: item.categoryId, startDate: item.startDate, endDate: item.endDate, times: item.times,
	location: item.location, description: item.description, notes: item.notes, imageMediaId: item.imageMediaId, imagePosition: item.imagePosition,
	video: item.video ? { url: item.video.url } : null, linkedPostId: item.linkedPostId, registrationStatus: item.registrationStatus, status: item.status,
	lunarManual: item.lunarManual, lunar: item.lunar ? { day: item.lunar.day, month: item.lunar.month, year: item.lunar.year, leap: item.lunar.leap } : null,
});

type Checked = { video: { id: string; url: string } | null; lunar: Lunar; slug: string };

async function validate(ctx: AuthContext, model: EventModel, exceptId?: string): Promise<Checked> {
	if (!isDate(model.startDate)) throw invalid("startDate", "Ngày bắt đầu chưa hợp lệ.");
	if (!isDate(model.endDate)) throw invalid("endDate", "Ngày kết thúc chưa hợp lệ.");
	if (model.endDate < model.startDate) throw invalid("endDate", "Ngày kết thúc không được trước ngày bắt đầu.");
	const slug = slugFor(model.slug, model.title);
	if (await taken(ctx, "calendar_event", "slug", slug, exceptId)) throw new ApiError(409, "slug_taken", "Địa chỉ này đã có sự kiện khác dùng.", { slug: "Địa chỉ này đã có sự kiện khác dùng." });
	if (model.categoryId) {
		const category = await ctx.db.prepare("SELECT kind FROM category WHERE id = ? AND deleted_at IS NULL").bind(model.categoryId).first();
		if (!category || text(category.kind) !== "event") throw invalid("categoryId", "Loại sự kiện không có trong danh sách.");
	}
	if (model.linkedPostId && !(await ctx.db.prepare("SELECT 1 AS yes FROM post WHERE id = ? AND deleted_at IS NULL").bind(model.linkedPostId).first())) throw invalid("linkedPostId", "Bài viết liên kết không tồn tại.");
	await checkMedia(ctx, "imageMediaId", model.imageMediaId);
	let video: { id: string; url: string } | null = null;
	if (model.video?.url.trim()) {
		const id = youtubeId(model.video.url);
		if (!id) throw invalid("video", "Chỉ nhận đường dẫn YouTube.");
		video = { id, url: model.video.url.trim() };
	}
	let lunar: Lunar;
	if (model.lunarManual) {
		const manual = model.lunar;
		if (!manual || !Number.isInteger(manual.day) || manual.day < 1 || manual.day > 30) throw invalid("lunar", "Ngày âm lịch phải từ 1 đến 30.");
		if (!Number.isInteger(manual.month) || manual.month < 1 || manual.month > 12) throw invalid("lunar", "Tháng âm lịch phải từ 1 đến 12.");
		if (!Number.isInteger(manual.year) || manual.year < 1900 || manual.year > 2200) throw invalid("lunar", "Năm âm lịch chưa hợp lệ.");
		lunar = { day: manual.day, month: manual.month, year: manual.year, leap: !!manual.leap };
	} else lunar = lunarDate(model.startDate);
	return { video, lunar, slug };
}

const COLUMN_NAMES = [
	"slug", "title", "subtitle", "category_id", "start_date", "end_date", "times", "location", "description", "notes", "image_media_id", "image_position", "video",
	"linked_post_id", "registration_open", "lunar_day", "lunar_month", "lunar_year", "lunar_leap", "lunar_manual", "registration_status", "status",
];

function columns(model: EventModel, checked: Checked): unknown[] {
	return [
		checked.slug, model.title, model.subtitle, model.categoryId, model.startDate, model.endDate, JSON.stringify(model.times), model.location, model.description, model.notes,
		model.imageMediaId, model.imagePosition, checked.video ? JSON.stringify(checked.video) : null, model.linkedPostId, model.registrationStatus === "open" ? 1 : 0,
		checked.lunar.day, checked.lunar.month, checked.lunar.year, checked.lunar.leap ? 1 : 0, model.lunarManual ? 1 : 0, model.registrationStatus, model.status,
	];
}

const usesOf = (model: EventModel) => (model.imageMediaId ? [{ mediaId: model.imageMediaId, field: "image_media_id" }] : []);
const snapshot = (id: string, model: EventModel, checked: Checked) => ({ id, ...model, slug: checked.slug, video: checked.video, lunar: checked.lunar });
const SLUG_TAKEN = "Địa chỉ này đã có sự kiện khác dùng.";

export async function createEvent(ctx: AuthContext, by: Authed, model: EventModel): Promise<EventItem> {
	checkStatusChange(by, "events", null, model.status);
	const checked = await validate(ctx, model);
	const id = newId("event", ctx.now().getTime());
	const now = stamp(ctx);
	try {
		await ctx.db.batch([
			ctx.db
				.prepare(`INSERT INTO calendar_event (id, ${COLUMN_NAMES.join(", ")}, position, version, created_by, updated_by, updated_at) VALUES (?, ${COLUMN_NAMES.map(() => "?").join(", ")}, 0, 1, ?, ?, ?)`)
				.bind(id, ...columns(model, checked), by.user.id, by.user.id, now),
			...replaceUsageStatements(ctx, "calendar_event", id, usesOf(model)),
			revisionStatement(ctx, by, "calendar_event", id, 1, snapshot(id, model, checked), "Tạo sự kiện"),
			audit(ctx, by, { action: "event.create", entityType: "calendar_event", entityId: id, after: { title: model.title, startDate: model.startDate, endDate: model.endDate, status: model.status } }),
		]);
	} catch (error) {
		conflictOf(error, SLUG_TAKEN);
	}
	return getEvent(ctx, id);
}

export async function updateEvent(ctx: AuthContext, by: Authed, id: string, version: number, patch: Partial<EventModel>): Promise<EventItem> {
	const row = await findRow(ctx, id);
	mayChange(by, "events", "update", text(row.created_by) || null);
	mayChangeLive(by, "events", text(row.status) === "published");
	staleVersion(row, version);
	const current = toItem(row);
	const before = toModel(current);
	const model: EventModel = { ...before, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) };
	// Typed lunar numbers only count while the manual flag is on; otherwise the server works the date out.
	if (!model.lunarManual) model.lunar = null;
	checkStatusChange(by, "events", current.status, model.status);
	const checked = await validate(ctx, model, id);
	model.lunar = checked.lunar;
	const now = stamp(ctx);
	const next = version + 1;
	try {
		await ctx.db.batch([
			ctx.db
				.prepare(`UPDATE calendar_event SET ${COLUMN_NAMES.map((name) => `${name} = ?`).join(", ")}, version = ?, updated_by = ?, updated_at = ? WHERE id = ? AND version = ?`)
				.bind(...columns(model, checked), next, by.user.id, now, id, version),
			...replaceUsageStatements(ctx, "calendar_event", id, usesOf(model)),
			revisionStatement(ctx, by, "calendar_event", id, next, snapshot(id, model, checked), "Sửa sự kiện"),
			audit(ctx, by, { action: "event.update", entityType: "calendar_event", entityId: id, before: diffOf(before, model, "before"), after: diffOf(before, model, "after") }),
		]);
	} catch (error) {
		conflictOf(error, SLUG_TAKEN);
	}
	return getEvent(ctx, id);
}

export async function deleteEvent(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const row = await findRow(ctx, id);
	mayChange(by, "events", "delete", text(row.created_by) || null);
	mayChangeLive(by, "events", text(row.status) === "published");
	await ctx.db.batch([trashStatement(ctx, by, "calendar_event", id), audit(ctx, by, { action: "event.trash", entityType: "calendar_event", entityId: id, before: { title: row.title, startDate: row.start_date } })]);
}

/** A draft copy with the same details and the next free address. */
export async function duplicateEvent(ctx: AuthContext, by: Authed, id: string): Promise<EventItem> {
	const item = await getEvent(ctx, id);
	const base = item.slug.slice(0, 70);
	let candidate = `${base}-copy`;
	for (let n = 2; await taken(ctx, "calendar_event", "slug", candidate); n++) candidate = `${base}-copy-${n}`;
	return createEvent(ctx, by, { ...toModel(item), title: `${item.title} (bản sao)`, slug: candidate, status: "draft" });
}

registerTrashable({
	type: "calendar_event",
	label: "Sự kiện",
	table: "calendar_event",
	titleSql: "title",
	module: "events",
	hasCreatedBy: true,
	purge: (ctx, _by, id) => [
		ctx.db.prepare("DELETE FROM revision WHERE entity_type = 'calendar_event' AND entity_id = ?").bind(id),
		ctx.db.prepare("DELETE FROM media_usage WHERE entity_type = 'calendar_event' AND entity_id = ?").bind(id),
	],
});

// ------------------------------------------------------------------ regular programs and month themes

export type ProgramItem = { id: string; title: string; subtitle: string; summary: string; time: string; duration: string; location: string; imageMediaId: string | null; imageUrl: string; imagePosition: string; position: number };
export type ProgramPatch = Partial<Omit<ProgramItem, "id" | "imageUrl">>;

export async function listPrograms(ctx: AuthContext): Promise<ProgramItem[]> {
	const { results } = await ctx.db.prepare("SELECT f.*, m.r2_key AS img_key, m.url AS img_url FROM featured_program f LEFT JOIN media m ON m.id = f.image_media_id ORDER BY f.position, f.id").all();
	return results.map((row) => ({
		id: text(row.id), title: text(row.title), subtitle: text(row.subtitle), summary: text(row.summary), time: text(row.time), duration: text(row.duration), location: text(row.location),
		imageMediaId: text(row.image_media_id) || null, imageUrl: mediaPath(text(row.img_key) || null, text(row.img_url) || null), imagePosition: text(row.image_position) || "center 50%", position: num(row.position),
	}));
}

export async function updateProgram(ctx: AuthContext, by: Authed, id: string, patch: ProgramPatch): Promise<ProgramItem[]> {
	mayChangeLive(by, "events", true); // a regular program is on the page as soon as it is saved
	const current = (await listPrograms(ctx)).find((item) => item.id === id);
	if (!current) throw notFound("Chương trình");
	const next = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) } as ProgramItem;
	await checkMedia(ctx, "imageMediaId", next.imageMediaId);
	await ctx.db.batch([
		ctx.db
			.prepare("UPDATE featured_program SET title = ?, subtitle = ?, summary = ?, time = ?, duration = ?, location = ?, image_media_id = ?, image_position = ?, position = ? WHERE id = ?")
			.bind(next.title, next.subtitle, next.summary, next.time, next.duration, next.location, next.imageMediaId, next.imagePosition, next.position, id),
		...replaceUsageStatements(ctx, "featured_program", id, next.imageMediaId ? [{ mediaId: next.imageMediaId, field: "image_media_id" }] : []),
		audit(ctx, by, { action: "program.update", entityType: "featured_program", entityId: id, before: diffOf(current, next, "before"), after: diffOf(current, next, "after") }),
	]);
	return listPrograms(ctx);
}

export type ThemeItem = { month: number; title: string; posterMediaId: string | null; posterUrl: string; lines: string[]; author: string };

export async function listThemes(ctx: AuthContext): Promise<ThemeItem[]> {
	const { results } = await ctx.db.prepare("SELECT t.*, m.r2_key AS img_key, m.url AS img_url FROM month_theme t LEFT JOIN media m ON m.id = t.poster_media_id").all();
	const byMonth = new Map(results.map((row) => [num(row.month), row]));
	return Array.from({ length: 12 }, (_, i) => {
		const row = byMonth.get(i + 1);
		return {
			month: i + 1,
			title: text(row?.title),
			posterMediaId: text(row?.poster_media_id) || null,
			posterUrl: row ? mediaPath(text(row.img_key) || null, text(row.img_url) || null) : "",
			lines: json<string[]>(row?.lines, []),
			author: text(row?.author),
		};
	});
}

/** A verse line as HTML whose only tag is <b>: everything else is shown as text, and an unclosed <b> is closed. */
export function cleanVerseLine(line: string): string {
	const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const html = escaped.replace(/&lt;(\/?)b&gt;/gi, "<$1b>");
	let open = false;
	let out = "";
	for (const part of html.split(/(<\/?b>)/)) {
		if (part === "<b>") {
			if (!open) out += part;
			open = true;
		} else if (part === "</b>") {
			if (open) out += part;
			open = false;
		} else out += part;
	}
	return open ? `${out}</b>` : out;
}

export async function updateTheme(ctx: AuthContext, by: Authed, month: number, input: { title?: string; posterMediaId?: string | null; lines?: string[]; author?: string }): Promise<ThemeItem> {
	if (!Number.isInteger(month) || month < 1 || month > 12) throw notFound("Chủ đề tháng");
	mayChangeLive(by, "events", true); // a month theme is on the page as soon as it is saved
	const current = (await listThemes(ctx))[month - 1];
	const lines = input.lines === undefined ? current.lines : input.lines.map(cleanVerseLine).filter((line) => line.trim() !== "");
	const next = { title: input.title ?? current.title, posterMediaId: input.posterMediaId === undefined ? current.posterMediaId : input.posterMediaId, lines, author: input.author ?? current.author };
	await checkMedia(ctx, "posterMediaId", next.posterMediaId);
	await ctx.db.batch([
		ctx.db
			.prepare("INSERT INTO month_theme (month, title, poster_media_id, lines, author) VALUES (?, ?, ?, ?, ?) ON CONFLICT(month) DO UPDATE SET title = excluded.title, poster_media_id = excluded.poster_media_id, lines = excluded.lines, author = excluded.author")
			.bind(month, next.title, next.posterMediaId, JSON.stringify(next.lines), next.author),
		...replaceUsageStatements(ctx, "month_theme", String(month), next.posterMediaId ? [{ mediaId: next.posterMediaId, field: "poster_media_id" }] : []),
		audit(ctx, by, { action: "month_theme.update", entityType: "month_theme", entityId: String(month), before: { title: current.title, lines: current.lines, author: current.author }, after: { title: next.title, lines: next.lines, author: next.author } }),
	]);
	return (await listThemes(ctx))[month - 1];
}
