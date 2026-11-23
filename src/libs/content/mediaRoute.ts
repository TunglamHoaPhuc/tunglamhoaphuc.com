import { mediaSource, parseVariantRequest, VARIANT_WIDTHS, type VariantFormat, type VariantStep } from "./media";

// What /anh-goc/<bucket>/<key> answers (T42c): the picture from the private R2 bucket tlhp-media,
// or, while R2 lacks it, from B2 / WordPress. Only pictures, only the buckets of the old admin.
// B2 sends no Cache-Control, and a source cached for less than an hour is transformed with
// less effort, so the files are kept a week at the edge. The admin puts the version in each
// key (a new upload or crop is a new address), so browsers keep a file 30 days, and a week
// more while they check (PageSpeed 22/11/2026 asked for longer than the week it had). An old
// B2 file replaced under its own name can show old for that long.
//
// Variants (23/11/2026, docs/van-hanh/anh.md): /anh-goc/<bucket>/<key>@<width>[.avif|.webp] is the ready-made AVIF/WebP of the picture
// <bucket>/<key> that scripts/media-variants.mjs keeps in R2 under "<r2 key>@<width>.<avif|webp>" ("@max" is the biggest). Without an extension the
// Accept header picks AVIF, else WebP; a width that is not a standard one is rounded UP to the next (VARIANT_WIDTHS, "max" past 1920), so the number of
// addresses per picture stays small. Whatever is missing falls back, in this order: the same width in the other format, each larger width, the
// original (R2, then B2 / WordPress) — a variant that does not exist yet costs bytes, never a broken picture.
const WEEK = 604_800;
const MONTH = 2_592_000;
const YEAR = 31_536_000;

/** The part of an R2 bucket binding this route uses. */
export type MediaBucket = {
	get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
};

/** The part of the Workers Cache API used here (`caches.default`). */
export type MediaCache = {
	match(request: Request): Promise<Response | undefined>;
	put(request: Request, response: Response): Promise<void>;
};

/** What the route hands in from the request and the Worker; everything is optional (a test or `npm run dev` has none of it). */
export type MediaOptions = {
	/** The `Accept` header of the request: decides AVIF / WebP for a variant asked for without an extension. */
	accept?: string | null;
	/** The edge cache (`caches.default`): a 200 answer is kept under a key made of the picture, the standard width and the formats allowed. */
	cache?: MediaCache;
	/** `waitUntil` of the Worker: the cache write finishes after the answer is sent. */
	waitUntil?: (work: Promise<unknown>) => void;
	/** This site's origin, for cache keys. */
	siteOrigin?: string;
};

/** Fetches an original (B2 or WordPress) with the week-long edge cache. */
export type OriginFetch = (url: string) => Promise<Response>;

const NOT_FOUND = () => new Response("Not found", { status: 404 });

