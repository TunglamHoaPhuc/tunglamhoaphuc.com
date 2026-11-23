// The frames of the home page's hero, built the way www builds them (src/libs/home.ts: customSlides, eventSlide, latestSlide and the
// order they come in), minus the pictures. Pure: nothing here reads D1. app/page.tsx reads the admin's settings and the schedule and
// the newest posts (loadHeroSources) and hands them to heroFromSettings (lib/v3-home-content.ts); the hero is a client component, so
// nothing in this file may be server-only (the repository is imported lazily, inside loadHeroSources only).
//
// Frames, in order, as www:
//   1. the admin's frames that are valid and switched on (home.hero.slides), or, when there are none, V3's own "NƠI ĐỂ TRỞ VỀ";
//   2. when home.hero.autoEvent is not off: the next event to begin (today or later) with its days left;
//   3. when home.hero.autoLatest is not off: the newest post with a picture (of the sections whose pages exist).
// Everything the admin wrote is read by www's own readers (lib/tlhp-site/homeSettings.ts, a byte copy), so a bad block is dropped
// field by field and can never break the page. The date, lunar and countdown helpers below are copies of www's (calendar.ts,
// countdown.ts, nextEvent.ts); tests/unit/v3-home-hero-www-parity.test.ts runs www's own loadHomeData against these.
import type { ContentRepository, PostSummary, ScheduleEvent } from "@/lib/tlhp-content/types";
import { readHero, safeHref, type HeroSlideSetting } from "@/lib/tlhp-site/homeSettings";
import { lunarDate, lunarYearName, shortLunar } from "@/lib/v3-hero-lunar";

/** Sections whose post pages V3 builds: the newest-post frame takes posts from these only (www's LIVE_SECTIONS). */
export const HERO_POST_SECTIONS = ["dong-chay-hoang-phap", "tri-tue-phat-phap"];

/** www reads twice as many as it shows on the home page's news row, and takes the first one that has a picture. */
const NEWEST_PAGE_SIZE = 12;

/** The button of a frame: an address on this site or an https one, never anything else. */
export type HeroCta = { label: string; href: string; /** https:// address: opened as a plain link, not through the router. */ external: boolean };

export type HeroFrame = {
	/** www's ids: "noi-de-tro-ve", "tuy-chinh-<id>", "khoa-tu-<id>", "bai-<id>". */
	id: string;
	kind: "default" | "custom" | "event" | "latest";
	/** Small line above the title: "Khóa tu sắp tới · Còn 4 ngày", "Pháp sự mới nhất · 17/10/2026"; "" for the admin's own frames. */
	overline: string;
	/** In capitals, as V3's hero has always drawn it. */
	title: string;
	/** "" when there is none: the hero then draws no line under the title. */
	subtitle: string;
	/** A short paragraph; "" when there is none. */
	text: string;
	/** `null`: no button. */
	cta: HeroCta | null;
};

/** What the automatic frames are made from: the schedule's events (in date order) and the newest posts (newest first). */
export type HeroSources = { events: readonly ScheduleEvent[]; posts: readonly PostSummary[] };

export const NO_HERO_SOURCES: HeroSources = { events: [], posts: [] };

const upper = (text: string) => text.toLocaleUpperCase("vi");

/** V3's own first frame, shown when the admin has no frame switched on (the words V3 has always shown, without the paragraph and button www adds). */
export const DEFAULT_FRAME: HeroFrame = { id: "noi-de-tro-ve", kind: "default", overline: "", title: "NƠI ĐỂ TRỞ VỀ", subtitle: "CHỐN THIÊNG BÌNH YÊN", text: "", cta: null };

/** Where a button goes when the admin gave a label and no address: www's own default (site.hero.link.href), "Tìm hiểu Bổn tự". */
export const DEFAULT_CTA_HREF = "/gioi-thieu";

// ---------------------------------------------------------------- dates, as www's calendar.ts / countdown.ts / nextEvent.ts

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

