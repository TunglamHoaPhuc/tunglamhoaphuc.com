import { describe, expect, it } from "vitest";
import { announcementEndsAt, isAnnouncementActive } from "@/libs/announcement";

const notice = { id: "a", text: "Khóa tu mùa đông mở đăng ký." };

describe("announcement expiry", () => {
	it("runs to the end of the last day in Vietnam time", () => {
		const withEnd = { ...notice, expires: "2026-12-31" };
		expect(isAnnouncementActive(withEnd, Date.parse("2026-12-31T23:30:00+07:00"))).toBe(true);
		// 2026-12-31 17:30 UTC is already 1 January in Vietnam.
		expect(isAnnouncementActive(withEnd, Date.parse("2026-12-31T17:30:00Z"))).toBe(false);
	});

	it("never expires without a date, or with an unreadable one", () => {
		expect(announcementEndsAt(notice)).toBe(Infinity);
		expect(announcementEndsAt({ ...notice, expires: "31/12/2026" })).toBe(Infinity);
	});

	it("is off when the text is empty", () => {
		expect(isAnnouncementActive({ ...notice, text: "  " }, Date.now())).toBe(false);
	});
});
