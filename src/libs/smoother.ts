// The page's ScrollSmoother, held here so code that only asks it to scroll (revealTarget,
// ListStatus) does not pull GSAP into the first JavaScript of every page: GSAP now loads
// with the effects, after the page is up, and not at all under reduced motion (T41a).
// initSmoothScroller sets it and clears it when the page's effects are reverted.
type Smoother = {
	scrollTo(target: HTMLElement | number, smooth?: boolean, position?: string): void;
	wrapper(): HTMLElement;
};

let current: Smoother | null = null;

export function setSmoother(smoother: Smoother | null): void {
	current = smoother;
}

/** The running smoother, or `null` without smooth scrolling (reduced motion, effects not up yet). */
export function getSmoother(): Smoother | null {
	return current;
}
