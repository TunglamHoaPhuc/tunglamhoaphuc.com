// The permission matrix (tasks/admin-v3-spec.md, "Ma trận quyền"): every route the dispatcher knows x the four seeded
// roles + a custom role holding only limited ("own"-style) rights + a session that must still change its password +
// nobody signed in. Each cell says "allowed" (the gate lets the request through) or 403 / 401.
//
// What makes it a net and not a mirror of the code:
//  - EXPECTED_ROUTES is written by hand: for each route, what it should need. The routes the server really registers
//    (registeredRoutes(), read from the router, not copied) must equal this list in both directions, and what each one
//    declares (`needs`, `own`) must equal what is written here. A new route has no entry -> the test fails until
//    someone decides what it needs; a changed `needs` fails too.
//  - DOCS_GRANTS is written by hand from docs/admin-architecture.md 6.4 (the matrix of the four roles). A test checks the
//    seeded roles against it, and every cell's expectation is computed from it, not from the code under test.
//  - "allowed" means the gate passed: the request carries an empty body and an id that does not exist, so a handler
//    answers 400/404/415/503 and never writes. Only the gate (or a rule written in EXPECTED_ROUTES) can answer 403.
import { beforeAll, describe, expect, it } from "vitest";
import { registeredRoutes } from "../../../src/admin/http/api";
import { loadPermissions } from "../../../src/admin/rbac/check";
import { hashPassword } from "../../../src/admin/auth/password";
import { FAST, PASSWORD, world, type Seed } from "../helpers/adminWorld";

// ------------------------------------------------------------------ what the routes should need (by hand)

/**
 * `METHOD path | needs [own] [super] [any:a.b,c.d]`
 *  needs: `module.action`, or public / pending / session-any / session
 *  own:   the handler checks the row's owner, so scope "own" passes the gate (only for pairs the docs allow as own)
 *  super: the handler itself also demands a Super Admin
 *  any:   the handler itself demands one of these (scope all) on top of a plain session
 */
const EXPECTED_ROUTES = `
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
GET backup/:name/download | backup.view
`;

type Entry = { key: string; method: string; path: string; needs: string; own: boolean; superOnly: boolean; any: string[] };

const EXPECTED: Entry[] = EXPECTED_ROUTES.trim()
	.split("\n")
	.map((line) => {
		const [left, right] = line.split(" | ");
		const [method, path] = left.split(" ");
		const [needs, ...flags] = right.trim().split(" ");
		const any = flags.find((flag) => flag.startsWith("any:"));
		return { key: left, method, path, needs, own: flags.includes("own"), superOnly: flags.includes("super"), any: any ? any.slice(4).split(",") : [] };
	});

// ------------------------------------------------------------------ what each role holds (by hand, docs 6.4)

