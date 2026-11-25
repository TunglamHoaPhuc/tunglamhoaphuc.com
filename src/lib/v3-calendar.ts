// Lịch tu học trên trang chủ V3: những sự kiện nào rơi vào một tháng, theo ĐÚNG cách trang www quyết định
// (src/libs/calendar.ts, src/libs/content/sources/d1.ts của www), từ chính dữ liệu D1 mà admin dùng chung:
//
//  1. Sự kiện riêng lẻ (bảng calendar_event): chỉ những sự kiện admin để "Đã xuất bản" và chưa vào thùng rác (bộ đọc D1 lọc sẵn,
//     xem `livePlain` trong tlhp-content/sources/d1.ts). Tạo, sửa ngày, tạm ẩn, xóa ở admin đổi lịch này trong vòng một phút.
//  2. Khóa lễ thường kỳ (bảng featured_program): quy tắc lặp là ngày âm lịch mà chữ trong phần "tóm tắt" của chương trình nói
//     ("14 và cuối tháng", "mùng 8 và 23", "mùng 1 và ngày rằm 15"), đúng như `programDays` / `regularEvents` của www.
//     Giờ, nơi, ảnh và tên của mỗi ngày lấy từ chương trình đó, nên sửa ở admin là đổi ngay.
//
// Bộ sinh ngày theo luật âm lịch cứng trong src/data/schedule-data.ts (getEventsForMonth) KHÔNG còn là nguồn của lịch. Nó chỉ còn
// làm dự phòng khi D1 không cho biết quy tắc lặp nào (không có chương trình thường kỳ nào) hoặc không đọc được D1 (xem `monthEvents`).
//
// Thuần túy, không đọc mạng, không ghi: nhận vào bản ghi lịch mà /api/admin/schedule trả (src/lib/v3-data.ts toScheduleData).
import { convertSolarToLunar } from "@/lib/lunar-calendar";
import {
	getEventsForMonth,
	MONTH_THEMES,
	type CalendarEvent,
	type MonthThemeInfo,
	type MultiDayInfo,
} from "@/data/schedule-data";
import { toSlug } from "@/lib/schedule-detail";

/** Khóa lễ thường kỳ như /api/admin/schedule gửi (featuredPrograms). */
export interface CalendarProgram {
	id: string;
	slug?: string;
	title: string;
	subtitle?: string;
	time?: string;
	duration?: string;
	location?: string;
	schedule?: string;
	summary: string;
	imgUrl?: string;
	imgPositionY?: number;
}

/** Sự kiện đang hiển thị như /api/admin/schedule gửi (customEvents). Ngày theo dạng "DD.MM.YYYY". */
export interface CalendarEventRecord {
	id: string | number;
	slug?: string;
	solarDateStr: string;
	endDateStr?: string;
	isMultiDay?: boolean;
	title: string;
	subtitle?: string;
	category?: string;
	timeSlot1Label?: string;
	timeSlot1Time?: string;
	timeSlot2Label?: string;
	timeSlot2Time?: string;
	location?: string;
	description?: string;
	notes?: string;
	imgUrl?: string;
	imgPositionY?: number;
}

export interface CalendarPayload {
	featuredPrograms?: CalendarProgram[];
	monthThemes?: Record<string, Partial<MonthThemeInfo> & { month?: number }>;
	customEvents?: CalendarEventRecord[];
}

/** Tên loại của khóa lễ thường kỳ, như www (REGULAR trong src/libs/calendar.ts). */
export const REGULAR_CATEGORY = "Khóa Lễ Truyền Thống";

/** Ảnh dùng khi sự kiện chưa có ảnh (giao diện luôn cần một ảnh nền cho hộp chi tiết). */
const DEFAULT_IMAGE = "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp";

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");
const dayNumber = (year: number, month0: number, day: number) => Math.round(Date.UTC(year, month0, day) / DAY_MS);
const weekday = (year: number, month0: number, day: number) => WEEKDAYS[new Date(Date.UTC(year, month0, day)).getUTCDay()];
const daysIn = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/** "DD.MM.YYYY" → số ngày (đếm theo UTC để không lệch múi giờ); `null` nếu không phải một ngày có thật. */
export function parseDmy(value: string | undefined): number | null {
	const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(value ?? "");
	if (!m) return null;
	const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const stamp = Date.UTC(y, mo - 1, d);
	const back = new Date(stamp);
	return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? Math.round(stamp / DAY_MS) : null;
}

/**
 * Những ngày âm lịch của một khóa lễ thường kỳ, đọc từ lời biên tập viên (y hệt `programDays` của www):
 * "ngày 14 và cuối tháng" → 14 và ngày cuối tháng; "mùng 1 và ngày rằm 15" → 1, 15. Số đi liền "h", ":" (giờ giấc) không tính.
 */
