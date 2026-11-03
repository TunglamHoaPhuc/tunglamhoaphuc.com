"use client";
import type { MouseEvent, ReactNode } from "react";
import { revealTarget } from "@/libs/reveal";

type Props = { children: ReactNode; className?: string };

// Links inside that point to a part of this page (the calendar's days → their events) glide
// there and move the focus, keeping the address as it is but for the "#…"; without
// JavaScript they jump. The links carry the full address, so Bexon's handler for bare "#…"
// links leaves them alone. A target that is on the page is this page's, whatever the query
// says (?thang= is left out for this month).
export default function RevealLinks({ children, className }: Props) {
	const onClick = (event: MouseEvent<HTMLDivElement>) => {
		const link = (event.target as Element).closest<HTMLAnchorElement>("a[href*='#']");
		if (!link || link.origin !== location.origin || link.pathname !== location.pathname) return;
		const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
		if (!target) return;
		event.preventDefault();
		revealTarget(target);
		history.replaceState(history.state, "", link.hash);
	};
	return (
		<div className={className} onClick={onClick}>
			{children}
		</div>
	);
}
