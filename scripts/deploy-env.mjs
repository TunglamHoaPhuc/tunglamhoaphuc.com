// What `npm run deploy:v2` checks in its environment before it builds, kept apart from the script so a test can run it.
//
// cloudflare.config.ts bakes ADMIN_BASE_URL into the build and, when it is not set, falls back to http://localhost:3001: a
// deploy made that way answers 503 or "wrong host" on every admin address, and the admin only answers on the host named
// here. So a deploy of the admin (TLHP_ADMIN=1) must name its address, https and nothing but the origin.

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ errors: string[]; warnings: string[]; adminBaseUrl: string | null }}
 */
export function checkDeployEnv(env) {
	const errors = [];
	const warnings = [];
	if (env.TLHP_ADMIN !== "1") {
		warnings.push("TLHP_ADMIN no phải 1: bản này không có admin, /quan-tri và /api/quan-tri sẽ trả 503. Admin cần: TLHP_ADMIN=1 ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com");
		return { errors, warnings, adminBaseUrl: null };
	}
	const raw = (env.ADMIN_BASE_URL ?? "").trim();
	if (!raw) {
		errors.push("Thiếu ADMIN_BASE_URL: nếu không có, bản build ghi http://localhost:3001 và admin không trả lời ở đâu cả. Đặt ADMIN_BASE_URL=https://quantri.tunglamhoaphuc.com");
		return { errors, warnings, adminBaseUrl: null };
	}
	let url;
	try {
		url = new URL(raw);
	} catch {
		errors.push(`ADMIN_BASE_URL không phải địa chỉ hợp lệ: ${raw}`);
		return { errors, warnings, adminBaseUrl: null };
	}
	if (url.protocol !== "https:") errors.push(`ADMIN_BASE_URL phải bắt đầu bằng https:// (đang là ${url.protocol}//): cookie __Host- chỉ chạy trên https`);
	if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) errors.push("ADMIN_BASE_URL đang trỏ về máy cục bộ: không đưa vào bản deploy");
	if (url.pathname !== "/" || url.search || url.hash) errors.push(`ADMIN_BASE_URL chỉ gồm địa chỉ gốc (https://host), không có đường dẫn: ${raw}`);
	if (url.hostname === "www.tunglamhoaphuc.com" || url.hostname === "tunglamhoaphuc.com") {
		warnings.push("ADMIN_BASE_URL vẫn là www: chỉ đúng khi Worker này còn phục vụ www. Sau khi V3 làm trang chính, admin ở https://quantri.tunglamhoaphuc.com");
	}
	return { errors, warnings, adminBaseUrl: errors.length ? null : url.origin };
}
