// What the admin edits and the public site then shows: the rows of `setting` (site info, home blocks,
// announcement…) and the menus. Read from D1 only when the site reads its content from D1 (CONTENT_SOURCE=d1);
// anywhere else, or when a read fails, the callers get `null`/`{}` and use what is written in src/config/site.ts.
// A fresh read is made every minute, like the content repository.
import { contentSource, renewing } from "./content/repository";
import type { D1Like } from "./content/sources/d1";

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

/** The visible items of a menu as a tree (parents with their children), in order; `null` when the menu has no items. */
export async function readMenu(db: D1Like, menuId: string): Promise<MenuNode[] | null> {
	const rows = (await db.prepare("select * from menu_item where menu_id = ? and deleted_at is null and visible = 1 order by position, id").bind(menuId).all<Row>()).results;
	if (!rows.length) return null;
	const nodes = new Map<string, MenuNode>();
	for (const row of rows) {
		nodes.set(text(row.id), {
			id: text(row.id),
			label: text(row.label),
			href: text(row.href),
			openNewTab: Number(row.open_new_tab) === 1,
			icon: { type: (text(row.icon_type) as MenuIcon["type"]) || "none", name: text(row.icon_name), svg: text(row.icon_svg), url: text(row.icon_url), color: text(row.icon_color) },
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
	return renewing(() => load(db).catch((error: unknown) => {
		console.error("siteData: read failed, using the defaults", error);
		return EMPTY;
	}), 60_000);
});

let pending: Promise<() => Promise<Loaded>> | undefined;
async function data(): Promise<Loaded> {
	pending ??= loaded();
	return (await pending)();
}

/** The admin's settings, or `{}`: read one with a fallback, e.g. `settings["site.info"] ?? defaults`. */
export async function getSettings(): Promise<SettingsMap> {
	return (await data()).settings;
}

/** A menu the admin edited, or `null` to use the one in src/config/site.ts. */
export async function getMenu(menuId: "header" | "footer" | "sidebar"): Promise<MenuNode[] | null> {
	return (await data()).menus.get(menuId) ?? null;
}
