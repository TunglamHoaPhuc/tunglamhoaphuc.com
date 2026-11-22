// What the home page shows, read from the content layer on the server and handed to the
// Bexon sections as props.
import { site } from "@/config/site";
import { tongChi } from "@/config/tongChi";
import { calendarHref, type EventStatus, eventStatus, lunarRange, solarRange, todayInVietnam } from "@/libs/calendar";
import { IMAGE_WIDTH, imageAt, imageSrcSet } from "@/libs/content/media";
import type { AboutTopic, ContentRepository, MediaImage, MonthTheme, PostSummary, ScheduleEvent } from "@/libs/content/types";
import { countdownLabel, daysUntil } from "@/libs/countdown";
import { formatDate } from "@/libs/format";
import type { HomeExtras, HomeQuote } from "@/libs/homeData";
import {
	type BuddhistYearSetting,
	type HeroSlideSetting,
	readBuddhistYear,
	readHero,
	readQuotesSetting,
	readStats,
	readWelcome,
	type StatSetting,
	youtubeId,
} from "@/libs/homeSettings";
import { buddhistYear } from "@/libs/lunar";
import { nextEvent } from "@/libs/nextEvent";
import { postHref } from "@/libs/postList";
import { groupTongChi, type TongChiGroup } from "@/libs/tongChiGroups";
import { type AreaTeaser, templeAreas } from "@/libs/vuTru";

/** Sections whose post pages are built; home lists take posts from these only. */
export const LIVE_SECTIONS = ["dong-chay-hoang-phap", "tri-tue-phat-phap"];

const NEWS_COUNT = 6;
const UPCOMING_COUNT = 3;

/**
 * A post as the news slider's card shows it. The slider is a client component, so whatever it
 * gets is written into the page a second time for React (T41e): no summary, subtitle or author,
 * and one picture.
 */
export type NewsCard = Pick<PostSummary, "id" | "slug" | "section" | "title" | "category" | "publishedDate" | "views" | "thumbnail">;

function newsCard({ id, slug, section, title, category, publishedDate, views, thumbnail, banner }: PostSummary): NewsCard {
	return { id, slug, section, title, category, publishedDate, views, thumbnail: thumbnail ?? banner };
}

export type HeroImage = {
	src: string;
	/** Sizes made for the site; editors' pictures come in one size. */
	srcSet?: string;
	/** An upright crop for phones held upright. */
	portrait?: string;
	/** Sizes of the upright crop, when it is an editor's picture. */
	portraitSrcSet?: string;
	/** For the row of small pictures under the hero. */
	thumb: string;
	/** CSS object-position. */
	position: string;
};

export type HeroSlide = {
	id: string;
	/** Small line above the title: "Pháp sự mới nhất · 17/10/2026". */
	overline?: string;
	title: string;
	/** The end of the title, drawn lighter as Bexon does ("trở về"). */
	accent?: string;
	/** Second, smaller line of the title ("Chốn thiêng bình yên"). */
	subtitle?: string;
	text: string;
	link: { label: string; href: string };
	image: HeroImage;
};

/** An event of Khóa tu sắp tới, with where it stands today. */
export type UpcomingEvent = {
	event: ScheduleEvent;
	/** Its card on the schedule page. */
	href: string;
	status: EventStatus;
	/** "Còn 4 ngày", "Diễn ra hôm nay", "Đang diễn ra". */
	countdown: string;
};

/** A figure of Lời chào, counted up by the odometer. */
export type HomeStat = { label: string; value: number; /** A year: no thousands point. */ year?: boolean };

/** Lời Thầy dạy shown from the admin's quotes instead of the month themes' verses. */
export type HomeQuotes = { items: HomeQuote[]; mode: "thu-tu" | "ngau-nhien" };

/** Lời chào: the temple's greeting, from the history topic of Giới thiệu. */
export type Welcome = {
	/** The first line of the topic's teaching: "Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian." */
	title: string;
	author: string;
	text: string;
	href: string;
	image: MediaImage | null;
	/** The teachers' faces, beside "Chư Tôn Đức dẫn dắt đạo tràng". */
	faces: MediaImage[];
	stats: HomeStat[];
	/** The id of the YouTube video the admin chose; the site's own video when absent. */
	videoId?: string;
	/** The label of the link, when the admin wrote one. */
	linkLabel?: string;
};

