import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getSettings } from "@/lib/tlhp-site/siteData";
import { isPublicHost } from "@/lib/v3-hosts";
import { buildRobots, extraFromSettings } from "@/lib/v3-robots";

// Trang công khai được quét; v3. và mọi host khác thì không (tiêu đề X-Robots-Tag của next.config.ts nói giống vậy).
export default async function robots(): Promise<MetadataRoute.Robots> {
	const host = (await headers()).get("host");
	// Chỉ trang công khai mới cần cài đặt của admin (SEO > robots.txt); host khác khỏi đọc D1.
	const extra = isPublicHost(host) ? extraFromSettings(await getSettings().catch(() => ({}))) : undefined;
	return buildRobots(host, extra);
}
