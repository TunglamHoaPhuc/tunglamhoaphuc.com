// "Còn N ngày" before an event: days counted on Vietnam's calendar, so the number turns over
// at midnight in Vietnam whatever the server's clock. Worked out on the server per request.
import { todayInVietnam } from "@/libs/calendar";

const DAY_MS = 86_400_000;

/** Whole days from today in Vietnam to a day: 0 today, 1 tomorrow, negative once past. */
export function daysUntil(isoDate: string, now = new Date()): number {
	const today = todayInVietnam(now);
	return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** "Còn 4 ngày", or "Diễn ra hôm nay" on the day. */
export function countdownLabel(days: number): string {
	return days <= 0 ? "Diễn ra hôm nay" : `Còn ${days} ngày`;
}