/** Today in Vietnam, YYYY-MM-DD. */
export function todayInVietnam(now = new Date()): string {
	return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** "2026-10-17" → "17/10/2026". */
export function formatDate(isoDate: string): string {
	const [year, month, day] = isoDate.split("-");
	return `${day}/${month}/${year}`;
}

function weekdayName(isoDate: string): string {
	return WEEKDAYS[(new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7];
}

/** "Thứ Bảy, 07/11/2026" or "09/11 – 18/11/2026". */
export function solarRange(event: Pick<ScheduleEvent, "start" | "end">): string {
	if (event.start === event.end) return `${weekdayName(event.start)}, ${formatDate(event.start)}`;
	const start = formatDate(event.start);
	const sameYear = event.start.slice(0, 4) === event.end.slice(0, 4);
	return `${sameYear ? start.slice(0, 5) : start} – ${formatDate(event.end)}`;
}

/** "27/9 Bính Ngọ" or "29/9 – 9/10 Bính Ngọ". */
export function lunarRange(event: Pick<ScheduleEvent, "start" | "end">): string {
	const start = lunarDate(event.start);
	const end = lunarDate(event.end);
	const startText = start.year === end.year ? shortLunar(start) : `${shortLunar(start)} ${lunarYearName(start.year)}`;
	const range = event.start === event.end ? shortLunar(start) : `${startText} – ${shortLunar(end)}`;
	return `${range} ${lunarYearName(end.year)}`;
}

/** Whole days from today in Vietnam to a day: 0 today, 1 tomorrow, negative once past. */
export function daysUntil(isoDate: string, now = new Date()): number {
	const today = todayInVietnam(now);
	return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** "Còn 4 ngày", or "Diễn ra hôm nay" on the day. */
export function countdownLabel(days: number): string {
	return days <= 0 ? "Diễn ra hôm nay" : `Còn ${days} ngày`;
}

/** The event the home page counts down to: the first one, in date order, that begins today or later. */
export function nextEvent<T extends { start: string }>(events: readonly T[], today: string): T | undefined {
	return events.find((event) => event.start >= today);
}

// ---------------------------------------------------------------- frames

/** The button of the admin's frame: a label makes it (no label, no button); no address leads to www's default page. */
export function ctaFrom(label: string, href: string): HeroCta | null {
	const text = label.trim();
	if (!text) return null;
	const target = href.trim() || DEFAULT_CTA_HREF;
	// The schema already refuses anything else; checked again here because this is what ends up in an href.
	if (!safeHref(target) || target.startsWith("//")) return null;
	return { label: text, href: target, external: target.startsWith("https://") };
}

function customFrame(slide: HeroSlideSetting): HeroFrame {
	return { id: `tuy-chinh-${slide.id}`, kind: "custom", overline: "", title: upper(slide.title), subtitle: upper(slide.subtitle), text: slide.text, cta: ctaFrom(slide.ctaLabel, slide.ctaHref) };
}

/** Frame "Khóa tu sắp tới": the days left, then when (solar and lunar), the times and where, as www writes it. */
function eventFrame(event: ScheduleEvent, now: Date): HeroFrame {
	const days = daysUntil(event.start, now);
	const countdown = days < 0 ? "Đang diễn ra" : countdownLabel(days);
	const times = event.times.map((slot) => `${slot.label} ${slot.time}`.trim());
	const facts = [solarRange(event), `Âm lịch ${lunarRange(event)}`, ...times, event.location].filter(Boolean);
	return {
		id: `khoa-tu-${event.id}`,
		kind: "event",
		overline: `Khóa tu sắp tới · ${countdown}`,
		title: upper(event.title),
		subtitle: "",
		text: facts.join(" · "),
		// V3 has a page for each event of its own (/lich-tu-hoc/<slug>); a day of a regular ceremony has none, the calendar block of the home page does.
		cta: { label: "Xem lịch khóa tu", href: event.programId ? "/#lich-tu-hoc" : `/lich-tu-hoc/${event.slug}`, external: false },
	};
}

/** Frame "Pháp sự mới nhất": the newest post with a picture (www takes none without one, and so does this). */
function latestFrame(posts: readonly PostSummary[]): HeroFrame | null {
	const post = posts.find((item) => item.banner);
	if (!post) return null;
	return {
		id: `bai-${post.id}`,
		kind: "latest",
		overline: `Pháp sự mới nhất · ${formatDate(post.publishedDate)}`,
		title: upper(post.title),
		subtitle: "",
		text: post.summary,
		cta: { label: "Xem bài", href: `/${post.section}/${post.slug}`, external: false },
	};
}

/** The frames of the hero for the admin's `home.hero` block (anything, even garbage) and what the automatic frames are made from. */
export function heroFrames(rawHero: unknown, sources: HeroSources = NO_HERO_SOURCES, now = new Date()): HeroFrame[] {
	const setting = readHero(rawHero);
	const next = nextEvent(sources.events, todayInVietnam(now));
	return [
		...(setting ? setting.slides.map(customFrame) : [DEFAULT_FRAME]),
		next && setting?.autoEvent !== false ? eventFrame(next, now) : null,
		setting?.autoLatest !== false ? latestFrame(sources.posts) : null,
	].filter((frame): frame is HeroFrame => frame !== null);
}

// ---------------------------------------------------------------- reading the sources (server)

type SourceRepository = Pick<ContentRepository, "getSchedule" | "listPosts">;

/**
 * The schedule's events and the newest posts, from the repository the whole site reads (D1 when deployed). A read that fails leaves
 * the automatic frames out and the admin's own frames in: the home page does not break because the schedule could not be read.
 */
export async function loadHeroSources(repository?: SourceRepository): Promise<HeroSources> {
	try {
		const repo = repository ?? (await (await import("@/lib/tlhp-content/repository")).getContentRepository());
		const [schedule, newest] = await Promise.all([repo.getSchedule(), repo.listPosts({ section: HERO_POST_SECTIONS, sort: "newest", pageSize: NEWEST_PAGE_SIZE })]);
		return { events: schedule.events, posts: newest.items };
	} catch (error) {
		console.error("hero: không đọc được lịch và bài mới nhất cho các khung tự động", error);
		return NO_HERO_SOURCES;
	}
}
