// What a V3 page does when it finds nothing at its address: before saying 404 it asks the admin's redirect table, so an
// article whose slug or section the admin changed still opens from its old address (www writes the row when it changes them).
// The table is read only when V3 reads from D1; V3 never writes to it (no hit counting).
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { findRedirect, makesLoop, pathOf, type Found } from "@/lib/tlhp-site/redirects";
import type { D1Like } from "@/lib/tlhp-content/sources/d1";
import { siteDb } from "@/lib/v3-db";

/**
 * The redirect for `path`, or `null`: none stored, inactive, reserved prefix, a destination off this site, a redirect to
 * itself, or a chain that comes back to `path` within a few steps (a loop answers 404, never an endless redirect).
 */
export async function resolveRedirect(db: D1Like, path: string): Promise<Found | null> {
	const found = await findRedirect(db, path);
	if (!found) return null;
	const from = pathOf(path);
	const next = async (at: string) => (await findRedirect(db, at))?.to ?? null;
	if (await makesLoop(from, found.to, next)) return null;
	return found;
}

/**
 * Redirects when the table has an active row for `path` (301 or 302 as the row says); returns when it has none, when V3
 * does not read from D1, or when the table cannot be read, so the caller goes on to `notFound()`.
 */
export async function redirectIfMoved(path: string): Promise<void> {
	const db = await siteDb();
	if (!db) return;
	const found = await resolveRedirect(db, path).catch(() => null);
	if (!found) return;
	if (found.code === 301) permanentRedirect(found.to);
	redirect(found.to);
}

/** The 404 of a page that found nothing: after the redirect table has had its say. */
export async function notFoundOrMoved(path: string): Promise<never> {
	await redirectIfMoved(path);
	notFound();
}
