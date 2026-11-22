"use client";

// Asks before something throws away what the person has typed. The browser's own warning (beforeunload) covers
// closing the tab and reloading; this covers the ways out inside the admin: a click on any link (the menu, "Quay lại")
// and the buttons that replace the page's content (duplicate, restore, load the newest). The question is a block in
// the page flow, never a pop-up: "Ở lại" or "Bỏ thay đổi".
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { leavingHref } from "./content/editorLogic";

export type LeaveGuard = {
	/** True while the question is on screen. */
	asking: boolean;
	/** Runs `go` now, or after the person agrees to drop the unsaved changes. */
	ask: (go: () => void) => void;
	stay: () => void;
	leave: () => void;
};

export function useLeaveGuard(unsaved: boolean): LeaveGuard {
	const router = useRouter();
	const [pending, setPending] = useState<{ go: () => void } | null>(null);

	// The browser warns before the tab closes or reloads.
	useEffect(() => {
		if (!unsaved) return;
		const onLeave = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", onLeave);
		return () => window.removeEventListener("beforeunload", onLeave);
	}, [unsaved]);

	// A click on a link inside the app: caught before the router sees it.
	useEffect(() => {
		if (!unsaved) return;
		const onClick = (event: MouseEvent) => {
			if (event.defaultPrevented || !(event.target instanceof Element)) return;
			const anchor = event.target.closest("a[href]");
			if (!anchor) return;
			const to = leavingHref({
				href: anchor.getAttribute("href"),
				target: anchor.getAttribute("target"),
				download: anchor.hasAttribute("download"),
				button: event.button,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				shiftKey: event.shiftKey,
				altKey: event.altKey,
				origin: window.location.origin,
				current: window.location.pathname + window.location.search,
			});
			if (!to) return;
			event.preventDefault();
			event.stopPropagation();
			setPending({ go: () => router.push(to) });
		};
		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, [unsaved, router]);

	const ask = useCallback(
		(go: () => void) => {
			if (unsaved) setPending({ go });
			else go();
		},
		[unsaved],
	);
	const stay = useCallback(() => setPending(null), []);
	const leave = useCallback(() => {
		const item = pending;
		setPending(null);
		item?.go();
	}, [pending]);

	return { asking: unsaved && pending !== null, ask, stay, leave };
}

/** The question itself; it takes the focus when it appears, and Escape answers "Ở lại". */
export function LeaveNotice({ guard }: { guard: LeaveGuard }) {
	const stayRef = useRef<HTMLButtonElement>(null);
	const { asking } = guard;
	useEffect(() => {
		if (asking) stayRef.current?.focus();
	}, [asking]);
	if (!guard.asking) return null;
	return (
		<div
			className="tq-alert tq-alert--warning"
			role="alert"
			aria-labelledby="tq-leave-title"
			onKeyDown={(event) => {
				if (event.key === "Escape") guard.stay();
			}}
		>
			<p id="tq-leave-title" style={{ margin: "0 0 8px" }}>
				<strong>Còn thay đổi chưa lưu.</strong> Nếu tiếp tục, những gì bạn vừa nhập sẽ mất.
			</p>
			<div className="tq-actions">
				<button type="button" ref={stayRef} className="tq-btn tq-btn--primary" onClick={guard.stay}>
					Ở lại
				</button>
				<button type="button" className="tq-btn tq-btn--danger" onClick={guard.leave}>
					Bỏ thay đổi
				</button>
			</div>
		</div>
	);
}
