"use client";
import { type FocusEvent, useEffect, useState } from "react";
import type { Swiper } from "swiper";
import { prefersReducedMotion } from "@/libs/motion";

/**
 * Autoplay of a Bexon slider that visitors can stop (WCAG 2.2.2): the pause button, and
 * focus moving into the slider, stop it until the button starts it again (WAI's carousel
 * pattern). The pointer over the slides only holds it (Swiper's `pauseOnMouseEnter`). It
 * never runs when the visitor asked for reduced motion.
 */
export function useAutoplay() {
	const [swiper, setSwiper] = useState<Swiper | null>(null);
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		const autoplay = swiper?.autoplay;
		if (!swiper || swiper.destroyed || !autoplay) return;
		if (paused || prefersReducedMotion()) autoplay.stop();
		else if (!autoplay.running) autoplay.start();
	}, [swiper, paused]);

	return {
		/** For Swiper's `onSwiper`; a slider that is made again (another tab) keeps the choice. */
		onSwiper: setSwiper,
		paused,
		toggle: () => setPaused((value) => !value),
		/** For the element around the slider and its buttons. */
		onFocus: (event: FocusEvent<HTMLElement>) => {
			if (!(event.target as Element).closest(".tlhp-pause")) setPaused(true);
		},
	};
}
