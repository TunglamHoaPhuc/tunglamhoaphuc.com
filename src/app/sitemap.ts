import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";
import { sitemapEntries } from "@/lib/v3-sitemap";

// Dựng lại tối đa mỗi giờ và được Workers Cache giữ giữa các lần: dựng phải đọc mọi nguồn nội dung. Không đọc host của yêu
// cầu nên cache dùng chung; địa chỉ luôn là địa chỉ công khai https://www..., kể cả khi mở từ v3.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const entries = await sitemapEntries();
	return entries.map(({ path, lastModified }) => ({ url: absoluteUrl(path), ...(lastModified ? { lastModified } : {}) }));
}
