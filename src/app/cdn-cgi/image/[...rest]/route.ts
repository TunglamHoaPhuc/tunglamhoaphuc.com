// On Cloudflare, /cdn-cgi/image/ is answered at the edge before the Worker runs. This route
// runs only where that does not happen (npm run dev and preview, or if the zone's
// transformations were ever switched off) and sends the browser to the source picture, as
// onerror=redirect does. Only to this site's own paths (imageAt() sources are always /anh-goc/...),
// so it is no open redirect and never leaves the site.
const SOURCE = /^\/cdn-cgi\/image\/[^/]+\/(.+)$/;

export async function GET(request: Request) {
	const url = new URL(request.url);
	const source = SOURCE.exec(url.pathname)?.[1];
	if (!source) return new Response("Not found", { status: 404 });
	// A source on another host is never answered: every picture is on this site.
	if (/^https?:/.test(source)) return new Response("Not found", { status: 404 });
	// "w=1//evil.example/x" leaves source "/evil.example/x"; "/" + that is protocol-relative. Drop the
	// leading slashes and keep the answer on this site.
	const target = new URL(`/${source.replace(/^[/\\]+/, "")}`, url.origin);
	if (target.origin !== url.origin) return new Response("Not found", { status: 404 });
	return Response.redirect(target.toString(), 302);
}
