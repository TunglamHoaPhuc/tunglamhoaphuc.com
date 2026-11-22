"use client";
import { useEffect, useSyncExternalStore } from "react";
import { isMotionHeld, restoreMotionHold, setMotionHeld, subscribeMotionHold } from "@/libs/motionHold";

// The one switch that stops everything on the page that moves by itself, and starts it again
// (WCAG 2.2.2). A small round button in the lower left corner, faint until the pointer or
// focus is on it; the sliders and sliding rows carry no button of their own. It is a toggle
// button: the name stays, `aria-pressed` says whether movement is stopped. Visitors who asked
// their system for reduced motion have nothing that moves, so CSS hides it for them.
export default function MotionToggle() {
	const held = useSyncExternalStore(subscribeMotionHold, isMotionHeld, () => false);
	useEffect(restoreMotionHold, []);
	return (
		<button type="button" className="tlhp-motion-toggle" aria-pressed={held} title="Dừng chuyển động của trang" onClick={() => setMotionHeld(!held)}>
			<svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
				<path d={held ? "M2.5 1.2v9.6L10.6 6z" : "M2 1.5h2.8v9H2zM7.2 1.5H10v9H7.2z"} fill="currentColor" />
			</svg>
			<span className="visually-hidden">Dừng chuyển động của trang</span>
		</button>
	);
}