function pictureResponse(body: BodyInit | null, type: string, cacheControl = `public, max-age=${MONTH}, stale-while-revalidate=${WEEK}`, extra: Record<string, string> = {}): Response {
	return new Response(body, {
		headers: { "Content-Type": type, "Cache-Control": cacheControl, "X-Content-Type-Options": "nosniff", ...extra },
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

/** The formats a browser says it takes, best first: AVIF, then WebP. `*` and a bare `image/*` promise neither, so they get the original. */
export function acceptedFormats(accept: string | null | undefined): VariantFormat[] {
	const wanted = (type: string) =>
		(accept ?? "").split(",").some((part) => {
			const [name, ...params] = part.trim().toLowerCase().split(";");
			if (name.trim() !== type) return false;
			const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
			return !q || Number(q.slice(2)) > 0;
		});
	const formats: VariantFormat[] = [];
	if (wanted("image/avif")) formats.push("avif");
	if (wanted("image/webp")) formats.push("webp");
	return formats;
}

/** Runs `produce` unless the edge cache has the answer; keeps a 200 answer of it afterwards (after the response is sent, when the Worker allows). */
async function cached(options: MediaOptions, cacheUrl: string, produce: () => Promise<Response>): Promise<Response> {
	const { cache } = options;
	if (!cache) return produce();
	const request = new Request(cacheUrl);
	try {
		const hit = await cache.match(request);
		if (hit) return hit;
	} catch (error) {
		console.error(JSON.stringify({ event: "media-cache-error", op: "match", message: error instanceof Error ? error.message : String(error) }));
	}
	const response = await produce();
	if (response.status === 200 && response.body) {
		const keep = Promise.resolve()
			.then(() => cache.put(request, response.clone()))
			.catch((error: unknown) => console.error(JSON.stringify({ event: "media-cache-error", op: "put", message: error instanceof Error ? error.message : String(error) })));
		if (options.waitUntil) options.waitUntil(keep);
	}
	return response;
}

/** The original: R2 first, then B2 / WordPress (and one "media-fallback" line when it comes from there). `null` when neither has a picture. */
async function original(
	source: { r2Key: string; origin: string },
	bucket: MediaBucket | undefined,
	origin: OriginFetch,
	respond: (body: BodyInit | null, type: string) => Response,
): Promise<Response> {
	let reason: FallbackReason = "no-bucket";
	if (bucket) {
		reason = "r2-miss";
		try {
			const object = await bucket.get(source.r2Key);
			const type = object?.httpMetadata?.contentType ?? "";
			if (object && type.startsWith("image/")) return respond(object.body, type);
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
	return respond(upstream.body, type);
}

const encodedPath = (bucketName: string, key: string[]) => `/anh-goc/${bucketName}/${key.map(encodeURIComponent).join("/")}`;

/** The widths to try for a request at `step`: that one, then each larger standard width, then "max". */
function stepsFrom(step: VariantStep): VariantStep[] {
	if (step === "max") return ["max"];
	return [...VARIANT_WIDTHS.filter((width) => width >= step), "max"];
}

const TYPE_OF: Record<VariantFormat, string> = { avif: "image/avif", webp: "image/webp" };

async function variantResponse(
	request: NonNullable<ReturnType<typeof parseVariantRequest>>,
	source: { r2Key: string; origin: string },
	bucket: MediaBucket | undefined,
	origin: OriginFetch,
	formats: VariantFormat[],
): Promise<Response> {
	// What the answer depended on besides the address: a client without an explicit extension is answered by its Accept header.
	const vary: Record<string, string> = request.ext ? {} : { Vary: "Accept" };
	if (bucket) {
		let exact = true;
		for (const step of stepsFrom(request.step)) {
			for (const format of formats) {
				const key = `${source.r2Key}@${step}.${format}`;
				try {
					const object = await bucket.get(key);
					if (object) {
						const type = object.httpMetadata?.contentType?.startsWith("image/") ? object.httpMetadata.contentType : TYPE_OF[format];
						// The exact file is final; another width or format stands in until the right one is made, so it is checked again within a day.
						const cacheControl = exact ? `public, max-age=${YEAR}, immutable` : `public, max-age=86400, stale-while-revalidate=${WEEK}`;
						return pictureResponse(object.body, type, cacheControl, { ...vary, "X-Image-Variant": exact ? "hit" : "fallback" });
					}
				} catch (error) {
					console.error(JSON.stringify({ event: "media-r2-error", key, message: error instanceof Error ? error.message : String(error) }));
				}
				exact = false;
			}
		}
	}
	// No variant at all (or a browser that takes neither format): the original, which the next day's variants may replace.
	return original(source, bucket, origin, (body, type) =>
		pictureResponse(body, type, `public, max-age=3600, stale-while-revalidate=86400`, { ...vary, "X-Image-Variant": "miss" }),
	);
}

export async function serveMedia(
	bucketName: string,
	key: string[],
	bucket: MediaBucket | undefined,
	origin: OriginFetch = fetchOrigin,
	options: MediaOptions = {},
): Promise<Response> {
	const siteOrigin = options.siteOrigin ?? "https://www.tunglamhoaphuc.com";
	const requested = parseVariantRequest(key);
	if (requested) {
		const source = mediaSource(bucketName, requested.base);
		if (!source) return NOT_FOUND();
		const formats = requested.ext ? [requested.ext] : acceptedFormats(options.accept);
		// One cache key per (picture, standard width, extension, formats allowed): at most a handful, whatever width the request names.
		const cacheUrl = `${siteOrigin}${encodedPath(bucketName, requested.base)}@${requested.step}${requested.ext ? `.${requested.ext}` : ""}?f=${formats.join("+") || "-"}`;
		return cached(options, cacheUrl, () => variantResponse(requested, source, bucket, origin, formats));
	}

	const source = mediaSource(bucketName, key);
	if (!source) return NOT_FOUND();
	return cached(options, `${siteOrigin}${encodedPath(bucketName, key)}`, () => original(source, bucket, origin, (body, type) => pictureResponse(body, type)));
}
