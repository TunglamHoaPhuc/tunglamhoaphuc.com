// Lịch tu học trên trang chủ V3 so với www, bằng mã thật của www: tests/helpers/www-calendar-world.mjs cho CHÍNH admin của www tạo, sửa,
// ẩn, xóa, khôi phục sự kiện, sửa khóa lễ thường kỳ và nhập chủ đề tháng trên một SQLite đã migrate, rồi cho CHÍNH mã đọc lịch của www
// (createD1Repository, eventsInMonth, regularEvents) tính lịch của 36 tháng. Kiểm thử này đọc cùng tệp SQLite bằng lớp đọc của V3
// (createD1Repository -> toScheduleData -> monthEvents) và đòi V3 ra ĐÚNG những ngày, đúng thứ tự mà www ra, tháng nào cũng vậy.
//
// Chạy:  TLHP_WWW_SRC=E:/tlhp-av3/src npm test      (không đặt TLHP_WWW_SRC thì bỏ qua, như v3-www-admin-roundtrip.test.ts)
// Không chạm Cloudflare; tệp tạm nằm trong thư mục tạm của hệ điều hành và bị xóa khi xong.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { monthEvents, resolveMonthTheme, type CalendarPayload } from "@/lib/v3-calendar";
import { toScheduleData } from "@/lib/v3-data";
import { d1Over } from "../helpers/d1";

type Scenario = { id: string; title: string; start: string; end: string; status: string; live: boolean };
type WwwMonth = { events: { id: string; title: string; start: string; end: string }[]; regular: { id: string; title: string; start: string; programId: string; slug: string }[] };
type Intent = { scenarios: Record<string, Scenario>; months: Record<string, WwwMonth>; programs: { id: string; title: string; summary: string }[]; theme: { title: string; lines: string[]; author: string } };

const WWW_SRC = process.env.TLHP_WWW_SRC;
const WWW = WWW_SRC ? path.resolve(WWW_SRC, "..") : "";
const TSX = path.join(WWW, "node_modules", "tsx", "dist", "cli.mjs");
const PRODUCER = path.resolve("tests/helpers/www-calendar-world.mjs");

const SKIP: string | false =
	WWW_SRC && existsSync(TSX) && existsSync(path.join(WWW, "migrations"))
		? false
		: "TLHP_WWW_SRC chưa đặt (thư mục src của www, cần có node_modules/tsx và migrations/): bỏ qua so lịch V3 với www";

const tmp = SKIP ? "" : mkdtempSync(path.join(tmpdir(), "tlhp-calendar-parity-"));
after(() => {
	// Windows không xóa được tệp SQLite còn mở.
	world?.sqlite.close();
	if (tmp) rmSync(tmp, { recursive: true, force: true });
});

function build() {
	const dbFile = path.join(tmp, "calendar.sqlite");
	const jsonFile = path.join(tmp, "intent.json");
	const run = spawnSync(process.execPath, [TSX, PRODUCER, WWW, dbFile, jsonFile], {
		cwd: WWW,
		env: { ...process.env, TSX_TSCONFIG_PATH: path.join(WWW, "tsconfig.json") },
		encoding: "utf8",
		timeout: 120_000,
	});
	assert.equal(run.status, 0, `không dựng được thế giới admin www:\n${run.stdout}\n${run.stderr}`);
	const sqlite = new DatabaseSync(dbFile, { readOnly: true });
	return { sqlite, d1: d1Over(sqlite), intent: JSON.parse(readFileSync(jsonFile, "utf8")) as Intent };
}
const world = SKIP ? null : build();
const W = () => world as NonNullable<typeof world>;

/** Đường đi thật của V3: D1 -> bộ đọc -> JSON của /api/admin/schedule. */
async function payload(): Promise<CalendarPayload> {
	return toScheduleData(await createD1Repository(W().d1).getSchedule()) as unknown as CalendarPayload;
}

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Lịch của www cho từng ngày của tháng: sự kiện (theo thứ tự của D1) rồi khóa lễ thường kỳ, đúng `[...monthEvents, ...regular]` của trang www. */
function wwwDays(month: string, data: WwwMonth): Record<number, string[]> {
	const [year, m] = month.split("-").map(Number);
	const days: Record<number, string[]> = {};
	for (let day = 1; day <= new Date(Date.UTC(year, m, 0)).getUTCDate(); day++) {
		const date = `${month}-${String(day).padStart(2, "0")}`;
		const ids = [...data.events.filter((e) => e.start <= date && e.end >= date).map((e) => e.id), ...data.regular.filter((e) => e.start === date).map((e) => e.id)];
		if (ids.length) days[day] = ids;
	}
	return days;
}

test("dữ liệu thử đủ phong phú: sự kiện hiện, nháp, tạm ẩn, thùng rác, khôi phục, dời ngày, nhiều ngày, khóa lễ đã sửa", { skip: SKIP }, () => {
	const { scenarios, programs } = W().intent;
	assert.ok(Object.values(scenarios).filter((s) => s.live).length >= 6);
	assert.ok(Object.values(scenarios).filter((s) => !s.live).length >= 3);
	const states = new Set((W().sqlite.prepare("select status || (case when deleted_at is null then '' else '+trash' end) s from calendar_event").all() as { s: string }[]).map((r) => r.s));
	for (const wanted of ["published", "draft", "hidden", "published+trash"]) assert.ok(states.has(wanted), `bảng calendar_event có sự kiện ở trạng thái ${wanted}`);
	assert.equal(programs.length, 3);
	assert.match(programs.find((p) => p.id === "p2")?.summary ?? "", /mùng 10 và 20/, "admin đã sửa ngày của khóa lễ p2");
});

