// V8: V3 reads, it does not write. No route handler writes except a short allow-list; nothing in the source can
// reach the old "save" layer; the public memorial search never matches a raw phone number.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { filterMemorialRecords } from "@/lib/memorial-db";
import type { MemorialRecord } from "@/lib/memorial-types";

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});

const norm = (file: string) => file.split(path.sep).join("/");

/** The only route files that may export PUT, POST, PATCH or DELETE (path from src/app/api, no extension). */
const WRITE_ALLOW_LIST = new Set(["analyze/route.ts", "ask-ai/route.ts", "crop-analyze/route.ts", "tts/route.ts", "public/increment-view/route.ts"]);
const WRITE_EXPORT = /export\s+(?:async\s+)?function\s+(PUT|POST|PATCH|DELETE)\b|export\s+(?:const|let|var)\s+(PUT|POST|PATCH|DELETE)\b|export\s*\{[^}]*\b(PUT|POST|PATCH|DELETE)\b[^}]*\}/;

test("không route nào ngoài danh sách cho phép xuất PUT, POST, PATCH, DELETE", () => {
	const routes = walk("src/app/api").map(norm).filter((f) => /\/route\.(ts|tsx|js)$/.test(f));
	assert.ok(routes.length > 10, "tìm thấy các route");
	const writers = routes.filter((file) => WRITE_EXPORT.test(readFileSync(file, "utf8"))).map((f) => f.replace("src/app/api/", ""));
	assert.deepEqual(writers.sort(), [...WRITE_ALLOW_LIST].sort(), "chỉ đúng danh sách cho phép được ghi");
});

test("bộ dò của kiểm thử nhận ra từng kiểu xuất hàm ghi", () => {
	for (const code of ["export async function POST() {}", "export function DELETE() {}", "export const PUT = async () => {}", "export { handler as PATCH, GET }"]) assert.match(code, WRITE_EXPORT, code);
	assert.doesNotMatch("export async function GET() {}\nexport const dynamic = 'force-dynamic';", WRITE_EXPORT);
});

test("không còn đường ghi cũ: saveServerlessJson, invalidateServerlessCache, các route /api/admin không ai gọi", () => {
	const sources = walk("src").map(norm).filter((f) => /\.(ts|tsx)$/.test(f));
	for (const file of sources) {
		const code = readFileSync(file, "utf8");
		assert.doesNotMatch(code, /saveServerlessJson|invalidateServerlessCache|saveMemorialSyncData/, file);
		assert.doesNotMatch(code, /revalidatePath/, `${file}: V3 không có chỗ ghi nào để làm mới sau`);
	}
	const routes = new Set(walk("src/app/api").map(norm));
	for (const gone of ["admin/posts/[id]", "admin/tong-chi/[id]", "admin/gioi-thieu/[id]", "admin/vu-tru/[slug]", "admin/vu-tru"]) assert.equal(routes.has(`src/app/api/${gone}/route.ts`), false, gone);
});

// Bảo tượng và khu vực nay chỉ đọc từ D1: các tệp đóng gói cũ đã xóa, không được nhập lại và không route nào phát lại chúng.
test("không còn tệp dữ liệu tượng và khu vực đóng gói, không ai nhập, không route nào phát lại", () => {
	const removed = ["statue-data.ts", "statues-database.json", "baoTuongFullData.ts", "bao-tuong-full-data.ts", "universe-data.ts", "universe-database.json"];
	const dataFiles = new Set(readdirSync("src/data"));
	for (const name of removed) assert.equal(dataFiles.has(name), false, `src/data/${name} đã bị xóa`);
	const bare = removed.map((name) => name.replace(/\.(ts|json)$/, ""));
	const importOf = (code: string) => bare.some((name) => code.includes(`@/data/${name}"`) || code.includes(`@/data/${name}'`) || code.includes(`@/data/${name}.json`));
	for (const file of walk("src").map(norm).filter((f) => /\.(ts|tsx)$/.test(f))) assert.equal(importOf(readFileSync(file, "utf8")), false, file);
	assert.equal(new Set(walk("src/app/api").map(norm)).has("src/app/api/admin/bao-tuong/route.ts"), false, "/api/admin/bao-tuong phát lại danh sách tượng đóng gói nên đã bị xóa");
});

const record = (extra: Partial<MemorialRecord>): MemorialRecord => ({
	id: "1",
	sheetName: "s",
	category: "Nhà Tứ Ân",
	categorySlug: "nha-tu-an-ca-nhan",
	code: "TA001",
	name: "Nguyễn Văn An",
	...extra,
});

test("tìm bài vị: không khớp số điện thoại gốc, vẫn khớp tên, mã, địa chỉ và phần số đã che", () => {
	const records = [record({ contactName: "Chị Lan 0912345678", contactPhone: "0912 345 678", address: "Hà Nội" }), record({ id: "2", code: "TA002", name: "Trần Thị Bình", contactPhone: "0987654321" })];
	assert.deepEqual(filterMemorialRecords(records, "0912345678"), [], "SĐT gốc không tìm được");
	assert.deepEqual(filterMemorialRecords(records, "345678"), [], "một đoạn SĐT gốc cũng không");
	assert.deepEqual(filterMemorialRecords(records, "987654321"), []);
	assert.deepEqual(filterMemorialRecords(records, "nguyen van an").map((r) => r.id), ["1"]);
	assert.deepEqual(filterMemorialRecords(records, "TA002").map((r) => r.id), ["2"]);
	assert.deepEqual(filterMemorialRecords(records, "ha noi").map((r) => r.id), ["1"]);
	assert.deepEqual(filterMemorialRecords(records, "0912").map((r) => r.id), ["1"], "bốn số đầu còn hiện ở bản che nên tìm được");
	const found = filterMemorialRecords(records, "lan");
	assert.equal(found.length, 1);
	assert.doesNotMatch(JSON.stringify(found), /0912345678|0912 345 678|contactPhone/, "kết quả không có SĐT gốc");
	assert.equal(filterMemorialRecords(records, "").length, 2);
});
