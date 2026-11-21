// The editor's document model: TipTap's starter kit (without code, whose tags the site does not keep) plus tables,
// YouTube without cookies, and three small nodes of our own that write exactly the HTML the server keeps
// (src/admin/content/html.ts): a quote that can be marked as a sutra or a verse, a picture with its caption and
// library id, and a sound.
import { mergeAttributes, Node, type Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";

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

export type FigureAttrs = { src: string; alt: string; mediaId: string | null; caption: string };

/** A picture (from the library: it keeps the media id) with its description and caption. */
export const FigureImage = Node.create({
	name: "figureImage",
	group: "block",
	atom: true,
	draggable: true,
	selectable: true,
	addAttributes() {
		return { src: { default: null }, alt: { default: "" }, mediaId: { default: null }, caption: { default: "" } };
	},
	parseHTML() {
		return [
			{
				tag: "figure",
				getAttrs: (element: HTMLElement) => {
					const img = element.querySelector("img");
					if (!img?.getAttribute("src")) return false;
					return { src: img.getAttribute("src"), alt: img.getAttribute("alt") ?? "", mediaId: img.getAttribute("data-media-id"), caption: element.querySelector("figcaption")?.textContent?.trim() ?? "" };
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
		return attrs.caption ? ["figure", {}, img, ["figcaption", {}, attrs.caption]] : ["figure", {}, img];
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

export function editorExtensions(): Extensions {
	return [
		StarterKit.configure({
			heading: { levels: [2, 3, 4] },
			blockquote: false,
			code: false,
			codeBlock: false,
			link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["mailto"] },
		}),
		QuoteBlock,
		FigureImage,
		AudioBlock,
		Table.configure({ resizable: false }),
		TableRow,
		TableHeader,
		TableCell,
		Youtube.configure({ nocookie: true, controls: true, width: 640, height: 360, addPasteHandler: true }),
	];
}
