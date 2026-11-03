// The Tông Chỉ bodies come two ways. Eight are Markdown, though even those carry a few
// notes for the designer. Seventeen are the designer's brief itself: the text of the page
// with notes on how to lay it out between the lines ("Làm 3 card.", "Infographic:",
// "MỘT ẢNH LỚN, ĐẸP THẦY NGỒI THIỀN", "[POPUP: …]"); the old site shows none of their body.
//
// tongChiMarkdown() turns both into the Markdown renderContent() reads: the notes dropped
// (and returned, for the data report), popup and ritual texts kept, “quotes” with their
// author as quotes, lines in capitals as headings, emoji lines as lists, the items of an
// infographic as a list, and "Tìm hiểu thêm về X ->" as a link to X's page.
import { isUnsavedUpload } from "./media";
import { cleanText } from "./normalize";

/** An article a body may point to. */
export type BodyTarget = { slug: string; title: string; group: string };

export type TongChiBody = { markdown: string; notes: string[] };

/** Letters only, without marks: "Bồ Đề tâm" → "bo de tam". */
export const bare = (value: string) =>
	value
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[đĐ]/g, "d")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

const isCaps = (text: string) => {
	const letters = text.replace(/[^\p{L}]/gu, "");
	return letters.length >= 2 && letters === letters.toLocaleUpperCase("vi") && letters !== letters.toLocaleLowerCase("vi");
};

// Notes for the designer, matched on the line without its bold marks.
const NOTES = [
	/^banner/i,
	/\b(card|click|popup|quote|typography|infographic|responsive)\b/i,
	/knowledge hu[bg]/i,
	/^(hiển thị|sơ đồ|dạng\b|ngăn kéo|grid\b|quote\b|có thể làm|thông điệp ngắn|kết thúc bằng|bao quanh|ảnh minh họa|ảnh full|ảnh đẹp|một ảnh)/iu,
	/^(ở giữa|kết)\s*:?$/iu,
	/^làm (dạng|\d)/iu,
	/^khám phá\s*(→|->)?$/iu,
	/^\[(xem chi tiết|khám phá)\]$/iu,
	/^có nút|\[xem [^\]]*\]|^chỗ này sẽ|\bposter\b/iu,
	// Names of places in the designer's files: "TRAI_DUONG; NHA_BEP".
	/^(?=.*_)[A-Z0-9_;\s]+$/,
	/^\[INFOGRAPHIC_[A-Z_]+\]$/,
	// A picture's file name: "Tông chỉ tu học_Nền tảng tu học_Bồ Tát Hạnh_…".
	/^(?!.*https?:)\S.*\S_\S.*_\S/,
];
// Notes that say a group of boxes follows: their short lines are items, not headings.
const STARTS_ITEMS = /card|infographic|sơ đồ|ngăn kéo|bao quanh|ở giữa|hình ảnh theo khối|khối trực quan|dạng bảng|grid/iu;
// Lines of arrows, signs and box drawing.
const SYMBOLS_ONLY = /^[\s\p{P}\p{S}]*$/u;
const ITEM_START = /^(?:[\p{So}\p{Sm}•·▪◦]|[\u2460-\u2473])/u;
const BULLET = /^[•·▪◦]\s*/u;
const SENTENCE_END = /[.!?…:]$/u;
const MARKDOWN = /^(#{1,6}\s|>\s?|!\[|[-*]\s|\d+[.)]\s)/;
const IMAGE = /^!\[[^\]]*\]\((.+)\)$/;
const QUOTE_END = /”[\s.…!?*]*$/u;
const AUTHOR = /^(vô trí|sa môn)|tâm hòa$/iu;
const LINK = /^(?:→\s*)?(?:tìm hiểu thêm(?:\s+về)?\s*:?|khám phá\s+(?:trang chi tiết|thêm nội dung về))\s+(.+?)\s*(?:->|→)?$|^khám phá\s+(.+?)\s*(?:->|→)$/iu;
const INLINE_LINK = /\s*(?:→|->)\s*(?:khám phá trang chi tiết|tìm hiểu thêm(?:\s+về)?\s*:?)\s*(.+)$/iu;
// A paragraph rather than a label or the item of a list.
const LONG = 120;
const QUOTE_LINES = 12;
// "kiên cốCon nguyện": a line break lost inside a verse.
const LOST_BREAK = /(?<=[\p{Ll}…])(?=\p{Lu})/u;

