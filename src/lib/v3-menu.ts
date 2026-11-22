// The admin's header menu and contact details turned into what V3's header and footer draw. Pure: no D1 here (lib/v3-chrome.ts reads).
//
// V3's header draws two levels: a top-level link, or a top-level item with a dropdown of links. So a menu item's third level
// is left out, and so is its icon (the dropdown has its own mark), its colour and its "open in the same tab" detail beyond
// the new-tab flag. An address on this site that V3 has no page for (`/lien-he`) points to the same page on www instead of
// ending in V3's 404. The footer has no slot for a menu (it holds contact lines and fixed social icons): the footer menu is
// not drawn.
import type { ContactLine } from "@/lib/contact-format";
import type { MenuNode } from "@/lib/tlhp-site/siteData";

/** www, where the pages V3 does not have live. */
const WWW_ORIGIN = "https://www.tunglamhoaphuc.com";

export type ChromeLink = { label: string; href: string; newTab: boolean };
export type ChromeNavItem = ChromeLink & { children: ChromeLink[] };

/** The first path segments V3 has a page for (src/app/(public) and the home page); kept in step by a test. */
export const V3_ROUTES = ["bao-tuong", "bao-tuong-phat-giao", "dong-chay-hoang-phap", "gioi-thieu", "kiem-tra-anh", "lich-tu-hoc", "tong-chi-tu-hoc", "tra-cuu-bai-vi", "tri-tue-phat-phap", "vu-tru-phat-giao"];

/** Where a menu address leads in V3: its own page when V3 has one, www's page otherwise, an https address as it is. */
export function menuHref(raw: string): string {
	const href = raw.trim();
	if (!href || href === "#") return "#";
	if (/^https:\/\//i.test(href)) return href;
	if (!href.startsWith("/") || href.startsWith("//")) return "#";
	const first = href.slice(1).split(/[/?#]/)[0];
	return !first || V3_ROUTES.includes(first) ? href : `${WWW_ORIGIN}${href}`;
}

const linkOf = (node: MenuNode): ChromeLink => ({ label: node.label, href: menuHref(node.href), newTab: node.openNewTab });

/** The header's items from the admin's tree: two levels; deeper levels are left out. */
export function menuToNav(nodes: MenuNode[]): ChromeNavItem[] {
	return nodes.filter((node) => node.label.trim()).map((node) => ({ ...linkOf(node), children: node.children.filter((child) => child.label.trim()).map(linkOf) }));
}

// ── Contact details (the `site.info` setting) ───────────────────────────────

export type ChromeContact = ContactLine;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export type ChromeInfo = {
	/** Free text ("Sáng 7:30 – 10:30 · Chiều 13:30 – 17:30"); `null` when the setting does not have the key (the footer keeps its own line), "" when the admin emptied it. */
	openingHours: string | null;
	address: string | null;
	slogan: string | null;
};

const textOf = (value: unknown): string | null => (typeof value === "string" ? value.trim() : null);

/** The footer's address, opening hours and slogan from `site.info`; `null` when the setting is not there at all. */
export function infoFromSetting(info: unknown): ChromeInfo | null {
	if (!isObject(info)) return null;
	return { openingHours: textOf(info.openingHours), address: textOf(info.address), slogan: textOf(info.slogan) };
}

/**
 * The phone lines the admin saved (`site.info`.phones), valid ones only; `null` when the setting has no phones (the footer
 * then keeps the lines written in it). An empty list the admin saved on purpose is `[]`: the footer shows no phone lines.
 */
export function contactsFromInfo(info: unknown): ChromeContact[] | null {
	if (!isObject(info) || !Array.isArray(info.phones)) return null;
	return info.phones.flatMap((item) => {
		if (!isObject(item)) return [];
		const role = typeof item.role === "string" ? item.role.trim() : "";
		const name = typeof item.name === "string" ? item.name.trim() : "";
		const phone = typeof item.phone === "string" ? item.phone.replace(/[\s.\-()]/g, "") : "";
		return role && name && /^\+?\d{8,15}$/.test(phone) ? [{ role, name, phone }] : [];
	});
}
