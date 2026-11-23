// Which admin writes change what the public site shows, so the edge cache of the pages (Workers Cache, made again every 5
// minutes otherwise) must be dropped at once: a published, hidden, edited or deleted article shows or goes within seconds.

/** The first part of an admin address (`posts/<id>/publish` → `posts`) for every area whose data reaches a public page. */
const PUBLIC_AREAS = new Set(["posts", "teachings", "pages", "categories", "menus", "menu-items", "media", "home", "events", "statues", "areas", "quotes", "seo", "redirects", "settings", "trash", "icons", "link-targets"]);

/** True when a write (POST, PUT, PATCH, DELETE) to this admin address can change a public page. Reads never do. */
export function affectsPublicSite(method: string, path: string): boolean {
	if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
	const [area = "", second = "", third = ""] = path.split("/");
	if (!PUBLIC_AREAS.has(area)) return false;
	// A new article, page or teaching starts as a draft, and a preview link or a copy shows nothing on the site either: they must not
	// let any author drop the whole site's cache over and over.
	if (method === "POST" && second === "" && ["posts", "teachings", "pages"].includes(area)) return false;
	if (method === "POST" && (third === "preview-token" || third === "duplicate")) return false;
	// Writes that show nothing on the site: a new picture or folder in the library (nothing uses it yet), a test mail, an SVG check.
	if (area === "media" && method === "POST" && (second === "" || second === "folders")) return false;
	if (area === "settings" && second === "smtp") return false;
	if (area === "icons" && second === "sanitize-svg") return false;
	return true;
}
