// Helpers for the admin end-to-end tests. They run against a server that has the admin switched on and a
// prepared LOCAL database (`npm run dev:db -- --init --seed`, then `npm run dev`):
//   BASE_URL=http://localhost:3001 npx playwright test tests/e2e/admin --project=desktop
// The first Super Admin comes from .dev.vars (git-ignored); the other accounts are made through the API by the tests.
//
// Without a Cloudflare login (a clean machine, CI): `npm run dev` asks for one because vite.config.ts uses remote bindings. The same
// server without them, which is all the admin needs (the local D1 and R2 are simulated by miniflare):
//   TLHP_ADMIN=1 TLHP_CONTENT_SOURCE=d1 ADMIN_BASE_URL=http://localhost:3021 npx vite dev --config vite.e2e.config.ts --port 3021
//   BASE_URL=http://localhost:3021 npx playwright test tests/e2e/admin --project=desktop --workers=1
// (ADMIN_BASE_URL in .dev.vars must be the same address: the admin answers only there.)
//
// The seeded Super Admin must change its password at its first sign-in (ADMIN_SEED_PASSWORD is a one-time password), so `superAdminApi`
// changes it once through the API, to ADMIN_E2E_PASSWORD from .dev.vars (PASSWORD below when there is none), and signs in with that
// from then on. Nothing is written to a file.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, type APIRequestContext, type Page, request as playwrightRequest } from "@playwright/test";

export const API = "/api/quan-tri/v1";

export function devVars(): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
		const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (match) out[match[1]] = match[2];
	}
	return out;
}

export const PASSWORD = "Mat-khau-e2e-2026-xyz";

/** A signed-in API client with its own cookies; writes carry the CSRF token and Origin like the pages do. */
export class AdminApi {
	private csrf = "";
	private constructor(
		readonly context: APIRequestContext,
		private readonly origin: string,
	) {}

	static async signIn(baseURL: string, email: string, password: string): Promise<AdminApi> {
		const api = await AdminApi.trySignIn(baseURL, email, password);
		expect(api, `sign-in as ${email}`).not.toBeNull();
		return api!;
	}

	/** The signed-in client, or null when the sign-in is refused (a wrong password: the caller tries another). */
	static async trySignIn(baseURL: string, email: string, password: string): Promise<AdminApi | null> {
		const context = await playwrightRequest.newContext({ baseURL });
		const api = new AdminApi(context, new URL(baseURL).origin);
		const login = await api.call("POST", "auth/login", { email, password });
		if (login.status !== 200) {
			await context.dispose();
			return null;
		}
		const me = await api.call("GET", "auth/me");
		api.csrf = (me.json as { data: { csrfToken: string } }).data.csrfToken;
		return api;
	}

	async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
		const headers: Record<string, string> = { Origin: this.origin };
		if (this.csrf && method !== "GET") headers["X-TLHP-CSRF"] = this.csrf;
		const response = await this.context.fetch(`${API}/${path}`, { method, headers, data: body, failOnStatusCode: false });
		const text = await response.text();
		return { status: response.status(), json: text ? JSON.parse(text) : null };
	}

	/** A multipart request (a picture replaced or cut): the pictures' write routes read nothing else. */
	async multipart(method: string, path: string, parts: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>): Promise<{ status: number; json: unknown }> {
		const response = await this.context.fetch(`${API}/${path}`, { method, headers: { Origin: this.origin, "X-TLHP-CSRF": this.csrf }, multipart: parts, failOnStatusCode: false });
		const text = await response.text();
		return { status: response.status(), json: text ? JSON.parse(text) : null };
	}

	/** Uploads a tiny valid PNG (made unique by `stamp`) as this person and returns the library id it got. */
	async upload(name: string, stamp = `${Date.now()}-${Math.random()}`): Promise<string> {
		const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
		const response = await this.context.fetch(`${API}/media`, {
			method: "POST",
			headers: { Origin: this.origin, "X-TLHP-CSRF": this.csrf },
			multipart: { file: { name, mimeType: "image/png", buffer: Buffer.concat([png, Buffer.from(stamp + name)]) }, alt: name },
			failOnStatusCode: false,
		});
		const body = (await response.json()) as { data?: { id: string }; error?: { message: string } };
		expect(response.status(), `upload ${name}: ${body.error?.message ?? ""}`).toBeLessThan(300);
		return body.data!.id;
	}

	async dispose() {
		await this.context.dispose();
	}
}

