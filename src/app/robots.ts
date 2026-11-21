import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { parseRobotsExtra } from "@/libs/robotsExtra";
import { mayIndex, originOf } from "@/libs/seo";
import { readSetting, siteDb } from "@/libs/siteDb";

// What the admin added in SEO > robots.txt (only simple Allow/Disallow lines), read when the site reads from D1.
async function extraRules(): Promise<{ allow: string[]; disallow: string[] }> {
	const none = { allow: [], disallow: [] };
	const db = await siteDb();
	if (!db) return none;
	const defaults = await readSetting<{ robotsExtra?: unknown }>(db, "seo.defaults");
	if (!defaults || typeof defaults.robotsExtra !== "string") return none;
	const checked = parseRobotsExtra(defaults.robotsExtra);
	return checked.ok ? checked.value : none;
}

// The public site may be indexed; `v2.` and any other host may not (T20). The page header
// X-Robots-Tag says the same (next.config.js).
export default async function robots(): Promise<MetadataRoute.Robots> {
	const host = (await headers()).get("host");
	if (!mayIndex(host)) return { rules: { userAgent: "*", disallow: "/" } };
	const extra = await extraRules();
	return {
		rules: {
			userAgent: "*",
			allow: extra.allow.length ? ["/", ...extra.allow] : "/",
			// Search results, pictures served through the resizer and internal pages are not content.
			disallow: ["/tim-kiem", "/cdn-cgi/", "/anh-goc/", "/styleguide", "/api/", ...extra.disallow],
		},
		sitemap: `${originOf(host)}/sitemap.xml`,
	};
}
