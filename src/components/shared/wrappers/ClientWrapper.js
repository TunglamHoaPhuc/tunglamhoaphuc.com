"use client";
import { hasFinePointer, prefersReducedMotion, stopAutoplayingSliders } from "@/libs/motion";
import smoothScrollToTop from "@/libs/smoothScrollToTop";
import tjMagicCursorAnimation from "@/libs/tjMagicCursorAnimation";
import { useEffect } from "react";

const ClientWrapper = () => {
	useEffect(() => {
		smoothScrollToTop();
		if (prefersReducedMotion()) {
			stopAutoplayingSliders();
			return;
		}
		let stopped = false;
		let effects;
		// GSAP and the scroll animations load after the page is up (libs/pageEffects, T41a).
		import("@/libs/pageEffects").then(({ startPageEffects }) => {
			if (!stopped) effects = startPageEffects();
		});
		import("wow.js").then(({ default: WOW }) => {
			if (!stopped) new WOW().init();
		});
		const cleanup = hasFinePointer() ? tjMagicCursorAnimation() : undefined;
		return () => {
			stopped = true;
			effects?.revert();
			if (cleanup) cleanup();
		};
	}, []);
	return null;
};

export default ClientWrapper;
