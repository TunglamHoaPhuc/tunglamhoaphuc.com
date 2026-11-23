// The body of an article as the site may show it (docs/admin-architecture.md 6.5): an allow-list of tags and
// attributes, built for what the editor (TipTap) and the old admin produce. It parses the HTML into a small tree
// with its own tokenizer (a Worker has no DOM), keeps only what is listed below and writes the tree out again,
// so what the browser reads is exactly what was checked: every attribute value is decoded, checked and escaped
// anew, nothing of a dropped element's code survives, and the output is always well formed.
//
// Kept: h2–h4 (h1 becomes h2, h5/h6 become h4), p, br, strong/b, em/i, u, s/strike/del, blockquote (class "kinh"
// or "tho" only), ul/ol/li, a (https, mailto and relative links; external ones open in a new tab with
// rel="noopener noreferrer"), the table family, figure/img/figcaption (pictures from /anh-goc/, /brand/ or https),
// iframe (YouTube without cookies only), audio (library media: its media id or a /anh-goc/ path; controls, preload none), hr, and the
// <div data-youtube-video> the editor puts around a video. Everything else is unwrapped (its text stays) or, for
// script, style, svg and the like, dropped with all it holds.
import { decodeEntities } from "../../libs/content/normalize";

export type HtmlNode = { type: "text"; text: string } | { type: "element"; tag: string; attrs: Record<string, string>; children: HtmlNode[] };

export type SanitizeOptions = {
	/** Hosts of the site itself: links there are not "external". */
	ownHosts?: string[];
	/** The current address of library pictures by media id: a picture or sound with `data-media-id` gets it. */
	mediaSrc?: ReadonlyMap<string, string>;
	/**
	 * Filled with the tag of every element the sanitiser dropped, unwrapped or rewrote (not with the attributes it tidies, nor the old
	 * tags it renames): empty means the editor shows what the page will. The service tells the editor when it is not empty.
	 */
	changes?: string[];
};

const DEFAULT_HOSTS = ["tunglamhoaphuc.com", "www.tunglamhoaphuc.com"];

// ------------------------------------------------------------------ tokens

type Token = { kind: "text"; text: string } | { kind: "start"; tag: string; attrs: [string, string][]; selfClosing: boolean } | { kind: "end"; tag: string };

