import { throttleIp } from "./throttle-ip";

// A brake on what costs money or exposes data to scraping: Workers AI, the Google voice proxy, the memorial lookup.
// Same logic as www (`src/libs/tibetan/server.ts`: `overLimit`, `allow`, `OverLimit`, `tooMany`).

/** Calls counted per visitor and minute in this isolate, for when the data centre cache is missing (dev). */
const counted = new Map<string, number>();

/** Thrown by `allow` when a visitor is over the allowance; the routes turn it into `tooMany()`. */
export class OverLimit extends Error {}

/** What the limiter reads from a request: only the headers (so a server component can pass `await headers()` too). */
type HasHeaders = { headers: Pick<Headers, "get"> };

/**
 * A brake on the Workers AI bill (and on the Google voice proxy), not an exact meter: more than `limit` counted calls from one
 * visitor in one minute answers 429. Same logic as www (`src/libs/tibetan/server.ts`).
 * The count lives in the cache of the data centre that serves the visitor (the one the answers are kept in): it is read and then
 * written, so a burst of simultaneous requests can slip past it, and each data centre counts apart. Only `cf-connecting-ip` is
 * trusted as the visitor (it is set by Cloudflare; other headers can be made up); without it everyone shares one bucket.
 */
export async function overLimit(request: HasHeaders, bucket: string, limit: number, now = Date.now()): Promise<boolean> {
	// An IPv6 visitor holds a whole /64 of addresses, so the count is by the /64, not by the one address in use.
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
export async function allow(request: HasHeaders, bucket: string, limit: number): Promise<void> {
	if (await overLimit(request, bucket, limit)) throw new OverLimit();
}

/** The answer to a visitor over the allowance. `answer` is there for the question box, which shows `answer` and nothing else. */
export const tooMany = () => {
	const message = "Bạn hỏi hơi nhanh, mời đợi một phút rồi thử lại.";
	return Response.json({ status: "error", message, answer: message }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
};
