type SliderElement = HTMLElement & { swiper?: { autoplay?: { stop(): void } } };

export function prefersReducedMotion(): boolean {
	return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The magic cursor follows a mouse; touch screens have nothing for it to follow.
export function hasFinePointer(): boolean {
	return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Runs `run` once the page has loaded and the browser is idle (at most `timeout` ms after the
 * load), so effects that are not needed for the first screen stay out of the way of its
 * picture and of the first taps (PageSpeed 22/11/2026: GSAP, wow.js and their layout reads
 * ran before the hero picture was painted). On a page already loaded (a move inside the site)
 * it waits only for idle.
 * @returns what cancels it if it has not run yet
 */
export function whenIdleAfterLoad(run: () => void, timeout = 2000): () => void {
	let cancelled = false;
	let idleId: number | undefined;
	let timerId: ReturnType<typeof setTimeout> | undefined;
	const go = () => {
		if (!cancelled) run();
	};
	const schedule = () => {
		if (cancelled) return;
		if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(go, { timeout });
		else timerId = setTimeout(go, 1);
	};
	if (document.readyState === "complete") schedule();
	else window.addEventListener("load", schedule, { once: true });
	return () => {
		cancelled = true;
		window.removeEventListener("load", schedule);
		if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
		if (timerId !== undefined) clearTimeout(timerId);
	};
}

export function stopAutoplayingSliders(root: ParentNode = document): void {
	root.querySelectorAll<SliderElement>(".swiper").forEach((slider) => slider.swiper?.autoplay?.stop());
}
