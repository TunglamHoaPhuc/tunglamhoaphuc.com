// The public hosts, as a has/missing condition. Keep in step with src/libs/hosts.ts.
const PUBLIC_HOST = String.raw`(www\.)?tunglamhoaphuc\.com(:\d+)?`;
const BARE_HOST = String.raw`tunglamhoaphuc\.com(:\d+)?`;

// The old site's admin moves to quantri. behind Cloudflare Access (T21). Once www runs this
// app (T22), its old addresses lead there, so bookmarks and the login page keep working.
// Only on the public host, and temporary (307): the new admin (T27) takes /admin back.
const OLD_ADMIN_PATHS = ["/admin", "/login", "/van-hanh"];
const oldAdminRedirects = OLD_ADMIN_PATHS.flatMap((path) => [
	{ source: path, has: [{ type: "host", value: PUBLIC_HOST }], destination: `https://quantri.tunglamhoaphuc.com${path}`, permanent: false },
	{ source: `${path}/:rest*`, has: [{ type: "host", value: PUBLIC_HOST }], destination: `https://quantri.tunglamhoaphuc.com${path}/:rest*`, permanent: false },
]);

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: false,
	async redirects() {
		return [
			// The bare domain goes to www, as the old site's host (Vercel) did. vinext does not carry the
			// query string to another origin, so ?q=… is lost here: a Redirect Rule at Cloudflare that
			// keeps the query is the better door (docs/van-hanh/chuyen-www.md); this is the fallback.
			{ source: "/:path*", has: [{ type: "host", value: BARE_HOST }], destination: "https://www.tunglamhoaphuc.com/:path*", permanent: true },
			...oldAdminRedirects,
		];
	},
	// Only the public site may be indexed (T20): every other host (v2., quantri., local) says
	// noindex.
	async headers() {
		return [
			{
				source: "/:path*",
				missing: [{ type: "host", value: PUBLIC_HOST }],
				headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
			},
		];
	},
};

export default nextConfig;
