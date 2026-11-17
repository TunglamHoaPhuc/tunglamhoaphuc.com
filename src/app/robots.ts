import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { mayIndex, originOf } from "@/libs/seo";

// The public site may be indexed; `v2.` and any other host may not (T20). The page header
// X-Robots-Tag says the same (next.config.js).
export default async function robots(): Promise<MetadataRoute.Robots> {
	const host = (await headers()).get("host");
	if (!mayIndex(host)) return { rules: { userAgent: "*", disallow: "/" } };
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			// Search results, pictures served through the resizer and internal pages are not content.
			disallow: ["/tim-kiem", "/cdn-cgi/", "/anh-goc/", "/styleguide", "/api/"],
		},
		sitemap: `${originOf(host)}/sitemap.xml`,
	};
}
