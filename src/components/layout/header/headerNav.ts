// Server side only: the header menu the admin edited, ready for the header, or null when the site's own menu
// (src/config/site.ts) is to be used. The icon library is imported here, on demand, and never reaches the browser.
import { getMenu } from "@/libs/siteData";
import { menuToNav, type HeaderItem } from "./menuNav";

export async function loadHeaderNav(): Promise<HeaderItem[] | null> {
	const nodes = await getMenu("header");
	if (!nodes?.length) return null;
	const needsLibrary = nodes.some((node) => [node, ...node.children].some((item) => item.icon.type === "library"));
	const librarySvg = needsLibrary ? (await import("@/admin/icons/render")).librarySvg : () => null;
	return menuToNav(nodes, librarySvg);
}
