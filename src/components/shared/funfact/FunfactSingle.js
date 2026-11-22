"use client";
import { prefersReducedMotion } from "@/libs/motion";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

const GROUPED = new Intl.NumberFormat("vi-VN");
const PLAIN = new Intl.NumberFormat("vi-VN", { useGrouping: false });

/**
 * Bexon's odometer figure. The page arrives with the real number, so screen readers, pages
 * without script and reduced motion all see it; with motion, the figure drops to 0 once the
 * odometer has loaded (a screen before it comes into view) and counts up when scrolled to. Screen readers read the number as text, not
 * the rolling digits.
 * @param {{ currentValue: number, symbol?: string, sup?: string, type?: number, grouped?: boolean }} props
 *   grouped: false for years ("2570", not "2.570").
 */
const FunfactSingle = ({ currentValue, symbol, sup, type, grouped = true }) => {
	const NUMBER = grouped ? GROUPED : PLAIN;
	const format = grouped ? "(.ddd)" : "d";
	const [value, setValue] = useState(currentValue);
	const [Odometer, setOdometer] = useState(null);
	const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.4 });
	// The odometer (its script and its many digit boxes) comes only when the figure is a
	// screen away, not with the page: on a phone the figures are far down (PageSpeed
	// 22/11/2026 counted its nested boxes in the page and its work at load).
	const { ref: nearRef, inView: near } = useInView({ triggerOnce: true, rootMargin: "100% 0px" });
	const setRefs = (node) => {
		ref(node);
		nearRef(node);
	};

	useEffect(() => {
		if (!near || prefersReducedMotion()) return;
		let cancelled = false;
		import("react-odometerjs").then((mod) => {
			if (cancelled) return;
			setValue(0);
			setOdometer(() => mod.default);
		});
		return () => {
			cancelled = true;
		};
	}, [near]);

	// Count up once visible.
	useEffect(() => {
		if (!inView || !Odometer) return;
		const timeoutId = setTimeout(() => setValue(currentValue || 0), 250);
		return () => clearTimeout(timeoutId);
	}, [inView, Odometer, currentValue]);

	const numberClass = `odometer ${type === 2 || type === 3 ? "" : "countup-number"}`;
	return (
		<div ref={setRefs} className={type === 3 ? "h5-about-counter" : type === 2 ? "hero-counter" : "inline-content"}>
			<span className="visually-hidden">
				{NUMBER.format(currentValue)}
				{sup ?? ""}
				{symbol ?? ""}
			</span>
			<span aria-hidden="true">
				{Odometer ? <Odometer className={numberClass} value={value} format={format} /> : <span className={numberClass}>{NUMBER.format(value)}</span>}{" "}
				{sup ? <sup className="count-plus">{sup}</sup> : ""}
				{symbol ? <span className={type === 3 ? "h5-about-counter-symbol" : "count-plus"}>{symbol}</span> : ""}
			</span>
		</div>
	);
};

export default FunfactSingle;
