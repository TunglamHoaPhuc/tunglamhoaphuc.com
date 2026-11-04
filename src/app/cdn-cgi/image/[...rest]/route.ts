// On Cloudflare, /cdn-cgi/image/ is answered at the edge before the Worker runs. This route
// runs only where that does not happen (npm run dev and preview, or if the zone's
// transformations were ever switched off) and sends the browser to the source picture, as
// onerror=redirect does. Only to this site's paths and the WordPress host imageAt() uses, so
// it is no open redirect.
const SOURCE = /^\/cdn-cgi\/image\/[^/]+\/(.+)$/;
const WORDPRESS = "https://admin.tunglamhoaphuc.com/";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const source = SOURCE.exec(url.pathname)?.[1];
	if (!source) return new Response("Not found", { status: 404 });
	if (/^https?:/.test(source)) {
		const remote = source.replace(/^https?:\/+/, "https://");
		return remote.startsWith(WORDPRESS) ? Response.redirect(remote, 302) : new Response("Not found", { status: 404 });
	}
	return Response.redirect(new URL(`/${source}`, url.origin).toString(), 302);
}
