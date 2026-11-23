// What a public page does when it finds nothing at its address: before saying 404 it asks the redirect table, so an article
// whose slug or section the admin changed still opens from its old address (the admin writes the row when it changes them).
import { permanentRedirect, redirect } from "next/navigation";
import { countHit, findRedirect } from "@/libs/redirects";
import { afterResponse, siteDb } from "@/libs/siteDb";

/**
 * Redirects when the table has an active row for `path` (a 301 or a 302, as the row says); returns when it has none, when the
 * site does not read from D1, or when the table cannot be read, so the caller goes on to `notFound()`.
 */
export async function redirectIfMoved(path: string): Promise<void> {
	const db = await siteDb();
	if (!db) return;
	const found = await findRedirect(db, path).catch(() => null);
	if (!found) return;
	await afterResponse(countHit(db, found.fromPath));
	if (found.code === 301) permanentRedirect(found.to);
	redirect(found.to);
}
