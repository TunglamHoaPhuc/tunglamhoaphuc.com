// The home page's "Khu vực & Bảo tượng" sliders. Which areas lead the slider is the admin's choice (area.featured, in
// featured_position order); only when the admin flagged none (or none of the flagged is on the site) does V3's own list
// stand. The admin has no featured flag for statues, so the statue picks stay V3's own. What each one says and shows (name,
// subtitle, picture, link) is D1's. A pick that is hidden, a draft or deleted in D1 is not on the slider.
import type { StatueRecord } from "@/lib/statue-types";
import type { D1Like } from "@/lib/tlhp-content/sources/d1";
import type { V3Area } from "@/lib/v3-data";

export type HomeGalleryArea = { id: string; name: string; subtitle: string; imgUrl: string; targetUrl: string; iconName: string };
export type HomeGalleryStatue = { id: string; name: string; cluster: string; area: string; imgUrl: string; targetUrl: string; iconName: string; imgPosition?: string };

export const FEATURED_AREA_PICKS = [
	{ slug: "tam-bao", icon: "Landmark" },
	{ slug: "to-duong", icon: "Sun" },
	{ slug: "bao-tang", icon: "Compass" },
	{ slug: "bao-thap-van-phat-xa-loi", icon: "Scroll" },
	{ slug: "giang-duong", icon: "BookOpen" },
];

export const FEATURED_STATUE_PICKS: { code: string; icon: string; position?: string }[] = [
	{ code: "TP0001", icon: "Landmark" },
	{ code: "TP0012", icon: "Sun", position: "center 15%" },
	{ code: "TP0045", icon: "Scroll" },
	{ code: "TP0051", icon: "Compass", position: "center 15%" },
];

/** The icons an area the admin featured is given when V3's list has none for it, in turn (design, not data). */
const SPARE_ICONS = ["Landmark", "Sun", "Compass", "Scroll", "BookOpen"];

/**
 * The ids of the areas the admin featured (not hidden, not deleted), in the order it set. Empty when it featured none, or when
 * D1 cannot answer (a column the database does not have yet, a failed read): the home page then keeps V3's own list.
 */
export async function readFeaturedAreaIds(db: D1Like): Promise<string[]> {
	try {
		const rows = (await db.prepare("select id from area where featured = 1 and visible = 1 and deleted_at is null order by featured_position, id").all<{ id: unknown }>()).results;
		return rows.flatMap((row) => (typeof row.id === "string" && row.id ? [row.id] : []));
	} catch (error) {
		console.error("v3-home: cannot read the featured areas", error);
		return [];
	}
}

/** The areas the slider leads with: the admin's featured ones in its order (those live on the site), else V3's own picks. */
export function featuredAreaPicks(areas: V3Area[], featuredIds: readonly string[]): { area: V3Area; icon: string }[] {
	const byAdmin = featuredIds.flatMap((id) => areas.find((a) => a.id === id) ?? []);
	if (byAdmin.length) {
		return byAdmin.map((area, index) => ({ area, icon: FEATURED_AREA_PICKS.find((pick) => pick.slug === area.slug)?.icon ?? SPARE_ICONS[index % SPARE_ICONS.length] }));
	}
	return FEATURED_AREA_PICKS.flatMap(({ slug, icon }) => {
		const area = areas.find((a) => a.slug === slug);
		return area ? [{ area, icon }] : [];
	});
}

export function homeGallery(areas: V3Area[], statues: StatueRecord[], featuredAreaIds: readonly string[] = []): { areas: HomeGalleryArea[]; statues: HomeGalleryStatue[] } {
	return {
		areas: featuredAreaPicks(areas, featuredAreaIds).map(({ area, icon }) => ({ id: area.id, name: area.name.toUpperCase(), subtitle: area.subtitle, imgUrl: area.imgUrl, targetUrl: `/vu-tru-phat-giao/${area.slug}`, iconName: icon })),
		statues: FEATURED_STATUE_PICKS.flatMap(({ code, icon, position }) => {
			const s = statues.find((item) => item.code === code);
			if (!s) return [];
			const item: HomeGalleryStatue = { id: s.id, name: s.name, cluster: s.assemblyName.toUpperCase(), area: s.areaName.toUpperCase(), imgUrl: s.imgUrl, targetUrl: `/bao-tuong/${s.slug}`, iconName: icon };
			const at = s.imgPosition ?? position;
			if (at) item.imgPosition = at;
			return [item];
		}),
	};
}
