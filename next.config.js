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

// Safe defaults for every page and API (PageSpeed 22/11/2026, best practices): HTTPS only
// (this host, not the subdomains), no framing by other sites, a browsing context group of
// its own. No Content-Security-Policy: the site and the admin run inline scripts and outside
// embeds (maps, YouTube), and a wrong policy would break them.
const SECURITY_HEADERS = [
	{ key: "Strict-Transport-Security", value: "max-age=31536000" },
	{ key: "X-Frame-Options", value: "SAMEORIGIN" },
	{ key: "Cross-Origin-Opener-Policy", value: "same-origin" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

// Stricter than the above, for /quan-tri and /api/quan-tri only (no Content-Security-Policy yet: it needs a nonce
// for the editor's inline styles and would break the screens if wrong).
const ADMIN_HEADERS = [
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "Referrer-Policy", value: "same-origin" },
];

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
	async headers() {
		return [
			// Only the public site may be indexed (T20): every other host (v2., quantri., local)
			// says noindex.
			{
				source: "/:path*",
				missing: [{ type: "host", value: PUBLIC_HOST }],
				headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
			},
			{ source: "/:path*", headers: SECURITY_HEADERS },
			// The admin and its API are never framed, even by this site, and send no referrer to other sites (docs 6.5).
			// Listed after the rule above: for the same header the later rule wins.
			{ source: "/quan-tri/:path*", headers: ADMIN_HEADERS },
			{ source: "/quan-tri", headers: ADMIN_HEADERS },
			{ source: "/api/quan-tri/:path*", headers: ADMIN_HEADERS },
		];
	},
};

export default nextConfig;