// Above this length a "line" is a whole section whose line breaks were lost (Thập Thiện).
const COLLAPSED = 400;
// Three or more words in capitals: a heading run into the text around it.
const CAPS_RUN = /((?:^|\s)(?:\p{Lu}[\p{Lu}\d\-–?!:,.]*\s+){2,}\p{Lu}[\p{Lu}\d\-–?!:,.]*)(?=\s|$)/gu;

/** A section on one line, cut back into lines where its breaks must have been. */
function unfold(line: string): string[] {
	if (line.length < COLLAPSED) return [line];
	// The links the designer was to add ("Knowledge Hub VIDEO: … BÀI VIẾT: …") end it.
	const hub = line.search(/knowledge hu[bg]/i);
	const body = (hub < 0 ? line : line.slice(0, hub)).replace(/\[[\]]/g, " ");
	const cut = body
		.replace(CAPS_RUN, "\n$1\n")
		.replace(/\s*“/gu, "\n“")
		.replace(/”\s*/gu, "”\n")
		.replace(/\s*(Vô Trí\s*[-–]\s*Tâm Hòa)\s*/gu, "\n$1\n")
		.replace(/\s*(Khám phá [^.]*?->)\s*/gu, "\n$1\n")
		.replace(/\s+[→↓]\s+/gu, "\n");
	return [...cut.split("\n"), ...(hub < 0 ? [] : [line.slice(hub)])].map((part) => part.trim()).filter(Boolean);
}

type Block = { kind: "h2" | "h3" | "p" | "quote" | "list" | "raw"; lines: string[] };

/** The line as the editors meant it: empty bold marks gone, notes in brackets taken off. */
function tidy(line: string): string {
	let out = line.trim().replace(/\*\*\s*\*\*/g, " ").replace(/\*{3,}/g, " ");
	if ((out.match(/\*\*/g)?.length ?? 0) % 2) out = out.replace(/\*\*/g, "");
	return out
		.replace(/\s*\((?=[^)]*(?:knowledge hu[bg]|card))[^)]*\)/giu, "")
		.replace(/^nhóm \d+:\s*/iu, "")
		.replace(/^ở giữa:\s*/iu, "")
		// "\[ … POPUP\]": the editor's escaped brackets around text meant for a popup.
		.replace(/\\[[\]]/g, "")
		.replace(/<->/g, "↔")
		.replace(/(\S)\s*↓\s*(?=\S)/gu, "$1 → ")
		.replace(/\s+/g, " ")
		.trim();
}

const plainOf = (line: string) => line.replace(/\*\*/g, "").replace(/^\*(.+)\*$/, "$1").trim();
const isNote = (plain: string) => NOTES.some((pattern) => pattern.test(plain));

function resolver(targets: BodyTarget[], self: string) {
	const others = targets.filter((target) => target.slug !== self);
	return (name: string): string | null => {
		const key = bare(name.replace(/[….]+$/, ""));
		if (!key) return null;
		let found = others.filter((target) => bare(target.title) === key);
		if (!found.length) found = others.filter((target) => target.slug.includes(key.replace(/ /g, "-")));
		// A group by its name: "Khám phá Nếp sống thiền gia ->".
		if (!found.length && others.some((target) => target.group === key.replace(/ /g, "-"))) return `/tong-chi-tu-hoc#${key.replace(/ /g, "-")}`;
		if (!found.length) return null;
		if (found.length > 1 && found.every((target) => target.group === found[0].group)) return `/tong-chi-tu-hoc#${found[0].group}`;
		return `/tong-chi-tu-hoc/${found[0].slug}`;
	};
}

/**
 * The body of one Tông Chỉ article as Markdown for renderContent(). `title` and `slug` are
 * the article's own (its title is dropped where the brief repeats it, its page is never
 * linked to itself); `targets` are all the articles, for the "Tìm hiểu thêm" links.
 */
