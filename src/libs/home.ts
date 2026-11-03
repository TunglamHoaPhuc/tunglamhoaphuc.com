// What the home page shows, read from the content layer on the server and handed to the
// Bexon sections as props.
import { site } from "@/config/site";
import type { ContentRepository, PostSummary } from "@/libs/content/types";
import { formatDate } from "@/libs/format";
import { postHref } from "@/libs/postList";

/** Sections whose post pages are built; home lists take posts from these only (T14, T17 add theirs). */
export const LIVE_SECTIONS = ["dong-chay-hoang-phap"];

const NEWS_COUNT = 6;

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

export type HomeData = {
	hero: HeroSlide[];
	/** Tin mới nhất. */
	latest: PostSummary[];
	/** Dấu ấn hoằng pháp: most read, leaving out what Tin mới nhất already shows. */
	popular: PostSummary[];
};

const titleKey = (post: PostSummary) => post.title.toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();

/** The editors entered a few posts twice; show each title once, and none already in `shown`. */
function uniqueTitles(posts: PostSummary[], shown = new Set<string>()): PostSummary[] {
	const seen = new Set(shown);
	return posts.filter((post) => {
		const key = titleKey(post);
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

export async function loadHomeData(repo: ContentRepository): Promise<HomeData> {
	const [newest, mostRead] = await Promise.all([
		repo.listPosts({ section: LIVE_SECTIONS, sort: "newest", pageSize: NEWS_COUNT * 2 }),
		repo.listPosts({ section: LIVE_SECTIONS, sort: "views", pageSize: NEWS_COUNT * 4 }),
	]);
	const latest = uniqueTitles(newest.items).slice(0, NEWS_COUNT);
	const read = mostRead.items.filter((post) => post.views > 0);
	const popular = uniqueTitles(read, new Set(latest.map(titleKey))).slice(0, NEWS_COUNT);
	// Frame 2, the next retreat with its countdown, comes with the schedule (T12).
	const hero = [welcomeSlide(), latestSlide(newest.items)].filter((slide): slide is HeroSlide => slide !== null);
	return { hero, latest, popular };
}