test("V3 ra đúng lịch của www, từng ngày, đúng thứ tự, cho 36 tháng (2026-01 .. 2028-12)", { skip: SKIP }, async () => {
	const data = await payload();
	let checked = 0;
	let withRegular = 0;
	for (const [month, www] of Object.entries(W().intent.months)) {
		const [year, m] = month.split("-").map(Number);
		const mine = monthEvents(data, year, m - 1);
		assert.equal(mine.source, "d1", month);
		const got: Record<number, string[]> = {};
		for (const [day, events] of Object.entries(mine.byDay)) got[Number(day)] = events.map((e) => String(e.id));
		assert.deepEqual(got, wwwDays(month, www), `lịch tháng ${month}: V3 khác www`);
		checked += Object.keys(got).length;
		withRegular += www.regular.length;
	}
	assert.ok(checked > 150 && withRegular > 150, "đã so đủ nhiều ngày có sự kiện");
});

test("tên, nơi, giờ, loại, slug của từng ngày khóa lễ và sự kiện khớp với www", { skip: SKIP }, async () => {
	const data = await payload();
	const programs = new Map((data.featuredPrograms ?? []).map((p) => [p.id, p]));
	for (const [month, www] of Object.entries(W().intent.months)) {
		const [year, m] = month.split("-").map(Number);
		const byId = new Map(Object.values(monthEvents(data, year, m - 1).byDay).flat().map((e) => [String(e.id), e]));
		for (const r of www.regular) {
			const e = byId.get(r.id);
			assert.ok(e, `${r.id} có trong lịch V3`);
			assert.equal(e.title, r.title);
			assert.equal(e.slug, r.slug, `slug của ${r.id}`);
			assert.equal(e.category, "Khóa Lễ Truyền Thống");
			assert.equal(e.solarDateStr, `${r.start.slice(8, 10)}.${r.start.slice(5, 7)}.${r.start.slice(0, 4)}`);
			assert.equal(e.timeSlot1Time, programs.get(r.programId)?.time || undefined, `giờ của ${r.id}`);
			assert.equal(e.location, programs.get(r.programId)?.location ?? "", `nơi của ${r.id}`);
		}
		for (const r of www.events) {
			const e = byId.get(r.id);
			assert.ok(e, `${r.id} có trong lịch V3`);
			assert.equal(e.title, r.title);
		}
	}
});

test("mỗi sự kiện admin muốn hiện thì hiện đúng ngày, mỗi sự kiện admin muốn ẩn thì vắng mặt trong mọi tháng", { skip: SKIP }, async () => {
	const data = await payload();
	const seen = new Map<string, number[]>();
	for (const month of Object.keys(W().intent.months)) {
		const [year, m] = month.split("-").map(Number);
		for (const [day, events] of Object.entries(monthEvents(data, year, m - 1).byDay)) {
			for (const e of events) seen.set(String(e.id), [...(seen.get(String(e.id)) ?? []), Date.UTC(year, m - 1, Number(day)) / 86_400_000]);
		}
	}
	for (const [name, s] of Object.entries(W().intent.scenarios)) {
		const days = seen.get(s.id);
		assert.equal(days !== undefined, s.live, `${name} (${s.title}): admin muốn ${s.live ? "hiện" : "ẩn"}`);
		if (s.live) {
			const want = Math.round((Date.parse(`${s.end}T00:00:00Z`) - Date.parse(`${s.start}T00:00:00Z`)) / 86_400_000) + 1;
			assert.equal(days?.length, want, `${name}: số ngày phủ`);
			assert.equal(new Date((days as number[])[0] * 86_400_000).toISOString().slice(0, 10), s.start, `${name}: ngày đầu`);
			assert.equal(addDays(s.start, want - 1), new Date((days as number[])[want - 1] * 86_400_000).toISOString().slice(0, 10), `${name}: ngày cuối`);
		}
	}
});

test("khóa lễ thường kỳ admin đã sửa: V3 theo ngày, giờ, nơi, tên mới; ngày cũ của nó biến mất", { skip: SKIP }, async () => {
	const { byDay } = monthEvents(await payload(), 2026, 10);
	const own = Object.entries(byDay).filter(([, events]) => events.some((e) => String(e.id).startsWith("p2-")));
	assert.deepEqual(own.map(([day]) => Number(day)), [18, 28], "mùng 10 và 20 âm lịch");
	for (const [, events] of own) {
		const e = events.find((x) => String(x.id).startsWith("p2-"));
		assert.equal(e?.title, "TIỂU SÁM HỐI (đổi)");
		assert.equal(e?.timeSlot1Time, "20h00");
		assert.equal(e?.location, "Giảng Đường");
	}
	assert.ok(!Object.values(byDay).flat().some((e) => e.title === "TIỂU SÁM HỐI"), "tên cũ không còn");
});

test("chủ đề tháng admin nhập (11) hiện trên lịch, tháng chưa nhập (12) giữ chủ đề đóng gói của V3", { skip: SKIP }, async () => {
	const data = await payload();
	const { theme } = W().intent;
	const nov = resolveMonthTheme(data, 10);
	assert.equal(nov.title, theme.title);
	assert.deepEqual(nov.quoteLines, theme.lines, "dòng thơ như admin đã làm sạch");
	assert.equal(nov.author, theme.author);
	const dec = resolveMonthTheme(data, 11);
	assert.notEqual(dec.title, theme.title);
	assert.ok(dec.title && dec.bannerImg, "tháng chưa nhập: có chủ đề đóng gói");
});
