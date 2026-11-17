// The schedule page's calendar: which month and type the URL asks for (?thang=&loai=), the
// month grid Monday → Sunday with lunar dates, and where each event stands today. Days are
// counted in Vietnam, whatever the server's clock.
import type { RegularProgram, ScheduleEvent } from "@/libs/content/types";
import { formatDate } from "@/libs/format";
import { type LunarDate, lunarDate, lunarMonthName, lunarYearName, shortLunar } from "@/libs/lunar";

export const CALENDAR_PATH = "/lich-tu-hoc";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
export const WEEKDAY_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** Today in Vietnam, YYYY-MM-DD. */
export function todayInVietnam(now = new Date()): string {
	return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** 0 for Monday … 6 for Sunday. */
function weekdayIndex(isoDate: string): number {
	return (new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function weekdayName(isoDate: string): string {
	return WEEKDAYS[weekdayIndex(isoDate)];
}

function addDays(isoDate: string, days: number): string {
	return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** "2026-11" moved by some months: ("2026-12", 1) → "2027-01". */
export function shiftMonth(month: string, by: number): string {
	const [year, m] = month.split("-").map(Number);
	const date = new Date(Date.UTC(year, m - 1 + by, 1));
	return date.toISOString().slice(0, 7);
}

function daysInMonth(month: string): number {
	const [year, m] = month.split("-").map(Number);
	return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/** The last day of a month: "2026-11" → "2026-11-30". */
export function lastDay(month: string): string {
	return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

/** The lunar months a solar month spans: "tháng Chín – tháng Mười âm lịch năm Bính Ngọ". */
export function lunarSpan(month: string): string {
	const first = lunarDate(`${month}-01`);
	const last = lunarDate(lastDay(month));
	const from = lunarMonthName(first.month, first.leap);
	const to = lunarMonthName(last.month, last.leap);
	if (first.year !== last.year) return `${from} năm ${lunarYearName(first.year)} – ${to} năm ${lunarYearName(last.year)} âm lịch`;
	return `${from === to ? from : `${from} – ${to}`} âm lịch năm ${lunarYearName(last.year)}`;
}

/** "2026-11" → "11/2026". */
export function monthLabel(month: string): string {
	const [year, m] = month.split("-");
	return `${Number(m)}/${year}`;
}

export type CalendarState = {
	/** YYYY-MM. */
	month: string;
	/** Category slug, or "" for every type. */
	type: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
	return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** An odd month falls back to this month; the type is checked by the page. */
export function readCalendarState(params: SearchParams, today: string): CalendarState {
	const month = first(params.thang);
	const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= "1900-01" && month <= "2199-12";
	return { month: valid ? month : today.slice(0, 7), type: first(params.loai) };
}

/** The page URL for a state. The bare path shows this month with every type. */
export function calendarHref(state: CalendarState, today: string, hash = ""): string {
	const query = new URLSearchParams();
	if (state.month !== today.slice(0, 7)) query.set("thang", state.month);
	if (state.type) query.set("loai", state.type);
	const text = query.toString();
	return `${CALENDAR_PATH}${text ? `?${text}` : ""}${hash}`;
}

/** Events that fall at least partly in the month. */
export function eventsInMonth(events: ScheduleEvent[], month: string): ScheduleEvent[] {
	const start = `${month}-01`;
	const end = lastDay(month);
	return events.filter((event) => event.start <= end && event.end >= start);
}

/**
 * The lunar days of a regular ceremony, read from the editors' words as the old calendar
 * does: "ngày 14 và cuối tháng" → 14 and the month's last day, "mùng 1 và ngày rằm 15" → 1, 15.
 */
export function programDays(summary: string): { days: number[]; last: boolean } {
	const text = summary.toLocaleLowerCase("vi");
	const days = new Set([...text.matchAll(/(?<![\dh:])(\d{1,2})(?![\dh:])/g)].map((match) => Number(match[1])).filter((day) => day >= 1 && day <= 30));
	if (/rằm/.test(text)) days.add(15);
	return { days: [...days].sort((a, b) => a - b), last: /cuối tháng/.test(text) };
}

const REGULAR = { slug: "khoa-le-truyen-thong", name: "Khóa Lễ Truyền Thống" };

/** The days of the month on which the regular ceremonies fall, as one-day events, for every month ahead. */
export function regularEvents(programs: RegularProgram[], month: string): ScheduleEvent[] {
	const rules = programs.map((program) => ({ program, ...programDays(program.summary) })).filter((rule) => rule.days.length || rule.last);
	const events: ScheduleEvent[] = [];
	for (let day = 1; day <= daysInMonth(month); day++) {
		const date = addDays(`${month}-01`, day - 1);
		const lunar = lunarDate(date);
		const last = lunarDate(addDays(date, 1)).day === 1;
		for (const { program, days, last: onLast } of rules) {
			if (!days.includes(lunar.day) && !(onLast && last)) continue;
			events.push({
				id: `${program.id}-${date}`,
				slug: `${program.id}-${date}`,
				title: program.title,
				subtitle: program.subtitle,
				category: REGULAR,
				start: date,
				end: date,
				times: program.time ? [{ label: "", time: program.time }] : [],
				location: program.location,
				description: program.summary,
				notes: "",
				image: program.image,
				video: null,
				programId: program.id,
			});
		}
	}
	return events;
}

export type CalendarDay = {
	date: string;
	day: number;
	lunar: LunarDate;
	events: ScheduleEvent[];
	today: boolean;
};

/** The month in weeks from Monday to Sunday; days of the months around it are `null`. */
export function monthGrid(month: string, events: ScheduleEvent[], today: string): (CalendarDay | null)[][] {
	const first = `${month}-01`;
	const cells: (CalendarDay | null)[] = Array.from({ length: weekdayIndex(first) }, () => null);
	for (let day = 1; day <= daysInMonth(month); day++) {
		const date = addDays(first, day - 1);
		cells.push({
			date,
			day,
			lunar: lunarDate(date),
			events: events.filter((event) => event.start <= date && event.end >= date),
			today: date === today,
		});
	}
	while (cells.length % 7) cells.push(null);
	return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export type EventStatus = { key: "past" | "now" | "upcoming"; label: string };

/**
 * Where an event stands on a day. The old admin keeps no registration state, so "Đang mở
 * đăng ký" and "Đã đủ số lượng" wait for registrations (T39).
 */
export function eventStatus(event: ScheduleEvent, today: string): EventStatus {
	if (event.end < today) return { key: "past", label: "Đã kết thúc" };
	if (event.start <= today) return { key: "now", label: "Đang diễn ra" };
	return { key: "upcoming", label: "Sắp diễn ra" };
}

/** "Thứ Bảy, 07/11/2026" or "09/11 – 18/11/2026". */
export function solarRange(event: Pick<ScheduleEvent, "start" | "end">): string {
	if (event.start === event.end) return `${weekdayName(event.start)}, ${formatDate(event.start)}`;
	const start = formatDate(event.start);
	const sameYear = event.start.slice(0, 4) === event.end.slice(0, 4);
	return `${sameYear ? start.slice(0, 5) : start} – ${formatDate(event.end)}`;
}

/** "27/9 Bính Ngọ" or "29/9 – 9/10 Bính Ngọ". */
export function lunarRange(event: Pick<ScheduleEvent, "start" | "end">): string {
	const start = lunarDate(event.start);
	const end = lunarDate(event.end);
	const startText = start.year === end.year ? shortLunar(start) : `${shortLunar(start)} ${lunarYearName(start.year)}`;
	const range = event.start === event.end ? shortLunar(start) : `${startText} – ${shortLunar(end)}`;
	return `${range} ${lunarYearName(end.year)}`;
}
