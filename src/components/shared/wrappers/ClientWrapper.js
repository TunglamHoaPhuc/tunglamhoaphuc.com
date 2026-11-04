"use client";
import animateInvertText from "@/libs/animateInvertText";
import arrangeAnim from "@/libs/arrangeAnim";
import arrangeAnim2 from "@/libs/arrangeAnim2";
import fadeInRightOnScrollAnim from "@/libs/fadeInRightOnScrollAnim";
import { useGSAP } from "@/libs/gsap.config";
import initSmoothScroller from "@/libs/initSmoothScroller";
import { hasFinePointer, prefersReducedMotion, stopAutoplayingSliders } from "@/libs/motion";
import onePageNavAnim from "@/libs/onePageNavAnim";
import progressBar from "@/libs/progressBar";
import sidebarSticky from "@/libs/sidebarSticky";
import smoothScrollToTop from "@/libs/smoothScrollToTop";
import textReavealAnim from "@/libs/textReavealAnim";
import titleAnim from "@/libs/titleAnim";
import titleAnim2 from "@/libs/titleAnim2";
import titleAnim3 from "@/libs/titleAnim3";
import tjImageParallex from "@/libs/tjImageParallex";
import tjLeftSwipeAnimation from "@/libs/tjLeftSwipeAnimation";
import tjMagicCursorAnimation from "@/libs/tjMagicCursorAnimation";
import tjProgressAnimation from "@/libs/tjProgressAnimation";
import tjRightSwipeAnimation from "@/libs/tjRightSwipeAnimation";
import tjScrollSlider from "@/libs/tjScrollSlider";
import tjStackAnimation from "@/libs/tjStackAnimation";
import tjStackAnimation2 from "@/libs/tjStackAnimation2";
import tjStackAnimation3 from "@/libs/tjStackAnimation3";
import tjZoomInScroll from "@/libs/tjZoomInScroll";
import { useEffect } from "react";

/** Lets the browser paint and answer input before the next step. */
const yieldToMain = () => globalThis.scheduler?.yield?.() ?? new Promise((resolve) => setTimeout(resolve, 0));

const ClientWrapper = () => {
	useEffect(() => {
		smoothScrollToTop();
		if (prefersReducedMotion()) {
			stopAutoplayingSliders();
			return;
		}
		import("wow.js").then(({ default: WOW }) => {
			new WOW().init();
		});
		const cleanup = hasFinePointer() ? tjMagicCursorAnimation() : undefined;
		return () => {
			if (cleanup) cleanup();
		};
	}, []);
	// Bexon started every effect in one task: 1.5–1.8 s on a phone with the CPU 4x slower, most
	// of the Total Blocking Time (T41f). Each now starts in a task of its own, in the same order;
	// contextSafe keeps what they create in the context, so leaving the page still reverts it.
	useGSAP((context, contextSafe) => {
		if (prefersReducedMotion()) return;
		const steps = [
			initSmoothScroller,
			tjRightSwipeAnimation,
			function lazyLeftSwipe() {
				tjLeftSwipeAnimation(contextSafe);
			},
			titleAnim,
			function lazyTitleAnim2() {
				titleAnim2(contextSafe);
			},
			titleAnim3,
			textReavealAnim,
			sidebarSticky,
			arrangeAnim,
			arrangeAnim2,
			animateInvertText,
			fadeInRightOnScrollAnim,
			function onePageNav() {
				onePageNavAnim(contextSafe);
			},
			progressBar,
			tjStackAnimation,
			tjScrollSlider,
			tjStackAnimation2,
			tjImageParallex,
			tjProgressAnimation,
			tjZoomInScroll,
			tjStackAnimation3,
		].map((step) => ({ name: step.name, run: contextSafe(step) }));
		let stopped = false;
		(async () => {
			for (const { name, run } of steps) {
				if (stopped) return;
				const start = performance.now();
				run();
				// Each step's time shows in the browser's Performance panel ("effect titleAnim"…).
				performance.measure(`effect ${name}`, { start });
				await yieldToMain();
			}
		})();
		return () => {
			stopped = true;
		};
	});
	return null;
};

export default ClientWrapper;
