// /auth/* and /me/*: signing in and out, passwords, sessions, 2FA (docs/admin-architecture.md 7.1).
import { z } from "zod";
import { clearCookie, cookieHeader, COOKIES, readCookie } from "../http/cookies";
import { ApiError } from "../http/errors";
import { registerRoutes, type Call } from "../http/api";
import { csrfToken } from "./tokens";
import {
	ACCESS_TTL_SECONDS, authenticate, changePassword, disableTotp, enableTotp, hasTotp, listSessions, login, logout, refresh,
	requestPasswordReset, resetPassword, revokeSessions, setupTotp, verifySecondFactor, REFRESH_TTL_MS, type Issued,
} from "./service";

const email = z.string().trim().min(3, "Nhập email.").max(200).includes("@", { message: "Email chưa đúng." });
const password = z.string().min(1, "Nhập mật khẩu.").max(200);

function setSessionCookies(call: Call, issued: { accessToken: string; refreshToken: string | null }) {
	call.setCookies.push(cookieHeader(COOKIES.access, issued.accessToken, { maxAgeSeconds: ACCESS_TTL_SECONDS, sameSite: "Lax" }));
	if (issued.refreshToken) call.setCookies.push(cookieHeader(COOKIES.refresh, issued.refreshToken, { maxAgeSeconds: Math.floor(REFRESH_TTL_MS / 1000), sameSite: "Strict" }));
	else if (issued.refreshToken === null) call.setCookies.push(clearCookie(COOKIES.refresh, "Strict"));
}

const issuedBody = (issued: Issued) => ({ status: issued.status, mustChangePassword: issued.mustChangePassword, csrfToken: issued.csrfToken });

registerRoutes(
	{
		method: "POST",
		path: "auth/login",
		needs: "public",
		handler: async (call) => {
			const input = await call.body(z.object({ email, password }));
			const issued = await login(call.ctx, input);
			setSessionCookies(call, issued);
			return issuedBody(issued);
		},
	},
	{
		method: "POST",
		path: "auth/2fa/verify",
		needs: "pending",
		handler: async (call) => {
			const input = await call.body(z.object({ code: z.string().trim().min(6, "Nhập mã gồm 6 số.").max(20) }));
			const issued = await verifySecondFactor(call.ctx, call.authed!.session.id, input.code);
			setSessionCookies(call, issued);
			return issuedBody(issued);
		},
	},
	{
		method: "POST",
		path: "auth/refresh",
		needs: "public",
		handler: async (call) => {
			const token = readCookie(call.request, COOKIES.refresh);
			const result = token ? await refresh(call.ctx, token) : null;
			if (!result) {
				call.setCookies.push(clearCookie(COOKIES.access, "Lax"), clearCookie(COOKIES.refresh, "Strict"));
				throw new ApiError(401, "unauthorized", "Phiên đăng nhập đã hết hạn.");
			}
			call.setCookies.push(cookieHeader(COOKIES.access, result.accessToken, { maxAgeSeconds: ACCESS_TTL_SECONDS, sameSite: "Lax" }));
			if (result.refreshToken) call.setCookies.push(cookieHeader(COOKIES.refresh, result.refreshToken, { maxAgeSeconds: Math.floor(REFRESH_TTL_MS / 1000), sameSite: "Strict" }));
			return { csrfToken: result.csrfToken };
		},
	},
	{
		method: "POST",
		path: "auth/logout",
		needs: "pending",
		handler: async (call) => {
			await logout(call.ctx, call.authed!);
			call.setCookies.push(clearCookie(COOKIES.access, "Lax"), clearCookie(COOKIES.refresh, "Strict"));
		},
	},
	{
		method: "POST",
		path: "auth/forgot-password",
		needs: "public",
		handler: async (call) => {
			const input = await call.body(z.object({ email }));
			// The mail goes out after the answer, so how long the answer takes says nothing about the address.
			const mailer = (message: Parameters<typeof call.deps.mailer>[0]) => {
				call.deps.defer(call.deps.mailer(message).catch((error) => console.error("reset mail failed", error)));
				return Promise.resolve();
			};
			const allowed = await requestPasswordReset(call.ctx, input.email, mailer);
			if (!allowed) throw new ApiError(429, "too_many_attempts", "Bạn gửi yêu cầu quá nhiều lần. Hãy thử lại sau.", undefined, 3600);
			return { message: "Nếu email này có tài khoản, một thư hướng dẫn đặt lại mật khẩu sẽ được gửi tới." };
		},
	},
	{
		method: "POST",
		path: "auth/reset-password",
		needs: "public",
		handler: async (call) => {
			const input = await call.body(z.object({ token: z.string().min(20).max(100), password }));
			await resetPassword(call.ctx, input);
			return { message: "Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới." };
		},
	},
	{
		method: "GET",
		path: "auth/me",
		needs: "session-any",
		handler: async (call) => {
			const { user, session, permissions } = call.authed!;
			return {
				user: { id: user.id, email: user.email, name: user.name, role: user.roleName },
				permissions: [...permissions].map(([key, scope]) => (scope === "own" ? `${key}:own` : key)),
				mustChangePassword: user.mustChangePassword,
				mfaEnabled: await hasTotp(call.ctx.db, user.id),
				csrfToken: await csrfToken(session.id, call.deps.env.ADMIN_JWT_SECRET),
			};
		},
	},
	{
		method: "POST",
		path: "me/password",
		needs: "session-any",
		handler: async (call) => {
			const input = await call.body(z.object({ current: password, next: z.string().max(200) }));
			await changePassword(call.ctx, call.authed!, input);
		},
	},
	{
		method: "GET",
		path: "me/sessions",
		needs: "session-any",
		handler: async (call) => ({ sessions: await listSessions(call.ctx, call.authed!.user.id, call.authed!.session.id) }),
	},
	{
		method: "DELETE",
		path: "me/sessions/:id",
		needs: "session-any",
		handler: async (call) => {
			const ended = await revokeSessions(call.ctx, call.authed!.user.id, { sessionId: call.params.id });
			if (!ended) throw new ApiError(404, "not_found", "Phiên này không còn.");
		},
	},
	{
		method: "DELETE",
		path: "me/sessions",
		needs: "session-any",
		handler: async (call) => ({ ended: await revokeSessions(call.ctx, call.authed!.user.id, { exceptId: call.authed!.session.id }) }),
	},
	{ method: "POST", path: "me/2fa/setup", needs: "session-any", handler: async (call) => setupTotp(call.ctx, call.authed!) },
	{
		method: "POST",
		path: "me/2fa/enable",
		needs: "session-any",
		handler: async (call) => {
			const input = await call.body(z.object({ code: z.string().trim().min(6).max(10) }));
			return { recoveryCodes: await enableTotp(call.ctx, call.authed!, input.code) };
		},
	},
	{
		method: "POST",
		path: "me/2fa/disable",
		needs: "session-any",
		handler: async (call) => {
			const input = await call.body(z.object({ password }));
			await disableTotp(call.ctx, call.authed!, input.password);
		},
	},
);

export { authenticate };
