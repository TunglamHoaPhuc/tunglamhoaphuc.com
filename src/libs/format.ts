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

/**
 * "TIỂU SỬ SA MÔN THÍCH TÂM HÒA" → "Tiểu Sử Sa Môn Thích Tâm Hòa", for <title> and search
 * results, where all capitals read as shouting. Text that already has small letters stays.
 */
export function titleCase(text: string): string {
	if (text !== text.toLocaleUpperCase("vi")) return text;
	return text.toLocaleLowerCase("vi").replace(/(^|[\s(–-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase("vi"));
}
