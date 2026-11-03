// Shared clean-up for the old admin's data: dates, text and article bodies. Used by every
// source (snapshot, B2, the D1 import script), so all of them produce the same output.
import { isEmojiImage, isMovingLink, mediaUrl } from "./media";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function isoDate(year: number, month: number, day: number): string | null {
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
	return date.toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD from the three date styles of the old admin: "2026-10-17" (posts),
 * an ISO timestamp (tong-chi `publishedAt`, read as a day in Vietnam) and "04.10.2026"
 * (schedule `solarDateStr`). `null` when the value is missing or not a real day.
 */
export function toIsoDate(value: string | null | undefined): string | null {
	const text = value?.trim();
	if (!text) return null;
	let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (match) return isoDate(+match[1], +match[2], +match[3]);
	match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
	if (match) return isoDate(+match[3], +match[2], +match[1]);
	if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
		const time = Date.parse(text);
		return Number.isNaN(time) ? null : new Date(time + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
	}
	return null;
}

const NAMED_ENTITIES: Record<string, string> = {
	nbsp: " ",
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	ndash: "–",
	mdash: "—",
	hellip: "…",
};

/** Turns the few HTML entities found in the plain-text fields ("&nbsp;") into characters. */
export function decodeEntities(text: string): string {
	return text.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]+);/gi, (entity, name: string) => {
		if (name[0] === "#") {
			const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
			return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
		}
		return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
	});
}

// Half of an emoji, left where a text was cut in the middle of one; it shows as "�".
const BROKEN_CHARACTER = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Entities decoded and broken characters dropped: the first step for every text field. */
export function cleanText(text: string): string {
	return decodeEntities(text).replace(BROKEN_CHARACTER, "");
}

export function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Notes about a body, for the data report: emoji pictures dropped, links that move. */
export type ContentNote = { kind: "emoji-image" | "moved-link"; url: string };

function safeHref(url: string, notes: ContentNote[]): string | null {
	if (/^(mailto|tel):/i.test(url)) return url;
	if (isMovingLink(url)) notes.push({ kind: "moved-link", url });
	return mediaUrl(url);
}

// A link target may hold one level of brackets: (javascript:alert(1)), (…/anh_(1).jpg).
const TARGET = String.raw`((?:[^()\s]|\([^()\s]*\))+)`;
// [text](url) · a bare https link · **bold**
const INLINE = new RegExp(
	String.raw`\[([^\]\n]+)\]\(${TARGET}\)|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])|\*\*([^*\n]+)\*\*`,
	"g",
);

function renderInline(text: string, notes: ContentNote[]): string {
	let html = "";
	let last = 0;
	for (const match of text.matchAll(INLINE)) {
		html += escapeHtml(text.slice(last, match.index));
		last = match.index + match[0].length;
		const [, label, target, bare, bold] = match;
		if (bold !== undefined) {
			html += `<strong>${escapeHtml(bold)}</strong>`;
			continue;
		}
		const href = safeHref(target ?? bare, notes);
		const shown = escapeHtml(label ?? bare);
		html += href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${shown}</a>` : shown;
	}
	return html + escapeHtml(text.slice(last));
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const QUOTE = /^>\s?(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;
const BULLET = /^[-*•]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;
const IMAGE = new RegExp(String.raw`^!\[([^\]]*)\]\(${TARGET}\)$`);

type Block = { tag: "p" | "blockquote" | "ul" | "ol"; lines: string[] };

/**
 * Turns the old admin's light Markdown into HTML: paragraphs split by blank lines, line
 * breaks, `#` headings (h2 and below; the page title is the h1), `>` quotes, `*` and `1.`
 * lists, `---` rules, images, [links](…), bare links and **bold**. All text is escaped
 * first and only those tags are produced, so no markup from the source reaches the page:
 * no <script>, no on* attributes, and links are only http(s), mailto or tel.
 */
export function renderContent(markdown: string, notes: ContentNote[] = []): string {
	const out: string[] = [];
	let block: Block | null = null;

	const flush = () => {
		if (!block) return;
		const { tag, lines } = block;
		if (tag === "ul" || tag === "ol") out.push(`<${tag}>${lines.map((line) => `<li>${renderInline(line, notes)}</li>`).join("")}</${tag}>`);
		else {
			const text = lines.map((line) => renderInline(line, notes)).join("<br>");
			out.push(tag === "p" ? `<p>${text}</p>` : `<blockquote><p>${text}</p></blockquote>`);
		}
		block = null;
	};
	const add = (tag: Block["tag"], line: string) => {
		if (block?.tag !== tag) flush();
		block ??= { tag, lines: [] };
		block.lines.push(line);
	};

	for (const raw of cleanText(markdown).replace(/\r\n?/g, "\n").split("\n")) {
		const line = raw.trim();
		if (!line) {
			flush();
			continue;
		}
		const quote = line.match(QUOTE);
		if (quote) {
			// "> ### Lead sentence": the quote is the emphasis; drop the heading marks inside.
			const inner = quote[1].replace(/^#{1,6}\s+/, "").trim();
			if (inner) add("blockquote", inner);
			continue;
		}
		const heading = line.match(HEADING);
		if (heading) {
			flush();
			const level = Math.min(Math.max(heading[1].length, 2), 4);
			out.push(`<h${level}>${renderInline(heading[2], notes)}</h${level}>`);
			continue;
		}
		if (RULE.test(line)) {
			flush();
			out.push("<hr>");
			continue;
		}
		const image = line.match(IMAGE);
		if (image) {
			flush();
			if (isEmojiImage(image[2])) {
				notes.push({ kind: "emoji-image", url: image[2] });
				continue;
			}
			const src = mediaUrl(image[2]);
			if (src) out.push(`<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}" loading="lazy" decoding="async"></figure>`);
			continue;
		}
		const bullet = line.match(BULLET);
		if (bullet) {
			add("ul", bullet[1]);
			continue;
		}
		const numbered = line.match(NUMBERED);
		if (numbered) {
			add("ol", numbered[1]);
			continue;
		}
		add("p", line);
	}
	flush();
	return out.join("\n");
}
