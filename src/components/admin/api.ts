// The admin pages' door to /api/quan-tri/v1. It sends the CSRF token on writes, and when the access
// cookie has run out (401 "unauthorized") it asks /auth/refresh once and repeats the call. Nothing is
// kept in storage: the CSRF token lives in memory and comes back from /auth/me after a reload.
const BASE = "/api/quan-tri/v1";

let csrf = "";
export const setCsrf = (value: string) => void (csrf = value);

export class ApiClientError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly fields?: Record<string, string>,
	) {
		super(message);
	}
}

type Envelope = { data?: unknown; meta?: { page: number; pageSize: number; total: number }; error?: { code: string; message: string; fields?: Record<string, string> } };

function parseEnvelope(text: string): Envelope | null {
	if (!text) return null;
	try {
		return JSON.parse(text) as Envelope;
	} catch {
		return null;
	}
}

async function send(method: string, path: string, body?: unknown): Promise<{ status: number; json: Envelope | null }> {
	const headers: Record<string, string> = {};
	if (body !== undefined) headers["Content-Type"] = "application/json";
	if (method !== "GET" && csrf) headers["X-TLHP-CSRF"] = csrf;
	let response: Response;
	try {
		response = await fetch(`${BASE}/${path}`, { method, headers, credentials: "same-origin", cache: "no-store", body: body === undefined ? undefined : JSON.stringify(body) });
	} catch {
		throw new ApiClientError(0, "network", "Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.");
	}
	const text = await response.text();
	return { status: response.status, json: parseEnvelope(text) };
}

let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
	refreshing ??= send("POST", "auth/refresh", {})
		.then((result) => {
			const token = (result.json?.data as { csrfToken?: string } | undefined)?.csrfToken;
			if (result.status === 200 && token) setCsrf(token);
			return result.status === 200;
		})
		.finally(() => void (refreshing = null));
	return refreshing;
}

async function call(method: string, path: string, body?: unknown): Promise<Envelope & { status: number }> {
	let result = await send(method, path, body);
	const expired = result.status === 401 && result.json?.error?.code === "unauthorized" && !path.startsWith("auth/login") && path !== "auth/refresh";
	if (expired && (await refreshSession())) result = await send(method, path, body);
	if (result.status >= 400 || result.json?.error) {
		const error = result.json?.error;
		throw new ApiClientError(result.status, error?.code ?? "server_error", error?.message ?? "Có lỗi ở máy chủ. Hãy thử lại sau.", error?.fields);
	}
	return { ...(result.json ?? {}), status: result.status };
}

export async function api<T = unknown>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
	return (await call(method, path, body)).data as T;
}

export async function apiList<T>(path: string): Promise<{ rows: T[]; page: number; pageSize: number; total: number }> {
	const result = await call("GET", path);
	return { rows: (result.data as T[]) ?? [], page: result.meta?.page ?? 1, pageSize: result.meta?.pageSize ?? 20, total: result.meta?.total ?? 0 };
}
