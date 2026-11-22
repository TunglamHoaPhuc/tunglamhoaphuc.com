import { beforeAll, describe, expect, it } from "vitest";
import "../../../src/admin/routes";
import { dispatch, registerRoutes, type Deps } from "../../../src/admin/http/api";
import { hashPassword } from "../../../src/admin/auth/password";
import { totpCode, stepAt } from "../../../src/admin/auth/totp";
import type { MailMessage } from "../../../src/admin/mail/send";
import { seedRoles } from "../../../src/admin/seed";
import { memoryAdminDb } from "../helpers/adminDb";

const BASE = "https://www.example.test";
const PASSWORD = "Mot-mat-khau-dai-123";
const FAST = { m: 64, t: 1, p: 1 };

// Routes only the tests use, to exercise the permission check.
beforeAll(() => {
	registerRoutes(
		{ method: "GET", path: "test/users", needs: { module: "users", action: "view" }, handler: async () => ({ ok: true }) },
		{ method: "POST", path: "test/posts", needs: { module: "posts", action: "create" }, handler: async () => ({ ok: true }) },
		{ method: "POST", path: "test/posts/publish", needs: { module: "posts", action: "publish" }, handler: async () => ({ ok: true }) },
	);
});

async function world(role = "role-editor") {
	const { db, raw } = memoryAdminDb();
	await seedRoles(db, new Date());
	raw.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at) VALUES ('u1', 'a@example.test', 'A', 'editor', ?, ?, '2026')").run(role, hashPassword(PASSWORD, FAST));
	const mails: MailMessage[] = [];
	const deferred: Promise<unknown>[] = [];
	const deps: Deps = {
		env: { DB: db, ADMIN_JWT_SECRET: "j".repeat(40), ADMIN_ENC_KEY: Buffer.alloc(32, 3).toString("base64"), ADMIN_BASE_URL: BASE },
		mailer: async (message) => void mails.push(message),
		defer: (work) => void deferred.push(work),
		passwordParams: FAST,
	};
	const jar = new Map<string, string>();
	let csrf = "";
	async function call(method: string, path: string, body?: unknown, extra: { headers?: Record<string, string>; host?: string; noOrigin?: boolean; noCsrf?: boolean; raw?: string } = {}) {
		const headers: Record<string, string> = { ...extra.headers };
		if (!extra.noOrigin && method !== "GET") headers.origin = BASE;
		if (body !== undefined || extra.raw !== undefined) headers["content-type"] ??= "application/json";
		if (jar.size) headers.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
		if (csrf && !extra.noCsrf && method !== "GET") headers["x-tlhp-csrf"] = csrf;
		const response = await dispatch(new Request(`${extra.host ?? BASE}/api/quan-tri/v1/${path}`, { method, headers, body: extra.raw ?? (body === undefined ? undefined : JSON.stringify(body)) }), path, deps);
		for (const line of response.headers.getSetCookie()) {
			const [pair, ...attrs] = line.split("; ");
			const [name, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
			if (attrs.includes("Max-Age=0")) jar.delete(name);
			else jar.set(name, value);
		}
		const text = await response.text();
		const json = text ? JSON.parse(text) : null;
		if (json?.data?.csrfToken) csrf = json.data.csrfToken;
		return { status: response.status, json, headers: response.headers, line: response.headers.getSetCookie() };
	}
	const signIn = () => call("POST", "auth/login", { email: "a@example.test", password: PASSWORD });
	return { call, signIn, jar, mails, deferred, raw, deps, setCsrf: (value: string) => void (csrf = value) };
}

describe("every response", () => {
	it("is not cached and not indexed, and the admin does not exist on another address", async () => {
		const w = await world();
		const ok = await w.call("GET", "auth/me");
		expect(ok.headers.get("cache-control")).toBe("no-store");
		expect(ok.headers.get("x-robots-tag")).toBe("noindex");
		const other = await w.call("POST", "auth/login", { email: "a@example.test", password: PASSWORD }, { host: "https://v2.example.test" });
		expect(other.status).toBe(404);
		expect(w.jar.size).toBe(0);
	});

	it("answers 404 for an unknown path and 405 for a wrong method", async () => {
		const w = await world();
		expect((await w.call("GET", "nope")).status).toBe(404);
		expect((await w.call("GET", "auth/login")).status).toBe(405);
	});
});

