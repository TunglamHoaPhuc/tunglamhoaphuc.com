// Lịch tu học trên trang chủ V3 theo admin dùng chung: tập sự kiện của một tháng đến từ D1 như www quyết định (sự kiện đã xuất bản
// + khóa lễ thường kỳ theo ngày âm lịch trong chương trình), nên tạo / sửa / ẩn / xóa ở admin đổi lịch. Bộ sinh cứng chỉ là dự phòng.
// Kiểm thử này chạy bằng chính bộ đọc D1 của V3 (createD1Repository) trên một D1 giả có đủ trạng thái, rồi qua toScheduleData và
// monthEvents (đúng đường đi của /api/admin/schedule -> CalendarSection). Khứ hồi với mã admin thật của www: v3-calendar-www-parity.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import scheduleBase from "@/data/schedule-database.json";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { hasRecurringRules, monthEvents, parseDmy, programDays, resolveMonthTheme, REGULAR_CATEGORY, type CalendarPayload } from "@/lib/v3-calendar";
import { toScheduleData } from "@/lib/v3-data";
import { createFakeD1, isoIn, type FakeD1 } from "../helpers/d1";

const PROGRAMS = [
	{ id: "kp1", title: "ĐẠI SÁM HỐI", subtitle: "Khóa lễ", summary: "Thời khóa sám hối tối 19h00 ngày 14 và cuối tháng âm lịch", time: "19h00", duration: "90 phút", location: "Chánh Điện", position: 1 },
	{ id: "kp2", title: "TIỂU SÁM HỐI", subtitle: "Khóa lễ", summary: "Tụng kinh tối 19h00 ngày mùng 8 và 23 âm lịch", time: "19h00", duration: "", location: "Chánh Điện", position: 2 },
	{ id: "kp3", title: "CẦU QUỐC THÁI DÂN AN", subtitle: "Khóa lễ", summary: "Khóa lễ sáng 08h00 mùng 1 và ngày rằm 15 âm lịch", time: "08h00", duration: "", location: "Sân Di Đà", position: 3 },
];

function world(options: { programs?: boolean } = {}) {
	const db = createFakeD1();
	db.insert("category", { id: "e1", slug: "cong-tu", name: "Cộng Tu", kind: "event" });
	db.insert("category", { id: "e2", slug: "dai-le-su-kien", name: "Đại Lễ Sự Kiện", kind: "event" });
	for (const p of options.programs === false ? [] : PROGRAMS) db.insert("featured_program", p);
	return db;
}
const event = (db: FakeD1, id: string, title: string, start: string, end = start, extra: Record<string, unknown> = {}) =>
	db.insert("calendar_event", { id, slug: id, title, category_id: "e1", start_date: start, end_date: end, times: "[]", ...extra });

/** Đường đi thật: D1 -> bộ đọc của V3 -> JSON của /api/admin/schedule -> sự kiện của tháng (month là 1–12). */
async function month(db: FakeD1, year: number, m: number) {
	const data = toScheduleData(await createD1Repository(db).getSchedule()) as unknown as CalendarPayload;
	return { data, ...monthEvents(data, year, m - 1) };
}
/** Chủ đề đóng gói của V3 (tệp schedule-database.json, khóa 0–11) mà toScheduleData giữ cho tháng admin chưa nhập. */
const bundled = (month0: number) => (scheduleBase.monthThemes as unknown as Record<string, { title: string; quoteLines: string[]; bannerImg: string; primaryColor: string; themeBg: string }>)[String(month0)];
const titlesOn = (byDay: Record<number, { title: string }[]>, day: number) => (byDay[day] ?? []).map((e) => e.title);
const daysOf = (byDay: Record<number, { title: string }[]>, title: string) => Object.keys(byDay).map(Number).filter((d) => byDay[d].some((e) => e.title === title)).sort((a, b) => a - b);

test("programDays đọc ngày âm từ lời biên tập: bỏ giờ giấc, hiểu rằm và cuối tháng", () => {
	assert.deepEqual(programDays("tối 19h00 ngày 14 và cuối tháng âm lịch"), { days: [14], last: true });
	assert.deepEqual(programDays("Khóa lễ sáng 08h00 mùng 1 và ngày rằm 15 âm lịch"), { days: [1, 15], last: false });
	assert.deepEqual(programDays("mùng 8 và 23, tụng 90 phút lúc 19:30"), { days: [8, 23], last: false });
	assert.deepEqual(programDays("Mỗi tháng một lần vào ngày rằm"), { days: [15], last: false });
	assert.deepEqual(programDays("không nói ngày nào"), { days: [], last: false });
});