/** Elements whose content is not markup: it runs to the matching end tag and is never kept. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript"]);

const isLetter = (char: string | undefined) => !!char && /[A-Za-z]/.test(char);
const isSpace = (char: string | undefined) => char === " " || char === "\n" || char === "\t" || char === "\r" || char === "\f";

function tokenize(html: string): Token[] {
	const tokens: Token[] = [];
	const length = html.length;
	let at = 0;
	let text = "";
	const flushText = () => {
		if (text) tokens.push({ kind: "text", text });
		text = "";
	};

	while (at < length) {
		const open = html.indexOf("<", at);
		if (open < 0) {
			text += html.slice(at);
			break;
		}
		text += html.slice(at, open);
		at = open;
		const next = html[at + 1];

		if (html.startsWith("<!--", at)) {
			flushText();
			// "<!-->" and "<!--->" close at once, as browsers read them.
			if (html.startsWith("<!-->", at)) at += 5;
			else if (html.startsWith("<!--->", at)) at += 6;
			else {
				const close = html.indexOf("-->", at + 4);
				at = close < 0 ? length : close + 3;
			}
			continue;
		}
		if (next === "!" || next === "?") {
			flushText();
			const close = html.indexOf(">", at + 2);
			at = close < 0 ? length : close + 1;
			continue;
		}
		if (next === "/") {
			flushText();
			if (!isLetter(html[at + 2])) {
				// "</ >", "</3>": a bogus comment to the next ">".
				const close = html.indexOf(">", at + 2);
				at = close < 0 ? length : close + 1;
				continue;
			}
			let end = at + 2;
			while (end < length && !isSpace(html[end]) && html[end] !== "/" && html[end] !== ">") end++;
			const tag = html.slice(at + 2, end).toLowerCase();
			const close = html.indexOf(">", end);
			if (close < 0) {
				break;
			}
			tokens.push({ kind: "end", tag });
			at = close + 1;
			continue;
		}
		if (!isLetter(next)) {
			text += "<";
			at++;
			continue;
		}

		// A start tag: its name, then attributes up to the ">" that is not inside quotes.
		flushText();
		let pos = at + 1;
		while (pos < length && !isSpace(html[pos]) && html[pos] !== "/" && html[pos] !== ">") pos++;
		const tag = html.slice(at + 1, pos).toLowerCase();
		const attrs: [string, string][] = [];
		let selfClosing = false;
		let closed = false;
		while (pos < length) {
			while (pos < length && (isSpace(html[pos]) || html[pos] === "/")) {
				if (html[pos] === "/" && html[pos + 1] === ">") selfClosing = true;
				pos++;
			}
			if (pos >= length) break;
			if (html[pos] === ">") {
				closed = true;
				pos++;
				break;
			}
			let nameEnd = pos + 1;
			while (nameEnd < length && !isSpace(html[nameEnd]) && html[nameEnd] !== "/" && html[nameEnd] !== ">" && html[nameEnd] !== "=") nameEnd++;
			const name = html.slice(pos, nameEnd).toLowerCase();
			pos = nameEnd;
			while (pos < length && isSpace(html[pos])) pos++;
			let value = "";
			if (html[pos] === "=") {
				pos++;
				while (pos < length && isSpace(html[pos])) pos++;
				const quote = html[pos];
				if (quote === '"' || quote === "'") {
					const end = html.indexOf(quote, pos + 1);
					if (end < 0) {
						pos = length;
						break;
					}
					value = html.slice(pos + 1, end);
					pos = end + 1;
				} else {
					let end = pos;
					while (end < length && !isSpace(html[end]) && html[end] !== ">") end++;
					value = html.slice(pos, end);
					pos = end;
				}
			}
			if (!attrs.some(([existing]) => existing === name)) attrs.push([name, value]);
		}
		// A tag cut off by the end of the input is dropped, as browsers do.
		if (!closed) {
			break;
		}
		tokens.push({ kind: "start", tag, attrs, selfClosing });
		at = pos;

		if (tag === "plaintext") {
			break;
		}
		if (RAW_TEXT.has(tag)) {
			// Skip to the matching end tag; the content never becomes markup or text.
			const pattern = new RegExp(`</${tag}(?=[\\s/>])`, "i");
			const match = pattern.exec(html.slice(at));
			if (!match) {
				break;
			}
			const close = html.indexOf(">", at + match.index);
			tokens.push({ kind: "end", tag });
			at = close < 0 ? length : close + 1;
		}
	}
	flushText();
	return tokens;
}

// ------------------------------------------------------------------ rules

const VOID = new Set(["br", "hr", "img", "col", "area", "base", "embed", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** Dropped with everything inside them. */
const DROP_WITH_CONTENT = new Set([
	"script", "style", "template", "noscript", "textarea", "title", "xmp", "noembed", "noframes", "svg", "math", "object", "embed", "applet", "select", "option", "head", "frameset", "frame", "button", "canvas", "video", "picture", "form",
]);

const RENAME: Record<string, string> = { b: "strong", i: "em", strike: "s", del: "s", h1: "h2", h5: "h4", h6: "h4" };

const ALLOWED = new Set([
	"h2", "h3", "h4", "p", "br", "strong", "em", "u", "s", "blockquote", "ul", "ol", "li", "a", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "figure", "img", "figcaption", "iframe", "audio", "hr", "div",
]);