export type HomeData = {
	hero: HeroSlide[];
	/** Khóa tu sắp tới: the next events still running or to come. */
	upcoming: UpcomingEvent[];
	/** Tin mới nhất. */
	latest: NewsCard[];
	/** Dấu ấn hoằng pháp: most read, leaving out what Tin mới nhất already shows. */
	popular: NewsCard[];
	/** Lời Thầy dạy: the month themes' verses, from this month on. */
	verses: MonthTheme[];
	/** Lời Thầy dạy from the admin's quotes, when the admin chose them as the source; `null` otherwise. */
	quotes: HomeQuotes | null;
	welcome: Welcome | null;
	/** Chư Tôn Đức: the teachers' topics of Giới thiệu. */
	teachers: AboutTopic[];
	/** Tông Chỉ Tu Học in its five groups. */
	tongChi: TongChiGroup[];
	/** Lộ trình tu học: the group of that name, shown again as steps. */
	paths: TongChiGroup | null;
	/** Khu vực nổi bật: the temple's areas in map order. */
	areas: AreaTeaser[];
};

// Groups of Giới thiệu the home page draws on.
const HISTORY_GROUP = "lich-su-chua";
const TEACHERS_GROUP = "nguoi-lien-quan";
const FACES = 3;

const titleKey = (item: { title: string }) => item.title.toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();

/**
 * The editors entered a few posts twice, and a two-day event as two days; show each title
 * once, and none already in `shown`.
 */