test("parseDmy chỉ nhận ngày có thật", () => {
	assert.equal(parseDmy("01.12.2026"), parseDmy("1.12.2026"));
	assert.equal((parseDmy("02.12.2026") as number) - (parseDmy("01.12.2026") as number), 1);
	assert.equal(parseDmy("31.02.2026"), null);
	assert.equal(parseDmy(""), null);
	assert.equal(parseDmy(undefined), null);
	assert.equal(parseDmy("2026-12-01"), null);
});

test("khóa lễ thường kỳ rơi đúng ngày âm lịch theo chương trình trong D1 (tháng 11/2026: mùng 1 âm là 9/11)", async () => {
	const { byDay, source } = await month(world(), 2026, 11);
	assert.equal(source, "d1");
	assert.deepEqual(daysOf(byDay, "ĐẠI SÁM HỐI"), [8, 22], "14 âm = 22/11; cuối tháng âm (29/9 âl) = 8/11");
	assert.deepEqual(daysOf(byDay, "TIỂU SÁM HỐI"), [1, 16], "23/9 âl = 1/11; mùng 8 = 16/11");
	assert.deepEqual(daysOf(byDay, "CẦU QUỐC THÁI DÂN AN"), [9, 23], "mùng 1 = 9/11; rằm = 23/11");
	const first = byDay[22][0];
	assert.equal(first.category, REGULAR_CATEGORY);
	assert.equal(first.timeSlot1Time, "19h00");
	assert.equal(first.timeSlot2Time, "90 phút");
	assert.equal(first.location, "Chánh Điện");
	assert.equal(first.slug, "dai-sam-hoi");
	assert.equal(first.solarDateStr, "22.11.2026");
	assert.match(first.lunarDate, /^\(14\.10\.ÂL\)$/);
	assert.equal(byDay[8].length, 1, "8/11 chỉ có Đại sám hối");
});

test("không còn đại lễ cứng của bộ sinh cũ: Phật Đản, Vu Lan, Tết... chỉ hiện khi admin tạo thành sự kiện", async () => {
	// Tháng 11/2026: rằm tháng 10 âl; tháng Giêng 2027: Tết Đinh Mùi (6/2/2027). Bộ sinh cũ tự thêm "ĐẠI LỄ ĐÓN XUÂN DI LẶC" mùng 1–3.
	const db = world();
	const feb = await month(db, 2027, 2);
	assert.ok(!Object.values(feb.byDay).flat().some((e) => /ĐÓN XUÂN|THƯỢNG NGUYÊN|PHẬT ĐẢN|VU LAN/.test(e.title)), "D1 không có sự kiện nào thì lịch không tự bịa đại lễ");
	event(db, "tet", "Đại lễ đón xuân Di Lặc", "2027-02-06", "2027-02-08", { category_id: "e2" });
	const withTet = await month(db, 2027, 2);
	assert.deepEqual(daysOf(withTet.byDay, "Đại lễ đón xuân Di Lặc"), [6, 7, 8]);
});

test("sự kiện admin để Đã xuất bản hiện; nháp, tạm ẩn, hẹn giờ và trong thùng rác thì không", async () => {
	const db = world();
	event(db, "pub", "Khóa tu một ngày", "2026-11-14");
	event(db, "draft", "Sự kiện nháp", "2026-11-14", "2026-11-14", { status: "draft" });
	event(db, "hid", "Sự kiện tạm ẩn", "2026-11-14", "2026-11-14", { status: "hidden" });
	event(db, "sch", "Sự kiện hẹn giờ", "2026-11-14", "2026-11-14", { status: "scheduled" });
	event(db, "pend", "Sự kiện chờ duyệt", "2026-11-14", "2026-11-14", { status: "pending" });
	event(db, "gone", "Sự kiện đã xóa", "2026-11-14", "2026-11-14", { deleted_at: isoIn(-1) });
	const { byDay } = await month(db, 2026, 11);
	assert.deepEqual(titlesOn(byDay, 14), ["Khóa tu một ngày"]);
});

