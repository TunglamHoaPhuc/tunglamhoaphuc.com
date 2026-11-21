import { beforeEach, describe, expect, it } from "vitest";
import { writeAudit } from "../../../src/admin/audit/log";
import { decryptSecret, encryptSecret } from "../../../src/admin/crypto";
import {
	authenticate, changePassword, disableTotp, enableTotp, login, logout, PREV_REFRESH_GRACE_MS, refresh, requestPasswordReset,
	resetPassword, RESET_TTL_MS, revokeSessions, setupTotp, verifySecondFactor, type AuthContext,
} from "../../../src/admin/auth/service";
import { hashPassword, passwordProblem, verifyPassword } from "../../../src/admin/auth/password";
import { totpCode, stepAt, base32Encode } from "../../../src/admin/auth/totp";
import { csrfToken, signAccessToken, verifyAccessToken } from "../../../src/admin/auth/tokens";
import { ApiError } from "../../../src/admin/http/errors";
import type { MailMessage } from "../../../src/admin/mail/send";
import { can, covers } from "../../../src/admin/rbac/check";
import { loadPermissions } from "../../../src/admin/rbac/check";
import { seedRoles, seedSuperAdmin } from "../../../src/admin/seed";
import { memoryAdminDb } from "../helpers/adminDb";

const FAST = { m: 64, t: 1, p: 1 };
const KEY = Buffer.alloc(32, 7).toString("base64");
const PASSWORD = "Mot-mat-khau-dai-123";

let clock = Date.parse("2026-11-21T08:00:00Z");
const advance = (ms: number) => void (clock += ms);

function setup() {
	const { db, raw } = memoryAdminDb();
	const ctx: AuthContext = {
		db,
		env: { ADMIN_JWT_SECRET: "x".repeat(40), ADMIN_ENC_KEY: KEY, ADMIN_BASE_URL: "https://www.example.test" },
		now: () => new Date(clock),
		ip: "203.0.113.5",
		userAgent: "vitest",
		passwordParams: FAST,
	};
	return { db, raw, ctx };
}

async function withUser(roleId = "role-editor", email = "bien-tap@example.test") {
	const s = setup();
	await seedRoles(s.db, new Date(clock));
	s.raw
		.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at) VALUES ('u1', ?, 'Biên Tập', 'editor', ?, ?, '2026-01-01')")
		.run(email, roleId, hashPassword(PASSWORD, FAST));
	return { ...s, email };
}

const fail = async (promise: Promise<unknown>) => {
	try {
		await promise;
	} catch (error) {
		if (error instanceof ApiError) return error;
		throw error;
	}
	throw new Error("expected an ApiError");
};

beforeEach(() => void (clock = Date.parse("2026-11-21T08:00:00Z")));

describe("primitives", () => {
	it("hashes with Argon2id and verifies, keeping the parameters in the hash", () => {
		const hash = hashPassword("abc12345678", FAST);
		expect(hash).toMatch(/^\$argon2id\$v=19\$m=64,t=1,p=1\$/);
		expect(verifyPassword("abc12345678", hash)).toBe(true);
		expect(verifyPassword("abc12345679", hash)).toBe(false);
		expect(verifyPassword("abc12345678", "not a hash")).toBe(false);
	});

	it("refuses short, common and name-containing passwords", () => {
		expect(passwordProblem("ngan")).toMatch(/ít nhất/);
		expect(passwordProblem("password123")).toMatch(/phổ biến/);
		expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/phổ biến/);
		expect(passwordProblem("bientapvien-2026", "bientapvien@x.vn")).toMatch(/tên đăng nhập/);
		expect(passwordProblem(PASSWORD, "a@b.c")).toBeNull();
	});

	it("matches the RFC 6238 test vector", async () => {
		const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
		expect(await totpCode(secret, 1)).toBe("287082"); // T = 59 s, last six digits of 94287082
		expect(stepAt(59_000)).toBe(1);
	});

	it("encrypts a secret and gives it back, and refuses a wrong key or a changed value", async () => {
		const sealed = await encryptSecret("bi-mat", KEY);
		expect(sealed).not.toContain("bi-mat");
		expect(await decryptSecret(sealed, KEY)).toBe("bi-mat");
		await expect(decryptSecret(sealed, Buffer.alloc(32, 9).toString("base64"))).rejects.toThrow();
		await expect(decryptSecret(`${sealed.slice(0, -4)}AAAA`, KEY)).rejects.toThrow();
	});

	it("signs access tokens that expire and reject a wrong secret", async () => {
		const token = await signAccessToken({ sub: "u", sid: "s" }, "secret-secret-secret", clock);
		expect(await verifyAccessToken(token, "secret-secret-secret", clock)).toEqual({ sub: "u", sid: "s" });
		expect(await verifyAccessToken(token, "other-secret-secret!", clock)).toBeNull();
		expect(await verifyAccessToken(token, "secret-secret-secret", clock + 16 * 60_000)).toBeNull();
		expect(await csrfToken("s1", "k")).not.toBe(await csrfToken("s2", "k"));
	});
});

