// "Tin mới nhất" on the home page: the cards of the carousel, built only from what D1 holds as live (published, or scheduled with
// its time come; not in the trash; an area / topic / statue not hidden). One builder serves the home page (server side, so the
// first paint already has the real cards) and /api/home/news-carousel, so the two cannot say different things.
//
// The carousel keeps its seven places (V3's design): the biography of the founder, the newest post, a Tông Chỉ article, a statue,
// then more posts and one more Tông Chỉ article. What goes into a place is the admin's:
//  - the posts are those of the two sections that have pages on V3 (Dòng chảy hoằng pháp, Trí tuệ Phật pháp), in the order www
//    uses for its own "Tin mới" (pinned first, then newest), a title shown once;
//  - a post, article, topic or statue the admin hid, left as a draft, scheduled for later or put in the trash is not read at all,
//    so it is not here and no card leads to a page that answers 404 (there is no "deleted list" any more, and none is needed);
//  - a place whose content does not exist is left out, not filled with text written in this file.
import type { StatueRecord } from "@/lib/statue-types";
import { getContentRepository } from "@/lib/tlhp-content/repository";
import { toPostRecord, type V3About, type V3Post, type V3TongChi } from "@/lib/v3-data";
import { liveAboutTopic, liveTongChiList } from "@/lib/v3-live";
import { liveStatueRecords, type StatueDeps } from "@/lib/v3-statues";

export type HomeNewsItem = {
	id: string;
	sourceType: "posts" | "tong-chi" | "bao-tuong" | "tri-tue-phat-phap" | "dong-chay-hoang-phap" | "gioi-thieu";
	category: string;
	subCategory?: string;
	iconUrl: string;
	title: string;
	subtitle: string;
	imgUrl: string;
	targetUrl: string;
	imgPosition?: string;
	date?: string;
};

/** The sections whose posts V3 opens (the same two www's home page lists). */
export const NEWS_SECTIONS = ["dong-chay-hoang-phap", "tri-tue-phat-phap"];

/** The topic of Giới thiệu the carousel opens with, and the Tông Chỉ article it prefers for its second place (V3's design). */
export const NEWS_SU_TO_SLUG = "tieu-su-su-to";
export const NEWS_TONG_CHI_SLUG = "bo-de-tam-coi-nguon-thien-phap";
/** The statue the carousel prefers; when it is not live the first live statue stands in. */
export const NEWS_STATUE_CODE = "TP0001";

/** What a card's picture is when its item has none: design, not data (the same temple pictures V3's other blocks use). */
const FALLBACK_IMAGE = {
	post: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp",
	tongChi: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/02-tong-chi-tu-hoc/tong-chi-tu-hoc-hub-banner.webp",
	statue: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp",
	suTo: "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/07-anh-tho-cac-vi-cao-tang/su-to-ngo-chan-tu/hinh-su-to-final-19d1002.webp",
};

/** Where V3 opens a post of each section. */
export function postHref(post: Pick<V3Post, "mainCategory" | "slug">): string {
	return `/${post.mainCategory === "tri-tue-phat-phap" ? "tri-tue-phat-phap" : "dong-chay-hoang-phap"}/${post.slug}`;
}

/** The mark of a card by where it comes from, and for posts by their category. */
export function newsIcon(mainCategory?: string, subCategory?: string): string {
	const sub = (subCategory || "").toLowerCase();
	if (mainCategory === "tong-chi-tu-hoc") return "/images/icons/icon-tong-chi-tu-hoc.webp";
	if (mainCategory === "bao-tuong") return "/images/icons/icon-cac-bao-tuong-noi-bat.webp";
	if (mainCategory === "tri-tue-phat-phap") return sub === "phap-am" ? "/images/icons/icon-phap-am.webp" : "/images/icons/icon-tri-tue-phat-phap.webp";
	if (sub === "khoa-le-truyen-thong") return "/images/icons/icon-khoa-le-truyen-thong.png";
	if (sub === "dai-le-su-kien") return "/images/icons/icon-dai-le-su-kien.png";
	if (sub === "cong-tu" || sub === "su-kien-dinh-ky") return "/images/icons/icon-cong-tu.png";
	if (sub === "tinh-do-nhan-gian") return "/images/icons/icon-tinh-do-nhan-gian.png";
	return "/images/icons/icon-dong-chay-hoang-phap.webp";
}