/** How the seeded Super Admin signs in on the page, once `superAdminApi` has changed its one-time password (call that first). */
export function superAdminLogin(): { email: string; password: string } {
	const vars = devVars();
	return { email: vars.ADMIN_SEED_EMAIL, password: vars.ADMIN_E2E_PASSWORD || PASSWORD };
}

export async function superAdminApi(baseURL: string): Promise<AdminApi> {
	const vars = devVars();
	const e2ePassword = vars.ADMIN_E2E_PASSWORD || PASSWORD;
	// Changed on an earlier run: the e2e password signs in.
	const known = await AdminApi.trySignIn(baseURL, vars.ADMIN_SEED_EMAIL, e2ePassword);
	if (known) return known;
	// A fresh seed: sign in with the one-time password and change it (the one call such a session may make besides /auth/me).
	const first = await AdminApi.signIn(baseURL, vars.ADMIN_SEED_EMAIL, vars.ADMIN_SEED_PASSWORD);
	const changed = await first.call("POST", "me/password", { current: vars.ADMIN_SEED_PASSWORD, next: e2ePassword });
	expect(changed.status, "first password change of the seeded Super Admin").toBe(204);
	await first.dispose();
	return AdminApi.signIn(baseURL, vars.ADMIN_SEED_EMAIL, e2ePassword);
}

/** Makes an account with the given role through the API and clears its "change the password" flag by changing it once. */
export async function makeAccount(admin: AdminApi, baseURL: string, roleId: string, label: string): Promise<{ email: string; password: string; id: string }> {
	const email = `e2e-${label}-${Date.now().toString(36)}@localhost.test`;
	const created = await admin.call("POST", "users", { email, name: `E2E ${label}`, roleId });
	expect(created.status, `create ${label}`).toBe(200);
	const data = (created.json as { data: { user: { id: string }; temporaryPassword: string } }).data;
	const fresh = await AdminApi.signIn(baseURL, email, data.temporaryPassword);
	const changed = await fresh.call("POST", "me/password", { current: data.temporaryPassword, next: PASSWORD });
	expect(changed.status, `first password change of ${label}`).toBe(204);
	await fresh.dispose();
	return { email, password: PASSWORD, id: data.user.id };
}

export async function signInOnPage(page: Page, email: string, password: string) {
	await page.goto("/quan-tri/dang-nhap");
	// Typed before React has taken the form over, the fields are emptied again when it does (a slow dev server).
	await page.waitForFunction(() => (window as unknown as { __tqReady?: boolean }).__tqReady === true);
	// A slow dev server can still re-render the form after the flag is up and empty a field: fill again until both values stay.
	await expect(async () => {
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Mật khẩu").fill(password);
		await expect(page.getByLabel("Email")).toHaveValue(email, { timeout: 500 });
		await expect(page.getByLabel("Mật khẩu")).toHaveValue(password, { timeout: 500 });
	}).toPass({ timeout: 15_000 });
	await page.getByRole("button", { name: "Đăng nhập" }).click();
	await page.waitForURL((url) => url.pathname === "/quan-tri");
}

/** A small valid PNG of the given colour and size, made without any library. */
export async function pngBuffer(page: Page, width: number, height: number, color: string): Promise<Buffer> {
	const base64 = await page.evaluate(
		async ({ width, height, color }) => {
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext("2d")!;
			context.fillStyle = color;
			context.fillRect(0, 0, width, height);
			return canvas.toDataURL("image/png").split(",")[1];
		},
		{ width, height, color },
	);
	return Buffer.from(base64, "base64");
}

/**
 * The LOCAL development database of this checkout, opened for the few things the API cannot make (a slug longer than the editor's own
 * limit, as the old site's imported articles have; an area, which only an import creates). The dev server holds it open in WAL mode, so a
 * short busy timeout is enough. Never a real database: the file is under .cloudflare/state.
 */
export function localDb(): DatabaseSync {
	const dir = ".cloudflare/state/v3/d1/miniflare-D1DatabaseObject";
	const file = readdirSync(dir).find((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
	if (!file) throw new Error(`no local D1 file in ${dir}: run \`npm run dev:db -- --init --seed\` first`);
	const db = new DatabaseSync(`${dir}/${file}`);
	db.exec("PRAGMA busy_timeout = 10000");
	return db;
}

export const unwrap = <T>(response: { json: unknown }): T => (response.json as { data: T }).data;
