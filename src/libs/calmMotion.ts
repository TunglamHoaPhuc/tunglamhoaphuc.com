// The calm tier of effects, for visitors whose system asks for reduced motion (decided
// 17/11/2026: many Windows machines have "Animation effects" off without their owner knowing,
// and the site then looked dead). Nothing moves: no smooth scrolling, no parallax, no sliding
// rows, no slider running by itself. What stays is what does not travel across the screen:
// a block fades in the first time it comes into view (opacity only), the menu unfolds, links
// and buttons change colour softly. The styles are in components/_reduced-motion.scss.

/** What the full effects animate in (wow.js blocks, split titles, the cards that slide in). */
const FADING = ".wow, .text-anim, .title-anim, .tj-fadein-right-on-scroll";

/** How long the fade lasts in CSS, plus a little: after it the element is left as it was made. */
const FADE_DONE_MS = 800;

/**
 * Fades in the blocks still below the screen when they come into view. A block already on
 * screen is left alone (nothing flashes at load), and nothing is ever hidden unless this has
 * run, so a page whose script fails shows everything.
 * @returns what undoes it
 */
export function startCalmEffects(root: ParentNode = document): () => void {
	if (typeof IntersectionObserver === "undefined") return () => {};
	const waiting = new Set<HTMLElement>();
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const element = entry.target as HTMLElement;
				observer.unobserve(element);
				waiting.delete(element);
				element.classList.add("is-in");
				// Once shown, give the element back its own opacity and transitions.
				const timer = setTimeout(() => {
					timers.delete(timer);
					element.classList.remove("tlhp-fade", "is-in");
				}, FADE_DONE_MS);
				timers.add(timer);
			}
		},
		// A little inside the screen, so the fade is seen and not over before the block shows.
		{ rootMargin: "0px 0px -6% 0px" },
	);
	const screen = window.innerHeight;
	for (const element of root.querySelectorAll<HTMLElement>(FADING)) {
		const { top, bottom, height } = element.getBoundingClientRect();
		// On screen, above it, or not laid out (a closed tab, a hidden panel): leave it.
		if (!height || top < screen || bottom <= 0) continue;
		element.classList.add("tlhp-fade");
		waiting.add(element);
		observer.observe(element);
	}
	return () => {
		observer.disconnect();
		for (const timer of timers) clearTimeout(timer);
		for (const element of waiting) element.classList.remove("tlhp-fade", "is-in");
		for (const element of root.querySelectorAll<HTMLElement>(".tlhp-fade")) element.classList.remove("tlhp-fade", "is-in");
	};
}