test("admin đổi trạng thái / ngày / xóa thì lịch đổi theo (mỗi lần đọc lại từ D1)", async () => {
	const db = world();
	event(db, "x", "Pháp hội Vô Lượng Thọ", "2026-11-18");
	assert.deepEqual(daysOf((await month(db, 2026, 11)).byDay, "Pháp hội Vô Lượng Thọ"), [18]);
	db.exec("update calendar_event set status = 'hidden' where id = 'x'");
	assert.deepEqual(daysOf((await month(db, 2026, 11)).byDay, "Pháp hội Vô Lượng Thọ"), [], "tạm ẩn: biến mất");
	db.exec("update calendar_event set status = 'published', start_date = '2026-11-20', end_date = '2026-11-20' where id = 'x'");
	assert.deepEqual(daysOf((await month(db, 2026, 11)).byDay, "Pháp hội Vô Lượng Thọ"), [20], "đổi ngày: sang ngày mới");
	assert.deepEqual(daysOf((await month(db, 2026, 12)).byDay, "Pháp hội Vô Lượng Thọ"), []);
	db.exec(`update calendar_event set deleted_at = '${isoIn(0)}' where id = 'x'`);
	assert.deepEqual(daysOf((await month(db, 2026, 11)).byDay, "Pháp hội Vô Lượng Thọ"), [], "vào thùng rác: biến mất");
	db.exec("update calendar_event set deleted_at = null where id = 'x'");
	assert.deepEqual(daysOf((await month(db, 2026, 11)).byDay, "Pháp hội Vô Lượng Thọ"), [20], "khôi phục: hiện lại");
});

test("sự kiện nhiều ngày phủ từng ngày trong tháng, kể cả khi bắt đầu tháng trước hoặc kết thúc tháng sau", async () => {
	const db = world();
	event(db, "m", "Khóa tu mùa đông", "2026-11-29", "2026-12-02", { times: JSON.stringify([{ label: "Khai khóa", time: "06h00" }]), location: "Giảng đường" });
	const nov = (await month(db, 2026, 11)).byDay;
	const dec = (await month(db, 2026, 12)).byDay;
	assert.deepEqual(daysOf(nov, "Khóa tu mùa đông"), [29, 30]);
	assert.deepEqual(daysOf(dec, "Khóa tu mùa đông"), [1, 2]);
	const day29 = nov[29].find((e) => e.title === "Khóa tu mùa đông");
	assert.deepEqual({ ...day29?.multiDayInfo }, { totalDays: 4, currentDayIndex: 1, isFirstDay: true, isLastDay: false, startDateStr: "29.11.2026", endDateStr: "02.12.2026" });
	const day2 = dec[2].find((e) => e.title === "Khóa tu mùa đông");
	assert.equal(day2?.multiDayInfo?.isLastDay, true);
	assert.equal(day2?.multiDayInfo?.currentDayIndex, 4);
	assert.equal(day2?.timeSlot1Time, "06h00", "dòng giờ là của admin, ngày nào cũng vậy");
	assert.equal(nov[29].find((e) => e.title === "Khóa tu mùa đông")?.timeSlot1Time, "06h00");
	assert.equal(nov[29].find((e) => e.title === "Khóa tu mùa đông")?.timeSlot1Label, "Khai khóa");
	assert.equal(nov[29].find((e) => e.title === "Khóa tu mùa đông")?.category, "Cộng Tu");
});

test("trong một ngày, sự kiện đứng trước khóa lễ thường kỳ (như www); không bịa giờ hay nơi", async () => {
	const db = world();
	event(db, "r", "Lễ rằm đặc biệt", "2026-11-23", "2026-11-23", { category_id: "e2" });
	const { byDay } = await month(db, 2026, 11);
	assert.deepEqual(titlesOn(byDay, 23), ["Lễ rằm đặc biệt", "CẦU QUỐC THÁI DÂN AN"]);
	const own = byDay[23][0];
	assert.equal(own.timeSlot1Time, undefined, "admin không nhập giờ thì không hiện giờ");
	assert.equal(own.location, "", "admin không nhập nơi thì không hiện nơi");
	assert.equal(own.category, "Đại Lễ Sự Kiện");
});

test("sửa chương trình thường kỳ ở admin (ngày, giờ, nơi, tên) đổi ngay các ngày của khóa lễ", async () => {
	const db = world();
	db.exec("update featured_program set summary = 'Mỗi tháng vào mùng 10 và 20 âm lịch', time = '20h00', location = 'Giảng đường', title = 'TIỂU SÁM HỐI (mới)' where id = 'kp2'");
	const { byDay } = await month(db, 2026, 11);
	assert.deepEqual(daysOf(byDay, "TIỂU SÁM HỐI"), []);
	// mùng 10 âm = 18/11, 20 âm = 28/11 (mùng 1 = 9/11)
	assert.deepEqual(daysOf(byDay, "TIỂU SÁM HỐI (mới)"), [18, 28]);
	const e = byDay[18].find((x) => x.title === "TIỂU SÁM HỐI (mới)");
	assert.equal(e?.timeSlot1Time, "20h00");
	assert.equal(e?.location, "Giảng đường");
	// Một chương trình mà lời biên tập không nói ngày nào thì không sinh ngày nào (www cũng vậy).
	db.exec("update featured_program set summary = 'Sẽ thông báo sau' where id = 'kp1'");
	assert.deepEqual(daysOf((await month(db, 2026, 11)).byDay, "ĐẠI SÁM HỐI"), []);
});

