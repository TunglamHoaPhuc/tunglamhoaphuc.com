// The admin's REST API: one dispatcher for everything under /api/quan-tri/v1. It is a plain function
// of (request, dependencies) so tests call it without a server; the Next route file only wires the
// Worker's bindings in. What it enforces for every route, in this order:
//   host (only the admin's own address) -> Origin (writes) -> JSON body -> session -> 2FA step done ->
//   password-change pending -> CSRF token (writes) -> permission -> the handler.
import { z } from "zod";
import { authenticate, type AuthContext, type Authed } from "../auth/service";
import { csrfToken, timingSafeEqual } from "../auth/tokens";
import type { AdminEnv } from "../db";
import type { Mailer } from "../mail/send";
import type { MediaStore } from "../media/store";
import type { BackupBucket } from "../ops/backup";
import { can } from "../rbac/check";
import type { Action } from "../rbac/catalog";
import { ApiError, forbidden, notFound, unauthorized } from "./errors";
import { clientIp, cookieHeader, readCookie, COOKIES } from "./cookies";

export type Deps = {
	env: AdminEnv;
	now?: () => Date;
	mailer: Mailer;
	/** The library's file store (R2); absent where there is no bucket. */
	media?: MediaStore;
	/** The private bucket the backups go to (R2 tlhp-backup); absent where there is none. */
	backup?: BackupBucket;
	/** Runs work after the response is sent (`waitUntil` on a Worker). */
	defer: (work: Promise<unknown>) => void;
	passwordParams?: AuthContext["passwordParams"];
};

export type Call = {
	ctx: AuthContext;
	request: Request;
	deps: Deps;
	params: Record<string, string>;
	query: URLSearchParams;
	/** Set for every route that is not public. */
	authed: Authed | null;
	body<S extends z.ZodType>(schema: S): Promise<z.infer<S>>;
	/** Cookies to set on the response. */
	setCookies: string[];
};

export type Needs =
	| "public"
	/** A session that may still be waiting for its 2FA code (the code endpoint, sign-out). */
	| "pending"
	/** A full session; allowed while the person still has to change the password (the change itself, /me). */
	| "session-any"
	/** A full session with nothing left to do before using the admin. */
	| "session"
	| { module: string; action: Action };

export type RouteSpec = { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; needs: Needs; handler: (call: Call) => Promise<unknown> };

const routes: RouteSpec[] = [];
export const registerRoutes = (...specs: RouteSpec[]) => void routes.push(...specs);

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

const send = (status: number, data: unknown, cookies: string[] = [], extra: Record<string, string> = {}) => {
	const headers = new Headers({ ...JSON_HEADERS, ...extra });
	for (const cookie of cookies) headers.append("Set-Cookie", cookie);
	return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
};

function match(path: string, pattern: string): Record<string, string> | null {
	const a = path.split("/").filter(Boolean);
	const b = pattern.split("/").filter(Boolean);
	if (a.length !== b.length) return null;
	const params: Record<string, string> = {};
	for (let i = 0; i < b.length; i++) {
		if (b[i].startsWith(":")) params[b[i].slice(1)] = decodeURIComponent(a[i]);
		else if (a[i] !== b[i]) return null;
	}
	return params;
}

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** `path` is what follows /api/quan-tri/v1/. */
export async function dispatch(request: Request, path: string, deps: Deps): Promise<Response> {
	const url = new URL(request.url);
	const baseHost = new URL(deps.env.ADMIN_BASE_URL).host;
	// The admin exists on one address only: on the bare domain and preview hosts it is not there.
	if (url.host !== baseHost) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

	const method = request.method.toUpperCase();
	let spec: RouteSpec | undefined;
	let params: Record<string, string> = {};
	let pathExists = false;
	for (const candidate of routes) {
		const found = match(path, candidate.path);
		if (!found) continue;
		pathExists = true;
		if (candidate.method === method) {
			spec = candidate;
			params = found;
			break;
		}
	}
	if (!spec) return send(pathExists ? 405 : 404, { error: { code: pathExists ? "method_not_allowed" : "not_found", message: "Không tìm thấy." } });

	const now = deps.now ?? (() => new Date());
	const ctx: AuthContext = { db: deps.env.DB, env: deps.env, now, ip: clientIp(request), userAgent: request.headers.get("user-agent") ?? "", passwordParams: deps.passwordParams };
	const setCookies: string[] = [];
	try {
		if (WRITE.has(method)) {
			const origin = request.headers.get("origin");
			if (!origin || new URL(origin).host !== baseHost) throw new ApiError(403, "bad_origin", "Yêu cầu không hợp lệ.");
		}

		let authed: Authed | null = null;
		if (spec.needs !== "public") {
			const token = readCookie(request, COOKIES.access);
			authed = token ? await authenticate(ctx, token) : null;
			if (!authed) throw unauthorized();
			const needs = spec.needs;
			if (needs !== "pending" && !authed.session.mfaPassed) throw new ApiError(401, "mfa_required", "Cần nhập mã xác thực hai bước.");
			if ((needs === "session" || typeof needs === "object") && authed.user.mustChangePassword) throw new ApiError(403, "password_change_required", "Bạn cần đổi mật khẩu trước khi tiếp tục.");
			if (WRITE.has(method)) {
				const given = request.headers.get("x-tlhp-csrf") ?? "";
				if (!timingSafeEqual(given, await csrfToken(authed.session.id, deps.env.ADMIN_JWT_SECRET))) throw new ApiError(403, "bad_csrf", "Yêu cầu không hợp lệ.");
			}
			if (typeof needs === "object" && !can(authed.permissions, needs.module, needs.action, { userId: authed.user.id, anyOwner: true })) throw forbidden();
		}

		let parsed: unknown;
		const call: Call = {
			ctx,
			request,
			deps,
			params,
			query: url.searchParams,
			authed,
			setCookies,
			body: async (schema) => {
				if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) throw new ApiError(415, "json_required", "Nội dung gửi lên phải là JSON.");
				parsed ??= await request.json().catch(() => {
					throw new ApiError(400, "bad_json", "Nội dung JSON không hợp lệ.");
				});
				const result = schema.safeParse(parsed);
				if (!result.success) {
					const fields: Record<string, string> = {};
					for (const issue of result.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
					throw new ApiError(400, "invalid_input", "Dữ liệu chưa hợp lệ.", fields);
				}
				return result.data;
			},
		};
		const result = await spec.handler(call);
		if (result instanceof Response) return result;
		return result === undefined ? send(204, null, setCookies) : send(200, { data: result }, setCookies);
	} catch (error) {
		if (error instanceof ApiError) {
			const wait: Record<string, string> = error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {};
			return send(error.status, { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } }, setCookies, wait);
		}
		console.error("admin api", method, path, error);
		return send(500, { error: { code: "server_error", message: "Có lỗi ở máy chủ. Hãy thử lại sau." } });
	}
}

export { cookieHeader, notFound };