export function tongChiMarkdown(content: string, { title, slug, targets }: { title: string; slug: string; targets: BodyTarget[] }): TongChiBody {
	const notes: string[] = [];
	const linkTo = resolver(targets, slug);
	// "VĂN HÓA NHÀ BẾPVăn hóa phụng sự…": a title run into its text.
	const lines = cleanText(content)
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.flatMap(unfold)
		.flatMap((line) => line.split(/(?<=\p{Lu}{2})(?=\p{Lu}\p{Ll})/u));
	const blocks: Block[] = [];
	let items = false;
	let closer: string | null = null;
	// Assigned inside the helpers below, so TypeScript must not narrow it to null here.
	let open = null as Block | null;
	// What the last item of a list may take from the next line as its description: any
	// short line (after a title such as "🪷 THÂN"), only a sentence, or nothing.
	let takes: "any" | "sentence" | null = null;

	const push = (kind: Block["kind"], text: string) => {
		if (open?.kind !== kind || kind === "h2" || kind === "h3") {
			open = { kind, lines: [] };
			blocks.push(open);
		}
		open.lines.push(text);
	};
	const end = () => {
		open = null;
	};
	const drop = (plain: string) => {
		notes.push(plain);
		if (STARTS_ITEMS.test(plain)) items = true;
	};
	const addItem = (text: string, bold: boolean) => {
		push("list", bold ? `**${text.replace(/\*\*/g, "")}**` : text);
		const plain = plainOf(text);
		const titled = bold || (ITEM_START.test(plain) && !BULLET.test(text));
		takes = plain.length > 60 || SENTENCE_END.test(plain) || BULLET.test(text) ? null : titled ? "any" : "sentence";
	};
	const addLink = (text: string, href: string) => {
		const label = text
			.replace(/^\s*(?:→|->)\s*/u, "")
			.replace(/\s*(?:->|→)\s*$/u, "")
			.replace(/[….\s]+$/u, "");
		const link = `[${label} →](${href})`;
		if (open?.kind === "list") open.lines[open.lines.length - 1] += ` ${link}`;
		else {
			end();
			push("p", link);
			end();
		}
	};
	// The next line that says something, for headings that look ahead.
	const next = (from: number) => {
		for (let at = from; at < lines.length; at++) {
			const line = tidy(lines[at]);
			const plain = plainOf(line);
			if (plain && !isNote(plain) && !SYMBOLS_ONLY.test(plain)) return line;
		}
		return "";
	};

	let index = 0;
	const skipTitle = () => {
		const line = next(index);
		if (line && bare(plainOf(line)) === bare(title)) {
			while (index < lines.length && bare(plainOf(tidy(lines[index]))) !== bare(title)) index++;
			index++;
		}
	};

	while (index < lines.length) {
		let line = tidy(lines[index++]);

		// [POPUP: …] and [NGHI THỨC: …] hold text of the page, sometimes over several lines.
		const wrapped = line.match(/^([[(])(?:popup|nghi thức)\s*:\s*/iu);
		if (wrapped) {
			line = line.slice(wrapped[0].length);
			closer = wrapped[1] === "[" ? "]" : ")";
		}
		if (closer && line.endsWith(closer)) {
			line = line.slice(0, -1).trim();
			closer = null;
		}

		const plain = plainOf(line);
		if (!plain) {
			if (open?.kind !== "list") end();
			continue;
		}

		if (/^banner/i.test(plain)) {
			notes.push(plain);
			skipTitle();
			continue;
		}

		const image = line.match(IMAGE);
		if (image) {
			end();
			if (isUnsavedUpload(image[1])) notes.push(`ảnh chưa có: ${image[1]}`);
			else push("raw", line);
			end();
			continue;
		}

		if (MARKDOWN.test(line) && !/^\*\S/.test(line)) {
			if (line.startsWith(">")) {
				const text = line.replace(/^>\s?/, "").replace(/^#{1,6}\s+/, "");
				if (open?.kind !== "quote") end();
				push("quote", text);
				continue;
			}
			end();
			const heading = line.match(/^(#{1,6})\s+(.+)$/);
			if (heading) {
				items = false;
				push(heading[1].length > 2 ? "h3" : "h2", heading[2].trim());
			} else push("raw", line);
			if (heading) end();
			continue;
		}

		// "*Vô Trí – Tâm Hòa*" or "Vô Trí – Tâm Hòa" under a quote: its author.
		if (open?.kind === "quote" && plain.length <= 60 && AUTHOR.test(plain)) {
			open.lines.push(`— ${plain}`);
			end();
			continue;
		}
		if (blocks.at(-1)?.kind === "quote" && !open && plain.length <= 60 && AUTHOR.test(plain)) {
			blocks.at(-1)!.lines.push(`— ${plain}`);
			continue;
		}

		const link = plain.match(LINK);
		if (link) {
			const href = linkTo(link[1] ?? link[2]);
			if (href) addLink(plain, href);
			else notes.push(plain);
			continue;
		}

		if (isNote(plain)) {
			drop(plain);
			continue;
		}
		if (SYMBOLS_ONLY.test(plain)) {
			// An arrow or sign between two boxes: the item above is complete.
			takes = null;
			continue;
		}

		// A “quote”, over one or more lines; "“THIỀN” ĐƠN GIẢN LÀ…" is a heading, not a quote.
		if (plain.startsWith("“") && (QUOTE_END.test(plain) || !plain.slice(1).includes("”"))) {
			let last = index - 1;
			if (!QUOTE_END.test(plain)) {
				for (let at = index; at < Math.min(lines.length, index + QUOTE_LINES); at++) {
					if (QUOTE_END.test(plainOf(tidy(lines[at])))) {
						last = at;
						break;
					}
				}
			}
			end();
			items = false;
			for (let at = index - 1; at <= last; at++) {
				const verse = at === index - 1 ? plain : plainOf(tidy(lines[at]));
				for (const part of verse.split(LOST_BREAK)) if (part.trim()) push("quote", part.trim());
			}
			index = last + 1;
			continue;
		}

		const inline = line.match(INLINE_LINK);
		if (inline) {
			const href = linkTo(inline[1]);
			const before = line.slice(0, inline.index).trim();
			if (before) addItem(before, false);
			if (href) addLink(inline[0], href);
			else notes.push(inline[0].trim());
			continue;
		}

		if (plain.startsWith("→")) {
			const name = plain.slice(1).trim();
			const href = linkTo(name);
			if (href) addLink(name, href);
			else addItem(name, false);
			continue;
		}

		// "(TUỆ)" under "NIỆM PHẬT": part of the line above.
		if (open && /^\(.*\)$/.test(plain) && plain.length < 80) {
			open.lines[open.lines.length - 1] += ` ${plain}`;
			continue;
		}

		const startsItem = ITEM_START.test(plain);
		// Among the items of an infographic, capitals are an item unless a quote or a
		// paragraph follows: then they head the next section.
		const after = plainOf(next(index));
		const heads = !items || after.startsWith("“") || after.length >= 100;
		if (isCaps(plain) && plain.length <= 90 && heads && !startsItem) {
			end();
			const following = plainOf(next(index));
			push(ITEM_START.test(following) ? "h3" : "h2", plain);
			end();
			items = false;
			continue;
		}
		if (startsItem || (items && isCaps(plain))) {
			addItem(plain.replace(BULLET, ""), isCaps(plain) || /^\*\*/.test(line));
			if (BULLET.test(plain)) takes = null;
			continue;
		}

		if (plain.length >= LONG) {
			end();
			push("p", line);
			end();
			items = false;
			continue;
		}
		if (open?.kind === "list" && takes && !plain.endsWith(":") && (takes === "any" || SENTENCE_END.test(plain))) {
			open.lines[open.lines.length - 1] += ` — ${line}`;
			takes = null;
			continue;
		}
		if (items) {
			addItem(line, false);
			continue;
		}
		if (open?.kind !== "p") end();
		push("p", line);
	}

	// Bodies whose headings are all "###" start at h2 like the others.
	if (!blocks.some((block) => block.kind === "h2")) for (const block of blocks) if (block.kind === "h3") block.kind = "h2";
	// A heading left last (its pictures were dropped) goes too.
	const kept = blocks.filter((block, at) => (block.kind === "h2" || block.kind === "h3" ? at < blocks.length - 1 : block.lines.length > 0));
	const markdown = kept
		.map((block) => {
			switch (block.kind) {
				case "h2":
					return `## ${block.lines[0]}`;
				case "h3":
					return `### ${block.lines[0]}`;
				case "quote":
					return block.lines.map((text) => `> ${text}`).join("\n");
				case "list":
					return block.lines.map((text) => `- ${text}`).join("\n");
				default:
					return block.lines.join("\n");
			}
		})
		.join("\n\n");
	return { markdown, notes };
}