function uniqueTitles<T extends { title: string }>(items: T[], shown = new Set<string>()): T[] {
	const seen = new Set(shown);
	return items.filter((item) => {
		const key = titleKey(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function welcomeSlide(): HeroSlide {
	const { hero } = site;
	return { id: "noi-de-tro-ve", ...hero, text: site.intro };
}

/**
 * An editor's picture as a frame: 640, 960, 1280 and 1920 px copies, and a small one for the
 * row under the hero. A phone like PageSpeed's (412 px at 1.75, so 721 device pixels) takes
 * the 960 copy, where it got the 1280 one before (PageSpeed 22/11/2026: 60–70 KB more than
 * the frame needs); smaller phones take 640, phones at 3x still take 1280. The thumbnails are
 * 65–80 px: the 360 copy, not the 640 one. HERO_PHONE is the one width only the hero asks
 * for: a handful of frames, so a handful of transformations more in the monthly quota.
 */
const HERO_PHONE = 960;

function framePicture({ src, position }: MediaImage): HeroImage {
	return {
		src: imageAt(src, IMAGE_WIDTH.full),
		srcSet: imageSrcSet(src, [IMAGE_WIDTH.card, HERO_PHONE, IMAGE_WIDTH.wide, IMAGE_WIDTH.full]),
		thumb: imageAt(src, IMAGE_WIDTH.small),
		position,
	};
}

/** The newest post with a picture, as the hero's "pháp sự mới nhất" frame. */
function latestSlide(posts: PostSummary[]): HeroSlide | null {
	const post = posts.find((item) => item.banner);
	if (!post?.banner) return null;
	return {
		id: `bai-${post.id}`,
		overline: `Pháp sự mới nhất · ${formatDate(post.publishedDate)}`,
		title: post.title,
		text: post.summary,
		link: { label: "Xem bài", href: postHref(post) },
		image: framePicture(post.banner),
	};
}

function toUpcoming(event: ScheduleEvent, now: Date): UpcomingEvent {
	const today = todayInVietnam(now);
	const days = daysUntil(event.start, now);
	return {
		event,
		href: calendarHref({ month: event.start.slice(0, 7), type: "" }, today, `#su-kien-${event.slug}`),
		status: eventStatus(event, today),
		countdown: days < 0 ? "Đang diễn ra" : countdownLabel(days),
	};
}

/** Frame 2: the next event to begin, with the days left. */
function eventSlide({ event, href, countdown }: UpcomingEvent): HeroSlide {
	const times = event.times.map((slot) => `${slot.label} ${slot.time}`.trim());
	const facts = [solarRange(event), `Âm lịch ${lunarRange(event)}`, ...times, event.location].filter(Boolean);
	const image = event.image ?? { src: site.hero.image.src, position: site.hero.image.position };
	return {
		id: `khoa-tu-${event.id}`,
		overline: `Khóa tu sắp tới · ${countdown}`,
		title: event.title,
		text: facts.join(" · "),
		link: { label: "Xem lịch khóa tu", href },
		image: framePicture(image),
	};
}

/** This month's theme first, then the months after it, round the year. */
function versesFrom(themes: MonthTheme[], month: number): MonthTheme[] {
	const withVerse = themes.filter((theme) => theme.lines.length);
	return [...withVerse.filter((theme) => theme.month >= month), ...withVerse.filter((theme) => theme.month < month)];
}

/** Tôn tượng and khu vực join the figures with their sections (T15, T16). */
function welcomeFrom(topics: AboutTopic[], teachers: AboutTopic[], stats: HomeStat[]): Welcome | null {
	const history = topics.find((topic) => topic.group.slug === HISTORY_GROUP);
	if (!history) return null;
	return {
		title: history.quote?.lines[0] ?? history.subtitle,
		author: history.quote?.author ?? "",
		text: history.overview,
		href: `/gioi-thieu/${history.slug}`,
		image: history.portrait ?? history.banner,
		faces: teachers
			.map((topic) => topic.portrait ?? topic.banner)
			.filter((face): face is MediaImage => face !== null)
			.slice(0, FACES),
		stats,
	};
}

const NO_EXTRAS: HomeExtras = { settings: {}, quotes: [], media: {} };

/** The admin's own hero frames; a frame whose picture is gone keeps the site's picture. */
function customSlides(slides: HeroSlideSetting[], media: Record<string, string>): HeroSlide[] {
	return slides.map((slide) => {
		const src = slide.imageMediaId ? media[slide.imageMediaId] : undefined;
		const portrait = slide.portraitMediaId ? media[slide.portraitMediaId] : undefined;
		const image: HeroImage = src
			? {
					...framePicture({ src, position: slide.imagePosition || "center 50%" }),
					portrait: portrait ? imageAt(portrait, IMAGE_WIDTH.wide) : undefined,
					portraitSrcSet: portrait ? imageSrcSet(portrait, [IMAGE_WIDTH.card, HERO_PHONE, IMAGE_WIDTH.wide]) : undefined,
				}
			: { ...site.hero.image };
		return {
			id: `tuy-chinh-${slide.id}`,
			title: slide.title,
			subtitle: slide.subtitle || undefined,
			text: slide.text,
			link: { label: slide.ctaLabel || site.hero.link.label, href: slide.ctaHref || site.hero.link.href },
			image,
		};
	});
}

/** Today's figures by their source; the admin may list fewer figures, reword them or type one by hand. */
function statsFrom(setting: StatSetting[] | null, year: BuddhistYearSetting | null, counts: { dongChay: number; triTue: number }, today: string): HomeStat[] {
	const phatLich = year?.mode === "manual" ? year.value : buddhistYear(today);
	const bySource = (source: StatSetting["source"], value: number): Pick<HomeStat, "value" | "year"> => {
		if (source === "auto-bai-dong-chay") return { value: counts.dongChay };
		if (source === "auto-bai-tri-tue") return { value: counts.triTue };
		if (source === "auto-phat-lich") return { value: phatLich, year: true };
		return { value };
	};
	if (setting) return setting.map((item) => ({ label: item.label, ...bySource(item.source, item.value) }));
	return [
		{ label: "Bài viết Dòng Chảy Hoằng Pháp", value: counts.dongChay },
		{ label: "Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp", value: counts.triTue },
		{ label: "Phật lịch", value: phatLich, year: true },
	];
}

/** Lời chào with the admin's words laid over the site's: each field that is set and valid wins, the rest stays. */
function withWelcomeSetting(base: Welcome | null, raw: unknown, media: Record<string, string>, stats: HomeStat[]): Welcome | null {
	const setting = readWelcome(raw);
	if (!setting) return base;
	const welcome: Welcome = base ?? { title: "", author: "", text: "", href: "/gioi-thieu", image: null, faces: [], stats };
	const src = setting.imageMediaId ? media[setting.imageMediaId] : undefined;
	const videoId = setting.videoUrl ? youtubeId(setting.videoUrl) : null;
	return {
		...welcome,
		title: setting.quote || welcome.title,
		author: setting.author ?? welcome.author,
		text: setting.paragraph || welcome.text,
		href: setting.linkHref || welcome.href,
		image: src ? { src, position: "center 50%" } : welcome.image,
		...(videoId ? { videoId } : {}),
		...(setting.linkLabel ? { linkLabel: setting.linkLabel } : {}),
	};
}

/**
 * `extras` is what the admin set for the home page (src/libs/homeData.ts); without it the page is built from the content and
 * src/config/site.ts alone. Anything in it that is not valid is ignored field by field.
 */
export async function loadHomeData(repo: ContentRepository, now = new Date(), extras: HomeExtras = NO_EXTRAS): Promise<HomeData> {
	const [newest, mostRead, schedule, topics, dongChay, triTue, tongChiArticles, areas] = await Promise.all([
		repo.listPosts({ section: LIVE_SECTIONS, sort: "newest", pageSize: NEWS_COUNT * 2 }),
		repo.listPosts({ section: LIVE_SECTIONS, sort: "views", pageSize: NEWS_COUNT * 4 }),
		repo.getSchedule(),
		repo.listAboutTopics(),
		repo.listPosts({ section: "dong-chay-hoang-phap", pageSize: 1 }),
		repo.listPosts({ section: "tri-tue-phat-phap", pageSize: 1 }),
		repo.listTongChi(),
		repo.listAreas(),
	]);
	const latest = uniqueTitles(newest.items).slice(0, NEWS_COUNT);
	const read = mostRead.items.filter((post) => post.views > 0);
	const popular = uniqueTitles(read, new Set(latest.map(titleKey))).slice(0, NEWS_COUNT);

	const today = todayInVietnam(now);
	const upcoming = uniqueTitles(schedule.events.filter((event) => event.end >= today))
		.slice(0, UPCOMING_COUNT)
		.map((event) => toUpcoming(event, now));
	const next = nextEvent(schedule.events, today);

	const heroSetting = readHero(extras.settings["home.hero"]);
	const hero = [
		...(heroSetting ? customSlides(heroSetting.slides, extras.media) : [welcomeSlide()]),
		next && heroSetting?.autoEvent !== false ? eventSlide(toUpcoming(next, now)) : null,
		heroSetting?.autoLatest !== false ? latestSlide(newest.items) : null,
	].filter((slide): slide is HeroSlide => slide !== null);
	const teachers = topics.filter((topic) => topic.group.slug === TEACHERS_GROUP);
	const groups = groupTongChi(tongChiArticles);
	const stats = statsFrom(readStats(extras.settings["home.stats"]), readBuddhistYear(extras.settings["home.buddhist_year"]), { dongChay: dongChay.total, triTue: triTue.total }, today);
	const quotesSetting = readQuotesSetting(extras.settings["home.quotes"]);
	return {
		hero,
		upcoming,
		latest: latest.map(newsCard),
		popular: popular.map(newsCard),
		verses: versesFrom(schedule.themes, Number(today.slice(5, 7))),
		quotes: quotesSetting?.source === "trich-dan" && extras.quotes.length ? { items: extras.quotes, mode: quotesSetting.mode } : null,
		welcome: withWelcomeSetting(welcomeFrom(topics, teachers, stats), extras.settings["home.welcome"], extras.media, stats),
		teachers,
		tongChi: groups,
		paths: groups.find((group) => group.slug === tongChi.paths.group) ?? null,
		areas: templeAreas(areas).map(({ slug, number, name, subtitle, cover }) => ({ slug, number, name, subtitle, cover })),
	};
}
