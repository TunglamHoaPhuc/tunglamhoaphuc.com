// `src` + `srcset` + `sizes` of a delivered picture (23/11/2026, docs/toi-uu-anh-23-11-2026.md section 4): one place that joins fitImage() (the file
// for browsers without srcset) and imageSrcSet() (the ladder of ready-made variants), so a card, a gallery tile or a banner never has to
// hand a browser the original. Spread the result on an <img>: `<img {...imageSources(url, 640, [360, 640, 960], sizes)} />`.
import { imageSrcSet } from "@/lib/tlhp-content/media";
import { fitImage, getImageUrl } from "@/utils/image";

export interface ImageSources {
	src: string;
	/** `undefined` when the picture has no variants (small old WordPress files, GIF, SVG, static files of the site): it then comes in one size. */
	srcSet?: string;
	/** Present exactly when `srcSet` is. */
	sizes?: string;
}

/**
 * @param address any form getImageUrl understands (an /anh-goc/ path, an old B2/WordPress address, a bare file name)
 * @param srcWidth width of the file in `src`
 * @param widths widths offered in `srcset` (each is rounded up to a standard variant width)
 * @param sizes what the browser is told about the displayed width; only used together with `srcset`
 */
export function imageSources(address: string | null | undefined, srcWidth: number, widths: readonly number[], sizes: string): ImageSources {
	const normalized = getImageUrl(address);
	const src = fitImage(normalized, srcWidth);
	const srcSet = imageSrcSet(normalized, widths);
	return srcSet ? { src, srcSet, sizes } : { src };
}

/**
 * The `onError` of a picture that was given a srcset: a browser keeps choosing from `srcset` over any new `src`, so the srcset goes first, then the
 * address falls back to `fallbacks` one by one (each tried once), and a failure of the last one leaves the address alone instead of retrying forever.
 */
export function fallbackOnError(...fallbacks: (string | null | undefined)[]) {
	const queue = fallbacks.filter((address): address is string => !!address);
	return (event: { currentTarget: HTMLImageElement }) => {
		const target = event.currentTarget;
		target.removeAttribute("srcset");
		target.removeAttribute("sizes");
		const tried = Number(target.dataset.fallback ?? 0);
		target.dataset.fallback = String(tried + 1);
		// Past the last fallback the address is left alone, so the failing file is not requested again and the handler stops by itself.
		if (queue[tried]) target.src = queue[tried];
	};
}