describe("signing in over HTTP", () => {
	it("sets host-only HttpOnly cookies and returns a CSRF token, never the tokens in the body", async () => {
		const w = await world();
		const response = await w.signIn();
		expect(response.status).toBe(200);
		expect(response.json.data.status).toBe("ok");
		expect(JSON.stringify(response.json)).not.toMatch(/eyJ/);
		const at = response.line.find((line) => line.startsWith("__Host-tlhp_at="))!;
		const rt = response.line.find((line) => line.startsWith("__Host-tlhp_rt="))!;
		for (const cookie of [at, rt]) {
			expect(cookie).toContain("HttpOnly");
			expect(cookie).toContain("Secure");
			expect(cookie).toContain("Path=/");
			expect(cookie).not.toContain("Domain");
		}
		expect(rt).toContain("SameSite=Strict");
		expect(at).toContain("SameSite=Lax");
	});

	it("rejects wrong credentials with 401 and one message, bad JSON with 400, and a non-JSON body with 415", async () => {
		const w = await world();
		expect((await w.call("POST", "auth/login", { email: "a@example.test", password: "sai-mat-khau-1" })).status).toBe(401);
		expect((await w.call("POST", "auth/login", { email: "a@example.test" })).json.error.fields.password).toBeTruthy();
		expect((await w.call("POST", "auth/login", undefined, { raw: "{nope" })).status).toBe(400);
		expect((await w.call("POST", "auth/login", { email: "a@example.test", password: PASSWORD }, { headers: { "content-type": "text/plain" } })).status).toBe(415);
	});

	it("refuses a write from another origin or with none", async () => {
		const w = await world();
		expect((await w.call("POST", "auth/login", { email: "a@example.test", password: PASSWORD }, { noOrigin: true })).status).toBe(403);
		expect((await w.call("POST", "auth/login", { email: "a@example.test", password: PASSWORD }, { headers: { origin: "https://evil.example" }, noOrigin: true })).status).toBe(403);
	});

	it("serves /auth/me to a signed-in person, with permissions and the CSRF token", async () => {
		const w = await world();
		await w.signIn();
		const me = await w.call("GET", "auth/me");
		expect(me.status).toBe(200);
		expect(me.json.data.user.email).toBe("a@example.test");
		expect(me.json.data.permissions).toContain("posts.publish");
		expect(me.json.data.permissions).not.toContain("users.view");
		expect(me.json.data.csrfToken).toBeTruthy();
	});

	it("says 401 without a session", async () => {
		const w = await world();
		expect((await w.call("GET", "auth/me")).status).toBe(401);
	});
});

describe("403 and CSRF", () => {
	it("answers 403 to a role without the permission, and 200 to one with it", async () => {
		const editor = await world("role-editor");
		await editor.signIn();
		expect((await editor.call("GET", "test/users")).status).toBe(403);
		expect((await editor.call("POST", "test/posts/publish", {})).status).toBe(200);
		const author = await world("role-author");
		await author.signIn();
		expect((await author.call("POST", "test/posts", {})).status).toBe(200);
		const denied = await author.call("POST", "test/posts/publish", {});
		expect(denied.status).toBe(403);
		expect(denied.json.error.code).toBe("forbidden");
		const admin = await world("role-admin");
		await admin.signIn();
		expect((await admin.call("GET", "test/users")).status).toBe(200);
	});

	it("refuses a write without the CSRF token or with a wrong one", async () => {
		const w = await world();
		await w.signIn();
		expect((await w.call("POST", "test/posts", {}, { noCsrf: true })).json.error.code).toBe("bad_csrf");
		w.setCsrf("sai");
		expect((await w.call("POST", "test/posts", {})).json.error.code).toBe("bad_csrf");
	});
});

