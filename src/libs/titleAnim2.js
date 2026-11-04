import { gsap, ScrollTrigger, SplitText } from "@/libs/gsap.config";

// Headings stay hidden (CSS, until .start-anim) and are split into letters only when they come
// within 200px of the screen, not all as the page starts: that took 0.9 s on a phone with the
// CPU 4x slower (T41f). Headings already on the first screen split at once, as before. The
// letters then come in at "top 85%" as Bexon made them. `contextSafe` (from useGSAP) keeps the
// late splits and tweens in the page's context, so leaving the page reverts them.
const titleAnim2 = (contextSafe = (fn) => fn) => {
	for (const element of gsap.utils.toArray(".text-anim")) {
		ScrollTrigger.create({
			trigger: element,
			start: "top bottom+=200",
			once: true,
			onEnter: contextSafe(() => {
				element.classList.add("start-anim");
				const split = new SplitText(element, { type: "chars, words" });
				gsap.from(split.chars, {
					duration: 1,
					delay: 0.1,
					x: 20,
					autoAlpha: 0,
					stagger: 0.03,
					ease: "power2.out",
					scrollTrigger: { trigger: element, start: "top 85%" },
				});
			}),
		});
	}
};

export default titleAnim2;
