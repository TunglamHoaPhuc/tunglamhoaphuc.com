// Fixes from the second independent audit of the admin (auth plumbing): 2FA guess limits, throttle keys,
// wrong-password limits, forgot-password timing, 4xx instead of 500, and the audio rule of the sanitiser.
import { beforeEach, describe, expect, it } from "vitest";
import {
	authenticate, changePassword, disableTotp, enableTotp, login, requestPasswordReset, setupTotp, verifySecondFactor, type AuthContext,
} from "../../../src/admin/auth/service";
import { hashPassword } from "../../../src/admin/auth/password";
import { throttleIp } from "../../../src/admin/auth/throttle";
import { totpCode, stepAt } from "../../../src/admin/auth/totp";
import { sanitizeHtml } from "../../../src/admin/content/html";
import { clientIp, readCookie } from "../../../src/admin/http/cookies";
import { ApiError } from "../../../src/admin/http/errors";
import { confirmPassword } from "../../../src/admin/ops/backup";
import { isKnownPermission } from "../../../src/admin/rbac/catalog";
import { seedRoles } from "../../../src/admin/seed";
import { memoryAdminDb } from "../helpers/adminDb";
import { BASE, world } from "../helpers/adminWorld";

const FAST = { m: 64, t: 1, p: 1 };
const KEY = Buffer.alloc(32, 7).toString("base64");
const PASSWORD = "Mot-mat-khau-dai-123";

let clock = Date.parse("2026-11-21T08:00:00Z");
const advance = (ms: number) => void (clock += ms);
beforeEach(() => void (clock = Date.parse("2026-11-21T08:00:00Z")));

async function withUser(email = "bien-tap@example.test") {
	const { db, raw } = memoryAdminDb();
	await seedRoles(db, new Date(clock));
	raw
		.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at) VALUES ('u1', ?, 'Biên Tập', 'editor', 'role-editor', ?, '2026-01-01')")
		.run(email, hashPassword(PASSWORD, FAST));
	const ctx: AuthContext = {
		db,
		env: { ADMIN_JWT_SECRET: "x".repeat(40), ADMIN_ENC_KEY: KEY, ADMIN_BASE_URL: "https://www.example.test" },
		now: () => new Date(clock),
		ip: "203.0.113.5",
		userAgent: "vitest",
		passwordParams: FAST,
	};
	return { db, raw, ctx, email };
}

