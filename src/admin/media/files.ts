// What a file really is, read from its first bytes, never from its name or the type the browser claims.
// Only raster pictures are accepted. SVG is refused on purpose: it can carry script, and files in the
// library are served from the site's own address.
export type Sniffed = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; ext: "jpg" | "png" | "webp" | "gif"; width: number; height: number };

const le16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const be16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const be32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const ascii = (b: Uint8Array, at: number, length: number) => String.fromCharCode(...b.slice(at, at + length));

function jpegSize(b: Uint8Array): { width: number; height: number } | null {
	let at = 2;
	while (at + 9 < b.length) {
		if (b[at] !== 0xff) return null;
		const marker = b[at + 1];
		if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
			at += 2;
			continue;
		}
		const length = be16(b, at + 2);
		const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
		if (isFrame) return { height: be16(b, at + 5), width: be16(b, at + 7) };
		at += 2 + length;
	}
	return null;
}

function webpSize(b: Uint8Array): { width: number; height: number } | null {
	const kind = ascii(b, 12, 4);
	if (kind === "VP8 " && b.length >= 30) return { width: le16(b, 26) & 0x3fff, height: le16(b, 28) & 0x3fff };
	if (kind === "VP8L" && b.length >= 25) {
		const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
		return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
	}
	if (kind === "VP8X" && b.length >= 30) return { width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1, height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1 };
	return null;
}

/** The picture's kind and size, or null when it is not a JPEG, PNG, WebP or GIF that can be read. */
export function sniffImage(bytes: Uint8Array): Sniffed | null {
	if (bytes.length < 32) return null;
	let found: Omit<Sniffed, "width" | "height"> | null = null;
	let size: { width: number; height: number } | null = null;
	if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a) {
		found = { mime: "image/png", ext: "png" };
		size = { width: be32(bytes, 16), height: be32(bytes, 20) };
	} else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		found = { mime: "image/jpeg", ext: "jpg" };
		size = jpegSize(bytes);
	} else if (ascii(bytes, 0, 3) === "GIF" && (ascii(bytes, 3, 3) === "87a" || ascii(bytes, 3, 3) === "89a")) {
		found = { mime: "image/gif", ext: "gif" };
		size = { width: le16(bytes, 6), height: le16(bytes, 8) };
	} else if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
		found = { mime: "image/webp", ext: "webp" };
		size = webpSize(bytes);
	}
	if (!found || !size || size.width < 1 || size.height < 1 || size.width > 20_000 || size.height > 20_000) return null;
	return { ...found, ...size };
}

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** The frame shapes the site uses (docs/site-inventory.md 3.1) and their width / height. */
export const RATIOS: Record<string, number> = { "16:9": 16 / 9, "4:3": 4 / 3, "3:4": 3 / 4, "16:10": 16 / 10, "1:1": 1 };
