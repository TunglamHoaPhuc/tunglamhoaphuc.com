import { throttleIp } from "@/admin/auth/throttle";
import type { Ai, PageWords } from "./api";

// What the course's routes need from the Worker: the AI binding and the static files, read
// through cloudflare:workers, which is missing under `npm run dev` (then: no AI, no files).

type Assets = { fetch(request: Request): Promise<Response> };
type WorkerEnv = { AI?: Ai; ASSETS?: Assets };

export async function workerEnv(): Promise<WorkerEnv> {
	try {
		const workers = (await import("cloudflare:workers" as string)) as {
			env?: WorkerEnv;
		};
		return workers.env ?? {};
	} catch {
		return {};
	}
}

/** The biggest request body read; the app sends a text, a question or a rectangle. */
const MAX_BODY = 16 * 1024;

/** The JSON body of a POST, or `null` when it is missing, too big or not an object. */
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
	// Refuse a body that says it is too big before reading it.
	if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return null;
	const text = await request.text();
	if (text.length > MAX_BODY) return null;
	try {
		const body: unknown = JSON.parse(text);
		return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The words of one page of the book (public/tibetan-study/coords/<n>.json), or `null`. */
export async function pageWords(pageNumber: number, request: Request, assets: Assets | undefined): Promise<PageWords | null> {
	if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 120) return null;
	const url = new URL(`/tibetan-study/coords/${pageNumber}.json`, request.url);
	try {
		const response = assets ? await assets.fetch(new Request(url)) : await fetch(url);
		return response.ok ? ((await response.json()) as PageWords) : null;
	} catch {
		return null;
	}
}

/**
 * An answer kept for a month in the data centre's cache, keyed by what was asked: the same
 * text asked again costs no AI. Only answers that came from the model are kept.
 */
export async function cachedJson<T extends { status?: string }>(kind: string, key: string, make: () => Promise<T>): Promise<T> {
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	if (!cache) return make();
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
	const id = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	const request = new Request(`https://tieng-tang.cache.invalid/${kind}/${id}`);
	try {
		const hit = await cache.match(request);
		if (hit) return (await hit.json()) as T;
	} catch {
		// A cache that cannot be read is no cache.
	}
	const value = await make();
	if (value.status === "success") {
		await cache
			.put(
				request,
				Response.json(value, {
					headers: { "Cache-Control": "public, max-age=2592000" },
				}),
			)
			.catch(() => undefined);
	}
	return value;
}

/** Calls counted per visitor and minute in this isolate, for when the data centre cache is missing (dev). */
const counted = new Map<string, number>();

/** Thrown by `allow` when a visitor is over the allowance; the routes turn it into `tooMany()`. */
export class OverLimit extends Error {}

/**
 * A brake on the Workers AI bill, not an exact meter: more than `limit` counted calls from one visitor in one minute answers 429.
 * The count lives in the cache of the data centre that serves the visitor (the one the answers are kept in): it is read and then
 * written, so a burst of simultaneous requests can slip past it, and each data centre counts apart. Only `cf-connecting-ip` is
 * trusted as the visitor (it is set by Cloudflare; other headers can be made up); without it everyone shares one bucket.
 */
export async function overLimit(request: Request, bucket: string, limit: number, now = Date.now()): Promise<boolean> {
	// An IPv6 visitor holds a whole /64 of addresses, so the count is by the /64 (as for sign-in), not by the one address in use.
	const ip = throttleIp(request.headers.get("cf-connecting-ip") ?? "local");
	const minute = Math.floor(now / 60_000);
	const name = `${bucket}/${ip}/${minute}`;
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	if (!cache) {
		for (const key of counted.keys()) if (!key.endsWith(`/${minute}`)) counted.delete(key);
		const next = (counted.get(name) ?? 0) + 1;
		counted.set(name, next);
		return next > limit;
	}
	const key = new Request(`https://tieng-tang.ratelimit.invalid/${encodeURIComponent(name)}`);
	let used = 0;
	try {
		const hit = await cache.match(key);
		if (hit) used = Number(await hit.text()) || 0;
	} catch {
		// A cache that cannot be read lets the call through: the brake must never stop the course.
		return false;
	}
	used += 1;
	await cache.put(key, new Response(String(used), { headers: { "Cache-Control": "public, max-age=120" } })).catch(() => undefined);
	return used > limit;
}

/** Counts one call and throws `OverLimit` when it is over. Call it where the AI is about to be asked, so answers already kept cost nothing. */
export async function allow(request: Request, bucket: string, limit: number): Promise<void> {
	if (await overLimit(request, bucket, limit)) throw new OverLimit();
}

/** The answer to a visitor over the allowance. `answer` is there for the question box, which shows `answer` and nothing else. */
export const tooMany = () => {
	const message = "Bạn hỏi hơi nhanh, mời đợi một phút rồi thử lại.";
	return Response.json({ status: "error", message, answer: message }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
};
