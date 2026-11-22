// The page's one switch for everything that moves by itself (WCAG 2.2.2): sliders that change
// frame, the sliding rows. The choice is kept in the browser and shown on <html> as
// `data-motion-hold`, which the CSS of the rows reads and which every slider's autoplay checks.
const KEY = "tlhp-motion-hold";
export const MOTION_HOLD_EVENT = "tlhp-motion-hold-change";

export function isMotionHeld(): boolean {
	return typeof document !== "undefined" && document.documentElement.hasAttribute("data-motion-hold");
}

/** Takes the kept choice back onto <html> when a page opens. */
export function restoreMotionHold(): void {
	try {
		if (window.localStorage.getItem(KEY) === "1") apply(true);
	} catch {
		// Storage can be blocked; the switch then lasts until the page is closed.
	}
}

function apply(held: boolean): void {
	document.documentElement.toggleAttribute("data-motion-hold", held);
	window.dispatchEvent(new Event(MOTION_HOLD_EVENT));
}

export function setMotionHeld(held: boolean): void {
	try {
		if (held) window.localStorage.setItem(KEY, "1");
		else window.localStorage.removeItem(KEY);
	} catch {
		// See restoreMotionHold.
	}
	apply(held);
}

export function subscribeMotionHold(onChange: () => void): () => void {
	window.addEventListener(MOTION_HOLD_EVENT, onChange);
	return () => window.removeEventListener(MOTION_HOLD_EVENT, onChange);
}
