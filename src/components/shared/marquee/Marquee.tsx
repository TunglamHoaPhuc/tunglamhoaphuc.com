"use client";
import { type CSSProperties, type ReactNode, useState } from "react";
import PauseButton from "@/components/shared/sliders/PauseButton";

type Props = {
	/** The row's items, as <li> elements. */
	children: ReactNode;
	/** What moves, for the pause button ("dải chuyên mục"). */
	what: string;
	/** Seconds for one full turn of the row. */
	seconds: number;
	/** Extra classes for the visible strip (Bexon's `client-slider-1`, `marquee-slider`). */
	viewClassName?: string;
	className?: string;
	/** Pure decoration (the footer slogan): hidden from screen readers, the button is not. */
	decorative?: boolean;
};

// Bexon's endless sliding rows (its brand and slogan sliders) redone in CSS: the row is
// drawn twice and slides by one copy, so it stops on the spot on hover, while focus is
// inside or with the pause button. Swiper's version can only stop after the slide it is
// in the middle of. With reduced motion the row stands still (_marquee.scss).
export default function Marquee({ children, what, seconds, viewClassName = "", className = "", decorative = false }: Props) {
	const [paused, setPaused] = useState(false);
	return (
		<div
			className={`tlhp-marquee ${paused ? "is-paused" : ""} ${className}`}
			style={{ "--tlhp-marquee-duration": `${seconds}s` } as CSSProperties}
		>
			<div className={`tlhp-marquee-view ${viewClassName}`}>
				<div className="tlhp-marquee-track" aria-hidden={decorative || undefined}>
					<ul className="tlhp-marquee-list">{children}</ul>
					{/* The second copy that fills the gap; out of reach for keyboards and screen readers. */}
					<ul className="tlhp-marquee-list" aria-hidden="true" inert>
						{children}
					</ul>
				</div>
			</div>
			<PauseButton paused={paused} onClick={() => setPaused(!paused)} what={what} className="tlhp-marquee-pause" />
		</div>
	);
}
