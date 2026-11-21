// Helpers for the admin end-to-end tests. They run against a server that has the admin switched on and a
// prepared LOCAL database (`npm run dev:db -- --init --seed`, then `npm run dev`):
//   BASE_URL=http://localhost:3001 npx playwright test tests/e2e/admin --project=desktop
// The first Super Admin comes from .dev.vars (git-ignored); the other accounts are made through the API by the tests.
import { readFileSync } from "node:fs";
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
		const context = await playwrightRequest.newContext({ baseURL });
		const api = new AdminApi(context, new URL(baseURL).origin);
		const login = await api.call("POST", "auth/login", { email, password });
		expect(login.status, `sign-in as ${email}`).toBe(200);
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

	async dispose() {
		await this.context.dispose();
	}
}

export async function superAdminApi(baseURL: string): Promise<AdminApi> {
	const vars = devVars();
	return AdminApi.signIn(baseURL, vars.ADMIN_SEED_EMAIL, vars.ADMIN_SEED_PASSWORD);
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
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Mật khẩu").fill(password);
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
