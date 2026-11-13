// Every image and media link of the old site goes through mediaUrl(), so moving the files
// (to R2 behind media.tunglamhoaphuc.com) means changing MEDIA_BASE and nothing else.
//
// The old admin points at the same B2 bucket two ways, plus WordPress:
//   https://s2-cnv03.s3.us-east-005.backblazeb2.com/<key>          (S3 address)
//   https://b1.congngheviet.com.vn/file/s2-cnv03/<key>              (B2 friendly address on a
//   https://f005.backblazeb2.com/file/s2-cnv03/<key>                 vendor's domain, or B2's own)
//   https://admin.tunglamhoaphuc.com/wp-content/uploads/…           (WordPress, not copied to B2)

const B2_BUCKET = "s2-cnv03";
const B2_S3_HOST = `${B2_BUCKET}.s3.us-east-005.backblazeb2.com`;
const B2_FRIENDLY_HOST = /^(b1\.congngheviet\.com\.vn|f\d{3}\.backblazeb2\.com)$/;
const WORDPRESS_HOST = "admin.tunglamhoaphuc.com";
// Once the new site takes over www and the bare domain, their /wp-content/ links only
// keep working on the WordPress host.
const MOVING_HOSTS = new Set(["tunglamhoaphuc.com", "www.tunglamhoaphuc.com"]);

/** Where B2 objects are served from. */
export const MEDIA_BASE = `https://${B2_S3_HOST}`;

function parse(url: string | null | undefined): URL | null {
	const value = url?.trim();
	if (!value) return null;
	try {
		return new URL(value.startsWith("//") ? `https:${value}` : value);
	} catch {
		return null;
	}
}

/** The object key in the B2 bucket, or `null` when the file is not on B2. */
export function mediaKey(url: string | null | undefined): string | null {
	const parsed = parse(url);
	if (!parsed) return null;
	if (parsed.host === B2_S3_HOST) return parsed.pathname.slice(1) || null;
	const prefix = `/file/${B2_BUCKET}/`;
	if (B2_FRIENDLY_HOST.test(parsed.host) && parsed.pathname.startsWith(prefix)) {
		return parsed.pathname.slice(prefix.length) || null;
	}
	return null;
}

/** True for links that stop working once www moves to the new site (see MOVING_HOSTS). */
export function isMovingLink(url: string | null | undefined): boolean {
	const parsed = parse(url);
	return !!parsed && MOVING_HOSTS.has(parsed.host) && parsed.pathname.startsWith("/wp-content/");
}

/**
 * The address to use for an image or media file of the old site: B2 files on MEDIA_BASE,
 * WordPress uploads on the WordPress host, anything else upgraded to https. Paths on this
 * site ("/brand/…") are kept. `null` for an empty or unreadable value.
 */
export function mediaUrl(url: string | null | undefined): string | null {
	const value = url?.trim();
	if (!value) return null;
	if (value.startsWith("/") && !value.startsWith("//")) return value;

	const parsed = parse(value);
	if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) return null;

	const key = mediaKey(value);
	if (key) return `${MEDIA_BASE}/${key}`;

	if (isMovingLink(value)) parsed.host = WORDPRESS_HOST;
	parsed.protocol = "https:";
	return parsed.toString();
}

// The two buckets the old admin uploads to, read through /anh-goc/<bucket>/<key> on this site.
const B2_BUCKETS = new Set([B2_BUCKET, "media-tunglamhoaphuc"]);
const B2_HOST = /^([a-z0-9-]+)\.s3\.us-east-005\.backblazeb2\.com$/;

/** The B2 address /anh-goc/ reads for a bucket and key, or `null` for any other bucket or a bad key. */
export function b2Source(bucket: string, key: string[]): string | null {
	if (!B2_BUCKETS.has(bucket) || !key.length || key.some((part) => !part || part === "." || part === "..")) return null;
	return `https://${bucket}.s3.us-east-005.backblazeb2.com/${key.map(encodeURIComponent).join("/")}`;
}

