// The schedule is typed in Vietnam time (UTC+7, no daylight saving) and sent as ISO UTC.
const OFFSET_MS = 7 * 3600_000;

/** "2026-11-21T08:30" (Vietnam time, for <input type="datetime-local">) from an ISO time. */
export function isoToVietnamInput(iso: string | null | undefined): string {
	if (!iso) return "";
	const time = Date.parse(iso);
	if (Number.isNaN(time)) return "";
	return new Date(time + OFFSET_MS).toISOString().slice(0, 16);
}

/** The ISO UTC time of "2026-11-21T08:30" read as Vietnam time; null when it is not a time. */
export function vietnamInputToIso(value: string): string | null {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
	if (!match) return null;
	const [, y, m, d, h, min] = match.map(Number);
	const time = Date.UTC(y, m - 1, d, h, min) - OFFSET_MS;
	return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Today in Vietnam, YYYY-MM-DD. */
export const vietnamToday = () => new Date(Date.now() + OFFSET_MS).toISOString().slice(0, 10);
