// What the admin edits and the public site then shows: the rows of `setting` (site info, home blocks,
// announcement…) and the menus. Read from D1 only when the site reads its content from D1 (CONTENT_SOURCE=d1);
// anywhere else, or when a read fails, the callers get `null`/`{}` and use what is written in src/config/site.ts.
// A fresh read is made every minute, like the content repository.
import { MEDIA_BASE } from "./content/media";
import { contentSource, lazy } from "./content/repository";
import type { D1Like } from "./content/sources/d1";
import { renewingAsync } from "./renew-async";

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");

export type SettingsMap = Record<string, unknown>;

export type MenuIcon = { type: "none" | "library" | "svg" | "image"; name: string; svg: string; url: string; color: string };
export type MenuNode = { id: string; label: string; href: string; openNewTab: boolean; icon: MenuIcon; children: MenuNode[] };

async function query(db: D1Like, sql: string): Promise<Row[]> {
	return (await db.prepare(sql).all<Row>()).results;
}

/** Every row of `setting` as key → value (values are JSON in the table). */
export async function readSettings(db: D1Like): Promise<SettingsMap> {
	const out: SettingsMap = {};
	for (const row of await query(db, "select key, value from setting")) {
		try {
			out[text(row.key)] = JSON.parse(text(row.value));
		} catch {
			// a value that is not JSON is left out; the site's default stands
		}
	}
	return out;
}

/** The address of a menu icon taken from the media library, read fresh so a replaced picture shows at once; "" when the icon is not one. */
function mediaIconUrl(row: Row): string {
	if (!row.icon_media_id) return "";
	return text(row.media_key) ? `${MEDIA_BASE}/${text(row.media_key)}` : text(row.media_url);
}

/** The visible items of a menu as a tree (parents with their children), in order; `null` when the menu has no items. */
export async function readMenu(db: D1Like, menuId: string): Promise<MenuNode[] | null> {
	const rows = (await db.prepare("select i.*, m.r2_key as media_key, m.url as media_url from menu_item i left join media m on m.id = i.icon_media_id where i.menu_id = ? and i.deleted_at is null and i.visible = 1 order by i.position, i.id").bind(menuId).all<Row>()).results;
	if (!rows.length) return null;
	const nodes = new Map<string, MenuNode>();
	for (const row of rows) {
		nodes.set(text(row.id), {
			id: text(row.id),
			label: text(row.label),
			href: text(row.href),
			openNewTab: Number(row.open_new_tab) === 1,
			icon: { type: (text(row.icon_type) as MenuIcon["type"]) || "none", name: text(row.icon_name), svg: text(row.icon_svg), url: mediaIconUrl(row) || text(row.icon_url), color: text(row.icon_color) },
			children: [],
		});
	}
	const roots: MenuNode[] = [];
	for (const row of rows) {
		const node = nodes.get(text(row.id)) as MenuNode;
		const parent = row.parent_id ? nodes.get(text(row.parent_id)) : undefined;
		(parent ? parent.children : roots).push(node);
	}
	return roots;
}

type Loaded = { settings: SettingsMap; menus: Map<string, MenuNode[] | null> };

async function load(db: D1Like): Promise<Loaded> {
	const settings = await readSettings(db);
	const menus = new Map<string, MenuNode[] | null>();
	for (const id of ["header", "footer", "sidebar"]) menus.set(id, await readMenu(db, id));
	return { settings, menus };
}

const EMPTY: Loaded = { settings: {}, menus: new Map() };

const loaded = (async () => {
	if (contentSource() !== "d1") return () => Promise.resolve(EMPTY);
	const workers = (await (import("cloudflare:workers" as string) as Promise<{ env?: { DB?: D1Like } }>).catch(() => ({}) as { env?: { DB?: D1Like } })) as { env?: { DB?: D1Like } };
	const db = workers.env?.DB;
	if (!db) return () => Promise.resolve(EMPTY);
	// `renewingAsync`, not `renewing`: a read still in flight must not be awaited by another request (it can be cancelled as "hung").
	return renewingAsync(() => load(db).catch((error: unknown) => {
		console.error("siteData: read failed, using the defaults", error);
		return EMPTY;
	}), 60_000, { name: "siteData" });
});

// What is kept is the function `loaded` made, once it exists; never the pending promise of making it.
const reader = lazy(loaded, "siteData.setup");
async function data(): Promise<Loaded> {
	return (await reader())();
}

/** The admin's settings, or `{}`: read one with a fallback, e.g. `settings["site.info"] ?? defaults`. */
export async function getSettings(): Promise<SettingsMap> {
	return (await data()).settings;
}

/** A menu the admin edited, or `null` to use the one in src/config/site.ts. */
export async function getMenu(menuId: "header" | "footer" | "sidebar"): Promise<MenuNode[] | null> {
	return (await data()).menus.get(menuId) ?? null;
}
