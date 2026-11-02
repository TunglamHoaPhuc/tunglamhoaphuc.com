type SliderElement = HTMLElement & { swiper?: { autoplay?: { stop(): void } } };

export function prefersReducedMotion(): boolean {
	return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The magic cursor follows a mouse; touch screens have nothing for it to follow.
export function hasFinePointer(): boolean {
	return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function stopAutoplayingSliders(root: ParentNode = document): void {
	root.querySelectorAll<SliderElement>(".swiper").forEach((slider) => slider.swiper?.autoplay?.stop());
}
