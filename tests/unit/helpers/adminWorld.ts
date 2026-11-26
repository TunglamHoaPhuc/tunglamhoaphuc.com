// A small admin "world" for HTTP-level tests: a database with the system roles, some accounts, and a
// client per account that keeps its own cookies and CSRF token.
import "../../../src/admin/routes";
import { dispatch, type Deps } from "../../../src/admin/http/api";
import { hashPassword } from "../../../src/admin/auth/password";
import type { MailMessage } from "../../../src/admin/mail/send";
import { seedRoles } from "../../../src/admin/seed";
import type { MediaStore } from "../../../src/admin/media/store";
import { memoryAdminDb } from "./adminDb";

export const BASE = "https://www.example.test";
export const PASSWORD = "Mot-mat-khau-dai-123";
export const FAST = { m: 64, t: 1, p: 1 };

export type Seed = { id: string; email: string; roleId: string; name?: string };

export async function world(seeds: Seed[]) {
	const { db, raw } = memoryAdminDb();
	await seedRoles(db, new Date());
	for (const seed of seeds) {
		raw
			.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at) VALUES (?, ?, ?, 'viewer', ?, ?, '2026')")
			.run(seed.id, seed.email, seed.name ?? seed.id, seed.roleId, hashPassword(PASSWORD, FAST));
	}
	const mails: MailMessage[] = [];
	const deferred: Promise<unknown>[] = [];
	/** The library's files: key -> { type, bytes }. */
	const files = new Map<string, { type: string; bytes: Uint8Array }>();
	const media: MediaStore = {
		put: async (key, bytes, type) => void files.set(key, { type, bytes }),
		delete: async (keys) => void keys.forEach((key) => files.delete(key)),
	};
	const deps: Deps = {
		env: { DB: db, ADMIN_JWT_SECRET: "j".repeat(40), ADMIN_ENC_KEY: Buffer.alloc(32, 3).toString("base64"), ADMIN_BASE_URL: BASE },
		mailer: async (message) => void mails.push(message),
		defer: (work) => void deferred.push(work),
		passwordParams: FAST,
		media,
	};

	function client() {
		const jar = new Map<string, string>();
		let csrf = "";
		async function call(method: string, path: string, body?: unknown) {
			const headers: Record<string, string> = {};
			if (method !== "GET") headers.origin = BASE;
			if (body !== undefined) headers["content-type"] = "application/json";
			if (jar.size) headers.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
			if (csrf && method !== "GET") headers["x-tlhp-csrf"] = csrf;
			const response = await dispatch(new Request(`${BASE}/api/quan-tri/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), path.split("?")[0], deps);
			for (const line of response.headers.getSetCookie()) {
				const [pair, ...attrs] = line.split("; ");
				const index = pair.indexOf("=");
				if (attrs.includes("Max-Age=0")) jar.delete(pair.slice(0, index));
				else jar.set(pair.slice(0, index), pair.slice(index + 1));
			}
			const text = await response.text();
			const json = text ? JSON.parse(text) : null;
			if (json?.data?.csrfToken) csrf = json.data.csrfToken;
			return { status: response.status, json, data: json?.data, error: json?.error };
		}
		return {
		/** A multipart request (uploads): `fields` are text, `file` is the one file. */
		async form(method: string, path: string, file: { bytes: Uint8Array; name: string } | null, fields: Record<string, string> = {}, extra: Record<string, { bytes: Uint8Array; name: string }> = {}) {
			const body = new FormData();
			for (const [name, value] of Object.entries(fields)) body.set(name, value);
			if (file) body.set("file", new Blob([file.bytes as BlobPart]), file.name);
			for (const [name, part] of Object.entries(extra)) body.set(name, new Blob([part.bytes as BlobPart]), part.name);
			const headers: Record<string, string> = { origin: BASE };
			if (jar.size) headers.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
			if (csrf) headers["x-tlhp-csrf"] = csrf;
			const response = await dispatch(new Request(`${BASE}/api/quan-tri/v1/${path}`, { method, headers, body }), path.split("?")[0], deps);
			const text = await response.text();
			const json = text ? JSON.parse(text) : null;
			return { status: response.status, json, data: json?.data, error: json?.error };
		},
		call, jar, signIn: (email: string, password = PASSWORD) => call("POST", "auth/login", { email, password }) };
	}

	async function as(email: string) {
		const c = client();
		const result = await c.signIn(email);
		if (result.status !== 200) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(result.json)}`);
		return c;
	}

	return { db, raw, deps, mails, deferred, client, as, files };
}