/** The source of a transformation on this zone: B2 files through /anh-goc/, WordPress in place. */
function transformSource(src: string): string | null {
	const parsed = parse(src);
	if (!parsed) return null;
	const bucket = B2_HOST.exec(parsed.host)?.[1];
	if (bucket && B2_BUCKETS.has(bucket)) return `anh-goc/${bucket}${parsed.pathname}`;
	return parsed.host === WORDPRESS_HOST ? parsed.toString() : null;
}

/**
 * A picture of the old site at `width` pixels, through Cloudflare's image transformations on
 * this zone (AVIF or WebP as the browser takes). The old admin keeps camera originals of
 * 7–9 MB; at 640 px one is about 25 KB. The zone accepts only sources on itself, which is why
 * B2 files come through /anh-goc/. Past the free 5,000 transformations a month, onerror=redirect
 * sends the browser to the original. The site's own pictures and other hosts stay as they are.
 */
export function imageAt(src: string, width: number): string {
	if (src.startsWith("/") && !src.startsWith("//")) return src;
	const source = transformSource(src);
	return source ? `/cdn-cgi/image/width=${width},quality=75,format=auto,onerror=redirect/${source}` : src;
}

/**
 * Album pictures: only WordPress uploads are transformed. The B2 album pictures were made
 * small already (median 92 KB), and an album of 170 would spend the monthly quota.
 */
export function albumImageAt(src: string, width: number): string {
	return isWordPressMedia(src) ? imageAt(src, width) : src;
}

/** Display widths of transformed pictures; few on purpose, each one counts against the quota. */
export const IMAGE_WIDTH = { small: 360, card: 640, wide: 1280, full: 1920 } as const;

/**
 * `srcSet` of a transformed picture at the given widths, for pictures shown much smaller than
 * 640 px on phones (a statue card is about 185 px there: 324 device pixels at Lighthouse's 1.75, so 360, T41b). `undefined` for pictures that
 * are not transformed, which come in one size.
 */
export function imageSrcSet(src: string, widths: readonly number[]): string | undefined {
	if (imageAt(src, widths[0]) === src) return undefined;
	return widths.map((width) => `${imageAt(src, width)} ${width}w`).join(", ");
}

/**
 * How eagerly to fetch the picture at the top of a page. Only the site's own pictures go first.
 * The old site's photos can be camera originals of 7–9 MB, and asked for first they keep the
 * whole page waiting (an article took 47.9 s to show on a phone); a transformed one is small,
 * but past the monthly quota it falls back to the original. "low" also keeps React from
 * preloading them.
 */
export function topImagePriority(src: string): "high" | "low" {
	return src.startsWith("/") && !src.startsWith("//") && !src.startsWith("/cdn-cgi/") ? "high" : "low";
}

/** Facebook's emoji pictures, pasted into a few posts along with the text. Not photos. */
export function isEmojiImage(url: string | null | undefined): boolean {
	const parsed = parse(url);
	return !!parsed && parsed.host.endsWith(".fbcdn.net") && parsed.pathname.startsWith("/images/emoji.php/");
}

/** True for WordPress uploads, which disappear if WordPress is ever switched off. */
export function isWordPressMedia(url: string | null | undefined): boolean {
	return parse(mediaUrl(url))?.host === WORDPRESS_HOST;
}

/**
 * WordPress uploads always sit in a year/month folder (…/uploads/2026/07/x.jpg). The Tông Chỉ
 * editors typed addresses without one (…/uploads/niem-phat.jpg) for pictures still to come;
 * none of those exist (22 of 22 answered 404 on 03/11/2026), so they count as no picture.
 */
export function isUnsavedUpload(url: string | null | undefined): boolean {
	const parsed = parse(mediaUrl(url));
	return !!parsed && parsed.host === WORDPRESS_HOST && /^\/wp-content\/uploads\/[^/]+$/.test(parsed.pathname);
}
