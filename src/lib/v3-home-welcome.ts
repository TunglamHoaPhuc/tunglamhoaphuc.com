// "Lời chào" on the home page: the temple's greeting, its video, and the figures counted up beside it (Bài viết Dòng Chảy Hoằng Pháp,
// Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp, Phật lịch). Everything the admin edits at www's /quan-tri/trang-chu (setting keys
// home.welcome, home.stats, home.buddhist_year) comes through here, worked out the way www's src/libs/home.ts works it out
// (withWelcomeSetting, statsFrom), so the two sites say the same thing from the same D1:
//   - each field of home.welcome that is set and valid wins, the rest is the history topic of Giới thiệu (group "lich-su-chua");
//   - home.stats lists the figures (at most 3) by source: the count of live posts of a section, the Phật lịch year, or a typed number;
//     without the setting the three figures www shows by default;
//   - the Phật lịch is the year the rule gives for today (it turns over on Phật đản, 15/4 lunar) unless the admin typed one.
// Server only (it reads D1); the result is a plain object the component (features/home/components/WelcomeSection.tsx) takes as props.
// Nothing is invented: a figure that cannot be read is left out, a block with nothing to say is `null`.
import { createD1Repository, type D1Like } from "@/lib/tlhp-content/sources/d1";
import { MEDIA_BASE, mediaUrl } from "@/lib/tlhp-content/media";
import { getContentRepository, sectionSlugKey } from "@/lib/tlhp-content/repository";
import type { ContentRepository } from "@/lib/tlhp-content/types";
import { readBuddhistYear, readStats, readWelcome, youtubeId, type StatSetting } from "@/lib/tlhp-site/homeSettings";
import { getSettings, readSettings, type SettingsMap } from "@/lib/tlhp-site/siteData";
import { siteDb } from "@/lib/v3-db";
import { DEFAULT_HERO_VIDEO_ID } from "@/lib/v3-home-content";

export const DONG_CHAY_SECTION = "dong-chay-hoang-phap";
export const TRI_TUE_SECTION = "tri-tue-phat-phap";
/** The group of Giới thiệu whose topic is the fallback greeting (www: HISTORY_GROUP). */
const HISTORY_GROUP = "lich-su-chua";

export const DEFAULT_LINK_LABEL = "Tìm hiểu Bổn tự";
export const DEFAULT_VIDEO_LABEL = "Chốn thiêng bình yên – Tùng Lâm Hòa Phúc";
const OTHER_VIDEO_LABEL = "Video giới thiệu Tùng Lâm Hòa Phúc";

export type HomeWelcomeStat = {
	label: string;
	value: number;
	/** A year: written without a thousands point. */
	year: boolean;
};

export type HomeWelcome = {
	/** "" when neither the admin nor the history topic gave one: the component then draws no heading. */
	title: string;
	author: string;
	text: string;
	link: { label: string; href: string };
	/** The picture the admin chose (or the history topic's), already an address. */
	image: { src: string; position: string } | null;
	/** The YouTube video the greeting opens: the admin's, else the temple's own. */
	video: { id: string; label: string };
	stats: HomeWelcomeStat[];
};

// ------------------------------------------------------------------ Phật lịch (www: src/libs/lunar.ts, byte-for-byte arithmetic)
// The Vietnamese lunar calendar after Hồ Ngọc Đức's algorithm, in Vietnam's time zone. V3's own lib/lunar-calendar.ts is not
// used here: it places the leap month differently from www on some days (2025's leap month is the 6th), and the Phật lịch must
// be the one www prints.

const TIME_ZONE = 7;
const DEGREE = Math.PI / 180;

type LunarDate = { day: number; month: number; year: number; leap: boolean };

