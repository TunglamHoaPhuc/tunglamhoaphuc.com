import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getContentRepository } from "@/libs/content/repository";
import { absoluteUrl, originOf, sitemapEntries } from "@/libs/seo";

// Made again at most once an hour and kept by Cloudflare's Workers Cache in between (T41e):
// building it reads every source of content.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const origin = originOf((await headers()).get("host"));
	const entries = await sitemapEntries(await getContentRepository());
	return entries.map(({ path, lastModified }) => ({ url: absoluteUrl(path, origin), ...(lastModified ? { lastModified } : {}) }));
}
