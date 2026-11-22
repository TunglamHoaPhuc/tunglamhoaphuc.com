// The table of routes and of what each role holds, written by hand from docs/admin-architecture.md 6.4 (see the head of
// tests/unit/admin/permission-matrix.test.ts for what makes it a net and not a mirror of the code). It is shared: the in-process
// matrix (tests/unit/admin/permission-matrix.test.ts) and the sweep with real sessions over HTTP (tests/e2e/admin/permission-sweep.spec.ts)
// both read it, so there is one place to decide what a route needs.

// ------------------------------------------------------------------ what the routes should need (by hand)

/**
 * `METHOD path | needs [own] [super] [any:a.b,c.d]`
 *  needs: `module.action`, or public / pending / session-any / session
 *  own:   the handler checks the row's owner, so scope "own" passes the gate (only for pairs the docs allow as own)
 *  super: the handler itself also demands a Super Admin
 *  any:   the handler itself demands one of these (scope all) on top of a plain session
 */
export const EXPECTED_ROUTES = `
POST auth/login | public
POST auth/2fa/verify | pending
POST auth/refresh | public
POST auth/logout | pending
POST auth/forgot-password | public
POST auth/reset-password | public
GET auth/me | session-any
POST me/password | session-any
GET me/sessions | session
DELETE me/sessions/:id | session
DELETE me/sessions | session
POST me/2fa/setup | session
POST me/2fa/enable | session
POST me/2fa/disable | session
PATCH me | session
GET users | users.view
GET users/:id | users.view
POST users | users.create
PATCH users/:id | users.update
POST users/:id/lock | users.update
POST users/:id/unlock | users.update
POST users/:id/force-password-change | users.update
POST users/:id/reset-2fa | users.update super
GET users/:id/sessions | users.update
DELETE users/:id/sessions | users.update
DELETE users/:id | users.delete
GET roles | roles.view
GET roles/:id | roles.view
GET permissions | roles.view
POST roles | roles.create
PATCH roles/:id | roles.update
DELETE roles/:id | roles.delete
GET media | media.view
GET media/stats | media.view
GET media/folders | media.view
POST media/folders | media.create
PATCH media/folders/:id | media.update
DELETE media/folders/:id | media.delete
POST media | media.create
GET media/:id | media.view
PATCH media/:id | media.update own
PUT media/:id/file | media.update own
PUT media/:id/crops/:ratio | media.update own
DELETE media/:id/crops/:ratio | media.update own
DELETE media/:id | media.delete own
GET posts | posts.view
GET posts/counts | posts.view
GET posts/options | posts.view
GET posts/slug-check | posts.view
GET posts/related-candidates | posts.view
POST posts | posts.create
GET posts/:id | posts.view
PATCH posts/:id | posts.update own
DELETE posts/:id | posts.delete own
POST posts/:id/duplicate | posts.create
POST posts/:id/submit | posts.update own
POST posts/:id/publish | posts.publish
POST posts/:id/hide | posts.publish
POST posts/:id/unpublish | posts.publish
GET posts/:id/revisions | posts.view
GET posts/:id/revisions/:version | posts.view
GET posts/:id/revisions/:a/diff/:b | posts.view
POST posts/:id/revisions/:version/restore | posts.update own
POST posts/:id/preview-token | posts.update own
PUT posts/:id/related | posts.update own
GET teachings | teachings.view
GET teachings/counts | teachings.view
GET teachings/options | teachings.view
GET teachings/slug-check | teachings.view
POST teachings | teachings.create
GET teachings/:id | teachings.view
PATCH teachings/:id | teachings.update own
DELETE teachings/:id | teachings.delete own
POST teachings/:id/duplicate | teachings.create
POST teachings/:id/submit | teachings.update own
POST teachings/:id/publish | teachings.publish
POST teachings/:id/hide | teachings.publish
POST teachings/:id/unpublish | teachings.publish
GET teachings/:id/revisions | teachings.view
GET teachings/:id/revisions/:version | teachings.view
GET teachings/:id/revisions/:a/diff/:b | teachings.view
POST teachings/:id/revisions/:version/restore | teachings.update own
POST teachings/:id/preview-token | teachings.update own
GET pages | pages.view
GET pages/counts | pages.view
GET pages/options | pages.view
GET pages/slug-check | pages.view
POST pages | pages.create
GET pages/:id | pages.view
PATCH pages/:id | pages.update own
DELETE pages/:id | pages.delete own
POST pages/:id/duplicate | pages.create
POST pages/:id/submit | pages.update own
POST pages/:id/publish | pages.publish
POST pages/:id/hide | pages.publish
POST pages/:id/unpublish | pages.publish
GET pages/:id/revisions | pages.view
GET pages/:id/revisions/:version | pages.view
GET pages/:id/revisions/:a/diff/:b | pages.view
POST pages/:id/revisions/:version/restore | pages.update own
POST pages/:id/preview-token | pages.update own
GET categories | categories.view
POST categories/reorder | categories.update
GET categories/:id | categories.view
POST categories | categories.create
PATCH categories/:id | categories.update
DELETE categories/:id | categories.delete
GET menus/:menuId | menus.view
POST menus/:menuId/items | menus.create
PUT menus/:menuId/tree | menus.update
PATCH menu-items/:id | menus.update
DELETE menu-items/:id | menus.delete
GET link-targets | menus.view
GET icons | session
POST icons/sanitize-svg | session any:menus.update,categories.update
GET slug | session
GET events | events.view
GET events/categories | events.view
GET events/lunar | events.view
GET events/next | events.view
GET events/programs | events.view
PATCH events/programs/:id | events.update
GET events/themes | events.view
PUT events/themes/:month | events.update
GET events/:id | events.view
POST events | events.create
PATCH events/:id | events.update own
POST events/:id/duplicate | events.create
DELETE events/:id | events.delete own
GET statues | statues.view
GET statues/next-code | statues.view
GET statues/options | statues.view
POST statues/clusters | statues.create
GET statues/:id | statues.view
POST statues | statues.create
PATCH statues/:id | statues.update own
PUT statues/:id/images | statues.update own
PUT statues/:id/related | statues.update own
PUT statues/:id/variations | statues.update own
DELETE statues/:id | statues.delete own
GET areas | areas.view
PUT areas/featured | areas.update
GET areas/:id | areas.view
PATCH areas/:id | areas.update own
DELETE areas/:id | areas.delete own
GET quotes | quotes.view
POST quotes/reorder | quotes.update
GET quotes/:id | quotes.view
POST quotes | quotes.create
PATCH quotes/:id | quotes.update own
DELETE quotes/:id | quotes.delete own
GET home | home.view
PUT home/:block | home.update
POST home/:block/publish | home.publish
DELETE home/:block/draft | home.update
GET dashboard | dashboard.view
GET audit | audit.view
GET audit/:id | audit.view
GET trash/types | trash.view own
GET trash | trash.view own
POST trash/:type/:id/restore | trash.update own
DELETE trash/:type/:id | trash.delete own
GET seo/defaults | seo.view
PUT seo/defaults | seo.update
GET redirects | redirects.view
POST redirects | redirects.create
POST redirects/import | redirects.create
GET redirects/:id | redirects.view
PATCH redirects/:id | redirects.update
DELETE redirects/:id | redirects.delete
POST settings/smtp/test | settings.update super
GET settings/:group | settings.view
PUT settings/:group | settings.update
POST backup/export | backup.create
POST backup/run | backup.create
GET backup | backup.view
POST backup/:name/download | backup.view
`;

