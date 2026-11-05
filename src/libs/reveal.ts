import { getSmoother } from "@/libs/smoother";

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
	const smoother = getSmoother();
	if (!smoother) {
		target.scrollIntoView({ block: "start" });
		return;
	}
	// A scroll of the wrapper the browser just made (Tab to a link below the fold, then Enter)
	// is handed to the smoother on its "scroll" event, which comes after this and would jump
	// back to it, leaving the glide stuck halfway. This scroll replaces that one.
	smoother.wrapper().scrollTop = 0;
	smoother.scrollTo(target, true, `top ${HEADER_ROOM}px`);
}
