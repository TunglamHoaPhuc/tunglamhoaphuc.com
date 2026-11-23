// What the page frame needs from D1, read once by the root layout (components/public/SiteChrome.tsx hands it to the
// client components): the visible areas for the navigation panel, the header menu and the footer's phone lines.
//  - D1 has no menu items / no phones saved → `null`: V3 keeps the menu and lines written in its components.
//  - D1 cannot be read → empty (`[]`), logged: an empty state, never a bundled copy.
import type { ChromeState } from "@/components/public/SiteChrome";
import { getMenu, getSettings, siteDataFailed, type MenuNode } from "@/lib/tlhp-site/siteData";
import { contactsFromInfo, infoFromSetting, menuToNav } from "@/lib/v3-menu";
import { liveAreas } from "@/lib/v3-live";

/** The frame's state from what was read; a failed read is an empty frame (no menu, no phones, no address), not the built-in one. */
export function buildChrome(read: { areas: ChromeState["areas"]; failed: boolean; nodes: MenuNode[] | null; settings: Record<string, unknown> }): ChromeState {
	if (read.failed) return { areas: read.areas, nav: [], contacts: [], info: { openingHours: "", address: "", slogan: "" } };
	return {
		areas: read.areas,
		nav: read.nodes ? menuToNav(read.nodes) : null,
		contacts: contactsFromInfo(read.settings["site.info"]),
		info: infoFromSetting(read.settings["site.info"]),
	};
}

export async function loadSiteChrome(): Promise<ChromeState> {
	let areas: ChromeState["areas"] = [];
	try {
		areas = (await liveAreas()).map((a) => ({ id: a.id, slug: a.slug, name: a.name, subtitle: a.subtitle, pinNumber: a.pinNumber }));
	} catch (error) {
		console.error("v3-chrome: cannot read the areas", error);
	}
	const failed = await siteDataFailed();
	return buildChrome({ areas, failed, nodes: failed ? null : await getMenu("header"), settings: failed ? {} : await getSettings() });
}
