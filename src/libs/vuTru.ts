// Vũ Trụ Phật Giáo for the pages: the temple's areas in map order, each numbered with its pin,
// and the statues standing in an area (config/vuTru.ts holds what the data lacks).
import { vuTru } from "@/config/vuTru";
import type { Area, StatueSummary } from "@/libs/content/types";

export type MapArea = Area & {
	/** Its number on the map and in the lists, 1 for the first pin. */
	number: number;
	/** Where its pin goes, in % of the map picture; `null` when it has no place yet. */
	pin: { x: number; y: number } | null;
};

/** What a card or a slide needs of an area (a page sends no more to the browser). */
export type AreaTeaser = Pick<MapArea, "slug" | "number" | "name" | "subtitle" | "cover">;

/**
 * The areas of Tùng Lâm Hòa Phúc in the map's order, then any area the map does not know
 * yet (new in the admin) at the place its editors gave it.
 */
export function templeAreas(areas: Area[]): MapArea[] {
	const order = vuTru.pins.map((pin) => pin.slug);
	const rank = (area: Area) => {
		const at = order.indexOf(area.slug);
		return at < 0 ? order.length : at;
	};
	return areas
		.filter((area) => area.temple === vuTru.temple)
		.map((area, index) => ({ area, index }))
		.sort((a, b) => rank(a.area) - rank(b.area) || a.index - b.index)
		.map(({ area }, at) => {
			const pin = vuTru.pins.find((item) => item.slug === area.slug);
			return { ...area, number: at + 1, pin: pin ? { x: pin.x, y: pin.y } : area.mapPos };
		});
}

/** The statues of an area: the main ones (with pages of their own) and the works of art. */
export function statuesIn(area: Area, statues: StatueSummary[]): { main: StatueSummary[]; art: StatueSummary[] } {
	const codes = vuTru.statueAreas[area.slug] ?? [];
	const here = statues.filter((statue) => codes.includes(statue.areaCode));
	return { main: here.filter((statue) => statue.main), art: here.filter((statue) => !statue.main) };
}

export const areaHref = (slug: string) => `${vuTru.path}/${slug}`;