function jdFromDate(day: number, month: number, year: number): number {
	const a = Math.floor((14 - month) / 12);
	const y = year + 4800 - a;
	const m = month + 12 * a - 3;
	return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function newMoon(k: number): number {
	const t = k / 1236.85;
	const t2 = t * t;
	const t3 = t2 * t;
	let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
	jd += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * DEGREE);
	const sun = (359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3) * DEGREE;
	const moon = (306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3) * DEGREE;
	const node = (21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3) * DEGREE;
	let c = (0.1734 - 0.000393 * t) * Math.sin(sun) + 0.0021 * Math.sin(2 * sun);
	c += -0.4068 * Math.sin(moon) + 0.0161 * Math.sin(2 * moon) - 0.0004 * Math.sin(3 * moon);
	c += 0.0104 * Math.sin(2 * node) - 0.0051 * Math.sin(sun + moon) - 0.0074 * Math.sin(sun - moon);
	c += 0.0004 * Math.sin(2 * node + sun) - 0.0004 * Math.sin(2 * node - sun) - 0.0006 * Math.sin(2 * node + moon);
	c += 0.001 * Math.sin(2 * node - moon) + 0.0005 * Math.sin(2 * moon + sun);
	const deltaT = t < -11 ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3 : -0.000278 + 0.000265 * t + 0.000262 * t2;
	return jd + c - deltaT;
}

function sunLongitude(jd: number): number {
	const t = (jd - 2451545.0) / 36525;
	const t2 = t * t;
	const mean = (357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t * t2) * DEGREE;
	const longitude = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
	let center = (1.9146 - 0.004817 * t - 0.000014 * t2) * Math.sin(mean);
	center += (0.019993 - 0.000101 * t) * Math.sin(2 * mean) + 0.00029 * Math.sin(3 * mean);
	const angle = (longitude + center) * DEGREE;
	return angle - 2 * Math.PI * Math.floor(angle / (2 * Math.PI));
}

function solarTerm(dayNumber: number): number {
	return Math.floor((sunLongitude(dayNumber - 0.5 - TIME_ZONE / 24) / Math.PI) * 6);
}

function newMoonDay(k: number): number {
	return Math.floor(newMoon(k) + 0.5 + TIME_ZONE / 24);
}

function month11(year: number): number {
	const k = Math.floor((jdFromDate(31, 12, year) - 2415021) / 29.530588853);
	const day = newMoonDay(k);
	return solarTerm(day) >= 9 ? newMoonDay(k - 1) : day;
}

function leapMonthOffset(start: number): number {
	const k = Math.floor((start - 2415021.076998695) / 29.530588853 + 0.5);
	let i = 1;
	let term = solarTerm(newMoonDay(k + i));
	let last: number;
	do {
		last = term;
		i++;
		term = solarTerm(newMoonDay(k + i));
	} while (term !== last && i < 14);
	return i - 1;
}

/** The lunar date of a day ("2026-02-17" → 1/1/2026). */
export function lunarDate(isoDate: string): LunarDate {
	const [y, m, d] = isoDate.split("-").map(Number);
	const dayNumber = jdFromDate(d, m, y);
	const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
	let monthStart = newMoonDay(k + 1);
	if (monthStart > dayNumber) monthStart = newMoonDay(k);

	let a11 = month11(y);
	let b11 = a11;
	let year: number;
	if (a11 >= monthStart) {
		year = y;
		a11 = month11(y - 1);
	} else {
		year = y + 1;
		b11 = month11(y + 1);
	}
	const diff = Math.floor((monthStart - a11) / 29);
	let month = diff + 11;
	let leap = false;
	if (b11 - a11 > 365) {
		const offset = leapMonthOffset(a11);
		if (diff >= offset) {
			month = diff + 10;
			leap = diff === offset;
		}
	}
	if (month > 12) month -= 12;
	if (month >= 11 && diff < 4) year -= 1;
	return { day: dayNumber - monthStart + 1, month, year, leap };
}

/** Phật lịch of a day. It turns over on Phật đản (15/4 lunar), not at Tết. */
export function buddhistYear(isoDate: string): number {
	const { day, month, year, leap } = lunarDate(isoDate);
	const afterVesak = month > 4 || (month === 4 && (leap || day >= 15));
	return year + (afterVesak ? 544 : 543);
}

