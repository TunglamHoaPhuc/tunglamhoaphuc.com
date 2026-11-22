// Vũ Trụ Phật Giáo for the pages that show every area at once (the 2D map): the visible areas D1 holds, placed on the map.
// A hidden or deleted area is not in `areas` (lib/v3-live.ts), so it has no pin, no card and no menu entry.
// Where the pins go is design, not data: it stays here (www config/vuTru.ts holds the same table); an area the table does
// not know yet (new in the admin) goes where its editors placed it (`mapPos`), or is left off the map when they gave none.
import type { StatueRecord } from "@/lib/statue-types";
import type { V3Area } from "@/lib/v3-data";

/** The pins in the order of the walk from Lầu Kinh Luân by the river to Sân La Hán, in % of the map drawing. */
export const MAP_PINS: { slug: string; x: number; y: number }[] = [
	{ slug: "ho-phong-sinh", x: 6, y: 46 },
	{ slug: "cong-tam-quan", x: 30, y: 52 },
	{ slug: "to-duong", x: 50, y: 42 },
	{ slug: "tam-bao", x: 50, y: 49 },
	{ slug: "dai-nam-quoc-mau", x: 53, y: 66 },
	{ slug: "bao-tang", x: 56, y: 76 },
	{ slug: "bao-thap-van-phat-xa-loi", x: 47, y: 15 },
	{ slug: "giang-duong", x: 71, y: 39 },
	{ slug: "tang-kinh-cac", x: 76, y: 23 },
	{ slug: "tu-an", x: 67, y: 27 },
	{ slug: "trai-duong", x: 64, y: 14 },
	{ slug: "san-di-da", x: 57, y: 33 },
	{ slug: "lang-xa-tam-linh", x: 42, y: 57 },
	{ slug: "san-la-han", x: 42, y: 79 },
];

export type MapSpot = {
	id: string;
	number: number;
	name: string;
	subtitle: string;
	slug: string;
	mapPos: { x: number; y: number };
	imgUrl: string;
	description: string;
	/** D1 keeps no quote for an area: empty, and the map shows no quote block. */
	quote: string;
	/** The main statues of the area (up to four), from D1. */
	statues: Array<{ name: string; imgUrl: string }>;
	stories: Array<{ title: string; imgUrl: string; summary: string }>;
};

/** The map's spots: the visible areas of the temple in the map's order, then any the table does not know, numbered from 1. */
export function mapSpotsOf(areas: V3Area[], statues: StatueRecord[], temple = "tung-lam-hoa-phuc"): MapSpot[] {
	const order = MAP_PINS.map((pin) => pin.slug);
	const rank = (slug: string) => {
		const at = order.indexOf(slug);
		return at < 0 ? order.length : at;
	};
	const spots: MapSpot[] = [];
	const placed = areas
		.filter((area) => area.temple === temple)
		.map((area, index) => ({ area, index }))
		.sort((a, b) => rank(a.area.slug) - rank(b.area.slug) || a.index - b.index);
	for (const { area } of placed) {
		const pin = MAP_PINS.find((item) => item.slug === area.slug);
		const mapPos = pin ? { x: pin.x, y: pin.y } : area.mapPos;
		if (!mapPos) continue;
		spots.push({
			id: area.id,
			number: spots.length + 1,
			name: area.name.toUpperCase(),
			subtitle: area.subtitle.toUpperCase(),
			slug: area.slug,
			mapPos,
			imgUrl: area.imgUrl,
			description: area.description,
			quote: "",
			statues: statues
				.filter((s) => s.categoryType === "TƯỢNG CHÍNH" && s.areaSlug === area.slug && s.imgUrl)
				.slice(0, 4)
				.map((s) => ({ name: s.name, imgUrl: s.imgUrl })),
			stories: [],
		});
	}
	return spots;
}
