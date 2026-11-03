import { ScrollSmoother } from "@/libs/gsap.config";

// Leaves the sticky header room above the target (it shows while scrolling up).
const HEADER_ROOM = 130;

/**
 * Takes the view and the keyboard focus to a section of the page. Focus first: ScrollSmoother
 * answers focus by centring the element, and the scroll must be the last word. With smooth
 * scrolling on, the content is mid-glide and scrollIntoView aims at where it is drawn, so
 * ScrollSmoother aims instead.
 */
export function revealTarget(target: HTMLElement): void {
	target.focus({ preventScroll: true });
	const smoother = ScrollSmoother.get();
	if (smoother) smoother.scrollTo(target, true, `top ${HEADER_ROOM}px`);
	else target.scrollIntoView({ block: "start" });
}
