// Which admin writes change what the public site shows, so the edge cache of the pages (Workers Cache, made again every 5
// minutes otherwise) must be dropped at once: a published, hidden, edited or deleted article shows or goes within seconds.

/** The first part of an admin address (`posts/<id>/publish` → `posts`) for every area whose data reaches a public page. */
const PUBLIC_AREAS = new Set(["posts", "teachings", "pages", "categories", "menus", "menu-items", "media", "home", "events", "statues", "areas", "quotes", "seo", "redirects", "settings", "trash", "icons", "link-targets"]);

/** True when a write (POST, PUT, PATCH, DELETE) to this admin address can change a public page. Reads never do. */
export function affectsPublicSite(method: string, path: string): boolean {
	if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
	return PUBLIC_AREAS.has(path.split("/")[0] ?? "");
}