async function withTotp() {
	const s = await withUser();
	const first = await login(s.ctx, { email: s.email, password: PASSWORD });
	const authed = (await authenticate(s.ctx, first.accessToken))!;
	const { secret } = await setupTotp(s.ctx, authed);
	await enableTotp(s.ctx, authed, await totpCode(secret, stepAt(clock)));
	advance(31_000);
	return { ...s, secret, authed };
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

describe("2FA guesses are limited atomically and per account", () => {
	it("40 wrong codes at once on one pending session: at most five are weighed and the session ends", async () => {
		const { ctx, email, raw } = await withTotp();
		const pending = await login(ctx, { email, password: PASSWORD });
		const results = await Promise.allSettled(Array.from({ length: 40 }, () => verifySecondFactor(ctx, pending.sessionId, "000000")));
		expect(results.every((result) => result.status === "rejected")).toBe(true);
		const session = raw.prepare("SELECT mfa_failures, revoked_at FROM session WHERE id = ?").get(pending.sessionId) as { mfa_failures: number; revoked_at: string | null };
		expect(session.mfa_failures).toBeGreaterThanOrEqual(5);
		expect(session.revoked_at).not.toBeNull();
		const weighed = raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.mfa_failed'").get() as { n: number };
		expect(weighed.n).toBeLessThanOrEqual(5);
	});

	it("keeps counting across sessions: twenty sign-ins with five wrong codes each end in 429 after ten tries", async () => {
		const { ctx, email, raw, secret } = await withTotp();
		let blocked: ApiError | null = null;
		for (let round = 0; round < 20 && !blocked; round++) {
			const pending = await login(ctx, { email, password: PASSWORD });
			for (let i = 0; i < 5 && !blocked; i++) {
				const error = await fail(verifySecondFactor(ctx, pending.sessionId, "000000"));
				if (error.status === 429) blocked = error;
			}
		}
		expect(blocked?.status).toBe(429);
		expect(blocked?.retryAfter).toBeGreaterThan(0);
		const weighed = raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.mfa_failed'").get() as { n: number };
		expect(weighed.n).toBeLessThanOrEqual(10);
		// Not even the right code gets through while it waits ...
		const pending = await login(ctx, { email, password: PASSWORD });
		expect((await fail(verifySecondFactor(ctx, pending.sessionId, await totpCode(secret, stepAt(clock))))).status).toBe(429);
		// ... and it is a pause, not a lock.
		advance(16 * 60_000);
		const again = await login(ctx, { email, password: PASSWORD });
		expect((await verifySecondFactor(ctx, again.sessionId, await totpCode(secret, stepAt(clock)))).status).toBe("ok");
	});

	it("a right code does not use up the allowance of wrong ones", async () => {
		const { ctx, email, secret } = await withTotp();
		for (let round = 0; round < 12; round++) {
			advance(31_000);
			const pending = await login(ctx, { email, password: PASSWORD });
			expect((await verifySecondFactor(ctx, pending.sessionId, await totpCode(secret, stepAt(clock)))).status).toBe("ok");
		}
	});
});

describe("sign-in throttle keys", () => {
	it("treats every address of one IPv6 /64 as one", () => {
		expect(throttleIp("2001:db8:1:2::1")).toBe(throttleIp("2001:DB8:1:2:ffff:0:0:9"));
		expect(throttleIp("2001:db8:1:2::1")).not.toBe(throttleIp("2001:db8:1:3::1"));
		expect(throttleIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
		expect(throttleIp("203.0.113.5")).toBe("203.0.113.5");
		expect(throttleIp("")).toBe("");
		expect(throttleIp("not an address")).toBe("not an address");
	});

	it("throttles 30 wrong sign-ins from 30 addresses inside one /64", async () => {
		const { ctx, email } = await withUser();
		const statuses: number[] = [];
		for (let i = 0; i < 30; i++) statuses.push((await fail(login({ ...ctx, ip: `2001:db8:abcd:12:${i.toString(16)}::${i + 1}` }, { email: `x${i}@example.test`, password: "sai-mat-khau-1" }))).status);
		expect(statuses.slice(0, 20).every((status) => status === 401)).toBe(true);
		expect(statuses.slice(20).every((status) => status === 429)).toBe(true);
		// Another address of the same /64 waits too, whatever the password.
		expect((await fail(login({ ...ctx, ip: "2001:db8:abcd:12:aaaa::7" }, { email, password: PASSWORD }))).status).toBe(429);
	}, 60_000);

	it("slows guessing at one email from many addresses after 50 failures, and only slows it", async () => {
		const { ctx, email } = await withUser();
		for (let i = 0; i < 50; i++) await fail(login({ ...ctx, ip: `198.51.${Math.floor(i / 200)}.${(i % 200) + 1}` }, { email, password: "sai-mat-khau-1" }));
		const blocked = await fail(login({ ...ctx, ip: "192.0.2.77" }, { email, password: PASSWORD }));
		expect(blocked.status).toBe(429);
		advance(61_000);
		expect((await login({ ...ctx, ip: "192.0.2.77" }, { email, password: PASSWORD })).status).toBe("ok");
	});

	it("does not take x-forwarded-for for the caller's address", () => {
		const forged = new Request("https://x.test/", { headers: { "x-forwarded-for": "1.2.3.4" } });
		expect(clientIp(forged)).toBe("");
		expect(clientIp(new Request("https://x.test/", { headers: { "cf-connecting-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4" } }))).toBe("5.6.7.8");
	});
});

describe("wrong-password tries on the account's own pages", () => {
	it("limits wrong current passwords on a password change", async () => {
		const { ctx, email } = await withUser();
		const authed = (await authenticate(ctx, (await login(ctx, { email, password: PASSWORD })).accessToken))!;
		for (let i = 0; i < 5; i++) expect((await fail(changePassword(ctx, authed, { current: "sai-mat-khau-1", next: "Mat-khau-moi-456" }))).status).toBe(400);
		const blocked = await fail(changePassword(ctx, authed, { current: PASSWORD, next: "Mat-khau-moi-456" }));
		expect(blocked.status).toBe(429);
		expect(blocked.retryAfter).toBeGreaterThan(0);
		advance(61_000);
		await changePassword(ctx, authed, { current: PASSWORD, next: "Mat-khau-moi-456" });
	});

	it("shares one allowance between password change, turning 2FA off and the backup confirmation", async () => {
		const { ctx, email } = await withUser();
		const authed = (await authenticate(ctx, (await login(ctx, { email, password: PASSWORD })).accessToken))!;
		for (let i = 0; i < 2; i++) await fail(changePassword(ctx, authed, { current: "sai-mat-khau-1", next: "Mat-khau-moi-456" }));
		for (let i = 0; i < 2; i++) await fail(disableTotp(ctx, authed, "sai-mat-khau-1"));
		await fail(confirmPassword(ctx, authed, "sai-mat-khau-1"));
		expect((await fail(disableTotp(ctx, authed, PASSWORD))).status).toBe(429);
		expect((await fail(confirmPassword(ctx, authed, PASSWORD))).status).toBe(429);
	});

	it("a right password clears the count", async () => {
		const { ctx, email } = await withUser();
		const authed = (await authenticate(ctx, (await login(ctx, { email, password: PASSWORD })).accessToken))!;
		for (let round = 0; round < 3; round++) {
			for (let i = 0; i < 4; i++) await fail(disableTotp(ctx, authed, "sai-mat-khau-1"));
			await confirmPassword(ctx, authed, PASSWORD);
		}
	});
});

describe("forgot-password looks the same from outside", () => {
	/** Counts the database calls made while `run` is awaited, i.e. before the answer goes out. */
	async function awaitedOps(email: string, known: boolean) {
		const { ctx, raw } = await withUser();
		let ops = 0;
		const spy = new Proxy(ctx.db, {
			get(target, prop, receiver) {
				const value = Reflect.get(target, prop, receiver);
				if ((prop === "prepare" || prop === "batch") && typeof value === "function") {
					return (...args: unknown[]) => {
						ops++;
						return (value as (...a: unknown[]) => unknown).apply(target, args);
					};
				}
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		const deferred: (() => Promise<unknown>)[] = [];
		const mails: string[] = [];
		const answer = await requestPasswordReset({ ...ctx, db: spy }, known ? "bien-tap@example.test" : email, async (message) => void mails.push(message.to), (work) => void deferred.push(work));
		const before = ops;
		for (const work of deferred) await work();
		const resets = (raw.prepare("SELECT COUNT(*) AS n FROM password_reset").get() as { n: number }).n;
		return { answer, before, resets, mails, ops };
	}

	it("does the same awaited work for an unknown email as for an account, and does the rest after the answer", async () => {
		const known = await awaitedOps("khong-co@example.test", true);
		const unknown = await awaitedOps("khong-co@example.test", false);
		expect(known.answer).toBe(true);
		expect(unknown.answer).toBe(true);
		expect(known.before).toBe(unknown.before);
		expect(known.resets).toBe(1);
		expect(known.mails).toEqual(["bien-tap@example.test"]);
		expect(unknown.resets).toBe(0);
		expect(unknown.mails).toEqual([]);
	});
});

describe("answers that were 500 are 4xx", () => {
	it("a cookie with a broken % escape is no cookie", () => {
		const request = new Request("https://x.test/", { headers: { cookie: "__Host-tlhp_at=%E0%A4%A; other=1" } });
		expect(readCookie(request, "__Host-tlhp_at")).toBeNull();
		expect(readCookie(new Request("https://x.test/", { headers: { cookie: "a=%41" } }), "a")).toBe("A");
	});

	it("a broken cookie gets 401 from a protected route, not 500", async () => {
		const w = await world([]);
		const response = await (await import("../../../src/admin/http/api")).dispatch(
			new Request(`${BASE}/api/quan-tri/v1/auth/me`, { headers: { cookie: "__Host-tlhp_at=%E0%A4%A" } }),
			"auth/me",
			w.deps,
		);
		expect(response.status).toBe(401);
	});

	it("prototype names are not sort keys or slug types", async () => {
		const w = await world([{ id: "root", email: "root@example.test", roleId: "role-super-admin" }]);
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "posts?sort=constructor")).status).toBe(200);
		expect((await root.call("GET", "posts?sort=__proto__")).status).toBe(200);
		expect((await root.call("GET", "slug?type=constructor&text=abc")).status).toBe(400);
		expect((await root.call("GET", "slug?type=toString&text=abc")).status).toBe(400);
		expect((await root.call("GET", "slug?type=post&text=abc")).status).toBe(200);
	});

	it("inherited object keys are not modules", () => {
		for (const module of ["toString", "constructor", "hasOwnProperty", "__proto__"]) expect(isKnownPermission(module, "view")).toBe(false);
		expect(isKnownPermission("posts", "view")).toBe(true);
	});
});

describe("audio in an article", () => {
	it("is built from library media or the site's own /anh-goc/ path, never from an outside address", () => {
		expect(sanitizeHtml('<audio src="https://evil.example/x.mp3" controls></audio>')).toBe("");
		expect(sanitizeHtml('<audio src="//evil.example/x.mp3" controls></audio>')).toBe("");
		expect(sanitizeHtml('<audio src="/brand/x.mp3" controls></audio>')).toBe("");
		expect(sanitizeHtml('<audio src="https://evil.example/x.mp3" data-media-id="audio-1" controls></audio>')).toBe("");
		expect(sanitizeHtml('<audio src="/anh-goc/a/kinh.mp3" controls></audio>')).toBe('<audio src="/anh-goc/a/kinh.mp3" controls preload="none"></audio>');
		const mediaSrc = new Map([["audio-1", "/anh-goc/s2/cms/kinh.mp3"]]);
		expect(sanitizeHtml('<audio src="https://evil.example/x.mp3" data-media-id="audio-1"></audio>', { mediaSrc })).toBe('<audio src="/anh-goc/s2/cms/kinh.mp3" controls preload="none" data-media-id="audio-1"></audio>');
	});

	it("leaves pictures as they were", () => {
		expect(sanitizeHtml('<img src="https://cdn.example/a.webp" alt="a">')).toContain('src="https://cdn.example/a.webp"');
	});
});
