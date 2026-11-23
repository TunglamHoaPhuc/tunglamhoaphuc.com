// Dựng, bằng CHÍNH mã admin của www, một tệp SQLite đã migrate rồi để admin làm các việc thật với lịch tu học (tạo sự kiện đã xuất bản,
// nhiều ngày, nháp, tạm ẩn, xóa vào thùng rác, khôi phục, dời ngày, sửa khóa lễ thường kỳ, nhập chủ đề tháng), rồi cho CHÍNH mã đọc lịch
// của www (createD1Repository + eventsInMonth + regularEvents của src/libs/calendar.ts) tính ra lịch từng tháng trong 3 năm. Kiểm thử
// tests/unit/v3-calendar-www-parity.test.ts so lịch của V3 với kết quả này, từng ngày, đúng thứ tự.
//
// Chạy trong một tiến trình riêng bằng tsx của www (mã admin dùng cú pháp mà `node --test` của V3 không nạp được), giống www-admin-world.mjs:
//   TSX_TSCONFIG_PATH=<www>/tsconfig.json node <www>/node_modules/tsx/dist/cli.mjs <tệp này> <www> <ra.sqlite> <ra.json>
// Không import gì của V3, không chạm Cloudflare: mọi thứ trong bộ nhớ rồi một tệp tạm do kiểm thử chỉ định.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [, , WWW, OUT_DB, OUT_JSON] = process.argv;
if (!WWW || !OUT_DB || !OUT_JSON) throw new Error("thiếu tham số: <www> <ra.sqlite> <ra.json>");
process.chdir(WWW);
const load = (rel) => import(pathToFileURL(`${WWW}/${rel}`).href);

const { specialWorld } = await load("tests/unit/helpers/specialWorld.ts");
const { createD1Repository } = await load("src/libs/content/sources/d1.ts");
const { eventsInMonth, regularEvents, shiftMonth } = await load("src/libs/calendar.ts");

