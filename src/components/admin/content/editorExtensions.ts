// The editor's document model: TipTap's starter kit (without code, whose tags the site does not keep) plus tables,
// YouTube without cookies, and three small nodes of our own that write exactly the HTML the server keeps
// (src/admin/content/html.ts): a quote that can be marked as a sutra or a verse, a picture with its caption and
// library id, and a sound.
import { Extension, mergeAttributes, Node, type Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Youtube from "@tiptap/extension-youtube";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";

/** TipTap's YouTube node that also takes the video when it is a bare <iframe> (what the server stores for one that has no wrapper). */
const YoutubeAnywhere = Youtube.extend({
	parseHTML() {
		return [{ tag: "div[data-youtube-video] iframe" }, { tag: 'iframe[src*="youtube"]' }];
	},
});

export type QuoteVariant = "kinh" | "tho" | null;

/** A blockquote; `variant` "kinh" (trích kinh) or "tho" (thơ) becomes its class. */
export const QuoteBlock = Node.create({
	name: "blockquote",
	group: "block",
	content: "block+",
	defining: true,
	addAttributes() {
		return {
			variant: {
				default: null,
				parseHTML: (element: HTMLElement) => {
					const value = element.getAttribute("class");
					return value === "kinh" || value === "tho" ? value : null;
				},
				renderHTML: (attributes: { variant?: QuoteVariant }) => (attributes.variant ? { class: attributes.variant } : {}),
			},
		};
	},
	parseHTML() {
		return [{ tag: "blockquote" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["blockquote", mergeAttributes(HTMLAttributes), 0];
	},
	addKeyboardShortcuts() {
		return { "Mod-Shift-b": () => this.editor.commands.toggleWrap(this.name) };
	},
});

/** The figure's inline style for a width (percent of the column) and an alignment; the server keeps exactly this shape (html.ts). */
export function figureStyle(width: number | null, align: "left" | "center" | "right" | null): string {
	const parts: string[] = [];
	if (width && width >= 10 && width < 100) parts.push(`width: ${Math.round(width)}%`);
	if (align === "center") parts.push("margin-left: auto", "margin-right: auto");
	else if (align === "right") parts.push("margin-left: auto", "margin-right: 0");
	else if (align === "left") parts.push("margin-left: 0", "margin-right: auto");
	return parts.join("; ");
}

export type FigureAttrs = { src: string; alt: string; mediaId: string | null; caption: string; width: number | null; align: "left" | "center" | "right" | null };

/** A picture (from the library: it keeps the media id) with its description and caption. */
export const FigureImage = Node.create({
	name: "figureImage",
	group: "block",
	atom: true,
	draggable: true,
	selectable: true,
	addAttributes() {
		return { src: { default: null }, alt: { default: "" }, mediaId: { default: null }, caption: { default: "" }, width: { default: null }, align: { default: null } };
	},
	parseHTML() {
		return [
			{
				tag: "figure",
				getAttrs: (element: HTMLElement) => {
					const img = element.querySelector("img");
					if (!img?.getAttribute("src")) return false;
					const w = /^(\d{2,3})%$/.exec(element.style.width);
					const left = element.style.marginLeft;
					const right = element.style.marginRight;
					const align = left === "auto" && right === "auto" ? "center" : left === "auto" ? "right" : right === "auto" ? "left" : null;
					return { src: img.getAttribute("src"), alt: img.getAttribute("alt") ?? "", mediaId: img.getAttribute("data-media-id"), caption: element.querySelector("figcaption")?.textContent?.trim() ?? "", width: w ? Number(w[1]) : null, align };
				},
			},
			{
				tag: "img[src]",
				getAttrs: (element: HTMLElement) => ({ src: element.getAttribute("src"), alt: element.getAttribute("alt") ?? "", mediaId: element.getAttribute("data-media-id"), caption: "" }),
			},
		];
	},
	renderHTML({ node }) {
		const attrs = node.attrs as FigureAttrs;
		const img: [string, Record<string, string | null>] = ["img", { src: attrs.src, alt: attrs.alt ?? "", "data-media-id": attrs.mediaId, loading: "lazy" }];
		const style = figureStyle(attrs.width, attrs.align);
		const fig: Record<string, string> = style ? { style } : {};
		return attrs.caption ? ["figure", fig, img, ["figcaption", {}, attrs.caption]] : ["figure", fig, img];
	},
});

export type AudioAttrs = { src: string; mediaId: string | null };

/** A sound file (Pháp Âm): from the library or an https address. */
export const AudioBlock = Node.create({
	name: "audioBlock",
	group: "block",
	atom: true,
	selectable: true,
	draggable: true,
	addAttributes() {
		return { src: { default: null }, mediaId: { default: null } };
	},
	parseHTML() {
		return [{ tag: "audio[src]", getAttrs: (element: HTMLElement) => ({ src: element.getAttribute("src"), mediaId: element.getAttribute("data-media-id") }) }];
	},
	renderHTML({ node }) {
		const attrs = node.attrs as AudioAttrs;
		return ["audio", { src: attrs.src, controls: "", preload: "none", "data-media-id": attrs.mediaId }];
	},
});

/** The fonts the editor offers; the values are the only ones the server's style filter keeps (src/admin/content/html.ts). */
export const FONT_FAMILIES: { label: string; value: string }[] = [
	{ label: "Phông mặc định", value: "" },
	{ label: "Có chân (Georgia)", value: "Georgia, 'Times New Roman', serif" },
	{ label: "Không chân", value: "'Be Vietnam Pro', Arial, sans-serif" },
	{ label: "Đơn cách", value: "'Courier New', monospace" },
];
export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
export const LINE_HEIGHTS = ["1", "1.15", "1.5", "1.75", "2"];
export const INDENT_MAX = 8;

/** Line height and indent (steps of 2em) as block styles, the form the server keeps. */
export const BlockSpacing = Extension.create({
	name: "blockSpacing",
	addGlobalAttributes() {
		return [
			{
				types: ["paragraph", "heading", "listItem"],
				attributes: {
					lineHeight: {
						default: null,
						parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
						renderHTML: (attrs: { lineHeight?: string | null }) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
					},
					indent: {
						default: 0,
						parseHTML: (el: HTMLElement) => {
							const m = /^(\d+)em$/.exec(el.style.marginLeft);
							return m ? Math.min(INDENT_MAX, Math.round(Number(m[1]) / 2)) : 0;
						},
						renderHTML: (attrs: { indent?: number }) => (attrs.indent ? { style: `margin-left: ${attrs.indent * 2}em` } : {}),
					},
				},
			},
		];
	},
	addCommands() {
		const step = (delta: number) => () => ({ state, tr, dispatch }: { state: import("@tiptap/pm/state").EditorState; tr: import("@tiptap/pm/state").Transaction; dispatch?: (tr: import("@tiptap/pm/state").Transaction) => void }) => {
			const { from, to } = state.selection;
			let changed = false;
			state.doc.nodesBetween(from, to, (node, pos) => {
				if (!["paragraph", "heading"].includes(node.type.name)) return;
				const next = Math.max(0, Math.min(INDENT_MAX, (node.attrs.indent ?? 0) + delta));
				if (next !== (node.attrs.indent ?? 0)) {
					tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
					changed = true;
				}
			});
			if (changed && dispatch) dispatch(tr);
			return changed;
		};
		return { indentMore: step(1), outdent: step(-1) } as never;
	},
	addKeyboardShortcuts() {
		return { "Mod-]": () => (this.editor.commands as never as { indentMore: () => boolean }).indentMore(), "Mod-[": () => (this.editor.commands as never as { outdent: () => boolean }).outdent() };
	},
});

export function editorExtensions(): Extensions {
	return [
		StarterKit.configure({
			heading: { levels: [2, 3, 4] },
			blockquote: false,
			code: false,
			codeBlock: false,
			link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["mailto"] },
		}),
		TextStyle,
		Color,
		FontFamily,
		FontSize,
		Highlight.configure({ multicolor: true }),
		Subscript,
		Superscript,
		TextAlign.configure({ types: ["heading", "paragraph", "tableCell", "tableHeader"] }),
		TaskList,
		TaskItem.configure({ nested: false }),
		BlockSpacing,
		QuoteBlock,
		FigureImage,
		AudioBlock,
		Table.configure({ resizable: false }),
		TableRow,
		TableHeader,
		TableCell,
		// The server keeps a YouTube video as a bare <iframe> as well as inside the editor's <div data-youtube-video>; TipTap alone reads only the
		// wrapped one, so a post whose HTML came from elsewhere (an API, pasted HTML) lost its video the moment the editor opened it and saved.
		YoutubeAnywhere.configure({ nocookie: true, controls: true, width: 640, height: 360, addPasteHandler: true }),
	];
}
