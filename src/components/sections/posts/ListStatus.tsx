"use client";
import { useEffect, useRef } from "react";
import { getSmoother } from "@/libs/smoother";

type Props = {
	text: string;
	page: number;
	/** The heading at the top of the list, where paging takes the view and the focus. */
	headingId: string;
};

// Leaves the sticky header room above the list (it shows while scrolling up).
const HEADER_ROOM = 130;

// "471 bài · trang 2/40", announced when a filter changes the list. Moving to another page
// also scrolls back to the top of the list and puts focus there, since the links that did
// it sit at the bottom.
export default function ListStatus({ text, page, headingId }: Props) {
	const shownPage = useRef(page);

	useEffect(() => {
		if (shownPage.current === page) return;
		shownPage.current = page;
		const heading = document.getElementById(headingId);
		if (!heading) return;
		// Focus first: ScrollSmoother answers focus by centring the element, and the scroll
		// below must be the last word.
		heading.focus({ preventScroll: true });
		// With smooth scrolling on, the content is mid-glide and scrollIntoView aims at where
		// it is drawn, not where it lies; let ScrollSmoother aim instead.
		const smoother = getSmoother();
		if (smoother) smoother.scrollTo(heading, true, `top ${HEADER_ROOM}px`);
		else heading.scrollIntoView({ block: "start" });
	}, [page, headingId]);

	return (
		<p className="tlhp-list-status" role="status">
			{text}
		</p>
	);
}
