"use client";

import type { ReactNode } from "react";
import { Alert, Button } from "../ui";

/** An error block with a "Thử lại" button, for a screen whose data did not load. */
export function LoadError({ error, onRetry }: { error: string; onRetry: () => void }) {
	return (
		<>
			<Alert kind="error">{error}</Alert>
			<Button variant="secondary" onClick={onRetry}>
				Thử lại
			</Button>
		</>
	);
}

/** A screen the person's role does not reach (the menu hides the link, so this shows only for a typed address). */
export function NoRight({ children = "Bạn không có quyền xem mục này." }: { children?: ReactNode }) {
	return <Alert kind="warning">{children}</Alert>;
}

export function formatBytes(bytes: number | null | undefined): string {
	const n = bytes ?? 0;
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace(".", ",")} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(2).replace(".", ",")} GB`;
}

/** yyyy-mm-dd as dd/mm/yyyy. */
export function dayText(iso: string): string {
	const [y, m, d] = iso.split("-");
	return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Visually hidden, read by screen readers. */
export const SR_ONLY = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 } as const;
