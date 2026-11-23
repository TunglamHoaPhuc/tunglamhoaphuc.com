// The Vietnamese lunar calendar, after Hồ Ngọc Đức's algorithm ("Âm lịch Việt Nam",
// https://www.informatik.uni-leipzig.de/~duc/amlich/), counted in Vietnam's time zone
// (UTC+7). Pure arithmetic on the day number, so the server and tests agree.

const TIME_ZONE = 7;
const DEGREE = Math.PI / 180;

export type LunarDate = {
	day: number;
	month: number;
	/** The lunar year, which starts at Tết: 2026-02-16 is still in 2025 (Ất Tỵ). */
	year: number;
	/** The repeated (nhuận) month of a 13-month year. */
	leap: boolean;
};

/** Julian day number of a day of the Gregorian calendar. */
function jdFromDate(day: number, month: number, year: number): number {
	const a = Math.floor((14 - month) / 12);
	const y = year + 4800 - a;
	const m = month + 12 * a - 3;
	return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

/** Julian day of the k-th new moon after 1900-01-01 (Jean Meeus, "Astronomical Algorithms"). */
function newMoon(k: number): number {
	const t = k / 1236.85;
	const t2 = t * t;
	const t3 = t2 * t;
	let jd = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
	jd += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * DEGREE);
	const sun = (359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3) * DEGREE;
	const moon = (306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3) * DEGREE;
	const node = (21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3) * DEGREE;
	let c = (0.1734 - 0.000393 * t) * Math.sin(sun) + 0.0021 * Math.sin(2 * sun);
	c += -0.4068 * Math.sin(moon) + 0.0161 * Math.sin(2 * moon) - 0.0004 * Math.sin(3 * moon);
	c += 0.0104 * Math.sin(2 * node) - 0.0051 * Math.sin(sun + moon) - 0.0074 * Math.sin(sun - moon);
	c += 0.0004 * Math.sin(2 * node + sun) - 0.0004 * Math.sin(2 * node - sun) - 0.0006 * Math.sin(2 * node + moon);
	c += 0.001 * Math.sin(2 * node - moon) + 0.0005 * Math.sin(2 * moon + sun);
	const deltaT = t < -11 ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3 : -0.000278 + 0.000265 * t + 0.000262 * t2;
	return jd + c - deltaT;
}

/** The sun's longitude at a Julian day, in radians from 0 to 2π. */
function sunLongitude(jd: number): number {
	const t = (jd - 2451545.0) / 36525;
	const t2 = t * t;
	const mean = (357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t * t2) * DEGREE;
	const longitude = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
	let center = (1.9146 - 0.004817 * t - 0.000014 * t2) * Math.sin(mean);
	center += (0.019993 - 0.000101 * t) * Math.sin(2 * mean) + 0.00029 * Math.sin(3 * mean);
	const angle = (longitude + center) * DEGREE;
	return angle - 2 * Math.PI * Math.floor(angle / (2 * Math.PI));
}

/** Which of the 12 major solar terms (30° each) the sun is in at the start of a local day. */
function solarTerm(dayNumber: number): number {
	return Math.floor((sunLongitude(dayNumber - 0.5 - TIME_ZONE / 24) / Math.PI) * 6);
}

/** Local day number on which the k-th new moon falls. */
function newMoonDay(k: number): number {
	return Math.floor(newMoon(k) + 0.5 + TIME_ZONE / 24);
}

/** First day of the 11th lunar month, the one holding the winter solstice, of a year. */
function month11(year: number): number {
	const k = Math.floor((jdFromDate(31, 12, year) - 2415021) / 29.530588853);
	const day = newMoonDay(k);
	return solarTerm(day) >= 9 ? newMoonDay(k - 1) : day;
}

/** In a 13-month year, how many months after month 11 the leap month comes. */
function leapMonthOffset(start: number): number {
	const k = Math.floor((start - 2415021.076998695) / 29.530588853 + 0.5);
	let i = 1;
	let term = solarTerm(newMoonDay(k + i));
	let last: number;
	do {
		last = term;
		i++;
		term = solarTerm(newMoonDay(k + i));
	} while (term !== last && i < 14);
	return i - 1;
}

/** The lunar date of a day ("2026-02-17" → 1/1/2026). */
export function lunarDate(isoDate: string): LunarDate {
	const [y, m, d] = isoDate.split("-").map(Number);
	const dayNumber = jdFromDate(d, m, y);
	const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
	let monthStart = newMoonDay(k + 1);
	if (monthStart > dayNumber) monthStart = newMoonDay(k);

	let a11 = month11(y);
	let b11 = a11;
	let year: number;
	if (a11 >= monthStart) {
		year = y;
		a11 = month11(y - 1);
	} else {
		year = y + 1;
		b11 = month11(y + 1);
	}
	const diff = Math.floor((monthStart - a11) / 29);
	let month = diff + 11;
	let leap = false;
	if (b11 - a11 > 365) {
		const offset = leapMonthOffset(a11);
		if (diff >= offset) {
			month = diff + 10;
			leap = diff === offset;
		}
	}
	if (month > 12) month -= 12;
	if (month >= 11 && diff < 4) year -= 1;
	return { day: dayNumber - monthStart + 1, month, year, leap };
}

const STEMS = ["Canh", "Tân", "Nhâm", "Quý", "Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ"];
const BRANCHES = ["Thân", "Dậu", "Tuất", "Hợi", "Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi"];

/** Can Chi name of a lunar year: 2026 → "Bính Ngọ". */
export function lunarYearName(year: number): string {
	return `${STEMS[year % 10]} ${BRANCHES[year % 12]}`;
}

/** Phật lịch of a day. It turns over on Phật đản (15/4 lunar), not at Tết. */
export function buddhistYear(isoDate: string): number {
	const { day, month, year, leap } = lunarDate(isoDate);
	const afterVesak = month > 4 || (month === 4 && (leap || day >= 15));
	return year + (afterVesak ? 544 : 543);
}

const MONTH_NAMES = ["Giêng", "Hai", "Ba", "Tư", "Năm", "Sáu", "Bảy", "Tám", "Chín", "Mười", "Mười Một", "Chạp"];

/** "tháng Giêng", "tháng Sáu nhuận". */
export function lunarMonthName(month: number, leap = false): string {
	return `tháng ${MONTH_NAMES[month - 1]}${leap ? " nhuận" : ""}`;
}

/** Short form for calendars and cards: "15/7", "1/6N" for a leap month. */
export function shortLunar({ day, month, leap }: LunarDate): string {
	return `${day}/${month}${leap ? "N" : ""}`;
}