describe("2FA and the password-change gate over HTTP", () => {
	it("keeps a pending session out of everything but the code step and sign-out", async () => {
		const w = await world();
		await w.signIn();
		const setup = await w.call("POST", "me/2fa/setup", {});
		const secret = setup.json.data.secret as string;
		const enabled = await w.call("POST", "me/2fa/enable", { code: await totpCode(secret, stepAt(Date.now())) });
		expect(enabled.json.data.recoveryCodes).toHaveLength(10);
		await w.call("POST", "auth/logout", {});

		const login = await w.signIn();
		expect(login.json.data.status).toBe("mfa_required");
		expect(login.line.some((line) => line.startsWith("__Host-tlhp_rt=") && !line.includes("Max-Age=0"))).toBe(false);
		const blocked = await w.call("GET", "auth/me");
		expect(blocked.status).toBe(401);
		expect(blocked.json.error.code).toBe("mfa_required");
		expect((await w.call("GET", "test/users")).json.error.code).toBe("mfa_required");

		expect((await w.call("POST", "auth/2fa/verify", { code: "000000" })).status).toBe(401);
		const code = enabled.json.data.recoveryCodes[0] as string;
		const verified = await w.call("POST", "auth/2fa/verify", { code });
		expect(verified.json.data.status).toBe("ok");
		expect((await w.call("GET", "auth/me")).status).toBe(200);
	});

	it("lets a person who must change the password reach only /auth/me and the change", async () => {
		const w = await world("role-admin");
		w.raw.prepare("UPDATE user SET must_change_password = 1").run();
		const login = await w.signIn();
		expect(login.json.data.mustChangePassword).toBe(true);
		expect((await w.call("GET", "test/users")).json.error.code).toBe("password_change_required");
		expect((await w.call("GET", "auth/me")).status).toBe(200);
		expect((await w.call("POST", "me/password", { current: PASSWORD, next: "Mat-khau-moi-456" })).status).toBe(204);
		expect((await w.call("GET", "test/users")).status).toBe(200);
	});
});

describe("refresh and sessions over HTTP", () => {
	it("gets a new access token from the refresh cookie after the access cookie is gone", async () => {
		const w = await world();
		await w.signIn();
		w.jar.delete("__Host-tlhp_at");
		expect((await w.call("GET", "auth/me")).status).toBe(401);
		const refreshed = await w.call("POST", "auth/refresh", {});
		expect(refreshed.status).toBe(200);
		expect((await w.call("GET", "auth/me")).status).toBe(200);
	});

	it("clears the cookies when the refresh token is no good", async () => {
		const w = await world();
		w.jar.set("__Host-tlhp_rt", "khong-hop-le");
		const response = await w.call("POST", "auth/refresh", {});
		expect(response.status).toBe(401);
		expect(w.jar.size).toBe(0);
	});

	it("lists sessions, ends one by id, and signing out ends this one", async () => {
		const w = await world();
		await w.signIn();
		const list = await w.call("GET", "me/sessions");
		expect(list.json.data.sessions).toHaveLength(1);
		expect(list.json.data.sessions[0].current).toBe(true);
		expect((await w.call("DELETE", "me/sessions/khong-co")).status).toBe(404);
		await w.call("POST", "auth/logout", {});
		expect((await w.call("GET", "auth/me")).status).toBe(401);
	});
});

describe("forgetting the password over HTTP", () => {
	it("answers the same for a known and an unknown email, mails after the answer, and the link works once", async () => {
		const w = await world();
		const known = await w.call("POST", "auth/forgot-password", { email: "a@example.test" });
		const unknown = await w.call("POST", "auth/forgot-password", { email: "khong-co@example.test" });
		expect(known.status).toBe(200);
		expect(known.json).toEqual(unknown.json);
		expect(w.mails).toHaveLength(0); // the lookup and the mail wait until the answer is out
		await Promise.all(w.deferred);
		expect(w.mails).toHaveLength(1);
		const token = /token=([\w-]+)/.exec(w.mails[0].text)![1];
		expect((await w.call("POST", "auth/reset-password", { token, password: "ngan" })).json.error.code).toBe("weak_password");
		expect((await w.call("POST", "auth/reset-password", { token, password: "Mat-khau-moi-456" })).status).toBe(200);
		expect((await w.call("POST", "auth/reset-password", { token, password: "Mat-khau-khac-789" })).json.error.code).toBe("invalid_token");
		expect((await w.call("POST", "auth/login", { email: "a@example.test", password: "Mat-khau-moi-456" })).status).toBe(200);
	});

	it("still answers 200 when sending the mail fails", async () => {
		const w = await world();
		w.deps.mailer = async () => {
			throw new Error("SMTP down");
		};
		expect((await w.call("POST", "auth/forgot-password", { email: "a@example.test" })).status).toBe(200);
		await Promise.allSettled(w.deferred);
	});
});
