// The lunar dates V3 shows (calendar cells, lunar headers, programme days) must be www's: v3-hero-lunar.ts is a byte copy of www's
// libs/lunar.ts (a parity test guards it), and convertSolarToLunar now follows it. Before, the leap month of 2025 and 2028 was put
// in the wrong place (2025-07-25 is the 1st of the leap 6th month, not the 1st of the 7th).
import assert from "node:assert/strict";
import { test } from "node:test";
import { convertSolarToLunar } from "@/lib/lunar-calendar";
import { lunarDate } from "@/lib/v3-hero-lunar";

const pad = (n: number) => String(n).padStart(2, "0");

test("convertSolarToLunar gives www's lunar day, month, year and leap flag for every day of 2020-2035", () => {
	for (let t = Date.UTC(2020, 0, 1); t <= Date.UTC(2035, 11, 31); t += 86_400_000) {
		const d = new Date(t);
		const [y, m, day] = [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
		const mine = convertSolarToLunar(day, m, y);
		const www = lunarDate(`${y}-${pad(m + 1)}-${pad(day)}`);
		assert.deepEqual({ day: mine.day, month: mine.month, year: mine.year, leap: mine.isLeap }, { day: www.day, month: www.month, year: www.year, leap: www.leap }, `${y}-${pad(m + 1)}-${pad(day)}`);
	}
});

test("the leap month of 2025 starts on 25 July and the can chi stays filled in", () => {
	const first = convertSolarToLunar(25, 6, 2025);
	assert.deepEqual({ day: first.day, month: first.month, leap: first.isLeap }, { day: 1, month: 6, leap: true });
	assert.ok(first.canChiDay && first.canChiYear);
});
