// The home page's "Khu vực & Bảo tượng" sliders. The choice of which areas and statues lead the home page is V3's own
// (the admin has no home setting for it at this base); what each one says and shows (name, subtitle, picture, link) is D1's.
// A pick that is hidden, a draft or deleted in D1 is not on the slider.
import type { StatueRecord } from "@/lib/statue-types";
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

export function homeGallery(areas: V3Area[], statues: StatueRecord[]): { areas: HomeGalleryArea[]; statues: HomeGalleryStatue[] } {
	return {
		areas: FEATURED_AREA_PICKS.flatMap(({ slug, icon }) => {
			const area = areas.find((a) => a.slug === slug);
			return area ? [{ id: area.id, name: area.name.toUpperCase(), subtitle: area.subtitle, imgUrl: area.imgUrl, targetUrl: `/vu-tru-phat-giao/${area.slug}`, iconName: icon }] : [];
		}),
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