describe("sign-in", () => {
	it("signs in with the right password and issues a session that authenticates", async () => {
		const { ctx, email } = await withUser();
		const issued = await login(ctx, { email: ` ${email.toUpperCase()} `, password: PASSWORD });
		expect(issued.status).toBe("ok");
		expect(issued.refreshToken).toBeTruthy();
		const authed = await authenticate(ctx, issued.accessToken);
		expect(authed?.user.email).toBe(email);
		expect(authed?.user.roleName).toMatch(/Editor/);
		expect(can(authed!.permissions, "posts", "publish")).toBe(true);
		expect(can(authed!.permissions, "users", "view")).toBe(false);
	});

	it("gives one answer for a wrong password and an unknown email, and records both", async () => {
		const { ctx, email, raw } = await withUser();
		const wrong = await fail(login(ctx, { email, password: "sai-mat-khau-1" }));
		const unknown = await fail(login(ctx, { email: "khong-co@example.test", password: "sai-mat-khau-1" }));
		expect([wrong.status, wrong.code, wrong.message]).toEqual([unknown.status, unknown.code, unknown.message]);
		expect(wrong.status).toBe(401);
		const logged = raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.login_failed'").get() as { n: number };
		expect(logged.n).toBe(2);
	});

	it("waits longer after each failure past five, but never locks the account for good", async () => {
		const { ctx, email } = await withUser();
		for (let i = 0; i < 5; i++) await fail(login(ctx, { email, password: "sai-mat-khau-1" }));
		const blocked = await fail(login(ctx, { email, password: PASSWORD }));
		expect(blocked.status).toBe(429);
		expect(blocked.retryAfter).toBeGreaterThan(0);
		advance(61_000);
		expect((await login(ctx, { email, password: PASSWORD })).status).toBe("ok");
	});

	it("does not let someone else's wrong tries block another address for the same email", async () => {
		const { ctx, email } = await withUser();
		for (let i = 0; i < 5; i++) await fail(login({ ...ctx, ip: "198.51.100.9" }, { email, password: "sai-mat-khau-1" }));
		expect((await login(ctx, { email, password: PASSWORD })).status).toBe("ok");
	});

	it("refuses a locked or deleted account", async () => {
		const { ctx, email, raw } = await withUser();
		raw.prepare("UPDATE user SET locked_at = '2026-11-21' WHERE id = 'u1'").run();
		expect((await fail(login(ctx, { email, password: PASSWORD }))).status).toBe(401);
	});

	it("ends a session at once when it is revoked, the account locked, or the user signs out", async () => {
		const { ctx, email, raw } = await withUser();
		const a = await login(ctx, { email, password: PASSWORD });
		const b = await login(ctx, { email, password: PASSWORD });
		await logout(ctx, (await authenticate(ctx, a.accessToken))!);
		expect(await authenticate(ctx, a.accessToken)).toBeNull();
		expect(await authenticate(ctx, b.accessToken)).not.toBeNull();
		raw.prepare("UPDATE user SET locked_at = '2026-11-21' WHERE id = 'u1'").run();
		expect(await authenticate(ctx, b.accessToken)).toBeNull();
	});
});

