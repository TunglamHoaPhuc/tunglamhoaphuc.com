// The D1 binding for the few V3 reads that go beyond the content repository (statue links, site settings, menus, redirects).
// Only when V3 reads its content from D1 (CONTENT_SOURCE=d1): anywhere else (snapshot, local runs, tests) it answers null
// and the caller knows there is nothing from the admin to add.
import { contentSource } from "@/lib/tlhp-content/repository";
import type { D1Like } from "@/lib/tlhp-content/sources/d1";

/** The D1 binding, or null when V3 is not reading from D1 or no Worker is running. */
export async function siteDb(): Promise<D1Like | null> {
	try {
		if (contentSource() !== "d1") return null;
		const workers = (await import("cloudflare:workers" as string)) as { env?: { DB?: D1Like } };
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