test("D1 có khóa lễ thường kỳ: bộ sinh cứng không bao giờ được gọi, tháng nào cũng vậy (không có Phật Đản, Vu Lan tự bịa)", async () => {
	const db = world();
	for (let m = 1; m <= 12; m++) {
		const r = await month(db, 2026, m);
		assert.equal(r.source, "d1", `tháng ${m}`);
		const names = new Set(Object.values(r.byDay).flat().map((e) => e.title));
		for (const n of names) assert.ok(PROGRAMS.some((p) => p.title === n), `tháng ${m}: "${n}" không phải chương trình trong D1`);
	}
});

test("dự phòng: D1 không có chương trình thường kỳ nào, hoặc không đọc được D1, thì bộ sinh cũ làm việc", async () => {
	const empty = world({ programs: false });
	assert.equal(hasRecurringRules((await month(empty, 2026, 11)).data), false);
	const r = await month(empty, 2026, 11);
	assert.equal(r.source, "fallback");
	assert.ok(daysOf(r.byDay, "ĐẠI SÁM HỐI").length === 2 && daysOf(r.byDay, "CẦU QUỐC THÁI DÂN AN").length === 2, "khóa lễ định kỳ vẫn có");
	// Đọc lỗi (data = null): vẫn có lịch.
	const failed = monthEvents(null, 2026, 10);
	assert.equal(failed.source, "fallback");
	assert.ok(Object.keys(failed.byDay).length > 0);
	// Sự kiện của D1 vẫn hiện, và đè sự kiện sinh ra trùng tên trong ngày.
	event(empty, "own", "ĐẠI SÁM HỐI", "2026-11-22", "2026-11-22", { location: "Nơi do admin nhập" });
	const merged = await month(empty, 2026, 11);
	assert.equal(merged.byDay[22].filter((e) => e.title === "ĐẠI SÁM HỐI").length, 1);
	assert.equal(merged.byDay[22].find((e) => e.title === "ĐẠI SÁM HỐI")?.location, "Nơi do admin nhập");
	// Sự kiện ẩn thì cũng không có mặt ở dự phòng.
	event(empty, "hid", "Sự kiện đã ẩn", "2026-11-05", "2026-11-05", { status: "hidden" });
	assert.deepEqual(daysOf((await month(empty, 2026, 11)).byDay, "Sự kiện đã ẩn"), []);
});

test("chủ đề tháng: lấy từ month_theme của D1 khi admin đã nhập, tháng chưa nhập giữ chủ đề đóng gói; màu vẫn của V3", async () => {
	const db = world();
	db.insert("media", { id: "poster", r2_key: "cms/poster/v1/thang-11.webp", url: null });
	db.insert("month_theme", { month: 11, title: "Tháng Mười Một do admin", poster_media_id: "poster", lines: JSON.stringify(["Dòng một", "Dòng <b>hai</b>"]), author: "Tác giả admin" });
	db.insert("month_theme", { month: 3, title: "", poster_media_id: null, lines: "[]", author: "" });
	const { data } = await month(db, 2026, 11);
	const nov = resolveMonthTheme(data, 10);
	assert.equal(nov.title, "Tháng Mười Một do admin");
	assert.deepEqual(nov.quoteLines, ["Dòng một", "Dòng <b>hai</b>"]);
	assert.equal(nov.author, "Tác giả admin");
	assert.match(nov.bannerImg, /cms\/poster\/v1\/thang-11\.webp$/);
	assert.equal(nov.primaryColor, bundled(10).primaryColor, "admin không có trường màu: màu của V3");
	assert.equal(nov.themeBg, bundled(10).themeBg);
	// Hàng trống (admin chưa nhập tháng 3) và tháng không có hàng nào (tháng 5): chủ đề đóng gói.
	for (const m0 of [2, 4]) {
		const t = resolveMonthTheme(data, m0);
		assert.equal(t.title, bundled(m0).title, `tháng ${m0 + 1}`);
		assert.deepEqual(t.quoteLines, bundled(m0).quoteLines);
		assert.equal(t.bannerImg, bundled(m0).bannerImg);
	}
	// Chưa có dữ liệu nào: chủ đề đóng gói.
	assert.ok(resolveMonthTheme(null, 10).title);
	assert.ok(resolveMonthTheme(null, 10).primaryColor);
});

test("toScheduleData gửi cho trang slug của khóa lễ thường kỳ, cùng cách đặt với trang chi tiết", async () => {
	const { data } = await month(world(), 2026, 11);
	assert.deepEqual(data.featuredPrograms?.map((p) => p.slug), ["dai-sam-hoi", "tieu-sam-hoi", "cau-quoc-thai-dan-an"]);
});
