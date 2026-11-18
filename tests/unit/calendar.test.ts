import { describe, expect, it } from "vitest";
import {
	calendarHref,
	eventPath,
	eventStatus,
	eventsInMonth,
	findScheduleItem,
	lunarRange,
	lunarSpan,
	monthGrid,
	programDays,
	readCalendarState,
	regularEvents,
	shiftMonth,
	solarRange,
	todayInVietnam,
} from "@/libs/calendar";
import { categorySlug, parseSchedule } from "@/libs/content/schedule";
import { lunarDate } from "@/libs/lunar";
import type { ScheduleEvent } from "@/libs/content/types";

const event = (id: string, start: string, end = start): ScheduleEvent => ({
	id,
	slug: id,
	title: id,
	subtitle: "",
	category: { slug: "cong-tu", name: "Cộng Tu" },
	start,
	end,
	times: [],
	location: "",
	description: "",
	notes: "",
	image: null,
	video: null,
});

describe("schedule file", () => {
	const { schedule, issues } = parseSchedule({
		success: true,
		data: {
			customEvents: [
				{
					id: "b",
					slug: "luong-hoang-sam",
					solarDateStr: "09.11.2026",
					isMultiDay: true,
					endDateStr: "18.11.2026",
					title: "  LƯƠNG HOÀNG SÁM ",
					category: "Cộng Tu",
					timeSlot1Label: "Tụng kinh",
					timeSlot1Time: "08h00 và 14h00",
					timeSlot2Label: "",
					timeSlot2Time: "",
					imgUrl: "https://bucket-la.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/01-trang-chu/a.webp",
					imgPositionY: 33,
					videoUrl: "https://www.youtube.com/watch?v=_amloxxse2c&list=PL2",
				},
				{ id: "a", solarDateStr: "04.10.2026", title: "PHÁP HỘI NIỆM PHẬT", category: "Khóa Lễ Truyền Thống", endDateStr: "01.10.2026" },
				{ id: "c", solarDateStr: "31.02.2026", title: "Ngày không có thật" },
			],
			featuredPrograms: [{ id: "p1", title: "ĐẠI SÁM HỐI ", schedule: "19h00 ", summary: "Ngày 14 và cuối tháng âm lịch" }],
			monthThemes: { 0: { month: 1, title: "Đức Bản Sư Thành Đạo", bannerImg: "", quoteLines: ["<b>Hạnh phúc</b> là <i>khi</i> & thế"], author: "Vô Trí" } },
			quoteGallery: [{ id: "quote-1", url: "/images/lich-tu-hoc/quotes/thang-01.png", title: "Quy y Tam Bảo" }],
		},
	});

	it("reads events in date order with clean text, days, times and video", () => {
		expect(schedule.events.map((item) => item.id)).toEqual(["a", "b"]);
		expect(schedule.events[1]).toMatchObject({
			title: "LƯƠNG HOÀNG SÁM",
			slug: "luong-hoang-sam",
			category: { slug: "cong-tu", name: "Cộng Tu" },
			start: "2026-11-09",
			end: "2026-11-18",
			times: [{ label: "Tụng kinh", time: "08h00 và 14h00" }],
			image: { position: "center 33%" },
			video: { id: "_amloxxse2c" },
		});
	});

	it("treats a single-day event's end date as its start, and an event without a slug by its id", () => {
		expect(schedule.events[0]).toMatchObject({ start: "2026-10-04", end: "2026-10-04", slug: "a", image: null, video: null });
	});

	it("reports what it skipped or found odd", () => {
		expect(issues.filter((issue) => issue.kind === "invalid").map((issue) => issue.id)).toEqual(["c"]);
		expect(issues.filter((issue) => issue.kind === "other-bucket").map((issue) => issue.id)).toEqual(["b"]);
	});

	it("keeps only <b> in verse lines", () => {
		expect(schedule.themes[0].lines).toEqual(["<b>Hạnh phúc</b> là &lt;i&gt;khi&lt;/i&gt; &amp; thế"]);
		expect(schedule.programs[0]).toMatchObject({ title: "ĐẠI SÁM HỐI", time: "19h00" });
		expect(schedule.quotes).toEqual([{ id: "quote-1", src: "/images/lich-tu-hoc/quotes/thang-01.png", title: "Quy y Tam Bảo" }]);
	});

	it("gives the schedule categories the slugs of the post categories", () => {
		expect(categorySlug("Khóa Lễ Truyền Thống")).toBe("khoa-le-truyen-thong");
		expect(categorySlug("Đại Lễ Sự Kiện")).toBe("dai-le-su-kien");
		expect(categorySlug("Cộng Tu")).toBe("cong-tu");
	});

	it("does not fail on a missing or broken file", () => {
		expect(parseSchedule(null).schedule.events).toEqual([]);
		expect(parseSchedule({ data: { customEvents: "x" } }).schedule.events).toEqual([]);
	});
});