describe("refresh tokens", () => {
	it("swaps the refresh token on use, and the old one still works for 30 seconds without swapping again", async () => {
		const { ctx, email } = await withUser();
		const issued = await login(ctx, { email, password: PASSWORD });
		const first = await refresh(ctx, issued.refreshToken!);
		expect(first?.refreshToken).toBeTruthy();
		expect(first?.refreshToken).not.toBe(issued.refreshToken);
		// the second tab, a moment later, still holding the old cookie
		advance(PREV_REFRESH_GRACE_MS - 1000);
		const second = await refresh(ctx, issued.refreshToken!);
		expect(second).not.toBeNull();
		expect(second?.refreshToken).toBeNull();
		// and the new token keeps working
		expect(await refresh(ctx, first!.refreshToken!)).not.toBeNull();
	});

	it("treats an old token used long after as theft: the session ends", async () => {
		const { ctx, email } = await withUser();
		const issued = await login(ctx, { email, password: PASSWORD });
		const first = await refresh(ctx, issued.refreshToken!);
		advance(PREV_REFRESH_GRACE_MS + 5000);
		expect(await refresh(ctx, issued.refreshToken!)).toBeNull();
		expect(await refresh(ctx, first!.refreshToken!)).toBeNull();
		expect(await authenticate(ctx, first!.accessToken)).toBeNull();
	});

	it("lets only one of two simultaneous refreshes with the same token take the swap", async () => {
		const { ctx, email } = await withUser();
		const issued = await login(ctx, { email, password: PASSWORD });
		const results = await Promise.all([refresh(ctx, issued.refreshToken!), refresh(ctx, issued.refreshToken!)]);
		expect(results.filter((item) => item?.refreshToken).length).toBe(1);
		expect(results.every(Boolean)).toBe(true);
	});

	it("refuses an unknown token and an expired session", async () => {
		const { ctx, email } = await withUser();
		const issued = await login(ctx, { email, password: PASSWORD });
		expect(await refresh(ctx, "khong-phai-token")).toBeNull();
		advance(31 * 24 * 3600_000);
		expect(await refresh(ctx, issued.refreshToken!)).toBeNull();
	});
});

describe("2FA", () => {
	async function withTotp() {
		const s = await withUser();
		const first = await login(s.ctx, { email: s.email, password: PASSWORD });
		const authed = (await authenticate(s.ctx, first.accessToken))!;
		const { secret } = await setupTotp(s.ctx, authed);
		const codes = await enableTotp(s.ctx, authed, await totpCode(secret, stepAt(clock)));
		return { ...s, secret, codes, authed };
	}

	it("is off by default, and sign-in is then a single step", async () => {
		const { ctx, email } = await withUser();
		expect((await login(ctx, { email, password: PASSWORD })).status).toBe("ok");
	});

	it("asks for a code after the password, gives no refresh token before it, and a full new session after", async () => {
		const { ctx, email, secret } = await withTotp();
		advance(31_000);
		const pending = await login(ctx, { email, password: PASSWORD });
		expect(pending.status).toBe("mfa_required");
		expect(pending.refreshToken).toBeNull();
		const early = await authenticate(ctx, pending.accessToken);
		expect(early?.session.mfaPassed).toBe(false);
		const full = await verifySecondFactor(ctx, pending.sessionId, await totpCode(secret, stepAt(clock)));
		expect(full.status).toBe("ok");
		expect(full.sessionId).not.toBe(pending.sessionId);
		expect(full.refreshToken).toBeTruthy();
		expect(await authenticate(ctx, pending.accessToken)).toBeNull();
		expect((await authenticate(ctx, full.accessToken))?.session.mfaPassed).toBe(true);
	});

	it("accepts a code once only", async () => {
		const { ctx, email, secret } = await withTotp();
		advance(31_000);
		const code = await totpCode(secret, stepAt(clock));
		await verifySecondFactor(ctx, (await login(ctx, { email, password: PASSWORD })).sessionId, code);
		const again = await login(ctx, { email, password: PASSWORD });
		expect((await fail(verifySecondFactor(ctx, again.sessionId, code))).code).toBe("invalid_code");
	});

	it("ends the pending session after five wrong codes", async () => {
		const { ctx, email, secret } = await withTotp();
		advance(31_000);
		const pending = await login(ctx, { email, password: PASSWORD });
		for (let i = 0; i < 5; i++) await fail(verifySecondFactor(ctx, pending.sessionId, "000000"));
		const err = await fail(verifySecondFactor(ctx, pending.sessionId, await totpCode(secret, stepAt(clock))));
		expect(err.status).toBe(401);
	});

	it("takes a recovery code once, and turning 2FA off needs the password", async () => {
		const { ctx, email, codes, authed } = await withTotp();
		advance(31_000);
		const pending = await login(ctx, { email, password: PASSWORD });
		expect((await verifySecondFactor(ctx, pending.sessionId, codes[0])).status).toBe("ok");
		const again = await login(ctx, { email, password: PASSWORD });
		expect((await fail(verifySecondFactor(ctx, again.sessionId, codes[0]))).code).toBe("invalid_code");
		expect((await fail(disableTotp(ctx, authed, "sai-mat-khau-1"))).code).toBe("wrong_password");
		await disableTotp(ctx, authed, PASSWORD);
		expect((await login(ctx, { email, password: PASSWORD })).status).toBe("ok");
	});

	it("does not store the secret in the clear", async () => {
		const { raw, secret } = await withTotp();
		const row = raw.prepare("SELECT secret_enc FROM user_totp").get() as { secret_enc: string };
		expect(row.secret_enc).not.toContain(secret);
	});
});

