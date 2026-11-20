// What search engines are told about the site (T20): where the public site lives, which pages
// the sitemap lists, and the structured data (JSON-LD) of articles, events and the temple.
import { DONG_CHAY, TRI_TUE } from "@/config/sections";
import { site } from "@/config/site";
import { vuTru } from "@/config/vuTru";
import { book } from "@/config/triTue";
import { CALENDAR_PATH, eventPath, programSlug } from "@/libs/calendar";
import type { ContentRepository, Post, ScheduleEvent } from "@/libs/content/types";
import { isPublicHost } from "@/libs/hosts";
import { tongChiHref } from "@/libs/tongChiGroups";
import { areaHref } from "@/libs/vuTru";

/** Where the public site lives; links in data that outlives a request point here. */
export const PUBLIC_ORIGIN = "https://www.tunglamhoaphuc.com";

/** `https://<host>` for a request's host, falling back to the public site. */
export function originOf(host: string | null | undefined): string {
	const name = (host ?? "").trim().toLowerCase();
	if (!name) return PUBLIC_ORIGIN;
	// Local and preview hosts speak http only on the machine itself.
	return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(name) ? `http://${name}` : `https://${name}`;
}

/** Search engines may index only the public site; `v2.` and the like stay out. */
export const mayIndex = isPublicHost;

/** An absolute address: non-ASCII characters are percent-encoded, encoded ones kept. */
export function absoluteUrl(path: string, origin: string = PUBLIC_ORIGIN): string {
	return new URL(path, origin).href;
}

/** The pages with no data behind them: the sections' lists, the schedule, contact. */
export const FIXED_PATHS = [
	"/",
	"/gioi-thieu",
	"/tong-chi-tu-hoc",
	"/dong-chay-hoang-phap",
	"/vu-tru-phat-giao",
	"/bao-tuong-phat-giao",
	"/tri-tue-phat-phap",
	book.path,
	"/tri-tue-phat-phap/hoc-tieng-tang",
	"/lich-tu-hoc",
	"/lien-he",
];

export type SitemapEntry = { path: string; lastModified?: string };

/** Every public page: the fixed ones, then each post, teaching, topic, area and statue. */
export async function sitemapEntries(repository: ContentRepository): Promise<SitemapEntry[]> {
	const entries: SitemapEntry[] = FIXED_PATHS.map((path) => ({ path }));

	for (const section of [DONG_CHAY, TRI_TUE]) {
		for (let page = 1; ; page++) {
			const result = await repository.listPosts({ section: section.slug, sort: "newest", page, pageSize: 60 });
			for (const post of result.items) entries.push({ path: `${section.path}/${post.slug}`, lastModified: post.publishedDate.slice(0, 10) });
			if (page >= result.pageCount) break;
		}
	}
	for (const topic of await repository.listAboutTopics()) entries.push({ path: `/gioi-thieu/${topic.slug}` });
	for (const article of await repository.listTongChi()) entries.push({ path: tongChiHref(article.slug) });
	for (const area of await repository.listAreas()) entries.push({ path: areaHref(area.slug) });
	for (const statue of await repository.listStatues()) entries.push({ path: statue.href });
	// Each event and regular ceremony has its own page (/lich-tu-hoc/<slug>), reached only by links.
	const schedule = await repository.getSchedule();
	for (const event of schedule.events) entries.push({ path: eventPath(event) });
	for (const program of schedule.programs) entries.push({ path: `${CALENDAR_PATH}/${programSlug(program)}` });

	// A path once only, in the order found.
	const seen = new Set<string>();
	return entries.filter(({ path }) => (seen.has(path) ? false : (seen.add(path), true)));
}

/** The temple as an organisation and a place, for the home page. */
export function organizationJsonLd(origin: string = PUBLIC_ORIGIN) {
	return {
		"@context": "https://schema.org",
		"@type": ["Organization", "BuddhistTemple"],
		"@id": `${origin}/#chua`,
		name: site.name,
		alternateName: "Chùa Tùng Lâm Hòa Phúc",
		slogan: site.slogan,
		description: site.intro,
		url: absoluteUrl("/", origin),
		logo: absoluteUrl(site.logo.src, origin),
		image: absoluteUrl(site.hero.image.src, origin),
		telephone: `+84${site.phone.replace(/^0/, "")}`,
		address: {
			"@type": "PostalAddress",
			streetAddress: "Thôn Hòa Trúc",
			addressLocality: "Xã Phú Cát",
			addressRegion: "Hà Nội",
			addressCountry: "VN",
		},
		openingHours: ["Mo-Fr 07:30-10:30", "Mo-Fr 13:30-17:30"],
		hasMap: site.mapsUrl,
		sameAs: site.social.map((link) => link.href),
	};
}

/** The same temple as a `Place`, for the contact page and the map of the temple. */
export function placeJsonLd(origin: string = PUBLIC_ORIGIN) {
	return {
		"@context": "https://schema.org",
		"@type": "Place",
		name: `${site.name} – ${vuTru.title}`,
		address: organizationJsonLd(origin).address,
		hasMap: site.mapsUrl,
		url: absoluteUrl("/lien-he", origin),
	};
}

type ArticleLike = Pick<Post, "title" | "summary" | "author" | "publishedDate" | "banner" | "thumbnail">;

/** An article: a post of Dòng Chảy or Trí Tuệ. `path` is its own page. */
export function articleJsonLd(post: ArticleLike, path: string, origin: string = PUBLIC_ORIGIN) {
	const picture = post.banner ?? post.thumbnail;
	return {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: post.title.slice(0, 110),
		description: post.summary,
		datePublished: post.publishedDate,
		author: { "@type": post.author ? "Person" : "Organization", name: post.author || site.name },
		publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: absoluteUrl(site.logo.src, origin) } },
		mainEntityOfPage: absoluteUrl(path, origin),
		inLanguage: "vi",
		...(picture ? { image: [absoluteUrl(picture.src, origin)] } : {}),
	};
}

/** A retreat or ceremony on the schedule. Dates only: the times are free text. */
export function eventJsonLd(event: ScheduleEvent, origin: string = PUBLIC_ORIGIN) {
	return {
		"@context": "https://schema.org",
		"@type": "Event",
		name: event.title,
		description: event.description || event.subtitle || undefined,
		startDate: event.start,
		endDate: event.end,
		eventStatus: "https://schema.org/EventScheduled",
		eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
		location: {
			"@type": "Place",
			name: event.location || site.name,
			address: { "@type": "PostalAddress", streetAddress: "Thôn Hòa Trúc", addressLocality: "Xã Phú Cát", addressRegion: "Hà Nội", addressCountry: "VN" },
		},
		organizer: { "@type": "Organization", name: site.name, url: absoluteUrl("/", origin) },
		isAccessibleForFree: true,
		...(event.image ? { image: [absoluteUrl(event.image.src, origin)] } : {}),
	};
}

/** JSON for a `<script type="application/ld+json">`: `<` is escaped so text cannot close the tag. */
export function jsonLdText(data: unknown): string {
	return JSON.stringify(data).replace(/</g, "\\u003c");
}
