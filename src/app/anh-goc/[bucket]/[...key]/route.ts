import { serveMedia, type MediaBucket } from "@/libs/content/mediaRoute";

// Originals of the old admin's pictures, on this site's own address so that Cloudflare's image
// transformations (allowed only for sources on the zone) can resize them; imageAt() points here.
// R2 first (bucket tlhp-media, binding MEDIA), B2 / WordPress while R2 lacks one (T42c).

type Context = { params: Promise<{ bucket: string; key: string[] }> };

/** The R2 binding, or `undefined` where there is none (npm run dev). */
async function mediaBucket(): Promise<MediaBucket | undefined> {
	try {
		const workers = (await import("cloudflare:workers" as string)) as { env?: { MEDIA?: MediaBucket } };
		return workers.env?.MEDIA;
	} catch {
		return undefined;
	}
}

export async function GET(_request: Request, { params }: Context) {
	const { bucket, key } = await params;
	return serveMedia(bucket, key, await mediaBucket());
}