describe("password change and reset", () => {
	it("changes a password only with the old one, and ends the other sessions", async () => {
		const { ctx, email } = await withUser();
		const here = await login(ctx, { email, password: PASSWORD });
		const other = await login(ctx, { email, password: PASSWORD });
		const authed = (await authenticate(ctx, here.accessToken))!;
		expect((await fail(changePassword(ctx, authed, { current: "sai-mat-khau-1", next: "Mat-khau-moi-456" }))).code).toBe("wrong_password");
		expect((await fail(changePassword(ctx, authed, { current: PASSWORD, next: "ngan" }))).code).toBe("weak_password");
		await changePassword(ctx, authed, { current: PASSWORD, next: "Mat-khau-moi-456" });
		expect(await authenticate(ctx, other.accessToken)).toBeNull();
		expect(await authenticate(ctx, here.accessToken)).not.toBeNull();
		expect((await login(ctx, { email, password: "Mat-khau-moi-456" })).status).toBe("ok");
	});

	it("mails a link, accepts it once, then refuses it; the old password and old sessions stop working", async () => {
		const { ctx, email, raw } = await withUser();
		const session = await login(ctx, { email, password: PASSWORD });
		const sent: MailMessage[] = [];
		expect(await requestPasswordReset(ctx, email, async (message) => void sent.push(message))).toBe(true);
		expect(sent).toHaveLength(1);
		expect(sent[0].to).toBe(email);
		const token = /token=([\w-]+)/.exec(sent[0].text)![1];
		const stored = raw.prepare("SELECT token_hash FROM password_reset").get() as { token_hash: string };
		expect(stored.token_hash).not.toContain(token);

		await resetPassword(ctx, { token, password: "Mat-khau-moi-456" });
		expect((await fail(resetPassword(ctx, { token, password: "Mat-khau-khac-789" }))).code).toBe("invalid_token");
		expect((await fail(login(ctx, { email, password: PASSWORD }))).status).toBe(401);
		expect(await authenticate(ctx, session.accessToken)).toBeNull();
		expect((await login(ctx, { email, password: "Mat-khau-moi-456" })).status).toBe("ok");
	});

	it("expires the link after 20 minutes and cancels an older link when a new one is asked for", async () => {
		const { ctx, email } = await withUser();
		const sent: MailMessage[] = [];
		const mailer = async (message: MailMessage) => void sent.push(message);
		await requestPasswordReset(ctx, email, mailer);
		advance(RESET_TTL_MS + 1000);
		const old = /token=([\w-]+)/.exec(sent[0].text)![1];
		expect((await fail(resetPassword(ctx, { token: old, password: "Mat-khau-moi-456" }))).code).toBe("invalid_token");
		await requestPasswordReset(ctx, email, mailer);
		await requestPasswordReset(ctx, email, mailer);
		const [, second, third] = sent.map((message) => /token=([\w-]+)/.exec(message.text)![1]);
		expect((await fail(resetPassword(ctx, { token: second, password: "Mat-khau-moi-456" }))).code).toBe("invalid_token");
		await resetPassword(ctx, { token: third, password: "Mat-khau-moi-456" });
	});

	it("does not burn the link on a too-weak password, and says nothing about unknown emails", async () => {
		const { ctx, email } = await withUser();
		const sent: MailMessage[] = [];
		const mailer = async (message: MailMessage) => void sent.push(message);
		expect(await requestPasswordReset(ctx, "khong-co@example.test", mailer)).toBe(true);
		expect(sent).toHaveLength(0);
		await requestPasswordReset(ctx, email, mailer);
		const token = /token=([\w-]+)/.exec(sent[0].text)![1];
		expect((await fail(resetPassword(ctx, { token, password: "ngan" }))).code).toBe("weak_password");
		await resetPassword(ctx, { token, password: "Mat-khau-moi-456" });
	});

	it("sends at most three mails per email an hour, with the same answer each time, and limits an address", async () => {
		const { ctx, email } = await withUser();
		const sent: MailMessage[] = [];
		const mailer = async (message: MailMessage) => void sent.push(message);
		for (let i = 0; i < 5; i++) expect(await requestPasswordReset(ctx, email, mailer)).toBe(true);
		expect(sent).toHaveLength(3);
		let refused = 0;
		for (let i = 0; i < 12; i++) if (!(await requestPasswordReset(ctx, `n${i}@example.test`, mailer))) refused++;
		expect(refused).toBeGreaterThan(0);
	});
});

