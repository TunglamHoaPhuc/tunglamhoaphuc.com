// What the page frame needs from D1, read once by the root layout (components/public/SiteChrome.tsx hands it to the
// client components): the visible areas for the navigation panel. Read errors are logged and shown as nothing (an empty
// list), never as a bundled copy.
import type { ChromeState } from "@/components/public/SiteChrome";
import { liveAreas } from "@/lib/v3-live";

export async function loadSiteChrome(): Promise<ChromeState> {
	let areas: ChromeState["areas"] = [];
	try {
		areas = (await liveAreas()).map((a) => ({ id: a.id, slug: a.slug, name: a.name, subtitle: a.subtitle, pinNumber: a.pinNumber }));
	} catch (error) {
		console.error("v3-chrome: cannot read the areas", error);
	}
	return { areas };
}
