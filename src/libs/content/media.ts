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

/** Facebook's emoji pictures, pasted into a few posts along with the text. Not photos. */
export function isEmojiImage(url: string | null | undefined): boolean {
	const parsed = parse(url);
	return !!parsed && parsed.host.endsWith(".fbcdn.net") && parsed.pathname.startsWith("/images/emoji.php/");
}

/** True for WordPress uploads, which disappear if WordPress is ever switched off. */
export function isWordPressMedia(url: string | null | undefined): boolean {
	return parse(mediaUrl(url))?.host === WORDPRESS_HOST;
}
