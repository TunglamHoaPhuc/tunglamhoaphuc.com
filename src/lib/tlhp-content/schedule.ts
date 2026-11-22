// The old admin's schedule file (lịch tu học: customEvents, featuredPrograms, monthThemes,
// quoteGallery) → Schedule. Lenient like posts.ts: an event without a real day is reported
// and left out, everything else falls back to empty values.
import { z } from "zod";
import { mediaKey, mediaUrl } from "./media";
import { cleanText, escapeHtml, toIsoDate } from "./normalize";
import { videosOf } from "./posts";
import type { ContentIssue, MediaImage, MonthTheme, QuoteImage, RegularProgram, Schedule, ScheduleEvent } from "./types";

const text = z.string().catch("");

const rawEventSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String),
	slug: text,
	solarDateStr: text,
	endDateStr: text,
	isMultiDay: z.boolean().catch(false),
	title: text,
	subtitle: text,
	category: text,
	timeSlot1Label: text,
	timeSlot1Time: text,
	timeSlot2Label: text,
	timeSlot2Time: text,
	location: text,
	description: text,
	notes: text,
	imgUrl: text,
	imgPositionY: z.number().min(0).max(100).optional().catch(undefined),
	videoUrl: text,
});

const rawProgramSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String),
	title: text,
	subtitle: text,
	summary: text,
	time: text,
	schedule: text,
	duration: text,
	location: text,
	imgUrl: text,
});

const rawThemeSchema = z.object({
	month: z.coerce.number().int().min(1).max(12),
	title: text,
	bannerImg: text,
	quoteLines: z.array(text).catch([]),
	author: text,
});

const rawQuoteSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String), url: text, title: text });

/** As the API sends it ({ success, data }), or the data alone. */
const scheduleFileSchema = z.union([
	z.object({ data: z.record(z.string(), z.unknown()) }).transform((file) => file.data),
	z.record(z.string(), z.unknown()),
]);

const list = (value: unknown) => (Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : []);

function plain(value: string): string {
	return cleanText(value).replace(/\s+/g, " ").trim();
}

/** "Khóa Lễ Truyền Thống" → "khoa-le-truyen-thong", the slugs the post categories use. */
export function categorySlug(name: string): string {
	return name
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[đĐ]/g, "d")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** A verse line: everything escaped, then the editors' <b> kept. */
function verseLine(value: string): string {
	return escapeHtml(plain(value)).replace(/&lt;(\/?)(?:b|strong)&gt;/gi, "<$1b>");
}

export type ParsedSchedule = { schedule: Schedule; issues: ContentIssue[] };

export function parseSchedule(file: unknown): ParsedSchedule {
	const issues: ContentIssue[] = [];
	const parsed = scheduleFileSchema.safeParse(file);
	const data = parsed.success ? parsed.data : {};

	const image = (url: string, positionY: number | undefined, id: string): MediaImage | null => {
		const src = mediaUrl(url);
		if (!src) return null;
		// The admin now uploads to a second bucket; moving the files must take it along.
		if (/^https:\/\//.test(src) && !mediaKey(src) && src.includes("backblazeb2.com")) {
			issues.push({ kind: "other-bucket", id, message: `ảnh ở bucket B2 khác: ${new URL(src).host}` });
		}
		return { src, position: `center ${positionY ?? 50}%` };
	};

	const events: ScheduleEvent[] = [];
	for (const raw of list(data.customEvents)) {
		const result = rawEventSchema.safeParse(raw);
		if (!result.success) {
			issues.push({ kind: "invalid", id: String((raw as { id?: unknown })?.id ?? "?"), message: result.error.issues[0]?.message ?? "sự kiện không đọc được" });
			continue;
		}
		const event = result.data;
		const start = toIsoDate(event.solarDateStr);
		if (!start) {
			issues.push({ kind: "invalid", id: event.id, message: `ngày không có thật: "${event.solarDateStr}"` });
			continue;
		}
		const end = (event.isMultiDay && toIsoDate(event.endDateStr)) || start;
		if (end < start) issues.push({ kind: "invalid", id: event.id, message: `ngày kết thúc ${event.endDateStr} trước ngày bắt đầu; coi là một ngày` });
		const category = plain(event.category);
		events.push({
			id: event.id,
			slug: event.slug.trim() || event.id,
			title: plain(event.title),
			subtitle: plain(event.subtitle),
			category: { slug: categorySlug(category), name: category },
			start,
			end: end < start ? start : end,
			times: [
				{ label: plain(event.timeSlot1Label), time: plain(event.timeSlot1Time) },
				{ label: plain(event.timeSlot2Label), time: plain(event.timeSlot2Time) },
			].filter((slot) => slot.label || slot.time),
			location: plain(event.location),
			description: plain(event.description),
			notes: plain(event.notes),
			image: image(event.imgUrl, event.imgPositionY, event.id),
			video: videosOf(event.videoUrl)[0] ?? null,
		});
	}
	events.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title, "vi"));

	const programs: RegularProgram[] = list(data.featuredPrograms).flatMap((raw) => {
		const result = rawProgramSchema.safeParse(raw);
		if (!result.success) return [];
		const program = result.data;
		return [
			{
				id: program.id,
				title: plain(program.title),
				subtitle: plain(program.subtitle),
				summary: plain(program.summary),
				time: plain(program.time || program.schedule),
				duration: plain(program.duration),
				location: plain(program.location),
				image: image(program.imgUrl, undefined, program.id),
			},
		];
	});

	const themes: MonthTheme[] = list(data.monthThemes)
		.flatMap((raw) => {
			const result = rawThemeSchema.safeParse(raw);
			if (!result.success) return [];
			const theme = result.data;
			return [
				{
					month: theme.month,
					title: plain(theme.title),
					poster: mediaUrl(theme.bannerImg),
					lines: theme.quoteLines.map(verseLine).filter(Boolean),
					author: plain(theme.author),
				},
			];
		})
		.sort((a, b) => a.month - b.month);
	for (const theme of themes) {
		if (theme.poster) image(theme.poster, undefined, `thang-${theme.month}`);
	}

	const quotes: QuoteImage[] = list(data.quoteGallery).flatMap((raw) => {
		const result = rawQuoteSchema.safeParse(raw);
		const src = result.success ? mediaUrl(result.data.url) : null;
		return result.success && src ? [{ id: result.data.id, src, title: plain(result.data.title) }] : [];
	});

	return { schedule: { events, programs, themes, quotes }, issues };
}