const titleKey = (title: string) => title.toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();

/** A title shown once (the editors entered a few posts twice), as www's home does. */
function uniqueTitles(posts: V3Post[]): V3Post[] {
	const seen = new Set<string>();
	return posts.filter((post) => {
		const key = titleKey(post.title);
		if (!post.slug || !key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function postCard(post: V3Post, defaults: { category: string; subCategory?: string; subtitle: string }): HomeNewsItem {
	return {
		id: post.id,
		sourceType: post.mainCategory === "tri-tue-phat-phap" ? "tri-tue-phat-phap" : "dong-chay-hoang-phap",
		category: post.categoryName || defaults.category,
		subCategory: post.subCategory || defaults.subCategory,
		iconUrl: newsIcon(post.mainCategory, post.subCategory),
		title: post.title.toUpperCase(),
		subtitle: post.subtitle || defaults.subtitle,
		imgUrl: post.thumbnailUrl || post.bannerUrl || FALLBACK_IMAGE.post,
		imgPosition: post.thumbnailPosition || post.bannerPosition || "center 35%",
		targetUrl: postHref(post),
		date: post.publishedDate || undefined,
	};
}

type NewsTongChi = Pick<V3TongChi, "id" | "slug" | "title" | "subtitle" | "excerpt" | "category" | "bannerImage" | "bannerPosition">;

function tongChiCard(article: NewsTongChi, fallbackSubtitle: string): HomeNewsItem {
	return {
		id: `tong-chi-${article.id}`,
		sourceType: "tong-chi",
		category: "Tông Chỉ Tu Học",
		subCategory: article.category,
		iconUrl: newsIcon("tong-chi-tu-hoc"),
		title: article.title.toUpperCase(),
		subtitle: article.subtitle || article.excerpt || fallbackSubtitle,
		imgUrl: article.bannerImage || FALLBACK_IMAGE.tongChi,
		imgPosition: article.bannerPosition || "center 35%",
		targetUrl: `/tong-chi-tu-hoc/${article.slug}`,
	};
}

export type HomeNewsInput = {
	/** Live posts in the order www lists them (pinned first, newest first); only the sections V3 opens are used. */
	posts: V3Post[];
	/** Live Tông Chỉ articles in the editors' order. */
	tongChi: NewsTongChi[];
	/** Live statues. */
	statues: StatueRecord[];
	/** The live topic "tieu-su-su-to", or `null` when it is hidden, a draft or deleted. */
	suTo: Pick<V3About, "title" | "subtitle" | "heroBanner" | "heroBannerPosition"> | null;
};

/** The carousel's cards from what is live. Pure. */
export function buildHomeNews({ posts, tongChi, statues, suTo }: HomeNewsInput): HomeNewsItem[] {
	const result: HomeNewsItem[] = [];
	const sorted = uniqueTitles(posts.filter((p) => NEWS_SECTIONS.includes(p.mainCategory)));
	const used = new Set<string>();
	const nextPost = (pick: (p: V3Post) => boolean = () => true) => {
		const post = sorted.find((p) => !used.has(p.id) && pick(p));
		if (post) used.add(post.id);
		return post;
	};

	// Place 0: the founder's biography, only while the admin keeps the topic on the site.
	if (suTo) {
		result.push({
			id: `gioi-thieu-${NEWS_SU_TO_SLUG}`,
			sourceType: "gioi-thieu",
			category: "Tiểu Sử Sư Tổ",
			subCategory: NEWS_SU_TO_SLUG,
			iconUrl: newsIcon("tong-chi-tu-hoc"),
			title: suTo.title.toUpperCase(),
			subtitle: suTo.subtitle,
			imgUrl: suTo.heroBanner || FALLBACK_IMAGE.suTo,
			imgPosition: suTo.heroBannerPosition || "center 20%",
			targetUrl: `/gioi-thieu/${NEWS_SU_TO_SLUG}`,
		});
	}

	// Place 1: the newest post.
	const newest = nextPost();
	if (newest) result.push(postCard(newest, { category: newest.mainCategory === "tri-tue-phat-phap" ? "Trí Tuệ Phật Pháp" : "Dòng Chảy Hoằng Pháp", subtitle: "Dòng Chảy Hoằng Pháp Tùng Lâm Hòa Phúc" }));

	// Place 2: a Tông Chỉ article (Bồ Đề Tâm; the first live article when that one is not live).
	const first = tongChi.find((a) => a.slug === NEWS_TONG_CHI_SLUG) ?? tongChi[0];
	if (first) result.push(tongChiCard(first, "Cội Nguồn Thiện Pháp"));

	// Place 3: a statue (TP0001 when live, else the first live one).
	const statue = statues.find((s) => s.code === NEWS_STATUE_CODE) ?? statues[0];
	if (statue) {
		result.push({
			id: `statue-${statue.code || statue.id}`,
			sourceType: "bao-tuong",
			category: "Bảo Tượng Phật Giáo",
			iconUrl: newsIcon("bao-tuong"),
			title: (statue.title || statue.name || "").toUpperCase(),
			subtitle: statue.subtitle || "",
			imgUrl: statue.imgUrl || statue.avatarUrl || FALLBACK_IMAGE.statue,
			imgPosition: statue.imgPosition || "center 35%",
			targetUrl: `/bao-tuong/${statue.slug}`,
		});
	}

	// Place 4: the second post.
	const second = nextPost();
	if (second) result.push(postCard(second, { category: "Đại Lễ Sự Kiện", subCategory: "dai-le-su-kien", subtitle: "Dòng Chảy Hoằng Pháp Tùng Lâm Hòa Phúc" }));

	// Place 5: a Trí Tuệ Phật Pháp post (any other post when there is none left).
	const wisdom = nextPost((p) => p.mainCategory === "tri-tue-phat-phap") ?? nextPost();
	if (wisdom) result.push(postCard(wisdom, { category: "Trí Tuệ Phật Pháp", subtitle: "Trí Tuệ Phật Pháp Tùng Lâm Hòa Phúc" }));

	// Place 6: the next post.
	const more = nextPost();
	if (more) result.push(postCard(more, { category: "Cộng Tu Định Kỳ", subtitle: "Dòng Chảy Hoằng Pháp Tùng Lâm Hòa Phúc" }));

	// Place 7: one more Tông Chỉ article, not the one of place 2.
	const other = tongChi.find((a) => a !== first);
	if (other) result.push(tongChiCard(other, "Tông Phong Truyền Thừa"));

	return result;
}

/**
 * Reads what is live and builds the cards. Throws when D1 cannot be read: the caller decides what to show instead (the page shows
 * no news block, the API answers an error), never a copy written in the code.
 */
export async function loadHomeNews(deps: StatueDeps = {}): Promise<HomeNewsItem[]> {
	const r = deps.repo ?? (await getContentRepository());
	// The newest 60 posts of the two sections are far more than the carousel's four places; the order is www's own.
	const [page, tongChi, statues, suTo] = await Promise.all([
		r.listPosts({ section: NEWS_SECTIONS, sort: "newest", pageSize: 60 }),
		liveTongChiList(r),
		liveStatueRecords({ ...deps, repo: r }),
		liveAboutTopic(NEWS_SU_TO_SLUG, r),
	]);
	return buildHomeNews({ posts: page.items.map(toPostRecord), tongChi, statues, suTo });
}