describe("calendar", () => {
	it("counts today in Vietnam", () => {
		expect(todayInVietnam(new Date("2026-11-03T16:59:59Z"))).toBe("2026-11-03");
		expect(todayInVietnam(new Date("2026-11-03T17:00:00Z"))).toBe("2026-11-04");
	});

	it("reads the month and type from the URL, falling back to this month", () => {
		expect(readCalendarState({ thang: "2026-12", loai: "cong-tu" }, "2026-11-03")).toEqual({ month: "2026-12", type: "cong-tu" });
		for (const thang of ["2026-13", "2026-1", "abc", undefined]) {
			expect(readCalendarState({ thang }, "2026-11-03").month).toBe("2026-11");
		}
		expect(calendarHref({ month: "2026-11", type: "" }, "2026-11-03")).toBe("/lich-tu-hoc");
		expect(calendarHref({ month: "2027-01", type: "cong-tu" }, "2026-11-03", "#lich")).toBe("/lich-tu-hoc?thang=2027-01&loai=cong-tu#lich");
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftMonth("2026-01", -1)).toBe("2025-12");
	});

	it("lays a month out Monday to Sunday with lunar dates and events", () => {
		const events = [event("one", "2026-11-07"), event("run", "2026-10-30", "2026-11-02")];
		const weeks = monthGrid("2026-11", events, "2026-11-03");
		// 1 November 2026 is a Sunday.
		expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
		expect(weeks[0][6]).toMatchObject({ date: "2026-11-01", day: 1, events: [{ id: "run" }] });
		expect(weeks).toHaveLength(6);
		const days = weeks.flat().filter((day) => day !== null);
		expect(days).toHaveLength(30);
		expect(days.find((day) => day.today)?.date).toBe("2026-11-03");
		expect(days.find((day) => day.date === "2026-11-07")).toMatchObject({ lunar: { day: 29, month: 9, year: 2026 }, events: [{ id: "one" }] });
		expect(eventsInMonth(events, "2026-10").map((item) => item.id)).toEqual(["run"]);
		expect(eventsInMonth(events, "2026-12")).toEqual([]);
	});

	it("tells past, current and coming events apart", () => {
		const run = event("run", "2026-11-09", "2026-11-18");
		expect(eventStatus(run, "2026-11-08").label).toBe("Sắp diễn ra");
		expect(eventStatus(run, "2026-11-09").label).toBe("Đang diễn ra");
		expect(eventStatus(run, "2026-11-18").label).toBe("Đang diễn ra");
		expect(eventStatus(run, "2026-11-19").label).toBe("Đã kết thúc");
	});

	it("writes dates in both calendars", () => {
		expect(solarRange(event("x", "2026-11-07"))).toBe("Thứ Bảy, 07/11/2026");
		expect(solarRange(event("x", "2026-11-09", "2026-11-18"))).toBe("09/11 – 18/11/2026");
		expect(solarRange(event("x", "2026-12-30", "2027-01-02"))).toBe("30/12/2026 – 02/01/2027");
		expect(lunarRange(event("x", "2026-11-07"))).toBe("29/9 Bính Ngọ");
		expect(lunarRange(event("x", "2026-11-09", "2026-11-18"))).toBe("1/10 – 10/10 Bính Ngọ");
		expect(lunarRange(event("x", "2027-02-05", "2027-02-07"))).toBe("29/12 Bính Ngọ – 2/1 Đinh Mùi");
		expect(lunarSpan("2026-11")).toBe("tháng Chín – tháng Mười âm lịch năm Bính Ngọ");
		expect(lunarSpan("2025-08")).toBe("tháng Sáu nhuận – tháng Bảy âm lịch năm Ất Tỵ");
		expect(lunarSpan("2027-02")).toBe("tháng Chạp năm Bính Ngọ – tháng Giêng năm Đinh Mùi âm lịch");
	});
});

