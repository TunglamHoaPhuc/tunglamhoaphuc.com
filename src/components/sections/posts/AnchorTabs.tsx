"use client";
import { useEffect, useState } from "react";
import { revealTarget } from "@/libs/reveal";

export type AnchorTab = { id: string; label: string };

type Props = {
	tabs: AnchorTab[];
	/** The page path: links are full addresses, so Bexon's handler for "#…" links leaves them alone. */
	path: string;
};

// Leaves the sticky header room above a section.
const HEADER_ROOM = 130;

// The article's table of contents as tabs (Tổng quan · Nội dung chính · …). A click glides
// to the section, puts focus there and updates the address; without JavaScript the links
// jump. The tab of the section being read is marked as the reader scrolls.
export default function AnchorTabs({ tabs, path }: Props) {
	const [active, setActive] = useState(tabs[0]?.id);

	useEffect(() => {
		const sections = tabs.map((tab) => document.getElementById(tab.id)).filter((el): el is HTMLElement => !!el);
		const visible = new Set<string>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visible.add(entry.target.id);
					else visible.delete(entry.target.id);
				}
				const first = tabs.find((tab) => visible.has(tab.id));
				if (first) setActive(first.id);
			},
			{ rootMargin: `-${HEADER_ROOM}px 0px -55% 0px` },
		);
		sections.forEach((section) => observer.observe(section));
		return () => observer.disconnect();
	}, [tabs]);

	const go = (event: React.MouseEvent, id: string) => {
		const target = document.getElementById(id);
		if (!target) return;
		event.preventDefault();
		revealTarget(target);
		history.replaceState(history.state, "", `#${id}`);
		setActive(id);
	};

	if (tabs.length < 2) return null;
	return (
		<nav className="tlhp-anchor-tabs" aria-label="Các phần của bài">
			<ul>
				{tabs.map((tab) => (
					<li key={tab.id}>
						<a href={`${path}#${tab.id}`} aria-current={active === tab.id ? "true" : undefined} onClick={(event) => go(event, tab.id)}>
							{tab.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