export function programDays(summary: string): { days: number[]; last: boolean } {
	const text = summary.toLocaleLowerCase("vi");
	const days = new Set([...text.matchAll(/(?<![\dh:])(\d{1,2})(?![\dh:])/g)].map((match) => Number(match[1])).filter((day) => day >= 1 && day <= 30));
	if (/rằm/.test(text)) days.add(15);
	return { days: [...days].sort((a, b) => a - b), last: /cuối tháng/.test(text) };
}

/** Có ít nhất một khóa lễ thường kỳ trong D1 không: nếu không, D1 không cho biết quy tắc lặp nào và dự phòng mới được dùng. */
export const hasRecurringRules = (data: CalendarPayload | null | undefined) => (data?.featuredPrograms?.length ?? 0) > 0;

const lunarTag = (day: number, month0: number, year: number) => {
	const l = convertSolarToLunar(day, month0, year);
	return `(${pad(l.day)}.${pad(l.month)}.ÂL)`;
};

/** Các ngày trong tháng có khóa lễ thường kỳ, mỗi ngày là một sự kiện một ngày (như `regularEvents` của www). */
function regularOfMonth(programs: CalendarProgram[], year: number, month0: number): Record<number, CalendarEvent[]> {
	const rules = programs.map((program) => ({ program, ...programDays(program.summary) })).filter((rule) => rule.days.length || rule.last);
	const out: Record<number, CalendarEvent[]> = {};
	if (!rules.length) return out;
	const count = daysIn(year, month0);
	for (let day = 1; day <= count; day++) {
		const lunar = convertSolarToLunar(day, month0, year);
		// Ngày cuối tháng âm: ngày hôm sau là mùng 1 (đúng cách www xét, không cần đếm 29 hay 30 ngày).
		const next = new Date(Date.UTC(year, month0, day + 1));
		const isLast = convertSolarToLunar(next.getUTCDate(), next.getUTCMonth(), next.getUTCFullYear()).day === 1;
		for (const { program, days, last } of rules) {
			if (!days.includes(lunar.day) && !(last && isLast)) continue;
			const time = (program.time ?? "").trim() || (program.schedule ?? "").trim();
			const duration = (program.duration ?? "").trim();
			(out[day] ??= []).push({
				id: `${program.id}-${year}-${pad(month0 + 1)}-${pad(day)}`,
				day,
				solarDateStr: `${pad(day)}.${pad(month0 + 1)}.${year}`,
				dayOfWeekStr: weekday(year, month0, day),
				lunarDate: lunarTag(day, month0, year),
				lunarTag: "CỘNG TU",
				subTitle1: program.subtitle || "Khóa lễ",
				title: program.title,
				subtitle: program.subtitle ?? "",
				subTitle2: `Ngày ${lunar.day} âm lịch`,
				description: program.summary,
				category: REGULAR_CATEGORY,
				location: program.location ?? "",
				timeSlot1Label: "Thời khóa",
				timeSlot1Time: time || undefined,
				timeSlot2Label: duration ? "Thời lượng" : undefined,
				timeSlot2Time: duration || undefined,
				color: "#D97706",
				imgUrl: program.imgUrl || DEFAULT_IMAGE,
				imgPositionY: program.imgPositionY ?? 50,
				isImportant: true,
				slug: program.slug || toSlug(program.title),
			});
		}
	}
	return out;
}

/** Sự kiện riêng lẻ: phủ vào từng ngày của tháng nằm trong [bắt đầu, kết thúc] (như `eventsInMonth` + `monthGrid` của www). */
function eventsOfMonth(records: CalendarEventRecord[], year: number, month0: number): Record<number, CalendarEvent[]> {
	const out: Record<number, CalendarEvent[]> = {};
	const count = daysIn(year, month0);
	for (const record of records) {
		const start = parseDmy(record.solarDateStr);
		if (start === null) continue;
		const end = Math.max(start, parseDmy(record.endDateStr) ?? start);
		const multi = end > start;
		for (let day = 1; day <= count; day++) {
			const here = dayNumber(year, month0, day);
			if (here < start || here > end) continue;
			const index = here - start + 1;
			const total = end - start + 1;
			const multiDayInfo: MultiDayInfo | undefined = multi
				? { totalDays: total, currentDayIndex: index, isFirstDay: index === 1, isLastDay: here === end, startDateStr: record.solarDateStr, endDateStr: record.endDateStr ?? record.solarDateStr }
				: undefined;
			const isCongTu = record.category === "Cộng Tu";
			const subtitle = record.subtitle || "";
			(out[day] ??= []).push({
				id: record.id,
				day,
				solarDateStr: `${pad(day)}.${pad(month0 + 1)}.${year}`,
				endDateStr: record.endDateStr,
				isMultiDay: multi,
				multiDayInfo,
				dayOfWeekStr: weekday(year, month0, day),
				lunarDate: lunarTag(day, month0, year),
				lunarTag: isCongTu ? "CỘNG TU" : "SỰ KIỆN",
				subTitle1: subtitle || (isCongTu ? "Cộng tu" : "Đại lễ sự kiện"),
				title: record.title,
				subtitle,
				subTitle2: record.location || "",
				description: record.description || "",
				category: record.category || "Đại Lễ Sự Kiện",
				location: record.location || "",
				timeSlot1Label: record.timeSlot1Label || "Thời Khóa",
				timeSlot1Time: record.timeSlot1Time || undefined,
				timeSlot2Label: record.timeSlot2Label,
				timeSlot2Time: record.timeSlot2Time || undefined,
				color: isCongTu ? "#10B981" : "#F2C14E",
				imgUrl: record.imgUrl || DEFAULT_IMAGE,
				imgPositionY: record.imgPositionY ?? 50,
				isImportant: true,
				slug: record.slug || toSlug(record.title),
				notes: record.notes || "",
			});
		}
	}
	return out;
}

