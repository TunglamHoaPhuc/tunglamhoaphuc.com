// Ready-made variants of a library picture, made in the browser while it is uploaded (docs/van-hanh/anh.md).
// The site serves `<key>@<width>[.avif|.webp]` from R2 (src/libs/content/mediaRoute.ts, which falls back from AVIF to
// WebP), so a picture whose WebP variants sit beside it never needs /cdn-cgi/image. Variants are an optimisation: the
// server keeps only those that really are WebP files of the right size and drops the rest without failing the upload.
import { VARIANT_MAX_WIDTH, VARIANT_WIDTHS } from "../../libs/content/media";
import { sniffImage } from "./files";

export type VariantStep = (typeof VARIANT_WIDTHS)[number] | "max";
export const VARIANT_STEPS: readonly VariantStep[] = [...VARIANT_WIDTHS, "max"];
export type Variant = { step: VariantStep; bytes: Uint8Array };

/** One variant is a small file; anything over this is not what the browser was asked to make. */
export const MAX_VARIANT_BYTES = 4 * 1024 * 1024;
/** Pictures GIF (often animated) and SVG have no variants; the site's own rule is the same (VARIANT_SOURCE in media.ts). */
const HAS_VARIANTS = /\.(jpe?g|jfif|png|webp)$/i;

/** The R2 key of the WebP variant of `key` at `step`. */
export const variantKey = (key: string, step: VariantStep): string => `${key}@${step}.webp`;
/** Every key a picture's variants can have, to delete them with the picture. */
export const variantKeys = (key: string): string[] => VARIANT_STEPS.map((step) => variantKey(key, step));
export const wantsVariants = (key: string): boolean => HAS_VARIANTS.test(key);

/** The variants a multipart request carries: fields `v160`, `v360`, … `vmax`. */
export async function readVariants(form: FormData): Promise<Variant[]> {
	const out: Variant[] = [];
	for (const step of VARIANT_STEPS) {
		const file = form.get(`v${step}`);
		if (!(file instanceof File) || file.size === 0 || file.size > MAX_VARIANT_BYTES) continue;
		out.push({ step, bytes: new Uint8Array(await file.arrayBuffer()) });
	}
	return out;
}

/**
 * Keeps the variants that are WebP files whose size is what `step` means for a picture of `width` x `height`:
 * min(step, width) wide ("max": the picture's own width, at most VARIANT_MAX_WIDTH) with the same proportions.
 */
export function checkVariants(variants: Variant[], original: { width: number; height: number }): Variant[] {
	const kept: Variant[] = [];
	for (const variant of variants) {
		const found = sniffImage(variant.bytes);
		if (!found || found.mime !== "image/webp") continue;
		const width = variant.step === "max" ? Math.min(original.width, VARIANT_MAX_WIDTH) : Math.min(variant.step, original.width);
		const height = Math.round((width * original.height) / original.width);
		if (Math.abs(found.width - width) > 1 || Math.abs(found.height - height) > 2) continue;
		kept.push(variant);
	}
	return kept;
}