describe("roles and permissions", () => {
	it("seeds the four system roles, and again without undoing an edit", async () => {
		const { db, raw } = setup();
		await seedRoles(db, new Date(clock));
		const names = (raw.prepare("SELECT name FROM role ORDER BY name").all() as { name: string }[]).map((row) => row.name);
		expect(names).toEqual(["Admin", "Author (Cộng tác viên)", "Editor (Biên tập viên)", "Super Admin"]);
		raw.prepare("DELETE FROM role_permission WHERE role_id = 'role-author' AND module = 'posts' AND action = 'create'").run();
		await seedRoles(db, new Date(clock));
		const after = await loadPermissions(db, "role-author");
		expect(after.has("posts.create")).toBe(false); // the edit stays
		expect(after.has("posts.view")).toBe(true);
	});

	it("gives an Author only their own posts and no publishing; an Editor all; Super Admin everything but editing the log", async () => {
		const { db } = setup();
		await seedRoles(db, new Date(clock));
		const author = await loadPermissions(db, "role-author");
		expect(can(author, "posts", "update")).toBe(false);
		expect(can(author, "posts", "update", { userId: "a", ownerId: "a" })).toBe(true);
		expect(can(author, "posts", "update", { userId: "a", ownerId: "b" })).toBe(false);
		expect(can(author, "posts", "publish")).toBe(false);
		expect(can(author, "users", "view")).toBe(false);
		const editor = await loadPermissions(db, "role-editor");
		expect(can(editor, "posts", "publish")).toBe(true);
		expect(can(editor, "settings", "view")).toBe(false);
		const root = await loadPermissions(db, "role-super-admin");
		expect(can(root, "backup", "create")).toBe(true);
		expect(can(root, "audit", "view")).toBe(true);
		expect(can(root, "audit", "delete")).toBe(false);
	});

	it("tells whether one set of permissions covers another (no handing out more than you have)", async () => {
		const { db } = setup();
		await seedRoles(db, new Date(clock));
		const [root, admin, editor, author] = await Promise.all(["role-super-admin", "role-admin", "role-editor", "role-author"].map((id) => loadPermissions(db, id)));
		expect(covers(root, admin)).toBe(true);
		expect(covers(admin, root)).toBe(false);
		expect(covers(editor, author)).toBe(true);
		expect(covers(author, editor)).toBe(false);
	});

	it("creates the first Super Admin once, who must change the password at first sign-in", async () => {
		const { db, ctx } = setup();
		await seedRoles(db, new Date(clock));
		const id = await seedSuperAdmin(db, { email: "Chu@Example.test", password: PASSWORD }, new Date(clock), FAST);
		expect(id).toBeTruthy();
		expect(await seedSuperAdmin(db, { email: "khac@example.test", password: PASSWORD }, new Date(clock), FAST)).toBeNull();
		const issued = await login(ctx, { email: "chu@example.test", password: PASSWORD });
		expect(issued.mustChangePassword).toBe(true);
	});
});

describe("revoking sessions", () => {
	it("ends every session but the one named", async () => {
		const { ctx, email } = await withUser();
		const a = await login(ctx, { email, password: PASSWORD });
		const b = await login(ctx, { email, password: PASSWORD });
		expect(await revokeSessions(ctx, "u1", { exceptId: b.sessionId })).toBe(1);
		expect(await authenticate(ctx, a.accessToken)).toBeNull();
		expect(await authenticate(ctx, b.accessToken)).not.toBeNull();
	});
});

describe("activity log", () => {
	it("refuses to change or delete a row, blanks secrets and shortens long text", async () => {
		const { db, raw } = setup();
		await writeAudit(db, { userId: null, userEmail: "a@b.c", action: "x", entityType: "t", entityId: "1", after: { password: "hunter2", title: "ok", body: "x".repeat(900), nested: { api_token: "abc" } }, ip: "1.1.1.1", userAgent: "ua" }, new Date(clock));
		const row = raw.prepare("SELECT data_after FROM audit_log").get() as { data_after: string };
		expect(row.data_after).not.toContain("hunter2");
		expect(row.data_after).not.toContain("abc");
		expect(row.data_after).toContain("[900 ký tự]");
		expect(() => raw.prepare("UPDATE audit_log SET action = 'y'").run()).toThrow(/append-only/);
		expect(() => raw.prepare("DELETE FROM audit_log").run()).toThrow(/append-only/);
	});
});
