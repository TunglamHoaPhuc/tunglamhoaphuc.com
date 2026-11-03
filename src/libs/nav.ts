import type { NavItem, NavLink } from "@/config/site";

/**
 * A link is current when the page is its path or a page below it. Links to a section of a
 * page (with #) are never current, so "Đăng ký khóa tu" does not light up with "Lịch tu học".
 */
export function isCurrentLink(pathname: string, link: NavLink): boolean {
	if (link.href.includes("#") || !link.href.startsWith("/")) return false;
	if (link.href === "/") return pathname === "/";
	return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

/** A dropdown is current when any of its pages is. */
export function isCurrentItem(pathname: string, item: NavItem): boolean {
	return isCurrentLink(pathname, item) || (item.children ?? []).some((child) => isCurrentLink(pathname, child));
}

/** aria-current for a menu link: "page" on the page itself, "true" on a page below it. */
export function ariaCurrent(pathname: string, link: NavLink): "page" | "true" | undefined {
	if (!isCurrentLink(pathname, link)) return undefined;
	return pathname === link.href ? "page" : "true";
}
