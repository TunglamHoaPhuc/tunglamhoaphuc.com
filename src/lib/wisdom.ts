// A live post of Trí Tuệ Phật Pháp as the archive's card. Only what D1 holds: the view count is the real one
// (legacy views plus the ones counted since the import); a post nobody has read shows no number rather than 108.
import type { MediaType, WisdomItem } from "@/types/wisdom-tags";
import type { V3Post } from "@/lib/v3-data";

export const TRI_TUE_SECTION = "tri-tue-phat-phap";

const FALLBACK_THUMB = "https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp";

/** "2026-11-22" → "22/11/2026" (not the browser's locale, so the server and the browser agree). */
export function dmy(isoDate: string): string {
	const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function mediaTypeOf(post: Pick<V3Post, "subCategory" | "title" | "videoBlock">): MediaType {
	const sub = post.subCategory || "";
	if (post.videoBlock?.videoUrl || sub.includes("video")) return "video";
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

/** Up to `limit` other live posts for "Tìm hiểu thêm": the same category first, never the post itself. */
export function relatedWisdom(current: Pick<V3Post, "id" | "slug" | "subCategory">, all: V3Post[], limit = 3) {
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
