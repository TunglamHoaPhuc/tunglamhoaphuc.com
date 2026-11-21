"use client";

import { useEffect } from "react";

/** Tells the script in the admin layout that React's handlers are attached, so forms may submit. */
export function HydrationFlag() {
	useEffect(() => {
		(window as unknown as { __tqReady?: boolean }).__tqReady = true;
	}, []);
	return null;
}
