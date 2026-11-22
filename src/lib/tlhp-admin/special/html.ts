// A small, conservative HTML cleaner for the statues' article text. Allowed: p, br, strong, em, ul, ol, li,
// blockquote, h2-h4 and a (https or site-relative href only). Everything else is dropped (its text stays, except
// script and style, which go with their content). Text is escaped, so what comes out cannot hold a script or an
// event handler.
const ALLOWED = new Set(["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "a"]);
const RENAME: Record<string, string> = { b: "strong", i: "em", h1: "h2", h5: "h4", h6: "h4" };
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript", "svg", "math"]);
const ENTITY = /^&(amp|lt|gt|quot|nbsp|#\d{1,6}|#x[\da-f]{1,5});/i;

const escapeText = (value: string) => {
	let out = "";
	for (let i = 0; i < value.length; i++) {
		const char = value[i];
		if (char === "&") out += ENTITY.test(value.slice(i, i + 12)) ? "&" : "&amp;";
		else if (char === "<") out += "&lt;";
		else if (char === ">") out += "&gt;";
		else out += char;
	}
	return out;
};

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function decodeAttr(value: string): string {
	return value
		.replace(/&#x([\da-f]+);?/gi, (_, hex: string) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
		.replace(/&#(\d+);?/g, (_, dec: string) => String.fromCodePoint(Math.min(Number(dec), 0x10ffff)))
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

/** A link target we keep: https, or a path on this site. */
export function safeLink(raw: string): string | null {
	// Control characters and spaces can hide a scheme ("java\tscript:").
	// eslint-disable-next-line no-control-regex
	const value = decodeAttr(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
	if (/^https:\/\/[^/\s]+/i.test(value)) return value.slice(0, 500);
	if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value.slice(0, 500);
	return null;
}

export function cleanBodyHtml(input: string): string {
	let out = "";
	const stack: { tag: string; kept: boolean }[] = [];
	let i = 0;
	while (i < input.length) {
		const lt = input.indexOf("<", i);
		if (lt < 0) {
			out += escapeText(input.slice(i));
			break;
		}
		out += escapeText(input.slice(i, lt));
		if (input.startsWith("<!--", lt)) {
			const end = input.indexOf("-->", lt + 4);
			i = end < 0 ? input.length : end + 3;
			continue;
		}
		const gt = input.indexOf(">", lt);
		const match = gt < 0 ? null : /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>$/.exec(input.slice(lt, gt + 1));
		if (!match) {
			// A "<" that opens no tag is only text.
			out += "&lt;";
			i = lt + 1;
			continue;
		}
		i = gt + 1;
		const closing = match[1] === "/";
		const raw = match[2].toLowerCase();
		const name = RENAME[raw] ?? raw;
		if (DROP_WITH_CONTENT.has(raw)) {
			if (!closing) {
				const end = new RegExp(`</\\s*${raw}\\s*>`, "i").exec(input.slice(i));
				i = end ? i + end.index + end[0].length : input.length;
			}
			continue;
		}
		if (!ALLOWED.has(name)) continue;
		if (name === "br") {
			if (!closing) out += "<br>";
			continue;
		}
		if (closing) {
			const at = stack.map((entry) => entry.tag).lastIndexOf(name);
			if (at < 0) continue;
			while (stack.length > at) {
				const entry = stack.pop()!;
				if (entry.kept) out += `</${entry.tag}>`;
			}
			continue;
		}
		if (name === "a") {
			const attr = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(match[3]);
			const href = attr ? safeLink(attr[1] ?? attr[2] ?? attr[3] ?? "") : null;
			if (!href) {
				stack.push({ tag: "a", kept: false });
				continue;
			}
			out += `<a href="${escapeAttr(href)}" rel="noopener noreferrer">`;
			stack.push({ tag: "a", kept: true });
			continue;
		}
		out += `<${name}>`;
		stack.push({ tag: name, kept: true });
	}
	while (stack.length) {
		const entry = stack.pop()!;
		if (entry.kept) out += `</${entry.tag}>`;
	}
	return out.trim();
}
