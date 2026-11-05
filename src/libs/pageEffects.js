import animateInvertText from "@/libs/animateInvertText";
import arrangeAnim from "@/libs/arrangeAnim";
import arrangeAnim2 from "@/libs/arrangeAnim2";
import fadeInRightOnScrollAnim from "@/libs/fadeInRightOnScrollAnim";
import { gsap } from "@/libs/gsap.config";
import initSmoothScroller from "@/libs/initSmoothScroller";
import onePageNavAnim from "@/libs/onePageNavAnim";
import progressBar from "@/libs/progressBar";
import sidebarSticky from "@/libs/sidebarSticky";
import { setSmoother } from "@/libs/smoother";
import textReavealAnim from "@/libs/textReavealAnim";
import titleAnim from "@/libs/titleAnim";
import titleAnim2 from "@/libs/titleAnim2";
import titleAnim3 from "@/libs/titleAnim3";
import tjImageParallex from "@/libs/tjImageParallex";
import tjLeftSwipeAnimation from "@/libs/tjLeftSwipeAnimation";
import tjProgressAnimation from "@/libs/tjProgressAnimation";
import tjRightSwipeAnimation from "@/libs/tjRightSwipeAnimation";
import tjScrollSlider from "@/libs/tjScrollSlider";
import tjStackAnimation from "@/libs/tjStackAnimation";
import tjStackAnimation2 from "@/libs/tjStackAnimation2";
import tjStackAnimation3 from "@/libs/tjStackAnimation3";
import tjZoomInScroll from "@/libs/tjZoomInScroll";

// Bexon's smooth scrolling and scroll animations for one page. ClientWrapper imports this
// module only once the page is up and motion is allowed, so GSAP (47 KB compressed) is not in
// the first JavaScript of any page, and never loads under reduced motion (T41a).

/** Lets the browser paint and answer input before the next step. */
const yieldToMain = () => globalThis.scheduler?.yield?.() ?? new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Starts the effects, each in a task of its own and in Bexon's order: run together they made
 * one task of 1.5–1.8 s on a phone with the CPU 4x slower (T41f). Everything they create goes
 * into one GSAP context; `revert` stops the steps not yet run and undoes the rest.
 * @returns {{ revert: () => void }}
 */
export function startPageEffects() {
	const context = gsap.context(() => {});
	// What useGSAP calls contextSafe: a function that runs inside the context when called later.
	const contextSafe = (fn) => context.add(null, fn);
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
	];
	let stopped = false;
	(async () => {
		for (const step of steps) {
			if (stopped) return;
			const start = performance.now();
			context.add(step);
			// Each step's time shows in the browser's Performance panel ("effect titleAnim"…).
			performance.measure(`effect ${step.name}`, { start });
			await yieldToMain();
		}
	})();
	return {
		revert() {
			stopped = true;
			context.revert();
			setSmoother(null);
		},
	};
}
