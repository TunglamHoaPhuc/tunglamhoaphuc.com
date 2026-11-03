// What the home page shows, read from the content layer on the server and handed to the
// Bexon sections as props.
import { site } from "@/config/site";
import { calendarHref, type EventStatus, eventStatus, lunarRange, solarRange, todayInVietnam } from "@/libs/calendar";
import type { ContentRepository, MonthTheme, PostSummary, ScheduleEvent } from "@/libs/content/types";
import { countdownLabel, daysUntil } from "@/libs/countdown";
import { formatDate } from "@/libs/format";
import { postHref } from "@/libs/postList";

/** Sections whose post pages are built; home lists take posts from these only (T14, T17 add theirs). */
export const LIVE_SECTIONS = ["dong-chay-hoang-phap"];

const NEWS_COUNT = 6;
const UPCOMING_COUNT = 3;

export type HeroImage = {
	src: string;
	/** Sizes made for the site; editors' pictures come in one size. */
	srcSet?: string;
	/** An upright crop for phones held upright. */
	portrait?: string;
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

export type HomeData = {
	hero: HeroSlide[];
	/** Khóa tu sắp tới: the next events still running or to come. */
	upcoming: UpcomingEvent[];
	/** Tin mới nhất. */
	latest: PostSummary[];
	/** Dấu ấn hoằng pháp: most read, leaving out what Tin mới nhất already shows. */
	popular: PostSummary[];
	/** Lời Thầy dạy: the month themes' verses, from this month on. */
	verses: MonthTheme[];
};

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
		image: { src: post.banner.src, thumb: post.banner.src, position: post.banner.position },
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
		image: { src: image.src, thumb: image.src, position: image.position },
	};
}

/** This month's theme first, then the months after it, round the year. */
function versesFrom(themes: MonthTheme[], month: number): MonthTheme[] {
	const withVerse = themes.filter((theme) => theme.lines.length);
	return [...withVerse.filter((theme) => theme.month >= month), ...withVerse.filter((theme) => theme.month < month)];
}

export async function loadHomeData(repo: ContentRepository, now = new Date()): Promise<HomeData> {
	const [newest, mostRead, schedule] = await Promise.all([
		repo.listPosts({ section: LIVE_SECTIONS, sort: "newest", pageSize: NEWS_COUNT * 2 }),
		repo.listPosts({ section: LIVE_SECTIONS, sort: "views", pageSize: NEWS_COUNT * 4 }),
		repo.getSchedule(),
	]);
	const latest = uniqueTitles(newest.items).slice(0, NEWS_COUNT);
	const read = mostRead.items.filter((post) => post.views > 0);
	const popular = uniqueTitles(read, new Set(latest.map(titleKey))).slice(0, NEWS_COUNT);

	const today = todayInVietnam(now);
	const upcoming = uniqueTitles(schedule.events.filter((event) => event.end >= today))
		.slice(0, UPCOMING_COUNT)
		.map((event) => toUpcoming(event, now));
	const next = schedule.events.find((event) => event.start >= today);

	const hero = [welcomeSlide(), next ? eventSlide(toUpcoming(next, now)) : null, latestSlide(newest.items)].filter(
		(slide): slide is HeroSlide => slide !== null,
	);
	return { hero, upcoming, latest, popular, verses: versesFrom(schedule.themes, Number(today.slice(5, 7))) };
}
