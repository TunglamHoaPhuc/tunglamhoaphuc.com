import { b2Source } from "@/libs/content/media";

// Originals of the old admin's B2 pictures, on this site's own address so that Cloudflare's
// image transformations (allowed only for sources on the zone) can resize them; imageAt()
// points here. Only the two buckets of the old admin, and only pictures. B2 sends no
// Cache-Control, and a source cached for less than an hour is transformed with less effort,
// so the files are kept a week, at the edge and in the browser.
const WEEK = 604_800;

type Context = { params: Promise<{ bucket: string; key: string[] }> };

export async function GET(_request: Request, { params }: Context) {
	const { bucket, key } = await params;
	const source = b2Source(bucket, key);
	if (!source) return new Response("Not found", { status: 404 });

	const upstream = await fetch(source, { cf: { cacheEverything: true, cacheTtl: WEEK } });
	const type = upstream.headers.get("content-type") ?? "";
	if (!upstream.ok || !type.startsWith("image/")) return new Response("Not found", { status: 404 });

	return new Response(upstream.body, {
		headers: {
			"Content-Type": type,
			"Cache-Control": `public, max-age=${WEEK}`,
			"X-Content-Type-Options": "nosniff",
		},
	});
}