export type MonthEvents = {
	/** Ngày trong tháng (1–31) → các sự kiện của ngày đó. */
	byDay: Record<number, CalendarEvent[]>;
	/** "d1": từ D1 như www; "fallback": bộ sinh dự phòng vì D1 không có quy tắc lặp nào / không đọc được. */
	source: "d1" | "fallback";
};

/**
 * Các sự kiện của một tháng dương (`month0` từ 0). Như www, trong một ngày sự kiện riêng lẻ đứng trước, rồi tới khóa lễ thường kỳ.
 * `data = null` là chưa biết gì về D1 (đọc lỗi): dùng dự phòng. Còn chờ phản hồi thì trang không gọi hàm này mà để lịch trống.
 */
export function monthEvents(data: CalendarPayload | null | undefined, year: number, month0: number): MonthEvents {
	if (!data || !hasRecurringRules(data)) return { byDay: fallbackOfMonth(data, year, month0), source: "fallback" };
	const own = eventsOfMonth(data.customEvents ?? [], year, month0);
	const regular = regularOfMonth(data.featuredPrograms ?? [], year, month0);
	const byDay: Record<number, CalendarEvent[]> = {};
	for (const day of new Set([...Object.keys(own), ...Object.keys(regular)].map(Number))) byDay[day] = [...(own[day] ?? []), ...(regular[day] ?? [])];
	return { byDay, source: "d1" };
}

/**
 * Dự phòng: bộ sinh theo luật âm lịch cứng (getEventsForMonth), cộng các sự kiện riêng lẻ nếu D1 có. Một ngày đã có sự kiện của D1
 * trùng tên thì bỏ sự kiện sinh ra (như lịch cũ làm), để không hiện đôi.
 */
function fallbackOfMonth(data: CalendarPayload | null | undefined, year: number, month0: number): Record<number, CalendarEvent[]> {
	const base = getEventsForMonth(year, month0);
	const own = eventsOfMonth(data?.customEvents ?? [], year, month0);
	const byDay: Record<number, CalendarEvent[]> = {};
	for (const day of new Set([...Object.keys(base), ...Object.keys(own)].map(Number))) {
		const names = new Set((own[day] ?? []).map((event) => event.title.toLowerCase().trim()));
		const generated = (base[day] ?? []).filter((event) => !names.has(event.title.toLowerCase().trim())).map((event) => ({ ...event, slug: event.slug || toSlug(event.title) }));
		byDay[day] = [...generated, ...(own[day] ?? [])];
	}
	return byDay;
}

const bundled = (month0: number): MonthThemeInfo => MONTH_THEMES[month0] ?? MONTH_THEMES[0];

/**
 * Chủ đề của một tháng (tranh, câu thơ, tác giả): từ bảng month_theme của D1 khi admin đã nhập cho tháng đó (V3 chỉ giữ màu của mình,
 * vì admin không có trường màu), còn không thì chủ đề đóng gói sẵn của V3. `toScheduleData` đã gộp hai nguồn; hàm này chỉ chốt các trường trống.
 */
export function resolveMonthTheme(data: CalendarPayload | null | undefined, month0: number): MonthThemeInfo {
	const base = bundled(month0);
	const mt = data?.monthThemes?.[String(month0)];
	if (!mt) return base;
	return {
		month: mt.month || month0 + 1,
		bannerImg: mt.bannerImg || base.bannerImg || "",
		title: mt.title || "",
		quoteLines: Array.isArray(mt.quoteLines) ? mt.quoteLines : [],
		author: mt.author || "Vô Trí - Tâm Hòa",
		primaryColor: mt.primaryColor || "#8B3A1C",
		secondaryColor: mt.secondaryColor || "#F2C14E",
		themeBg: mt.themeBg || "#2A170F",
		quoteImg: mt.quoteImg || base.quoteImg,
		quoteTitle: mt.quoteTitle || base.quoteTitle,
	};
}