const VIETNAM_OFFSET_MS = 7 * 3_600_000;
/** Today's date in Vietnam, "2026-11-23" (www: libs/calendar.ts). */
export function todayInVietnam(now = new Date()): string {
	return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ counts

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * How many live posts each section has: published, or scheduled with its time come; not in the trash (the "live" filter of the D1
 * source). Two posts of one section that share a slug count once, as the repository lists them (the later one is left out until its
 * slug is changed). So these are the numbers `listPosts({ section }).total` gives, without reading every post's summary.
 */
export async function countLivePosts(db: D1Like, sections: readonly string[]): Promise<Record<string, number>> {
	const marks = sections.map(() => "?").join(",");
	const rows = (
		await db
			.prepare(
				`select p.section, p.slug from post p where p.section in (${marks}) and p.deleted_at is null and (p.status = 'published' or (p.status = 'scheduled' and p.publish_at <= ${NOW})) order by p.rowid`,
			)
			.bind(...sections)
			.all<{ section: unknown; slug: unknown }>()
	).results;
	const taken = new Set<string>();
	const counts: Record<string, number> = Object.fromEntries(sections.map((section) => [section, 0]));
	for (const row of rows) {
		const section = typeof row.section === "string" ? row.section : "";
		const key = sectionSlugKey(section, typeof row.slug === "string" ? row.slug : "");
		if (taken.has(key)) continue;
		taken.add(key);
		if (section in counts) counts[section]++;
	}
	return counts;
}

// ------------------------------------------------------------------ the loader

export type LoadHomeWelcomeOptions = {
	/** The settings already read (page.tsx has them); otherwise they are read here. */
	settings?: SettingsMap;
	/** Where the history topic (and, with no D1 handle, the counts) come from; default: the site's own repository. */
	repo?: ContentRepository;
	now?: Date;
};

type Row = Record<string, unknown>;

async function pictureOf(db: D1Like | null, mediaId: string | undefined): Promise<string | null> {
	if (!db || !mediaId) return null;
	const [row] = (await db.prepare("select r2_key, url from media where id = ? and deleted_at is null").bind(mediaId).all<Row>()).results;
	if (!row) return null;
	if (typeof row.r2_key === "string" && row.r2_key) return `${MEDIA_BASE}/${row.r2_key}`;
	return typeof row.url === "string" ? mediaUrl(row.url) : null;
}

const failed = (what: string, error: unknown) => console.error(`v3-home-welcome: không đọc được ${what}`, error);

/**
 * The block for the home page, or `null` when there is nothing to greet with (no home.welcome and no history topic).
 * `db` is the D1 handle: omitted, it is the site's own (`siteDb()`); `null` means "no D1" (snapshot runs), where the settings are
 * empty and the counts come from the repository. Never throws: whatever cannot be read falls back, field by field.
 */
export async function loadHomeWelcome(db?: D1Like | null, options: LoadHomeWelcomeOptions = {}): Promise<HomeWelcome | null> {
	const handle = db === undefined ? await siteDb().catch(() => null) : db;
	let settings = options.settings;
	if (!settings) {
		try {
			// A handle given by the caller is read fresh; the site's own is read through the shared minute cache.
			settings = db ? await readSettings(db) : await getSettings();
		} catch (error) {
			failed("các cài đặt trang chủ", error);
			settings = {};
		}
	}
	let repository: ContentRepository | undefined = options.repo;
	const repo = async () => (repository ??= db ? createD1Repository(db) : await getContentRepository());

	const setting = readWelcome(settings["home.welcome"]);

	// Each field of the setting that is set wins; the history topic of Giới thiệu fills what is left, as on www.
	let base: { title: string; author: string; text: string; href: string; image: { src: string; position: string } | null } | null = null;
	if (!setting?.quote || !setting?.paragraph || !setting?.linkHref) {
		try {
			const history = (await (await repo()).listAboutTopics()).find((topic) => topic.group.slug === HISTORY_GROUP);
			if (history) {
				base = {
					title: history.quote?.lines[0] ?? history.subtitle,
					author: history.quote?.author ?? "",
					text: history.overview,
					href: `/gioi-thieu/${history.slug}`,
					image: history.portrait ?? history.banner,
				};
			}
		} catch (error) {
			failed("chủ đề Lịch Sử Chùa của Giới thiệu", error);
		}
	}
	if (!setting && !base) return null;

	let image = base?.image ?? null;
	if (setting?.imageMediaId) {
		try {
			const src = await pictureOf(handle, setting.imageMediaId);
			if (src) image = { src, position: "center 50%" };
		} catch (error) {
			failed("ảnh của Lời chào", error);
		}
	}

	const videoId = (setting?.videoUrl ? youtubeId(setting.videoUrl) : null) ?? DEFAULT_HERO_VIDEO_ID;

	return {
		title: setting?.quote || base?.title || "",
		// Unlike www, the history topic's author is not put under a quote the admin wrote himself.
		author: setting?.quote ? (setting.author ?? "") : (setting?.author ?? base?.author ?? ""),
		text: setting?.paragraph || base?.text || "",
		link: { label: setting?.linkLabel || DEFAULT_LINK_LABEL, href: setting?.linkHref || base?.href || "/gioi-thieu" },
		image,
		video: { id: videoId, label: videoId === DEFAULT_HERO_VIDEO_ID ? DEFAULT_VIDEO_LABEL : OTHER_VIDEO_LABEL },
		stats: await statsOf(settings, handle, repo, options.now ?? new Date()),
	};
}

type Counts = { dongChay: number | null; triTue: number | null };

async function countsOf(handle: D1Like | null, repo: () => Promise<ContentRepository>): Promise<Counts> {
	try {
		if (handle) {
			const counts = await countLivePosts(handle, [DONG_CHAY_SECTION, TRI_TUE_SECTION]);
			return { dongChay: counts[DONG_CHAY_SECTION], triTue: counts[TRI_TUE_SECTION] };
		}
		const r = await repo();
		const [dongChay, triTue] = await Promise.all([r.listPosts({ section: DONG_CHAY_SECTION, pageSize: 1 }), r.listPosts({ section: TRI_TUE_SECTION, pageSize: 1 })]);
		return { dongChay: dongChay.total, triTue: triTue.total };
	} catch (error) {
		failed("số bài viết", error);
		return { dongChay: null, triTue: null };
	}
}

/** The figures: the admin's list by source, or www's three defaults; a count that could not be read leaves its figure out. */
async function statsOf(settings: SettingsMap, handle: D1Like | null, repo: () => Promise<ContentRepository>, now: Date): Promise<HomeWelcomeStat[]> {
	const list: StatSetting[] | null = readStats(settings["home.stats"]);
	const year = readBuddhistYear(settings["home.buddhist_year"]);
	const items: Pick<StatSetting, "label" | "source" | "value">[] = list ?? [
		{ label: "Bài viết Dòng Chảy Hoằng Pháp", source: "auto-bai-dong-chay", value: 0 },
		{ label: "Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp", source: "auto-bai-tri-tue", value: 0 },
		{ label: "Phật lịch", source: "auto-phat-lich", value: 0 },
	];
	const needsCounts = items.some((item) => item.source === "auto-bai-dong-chay" || item.source === "auto-bai-tri-tue");
	const counts: Counts = needsCounts ? await countsOf(handle, repo) : { dongChay: null, triTue: null };
	const phatLich = year?.mode === "manual" ? year.value : buddhistYear(todayInVietnam(now));
	const value = (item: (typeof items)[number]): number | null => {
		if (item.source === "auto-bai-dong-chay") return counts.dongChay;
		if (item.source === "auto-bai-tri-tue") return counts.triTue;
		if (item.source === "auto-phat-lich") return phatLich;
		return item.value;
	};
	return items.flatMap((item) => {
		const number = value(item);
		return number === null ? [] : [{ label: item.label, value: number, year: item.source === "auto-phat-lich" }];
	});
}
