// Địa chỉ công khai của trang: mọi liên kết nằm trong dữ liệu sống lâu hơn một yêu cầu (canonical, og:url, og:image, JSON-LD,
// sitemap) trỏ về đây, không bao giờ về v3. hay host xem thử. Khớp với `PUBLIC_ORIGIN` của www (src/libs/seo.ts).
import { isPublicHost } from "@/lib/v3-hosts";

/** Nơi trang công khai sống. */
export const PUBLIC_ORIGIN = "https://www.tunglamhoaphuc.com";
export const SITE_NAME = "Tùng Lâm Hòa Phúc";

/** `https://<host>` của một yêu cầu; host trống thì về trang công khai. Host cục bộ nói http. */
export function originOf(host: string | null | undefined): string {
	const name = (host ?? "").trim().toLowerCase();
	if (!name) return PUBLIC_ORIGIN;
	return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(name) ? `http://${name}` : `https://${name}`;
}

/** Máy tìm kiếm chỉ được lập chỉ mục trang công khai. */
export const mayIndex = isPublicHost;

/**
 * Địa chỉ tuyệt đối: ký tự ngoài ASCII được mã hóa phần trăm, phần đã mã hóa giữ nguyên nhưng viết hoa (%f0 → %F0), để địa chỉ
 * trong sitemap, canonical và og:url của cùng một trang giống nhau từng ký tự (một số slug biểu tượng cảm xúc lưu chữ thường).
 */
export function absoluteUrl(path: string, origin: string = PUBLIC_ORIGIN): string {
	return new URL(path, origin).href.replace(/%[0-9a-f]{2}/gi, (escape) => escape.toUpperCase());
}

/**
 * Địa chỉ cũ mà next.config.ts chuyển hướng cố định sang địa chỉ khác. Sitemap và canonical dùng địa chỉ MỚI; tests/unit kiểm mỗi
 * khóa ở đây là một luật chuyển hướng của next.config.ts.
 */
export const MOVED_PATHS: Readonly<Record<string, string>> = {
	"/tong-chi-tu-hoc/tong-phong-truyen-thua-truc-lam": "/tong-chi-tu-hoc/tiep-buoc-thay-toi",
};

/** Đường dẫn chuẩn của một trang: địa chỉ cũ đã chuyển thì thành địa chỉ mới, còn lại giữ nguyên. */
export function canonicalPath(path: string): string {
	return MOVED_PATHS[path] ?? path;
}

/** Canonical tuyệt đối trên host công khai, không chuỗi truy vấn, không dấu `/` cuối (trừ trang chủ). */
export function canonicalUrl(path: string): string {
	const clean = canonicalPath(path.split(/[?#]/)[0]);
	return absoluteUrl(clean.length > 1 ? clean.replace(/\/+$/, "") : clean);
}
