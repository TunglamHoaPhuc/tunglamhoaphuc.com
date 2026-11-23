// Pictures inside the body of a post (V3 side, 23/11/2026, docs/toi-uu-anh-23-11-2026.md section 4).
//
// The HTML of a body comes from D1 and has `<img src="/anh-goc/…">` with the original file: a 1,400-px, 1.3 MB picture for a column 760 px wide
// (a phone needs about 1,070 device pixels), with no srcset. The sanitiser of the admin (src/lib/tlhp-admin/content/html.ts, a mirror of www's, never
// edited here) must stay as it is, so the step lives on this side: after the sanitiser, every picture of /anh-goc/ gets the ready-made variant of the
// right width (fitImage), a srcset over the standard widths and `sizes` for the reading column. The same helper serves the renderer's own lines
// (`![caption](src)`, InfographicArticleRenderer), which draw the picture in React rather than as HTML.
import { imageSources, type ImageSources } from "@/lib/image-sources";
import { fitImage, getImageUrl } from "@/utils/image";

/** Widths offered to the browser for a picture of a body (all of them standard variant widths). */
export const BODY_IMAGE_WIDTHS = [360, 640, 960, 1280, 1920] as const;
/** The width of the file in `src` (what a browser without srcset support gets): the reading column of 760 px on a desktop, at 1x. */
export const BODY_IMAGE_SRC_WIDTH = 960;
/** The reading column: full width on a phone and tablet, 760 px beyond (the `tlhp-rich` column is narrower than the page). */
export const BODY_IMAGE_SIZES = "(max-width: 768px) 100vw, 760px";
/** The picture of the full-size viewer of a body picture (a "phóng to" box, at most 896 px wide, zoomable): the biggest standard variant. */
export const BODY_ZOOM_WIDTH = 1920;

/**
 * `src`, `srcSet` and `sizes` for a picture of a body; `sizes` and `widths` default to the reading column (the renderer's own picture frame is narrower and passes its own).
 * `address` may be any form getImageUrl understands (an /anh-goc/ path, an old B2/WordPress address).
 */
export function bodyImageSources(address: string | null | undefined, sizes: string = BODY_IMAGE_SIZES, widths: readonly number[] = BODY_IMAGE_WIDTHS): ImageSources {
	return imageSources(address, BODY_IMAGE_SRC_WIDTH, widths, sizes);
}

/** The file the full-size viewer of a body picture shows. */
export function bodyZoomSrc(address: string | null | undefined): string {
	return fitImage(getImageUrl(address), BODY_ZOOM_WIDTH);
}

// ── HTML ────────────────────────────────────────────────────────────────────────

// An <img …> tag that respects quotes (a ">" inside a quoted value does not end it). An unterminated quote makes the tag not match at all, so
// a malformed tag is left exactly as it is.
const IMG_TAG = /<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
// One attribute: name, then optionally = and a double-quoted, single-quoted or bare value.
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+)))?/g;

const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&lt;": "<", "&gt;": ">" };
const decode = (value: string) => value.replace(/&(?:amp|quot|#39|#x27|lt|gt);/gi, (entity) => ENTITIES[entity.toLowerCase()]);
const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** The raw text of a value written another way, now in double quotes: only what could break out of them or the tag is escaped, entities stay as they are. */
const requote = (value: string) => value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface Attribute {
	name: string;
	/** Raw text of the value as the author wrote it; `null` for a bare attribute (`<img hidden>`). */
	raw: string | null;
	/** True when the raw text came in single quotes. */
	single: boolean;
}

function attributesOf(body: string): Attribute[] {
	const out: Attribute[] = [];
	for (const match of body.matchAll(ATTRIBUTE)) {
		const [, name, double, single, bare] = match;
		out.push({ name, raw: double ?? single ?? bare ?? null, single: single !== undefined });
	}
	return out;
}

function rewrite(tag: string): string {
	const closing = /\s*\/?>$/.exec(tag)?.[0] ?? ">";
	const attributes = attributesOf(tag.slice("<img".length, tag.length - closing.length));
	const has = (name: string) => attributes.some((attribute) => attribute.name.toLowerCase() === name);
	// A tag that already has its own srcset or sizes is the author's (or ours, run twice): left alone.
	if (has("srcset") || has("sizes")) return tag;
	const source = attributes.find((attribute) => attribute.name.toLowerCase() === "src");
	if (!source || source.raw === null) return tag;
	const address = decode(source.raw).trim();
	if (!address.startsWith("/anh-goc/")) return tag;

	const { src, srcSet, sizes } = bodyImageSources(address);
	const needsLoading = !has("loading");
	const needsDecoding = !has("decoding");
	if (src === address && !srcSet && !needsLoading && !needsDecoding) return tag;

	const parts = attributes.map((attribute) => {
		if (attribute.raw === null) return ` ${attribute.name}`;
		if (attribute === source) {
			return ` ${attribute.name}="${escapeAttribute(src)}"`;
		}
		return ` ${attribute.name}="${requote(attribute.raw)}"`;
	});
	if (srcSet) parts.push(` srcset="${escapeAttribute(srcSet)}"`, ` sizes="${escapeAttribute(sizes as string)}"`);
	if (needsLoading) parts.push(' loading="lazy"');
	if (needsDecoding) parts.push(' decoding="async"');
	return `${tag.slice(0, "<img".length)}${parts.join("")}${/\//.test(closing) ? " />" : ">"}`;
}

/**
 * The HTML of a body with every `<img src="/anh-goc/…">` written for delivery: `src` is the 960-px variant, `srcset` lists 360/640/960/1280/1920,
 * `sizes` is the reading column, and `loading="lazy"` and `decoding="async"` are added where the tag has none. Alt text and every other attribute
 * stay, in their order. Left exactly as they are: images from anywhere else (`/brand/…`, other hosts, data:), tags that already have a `srcset` or
 * `sizes`, tags without a usable `src`, malformed tags, and every body without an `<img>` (the same string comes back). Pictures that have no
 * variants (small old WordPress files, GIF, SVG) only get lazy loading. Idempotent. No dependency, no parsing of the whole document.
 */
export function optimizeBodyImages(html: string): string {
	if (!html || !/<img\b/i.test(html)) return html;
	return html.replace(IMG_TAG, rewrite);
}
