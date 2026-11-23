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

import { allowed, CUSTOM_GRANTS, EXPECTED, expand, PRINCIPALS, type Entry } from "../helpers/permissionTable";

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