export type Entry = { key: string; method: string; path: string; needs: string; own: boolean; superOnly: boolean; any: string[] };

export const EXPECTED: Entry[] = EXPECTED_ROUTES.trim()
	.split("\n")
	.map((line) => {
		const [left, right] = line.split(" | ");
		const [method, path] = left.split(" ");
		const [needs, ...flags] = right.trim().split(" ");
		const any = flags.find((flag) => flag.startsWith("any:"));
		return { key: left, method, path, needs, own: flags.includes("own"), superOnly: flags.includes("super"), any: any ? any.slice(4).split(",") : [] };
	});

// ------------------------------------------------------------------ what each role holds (by hand, docs 6.4)

export const ACTIONS = ["view", "create", "update", "delete", "publish"];
export const EVERY = ACTIONS.join(",");
/** `module: "view,create,update:own"` per role. "(không)" in the docs is a missing module. */
export const DOCS_GRANTS: Record<string, Record<string, string>> = {
	"role-super-admin": {
		posts: EVERY, teachings: EVERY, pages: EVERY, categories: EVERY, menus: EVERY, media: EVERY, home: EVERY, quotes: EVERY, events: EVERY, statues: EVERY, areas: EVERY,
		seo: EVERY, redirects: EVERY, settings: EVERY, users: EVERY, roles: EVERY, audit: "view", trash: EVERY, backup: EVERY, dashboard: "view",
	},
	"role-admin": {
		posts: EVERY, teachings: EVERY, pages: EVERY, categories: EVERY, menus: EVERY, media: EVERY, home: EVERY, quotes: EVERY, events: EVERY, statues: EVERY, areas: EVERY,
		seo: EVERY, redirects: EVERY, settings: "view,update", users: "view,create,update", roles: "view", audit: "view", trash: EVERY, dashboard: "view",
	},
	"role-editor": {
		posts: EVERY, teachings: EVERY, pages: EVERY, categories: "view,create,update", menus: "view,create,update", media: "view,create,update,delete",
		home: "view,update,publish", quotes: "view,update,publish", events: EVERY, statues: EVERY, areas: EVERY, seo: "view,update", redirects: "view,update",
		trash: "view,update", dashboard: "view",
	},
	"role-author": {
		posts: "view,create,update:own,delete:own", teachings: "view,create,update:own,delete:own", pages: "view,create,update:own,delete:own",
		categories: "view", menus: "view", media: "view,create,update:own", home: "view", quotes: "view", events: "view", statues: "view", areas: "view",
		trash: "view:own", dashboard: "view",
	},
};

