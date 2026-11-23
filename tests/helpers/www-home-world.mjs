// Một "thế giới admin" của www chạy NỀN, điều khiển từng bước qua stdin/stdout, để kiểm thử khứ hồi trang chủ
// (tests/unit/v3-www-admin-home-roundtrip.test.ts) làm được chuỗi: admin sửa -> V3 đọc -> admin sửa tiếp/ẩn/xóa -> V3 đọc lại.
//
// Khác www-admin-world.mjs (chạy một lèo rồi xuất MỘT tệp SQLite), tệp này giữ nguyên tiến trình và SQLite trong bộ nhớ, rồi theo yêu cầu:
//   { op: "call", method, path, body }   admin làm việc bằng ĐÚNG API của nó (đăng nhập sẵn bằng Super Admin), trả { status, data, error }
//   { op: "sql", sql, params, all }       chạy một câu SQL thẳng vào bảng (chỉ để dựng dữ liệu nền hay đẩy đồng hồ; không thay cho admin)
//   { op: "snapshot", file }              VACUUM INTO: một bản SQLite sao nguyên vẹn để V3 mở và đọc
//   { op: "www", fn, args }               gọi hàm thuần của www (hiện có: buddhistYear(date) = Phật lịch của một ngày theo src/libs/lunar.ts)
//   { op: "wwwCalendar", month }          lịch của một tháng ("2026-11") do CHÍNH mã đọc lịch của www tính trên dữ liệu đang có: sự kiện và ngày khóa lễ thường kỳ
//   { op: "stop" }                        thoát
// Mỗi dòng stdin là một JSON, mỗi phản hồi là một dòng stdout bắt đầu bằng "@@" rồi JSON (để mã của www có in gì cũng không lẫn vào).
//
// Chạy trong một tiến trình riêng bằng tsx của www (mã admin dùng cú pháp TypeScript mà `node --test` của V3 không nạp được):
//   TSX_TSCONFIG_PATH=<www>/tsconfig.json node <www>/node_modules/tsx/dist/cli.mjs <tệp này> <www>
// Không import gì của V3, không chạm Cloudflare hay D1 thật: mọi thứ nằm trong bộ nhớ.
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

const [, , WWW] = process.argv;
if (!WWW) throw new Error("thiếu tham số: <www>");
process.chdir(WWW);
const load = (rel) => import(pathToFileURL(`${WWW}/${rel}`).href);

const { contentWorld } = await load("tests/unit/helpers/contentWorld.ts");
const { buddhistYear } = await load("src/libs/lunar.ts");
const { createD1Repository } = await load("src/libs/content/sources/d1.ts");
const { eventsInMonth, regularEvents } = await load("src/libs/calendar.ts");

const w = await contentWorld();
const root = await w.as("root@example.test");

// ---------------------------------------------------------------- dữ liệu nền (những thứ admin tạo bằng giao diện khác hoặc web cũ để lại)
const category = w.raw.prepare("INSERT INTO category (id, kind, section, slug, name, position) VALUES (?, ?, '', ?, ?, ?)");
category.run("event::cong-tu", "event", "cong-tu", "Cộng Tu", 1);
category.run("event::khoa-le", "event", "khoa-le", "Khóa Lễ Truyền Thống", 2);
// Khu vực của chùa (admin chỉ sửa, không tạo; bản nhập từ web cũ để lại).
const area = w.raw.prepare("INSERT INTO area (id, slug, name, subtitle, position) VALUES (?, ?, ?, ?, ?)");
area.run("tam-bao", "tam-bao", "Tam Bảo", "Chánh điện", 1);
area.run("to-duong", "to-duong", "Tổ Đường", "Thờ Tổ", 2);
area.run("giang-duong", "giang-duong", "Giảng Đường", "Nơi học đạo", 3);
area.run("tang-kinh-cac", "tang-kinh-cac", "Tàng Kinh Các", "Kho kinh", 4);
// Ba khóa lễ thường kỳ như lần nhập từ web cũ để lại (admin chỉ sửa được, không tạo thêm).
const program = w.raw.prepare("INSERT INTO featured_program (id, title, subtitle, summary, time, duration, location, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
program.run("p1", "ĐẠI SÁM HỐI", "Khóa lễ", "Thời khóa sám hối tối 19h00 ngày 14 và cuối tháng âm lịch", "19h00", "90 phút", "Chánh Điện", 1);
program.run("p2", "TIỂU SÁM HỐI", "Khóa lễ", "Thời khóa tụng kinh tối 19h00 ngày mùng 8 và 23 âm lịch", "19h00", "", "Chánh Điện", 2);
program.run("p3", "CẦU QUỐC THÁI DÂN AN", "Khóa lễ", "Khóa lễ tụng kinh Dược Sư sáng 08h00 mùng 1 và ngày rằm 15 âm lịch", "08h00", "", "Sân Di Đà", 3);

const FUNCTIONS = { buddhistYear };

// ---------------------------------------------------------------- vòng lặp lệnh
async function run(msg) {
	switch (msg.op) {
		case "call": {
			const res = await root.call(msg.method, msg.path, msg.body);
			return { status: res.status, data: res.data ?? null, error: res.error ?? null };
		}
		case "sql": {
			const statement = w.raw.prepare(msg.sql);
			return msg.all ? { rows: statement.all(...(msg.params ?? [])) } : { changes: Number(statement.run(...(msg.params ?? [])).changes) };
		}
		case "snapshot":
			w.raw.exec(`VACUUM INTO '${String(msg.file).replace(/\\/g, "/").replace(/'/g, "''")}'`);
			return { file: msg.file };
		case "www": {
			const fn = FUNCTIONS[msg.fn];
			if (!fn) throw new Error(`www không có hàm ${msg.fn} trong danh sách`);
			return { value: fn(...(msg.args ?? [])) };
		}
		case "wwwCalendar": {
			const schedule = await createD1Repository(w.db).getSchedule();
			return {
				events: eventsInMonth(schedule.events, msg.month).map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end })),
				regular: regularEvents(schedule.programs, msg.month).map((e) => ({ id: e.id, title: e.title, start: e.start, programId: e.programId })),
			};
		}
		default:
			throw new Error(`lệnh lạ: ${msg.op}`);
	}
}

const send = (value) => process.stdout.write(`@@${JSON.stringify(value)}\n`);
let queue = Promise.resolve();
createInterface({ input: process.stdin }).on("line", (line) => {
	if (!line.trim()) return;
	queue = queue.then(async () => {
		const msg = JSON.parse(line);
		if (msg.op === "stop") process.exit(0);
		try {
			send({ id: msg.id, ok: true, result: await run(msg) });
		} catch (error) {
			send({ id: msg.id, ok: false, error: String(error?.stack ?? error) });
		}
	});
});
send({ ready: true });
