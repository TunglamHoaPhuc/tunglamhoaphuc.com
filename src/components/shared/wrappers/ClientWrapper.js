"use client";
import { startCalmEffects } from "@/libs/calmMotion";
import { hasFinePointer, prefersReducedMotion, stopAutoplayingSliders, whenIdleAfterLoad } from "@/libs/motion";
import smoothScrollToTop from "@/libs/smoothScrollToTop";
import tjMagicCursorAnimation from "@/libs/tjMagicCursorAnimation";
import { useEffect } from "react";

const ClientWrapper = () => {
	useEffect(() => {
		smoothScrollToTop();
		if (prefersReducedMotion()) {
			// Nothing moves; blocks only fade in as they come into view (libs/calmMotion).
			stopAutoplayingSliders();
			return startCalmEffects();
		}
		let stopped = false;
		let effects;
		let wow;
		const startWow = () =>
			import("wow.js")
				.then(({ default: WOW }) => {
					if (stopped) return;
					// The boxes below the screen are hidden by CSS only from here on (see .tlhp-wow
					// in _theme.scss); the class stays on <html> so the next page's boxes wait too.
					document.documentElement.classList.add("tlhp-wow");
					try {
						wow = new WOW();
						wow.init();
					} catch (error) {
						document.documentElement.classList.remove("tlhp-wow");
						throw error;
					}
				})
				.catch((error) => console.error("[effects] wow.js", error));
		// GSAP, the scroll animations (libs/pageEffects, T41a) and wow.js load once the page has
		// loaded and the browser is idle: before, they ran while the hero picture waited to be
		// painted (PageSpeed 22/11/2026).
		const cancelIdle = whenIdleAfterLoad(() => {
			import("@/libs/pageEffects").then(({ startPageEffects }) => {
				if (!stopped) effects = startPageEffects();
			});
			startWow();
		});
		const cleanup = hasFinePointer() ? tjMagicCursorAnimation() : undefined;
		return () => {
			stopped = true;
			cancelIdle();
			effects?.revert();
			// Each init() starts a 50 ms timer and scroll/resize listeners; without stop() they pile up per page.
			wow?.stop();
			if (cleanup) cleanup();
		};
	}, []);
	return null;
};

export default ClientWrapper;
