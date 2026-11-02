import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
// Registering plugins wakes GSAP's ticker (a setTimeout), which Workers forbid while
// modules load on the server. Animations only run in the browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(
		ScrollTrigger,
		ScrollSmoother,
		SplitText,
		ScrollToPlugin,
		useGSAP
	);
}

export { gsap, ScrollSmoother, ScrollTrigger, SplitText, useGSAP };
