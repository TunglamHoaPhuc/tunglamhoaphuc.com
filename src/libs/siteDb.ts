// The site's D1 database for the few public pages that read settings or redirects. Only when the site reads its content from D1
// (CONTENT_SOURCE=d1): everywhere else (snapshot, local runs, CI) this answers null and the callers use what is in the code.
import { contentSource } from "@/libs/content/repository";
import type { RedirectDb } from "@/libs/redirects";

export type SiteDb = RedirectDb;

/** The D1 binding, or null when the site is not reading from D1 or no Worker is running. */
export async function siteDb(): Promise<SiteDb | null> {
	try {
		if (contentSource() !== "d1") return null;
		const workers = (await import("cloudflare:workers" as string)) as { env?: { DB?: SiteDb } };
		return workers.env?.DB ?? null;
	} catch {
		return null;
	}
}

/** Runs work after the response (`waitUntil` on a Worker); otherwise lets it finish on its own. */
export async function afterResponse(work: Promise<unknown>): Promise<void> {
	try {
		const workers = (await import("cloudflare:workers" as string)) as { waitUntil?: (work: Promise<unknown>) => void };
		if (workers.waitUntil) return workers.waitUntil(work.catch(() => undefined));
	} catch {
		// no Worker here
	}
	void work.catch(() => undefined);
}

/** One setting's value (parsed JSON), or null when it is not there or cannot be read. */
export async function readSetting<T = unknown>(db: SiteDb, key: string): Promise<T | null> {
	try {
		const { results } = await db.prepare("SELECT value FROM setting WHERE key = ?").bind(key).all<{ value: unknown }>();
		const value = results[0]?.value;
		if (typeof value !== "string") return (value as T) ?? null;
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}
