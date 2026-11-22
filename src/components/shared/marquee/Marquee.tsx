"use client";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import SliderArrows from "@/components/shared/sliders/SliderArrows";

type Props = {
	/** The row's items, as <li> elements. */
	children: ReactNode;
	/** What moves, for the arrows ("dải chuyên mục"). */
	what: string;
	/** Seconds for one full turn of the row. */
	seconds: number;
	/** Extra classes for the visible strip (Bexon's `client-slider-1`, `marquee-slider`). */
	viewClassName?: string;
	className?: string;
	/** Pure decoration (the footer slogan): hidden from screen readers, the arrows are not. */
	decorative?: boolean;
};

const STEP_MS = 450;

// Bexon's endless sliding rows (its brand and slogan sliders) redone in CSS: the row is
// drawn twice and slides by one copy, so it stops on the spot while the pointer is over it
// or focus is inside (Swiper's version can only stop after the slide it is in the middle
// of). The two arrows move the row on by one item, either way: they set the CSS animation's
// own clock forward or back, so the endless loop has no seam. With reduced motion the row
// stands still and the arrows are not shown (_marquee.scss).
export default function Marquee({ children, what, seconds, viewClassName = "", className = "", decorative = false }: Props) {
	const trackRef = useRef<HTMLDivElement>(null);
	const frame = useRef(0);
	useEffect(() => () => cancelAnimationFrame(frame.current), []);

	const step = (direction: 1 | -1) => {
		const track = trackRef.current;
		const animation = track?.getAnimations()[0];
		const list = track?.firstElementChild as HTMLElement | null;
		if (!track || !animation || !list) return;
		const turn = Number(animation.effect?.getComputedTiming().duration);
		const length = list.offsetWidth;
		if (!turn || !length) return;
		// One item and its gap: where the second item starts; a one-item row moves by its width.
		const items = list.children;
		const pitch = items.length > 1 ? (items[1] as HTMLElement).offsetLeft - (items[0] as HTMLElement).offsetLeft : length;
		const delta = ((pitch || length) / length) * turn * direction;
		const from = Number(animation.currentTime ?? 0);
		const started = performance.now();
		cancelAnimationFrame(frame.current);
		const tick = (now: number) => {
			const progress = Math.min(1, Math.max(0, now - started) / STEP_MS);
			const eased = 1 - (1 - progress) ** 3;
			animation.currentTime = (((from + delta * eased) % turn) + turn) % turn;
			if (progress < 1) frame.current = requestAnimationFrame(tick);
		};
		frame.current = requestAnimationFrame(tick);
	};

	return (
		<div className={`tlhp-marquee ${className}`} style={{ "--tlhp-marquee-duration": `${seconds}s` } as CSSProperties}>
			<div className={`tlhp-marquee-view ${viewClassName}`}>
				<div ref={trackRef} className="tlhp-marquee-track" aria-hidden={decorative || undefined}>
					<ul className="tlhp-marquee-list">{children}</ul>
					{/* The second copy that fills the gap; out of reach for keyboards and screen readers. */}
					<ul className="tlhp-marquee-list" aria-hidden="true" inert>
						{children}
					</ul>
				</div>
			</div>
			<SliderArrows
				className="tlhp-marquee-arrows"
				prevClass="tlhp-marquee-prev"
				nextClass="tlhp-marquee-next"
				prevLabel={`Cuộn ${what} sang trái`}
				nextLabel={`Cuộn ${what} sang phải`}
				onPrev={() => step(-1)}
				onNext={() => step(1)}
			/>
		</div>
	);
}
