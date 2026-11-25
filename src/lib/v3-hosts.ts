// Những host phục vụ trang công khai của chùa. Chỉ hai host này được lập chỉ mục; mọi host khác (v3., thu., *.workers.dev,
// localhost) là bản xem thử và luôn nói noindex. Chép từ src/libs/hosts.ts của www (E:\tlhp-av3) để hai bản cùng một quy tắc.
//
// `PUBLIC_HOST` và `BARE_HOST` là chuỗi regex cho điều kiện `has`/`missing` kiểu host của next.config.ts. next.config.ts không
// nhập tệp này (trình nạp cấu hình không chắc theo được đường dẫn `@/`), mà giữ bản chép; tests/unit/v3-next-config.test.ts
// kiểm hai bản khớp nhau.
const PUBLIC_HOSTS = new Set(["www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]);

/** Host chính: mọi đường dẫn của tên miền gốc chuyển về đây. */
export const CANONICAL_HOST = "www.tunglamhoaphuc.com";
/** Host của admin CMS (Worker khác, tlhp-web). */
export const ADMIN_HOST = "quantri.tunglamhoaphuc.com";

/** Regex (không neo) của hai host công khai, có hoặc không có cổng. */
export const PUBLIC_HOST = String.raw`(www\.)?tunglamhoaphuc\.com(:\d+)?`;
/** Regex (không neo) của tên miền gốc không có www. */
export const BARE_HOST = String.raw`tunglamhoaphuc\.com(:\d+)?`;

/** Host của một yêu cầu, viết thường, bỏ cổng và dấu chấm cuối. */
export function normalizeHost(host: string | null | undefined): string {
	return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/** Chỉ www và tên miền gốc được lập chỉ mục; `null`/rỗng coi như không phải. */
export function isPublicHost(host: string | null | undefined): boolean {
	return PUBLIC_HOSTS.has(normalizeHost(host));
}
