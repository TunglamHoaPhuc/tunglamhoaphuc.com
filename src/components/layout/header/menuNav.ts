// The admin-edited header menu turned into the shape the header draws (the same as `site.nav` in src/config/site.ts,
// plus an icon that may be an inline SVG). Pure: the library lookup is passed in, so tests need no library and the
// browser bundle never holds it.
import type { NavLink } from "@/config/site";
import type { MenuIcon, MenuNode } from "@/libs/siteData";

export type HeaderLink = NavLink & {
	/** The menu item's id (the key); the default menu has none and keys by address. */
	id?: string;
	/** Cleaned SVG markup of the icon (library or uploaded); drawn inline in the dropdown. */
	svg?: string;
	/** Colour of an svg icon, #hex. */
	iconColor?: string;
	/** Opens in a new tab. */
	newTab?: boolean;
};
export type HeaderItem = HeaderLink & { children?: HeaderLink[] };

/** Only SVG text the server produced is ever drawn inline; anything else is ignored. */
export const isInlineSvg = (svg: unknown): svg is string => typeof svg === "string" && svg.startsWith("<svg") && !/<script|\son\w+\s*=/i.test(svg);

const SITE_OR_HTTPS = /^(?:\/(?!\/)|https:\/\/)/;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Makes an SVG fill the round chip it sits in. */
const fit = (svg: string) => svg.replace(/^<svg\b([^>]*)>/, (_all, attrs: string) => `<svg${attrs.replace(/\s(?:width|height)="[^"]*"/g, "")} width="100%" height="100%" aria-hidden="true" focusable="false">`);

function iconOf(icon: MenuIcon, librarySvg: (name: string) => string | null): Pick<HeaderLink, "image" | "svg" | "iconColor"> {
	const iconColor = HEX.test(icon.color) ? icon.color : undefined;
	if (icon.type === "image" && SITE_OR_HTTPS.test(icon.url)) return { image: icon.url };
	if (icon.type === "svg" && isInlineSvg(icon.svg)) return { svg: fit(icon.svg), iconColor };
	if (icon.type === "library") {
		const svg = librarySvg(icon.name);
		if (svg && isInlineSvg(svg)) return { svg: fit(svg), iconColor };
	}
	return {};
}

function link(node: MenuNode, librarySvg: (name: string) => string | null): HeaderLink {
	return { id: node.id, label: node.label, href: node.href, ...(node.openNewTab ? { newTab: true } : {}), ...iconOf(node.icon, librarySvg) };
}

/** Two levels, like the header draws: an item with visible children becomes a dropdown; deeper levels are left out. */
export function menuToNav(nodes: MenuNode[], librarySvg: (name: string) => string | null): HeaderItem[] {
	return nodes.map((node) => {
		const item: HeaderItem = link(node, librarySvg);
		if (node.children.length) item.children = node.children.map((child) => link(child, librarySvg));
		return item;
	});
}
