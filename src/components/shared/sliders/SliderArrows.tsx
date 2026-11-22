// The two signs, drawn here so the arrows need no icon font and no shared icon set.
function Chevron({ d }: { d: string }) {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
			<path d={d} />
		</svg>
	);
}

type Props = {
	/** Class names Swiper's `navigation.prevEl` / `nextEl` point at, unique on the page. */
	prevClass: string;
	nextClass: string;
	/** What the buttons say, read out: "Bài trước" / "Bài kế tiếp". */
	prevLabel: string;
	nextLabel: string;
	className?: string;
	/** For a row that is not a Swiper (the Marquee): what a press does, instead of Swiper's Navigation. */
	onPrev?: () => void;
	onNext?: () => void;
};

// The two arrows every slider carries so visitors choose the frame themselves. Swiper's
// Navigation module wires them (and marks the one at the end of a slider that does not loop
// with `swiper-button-disabled`); the 44px size and the look are in layout/_slider-arrows.scss.
export default function SliderArrows({ prevClass, nextClass, prevLabel, nextLabel, className = "", onPrev, onNext }: Props) {
	return (
		<div className={`tlhp-arrows ${className}`}>
			<button type="button" className={`tlhp-arrow ${prevClass}`} aria-label={prevLabel} onClick={onPrev}>
				<Chevron d="m15 18-6-6 6-6" />
			</button>
			<button type="button" className={`tlhp-arrow ${nextClass}`} aria-label={nextLabel} onClick={onNext}>
				<Chevron d="m9 18 6-6-6-6" />
			</button>
		</div>
	);
}
