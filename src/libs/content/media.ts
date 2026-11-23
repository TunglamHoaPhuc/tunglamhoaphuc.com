// Every image and media link of the old site goes through mediaUrl(). Pictures come out as
// /anh-goc/<bucket>/<key> on this site (T42c): the route reads them from the private R2 bucket
// tlhp-media and falls back to B2 / WordPress only while R2 lacks one, so browsers never see a
// B2 or WordPress address for a picture. Files that are not pictures (audio, PDF) keep their
// original address.
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

/** Where pictures of the main B2 bucket are served from: this site's /anh-goc/ route. */
export const MEDIA_BASE = `/anh-goc/${B2_BUCKET}`;
const WORDPRESS_BASE = "/anh-goc/wordpress";
const IMAGE_FILE = /\.(jpe?g|jfif|png|gif|webp|avif|svg)$/i;
const isImagePath = (path: string) => IMAGE_FILE.test(path.split(/[?#]/)[0]);

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
	const own = `${MEDIA_BASE}/`;
	if (url?.startsWith(own)) return url.slice(own.length) || null;
	const parsed = parse(url);
	if (!parsed) return null;
	if (parsed.host === B2_S3_HOST) return parsed.pathname.slice(1) || null;
	const prefix = `/file/${B2_BUCKET}/`;
	if (B2_FRIENDLY_HOST.test(parsed.host) && parsed.pathname.startsWith(prefix)) {
		return parsed.pathname.slice(prefix.length) || null;
	}
	return null;
}

/**
 * The address a picture is filed under in the `media` table (T42d): the one it had when D1 was first
 * filled on 17/11/2026, before /anh-goc/ (T42c) changed what mediaUrl() gives. It is the B2 address of
 * the key, the WordPress address of an upload, or the address itself for anything else, whatever
 * form the source writes it in, so changing how the site draws a picture never changes the row's id.
 * `null` for an empty or unreadable value.
 */
export function storedMediaAddress(url: string | null | undefined): string | null {
	const address = knownMediaUrl(url);
	if (!address?.startsWith(`${ANH_GOC}/`)) return address;
	const [bucket, ...rest] = address.slice(ANH_GOC.length + 1).split("/");
	const path = rest.join("/");
	if (!bucket || !path) return address;
	if (bucket === "wordpress") return `https://${WORDPRESS_HOST}/wp-content/uploads/${path}`;
	return `https://${bucket}.s3.us-east-005.backblazeb2.com/${path}`;
}

const ANH_GOC = "/anh-goc";

/** True for links that stop working once www moves to the new site (see MOVING_HOSTS). */
export function isMovingLink(url: string | null | undefined): boolean {
	const parsed = parse(url);
	return !!parsed && MOVING_HOSTS.has(parsed.host) && parsed.pathname.startsWith("/wp-content/");
}

/** The path after /wp-content/uploads/ of a WordPress upload (own /anh-goc/wordpress/ address or the old hosts), else `null`. */
function wordpressPath(url: string | null | undefined): string | null {
	const value = url?.trim();
	if (!value) return null;
	if (value.startsWith(`${WORDPRESS_BASE}/`)) return value.slice(WORDPRESS_BASE.length + 1) || null;
	const parsed = parse(value);
	const prefix = "/wp-content/uploads/";
	if (!parsed || (parsed.host !== WORDPRESS_HOST && !MOVING_HOSTS.has(parsed.host)) || !parsed.pathname.startsWith(prefix)) return null;
	return parsed.pathname.slice(prefix.length) || null;
}

/**
 * The address to use for an image or media file of the old site. Pictures on B2 and WordPress
 * come out as /anh-goc/… on this site; other files stay on B2 or the WordPress host, anything
 * else upgraded to https. Paths on this site ("/brand/…") are kept. `null` for an empty or
 * unreadable value.
 */
export function mediaUrl(url: string | null | undefined): string | null {
	return legacyPicturePath(url) ?? knownMediaUrl(url);
}

// Hosts of this very site: a picture written with one of them in front is the same /anh-goc/ path.
const OWN_HOSTS = new Set(["tunglamhoaphuc.com", "www.tunglamhoaphuc.com", "quantri.tunglamhoaphuc.com", "v2.tunglamhoaphuc.com", "v3.tunglamhoaphuc.com"]);
// The old WordPress server answered on these hosts too (admin. is the one the data names).
const WORDPRESS_HOSTS = new Set([WORDPRESS_HOST, "old.tunglamhoaphuc.com"]);
// Backblaze's S3 path style (s3.us-east-005.backblazeb2.com/<bucket>/<key>) and its friendly style (…/file/<bucket>/<key>).
const B2_PATH_HOST = /^(s3\.us-east-005\.backblazeb2\.com|b1\.congngheviet\.com\.vn|f\d{3}\.backblazeb2\.com)$/;

/**
 * The /anh-goc/ path of a picture written as an absolute address that maps to it with certainty and that knownMediaUrl() leaves alone:
 * this site's own host in front of an /anh-goc/ path, the second WordPress host (old.), and Backblaze's path-style and friendly addresses
 * of either bucket. `null` for anything else, which keeps its address (hosts that cannot be mapped are not guessed at). Not used for
 * storedMediaAddress(): a media row's id is the hash of the address it was filed under, and these forms never changed it.
 */
export function legacyPicturePath(url: string | null | undefined): string | null {
	const value = url?.trim();
	if (!value || (value.startsWith("/") && !value.startsWith("//"))) return null;
	const parsed = parse(value);
	if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return null;
	const host = parsed.hostname.toLowerCase();
	const path = parsed.pathname;
	if (OWN_HOSTS.has(host) && path.startsWith(`${ANH_GOC}/`)) return path;
	if (WORDPRESS_HOSTS.has(host) && host !== WORDPRESS_HOST && path.startsWith("/wp-content/uploads/")) {
		const upload = path.slice("/wp-content/uploads/".length);
		return upload && isImagePath(upload) ? `${WORDPRESS_BASE}/${upload}` : null;
	}
	if (B2_PATH_HOST.test(host)) {
		const [, first, second, ...rest] = path.split("/");
		const pathStyle = host === "s3.us-east-005.backblazeb2.com";
		if (!pathStyle && first !== "file") return null;
		const bucket = pathStyle ? first : second;
		const key = pathStyle ? [second, ...rest] : rest;
		if (bucket && B2_BUCKETS.has(bucket) && key.length > 0 && key.every(Boolean) && isImagePath(key[key.length - 1])) return `${ANH_GOC}/${bucket}/${key.join("/")}`;
	}
	return null;
}

function knownMediaUrl(url: string | null | undefined): string | null {
	const value = url?.trim();
	if (!value) return null;
	if (value.startsWith("/") && !value.startsWith("//")) return value;

	const parsed = parse(value);
	if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) return null;

	const key = mediaKey(value);
	if (key) return isImagePath(key) ? `${MEDIA_BASE}/${key}` : `https://${B2_S3_HOST}/${key}`;

	const bucket = B2_HOST.exec(parsed.host)?.[1];
	if (bucket && B2_BUCKETS.has(bucket) && isImagePath(parsed.pathname)) return `/anh-goc/${bucket}${parsed.pathname}`;

	const upload = wordpressPath(value);
	if (upload !== null && isImagePath(upload)) return `${WORDPRESS_BASE}/${upload}`;

	if (isMovingLink(value)) parsed.host = WORDPRESS_HOST;
	parsed.protocol = "https:";
	return parsed.toString();
}

// The two buckets the old admin uploads to, read through /anh-goc/<bucket>/<key> on this site.
const B2_BUCKETS = new Set([B2_BUCKET, "media-tunglamhoaphuc"]);
const B2_HOST = /^([a-z0-9-]+)\.s3\.us-east-005\.backblazeb2\.com$/;

const validKey = (key: string[]) => key.length > 0 && key.every((part) => part && part !== "." && part !== "..");

/** The B2 address /anh-goc/ reads for a bucket and key, or `null` for any other bucket or a bad key. */
export function b2Source(bucket: string, key: string[]): string | null {
	if (!B2_BUCKETS.has(bucket) || !validKey(key)) return null;
	return `https://${bucket}.s3.us-east-005.backblazeb2.com/${key.map(encodeURIComponent).join("/")}`;
}

/**
 * What /anh-goc/<bucket>/<key> reads: the key in the R2 bucket tlhp-media (the path itself
 * for the B2 buckets, `wordpress/<path>` for WordPress uploads) and the original address to
 * fall back to while R2 lacks the file. `null` for any other bucket, a bad key, or a file
 * that is not a picture.
 */
export function mediaSource(bucket: string, key: string[]): { r2Key: string; origin: string } | null {
	if (!validKey(key) || !isImagePath(key[key.length - 1])) return null;
	if (bucket === "wordpress") {
		return { r2Key: `wordpress/${key.join("/")}`, origin: `https://${WORDPRESS_HOST}/wp-content/uploads/${key.map(encodeURIComponent).join("/")}` };
	}
	const origin = b2Source(bucket, key);
	return origin ? { r2Key: `${bucket}/${key.join("/")}`, origin } : null;
}

/**
 * How pictures reach the browser (23/11/2026, docs/van-hanh/anh.md):
 *  - "cgi": Cloudflare's image transformations on this zone, /cdn-cgi/image/width=…/anh-goc/… (the zone has 5,000 free ones a month);
 *  - "variants": ready-made AVIF/WebP files kept in R2 next to the original (scripts/media-variants.mjs), asked for as
 *    /anh-goc/<bucket>/<key>@<width> and chosen by the Accept header (serveMedia). A missing variant falls back to a larger one and in the
 *    end to the original, so flipping this before every variant exists only costs bytes, never a broken picture.
 * The one place to flip it: change this constant (rolling back is the same line). Every function below also takes the mode as its last
 * argument, which is how the tests exercise both.
 */
export type ImageDelivery = "cgi" | "variants";
export const IMAGE_DELIVERY: ImageDelivery = "variants";

/**
 * Where ready-made variants exist today (first batch of 23/11/2026, scripts/media-variants.mjs): R2 key prefixes. A picture outside them keeps
 * going through /cdn-cgi/image until its variants are made; a missing variant would only cost the route up to 14 R2 reads (then an hour in the
 * edge cache), so the list is widened as batches are generated, never to "everything" before they exist.
 */
export const VARIANT_PREFIXES = ["media-tunglamhoaphuc/", "s2-cnv03/tunglamhoaphuc2/", "wordpress/2026/", "site/images/", "s2-cnv03/uploads/"] as const;

/** True when the R2 key behind an /anh-goc/ path (with or without the leading slash) has its variants. */
export function hasVariants(path: string): boolean {
	const key = path.replace(/^\/?anh-goc\//, "");
	return VARIANT_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Widths of the ready-made variants; scripts/media-variants.mjs has the same list (a test keeps them equal). */
export const VARIANT_WIDTHS = [160, 360, 640, 960, 1280, 1920] as const;
/** The biggest variant, "@max": the original's width, at most this many pixels. */
export const VARIANT_MAX_WIDTH = 2560;
export type VariantStep = (typeof VARIANT_WIDTHS)[number] | "max";
export type VariantFormat = "avif" | "webp";

/** The standard width a request of `width` pixels is rounded UP to ("max" past 1920), so nobody can make an unlimited number of cache keys. */
export function variantStep(width: number): VariantStep {
	if (!Number.isFinite(width)) return "max";
	return VARIANT_WIDTHS.find((step) => width <= step) ?? "max";
}

/** Pictures that get variants. GIF (often animated) and SVG stay as they are; AVIF originals are already the small kind. */
const VARIANT_SOURCE = /\.(jpe?g|jfif|png|webp)$/i;
// "<name>@<digits or max>" optionally followed by the extension of the variant: the file part of an /anh-goc/ path.
const VARIANT_SUFFIX = /^(.+)@(\d{1,5}|max)(?:\.(avif|webp))?$/;

/**
 * An /anh-goc/ address for the variant of `src` (a path such as "/anh-goc/s2-cnv03/a.jpg") at the standard width that fits `width`.
 * Without an extension: the Accept header picks AVIF or WebP. A picture that has no variants (GIF, SVG, a query string) comes back as it is.
 */
export function variantUrl(src: string, width: number): string {
	if (!src.startsWith(`${ANH_GOC}/`) || /[?#]/.test(src)) return src;
	const base = src.replace(/@(?:\d{1,5}|max)(?:\.(?:avif|webp))?$/, "");
	if (!VARIANT_SOURCE.test(base)) return src;
	return `${base}@${variantStep(width)}`;
}

/** What a request for /anh-goc/<bucket>/<key…> means when its last part is "<name>@<width>[.avif|.webp]"; `null` for an ordinary key. */
export function parseVariantRequest(key: string[]): { base: string[]; step: VariantStep; ext: VariantFormat | null } | null {
	if (key.length === 0) return null;
	const match = VARIANT_SUFFIX.exec(key[key.length - 1]);
	if (!match) return null;
	const step = match[2] === "max" ? "max" : variantStep(Number(match[2]));
	return { base: [...key.slice(0, -1), match[1]], step, ext: (match[3] as VariantFormat | undefined) ?? null };
}

/** The source of a transformation on this zone: always a picture of this site's /anh-goc/ route. */
function transformSource(src: string): string | null {
	const address = src.startsWith("/anh-goc/") ? src : mediaUrl(src);
	return address?.startsWith("/anh-goc/") ? address.slice(1) : null;
}

/**
 * A picture of the old site at `width` pixels. In "cgi" mode (today's default) through Cloudflare's image transformations on
 * this zone (AVIF or WebP as the browser takes): the old admin keeps camera originals of 7–9 MB; at 640 px one is about 25 KB. The
 * zone accepts only sources on itself, which is why B2 files come through /anh-goc/. Past the free 5,000 transformations a month,
 * onerror=redirect sends the browser to the original. In "variants" mode the ready-made file of the standard width (see IMAGE_DELIVERY).
 * The site's own pictures and other hosts stay as they are.
 */
export function imageAt(src: string, width: number, delivery: ImageDelivery = IMAGE_DELIVERY): string {
	if (src.startsWith("/") && !src.startsWith("//") && !src.startsWith("/anh-goc/")) return src;
	const source = transformSource(src);
	if (!source) return src;
	if (delivery === "variants" && hasVariants(source)) return variantUrl(`/${source}`, width);
	return `/cdn-cgi/image/width=${width},quality=75,format=auto,onerror=redirect/${source}`;
}

/**
 * Album pictures. In "cgi" mode only WordPress uploads are transformed: the B2 album pictures were made small already
 * (median 92 KB), and an album of 170 would spend the monthly quota. Variants cost no quota, so there every picture gets one.
 */
export function albumImageAt(src: string, width: number, delivery: ImageDelivery = IMAGE_DELIVERY): string {
	return (delivery === "variants" && srcHasVariants(src)) || isWordPressMedia(src) ? imageAt(src, width, delivery) : src;
}

/** True when the picture behind `src` (any form `mediaUrl` understands) is one of those that have ready-made variants. */
export function srcHasVariants(src: string): boolean {
	const source = transformSource(src);
	return source !== null && hasVariants(source);
}

/** Display widths of delivered pictures. In "cgi" mode few on purpose, each one counts against the quota; "icon" and "mid" are the standard variant widths between. */
export const IMAGE_WIDTH = { icon: 160, small: 360, card: 640, mid: 960, wide: 1280, full: 1920 } as const;

/**
 * `srcSet` of a delivered picture at the given widths, for pictures shown much smaller than 640 px on phones (a statue card is about
 * 185 px there: 324 device pixels at Lighthouse's 1.75, so 360, T41b). `undefined` for pictures that are not delivered in sizes, which come in one size.
 *
 * "variants" mode: each width is rounded up to a standard one (no widths: all standard widths, and "@max" when the picture is wider than the last); with the picture's own width known
 * (`originalWidth`, from media.width) the list stops at it, and the "@max" file stands for the original's width, so the browser never
 * hears of a size that does not exist.
 */
export function imageSrcSet(src: string, widths: readonly number[], originalWidth?: number | null, delivery: ImageDelivery = IMAGE_DELIVERY): string | undefined {
	if (delivery !== "variants" || !srcHasVariants(src)) {
		if (imageAt(src, widths[0], delivery) === src) return undefined;
		return widths.map((width) => `${imageAt(src, width, delivery)} ${width}w`).join(", ");
	}
	if (imageAt(src, VARIANT_WIDTHS[0], delivery) === src) return undefined;
	const known = typeof originalWidth === "number" && originalWidth > 0 ? Math.round(originalWidth) : null;
	const wanted: VariantStep[] = (widths.length ? widths : VARIANT_WIDTHS).map(variantStep);
	// All standard widths of a picture wider than the last one: its "@max" belongs to the list too.
	if (!widths.length && known !== null && known > VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]) wanted.push("max");
	// From the width the picture itself has, the ladder holds no file: "@max" is it.
	const steps = new Set<VariantStep>(wanted.map((step) => (step !== "max" && known !== null && step >= known ? "max" : step)));
	const ordered = [...steps].sort((a, b) => (a === "max" ? Infinity : a) - (b === "max" ? Infinity : b));
	return ordered
		.map((step) => {
			const descriptor = step === "max" ? Math.min(known ?? VARIANT_MAX_WIDTH, VARIANT_MAX_WIDTH) : step;
			return `${imageAt(src, step === "max" ? VARIANT_MAX_WIDTH + 1 : step, delivery)} ${descriptor}w`;
		})
		.join(", ");
}

/**
 * How eagerly to fetch the picture at the top of a page. Only the site's own pictures go first.
 * The old site's photos can be camera originals of 7–9 MB, and asked for first they keep the
 * whole page waiting (an article took 47.9 s to show on a phone); a transformed one is small,
 * but past the monthly quota it falls back to the original. "low" also keeps React from
 * preloading them.
 */
export function topImagePriority(src: string): "high" | "low" {
	return src.startsWith("/") && !src.startsWith("//") && !src.startsWith("/cdn-cgi/") && !src.startsWith("/anh-goc/") ? "high" : "low";
}

/** Facebook's emoji pictures, pasted into a few posts along with the text. Not photos. */
export function isEmojiImage(url: string | null | undefined): boolean {
	const parsed = parse(url);
	return !!parsed && parsed.host.endsWith(".fbcdn.net") && parsed.pathname.startsWith("/images/emoji.php/");
}

/** True for WordPress uploads, which disappear if WordPress is ever switched off. */
export function isWordPressMedia(url: string | null | undefined): boolean {
	return wordpressPath(url) !== null || parse(url)?.host === WORDPRESS_HOST;
}

/**
 * WordPress uploads always sit in a year/month folder (…/uploads/2026/07/x.jpg). The Tông Chỉ
 * editors typed addresses without one (…/uploads/niem-phat.jpg) for pictures still to come;
 * none of those exist (22 of 22 answered 404 on 03/11/2026), so they count as no picture.
 */
export function isUnsavedUpload(url: string | null | undefined): boolean {
	const path = wordpressPath(url);
	return path !== null && !path.includes("/");
}

/**
 * Where the editors centred a picture ("center 44%") as CSS may read it: the old admin wrote six Tông Chỉ banners with the site's address in
 * front ("https://admin…/center 44%"), which is neither valid CSS nor accepted by the admin's own form. What is not a position becomes the centre.
 */
export function cleanPosition(value: string | null | undefined): string {
	const position = (value ?? "").trim().replace(/^https?:\/\/[^/\s]+\//i, "");
	return /^[a-z0-9.%\s-]{1,40}$/i.test(position) ? position : "center 50%";
}
