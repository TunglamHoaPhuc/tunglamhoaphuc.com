import { gsap, ScrollTrigger } from "@/libs/gsap.config";
import rtlValue from "./rtlValue";
const tjLeftSwipeAnimation = (contextSafe = (fn) => fn) => {
	const animItems = gsap.utils.toArray(".leftSwipeWrap");
	animItems.forEach((wrap, i) => {
		ScrollTrigger.create({
			trigger: wrap,
			start: "top bottom+=200",
			once: true,
			onEnter: contextSafe(() => {
				gsap.set(wrap.querySelectorAll(".left-swipe"), {
					transformPerspective: 1200,
					x: `${rtlValue(-10)}rem`,
					rotateY: 20,
					opacity: 0,
					transformOrigin: "left center",
				});
				gsap.to(wrap.querySelectorAll(".left-swipe"), {
					transformPerspective: 1200,
					x: 0,
					rotateY: 0,
					opacity: 1,
					delay: 0.3,
					ease: "power3.out",
					scrollTrigger: {
						trigger: wrap,
						start: "top 80%",
						id: "leftSwipeWrap-" + i,
						toggleActions: "play none none none",
					},
				});
			}),
		});
	});
};
export default tjLeftSwipeAnimation;
