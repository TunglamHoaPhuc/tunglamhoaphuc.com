// What the page /lien-he shows, from the admin's `site.info` setting (Cấu hình > Thông tin trang): the temple's name, address, opening
// hours, the people to call, the map link and the social links, the same fields the footer draws. Nothing is written in code: a
// field the admin left empty (or never saved) is not on the page, and a failed read is an empty state, never a bundled copy.
// Pure apart from `loadContactPage`, which reads the settings through the reader the page frame uses (lib/tlhp-site/siteData.ts).
import type { ContactLine } from "@/lib/contact-format";
import { getSettings, siteDataFailed } from "@/lib/tlhp-site/siteData";
import { type ChromeSocial, contactsFromInfo, infoFromSetting, safeHttpsUrl } from "@/lib/v3-menu";

export type ContactPageData = {
	/** The temple's name as the admin wrote it; "" when there is none. */
	name: string;
	/** The name with "Chùa" before it, for the card of the map; "" when there is no name. */
	title: string;
	slogan: string;
	address: string;
	openingHours: string;
	/** The admin's map link (https only); "" when there is none. */
	mapsUrl: string;
	/** An embeddable Google map of the temple (see `mapEmbedUrl`); "" when there is neither a usable link nor an address. */
	mapEmbedUrl: string;
	/** The people to call, in the admin's order. */
	phones: ContactLine[];
	social: ChromeSocial[];
	/** False when the setting was never saved or D1 could not be read: the page then says the details are being updated. */
	known: boolean;
};

/** "Chùa X" unless the name already begins with "Chùa". */
export function templeTitle(name: string): string {
	const text = name.trim();
	if (!text) return "";
	return /^chùa(\s|$)/i.test(text) ? text : `Chùa ${text}`;
}

const COORDS = [/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, /[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i, /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/];

/** The place of a Google Maps link that carries its coordinates (`@lat,lng`, `?q=lat,lng`, `!3d..!4d..`), as `lat,lng`; "" for a short link or any other. */
export function coordinatesOf(mapsUrl: string): string {
	for (const pattern of COORDS) {
		const hit = mapsUrl.match(pattern);
		if (!hit) continue;
		const lat = Number(hit[1]);
		const lng = Number(hit[2]);
		if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return `${hit[1]},${hit[2]}`;
	}
	return "";
}

/**
 * The address of the map put on the page (a plain iframe, no script): the coordinates when the admin's link has them, otherwise the
 * address the admin typed (a short link such as maps.app.goo.gl hides its place and cannot be embedded). "" when neither is there.
 */
export function mapEmbedUrl(mapsUrl: string, address: string): string {
	const place = coordinatesOf(mapsUrl) || address.trim();
	return place ? `https://www.google.com/maps?q=${encodeURIComponent(place)}&z=17&output=embed` : "";
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The page's data from the settings the frame read. `failed` is a read that did not work: the empty state. */
export function contactPageFrom(settings: Record<string, unknown>, failed: boolean): ContactPageData {
	const raw = settings["site.info"];
	const info = failed || !isObject(raw) ? null : infoFromSetting(raw);
	const mapsUrl = safeHttpsUrl(info?.mapsUrl);
	const address = info?.address ?? "";
	return {
		name: info?.name ?? "",
		title: templeTitle(info?.name ?? ""),
		slogan: info?.slogan ?? "",
		address,
		openingHours: info?.openingHours ?? "",
		mapsUrl,
		mapEmbedUrl: info ? mapEmbedUrl(mapsUrl, address) : "",
		phones: info ? (contactsFromInfo(raw) ?? []) : [],
		social: info?.social ?? [],
		known: info !== null,
	};
}

export async function loadContactPage(): Promise<ContactPageData> {
	const failed = await siteDataFailed();
	return contactPageFrom(failed ? {} : await getSettings(), failed);
}
