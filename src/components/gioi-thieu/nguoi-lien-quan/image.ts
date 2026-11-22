import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";

// Pictures of the Tiểu sử Sư Tổ page as the rest of this site draws them: B2 and WordPress
// pictures through /anh-goc/ and Cloudflare's resizing (imageAt), at the width they show at.

const WP_BASE_URL = "https://admin.tunglamhoaphuc.com";

/** A picture of the page at one of the site's widths (small 360, card 640, wide 1280, full 1920). */
export function odysseyImage(url: string, size: keyof typeof IMAGE_WIDTH = "wide"): string {
	return url ? imageAt(url, IMAGE_WIDTH[size]) : url;
}

/**
 * The old site's getImageUrl (src/utils/image.ts there): makes a full address of what the
 * editors wrote (a bare file name or a path is a WordPress upload), then draws it as above.
 */
export function getImageUrl(path?: string | null, fallbackUrl = ""): string {
	const trimmed = typeof path === "string" ? path.trim() : "";
	if (!trimmed) return fallbackUrl;
	let address: string;
	if (trimmed.includes("/images/tong-chi/")) {
		const filename = trimmed.split("/").pop() || "";
		address = filename ? `${WP_BASE_URL}/wp-content/uploads/${filename}` : trimmed;
	} else if (/^(https?:|data:|blob:)/.test(trimmed)) {
		address = trimmed;
	} else if (trimmed.startsWith("/anh-goc/") || trimmed.startsWith("/cdn-cgi/")) {
		// Already this site's own address (the repository gives pictures as /anh-goc/…).
		address = trimmed;
	} else if (trimmed.startsWith("//")) {
		address = `https:${trimmed}`;
	} else if (trimmed.startsWith("/")) {
		address = `${WP_BASE_URL}${trimmed}`;
	} else if (!trimmed.includes("/")) {
		address = `${WP_BASE_URL}/wp-content/uploads/${trimmed}`;
	} else {
		address = `${WP_BASE_URL}/${trimmed}`;
	}
	return address.startsWith("data:") || address.startsWith("blob:") ? address : odysseyImage(address, "wide");
}
