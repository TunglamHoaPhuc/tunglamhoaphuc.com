"use client";

// The few framer-motion features the old Tiểu sử Sư Tổ page used, on the Web Animations API:
// motion.div / motion.img with initial → animate (or whileInView once), an exit when the
// keyed child of AnimatePresence (mode "wait") changes, and useReducedMotion. The new site
// has no framer-motion; this keeps the old page's JSX and its timings as they were.
import { Children, cloneElement, forwardRef, isValidElement, useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ElementType, type ReactElement, type ReactNode, type Ref } from "react";

type Frame = { opacity?: number; scale?: number; y?: number };
type Transition = { duration?: number };

type MotionOwnProps = {
	initial?: Frame | false;
	animate?: Frame;
	whileInView?: Frame;
	exit?: Frame;
	viewport?: { once?: boolean; amount?: number };
	transition?: Transition;
	/** Set by AnimatePresence on the child that is leaving. */
	__exit?: boolean;
	__onExitDone?: () => void;
};

// framer-motion's default tween easing.
const EASE = "cubic-bezier(0.25, 0.1, 0.25, 1)";

const REDUCED = "(prefers-reduced-motion: reduce)";
/** Asked at the moment of moving: the first render cannot know it (the server has no media query). */
const motionReduced = () => typeof window !== "undefined" && window.matchMedia(REDUCED).matches;

function toStyle(frame: Frame | undefined): CSSProperties {
	if (!frame) return {};
	const style: CSSProperties = {};
	if (frame.opacity !== undefined) style.opacity = frame.opacity;
	const parts: string[] = [];
	if (frame.y !== undefined) parts.push(`translateY(${frame.y}px)`);
	if (frame.scale !== undefined) parts.push(`scale(${frame.scale})`);
	if (parts.length) style.transform = parts.join(" ");
	return style;
}

function toKeyframe(frame: Frame | undefined): Keyframe {
	const style = toStyle(frame);
	const keyframe: Keyframe = {};
	if (style.opacity !== undefined) keyframe.opacity = String(style.opacity);
	keyframe.transform = (style.transform as string | undefined) ?? "none";
	return keyframe;
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
	if (typeof ref === "function") ref(value);
	else if (ref) (ref as { current: T | null }).current = value;
}

function makeMotion<Tag extends "div" | "img">(tag: Tag) {
	type Props = MotionOwnProps & Omit<React.ComponentPropsWithoutRef<Tag>, keyof MotionOwnProps>;
	const Component = forwardRef<HTMLElement, Props>(function Motion(props, forwardedRef) {
		const { initial, animate, whileInView, exit, viewport, transition, __exit, __onExitDone, style, ...rest } = props as MotionOwnProps & { style?: CSSProperties } & Record<string, unknown>;
		const elRef = useRef<HTMLElement | null>(null);
		const target = animate ?? whileInView;
		const startsHidden = initial !== false && initial !== undefined && target !== undefined;
		const [reached, setReached] = useState(!startsHidden);
		const durationMs = (transition?.duration ?? 0.3) * 1000;
		const exitDone = useRef(__onExitDone);
		useEffect(() => {
			exitDone.current = __onExitDone;
		});

		// Enter: on mount (animate) or once in view (whileInView).
		useEffect(() => {
			const el = elRef.current;
			if (!el || !startsHidden || reached) return;
			const run = () => {
				if (!motionReduced()) el.animate([toKeyframe(initial || undefined), toKeyframe(target)], { duration: durationMs, easing: EASE });
				setReached(true);
			};
			if (animate) {
				run();
				return;
			}
			const observer = new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting)) {
						observer.disconnect();
						run();
					}
				},
				{ threshold: viewport?.amount ?? 0 },
			);
			observer.observe(el);
			return () => observer.disconnect();
			// The enter runs once per mounted element, as framer-motion's.
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, []);

		// Exit: AnimatePresence waits for it before showing the next child.
		useEffect(() => {
			if (!__exit) return;
			const el = elRef.current;
			if (!el || !exit || motionReduced()) {
				exitDone.current?.();
				return;
			}
			const animation = el.animate([toKeyframe(target), toKeyframe(exit)], { duration: durationMs, easing: EASE, fill: "forwards" });
			let done = false;
			const finish = () => {
				if (done) return;
				done = true;
				exitDone.current?.();
			};
			animation.finished.then(finish, () => undefined);
			// A tab in the background holds its animations; the next child still comes on time.
			const timer = window.setTimeout(finish, durationMs + 50);
			return () => {
				window.clearTimeout(timer);
				animation.cancel();
			};
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [__exit]);

		const setNode = useCallback(
			(node: HTMLElement | null) => {
				elRef.current = node;
				setRef(forwardedRef, node);
			},
			[forwardedRef],
		);
		const frameStyle = reached ? toStyle(target) : toStyle(initial || undefined);
		const Tag = tag as ElementType;
		return <Tag {...rest} ref={setNode} style={{ ...style, ...frameStyle }} />;
	});
	return Component;
}

export const motion = { div: makeMotion("div"), img: makeMotion("img") };

/** One keyed child at a time: the old one plays its exit, then the new one enters. */
export function AnimatePresence({ children }: { mode?: "wait"; children: ReactNode }) {
	const child = Children.only(children);
	const [shown, setShown] = useState<ReactElement | null>(isValidElement(child) ? child : null);
	if (!isValidElement(child)) return child;
	if (!shown || shown.key === child.key) {
		// React's "information from the previous render" pattern: keep the latest element of the
		// key on screen, so the one that leaves exits with its latest props. The extra pass is this
		// component's alone; it ends as soon as the element is stored.
		if (shown !== child) setShown(child);
		return child;
	}
	// Only a motion element plays an exit; anything else gives way at once.
	if (typeof shown.type !== "object") {
		setShown(child);
		return child;
	}
	return cloneElement(shown as ReactElement<MotionOwnProps>, { __exit: true, __onExitDone: () => setShown(child) });
}

function subscribeReduced(onChange: () => void) {
	const query = window.matchMedia(REDUCED);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
	return useSyncExternalStore(
		subscribeReduced,
		() => window.matchMedia(REDUCED).matches,
		() => false,
	);
}
