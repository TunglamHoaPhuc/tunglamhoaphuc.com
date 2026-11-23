// The home page blocks the admin edits (setting keys home.hero, home.welcome, home.stats, home.buddhist_year,
// home.quotes). The admin validates what it stores with these schemas; the public page reads the stored JSON with
// the tolerant readers below, which keep every field that is valid and drop the rest, so a bad setting can
// never break the home page.
import { z } from "zod";

/** The id of a YouTube video from a watch, short, embed or shorts address (or the bare id); `null` for anything else. */
export function youtubeId(value: string): string | null {
	const input = value.trim();
	if (/^[\w-]{11}$/.test(input)) return input;
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return null;
	}
	if (url.protocol !== "https:") return null;
	const host = url.hostname.replace(/^www\.|^m\./, "");
	let id: string | null = null;
	if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
	else if (host === "youtube.com" || host === "youtube-nocookie.com") {
		const parts = url.pathname.split("/").filter(Boolean);
		if (parts[0] === "watch") id = url.searchParams.get("v");
		else if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") id = parts[1] ?? null;
	}
	return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** A link on this site ("/gioi-thieu") or an https address; nothing else (no javascript:, no //host). */
export const safeHref = (value: string) => value === "" || (value.startsWith("/") && !value.startsWith("//") && !/[\s\\]/.test(value)) || /^https:\/\/[^\s]+$/.test(value);

const short = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`);
const href = z.string().trim().max(300).refine(safeHref, "Đường dẫn phải bắt đầu bằng / hoặc https://.");
const mediaId = z.string().trim().max(80).nullable();

export const heroSlideSchema = z.object({
	id: z.string().trim().min(1).max(40),
	enabled: z.boolean(),
	title: short(120).min(1, "Nhập tiêu đề."),
	subtitle: short(120),
	text: short(300),
	imageMediaId: mediaId,
	portraitMediaId: mediaId,
	imagePosition: z.string().trim().max(30),
	ctaLabel: short(40),
	ctaHref: href,
});
export type HeroSlideSetting = z.infer<typeof heroSlideSchema>;

export const heroSchema = z.object({ slides: z.array(heroSlideSchema).max(8, "Tối đa 8 khung."), autoEvent: z.boolean(), autoLatest: z.boolean() });
export type HeroSetting = z.infer<typeof heroSchema>;

export const welcomeSchema = z.object({
	quote: short(300),
	author: short(120),
	paragraph: short(1200),
	imageMediaId: mediaId,
	videoUrl: z.string().trim().max(300).refine((value) => value === "" || youtubeId(value) !== null, "Chỉ nhận đường dẫn YouTube."),
	linkLabel: short(40),
	linkHref: href,
});
export type WelcomeSetting = z.infer<typeof welcomeSchema>;

export const STAT_SOURCES = ["auto-bai-dong-chay", "auto-bai-tri-tue", "auto-phat-lich", "manual"] as const;
export const statSchema = z.object({
	label: short(80).min(1, "Nhập nhãn."),
	source: z.enum(STAT_SOURCES),
	value: z.number().int().min(0).max(1_000_000_000),
});
export const statsSchema = z.array(statSchema).max(3, "Tối đa 3 số liệu.");
export type StatSetting = z.infer<typeof statSchema>;

export const buddhistYearSchema = z.object({ mode: z.enum(["auto", "manual"]), value: z.number().int().min(1).max(9999) });
export type BuddhistYearSetting = z.infer<typeof buddhistYearSchema>;

export const quotesSettingSchema = z.object({ source: z.enum(["chu-de-thang", "trich-dan"]), mode: z.enum(["thu-tu", "ngau-nhien"]) });
export type QuotesSetting = z.infer<typeof quotesSettingSchema>;

export const HOME_BLOCKS = {
	hero: { key: "home.hero", schema: heroSchema, label: "Khung đầu trang" },
	welcome: { key: "home.welcome", schema: welcomeSchema, label: "Lời chào" },
	stats: { key: "home.stats", schema: statsSchema, label: "Số liệu" },
	buddhist_year: { key: "home.buddhist_year", schema: buddhistYearSchema, label: "Phật lịch" },
	quotes: { key: "home.quotes", schema: quotesSettingSchema, label: "Lời Thầy dạy" },
} as const;
export type HomeBlock = keyof typeof HOME_BLOCKS;
export const isHomeBlock = (value: string): value is HomeBlock => Object.hasOwn(HOME_BLOCKS, value);

// ------------------------------------------------------------------ tolerant readers (public site)

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The slides that are valid and switched on; `null` when the setting is absent or has no valid slide. */
export function readHero(raw: unknown): { slides: HeroSlideSetting[]; autoEvent: boolean; autoLatest: boolean } | null {
	if (!isObject(raw) || !Array.isArray(raw.slides)) return null;
	const slides = raw.slides.flatMap((item) => {
		const parsed = heroSlideSchema.safeParse(item);
		return parsed.success && parsed.data.enabled ? [parsed.data] : [];
	});
	if (!slides.length) return null;
	return { slides, autoEvent: raw.autoEvent !== false, autoLatest: raw.autoLatest !== false };
}

/** Only the valid, non-empty fields of the welcome block. */
export function readWelcome(raw: unknown): Partial<WelcomeSetting> | null {
	if (!isObject(raw)) return null;
	const out: Partial<WelcomeSetting> = {};
	for (const [name, schema] of Object.entries(welcomeSchema.shape) as [keyof WelcomeSetting, z.ZodType][]) {
		const parsed = schema.safeParse(raw[name]);
		if (parsed.success && parsed.data) (out as Record<string, unknown>)[name] = parsed.data;
	}
	return Object.keys(out).length ? out : null;
}

export function readStats(raw: unknown): StatSetting[] | null {
	if (!Array.isArray(raw)) return null;
	const stats = raw.slice(0, 3).flatMap((item) => {
		const parsed = statSchema.safeParse(item);
		return parsed.success ? [parsed.data] : [];
	});
	return stats.length ? stats : null;
}

export function readBuddhistYear(raw: unknown): BuddhistYearSetting | null {
	const parsed = buddhistYearSchema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}

export function readQuotesSetting(raw: unknown): QuotesSetting | null {
	const parsed = quotesSettingSchema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}
