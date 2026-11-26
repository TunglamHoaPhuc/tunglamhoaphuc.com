// On Cloudflare, /cdn-cgi/image/ is answered at the edge before the Worker runs. This route
// runs only where that does not happen (npm run dev and preview, or if the zone's
// transformations were ever switched off) and sends the browser to the source picture, as
// onerror=redirect does. Only to this site's paths and the WordPress host imageAt() uses, so
// it is no open redirect.
import { warnFallback } from "@/libs/content/mediaRoute";

const SOURCE = /^\/cdn-cgi\/image\/[^/]+\/(.+)$/;
const WORDPRESS = "https://admin.tunglamhoaphuc.com/";

export async function GET(request: Request) {
	const url = new URL(request.url);
	const source = SOURCE.exec(url.pathname)?.[1];
	if (!source) return new Response("Not found", { status: 404 });
	if (/^https?:/.test(source)) {
		const remote = source.replace(/^https?:\/+/, "https://");
		if (!remote.startsWith(WORDPRESS)) return new Response("Not found", { status: 404 });
		// A picture that is still asked of the old WordPress host (to go once every picture is in R2): Workers Logs counts these lines.
		warnFallback("cdn-image", remote.slice(WORDPRESS.length), remote);
		return Response.redirect(remote, 302);
	}
	// "w=1//evil.example/x" leaves source "/evil.example/x"; "/" + that is protocol-relative. Drop the
	// leading slashes and keep the answer on this site.
	const target = new URL(`/${source.replace(/^[/\\]+/, "")}`, url.origin);
	if (target.origin !== url.origin) return new Response("Not found", { status: 404 });
	return Response.redirect(target.toString(), 302);
}
