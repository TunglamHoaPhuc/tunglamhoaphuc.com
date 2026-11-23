// A live post of Trí Tuệ Phật Pháp as the archive's card. Only what D1 holds: the view count is the real one
// (legacy views plus the ones counted since the import); a post nobody has read shows no number rather than 108.
import type { MediaType, WisdomItem } from "@/types/wisdom-tags";
import { chosenRelatedCards, type V3Post } from "@/lib/v3-data";

export const TRI_TUE_SECTION = "tri-tue-phat-phap";

const FALLBACK_THUMB = "https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp";

/** "2026-11-22" → "22/11/2026" (not the browser's locale, so the server and the browser agree). */
export function dmy(isoDate: string): string {
	const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * The kind of a post. What the editors filled in for the category comes first, as www shows it: a sound (pháp âm), then a
 * video (its own, or a YouTube id), then a book (ấn phẩm); only a post without any of these is told by its category slug
 * or title. A list record carries none of the extras (the list reads summaries), so there it is the slug that decides.
 */
export function mediaTypeOf(post: Pick<V3Post, "subCategory" | "title" | "videoBlock"> & Partial<Pick<V3Post, "audio" | "youtubeId" | "sourceBook">>): MediaType {
	if (post.audio?.src) return "audio";
	if (post.youtubeId || post.videoBlock?.videoUrl) return "video";
	if (post.sourceBook) return "book";
	const sub = post.subCategory || "";
	if (sub.includes("video")) return "video";
	if (sub.includes("phap-am") || (post.title || "").toLowerCase().includes("pháp âm")) return "audio";
	if (sub === "an-pham-sach") return "book";
	return "article";
}

export function toWisdomItem(p: V3Post): WisdomItem {
	return {
		id: String(p.id),
		slug: p.slug,
		title: p.title,
		type: mediaTypeOf(p),
		primaryCategoryTag: p.subtitle || p.categoryName || "Trí Tuệ Phật Pháp",
		originTag: { type: "space", label: "Trí Tuệ Phật Pháp", targetUrl: "/tri-tue-phat-phap" },
		publishDate: dmy(p.publishedDate || ""),
		views: p.viewsCount > 0 ? p.viewsCount : 0,
		thumbnailUrl: p.thumbnailUrl || p.bannerUrl || FALLBACK_THUMB,
		thumbnailPosition: p.thumbnailPosition || p.bannerPosition || "center center",
		excerpt: p.summary || p.subtitle || "",
		mediaUrl: p.videoBlock?.videoUrl || "",
	};
}

/**
 * Up to `limit` other live posts for "Tìm hiểu thêm". As on www the posts the editors chose (`related`, in their order, at
 * most three) come first and alone; with none chosen, the same category first, then the others. Never the post itself.
 */
export function relatedWisdom(current: Pick<V3Post, "id" | "slug" | "subCategory"> & Partial<Pick<V3Post, "related">>, all: V3Post[], limit = 3) {
	const chosen = chosenRelatedCards(current, FALLBACK_THUMB, "Trí Tuệ Phật Pháp");
	if (chosen.length) return chosen;
	const others = all.filter((p) => p.id !== current.id && p.slug !== current.slug);
	return [...others.filter((p) => p.subCategory === current.subCategory), ...others.filter((p) => p.subCategory !== current.subCategory)]
		.slice(0, limit)
		.map((p) => ({
			category: p.subtitle || p.categoryName || "Trí Tuệ Phật Pháp",
			title: p.title,
			url: p.thumbnailUrl || p.bannerUrl || FALLBACK_THUMB,
			link: `/tri-tue-phat-phap/${p.slug}`,
		}));
}
