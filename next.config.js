/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: false,
	// The app only runs on the v2. preview host until launch; T20 replaces this
	// with per-host robots rules before www switches over.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
			},
		];
	},
};

export default nextConfig;