const MEDIA_ID = /^[A-Za-z0-9_:.-]{1,120}$/;
// The video's id; of the address's options only the start time is kept. Both embed addresses of YouTube are read (the editor and
// pasted code give either) and written as the no-cookie one.
const YOUTUBE = /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,20})(?:\?(?:[^#]*&)?start=(\d{1,6})(?:&[^#]*)?|\?[^#]*)?$/;

/** The value an attribute really carries once entities are read, without the control characters browsers ignore. */
// Control characters become spaces, so "java\tscript:" can never read as a scheme (browsers drop tabs and newlines).
// eslint-disable-next-line no-control-regex
const decoded = (value: string) => decodeEntities(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim();

/** A link target this site may point to: https, mailto, or a path on the site. `null` for anything else. */
export function safeHref(value: string): string | null {
	const href = decoded(value);
	if (!href) return null;
	if (/^https:\/\/[^\s/?#]+/i.test(href)) return href;
	if (/^mailto:[^\s]+$/i.test(href)) return href;
	if (href.startsWith("#")) return href;
	if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) return href;
	return null;
}

/** A picture or sound the site may load: from the media host (/anh-goc/), the brand folder or https. */
export function safeMediaSrc(value: string): string | null {
	const src = decoded(value);
	if (/^https:\/\/[^\s/?#]+/i.test(src) && !/\s/.test(src)) return src;
	if (/^\/(anh-goc|brand)\/[^\s\\]*$/.test(src) && !src.includes("..") && !src.startsWith("//")) return src;
	return null;
}

const isExternal = (href: string, hosts: string[]) => {
	const match = href.match(/^https:\/\/([^/?#:]+)/i);
	return !!match && !hosts.includes(match[1].toLowerCase());
};

const digits = (value: string | undefined, max: number) => {
	const n = value === undefined ? NaN : Number(decoded(value));
	return Number.isInteger(n) && n >= 1 && n <= max ? String(n) : null;
};

/** The attributes an allowed element keeps, checked and rebuilt; `null` means the element itself goes (its text stays). */
function attributesOf(tag: string, raw: [string, string][], options: SanitizeOptions): Record<string, string> | null {
	const get = (name: string) => raw.find(([key]) => key === name)?.[1];
	const out: Record<string, string> = {};
	switch (tag) {
		case "blockquote": {
			const kind = decoded(get("class") ?? "");
			if (kind === "kinh" || kind === "tho") out.class = kind;
			return out;
		}
		case "a": {
			const href = safeHref(get("href") ?? "");
			if (!href) return null;
			out.href = href;
			const title = get("title");
			if (title) out.title = decoded(title).slice(0, 200);
			if (isExternal(href, options.ownHosts ?? DEFAULT_HOSTS)) {
				out.target = "_blank";
				out.rel = "noopener noreferrer";
			}
			return out;
		}
		case "img": {
			const mediaId = decoded(get("data-media-id") ?? "");
			const known = MEDIA_ID.test(mediaId) ? options.mediaSrc?.get(mediaId) : undefined;
			const src = known ?? safeMediaSrc(get("src") ?? "");
			if (!src) return {};
			out.src = src;
			out.alt = decoded(get("alt") ?? "").slice(0, 300);
			if (MEDIA_ID.test(mediaId)) out["data-media-id"] = mediaId;
			const loading = decoded(get("loading") ?? "lazy");
			out.loading = loading === "eager" ? "eager" : "lazy";
			const width = digits(get("width"), 10000);
			const height = digits(get("height"), 10000);
			if (width) out.width = width;
			if (height) out.height = height;
			return out;
		}
		case "audio": {
			const mediaId = decoded(get("data-media-id") ?? "");
			const known = MEDIA_ID.test(mediaId) ? options.mediaSrc?.get(mediaId) : undefined;
			// Sound comes from the library only: its address by media id, or the site's own /anh-goc/ path (docs 6.5), never an outside host.
			const own = decoded(get("src") ?? "");
			const src = known ?? (own.startsWith("/anh-goc/") ? safeMediaSrc(own) : null);
			if (!src) return {};
			out.src = src;
			out.controls = "";
			out.preload = "none";
			if (MEDIA_ID.test(mediaId)) out["data-media-id"] = mediaId;
			return out;
		}
		case "iframe": {
			const asked = decoded(get("src") ?? "");
			const match = asked.match(YOUTUBE);
			if (!match) return {};
			out.src = `https://www.youtube-nocookie.com/embed/${match[1]}${match[2] ? `?start=${match[2]}` : ""}`;
			// Written another way than it came (the other host, or options dropped): the editor still holds the first.
			if (asked !== out.src) options.changes?.push("iframe");
			out.title = decoded(get("title") ?? "").slice(0, 200) || "Video YouTube";
			out.width = digits(get("width"), 4000) ?? "640";
			out.height = digits(get("height"), 4000) ?? "360";
			out.loading = "lazy";
			out.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture";
			out.referrerpolicy = "strict-origin-when-cross-origin";
			out.allowfullscreen = "";
			return out;
		}
		case "div":
			// Only the frame the editor puts around a video; any other div is unwrapped.
			return raw.some(([key]) => key === "data-youtube-video") ? { "data-youtube-video": "" } : null;
		case "th":
		case "td": {
			const colspan = digits(get("colspan"), 50);
			const rowspan = digits(get("rowspan"), 50);
			if (colspan && colspan !== "1") out.colspan = colspan;
			if (rowspan && rowspan !== "1") out.rowspan = rowspan;
			const scope = decoded(get("scope") ?? "");
			if (tag === "th" && ["row", "col", "rowgroup", "colgroup"].includes(scope)) out.scope = scope;
			return out;
		}
		case "col": {
			const span = digits(get("span"), 50);
			if (span && span !== "1") out.span = span;
			return out;
		}
		default:
			return out;
	}
}

/** Elements that are only kept when they could take what they need (a source). */
const NEEDS_SOURCE = new Set(["img", "audio", "iframe"]);

// ------------------------------------------------------------------ the tree

/** Text as it may stand in HTML: entity references kept, a bare & < > escaped. */
const safeText = (text: string) => text.replace(/&(?!(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The sanitised tree of `html`. */
export function parseSafe(html: string, options: SanitizeOptions = {}): HtmlNode[] {
	const root: HtmlNode & { type: "element" } = { type: "element", tag: "#root", attrs: {}, children: [] };
	const stack: (HtmlNode & { type: "element" })[] = [root];
	// While inside a dropped element: its tag and how deep the same tag is nested in it.
	let skip: { tag: string; depth: number } | null = null;

	for (const token of tokenize(html)) {
		if (skip) {
			if (token.kind === "start" && token.tag === skip.tag && !token.selfClosing) skip.depth++;
			if (token.kind === "end" && token.tag === skip.tag && --skip.depth === 0) skip = null;
			continue;
		}
		if (token.kind === "text") {
			const parent = stack[stack.length - 1];
			if (["table", "thead", "tbody", "tfoot", "tr", "colgroup", "ul", "ol", "audio", "iframe"].includes(parent.tag) && !token.text.trim()) continue;
			parent.children.push({ type: "text", text: safeText(token.text) });
			continue;
		}
		if (token.kind === "start") {
			if (DROP_WITH_CONTENT.has(token.tag)) {
				options.changes?.push(token.tag);
				if (!VOID.has(token.tag) && !token.selfClosing && !RAW_TEXT.has(token.tag)) skip = { tag: token.tag, depth: 1 };
				continue;
			}
			const tag = RENAME[token.tag] ?? token.tag;
			if (!ALLOWED.has(tag)) {
				options.changes?.push(tag);
				continue;
			}
			const attrs = attributesOf(tag, token.attrs, options);
			if (attrs === null) {
				// Unwrapped: remember it so its end tag closes nothing.
				options.changes?.push(tag);
				continue;
			}
			if (NEEDS_SOURCE.has(tag) && !attrs.src) {
				options.changes?.push(tag);
				continue;
			}
			const node: HtmlNode & { type: "element" } = { type: "element", tag, attrs, children: [] };
			stack[stack.length - 1].children.push(node);
			if (!VOID.has(tag) && tag !== "audio" && tag !== "iframe") stack.push(node);
			continue;
		}
		// An end tag closes the nearest open element of that name (and what is open inside it).
		const tag = RENAME[token.tag] ?? token.tag;
		for (let i = stack.length - 1; i > 0; i--) {
			if (stack[i].tag === tag) {
				stack.length = i;
				break;
			}
		}
	}
	return root.children;
}

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function serialize(nodes: HtmlNode[]): string {
	let out = "";
	for (const node of nodes) {
		if (node.type === "text") {
			out += node.text;
			continue;
		}
		const attrs = Object.entries(node.attrs)
			.map(([name, value]) => (value === "" && (name === "controls" || name === "allowfullscreen" || name === "data-youtube-video") ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`))
			.join("");
		if (VOID.has(node.tag)) out += `<${node.tag}${attrs}>`;
		else out += `<${node.tag}${attrs}>${serialize(node.children)}</${node.tag}>`;
	}
	return out;
}

/** `html` with only what the site allows (see the top of this file). */
export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
	return serialize(parseSafe(html, options)).trim();
}

// ------------------------------------------------------------------ reading the tree

/** The media ids a body uses (pictures and sounds with `data-media-id`). */
export function mediaIdsIn(nodes: HtmlNode[]): string[] {
	const ids = new Set<string>();
	const walk = (list: HtmlNode[]) => {
		for (const node of list) {
			if (node.type !== "element") continue;
			const id = node.attrs["data-media-id"];
			if (id) ids.add(id);
			walk(node.children);
		}
	};
	walk(nodes);
	return [...ids];
}

const BLOCK = new Set(["h2", "h3", "h4", "p", "blockquote", "ul", "ol", "li", "table", "tr", "figure", "figcaption", "hr", "div", "caption"]);

/** The words of a body, one block per line: for the search column and the history's comparison. */
export function textOf(nodes: HtmlNode[]): string {
	let out = "";
	const walk = (list: HtmlNode[]) => {
		for (const node of list) {
			if (node.type === "text") {
				out += decodeEntities(node.text);
				continue;
			}
			if (node.tag === "br") out += "\n";
			else if (node.tag === "img" && node.attrs.alt) out += `[Ảnh: ${node.attrs.alt}]`;
			else if (node.tag === "td" || node.tag === "th") out += " ";
			walk(node.children);
			if (BLOCK.has(node.tag)) out += "\n";
		}
	};
	walk(nodes);
	return out
		.replace(/[ \t\u00a0]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/** Plain text from a field that must not hold markup (titles, summaries): tags removed, spaces tidied. */
export function plainText(value: string): string {
	return value
		// Only well-formed tags go (a name after "<", attributes that may hold a quoted ">"): "Tuổi < 18" is text.
		.replace(/<\/?[a-z](?:"[^"]*"|'[^']*'|[^>"'])*>/gi, "")
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
		.trim();
}

// ------------------------------------------------------------------ Markdown, for the Tông Chỉ articles

const mdEscape = (text: string) => text.replace(/\*\*/g, "*\u200b*");

/**
 * The light Markdown the Tông Chỉ pages read (teaching_article.body is Markdown, src/libs/content/normalize.ts
 * renders it): headings, paragraphs, quotes, lists, rules, pictures, links and bold. What that Markdown cannot say
 * (tables, video, audio, captions, italics) is written as plain text so no words are lost.
 */
export function markdownOf(nodes: HtmlNode[]): string {
	const inline = (list: HtmlNode[]): string => {
		let out = "";
		for (const node of list) {
			if (node.type === "text") {
				out += mdEscape(decodeEntities(node.text).replace(/\s+/g, " "));
				continue;
			}
			if (node.tag === "br") out += "\n";
			else if (node.tag === "strong") {
				const inner = inline(node.children).trim();
				out += inner ? `**${inner.replace(/\n/g, " ")}**` : "";
			} else if (node.tag === "a") {
				const label = inline(node.children).replace(/[[\]\n]/g, " ").trim();
				out += label ? `[${label}](${node.attrs.href})` : "";
			} else if (node.tag === "img") out += "";
			else out += inline(node.children);
		}
		return out;
	};
	const blocks: string[] = [];
	const lines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);
	const block = (list: HtmlNode[]) => {
		let loose: HtmlNode[] = [];
		const flush = () => {
			const text = lines(inline(loose)).join("\n");
			if (text) blocks.push(text);
			loose = [];
		};
		for (const node of list) {
			if (node.type === "text" || (!BLOCK.has(node.tag) && !["img", "audio", "iframe", "ul", "ol", "table", "figure"].includes(node.tag))) {
				loose.push(node);
				continue;
			}
			flush();
			switch (node.tag) {
				case "h2":
				case "h3":
				case "h4": {
					const text = inline(node.children).replace(/\n/g, " ").trim();
					if (text) blocks.push(`${"#".repeat(Number(node.tag[1]))} ${text}`);
					break;
				}
				case "p":
				case "div":
				case "caption":
				case "figcaption": {
					const text = lines(inline(node.children)).join("\n");
					if (text) blocks.push(text);
					break;
				}
				case "blockquote": {
					const inner = markdownOf(node.children);
					const quoted = inner.split("\n").filter((line) => line.trim()).map((line) => `> ${line.replace(/^#+\s+/, "")}`);
					if (quoted.length) blocks.push(quoted.join("\n"));
					break;
				}
				case "ul":
				case "ol": {
					const items = node.children.filter((child): child is HtmlNode & { type: "element" } => child.type === "element" && child.tag === "li");
					const out = items
						.map((item, index) => {
							// Only one marker of a list, quote or heading inside the item goes ("- ", "> ", "## "): a "**" that opens bold is not one.
							const text = lines(markdownOf(item.children).replace(/^(?:[-*>]|#{1,6}) +/gm, "")).join(" ");
							return text ? `${node.tag === "ol" ? `${index + 1}.` : "-"} ${text}` : "";
						})
						.filter(Boolean);
					if (out.length) blocks.push(out.join("\n"));
					break;
				}
				case "hr":
					blocks.push("---");
					break;
				case "img":
					if (node.attrs.src) blocks.push(`![${(node.attrs.alt ?? "").replace(/[[\]]/g, "")}](${node.attrs.src})`);
					break;
				case "figure": {
					for (const child of node.children) {
						if (child.type === "element" && child.tag === "img" && child.attrs.src) blocks.push(`![${(child.attrs.alt ?? "").replace(/[[\]]/g, "")}](${child.attrs.src})`);
						else if (child.type === "element") {
							const text = lines(inline(child.children)).join("\n");
							if (text) blocks.push(text);
						}
					}
					break;
				}
				case "iframe":
					if (node.attrs.src) blocks.push(node.attrs.src.replace("youtube-nocookie.com/embed/", "youtube.com/watch?v=").replace("?start=", "&t="));
					break;
				case "audio":
					if (/^https:/.test(node.attrs.src ?? "")) blocks.push(node.attrs.src);
					break;
				case "table": {
					const rows: string[] = [];
					const walkRows = (list2: HtmlNode[]) => {
						for (const child of list2) {
							if (child.type !== "element") continue;
							if (child.tag === "tr") {
								const cells = child.children.filter((cell) => cell.type === "element" && (cell.tag === "td" || cell.tag === "th")).map((cell) => lines(inline((cell as { children: HtmlNode[] }).children)).join(" "));
								if (cells.some(Boolean)) rows.push(`- ${cells.filter(Boolean).join(" – ")}`);
							} else walkRows(child.children);
						}
					};
					walkRows(node.children);
					if (rows.length) blocks.push(rows.join("\n"));
					break;
				}
				default:
					block(node.children);
			}
		}
		flush();
	};
	block(nodes);
	return blocks.join("\n\n");
}