/**
 * A custom role with only limited rights, as the role editor allowed before the "own" scope was restricted (it also
 * holds `:own` on modules that cannot honour it: those must be worth nothing). Inserted straight into the database.
 */
export const CUSTOM_GRANTS: Record<string, string> = {
	posts: "view:own,update:own,delete:own", media: "view:own,update:own", users: "view:own", backup: "view:own", settings: "view:own", roles: "view:own", audit: "view:own",
	quotes: "update:own", areas: "update:own,delete:own", events: "delete:own", trash: "view:own,update:own,delete:own", dashboard: "view", categories: "update:own",
};

export type Grants = Map<string, "all" | "own">;
export function expand(spec: Record<string, string>): Grants {
	const out: Grants = new Map();
	for (const [module, list] of Object.entries(spec)) {
		for (const item of list.split(",")) {
			const own = item.endsWith(":own");
			out.set(`${module}.${own ? item.slice(0, -4) : item}`, own ? "own" : "all");
		}
	}
	return out;
}

export const PRINCIPALS = [
	{ id: "super", role: "role-super-admin", grants: expand(DOCS_GRANTS["role-super-admin"]) },
	{ id: "admin", role: "role-admin", grants: expand(DOCS_GRANTS["role-admin"]) },
	{ id: "editor", role: "role-editor", grants: expand(DOCS_GRANTS["role-editor"]) },
	{ id: "author", role: "role-author", grants: expand(DOCS_GRANTS["role-author"]) },
	{ id: "custom", role: "role-custom", grants: expand(CUSTOM_GRANTS) },
] as const;

/** Does the gate let this person through a route that needs `module.action` (own: the handler checks the owner)? */
export function gate(grants: Grants, needs: string, own: boolean): boolean {
	const scope = grants.get(needs);
	return scope === "all" || (scope === "own" && own);
}

/** Whether the person should get past everything a route checks before running any real work. */
export function allowed(principal: { id: string; grants: Grants }, entry: Entry): boolean {
	if (["public", "pending", "session-any", "session"].includes(entry.needs)) {
		if (entry.any.length) return entry.any.some((need) => gate(principal.grants, need, false));
		return true;
	}
	if (entry.superOnly && principal.id !== "super") return false;
	return gate(principal.grants, entry.needs, entry.own);
}