const w = await specialWorld();
const root = await w.as("root@example.test");
const ok = (res, what) => {
	if (res.status >= 300) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.json)}`);
	return res;
};

// Ba khóa lễ thường kỳ như lần nhập từ web cũ để lại (admin chỉ sửa được, không tạo thêm).
const program = w.raw.prepare("INSERT INTO featured_program (id, title, subtitle, summary, time, duration, location, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
program.run("p1", "ĐẠI SÁM HỐI", "Khóa lễ", "Thời khóa sám hối tối 19h00 ngày 14 và cuối tháng âm lịch", "19h00", "90 phút", "Chánh Điện", 1);
program.run("p2", "TIỂU SÁM HỐI", "Khóa lễ", "Thời khóa tụng kinh tối 19h00 ngày mùng 8 và 23 âm lịch", "19h00", "", "Chánh Điện", 2);
program.run("p3", "CẦU QUỐC THÁI DÂN AN", "Khóa lễ", "Khóa lễ tụng kinh Dược Sư sáng 08h00 mùng 1 và ngày rằm 15 âm lịch", "08h00", "", "Sân Di Đà", 3);

const scenarios = {};
const note = (name, event, live) => {
	scenarios[name] = { id: event.id, title: event.title, start: event.startDate, end: event.endDate, status: event.status, live };
};
const create = async (body) => ok(await root.call("POST", "events", { categoryId: "event::cong-tu", ...body }), `tạo ${body.title}`).data;
const save = async (event, patch) => ok(await root.call("PATCH", `events/${event.id}`, { version: event.version, ...patch }), `sửa ${event.id}`).data;

// 1. Đã xuất bản, một ngày, có giờ và nơi.
note("single", await create({ title: "Cộng tu một ngày an lạc", startDate: "2026-11-25", status: "published", location: "Giảng đường", times: [{ label: "Khai khóa", time: "06h30" }, { label: "Hoàn mãn", time: "16h00" }] }), true);
// 2. Nhiều ngày, bắt đầu tháng 11 kết thúc tháng 12.
note("multi", await create({ title: "Khóa tu mùa đông", startDate: "2026-11-29", endDate: "2026-12-02", status: "published", categoryId: "event::khoa-le" }), true);
// 3. Nháp (mặc định).
note("draft", await create({ title: "Sự kiện nháp", startDate: "2026-11-14" }), false);
// 4. Đã xuất bản rồi tạm ẩn.
{
	let e = await create({ title: "Sự kiện tạm ẩn", startDate: "2026-11-14", status: "published" });
	e = await save(e, { status: "hidden" });
	note("hidden", e, false);
}
// 5. Đã xuất bản rồi vào thùng rác.
{
	const e = await create({ title: "Sự kiện đã xóa", startDate: "2026-11-14", status: "published" });
	ok(await root.call("DELETE", `events/${e.id}`), `xóa ${e.id}`);
	note("trashed", e, false);
}
// 6. Vào thùng rác rồi khôi phục: hiện lại.
{
	const e = await create({ title: "Sự kiện khôi phục", startDate: "2026-12-05", status: "published" });
	ok(await root.call("DELETE", `events/${e.id}`), `xóa ${e.id}`);
	ok(await root.call("POST", `trash/calendar_event/${e.id}/restore`, {}), `khôi phục ${e.id}`);
	note("restored", e, true);
}
// 7. Dời ngày khi đang hiển thị: chỉ còn ở ngày mới.
{
	let e = await create({ title: "Sự kiện dời ngày", startDate: "2026-11-05", status: "published" });
	e = await save(e, { startDate: "2026-11-06", endDate: "2026-11-06" });
	note("moved", e, true);
}
// 8. Trùng ngày với khóa lễ thường kỳ (rằm 23/11/2026): đứng trước khóa lễ trong ngày.
note("on-regular-day", await create({ title: "Lễ rằm đặc biệt", startDate: "2026-11-23", status: "published", categoryId: "event::khoa-le" }), true);
// 9. Đã xuất bản, tạm ẩn rồi đăng lại: hiện.
{
	let e = await create({ title: "Sự kiện ẩn rồi đăng lại", startDate: "2027-01-10", status: "published" });
	e = await save(e, { status: "hidden" });
	e = await save(e, { status: "published" });
	note("republished", e, true);
}

// 10. Admin sửa khóa lễ thường kỳ p2: ngày, giờ, nơi và tên (mùng 10 và 20 âm lịch).
ok(await root.call("PATCH", "events/programs/p2", { title: "TIỂU SÁM HỐI (đổi)", summary: "Tụng kinh tối ngày mùng 10 và 20 âm lịch", time: "20h00", location: "Giảng Đường" }), "sửa p2");
// 11. Admin nhập chủ đề tháng 11 (tháng 12 để trống).
const theme = ok(await root.call("PUT", "events/themes/11", { title: "Tháng Mười Một của admin", lines: ["Dòng một", "Dòng <b>hai</b>", "<script>x</script>"], author: "Người biên tập" }), "chủ đề 11").data;

// Lịch mà CHÍNH mã đọc của www tính ra, cho 36 tháng từ 2026-01.
const schedule = await createD1Repository(w.db).getSchedule();
const months = {};
for (let month = "2026-01"; month <= "2028-12"; month = shiftMonth(month, 1)) {
	months[month] = {
		events: eventsInMonth(schedule.events, month).map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end })),
		regular: regularEvents(schedule.programs, month).map((e) => ({ id: e.id, title: e.title, start: e.start, programId: e.programId, slug: e.slug })),
	};
}

w.raw.exec(`VACUUM INTO '${OUT_DB.replace(/\\/g, "/").replace(/'/g, "''")}'`);
writeFileSync(
	OUT_JSON,
	JSON.stringify({ scenarios, months, programs: schedule.programs.map((p) => ({ id: p.id, title: p.title, summary: p.summary })), theme: { title: theme.title, lines: theme.lines, author: theme.author } }, null, 2),
);
console.log(`đã dựng ${Object.keys(scenarios).length} tình huống, ${Object.keys(months).length} tháng`);
