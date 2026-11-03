import { describe, expect, it } from "vitest";
import { buddhistYear, lunarDate, lunarYearName } from "@/libs/lunar";

describe("lunarDate", () => {
	// Days the temple keeps every year, from the published Vietnamese calendars.
	const FEASTS: [string, string, number, number][] = [
		["Tết", "2025-01-29", 1, 1],
		["Tết", "2026-02-17", 1, 1],
		["Tết", "2027-02-06", 1, 1],
		["Rằm tháng Giêng", "2025-02-12", 15, 1],
		["Rằm tháng Giêng", "2026-03-03", 15, 1],
		["Rằm tháng Giêng", "2027-02-20", 15, 1],
		["Phật đản", "2025-05-12", 15, 4],
		["Phật đản", "2026-05-31", 15, 4],
		["Phật đản", "2027-05-20", 15, 4],
		["Vu Lan", "2025-09-06", 15, 7],
		["Vu Lan", "2026-08-27", 15, 7],
		["Vu Lan", "2027-08-16", 15, 7],
	];
	for (const [name, day, lunarDay, lunarMonth] of FEASTS) {
		it(`${name} ${day} is ${lunarDay}/${lunarMonth}`, () => {
			expect(lunarDate(day)).toMatchObject({ day: lunarDay, month: lunarMonth, leap: false });
		});
	}

	it("knows the leap sixth month of 2025 (Ất Tỵ)", () => {
		expect(lunarDate("2025-07-24")).toEqual({ day: 30, month: 6, year: 2025, leap: false });
		expect(lunarDate("2025-07-25")).toEqual({ day: 1, month: 6, year: 2025, leap: true });
		expect(lunarDate("2025-08-23")).toEqual({ day: 1, month: 7, year: 2025, leap: false });
	});

	it("puts the days before Tết in the old lunar year", () => {
		expect(lunarDate("2026-02-16")).toEqual({ day: 29, month: 12, year: 2025, leap: false });
		expect(lunarDate("2026-01-01")).toMatchObject({ month: 11, year: 2025 });
	});

	// An independent check: the Chinese calendar from ICU, counted in UTC+8. The two agree
	// on every day of 2020–2030 but two months, both where a new moon falls close to midnight:
	// - 2020-12-14 23:16 in Vietnam is already 00:16 on the 15th in China;
	// - 2027-02-06 23:56 in China, still the 6th; ICU's approximation puts the moon a day late,
	//   while the published Vietnamese calendars, like this algorithm, have Tết on the 6th.
	it("matches the Chinese calendar for every day of 2020–2030, but two known months", () => {
		const chinese = new Intl.DateTimeFormat("en-u-ca-chinese", { timeZone: "UTC", day: "numeric", month: "numeric" });
		const known = (iso: string) => (iso >= "2020-12-14" && iso <= "2021-01-12") || (iso >= "2027-02-06" && iso <= "2027-03-07");
		const differences: string[] = [];
		let knownDays = 0;
		for (let time = Date.UTC(2020, 0, 1); time <= Date.UTC(2030, 11, 31); time += 86_400_000) {
			const iso = new Date(time).toISOString().slice(0, 10);
			const parts = chinese.formatToParts(new Date(time));
			const day = Number(parts.find((part) => part.type === "day")!.value);
			const monthText = parts.find((part) => part.type === "month")!.value;
			const ours = lunarDate(iso);
			const same = ours.day === day && ours.month === parseInt(monthText, 10) && ours.leap === /bis/.test(monthText);
			if (known(iso)) knownDays += same ? 0 : 1;
			else if (!same) differences.push(`${iso}: ${ours.day}/${ours.month}${ours.leap ? "N" : ""} vs ${day}/${monthText}`);
		}
		expect(differences).toEqual([]);
		expect(knownDays).toBe(60);
	});
});

describe("lunar year names", () => {
	it("names years by Can Chi", () => {
		expect(lunarYearName(2025)).toBe("Ất Tỵ");
		expect(lunarYearName(2026)).toBe("Bính Ngọ");
		expect(lunarYearName(2027)).toBe("Đinh Mùi");
	});

	it("turns the Buddhist year on Phật đản (15/4)", () => {
		expect(buddhistYear("2026-05-30")).toBe(2569);
		expect(buddhistYear("2026-05-31")).toBe(2570);
		expect(buddhistYear("2026-11-03")).toBe(2570);
		expect(buddhistYear("2027-01-15")).toBe(2570);
	});
});
