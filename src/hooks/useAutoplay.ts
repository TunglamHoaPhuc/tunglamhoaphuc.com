"use client";
import { type FocusEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Swiper } from "swiper";
import { prefersReducedMotion } from "@/libs/motion";
import { isMotionHeld, subscribeMotionHold } from "@/libs/motionHold";

/**
 * Autoplay of a Bexon slider that visitors can hold (WCAG 2.2.2). There is no pause button on
 * the slider: it keeps moving by itself, stands still on the spot while the pointer is over it
 * (Swiper's `pauseOnMouseEnter`) and while keyboard focus is anywhere inside its block, and
 * moves on again when focus leaves. The page's one switch (MotionToggle) stops every slider
 * until it is switched back. Visitors who want to choose the frame use the arrows. It never
 * runs when the visitor asked for reduced motion.
 */
export function useAutoplay() {
	const [swiper, setSwiper] = useState<Swiper | null>(null);
	const focusInside = useRef(false);

	useEffect(() => {
		if (!swiper || swiper.destroyed) return;
		const autoplay = swiper.autoplay;
		if (!autoplay) return;
		const el = swiper.el;
		const canRun = () => !focusInside.current && !prefersReducedMotion() && !isMotionHeld();
		// A slider that does not run is read out when its frame changes (the arrows); one that
		// runs is not, or the reader would speak every seven seconds.
		const live = (running: boolean) => swiper.wrapperEl?.setAttribute("aria-live", running ? "off" : "polite");
		const onStart = () => live(true);
		const onStop = () => live(false);
		swiper.on("autoplayStart", onStart);
		swiper.on("autoplayStop", onStop);

		// A slider made again under the pointer (another tab) stays still until the pointer leaves.
		const sync = () => {
			if (swiper.destroyed) return;
			if (!canRun()) autoplay.stop();
			else if (!autoplay.running && !el.matches(":hover")) autoplay.start();
		};
		sync();
		// Swiper resumes a slider the pointer left only if it still runs; one stopped by focus
		// or by the switch is started again here once nothing holds it.
		const onLeave = () => {
			if (!swiper.destroyed && canRun() && !swiper.autoplay.running) swiper.autoplay.start();
		};
		el.addEventListener("mouseleave", onLeave);
		const unsubscribe = subscribeMotionHold(sync);
		return () => {
			el.removeEventListener("mouseleave", onLeave);
			unsubscribe();
			if (!swiper.destroyed) {
				swiper.off("autoplayStart", onStart);
				swiper.off("autoplayStop", onStop);
			}
		};
	}, [swiper]);

	const onFocus = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			// Only keyboard focus holds the slider: a tap or click also focuses an arrow, and the
			// slider would then stand still until the visitor touched something else.
			if (!(event.target as Element).matches(":focus-visible")) return;
			focusInside.current = true;
			if (swiper && !swiper.destroyed) swiper.autoplay?.stop();
		},
		[swiper],
	);

	const onBlur = useCallback(
		(event: FocusEvent<HTMLElement>) => {
			// Focus moving between two things of the same block is not leaving it.
			if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
			focusInside.current = false;
			if (!swiper || swiper.destroyed || prefersReducedMotion() || isMotionHeld() || swiper.autoplay.running) return;
			if (swiper.el.matches(":hover")) return;
			swiper.autoplay.start();
		},
		[swiper],
	);

	return {
		/** For Swiper's `onSwiper`; a slider that is made again (another tab) keeps the hold. */
		onSwiper: setSwiper,
		/** For the element around the slider and its arrows. */
		onFocus,
		onBlur,
	};
}
