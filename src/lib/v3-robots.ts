// Nội dung robots.txt theo host. Chỉ trang công khai được quét; host khác (v3., thu., workers.dev, localhost) cấm hết, khớp với
// tiêu đề `X-Robots-Tag: noindex, nofollow` của next.config.ts. Hàm thuần: src/app/robots.ts đọc host và cài đặt rồi gọi ở đây.
import type { MetadataRoute } from "next";
import { PUBLIC_ORIGIN } from "@/lib/site-url";
import { isPublicHost } from "@/lib/v3-hosts";
import { parseRobotsExtra, type RobotsExtra } from "@/lib/robots-extra";

/**
 * Không phải nội dung: kết quả tìm kiếm, ảnh qua bộ đổi cỡ, trang nội bộ, API. `/tra-cuu-bai-vi` (trang quét mã QR bài vị) và
 * `/kiem-tra-anh` (đối soát ảnh tượng) chỉ có ở V3.
 */
export const DISALLOW = ["/tim-kiem", "/cdn-cgi/", "/anh-goc/", "/styleguide", "/api/", "/tra-cuu-bai-vi", "/kiem-tra-anh"];

/** Các dòng admin thêm ở SEO > robots.txt, từ cài đặt `seo.defaults`; sai quy cách hoặc không có thì rỗng. */
export function extraFromSettings(settings: Record<string, unknown>): RobotsExtra {
	const none = { allow: [], disallow: [] };
	const defaults = settings["seo.defaults"];
	if (!defaults || typeof defaults !== "object") return none;
	const raw = (defaults as { robotsExtra?: unknown }).robotsExtra;
	if (typeof raw !== "string") return none;
	const checked = parseRobotsExtra(raw);
	return checked.ok ? checked.value : none;
}

export function buildRobots(host: string | null | undefined, extra: RobotsExtra = { allow: [], disallow: [] }): MetadataRoute.Robots {
	if (!isPublicHost(host)) return { rules: { userAgent: "*", disallow: "/" } };
	return {
		rules: {
			userAgent: "*",
			allow: extra.allow.length ? ["/", ...extra.allow] : "/",
			disallow: [...DISALLOW, ...extra.disallow],
		},
		sitemap: `${PUBLIC_ORIGIN}/sitemap.xml`,
	};
}
