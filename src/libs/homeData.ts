// What the home page needs from D1 beyond `setting`: the active quotes of "Lời Thầy dạy" and the addresses of the pictures
// the home blocks name (by media id). Read only when the site reads its content from D1 (CONTENT_SOURCE=d1); anywhere else, or when
// a read fails, the page gets nothing extra and shows what is written in src/config/site.ts. Fresh every minute, like siteData.
import { MEDIA_BASE } from "./content/media";
import { contentSource, lazy } from "./content/repository";
import type { D1Like } from "./content/sources/d1";
import { readHero, readQuotesSetting, readWelcome } from "./homeSettings";
import { renewingAsync } from "./renew-async";
import { getSettings, type SettingsMap } from "./siteData";

export type HomeQuote = { id: string; text: string; author: string; source: string; sourceUrl: string };

/** The home settings plus what they point at. `EMPTY` is "nothing from the admin". */
export type HomeExtras = {
	settings: SettingsMap;
	/** Active quotes in the admin's order; empty unless the admin chose the quotes as the source. */
	quotes: HomeQuote[];
	/** media id -> address of the picture. */
	media: Record<string, string>;
};

export const EMPTY_HOME_EXTRAS: HomeExtras = { settings: {}, quotes: [], media: {} };

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");

/** The media ids the live home blocks name. */
export function mediaIdsOf(settings: SettingsMap): string[] {
	const ids = new Set<string>();
	for (const slide of readHero(settings["home.hero"])?.slides ?? []) {
		if (slide.imageMediaId) ids.add(slide.imageMediaId);
		if (slide.portraitMediaId) ids.add(slide.portraitMediaId);
	}
	const welcome = readWelcome(settings["home.welcome"]);
	if (welcome?.imageMediaId) ids.add(welcome.imageMediaId);
	return [...ids].slice(0, 30);
}

export async function readHomeExtras(db: D1Like, settings: SettingsMap): Promise<HomeExtras> {
	const media: Record<string, string> = {};
	const ids = mediaIdsOf(settings);
	if (ids.length) {
		const rows = (await db.prepare(`select id, r2_key, url from media where deleted_at is null and id in (${ids.map(() => "?").join(",")})`).bind(...ids).all<Row>()).results;
		for (const row of rows) {
			const src = text(row.r2_key) ? `${MEDIA_BASE}/${text(row.r2_key)}` : text(row.url);
			if (src) media[text(row.id)] = src;
		}
	}
	let quotes: HomeQuote[] = [];
	if (readQuotesSetting(settings["home.quotes"])?.source === "trich-dan") {
		const rows = (await db.prepare("select id, text, author, source, source_url from quote where deleted_at is null and active = 1 order by position, id limit 200").all<Row>()).results;
		quotes = rows.filter((row) => text(row.text).trim()).map((row) => ({ id: text(row.id), text: text(row.text), author: text(row.author), source: text(row.source), sourceUrl: text(row.source_url) }));
	}
	return { settings, quotes, media };
}

const source = (async () => {
	if (contentSource() !== "d1") return () => Promise.resolve(EMPTY_HOME_EXTRAS);
	const workers = (await (import("cloudflare:workers" as string) as Promise<{ env?: { DB?: D1Like } }>).catch(() => ({}) as { env?: { DB?: D1Like } })) as { env?: { DB?: D1Like } };
	const db = workers.env?.DB;
	if (!db) return () => Promise.resolve(EMPTY_HOME_EXTRAS);
	return renewingAsync(
		() =>
			getSettings()
				.then((settings) => readHomeExtras(db, settings))
				.catch((error: unknown) => {
					console.error("homeData: read failed, using the defaults", error);
					return EMPTY_HOME_EXTRAS;
				}),
		60_000,
		{ name: "homeData" },
	);
});

// What is kept is the function `source` made, once it exists; never the pending promise of making it.
const reader = lazy(source, "homeData.setup");

/** What the admin set for the home page, or nothing (`EMPTY_HOME_EXTRAS`): the page then looks as it always has. */
export async function getHomeExtras(): Promise<HomeExtras> {
	return (await reader())();
}
