import { describe, expect, it } from "vitest";
import { countdownLabel, daysUntil } from "@/libs/countdown";

describe("daysUntil", () => {
	// 7 November 2026 starts at 2026-11-06T17:00:00Z in Vietnam (UTC+7).
	it("counts whole days in Vietnam, turning over at midnight there", () => {
		expect(daysUntil("2026-11-07", new Date("2026-11-03T02:00:00Z"))).toBe(4);
		expect(daysUntil("2026-11-07", new Date("2026-11-06T16:59:59Z"))).toBe(1);
		expect(daysUntil("2026-11-07", new Date("2026-11-06T17:00:00Z"))).toBe(0);
		expect(daysUntil("2026-11-07", new Date("2026-11-07T16:59:59Z"))).toBe(0);
		expect(daysUntil("2026-11-07", new Date("2026-11-07T17:00:00Z"))).toBe(-1);
	});

	it("is not thrown off by the server's own time zone or a month's end", () => {
		// 23:30 on 31 December in Vietnam, still the 31st there.
		expect(daysUntil("2027-01-01", new Date("2026-12-31T16:30:00Z"))).toBe(1);
		expect(daysUntil("2027-03-01", new Date("2027-02-27T20:00:00Z"))).toBe(1);
	});
});

describe("countdownLabel", () => {
	it("says how long is left in words", () => {
		expect(countdownLabel(4)).toBe("Còn 4 ngày");
		expect(countdownLabel(1)).toBe("Còn 1 ngày");
		expect(countdownLabel(0)).toBe("Diễn ra hôm nay");
	});
});
