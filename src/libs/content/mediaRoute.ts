import { mediaSource } from "./media";

// What /anh-goc/<bucket>/<key> answers (T42c): the picture from the private R2 bucket tlhp-media,
// or, while R2 lacks it, from B2 / WordPress. Only pictures, only the buckets of the old admin.
// B2 sends no Cache-Control, and a source cached for less than an hour is transformed with
// less effort, so the files are kept a week, at the edge and in the browser.
const WEEK = 604_800;

/** The part of an R2 bucket binding this route uses. */
export type MediaBucket = {
	get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
};

/** Fetches an original (B2 or WordPress) with the week-long edge cache. */
export type OriginFetch = (url: string) => Promise<Response>;

const NOT_FOUND = () => new Response("Not found", { status: 404 });

function pictureResponse(body: BodyInit | null, type: string): Response {
	return new Response(body, {
		headers: { "Content-Type": type, "Cache-Control": `public, max-age=${WEEK}`, "X-Content-Type-Options": "nosniff" },
	});
}

export const fetchOrigin: OriginFetch = (url) => fetch(url, { cf: { cacheEverything: true, cacheTtl: WEEK } } as RequestInit);

export async function serveMedia(bucketName: string, key: string[], bucket: MediaBucket | undefined, origin: OriginFetch = fetchOrigin): Promise<Response> {
	const source = mediaSource(bucketName, key);
	if (!source) return NOT_FOUND();

	if (bucket) {
		try {
			const object = await bucket.get(source.r2Key);
			const type = object?.httpMetadata?.contentType ?? "";
			if (object && type.startsWith("image/")) return pictureResponse(object.body, type);
		} catch (error) {
			console.error(JSON.stringify({ event: "media-r2-error", key: source.r2Key, message: error instanceof Error ? error.message : String(error) }));
		}
	}

	const upstream = await origin(source.origin);
	const type = upstream.headers.get("content-type") ?? "";
	if (!upstream.ok || !type.startsWith("image/")) return NOT_FOUND();
	return pictureResponse(upstream.body, type);
}
