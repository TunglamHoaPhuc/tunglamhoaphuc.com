"use client";
import { useEffect, useRef } from "react";
import { DISMISS_KEY } from "@/libs/announcement";

export default function AnnouncementClose({ id }: { id: string }) {
	const button = useRef<HTMLButtonElement>(null);

	// Keep the header offset right when the notice wraps to more lines (phone, zoom).
	useEffect(() => {
		const bar = button.current?.closest<HTMLElement>(".tlhp-announcement");
		const root = document.documentElement;
		if (!bar || root.hasAttribute("data-announcement-hidden")) return;
		const sync = () => root.style.setProperty("--tlhp-announcement-offset", `${bar.offsetHeight}px`);
		const observer = new ResizeObserver(sync);
		observer.observe(bar);
		return () => observer.disconnect();
	}, []);

	const close = () => {
		try {
			sessionStorage.setItem(DISMISS_KEY, id);
		} catch {
			// Storage blocked: the notice still closes, it just returns on the next page.
		}
		const root = document.documentElement;
		root.setAttribute("data-announcement-hidden", "");
		root.style.setProperty("--tlhp-announcement-offset", "0px");
		// The button disappears with the notice; carry on from the start of the header.
		document.querySelector<HTMLElement>("header.header-area:not([inert]) .logo")?.focus();
	};

	return (
		<button ref={button} type="button" className="tlhp-announcement-close" onClick={close}>
			Đóng
			<svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path d="M17 1L1 17M1 1l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
			</svg>
		</button>
	);
}
