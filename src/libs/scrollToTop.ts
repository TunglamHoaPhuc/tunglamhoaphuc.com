import { prefersReducedMotion } from "./motion";

/**
 * Scrolls back to the top and takes keyboard focus along, to the logo of the header there,
 * so the next Tab continues from the top instead of from the footer.
 */
export function scrollToPageTop(): void {
	window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });

	// That header is inert while its sticky copy shows, and focus() on it does nothing.
	// Wait for the scroll to bring it back (about a second at most).
	let frames = 0;
	const focusLogo = () => {
		const logo = document.querySelector<HTMLElement>("header.header-absolute:not([inert]) .logo");
		if (logo) logo.focus({ preventScroll: true });
		else if (frames++ < 90) requestAnimationFrame(focusLogo);
	};
	requestAnimationFrame(focusLogo);
}
