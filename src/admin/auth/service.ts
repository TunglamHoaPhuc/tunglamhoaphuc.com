// Sign-in, sessions, password reset and 2FA (docs/admin-architecture.md 6). Every function takes the
// context it needs (database, secrets, clock, caller's address) so tests drive it without a server.
import { auditStatement, writeAudit } from "../audit/log";
import { decryptSecret, encryptSecret } from "../crypto";
import { num, text, type AdminDb, type AdminEnv, type Row } from "../db";
import { newId } from "../ids";
import type { Mailer } from "../mail/send";
import type { Permissions } from "../rbac/catalog";
import { loadPermissions } from "../rbac/check";
import { ApiError } from "../http/errors";
import { dummyHash, hashPassword, passwordProblem, verifyPassword, type PasswordParams } from "./password";
import { clearFailures, EMAIL_BACKOFF, hit, IP_BACKOFF, LOGIN_BACKOFF, MFA_USER_LIMIT, recordFailure, release, reserve, throttleIp, waitSeconds } from "./throttle";
import { ACCESS_TTL_SECONDS, csrfToken, randomToken, sha256Hex, signAccessToken, verifyAccessToken } from "./tokens";
import { checkTotp, generateTotpSecret, otpauthUri, stepAt } from "./totp";

export const REFRESH_TTL_MS = 30 * 24 * 3600_000;
export const PENDING_TTL_MS = 10 * 60_000;
export const PREV_REFRESH_GRACE_MS = 30_000;
export const RESET_TTL_MS = 20 * 60_000;
const MAX_MFA_FAILURES = 5;

export type AuthContext = {
	db: AdminDb;
	env: Pick<AdminEnv, "ADMIN_JWT_SECRET" | "ADMIN_ENC_KEY" | "ADMIN_BASE_URL">;
	now: () => Date;
	ip: string;
	userAgent: string;
	/** Lower than the real setting only in tests, which would otherwise spend 0.2 s per password. */
	passwordParams?: PasswordParams;
};

export type Authed = {
	user: { id: string; email: string; name: string; roleId: string | null; roleName: string; mustChangePassword: boolean };
	session: { id: string; mfaPassed: boolean; createdAt: string };
	permissions: Permissions;
};

