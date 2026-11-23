import { mediaSource } from "./media";

// What /anh-goc/<bucket>/<key> answers (T42c): the picture from the private R2 bucket tlhp-media,
// or, while R2 lacks it, from B2 / WordPress. Only pictures, only the buckets of the old admin.
// B2 sends no Cache-Control, and a source cached for less than an hour is transformed with
// less effort, so the files are kept a week at the edge. The admin puts the version in each
// key (a new upload or crop is a new address), so browsers keep a file 30 days, and a week
// more while they check (PageSpeed 22/11/2026 asked for longer than the week it had). An old
// B2 file replaced under its own name can show old for that long.
const WEEK = 604_800;
const MONTH = 2_592_000;

/** The part of an R2 bucket binding this route uses. */
export type MediaBucket = {
	get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
};

/** Fetches an original (B2 or WordPress) with the week-long edge cache. */
export type OriginFetch = (url: string) => Promise<Response>;

const NOT_FOUND = () => new Response("Not found", { status: 404 });

function pictureResponse(body: BodyInit | null, type: string): Response {
	return new Response(body, {
		headers: { "Content-Type": type, "Cache-Control": `public, max-age=${MONTH}, stale-while-revalidate=${WEEK}`, "X-Content-Type-Options": "nosniff" },
	});
}

export type FallbackReason = "no-bucket" | "r2-miss" | "r2-not-image" | "r2-error";

/**
 * Every picture is meant to live in R2 only. Each time the route has to go to B2 / WordPress instead, it writes one JSON line (event
 * "media-fallback", with the R2 key it lacked) that Workers Logs can count and list; when a week or two pass with none, the fallback
 * (mediaSource().origin, fetchOrigin) can go. Asked before the original is fetched, so a 404 there is counted too.
 */
export function warnFallback(reason: FallbackReason | "cdn-image", key: string, origin: string): void {
	let host = "";
	try {
		host = new URL(origin).host;
	} catch {
		// an origin that is no address: the line still names the key
	}
	console.warn(JSON.stringify({ event: "media-fallback", reason, key, host }));
}

export const fetchOrigin: OriginFetch = (url) => fetch(url, { cf: { cacheEverything: true, cacheTtl: WEEK } } as RequestInit);

export async function serveMedia(bucketName: string, key: string[], bucket: MediaBucket | undefined, origin: OriginFetch = fetchOrigin): Promise<Response> {
	const source = mediaSource(bucketName, key);
	if (!source) return NOT_FOUND();

	let reason: FallbackReason = "no-bucket";
	if (bucket) {
		reason = "r2-miss";
		try {
			const object = await bucket.get(source.r2Key);
			const type = object?.httpMetadata?.contentType ?? "";
			if (object && type.startsWith("image/")) return pictureResponse(object.body, type);
			if (object) reason = "r2-not-image";
		} catch (error) {
			reason = "r2-error";
			console.error(JSON.stringify({ event: "media-r2-error", key: source.r2Key, message: error instanceof Error ? error.message : String(error) }));
		}
	}

	warnFallback(reason, source.r2Key, source.origin);
	const upstream = await origin(source.origin);
	const type = upstream.headers.get("content-type") ?? "";
	if (!upstream.ok || !type.startsWith("image/")) return NOT_FOUND();
	return pictureResponse(upstream.body, type);
}
