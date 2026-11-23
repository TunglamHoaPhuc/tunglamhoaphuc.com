// V3 chỉ ĐỌC D1: mọi câu SQL trong mã nguồn là SELECT. Quét toàn bộ src: không có chuỗi SQL ghi (INSERT, UPDATE, DELETE, REPLACE,
// DROP, ALTER, CREATE, PRAGMA ghi), và những chỗ V3 cầm trình đọc D1 chỉ gọi `.all()` (không `.run()`, `.batch()`, `.exec()`, `.first()`).
// Bổ sung cho v3-readonly.test.ts (không route nào ghi) bằng lớp kiểu: D1Like chỉ có prepare().bind().all().
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
const sources = () => walk("src").filter((f) => /\.(ts|tsx|js|mjs)$/.test(f));
const norm = (file: string) => file.split(path.sep).join("/");

const WRITE_SQL = /\b(?:insert\s+(?:or\s+\w+\s+)?into\s+[\w"`]|update\s+[\w"`]+\s+set\b|delete\s+from\s+[\w"`]|replace\s+into\s+[\w"`]|drop\s+(?:table|index|view|trigger)\b|alter\s+table\b|create\s+(?:table|index|view|trigger)\b|pragma\s+\w+\s*=)/i;
/** Calls that write through a D1 handle (the read helper only has `.all()`). */
const WRITE_CALL = /\.(?:run|batch|exec|first|raw|dump)\s*\(/;

test("bộ dò của kiểm thử nhận ra từng kiểu câu SQL ghi và không báo nhầm câu đọc", () => {
	for (const sql of ["INSERT INTO redirect (a) VALUES (1)", "insert or replace into x values (1)", "UPDATE post SET hits = hits + 1", "delete from post where id = 1", "REPLACE INTO t VALUES (1)", "drop table post", "ALTER TABLE post ADD c", "create index i on post(a)", "pragma user_version = 3"]) assert.match(sql, WRITE_SQL, sql);
	for (const sql of ["select p.id from post p left join media m on m.id = p.thumbnail_media_id", "SELECT from_path FROM redirect WHERE active = 1", "select key, value from setting", "Giá trị được cập nhật và xóa khỏi danh sách"]) assert.doesNotMatch(sql, WRITE_SQL, sql);
});

test("không chuỗi SQL ghi nào trong mã nguồn V3", () => {
	const found = sources().flatMap((file) => (WRITE_SQL.test(readFileSync(file, "utf8")) ? [norm(file)] : []));
	assert.deepEqual(found, []);
});

test("nơi V3 cầm trình đọc D1 (lớp đọc, siteData, redirects, v3-statues) chỉ gọi .all()", () => {
	const holders = sources().filter((file) => /\.prepare\(/.test(readFileSync(file, "utf8")));
	assert.ok(holders.length >= 4, `tìm thấy các nơi gọi prepare(): ${holders.map(norm).join(", ")}`);
	for (const file of holders) assert.doesNotMatch(readFileSync(file, "utf8"), WRITE_CALL, `${norm(file)} gọi hàm có thể ghi`);
	// Mọi câu `prepare("…")` / prepare(`…`) bắt đầu bằng select hoặc với WITH.
	const statement = /\.prepare\(\s*(["'`])([\s\S]*?)\1/g;
	let count = 0;
	for (const file of holders) {
		for (const match of readFileSync(file, "utf8").matchAll(statement)) {
			count++;
			assert.match(match[2].trimStart(), /^(select|with)\b/i, `${norm(file)}: câu không phải SELECT: ${match[2].slice(0, 60)}`);
		}
	}
	assert.ok(count >= 4, `đã kiểm ${count} câu`);
});
