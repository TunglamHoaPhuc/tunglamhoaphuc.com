// The admin's header menu and contact details turned into what V3's header and footer draw. Pure: no D1 here (lib/v3-chrome.ts reads).
//
// V3's header draws two levels: a top-level link, or a top-level item with a dropdown of links. So a menu item's third level
// is left out, and so is its icon (the dropdown has its own mark), its colour and its "open in the same tab" detail beyond
// the new-tab flag. An address on this site that V3 has no page for (`/lien-he`) points to the same page on www instead of
// ending in V3's 404. The footer has no slot for a menu (it holds contact lines, the map link and the social links): the
// footer menu is not drawn. The same file turns `site.info` (name, hours, address, map, social links) and `site.announcement`
// (the welcome notice) into what the footer and the notice draw.
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

/** The admin's rule for an outside address (src/admin/ops/settings.ts): https only, no spaces or markup characters, 500 characters at most. */
const SAFE_HTTPS = /^https:\/\/[^\s<>"']+$/i;

/** An https address that is safe to put in `href`, or "" (the admin checks on save; the read checks again, since D1 may hold older or hand-edited values). */
export function safeHttpsUrl(value: unknown): string {
	if (typeof value !== "string") return "";
	const url = value.trim();
	if (!url || url.length > 500 || !SAFE_HTTPS.test(url)) return "";
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" && !parsed.username && !parsed.password && parsed.hostname ? url : "";
	} catch {
		return "";
	}
}

export type SocialNetwork = "facebook" | "facebook-group" | "youtube" | "tiktok" | "instagram" | "zalo" | "website";

/** A social link the admin saved (`site.info`.social): a name, a safe https address and the network it belongs to (icon and colour). */
export type ChromeSocial = { label: string; url: string; network: SocialNetwork };

export type ChromeInfo = {
	/** The temple's name; `null` when the setting has no name (the footer keeps its own), "" when the admin emptied it. */
	name: string | null;
	/** Free text ("Sáng 7:30 – 10:30 · Chiều 13:30 – 17:30"); `null` when the setting does not have the key (the footer keeps its own line), "" when the admin emptied it. */
	openingHours: string | null;
	address: string | null;
	slogan: string | null;
	/** The map link (https only); "" when the admin left it empty or it is not a safe link. */
	mapsUrl: string;
	/** The social links, valid ones only, in the admin's order; the footer draws one link for each, and none when this is empty. */
	social: ChromeSocial[];
};

const textOf = (value: unknown): string | null => (typeof value === "string" ? value.trim() : null);

const hostIs = (host: string, ...names: string[]) => names.some((name) => host === name || host.endsWith(`.${name}`));

/** Which network a link belongs to, from its address first, then from the name the admin typed. */
export function socialNetwork(label: string, url: string): SocialNetwork {
	let host = "";
	let path = "";
	try {
		const parsed = new URL(url);
		host = parsed.hostname.toLowerCase();
		path = parsed.pathname.toLowerCase();
	} catch {
		// the address was checked before this; an unreadable one is told apart by its name only
	}
	if (hostIs(host, "facebook.com", "fb.com", "fb.watch", "fb.me")) return path.startsWith("/groups") ? "facebook-group" : "facebook";
	if (hostIs(host, "youtube.com", "youtu.be")) return "youtube";
	if (hostIs(host, "tiktok.com")) return "tiktok";
	if (hostIs(host, "instagram.com")) return "instagram";
	if (hostIs(host, "zalo.me", "zaloapp.com")) return "zalo";
	if (host) return "website";
	const name = label.toLowerCase();
	for (const network of ["facebook", "youtube", "tiktok", "instagram", "zalo"] as const) if (name.includes(network)) return network;
	return "website";
}

/** The social links the admin saved: a name (1 to 40 characters) and a safe https address each, twelve at most like the admin; the rest are left out. */
export function socialFromInfo(info: unknown): ChromeSocial[] {
	if (!isObject(info) || !Array.isArray(info.social)) return [];
	return info.social.slice(0, 12).flatMap((item) => {
		if (!isObject(item)) return [];
		const label = typeof item.label === "string" ? item.label.trim() : "";
		const url = safeHttpsUrl(item.url);
		return label && label.length <= 40 && url ? [{ label, url, network: socialNetwork(label, url) }] : [];
	});
}

/** The footer's name, address, opening hours, slogan, map link and social links from `site.info`; `null` when the setting is not there at all. */
export function infoFromSetting(info: unknown): ChromeInfo | null {
	if (!isObject(info)) return null;
	return {
		name: textOf(info.name),
		openingHours: textOf(info.openingHours),
		address: textOf(info.address),
		slogan: textOf(info.slogan),
		mapsUrl: safeHttpsUrl(info.mapsUrl),
		social: socialFromInfo(info),
	};
}

// ── The notice (the `site.announcement` setting) ────────────────────────────

/**
 * What the welcome notice shows:
 *  - `absent`: the admin never saved the setting, so the notice keeps the text written in the component;
 *  - `off`: the admin turned it off, left the text empty, or its last day has passed: no notice at all;
 *  - `on`: the admin's text (and link), shown until `endsAt` (ms; `null` = no last day).
 */
export type ChromeNotice = { state: "absent" } | { state: "off" } | { state: "on"; id: string; text: string; link: ChromeLink | null; endsAt: number | null };

/** End of the `expires` day (YYYY-MM-DD) in Vietnam time (UTC+7), or `null` when it never expires (empty or unreadable), as www's announcementEndsAt. */
export function noticeEndsAt(expires: unknown): number | null {
	if (typeof expires !== "string" || !expires.trim()) return null;
	const end = Date.parse(`${expires.trim()}T23:59:59.999+07:00`);
	return Number.isNaN(end) ? null : end;
}

/** Whether a notice that is `on` is still inside its dates at `now` (the browser asks again, as the page may be older than the last day). */
export const noticeIsCurrent = (endsAt: number | null, now: number): boolean => endsAt === null || now <= endsAt;

/** Changes with the notice, so people who closed the old one see the new one (the admin's own rule when it saved no id). */
function noticeId(raw: unknown, text: string, href: string): string {
	if (typeof raw === "string" && raw.trim()) return raw.trim();
	let hash = 0;
	for (const char of `${text}|${href}`) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
	return `tb-${hash.toString(36)}`;
}

/** The notice's link: an address on this site (`/…`) or an https address, as the admin allows; anything else is dropped. */
function noticeLink(raw: unknown): ChromeLink | null {
	if (!isObject(raw) || typeof raw.href !== "string") return null;
	const given = raw.href.trim();
	const inSite = /^\/(?!\/)[^\s\\]*$/.test(given);
	const href = inSite ? given : safeHttpsUrl(given);
	if (!href) return null;
	const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 60) : "Xem thêm";
	return { label, href: menuHref(href), newTab: !inSite };
}

/** The notice to show now, from `site.announcement`. The admin's own switch (`active`) is honoured, then the text, then the last day. */
export function noticeFromSetting(raw: unknown, now: number): ChromeNotice {
	if (!isObject(raw)) return { state: "absent" };
	const text = typeof raw.text === "string" ? raw.text.trim() : "";
	if (raw.active !== true || !text) return { state: "off" };
	const endsAt = noticeEndsAt(raw.expires);
	if (!noticeIsCurrent(endsAt, now)) return { state: "off" };
	const link = noticeLink(raw.link);
	return { state: "on", id: noticeId(raw.id, text, link?.href ?? ""), text, link, endsAt };
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
