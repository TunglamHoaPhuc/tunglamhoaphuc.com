/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: false,
	// Only the public site may be indexed (T20): every other host (v2., quantri., local) says
	// noindex. Keep the host list in step with src/libs/hosts.ts.
	async headers() {
		return [
			{
				source: "/:path*",
				missing: [{ type: "host", value: String.raw`(www\.)?tunglamhoaphuc\.com(:\d+)?` }],
				headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
			},
		];
	},
};

export default nextConfig;
