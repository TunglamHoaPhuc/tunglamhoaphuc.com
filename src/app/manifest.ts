import type { MetadataRoute } from "next";
import { site } from "@/config/site";

// "Add to home screen" on a phone: the temple's name, the dark ground of the site and its seal.
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: site.name,
		short_name: site.name,
		description: site.slogan,
		lang: "vi",
		start_url: "/",
		display: "standalone",
		background_color: "#1a120b",
		theme_color: "#1a120b",
		icons: [
			{ src: "/brand/favicon/icon-192x192.png", sizes: "192x192", type: "image/png" },
			{ src: "/brand/favicon/icon-512x512.png", sizes: "512x512", type: "image/png" },
		],
	};
}
