"use client";
import useIsSticky from "@/hooks/useIsSticky";
import { scrollToPageTop } from "@/libs/scrollToTop";
import { useEffect, useState } from "react";

// Bexon's floating button with its scroll progress ring. It must not sit over what people
// are reading (BRAND-GUIDELINES 5.6), so on phones, where it would cover the text column,
// it only shows while the visitor scrolls back up, like the sticky header. It also steps
// aside once the footer's own "Về đầu trang" link is on screen.
const BackToTop = () => {
	const [scrollValue, setScrollValue] = useState(0);
	const [scrollTopPos, setScrollTopPos] = useState(0);
	const [isFooterEndVisible, setIsFooterEndVisible] = useState(false);
	const [isPhone, setIsPhone] = useState(false);
	const isScrollingUp = useIsSticky(true);

	useEffect(() => {
		const handleScroll = () => {
			const scrollTopPos = document.documentElement.scrollTop;

			const calcHeight =
				document.documentElement.scrollHeight -
				document.documentElement.clientHeight;
			const value = calcHeight > 0 ? Math.round((scrollTopPos / calcHeight) * 100) : 0;
			setScrollTopPos(scrollTopPos);
			setScrollValue(value);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		window.addEventListener("load", handleScroll);
		// The page may have been scrolled, and loaded, before this ran. Measured in the next
		// frame, not here: here the sliders have just written their styles, and reading the
		// page's height would force a layout of the whole page in the middle of hydration.
		const frame = requestAnimationFrame(handleScroll);

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", handleScroll);
			window.removeEventListener("load", handleScroll);
		};
	}, []);

	useEffect(() => {
		const phone = window.matchMedia("(max-width: 767.98px)");
		const update = () => setIsPhone(phone.matches);
		update();
		phone.addEventListener("change", update);
		return () => phone.removeEventListener("change", update);
	}, []);

	useEffect(() => {
		const footerEnd = document.querySelector(".tlhp-footer-end");
		if (!footerEnd) return;
		const observer = new IntersectionObserver(([entry]) => setIsFooterEndVisible(entry.isIntersecting));
		observer.observe(footerEnd);
		return () => observer.disconnect();
	}, []);

	const isShown = scrollTopPos > 100 && !isFooterEndVisible && (!isPhone || isScrollingUp);

	return (
		<button
			type="button"
			id="tj-back-to-top"
			aria-label="Về đầu trang"
			onClick={scrollToPageTop}
			className={isShown ? "active" : ""}
			style={{
				background: `conic-gradient(var(--tj-color-theme-primary) ${scrollValue}%, var(--tlhp-ring-track, var(--tj-color-common-white)) ${scrollValue}%)`,
			}}
		>
			{/* The percentage is drawn by CSS (data-value), not written as text: the button's
			    name is "Về đầu trang", and visible text would have to be part of it. */}
			<span
				id="tj-back-to-top-percentage"
				aria-hidden="true"
				data-value={scrollValue < 96 ? `${scrollValue}%` : undefined}
			>
				{scrollValue < 96 ? null : <i className="tji-arrow-up-long"></i>}
			</span>
		</button>
	);
};

export default BackToTop;
