// How the V3 article pages show the HTML of a body (V6). Two paths, one choice per body:
//
//  - Legacy-shaped bodies (what the import makes: p, br, headings, lists, blockquote, hr, links, bold and italic,
//    pictures with a caption) keep the look of the old pages. The renderer (InfographicArticleRenderer) was written
//    for Markdown-like lines, so the HTML is first turned into those lines (htmlToRendererText), headings, lists,
//    quotes, pictures and links included: it used to drop all of them.
//  - A body that has something the lines cannot hold (a table, a video, a sound, struck-out text) is shown as HTML
//    (richHtml → RichHtmlBody), styled with the site's theme.
//
// Either way what reaches the page has gone through the admin's sanitiser (tlhp-admin/content/html.ts) here on the
// V3 side too: parseSafe keeps only the admin's allow-list of tags and attributes and writes everything back escaped.
import { type HtmlNode, parseSafe, sanitizeHtml } from "@/lib/tlhp-admin/content/html";
import { decodeEntities } from "@/lib/tlhp-content/normalize";

const ANY_TAG = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?>/i;
/** Tags (and the editor's video frame) that the line format cannot hold. */
const RICH_TAG = /<(?:table|thead|tbody|tfoot|tr|td|th|caption|colgroup|iframe|audio|s|del|strike)(?=[\s>/])|<div[^>]*data-youtube-video/i;

/** Whether the text has any HTML tag in it (anything else is Markdown-like text and goes through unchanged). */
export const looksLikeHtml = (raw: string) => ANY_TAG.test(raw);

/** Whether the body must be shown as HTML rather than as the renderer's lines. */
export const needsRichHtml = (raw: string) => looksLikeHtml(raw) && RICH_TAG.test(raw);

/** The sanitised HTML of a body: the only HTML the rich path puts on the page. */
export const richHtml = (raw: string) => sanitizeHtml(raw);

const decode = (text: string) => decodeEntities(text).replace(/ /g, " ");
const oneLine = (text: string) => text.replace(/[[\]\n]+/g, " ").replace(/\s+/g, " ").trim();

/** Inline content as the renderer reads it: <b>, <i>, <u>, [text](href), line breaks as newlines. */
function inline(nodes: HtmlNode[]): string {
	let out = "";
	for (const node of nodes) {
		if (node.type === "text") {
			out += decode(node.text);
			continue;
		}
		const inner = () => inline(node.children);
		switch (node.tag) {
			case "br":
				out += "\n";
				break;
			case "strong":
			case "em":
			case "u": {
				const text = inner();
				const tag = node.tag === "strong" ? "b" : node.tag === "em" ? "i" : "u";
				out += text.trim() ? `<${tag}>${text}</${tag}>` : text;
				break;
			}
			case "a": {
				const text = inner().replace(/\n+/g, " ").trim();
				out += node.attrs.href && text ? `[${text}](${node.attrs.href})` : text;
				break;
			}
			case "img":
				out += picture(node, "");
				break;
			default:
				out += inner();
		}
	}
	return out;
}

const picture = (img: HtmlNode & { type: "element" }, caption: string) =>
	img.attrs.src ? `\n\n![${oneLine(caption || decode(img.attrs.alt ?? ""))}](${img.attrs.src})\n\n` : "";

const findTag = (nodes: HtmlNode[], tag: string): (HtmlNode & { type: "element" }) | undefined => {
	for (const node of nodes) {
		if (node.type !== "element") continue;
		if (node.tag === tag) return node;
		const inner = findTag(node.children, tag);
		if (inner) return inner;
	}
	return undefined;
};

function listLines(list: HtmlNode & { type: "element" }, depth = 0): string[] {
	const lines: string[] = [];
	let index = 0;
	for (const item of list.children) {
		if (item.type !== "element" || item.tag !== "li") continue;
		index++;
		const marker = list.tag === "ol" ? `${index}.` : "-";
		const nested = item.children.filter((c): c is HtmlNode & { type: "element" } => c.type === "element" && (c.tag === "ul" || c.tag === "ol"));
		const own = inline(item.children.filter((c) => !nested.includes(c as never))).replace(/\n+/g, " ").trim();
		lines.push(`${marker} ${own}`.trimEnd());
		for (const sub of nested) lines.push(...listLines(sub, depth + 1));
	}
	return lines;
}

function blocks(nodes: HtmlNode[]): string {
	let out = "";
	for (const node of nodes) {
		if (node.type === "text") {
			out += decode(node.text);
			continue;
		}
		switch (node.tag) {
			case "h2":
			case "h3":
			case "h4":
				out += `\n\n### ${oneLine(inline(node.children).replace(/<\/?[biu]>/g, ""))}\n\n`;
				break;
			case "p":
				out += `\n\n${inline(node.children)}\n\n`;
				break;
			case "blockquote": {
				const lines = blocks(node.children).split("\n").map((l) => l.trim()).filter(Boolean);
				out += `\n\n${lines.map((l) => `> ${l}`).join("\n")}\n\n`;
				break;
			}
			case "ul":
			case "ol":
				out += `\n\n${listLines(node).join("\n")}\n\n`;
				break;
			case "hr":
				out += "\n\n---\n\n";
				break;
			case "figure": {
				const img = findTag(node.children, "img");
				const caption = findTag(node.children, "figcaption");
				out += img ? picture(img, caption ? inline(caption.children).replace(/<\/?[biu]>/g, "") : "") : blocks(node.children);
				break;
			}
			case "img":
				out += picture(node, "");
				break;
			case "br":
				out += "\n";
				break;
			case "strong":
			case "em":
			case "u":
			case "a":
				out += inline([node]);
				break;
			default:
				out += blocks(node.children);
		}
	}
	return out;
}

/**
 * The renderer's lines for a body. Text without any tag is returned as it is. HTML is cleaned by the admin's
 * sanitiser first, then written as lines: `### ` for headings, `> ` for quotes, `- ` / `1. ` for lists, `---` for
 * rules, `![caption](src)` for pictures, `[text](href)` for links, and <b>/<i>/<u> kept for the inline marks.
 */
export function htmlToRendererText(raw: string): string {
	if (!looksLikeHtml(raw)) return raw;
	return blocks(parseSafe(raw))
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

// A link in a renderer line: [text](address). The sanitiser only lets https, mailto, "#" and addresses on this site through.
const LINK = /\[([^\]\n]+)\]\((https:\/\/[^)\s]*|mailto:[^)\s]*|#[^)\s]*|\/(?!\/)[^)\s]*)\)/g;

export type InlinePart = { text: string; href?: string };

/** A line cut into plain pieces and links, in order; a line without links is one piece. */
export function splitLinks(line: string): InlinePart[] {
	const parts: InlinePart[] = [];
	let last = 0;
	for (const match of line.matchAll(LINK)) {
		if (match.index > last) parts.push({ text: line.slice(last, match.index) });
		parts.push({ text: match[1], href: match[2] });
		last = match.index + match[0].length;
	}
	if (last < line.length || parts.length === 0) parts.push({ text: line.slice(last) });
	return parts;
}
