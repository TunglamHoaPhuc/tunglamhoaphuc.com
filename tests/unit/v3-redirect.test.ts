// V7 (c): before a V3 page answers 404 it asks the admin's redirect table (www's rules: lookup first, 301/302 as stored,
// no loops, never another site). V3 reads the table and never writes to it.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { resolveRedirect } from "@/lib/v3-redirect";
import { createFakeD1 } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	const row = (from: string, to: string, extra: Record<string, unknown> = {}) => db.insert("redirect", { from_path: from, to_path: to, code: 301, active: 1, ...extra });
	row("/tong-chi-tu-hoc/bai-cu", "/tong-chi-tu-hoc/bai-moi");
	row("/dong-chay-hoang-phap/tam-thoi", "/dong-chay-hoang-phap/chinh-thuc", { code: 302 });
	row("/da-tat", "/trang-khac", { active: 0 });
	row("/vong-a", "/vong-b");
	row("/vong-b", "/vong-c");
	row("/vong-c", "/vong-a");
	row("/tu-chuyen", "/tu-chuyen");
	row("/ra-ngoai", "https://evil.example/x");
	row("/ve-www", "https://www.tunglamhoaphuc.com/trang-www");
	row("/tieng-viet/đường-dẫn", "/trang-dich");
	return db;
}

test("địa chỉ cũ có chuyển hướng: trả đích và mã 301 hoặc 302 đúng như đã lưu", async () => {
	const db = seed();
	assert.deepEqual(await resolveRedirect(db, "/tong-chi-tu-hoc/bai-cu"), { fromPath: "/tong-chi-tu-hoc/bai-cu", to: "/tong-chi-tu-hoc/bai-moi", code: 301 });
	assert.equal((await resolveRedirect(db, "/dong-chay-hoang-phap/tam-thoi"))?.code, 302);
	assert.equal((await resolveRedirect(db, "/tong-chi-tu-hoc/bai-cu/"))?.to, "/tong-chi-tu-hoc/bai-moi", "dấu / ở cuối không làm hỏng việc tra");
});

test("không có dòng, dòng tắt: không chuyển hướng (trang trả 404)", async () => {
	const db = seed();
	assert.equal(await resolveRedirect(db, "/khong-co-dong-nao"), null);
	assert.equal(await resolveRedirect(db, "/da-tat"), null);
});

test("vòng lặp và tự chuyển về chính nó: không chuyển hướng", async () => {
	const db = seed();
	for (const from of ["/vong-a", "/vong-b", "/vong-c", "/tu-chuyen"]) assert.equal(await resolveRedirect(db, from), null, from);
});

test("đích ở trang khác hoặc đường dẫn hệ thống: không bao giờ chuyển ra ngoài", async () => {
	const db = seed();
	assert.equal(await resolveRedirect(db, "/ra-ngoai"), null, "địa chỉ ngoài không nằm trong tên miền của chùa");
	assert.equal((await resolveRedirect(db, "/ve-www"))?.to, "https://www.tunglamhoaphuc.com/trang-www");
	for (const reserved of ["/api/x", "/quan-tri/x", "/anh-goc/x", "/_next/x"]) assert.equal(await resolveRedirect(db, reserved), null, reserved);
});

test("địa chỉ có dấu tiếng Việt: khớp cả dạng đã mã hóa lẫn chưa mã hóa", async () => {
	const db = seed();
	assert.equal((await resolveRedirect(db, "/tieng-viet/đường-dẫn"))?.to, "/trang-dich");
	assert.equal((await resolveRedirect(db, encodeURI("/tieng-viet/đường-dẫn")))?.to, "/trang-dich");
});

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});

test("trang chi tiết hỏi bảng chuyển hướng trước khi 404, và có trang bắt mọi địa chỉ lạ", () => {
	const pages = [
		"src/app/(public)/bao-tuong/[slug]/page.tsx",
		"src/app/(public)/dong-chay-hoang-phap/[slug]/page.tsx",
		"src/app/(public)/gioi-thieu/AboutTopicPage.tsx",
		"src/app/(public)/lich-tu-hoc/[slug]/page.tsx",
		"src/app/(public)/tong-chi-tu-hoc/[slug]/page.tsx",
		"src/app/(public)/tri-tue-phat-phap/[slug]/page.tsx",
		"src/app/(public)/vu-tru-phat-giao/[slug]/page.tsx",
		"src/app/[...missing]/page.tsx",
	];
	for (const file of pages) {
		const code = readFileSync(file, "utf8");
		assert.match(code, /notFoundOrMoved/, file);
		assert.doesNotMatch(code, /\bnotFound\(\)/, `${file}: không gọi thẳng notFound() mà bỏ qua bảng chuyển hướng`);
	}
});

test("V3 chỉ đọc bảng chuyển hướng, không ghi (không đếm lượt)", () => {
	for (const file of walk("src/lib").filter((f) => /redirect/i.test(f))) assert.doesNotMatch(readFileSync(file, "utf8"), /UPDATE\s+redirect|INSERT\s+INTO\s+redirect|countHit/i, file);
});
