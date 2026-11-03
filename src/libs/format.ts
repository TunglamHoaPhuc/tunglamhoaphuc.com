// How dates and numbers read on the site: the Vietnamese way, whatever the server's locale.

/** "2026-10-17" → "17/10/2026". */
export function formatDate(isoDate: string): string {
	const [year, month, day] = isoDate.split("-");
	return `${day}/${month}/${year}`;
}

/** "2026-10-17" → { day: "17", month: "Th10" }, for Bexon's date badge on pictures. */
export function dateBadge(isoDate: string): { day: string; month: string } {
	const [, month, day] = isoDate.split("-");
	return { day, month: `Th${Number(month)}` };
}

const NUMBER = new Intl.NumberFormat("vi-VN");

/** 35404 → "35.404". */
export function formatNumber(value: number): string {
	return NUMBER.format(value);
}