export type Issued = {
	status: "ok" | "mfa_required";
	sessionId: string;
	accessToken: string;
	/** Null while the 2FA code is still to come: no refresh token before it. */
	refreshToken: string | null;
	csrfToken: string;
	mustChangePassword: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const iso = (ctx: AuthContext) => ctx.now().toISOString();

const actor = (ctx: AuthContext, user: { id: string; email: string } | null) => ({
	userId: user?.id ?? null,
	userEmail: user?.email ?? "",
	ip: ctx.ip,
	userAgent: ctx.userAgent,
});

async function issueSession(ctx: AuthContext, user: { id: string }, mfaPassed: boolean): Promise<Issued & { mustChangePassword: boolean }> {
	const now = ctx.now();
	const sessionId = newId("sess", now.getTime());
	const refreshToken = mfaPassed ? randomToken() : null;
	const refreshHash = refreshToken ? await sha256Hex(refreshToken) : null;
	const expires = new Date(now.getTime() + (mfaPassed ? REFRESH_TTL_MS : PENDING_TTL_MS)).toISOString();
	await ctx.db
		.prepare(
			`INSERT INTO session (id, user_id, refresh_hash, created_at, last_used_at, expires_at, ip, user_agent, mfa_passed)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(sessionId, user.id, refreshHash, now.toISOString(), now.toISOString(), expires, ctx.ip, ctx.userAgent.slice(0, 300), mfaPassed ? 1 : 0)
		.run();
	const row = await ctx.db.prepare("SELECT must_change_password FROM user WHERE id = ?").bind(user.id).first();
	return {
		status: mfaPassed ? "ok" : "mfa_required",
		sessionId,
		accessToken: await signAccessToken({ sub: user.id, sid: sessionId }, ctx.env.ADMIN_JWT_SECRET, now.getTime()),
		refreshToken,
		csrfToken: await csrfToken(sessionId, ctx.env.ADMIN_JWT_SECRET),
		mustChangePassword: num(row?.must_change_password) === 1,
	};
}

// ------------------------------------------------------------------ sign-in

export async function login(ctx: AuthContext, input: { email: string; password: string }): Promise<Issued> {
	const email = normalizeEmail(input.email);
	const now = ctx.now();
	const emailHash = await sha256Hex(email);
	// An IPv6 address counts as its /64, and the email has a counter of its own, so a guess spread over many addresses still slows down.
	const address = throttleIp(ctx.ip);
	const pairKey = `login:${emailHash}:${address}`;
	const ipKey = `login-ip:${address}`;
	const emailKey = `login-email:${emailHash}`;
	const wait = await waitSeconds(ctx.db, [pairKey, ipKey, emailKey], now);
	if (wait > 0) throw new ApiError(429, "too_many_attempts", "Bạn thử quá nhiều lần. Hãy đợi một lát rồi thử lại.", undefined, wait);

	const user = await ctx.db.prepare("SELECT id, email, password_hash, locked_at FROM user WHERE email = ? AND deleted_at IS NULL").bind(email).first();
	const hash = user ? text(user.password_hash) : "";
	// Always do one hash check, so an unknown email takes as long as a wrong password.
	const valid = verifyPassword(input.password, hash || dummyHash()) && !!hash;
	if (!user || !valid || user.locked_at) {
		await recordFailure(ctx.db, pairKey, now, LOGIN_BACKOFF);
		await recordFailure(ctx.db, ipKey, now, IP_BACKOFF);
		await recordFailure(ctx.db, emailKey, now, EMAIL_BACKOFF);
		await writeAudit(ctx.db, { ...actor(ctx, user ? { id: text(user.id), email } : null), userEmail: email, action: "auth.login_failed", entityType: "user", entityId: user ? text(user.id) : "-" }, now);
		throw new ApiError(401, "invalid_credentials", "Email hoặc mật khẩu không đúng.");
	}

	await clearFailures(ctx.db, pairKey);
	const userId = text(user.id);
	const mfa = await ctx.db.prepare("SELECT 1 AS yes FROM user_totp WHERE user_id = ? AND enabled_at IS NOT NULL").bind(userId).first();
	const issued = await issueSession(ctx, { id: userId }, !mfa);
	await ctx.db.prepare("UPDATE user SET last_login_at = ?, failed_logins = 0 WHERE id = ?").bind(now.toISOString(), userId).run();
	await writeAudit(ctx.db, { ...actor(ctx, { id: userId, email }), action: mfa ? "auth.login_password_ok" : "auth.login", entityType: "user", entityId: userId }, now);
	return issued;
}

/**
 * The second step: a 2FA code (or a recovery code) on the session `login` left pending. Returns a new, full session.
 * A try is counted before the code is weighed, by one statement each, so any number of requests at once still get five tries
 * per pending session and ten per account in 15 minutes (the password step does not reset the account's count).
 */
export async function verifySecondFactor(ctx: AuthContext, sessionId: string, code: string): Promise<Issued> {
	const now = ctx.now();
	const stamp = now.toISOString();
	const expired = () => new ApiError(401, "unauthorized", "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
	const session = await ctx.db.prepare("SELECT id, user_id, mfa_passed, revoked_at, expires_at FROM session WHERE id = ?").bind(sessionId).first();
	if (!session || session.revoked_at || text(session.expires_at) <= stamp || num(session.mfa_passed) === 1) throw expired();
	const userId = text(session.user_id);

	// Five tries for this pending session, the fifth also ends it. The test and the increment are one statement.
	const counted = await ctx.db
		.prepare(
			`UPDATE session SET mfa_failures = mfa_failures + 1, revoked_at = CASE WHEN mfa_failures + 1 >= ? THEN ? ELSE revoked_at END
			 WHERE id = ? AND revoked_at IS NULL AND mfa_passed = 0 AND mfa_failures < ?`,
		)
		.bind(MAX_MFA_FAILURES, stamp, sessionId, MAX_MFA_FAILURES)
		.run();
	if (counted.meta.changes !== 1) throw expired();
	// Ten tries for the account across all its sign-ins.
	const userKey = `mfa-user:${await sha256Hex(userId)}`;
	const allowance = await reserve(ctx.db, userKey, now, MFA_USER_LIMIT.limit, MFA_USER_LIMIT.windowMs);
	if (!allowance.ok) throw new ApiError(429, "too_many_attempts", "Bạn thử quá nhiều lần. Hãy đợi một lát rồi thử lại.", undefined, allowance.retryAfter);

	const totp = await ctx.db.prepare("SELECT secret_enc, enabled_at, recovery_hashes, last_used_step FROM user_totp WHERE user_id = ?").bind(userId).first();
	const user = await ctx.db.prepare("SELECT email FROM user WHERE id = ? AND deleted_at IS NULL AND locked_at IS NULL").bind(userId).first();
	if (!totp?.enabled_at || !user) throw expired();

	const clean = code.replace(/\s+/g, "");
	let ok = false;
	const recovery: string[] = JSON.parse(text(totp.recovery_hashes) || "[]");
	const secret = await decryptSecret(text(totp.secret_enc), ctx.env.ADMIN_ENC_KEY);
	const usedStep = await checkTotp(secret, clean, now.getTime(), num(totp.last_used_step));
	if (usedStep !== null) ok = true;
	else {
		const hash = await sha256Hex(clean.toLowerCase());
		const index = recovery.indexOf(hash);
		if (index >= 0) {
			recovery.splice(index, 1);
			ok = true;
		}
	}

	if (!ok) {
		await writeAudit(ctx.db, { ...actor(ctx, { id: userId, email: text(user.email) }), action: "auth.mfa_failed", entityType: "user", entityId: userId }, now);
		throw new ApiError(401, "invalid_code", "Mã xác thực không đúng.");
	}

	// A right code gives its try back to the account; a new session (new id, new refresh token, new CSRF token) replaces the pending one.
	await release(ctx.db, userKey);
	await ctx.db.batch([
		ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE id = ?").bind(stamp, sessionId),
		ctx.db.prepare("UPDATE user_totp SET last_used_step = ?, recovery_hashes = ? WHERE user_id = ?").bind(usedStep ?? num(totp.last_used_step), JSON.stringify(recovery), userId),
	]);
	const issued = await issueSession(ctx, { id: userId }, true);
	await writeAudit(ctx.db, { ...actor(ctx, { id: userId, email: text(user.email) }), action: usedStep === null ? "auth.login_recovery_code" : "auth.login", entityType: "user", entityId: userId }, now);
	return issued;
}

// ------------------------------------------------------------------ requests and refresh

/** Who the access token belongs to, with what they may do; null when the token or the session is no good. */
export async function authenticate(ctx: AuthContext, accessToken: string): Promise<Authed | null> {
	const now = ctx.now();
	const claims = await verifyAccessToken(accessToken, ctx.env.ADMIN_JWT_SECRET, now.getTime());
	if (!claims) return null;
	const row = await ctx.db
		.prepare(
			`SELECT s.id AS sid, s.mfa_passed, s.created_at AS session_created, s.last_used_at, u.id AS uid, u.email, u.name, u.role_id, u.must_change_password, r.name AS role_name
			 FROM session s JOIN user u ON u.id = s.user_id LEFT JOIN role r ON r.id = u.role_id
			 WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.deleted_at IS NULL AND u.locked_at IS NULL`,
		)
		.bind(claims.sid, claims.sub, now.toISOString())
		.first();
	if (!row) return null;
	if (now.getTime() - Date.parse(text(row.last_used_at)) > 60_000) {
		await ctx.db.prepare("UPDATE session SET last_used_at = ? WHERE id = ?").bind(now.toISOString(), claims.sid).run();
	}
	const roleId = text(row.role_id) || null;
	return {
		user: { id: text(row.uid), email: text(row.email), name: text(row.name), roleId, roleName: text(row.role_name), mustChangePassword: num(row.must_change_password) === 1 },
		session: { id: text(row.sid), mfaPassed: num(row.mfa_passed) === 1, createdAt: text(row.session_created) },
		permissions: await loadPermissions(ctx.db, roleId),
	};
}

/** A new access token for the refresh token's session, and a new refresh token unless this is a second tab racing the first. */
export async function refresh(ctx: AuthContext, refreshToken: string): Promise<{ accessToken: string; refreshToken: string | null; csrfToken: string } | null> {
	const now = ctx.now();
	const stamp = now.toISOString();
	const hash = await sha256Hex(refreshToken);
	const next = randomToken();
	const nextHash = await sha256Hex(next);

	// One statement does the check and the swap, so two requests with the same token cannot both win.
	const swapped = await ctx.db
		.prepare(
			`UPDATE session SET prev_refresh_hash = refresh_hash, refresh_hash = ?, rotated_at = ?, last_used_at = ?
			 WHERE refresh_hash = ? AND revoked_at IS NULL AND expires_at > ? AND mfa_passed = 1
			   AND user_id IN (SELECT id FROM user WHERE deleted_at IS NULL AND locked_at IS NULL)`,
		)
		.bind(nextHash, stamp, stamp, hash, stamp)
		.run();
	if (swapped.meta.changes === 1) {
		const row = await ctx.db.prepare("SELECT id, user_id FROM session WHERE refresh_hash = ?").bind(nextHash).first();
		if (!row) return null;
		return {
			accessToken: await signAccessToken({ sub: text(row.user_id), sid: text(row.id) }, ctx.env.ADMIN_JWT_SECRET, now.getTime()),
			refreshToken: next,
			csrfToken: await csrfToken(text(row.id), ctx.env.ADMIN_JWT_SECRET),
		};
	}

	const old = await ctx.db.prepare("SELECT id, user_id, rotated_at, revoked_at, expires_at FROM session WHERE prev_refresh_hash = ?").bind(hash).first();
	if (!old || old.revoked_at || text(old.expires_at) <= stamp) return null;
	if (now.getTime() - Date.parse(text(old.rotated_at)) <= PREV_REFRESH_GRACE_MS) {
		// The other tab already swapped it and holds the new token in the cookie: give an access token only.
		return {
			accessToken: await signAccessToken({ sub: text(old.user_id), sid: text(old.id) }, ctx.env.ADMIN_JWT_SECRET, now.getTime()),
			refreshToken: null,
			csrfToken: await csrfToken(text(old.id), ctx.env.ADMIN_JWT_SECRET),
		};
	}
	// An old token again, long after: it was copied. End the session.
	await ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE id = ?").bind(stamp, text(old.id)).run();
	await writeAudit(ctx.db, { ...actor(ctx, null), userId: text(old.user_id), action: "auth.refresh_reuse_detected", entityType: "session", entityId: text(old.id) }, now);
	return null;
}

export async function logout(ctx: AuthContext, authed: Authed): Promise<void> {
	await ctx.db.batch([
		ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").bind(iso(ctx), authed.session.id),
		auditStatement(ctx.db, { ...actor(ctx, authed.user), action: "auth.logout", entityType: "session", entityId: authed.session.id }, ctx.now()),
	]);
}

export async function listSessions(ctx: AuthContext, userId: string, currentId?: string) {
	const { results } = await ctx.db
		.prepare("SELECT id, created_at, last_used_at, ip, user_agent FROM session WHERE user_id = ? AND revoked_at IS NULL AND mfa_passed = 1 AND expires_at > ? ORDER BY last_used_at DESC")
		.bind(userId, iso(ctx))
		.all();
	return results.map((row: Row) => ({ id: text(row.id), createdAt: text(row.created_at), lastUsedAt: text(row.last_used_at), ip: text(row.ip), userAgent: text(row.user_agent), current: text(row.id) === currentId }));
}

/** Ends one session of the user, or every session but `exceptId`. Returns how many ended. */
export async function revokeSessions(ctx: AuthContext, userId: string, opts: { sessionId?: string; exceptId?: string }): Promise<number> {
	const stamp = iso(ctx);
	const result = opts.sessionId
		? await ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL").bind(stamp, opts.sessionId, userId).run()
		: await ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id != ?").bind(stamp, userId, opts.exceptId ?? "").run();
	return result.meta.changes;
}

// ------------------------------------------------------------------ password

/**
 * Checks the signed-in person's password again, for the actions that ask for it (changing it, turning 2FA off, downloading a
 * backup). Wrong tries slow down the way they do at sign-in and are counted together for all three; false when it is wrong.
 */
export async function checkOwnPassword(ctx: AuthContext, userId: string, password: string): Promise<boolean> {
	const now = ctx.now();
	const key = `own-pw:${await sha256Hex(userId)}`;
	const wait = await waitSeconds(ctx.db, [key], now);
	if (wait > 0) throw new ApiError(429, "too_many_attempts", "Bạn thử quá nhiều lần. Hãy đợi một lát rồi thử lại.", undefined, wait);
	const row = await ctx.db.prepare("SELECT password_hash FROM user WHERE id = ?").bind(userId).first();
	const hash = text(row?.password_hash);
	if (!hash || !verifyPassword(password, hash)) {
		await recordFailure(ctx.db, key, now, LOGIN_BACKOFF);
		return false;
	}
	await clearFailures(ctx.db, key);
	return true;
}

export async function changePassword(ctx: AuthContext, authed: Authed, input: { current: string; next: string }): Promise<void> {
	if (!(await checkOwnPassword(ctx, authed.user.id, input.current))) throw new ApiError(400, "wrong_password", "Mật khẩu hiện tại không đúng.", { current: "Mật khẩu hiện tại không đúng." });
	const problem = passwordProblem(input.next, authed.user.email);
	if (problem) throw new ApiError(422, "weak_password", problem, { next: problem });
	if (input.next === input.current) throw new ApiError(422, "same_password", "Mật khẩu mới phải khác mật khẩu cũ.", { next: "Mật khẩu mới phải khác mật khẩu cũ." });
	const now = ctx.now();
	await ctx.db.batch([
		ctx.db.prepare("UPDATE user SET password_hash = ?, password_changed_at = ?, must_change_password = 0, updated_at = ? WHERE id = ?").bind(hashPassword(input.next, ctx.passwordParams), now.toISOString(), now.toISOString(), authed.user.id),
		ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL").bind(now.toISOString(), authed.user.id, authed.session.id),
		auditStatement(ctx.db, { ...actor(ctx, authed.user), action: "auth.password_changed", entityType: "user", entityId: authed.user.id }, now),
	]);
}

/**
 * Mails a reset link when the email belongs to an account. Always looks the same from outside: the same two counters are
 * touched for any email, and everything that depends on whether there is an account (the lookup, the new token, the mail) is
 * `work`, handed to `defer` to run after the answer is on its way. Without `defer` it runs here (tests).
 * Returns false only when the caller's address is over its limit.
 */
export async function requestPasswordReset(ctx: AuthContext, emailInput: string, mailer: Mailer, defer?: (work: () => Promise<unknown>) => void): Promise<boolean> {
	const now = ctx.now();
	const email = normalizeEmail(emailInput);
	if (!(await hit(ctx.db, `reset-ip:${throttleIp(ctx.ip)}`, now, 10, 3600_000))) return false;
	// Over the per-email limit the answer is the same as ever, but no mail goes out.
	if (!(await hit(ctx.db, `reset-email:${await sha256Hex(email)}`, now, 3, 3600_000))) return true;
	const work = async () => {
		const user = await ctx.db.prepare("SELECT id, email FROM user WHERE email = ? AND deleted_at IS NULL AND locked_at IS NULL AND password_hash IS NOT NULL").bind(email).first();
		if (!user) return;
		const token = randomToken();
		const stamp = now.toISOString();
		await ctx.db.batch([
			ctx.db.prepare("UPDATE password_reset SET used_at = ? WHERE user_id = ? AND used_at IS NULL").bind(stamp, text(user.id)),
			ctx.db.prepare("INSERT INTO password_reset (id, user_id, token_hash, created_at, expires_at, requested_ip) VALUES (?, ?, ?, ?, ?, ?)").bind(newId("pwr", now.getTime()), text(user.id), await sha256Hex(token), stamp, new Date(now.getTime() + RESET_TTL_MS).toISOString(), ctx.ip),
			auditStatement(ctx.db, { ...actor(ctx, { id: text(user.id), email }), action: "auth.password_reset_requested", entityType: "user", entityId: text(user.id) }, now),
		]);
		const link = `${ctx.env.ADMIN_BASE_URL.replace(/\/$/, "")}/quan-tri/dat-lai-mat-khau?token=${token}`;
		await mailer({
			to: email,
			subject: "Đặt lại mật khẩu quản trị Tùng Lâm Hòa Phúc",
			text: `Có yêu cầu đặt lại mật khẩu cho tài khoản này.\n\nMở liên kết sau trong vòng 20 phút (chỉ dùng được một lần):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua thư này; mật khẩu hiện tại vẫn giữ nguyên.`,
		});
	};
	if (defer) defer(work);
	else await work();
	return true;
}

export async function resetPassword(ctx: AuthContext, input: { token: string; password: string }): Promise<void> {
	const now = ctx.now();
	const stamp = now.toISOString();
	const bad = () => new ApiError(400, "invalid_token", "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
	if (!(await hit(ctx.db, `reset-try:${throttleIp(ctx.ip)}`, now, 20, 3600_000))) throw new ApiError(429, "too_many_attempts", "Bạn thử quá nhiều lần. Hãy đợi một lát rồi thử lại.", undefined, 3600);
	const tokenHash = await sha256Hex(input.token);
	const row = await ctx.db
		.prepare("SELECT p.id, p.user_id, u.email FROM password_reset p JOIN user u ON u.id = p.user_id WHERE p.token_hash = ? AND p.used_at IS NULL AND p.expires_at > ? AND u.deleted_at IS NULL")
		.bind(tokenHash, stamp)
		.first();
	if (!row) throw bad();
	// The password is judged before the token is spent, so a too-weak one does not burn the link.
	const problem = passwordProblem(input.password, text(row.email));
	if (problem) throw new ApiError(422, "weak_password", problem, { password: problem });
	const used = await ctx.db.prepare("UPDATE password_reset SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(stamp, text(row.id)).run();
	if (used.meta.changes !== 1) throw bad();
	const userId = text(row.user_id);
	await ctx.db.batch([
		ctx.db.prepare("UPDATE user SET password_hash = ?, password_changed_at = ?, must_change_password = 0, failed_logins = 0, updated_at = ? WHERE id = ?").bind(hashPassword(input.password, ctx.passwordParams), stamp, stamp, userId),
		ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(stamp, userId),
		ctx.db.prepare("DELETE FROM auth_throttle WHERE key LIKE ? OR key = ?").bind(`login:${await sha256Hex(text(row.email))}:%`, `login-email:${await sha256Hex(text(row.email))}`),
		auditStatement(ctx.db, { ...actor(ctx, { id: userId, email: text(row.email) }), action: "auth.password_reset", entityType: "user", entityId: userId }, now),
	]);
}

// ------------------------------------------------------------------ 2FA

/** Starts setting up 2FA: a secret the person adds to their app; it counts only after `enableTotp` confirms a code. */
export async function setupTotp(ctx: AuthContext, authed: Authed): Promise<{ secret: string; uri: string }> {
	const existing = await ctx.db.prepare("SELECT enabled_at FROM user_totp WHERE user_id = ?").bind(authed.user.id).first();
	if (existing?.enabled_at) throw new ApiError(409, "already_enabled", "Xác thực hai bước đã được bật.");
	const secret = generateTotpSecret();
	await ctx.db
		.prepare("INSERT INTO user_totp (user_id, secret_enc, enabled_at) VALUES (?, ?, NULL) ON CONFLICT(user_id) DO UPDATE SET secret_enc = excluded.secret_enc, enabled_at = NULL, last_used_step = 0")
		.bind(authed.user.id, await encryptSecret(secret, ctx.env.ADMIN_ENC_KEY))
		.run();
	return { secret, uri: otpauthUri(secret, authed.user.email) };
}

/** Confirms the first code, turns 2FA on and returns ten one-time recovery codes (shown once). */
export async function enableTotp(ctx: AuthContext, authed: Authed, code: string): Promise<string[]> {
	const row = await ctx.db.prepare("SELECT secret_enc, enabled_at FROM user_totp WHERE user_id = ?").bind(authed.user.id).first();
	if (!row || row.enabled_at) throw new ApiError(409, "not_pending", "Chưa có bước thiết lập nào đang chờ xác nhận.");
	const now = ctx.now();
	const step = await checkTotp(await decryptSecret(text(row.secret_enc), ctx.env.ADMIN_ENC_KEY), code.replace(/\s+/g, ""), now.getTime());
	if (step === null) throw new ApiError(400, "invalid_code", "Mã xác thực không đúng.", { code: "Mã xác thực không đúng." });
	const codes = Array.from({ length: 10 }, () => randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 8));
	await ctx.db.batch([
		ctx.db.prepare("UPDATE user_totp SET enabled_at = ?, last_used_step = ?, recovery_hashes = ? WHERE user_id = ?").bind(now.toISOString(), step, JSON.stringify(await Promise.all(codes.map((item) => sha256Hex(item)))), authed.user.id),
		auditStatement(ctx.db, { ...actor(ctx, authed.user), action: "auth.2fa_enabled", entityType: "user", entityId: authed.user.id }, now),
	]);
	return codes;
}

export async function disableTotp(ctx: AuthContext, authed: Authed, password: string): Promise<void> {
	if (!(await checkOwnPassword(ctx, authed.user.id, password))) throw new ApiError(400, "wrong_password", "Mật khẩu không đúng.", { password: "Mật khẩu không đúng." });
	await ctx.db.batch([
		ctx.db.prepare("DELETE FROM user_totp WHERE user_id = ?").bind(authed.user.id),
		auditStatement(ctx.db, { ...actor(ctx, authed.user), action: "auth.2fa_disabled", entityType: "user", entityId: authed.user.id }, ctx.now()),
	]);
}

export async function hasTotp(db: AdminDb, userId: string): Promise<boolean> {
	return !!(await db.prepare("SELECT 1 AS yes FROM user_totp WHERE user_id = ? AND enabled_at IS NOT NULL").bind(userId).first());
}

export { ACCESS_TTL_SECONDS, stepAt };
