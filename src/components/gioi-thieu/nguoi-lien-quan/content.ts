import type { AboutTopic } from "@/libs/content/types";
import type { GioiThieuTopicDetail } from "./data";
import { SU_TO_DETAIL } from "./data";

// The pages of "Người Liên Quan" (Giới thiệu › nguoi-lien-quan): which layout a topic takes and
// the topic in the shape the old site's components read.

/** The Giới thiệu group these layouts are for. */
export const NGUOI_LIEN_QUAN = "nguoi-lien-quan";

/**
 * Topics with an Odyssey view: its seven chapters, books, relics and steles are written into
 * TieuSuSuToOdysseyView for Sư Tổ Ngộ Chân Tử, as on the old site, so the view exists only
 * where that material does. Every other topic of the group, including those editors add later,
 * takes the detail layout (decided 22/11/2026). Choosing the layout per topic in the admin
 * would need a new field: not added.
 */
const ODYSSEY_TOPICS: Record<string, GioiThieuTopicDetail> = { "tieu-su-su-to": SU_TO_DETAIL };

export type NguoiLienQuanLayout = { kind: "odyssey"; detail: GioiThieuTopicDetail } | { kind: "detail"; detail: GioiThieuTopicDetail };

/** The layout of a topic of the group, or `null` for topics of other groups. */
export function nguoiLienQuanLayout(topic: AboutTopic): NguoiLienQuanLayout | null {
	if (topic.group.slug !== NGUOI_LIEN_QUAN) return null;
	const odyssey = ODYSSEY_TOPICS[topic.slug];
	return odyssey ? { kind: "odyssey", detail: odyssey } : { kind: "detail", detail: toDetail(topic) };
}

/** The other topics of Giới thiệu, as the old pages list them under the text. */
export function otherTopicsOf(topics: AboutTopic[]) {
	return topics.map((topic) => ({ id: topic.id, slug: topic.slug, title: topic.title, tag: topic.tag }));
}

/** A topic of the content repository (snapshot, B2 or D1) in the old site's record shape. */
export function toDetail(topic: AboutTopic): GioiThieuTopicDetail {
	return {
		id: topic.id,
		slug: topic.slug,
		title: topic.title,
		subtitle: topic.subtitle,
		tag: topic.tag,
		groupCategory: topic.group.slug,
		groupCategoryName: topic.group.name,
		heroBanner: topic.banner?.src ?? "",
		heroBannerPosition: topic.banner?.position,
		portraitImage: topic.portrait?.src ?? "",
		portraitImagePosition: topic.portrait?.position,
		overviewSummary: topic.overview,
		quoteTitle: topic.quote?.title ?? "",
		quoteContent: topic.quote?.lines ?? [],
		quoteAuthor: topic.quote?.author ?? "",
		milestones: topic.milestones.map((item) => ({ year: item.label, title: item.title, description: item.description })),
		content: htmlToArticleText(topic.contentHtml),
		galleryImages: topic.gallery.map((photo) => ({ url: photo.src, caption: photo.caption })),
	};
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };
const decode = (text: string) => text.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);

/** Inline HTML back to the old admin's marks: **bold**, [label](link); other tags dropped. */
function inline(html: string): string {
	return decode(
		html
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
			.replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
			.replace(/<(?!\/?(?:i|em|u)\b)[^>]+>/gi, ""),
	);
}

/**
 * The old pages draw the text with InfographicArticleRenderer, which reads the editors' light
 * Markdown (### headings, - lists, ![images]). The repository keeps the text as HTML only (D1's
 * content_html; renderContent for the snapshot), so the HTML goes back to that Markdown, block
 * by block. Text in any other HTML is passed on as it is: the renderer reads plain HTML too.
 */
export function htmlToArticleText(html: string): string {
	if (!html.trim()) return "";
	const blocks: string[] = [];
	const pattern = /<(h[1-6]|p|ul|ol|blockquote|figure)\b[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
	let last = 0;
	for (const match of html.matchAll(pattern)) {
		const between = html.slice(last, match.index).trim();
		if (between) blocks.push(inline(between));
		last = match.index + match[0].length;
		const [whole, tag, body] = match;
		const name = tag?.toLowerCase();
		if (!name) {
			if (/^<hr/i.test(whole)) blocks.push("---");
			continue;
		}
		if (/^h[1-6]$/.test(name)) blocks.push(`${"#".repeat(Math.max(2, Number(name[1])))} ${inline(body).trim()}`);
		else if (name === "p") blocks.push(inline(body).trim());
		else if (name === "blockquote") blocks.push(inline(body.replace(/<\/p>\s*<p[^>]*>/gi, "<br>")).trim().split("\n").map((line) => `> ${line}`).join("\n"));
		else if (name === "figure") {
			const src = body.match(/<img\s[^>]*\bsrc="([^"]*)"/i)?.[1];
			const alt = body.match(/<img\s[^>]*\balt="([^"]*)"/i)?.[1] ?? "";
			if (src) blocks.push(`![${decode(alt)}](${src})`);
		} else {
			const items = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => inline(item[1]).trim());
			blocks.push(items.map((item, index) => (name === "ol" ? `${index + 1}. ${item}` : `- ${item}`)).join("\n"));
		}
	}
	const rest = html.slice(last).trim();
	if (rest) blocks.push(inline(rest));
	return blocks.filter(Boolean).join("\n\n");
}