describe("regular ceremonies (khóa lễ thường kỳ)", () => {
	const program = (id: string, title: string, summary: string) => ({ id, title, subtitle: "Khóa lễ", summary, time: "19h00", duration: "", location: "", image: null });
	const programs = [
		program("p1", "ĐẠI SÁM HỐI", "Thời khóa sám hối trang nghiêm vào ngày 14 và cuối tháng âm lịch, nuôi dưỡng tâm bồ đề"),
		program("p2", "TIỂU SÁM HỐI", "Thời khóa tụng kinh sám hối vào ngày mùng 8 và 23 âm lịch, gột rửa thân tâm."),
		program("p3", "CẦU QUỐC THÁI DÂN AN", "Khóa lễ tụng kinh cầu an vào sáng mùng 1 và ngày rằm 15 âm lịch, cầu nguyện quốc thái dân an."),
	];

	it("reads the lunar days from the editors' words", () => {
		expect(programDays(programs[0].summary)).toEqual({ days: [14], last: true });
		expect(programDays(programs[1].summary)).toEqual({ days: [8, 23], last: false });
		expect(programDays(programs[2].summary)).toEqual({ days: [1, 15], last: false });
		expect(programDays("Mỗi Chủ nhật")).toEqual({ days: [], last: false });
	});

	it("puts them on the days the old calendar shows for November 2026", () => {
		const days = regularEvents(programs, "2026-11").map((event) => [event.start, event.title]);
		expect(days).toEqual([
			["2026-11-01", "TIỂU SÁM HỐI"],
			["2026-11-08", "ĐẠI SÁM HỐI"],
			["2026-11-09", "CẦU QUỐC THÁI DÂN AN"],
			["2026-11-16", "TIỂU SÁM HỐI"],
			["2026-11-22", "ĐẠI SÁM HỐI"],
			["2026-11-23", "CẦU QUỐC THÁI DÂN AN"],
		]);
		for (const event of regularEvents(programs, "2026-11")) {
			expect(event).toMatchObject({ end: event.start, programId: expect.any(String), category: { slug: "khoa-le-truyen-thong", name: "Khóa Lễ Truyền Thống" } });
		}
	});

	it("keeps doing so in every month ahead, the last day of a 29-day lunar month included", () => {
		for (let by = 0; by < 24; by++) {
			const month = shiftMonth("2026-11", by);
			for (const event of regularEvents(programs, month)) {
				const lunar = lunarDate(event.start).day;
				const isLast = lunarDate(lastDayAfter(event.start)).day === 1;
				if (event.programId === "p1") expect(lunar === 14 || isLast, event.start).toBe(true);
				if (event.programId === "p2") expect([8, 23]).toContain(lunar);
				if (event.programId === "p3") expect([1, 15]).toContain(lunar);
			}
			expect(regularEvents(programs, month).length, month).toBeGreaterThanOrEqual(5);
		}
	});
});

function lastDayAfter(date: string): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

describe("event pages", () => {
	const ceremony = { id: "p3", title: "CẦU QUỐC THÁI DÂN AN", subtitle: "Khóa lễ", summary: "Cầu an vào sáng mùng 1 và ngày rằm 15 âm lịch.", time: "08h00", duration: "90 phút", location: "", image: null };
	const schedule = { events: [event("phap-hoi-niem-phat-thang-9-binh-ngo-2026", "2026-11-07")], programs: [ceremony], themes: [], quotes: [] };

	it("gives every event and every regular ceremony its own page, at the old addresses", () => {
		expect(eventPath(schedule.events[0])).toBe("/lich-tu-hoc/phap-hoi-niem-phat-thang-9-binh-ngo-2026");
		const [day] = regularEvents([ceremony], "2026-11");
		expect(eventPath(day)).toBe("/lich-tu-hoc/cau-quoc-thai-dan-an");
	});

	it("finds an event or a ceremony by its slug, with the ceremony's next days", () => {
		expect(findScheduleItem(schedule, "phap-hoi-niem-phat-thang-9-binh-ngo-2026", "2026-11-18")).toMatchObject({ event: { id: "phap-hoi-niem-phat-thang-9-binh-ngo-2026" } });
		const found = findScheduleItem(schedule, "cau-quoc-thai-dan-an", "2026-11-18");
		expect(found).toMatchObject({ program: { id: "p3" } });
		expect(found && "upcoming" in found ? found.upcoming.slice(0, 3).map((day) => day.start) : []).toEqual(["2026-11-23", "2026-12-09", "2026-12-23"]);
		expect(findScheduleItem(schedule, "khong-co", "2026-11-18")).toBeNull();
	});
});
