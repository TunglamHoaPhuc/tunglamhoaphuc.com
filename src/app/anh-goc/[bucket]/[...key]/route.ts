import { serveMedia, type MediaBucket, type MediaCache } from "@/libs/content/mediaRoute";

// Originals of the old admin's pictures, on this site's own address so that Cloudflare's image
// transformations (allowed only for sources on the zone) can resize them; imageAt() points here.
// R2 first (bucket tlhp-media, binding MEDIA), B2 / WordPress while R2 lacks one (T42c).
// <key>@<width>[.avif|.webp] is a ready-made variant of a picture (docs/van-hanh/anh.md); the answers are kept in the edge cache.

type Context = { params: Promise<{ bucket: string; key: string[] }> };
type Workers = { env?: { MEDIA?: MediaBucket }; waitUntil?: (work: Promise<unknown>) => void };

/** The Worker's own module (R2 binding, waitUntil), or `undefined` where there is none (npm run dev). */
async function workers(): Promise<Workers | undefined> {
	try {
		return (await import("cloudflare:workers" as string)) as Workers;
	} catch {
		return undefined;
	}
}

export async function GET(request: Request, { params }: Context) {
	const { bucket, key } = await params;
	const worker = await workers();
	const cache = (globalThis as { caches?: { default?: MediaCache } }).caches?.default;
	return serveMedia(bucket, key, worker?.env?.MEDIA, undefined, {
		accept: request.headers.get("accept"),
		cache,
		waitUntil: worker?.waitUntil ? (work) => worker.waitUntil?.(work) : undefined,
		siteOrigin: new URL(request.url).origin,
	});
}
