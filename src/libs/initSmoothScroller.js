import { gsap, ScrollSmoother } from "@/libs/gsap.config";
import { setSmoother } from "@/libs/smoother";

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
			// ScrollSmoother scrolls a focused element into view. Headers, the search popup
			// and the offcanvas sit outside the smoothed content, so leave their focus alone;
			// otherwise opening search jumps the page and swaps in the sticky header. Targets
			// focused by script (tabindex="-1") are scrolled by that script.
			onFocusIn: (self, event) =>
				self.content().contains(event.target) && event.target.getAttribute("tabindex") !== "-1" ? undefined : false,
		});

		// Find in page, Tab focus and anchor jumps reveal off-screen targets by scrolling
		// the overflow-hidden wrapper, which ScrollSmoother does not track. Move the smoother
		// to the revealed spot the way it handles focus itself (a short glide), so the next
		// scroll continues from there instead of jumping back. Pausing the easing with
		// smooth(0) for an instant jump only worked on pages busy with other ScrollTriggers;
		// on quiet pages the content never moved.
		const wrapper = smoother.wrapper();
		wrapper.addEventListener("scroll", () => {
			const offset = wrapper.scrollTop;
			if (!offset) return;
			wrapper.scrollTop = 0;
			smoother.scrollTo(smoother.scrollTop() + offset, false);
		});
		// pageEffects clears it when the page's effects are reverted.
		setSmoother(smoother);
	}
};

export default initSmoothScroller;