const ACTIONS = ["view", "create", "update", "delete", "publish"];
const EVERY = ACTIONS.join(",");
/** `module: "view,create,update:own"` per role. "(không)" in the docs is a missing module. */
const DOCS_GRANTS: Record<string, Record<string, string>> = {
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
const CUSTOM_GRANTS: Record<string, string> = {
	posts: "view:own,update:own,delete:own", media: "view:own,update:own", users: "view:own", backup: "view:own", settings: "view:own", roles: "view:own", audit: "view:own",
	quotes: "update:own", areas: "update:own,delete:own", events: "delete:own", trash: "view:own,update:own,delete:own", dashboard: "view", categories: "update:own",
};

type Grants = Map<string, "all" | "own">;
function expand(spec: Record<string, string>): Grants {
	const out: Grants = new Map();
	for (const [module, list] of Object.entries(spec)) {
		for (const item of list.split(",")) {
			const own = item.endsWith(":own");
			out.set(`${module}.${own ? item.slice(0, -4) : item}`, own ? "own" : "all");
		}
	}
	return out;
}

const PRINCIPALS = [
	{ id: "super", role: "role-super-admin", grants: expand(DOCS_GRANTS["role-super-admin"]) },
	{ id: "admin", role: "role-admin", grants: expand(DOCS_GRANTS["role-admin"]) },
	{ id: "editor", role: "role-editor", grants: expand(DOCS_GRANTS["role-editor"]) },
	{ id: "author", role: "role-author", grants: expand(DOCS_GRANTS["role-author"]) },
	{ id: "custom", role: "role-custom", grants: expand(CUSTOM_GRANTS) },
] as const;

/** Does the gate let this person through a route that needs `module.action` (own: the handler checks the owner)? */
function gate(grants: Grants, needs: string, own: boolean): boolean {
	const scope = grants.get(needs);
	return scope === "all" || (scope === "own" && own);
}

/** Whether the person should get past everything a route checks before running any real work. */
function allowed(principal: { id: string; grants: Grants }, entry: Entry): boolean {
	if (["public", "pending", "session-any", "session"].includes(entry.needs)) {
		if (entry.any.length) return entry.any.some((need) => gate(principal.grants, need, false));
		return true;
	}
	if (entry.superOnly && principal.id !== "super") return false;
	return gate(principal.grants, entry.needs, entry.own);
}

// ------------------------------------------------------------------ the world

const SEEDS: Seed[] = [
	{ id: "super", email: "super@example.test", roleId: "role-super-admin" },
	{ id: "admin", email: "admin@example.test", roleId: "role-admin" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor" },
	{ id: "author", email: "author@example.test", roleId: "role-author" },
];

type World = Awaited<ReturnType<typeof world>>;
type Client = Awaited<ReturnType<World["as"]>>;
let w: World;
const clients = new Map<string, Client>();
let forced: Client;
let anon: ReturnType<World["client"]>;

beforeAll(async () => {
	w = await world(SEEDS);
	w.raw.prepare("INSERT INTO role (id, name, description, is_system, created_at, updated_at) VALUES ('role-custom', 'Vai giới hạn', '', 0, '2026', '2026')").run();
	for (const [entry, scope] of expand(CUSTOM_GRANTS)) {
		const [module, action] = entry.split(".");
		w.raw.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES ('role-custom', ?, ?, ?)").run(module, action, scope);
	}
	const insert = w.raw.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at, must_change_password) VALUES (?, ?, ?, 'viewer', ?, ?, '2026', ?)");
	insert.run("custom", "custom@example.test", "custom", "role-custom", hashPassword(PASSWORD, FAST), 0);
	insert.run("forced", "forced@example.test", "forced", "role-editor", hashPassword(PASSWORD, FAST), 1);
	for (const principal of PRINCIPALS) clients.set(principal.id, await w.as(`${principal.id}@example.test`));
	forced = await w.as("forced@example.test");
	anon = w.client();
});

const concrete = (path: string) => path.replace(/:[A-Za-z]+/g, "x-none");
const send = (client: { call: Client["call"] }, entry: Entry) => client.call(entry.method, concrete(entry.path), entry.method === "GET" ? undefined : {});

// ------------------------------------------------------------------ the checks

describe("the table of routes is complete", () => {
	const registered = () => registeredRoutes().filter((route) => !route.path.startsWith("test/"));
	const keyOf = (route: { method: string; path: string }) => `${route.method} ${route.path}`;

	it("has an entry for every route the dispatcher knows (a new route must be decided here)", () => {
		const known = new Set(EXPECTED.map((entry) => entry.key));
		const missing = registered().map(keyOf).filter((key) => !known.has(key));
		expect(missing, "routes with no entry in EXPECTED_ROUTES: decide what each one needs").toEqual([]);
	});

	it("has no entry for a route that no longer exists, and no duplicate", () => {
		const real = new Set(registered().map(keyOf));
		expect(EXPECTED.map((entry) => entry.key).filter((key) => !real.has(key))).toEqual([]);
		expect(new Set(EXPECTED.map((entry) => entry.key)).size).toBe(EXPECTED.length);
	});

	it("declares what the table says: the same `needs` and the same `own` flag", () => {
		const byKey = new Map(registered().map((route) => [keyOf(route), route]));
		const wrong: string[] = [];
		for (const entry of EXPECTED) {
			const route = byKey.get(entry.key);
			if (!route) continue;
			const needs = typeof route.needs === "string" ? route.needs : `${route.needs.module}.${route.needs.action}`;
			if (needs !== entry.needs) wrong.push(`${entry.key}: declares ${needs}, expected ${entry.needs}`);
			if (!!route.own !== entry.own) wrong.push(`${entry.key}: own is ${!!route.own}, expected ${entry.own}`);
		}
		expect(wrong).toEqual([]);
	});

	it("lets scope 'own' through only where the docs allow it (update and delete of what someone owns, the trash)", () => {
		for (const entry of EXPECTED.filter((item) => item.own)) {
			const [module, action] = entry.needs.split(".");
			const ok = (["posts", "teachings", "pages", "events", "statues", "areas", "quotes", "media"].includes(module) && ["update", "delete"].includes(action)) || (module === "trash" && ["view", "update", "delete"].includes(action));
			expect(ok, `${entry.key} is marked own`).toBe(true);
		}
	});
});

describe("the seeded roles are the ones docs 6.4 describes", () => {
	it("holds exactly the documented permissions (a harmless extra is named below)", async () => {
		// docs 6.4 gives the Super Admin only `view` on the dashboard; the seed gives it every action (no route needs the others)
		const harmless = new Set(["dashboard.create", "dashboard.update", "dashboard.delete", "dashboard.publish"]);
		for (const principal of PRINCIPALS.filter((p) => p.id !== "custom")) {
			const seeded = await loadPermissions(w.deps.env.DB, principal.role);
			const extra = [...seeded].filter(([key, scope]) => principal.grants.get(key) !== scope && !(principal.id === "super" && harmless.has(key))).map(([key, scope]) => `${key}:${scope}`);
			const missing = [...principal.grants].filter(([key, scope]) => seeded.get(key) !== scope).map(([key, scope]) => `${key}:${scope}`);
			expect({ role: principal.id, extra, missing }).toEqual({ role: principal.id, extra: [], missing: [] });
		}
	});
});

describe("every route x every role", () => {
	for (const principal of PRINCIPALS) {
		it(`${principal.id}: each route answers as the docs matrix says`, async () => {
			const client = clients.get(principal.id)!;
			const problems: string[] = [];
			for (const entry of EXPECTED) {
				if (entry.needs === "public" || entry.needs === "pending") continue; // below: they ask for no permission
				if (entry.key === "POST auth/logout") continue;
				const result = await send(client, entry);
				const wants = allowed(principal, entry);
				if (wants) {
					if (result.status === 401 || result.status === 403 || result.status >= 500 && result.status !== 503) problems.push(`${entry.key}: should be allowed, got ${result.status} ${result.error?.code ?? ""}`);
				} else if (result.status !== 403 || !(result.error?.code === "forbidden" || (entry.superOnly && result.error?.code === "forbidden_super"))) {
					problems.push(`${entry.key}: should be 403 forbidden, got ${result.status} ${result.error?.code ?? ""}`);
				}
			}
			expect(problems).toEqual([]);
		});
	}

	it("nobody signed in: 401 on every route that is not public", async () => {
		const problems: string[] = [];
		for (const entry of EXPECTED) {
			if (entry.needs === "public") continue;
			const result = await send(anon, entry);
			if (result.status !== 401) problems.push(`${entry.key}: got ${result.status}`);
		}
		expect(problems).toEqual([]);
	});

	it("a session that must change its password: 403 password_change_required everywhere except /auth/me, /me/password and the pending routes", async () => {
		const problems: string[] = [];
		for (const entry of EXPECTED) {
			if (entry.needs === "public" || entry.key === "POST auth/logout") continue;
			const result = await send(forced, entry);
			if (entry.needs === "session-any" || entry.needs === "pending") {
				if (result.status === 401 || result.status === 403) problems.push(`${entry.key}: should be open, got ${result.status} ${result.error?.code ?? ""}`);
			} else if (result.status !== 403 || result.error?.code !== "password_change_required") {
				problems.push(`${entry.key}: should be 403 password_change_required, got ${result.status} ${result.error?.code ?? ""}`);
			}
		}
		expect(problems).toEqual([]);
	});
});

describe("the routes that ask for no permission", () => {
	it("public routes answer without a session (never 401 for want of one, never 403)", async () => {
		for (const entry of EXPECTED.filter((item) => item.needs === "public")) {
			const result = await send(anon, entry);
			// refresh answers 401 itself (no refresh cookie); the others reach their own validation
			if (entry.key === "POST auth/refresh") expect(result.status, entry.key).toBe(401);
			else expect([400, 200, 202, 204], entry.key + " " + result.status).toContain(result.status);
		}
	});

	it("pending routes need a session but no permission: any role passes", async () => {
		for (const principal of PRINCIPALS) {
			const client = await w.as(`${principal.id}@example.test`);
			const verify = await client.call("POST", "auth/2fa/verify", {});
			expect([400, 401, 409], `${principal.id} 2fa/verify ${verify.status}`).toContain(verify.status);
			expect(verify.error?.code, principal.id).not.toBe("forbidden");
			const out = await client.call("POST", "auth/logout", {});
			expect(out.status, `${principal.id} logout`).toBe(204);
		}
	});
});

describe("the custom role with limited rights", () => {
	it("is worth nothing where its 'own' cannot be honoured, and only own rows elsewhere", async () => {
		const client = clients.get("custom")!;
		// the pairs a handler really checks pass the gate (the row does not exist: 404, not 403) ...
		for (const key of ["PATCH posts/x-none", "DELETE posts/x-none", "PATCH media/x-none", "PATCH areas/x-none", "DELETE areas/x-none", "DELETE events/x-none", "GET trash", "POST trash/media/x-none/restore"]) {
			const [method, path] = key.split(" ");
			const result = await client.call(method, path, method === "GET" ? undefined : {});
			expect([401, 403], key).not.toContain(result.status);
		}
		// ... the rest does not, whatever was stored
		for (const key of ["GET users", "GET backup", "GET settings/general", "GET roles", "GET audit", "GET posts", "GET media", "PATCH categories/x-none", "POST quotes/reorder", "POST posts/x-none/publish", "PATCH media/folders/x-none"]) {
			const [method, path] = key.split(" ");
			const result = await client.call(method, path, method === "GET" ? undefined : {});
			expect(result.status, key).toBe(403);
		}
	});
});
