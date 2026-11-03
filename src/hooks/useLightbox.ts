"use client";
import { useEffect } from "react";
import { prefersReducedMotion } from "@/libs/motion";

// Bexon's lightbox (GLightbox) with what it leaves out: Vietnamese button names, a "3/79"
// count read out on each change, the page behind made inert while it is open (so focus
// and screen readers stay in it; GLightbox only cycles Tab between its buttons), and focus
// handed back to the photo or video that opened it.
const LIGHTBOX_HTML = `<div id="glightbox-body" class="glightbox-container" tabindex="-1" role="dialog" aria-modal="true" aria-label="Xem ảnh và video">
	<div class="gloader visible"></div>
	<div class="goverlay"></div>
	<div class="gcontainer">
		<div id="glightbox-slider" class="gslider"></div>
		<p class="tlhp-lightbox-count" aria-live="polite"></p>
		<button class="gclose gbtn" aria-label="Đóng" data-taborder="3">{closeSVG}</button>
		<button class="gprev gbtn" aria-label="Ảnh trước" data-taborder="2">{prevSVG}</button>
		<button class="gnext gbtn" aria-label="Ảnh sau" data-taborder="1">{nextSVG}</button>
	</div>
</div>`;

type Lightbox = {
	elements: unknown[];
	index: number;
	on(event: string, handler: (data?: { current?: { index: number } }) => void): void;
	destroy(): void;
};

/** Opens the elements matching `selector` (links to photos, or to video embeds) in the lightbox. */
export function useLightbox(selector: string) {
	useEffect(() => {
		let lightbox: Lightbox | undefined;
		let cancelled = false;
		let opener: HTMLElement | null = null;
		let madeInert: Element[] = [];

		// Clicking a link does not focus it in every browser, so note it at the click.
		const noteOpener = (event: Event) => {
			const target = (event.target as Element | null)?.closest<HTMLElement>(selector);
			if (target) opener = target;
		};
		document.addEventListener("click", noteOpener, true);

		// GLightbox's own Tab handling can land on its hidden "previous" button at the first
		// photo, dropping focus out of the dialog. Cycle through the buttons that show instead.
		const trapTab = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;
			const buttons = [...document.querySelectorAll<HTMLElement>(".glightbox-container .gbtn")].filter(
				(button) => button.getClientRects().length > 0 && !button.classList.contains("disabled"),
			);
			if (!buttons.length) return;
			event.preventDefault();
			event.stopPropagation();
			const at = buttons.indexOf(document.activeElement as HTMLElement);
			const next = event.shiftKey ? (at <= 0 ? buttons.length - 1 : at - 1) : (at + 1) % buttons.length;
			buttons[next].focus();
		};

		const showCount = (index: number) => {
			const count = document.querySelector(".glightbox-container .tlhp-lightbox-count");
			const total = lightbox?.elements.length ?? 0;
			if (count) count.textContent = total > 1 ? `${index + 1}/${total}` : "";
		};

		import("glightbox").then(({ default: GLightbox }) => {
			if (cancelled) return;
			const reduced = prefersReducedMotion();
			lightbox = GLightbox({
				selector,
				lightboxHTML: LIGHTBOX_HTML,
				openEffect: reduced ? "none" : "zoom",
				closeEffect: reduced ? "none" : "zoom",
				slideEffect: reduced ? "none" : "slide",
				loop: false,
			}) as unknown as Lightbox;

			lightbox.on("open", () => {
				const container = document.querySelector(".glightbox-container");
				madeInert = [...document.body.children].filter((el) => el !== container && !el.hasAttribute("inert") && el.tagName !== "SCRIPT");
				madeInert.forEach((el) => el.setAttribute("inert", ""));
				showCount(lightbox?.index ?? 0);
				document.addEventListener("keydown", trapTab, true);
				container?.querySelector<HTMLElement>(".gclose")?.focus();
			});
			lightbox.on("slide_changed", (data) => showCount(data?.current?.index ?? 0));
			lightbox.on("slide_after_load", () => {
				// Video slides are iframes; give each a name.
				document.querySelectorAll(".glightbox-container iframe:not([title])").forEach((frame) => frame.setAttribute("title", "Video"));
			});
			lightbox.on("close", () => {
				document.removeEventListener("keydown", trapTab, true);
				madeInert.forEach((el) => el.removeAttribute("inert"));
				madeInert = [];
				opener?.focus({ preventScroll: true });
			});
		});

		return () => {
			cancelled = true;
			document.removeEventListener("click", noteOpener, true);
			document.removeEventListener("keydown", trapTab, true);
			madeInert.forEach((el) => el.removeAttribute("inert"));
			lightbox?.destroy();
		};
	}, [selector]);
}
