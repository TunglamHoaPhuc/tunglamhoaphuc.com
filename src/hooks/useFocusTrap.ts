"use client";
import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * While `active`, keeps Tab and Shift+Tab inside `container`, moves focus into it, and
 * calls `onEscape` on Esc. Returning focus to the opener is left to the caller.
 */
export function useFocusTrap(container: RefObject<HTMLElement | null>, active: boolean, onEscape: () => void) {
	// Read the latest callback without re-running the effect, which would pull focus back
	// to the first item on every parent render.
	const escape = useRef(onEscape);
	useEffect(() => {
		escape.current = onEscape;
	});

	useEffect(() => {
		const root = container.current;
		if (!active || !root) return;

		const focusables = () =>
			[...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);

		// A panel that shows by transitioning `visibility` is still hidden on the first frame,
		// and focus() on it is silently ignored. Retry for a few frames until it lands.
		let frame = 0;
		let attempts = 0;
		const focusFirst = () => {
			const first = focusables()[0];
			if (!first || root.contains(document.activeElement)) return;
			first.focus();
			if (document.activeElement !== first && attempts++ < 30) frame = requestAnimationFrame(focusFirst);
		};
		focusFirst();

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				escape.current();
				return;
			}
			if (event.key !== "Tab") return;
			const items = focusables();
			if (!items.length) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [container, active]);
}
