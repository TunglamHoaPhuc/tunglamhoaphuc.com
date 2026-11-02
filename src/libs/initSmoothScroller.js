import { gsap, ScrollSmoother } from "@/libs/gsap.config";

const initSmoothScroller = contanerRef => {
	const animItems = gsap.utils.toArray("#smooth-wrapper");
	if (animItems.length) {
		gsap.config({
			nullTargetWarn: false,
		});

		let smoother = ScrollSmoother.create({
			content: "#smooth-content",
			wrapper: "#smooth-wrapper",
			smooth: 1.5,
			effects: true,
			smoothTouch: 0.1,
			ignoreMobileResize: true,
		});

		// Find in page, Tab focus and anchor jumps reveal off-screen targets by scrolling
		// the overflow-hidden wrapper, which ScrollSmoother does not track. Jump the smoother
		// (no easing) to the revealed spot so the target is in view at once and the next
		// scroll continues from there instead of jumping back.
		const wrapper = smoother.wrapper();
		const root = document.documentElement;
		wrapper.addEventListener("scroll", () => {
			const offset = wrapper.scrollTop;
			if (!offset) return;
			wrapper.scrollTop = 0;
			// Bootstrap sets `scroll-behavior: smooth`, and the smoother eases its content;
			// both would turn this jump into a slow glide past the target.
			const behavior = root.style.scrollBehavior;
			const smoothness = smoother.smooth();
			root.style.scrollBehavior = "auto";
			smoother.smooth(0);
			smoother.scrollTo(smoother.scrollTop() + offset, false);
			root.style.scrollBehavior = behavior;
			requestAnimationFrame(() => smoother.smooth(smoothness));
		});
	}
};

export default initSmoothScroller;
