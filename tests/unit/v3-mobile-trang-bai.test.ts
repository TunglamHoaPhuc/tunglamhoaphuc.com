// Luật rẻ cho giao diện điện thoại của các trang bài (Dòng Chảy, Trí Tuệ, Giới thiệu, Lịch tu học, Tìm kiếm, Tra cứu).
// Không dựng trang: đọc mã nguồn và kiểm những điều đã từng làm hỏng điện thoại.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/** Mọi thẻ <input> (không phải checkbox/radio/range/hidden): lớp chữ đầu tiên phải là cỡ >= 16 px, nếu không iOS tự phóng to khi chạm. */
function smallInputs(source: string): string[] {
	const bad: string[] = [];
	for (const m of source.matchAll(/<input\b[\s\S]*?\/>/g)) {
		const tag = m[0];
		if (/type=["'](hidden|checkbox|radio|range)["']/.test(tag)) continue;
		const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(tag);
		const classes = (cls?.[1] ?? cls?.[2] ?? "").split(/\s+/);
		const first = classes.find((c) => /^text-(xs|sm|base|lg|xl|\[\d+px\])$/.test(c));
		if (first !== "text-base" && first !== "text-lg" && first !== "text-xl") bad.push(tag.slice(0, 80));
	}
	return bad;
}

test("ô nhập ở các trang bài có chữ >= 16 px trên điện thoại", () => {
	for (const file of [
		"src/app/(public)/tim-kiem/SearchView.tsx",
		"src/features/memorial/components/MemorialSearchEngine.tsx",
		"src/features/wisdom/components/WisdomArchiveSection.tsx",
	]) {
		assert.deepEqual(smallInputs(read(file)), [], file);
	}
});

test("Học Tiếng Tạng: khung toàn màn hình không dùng 100vh (thanh địa chỉ điện thoại che đáy)", () => {
	const source = read("src/app/(public)/tri-tue-phat-phap/hoc-tieng-tang/page.tsx");
	assert.ok(!/\b(h|w)-screen\b/.test(source), "h-screen/w-screen");
	assert.match(source, /fixed inset-0/);
});

test("Đọc sách song ngữ: thanh điều khiển nằm dưới header cố định, hai trang xếp dọc ở điện thoại", () => {
	const source = read("src/components/tri-tue-phat-phap/BookDualReader.tsx");
	assert.match(source, /flex flex-col pt-24 md:pt-28/, "chừa chỗ cho header cố định");
	assert.match(source, /flex flex-col md:flex-row md:aspect-\[16\/10\]/, "hai trang chỉ đứng cạnh nhau từ md");
	assert.ok(!/<header className="sticky top-0/.test(source), "thanh điều khiển không còn nằm dưới header");
});

test("tiêu đề khối trên trang bài được xuống dòng ở điện thoại (không whitespace-nowrap trần)", () => {
	for (const file of [
		"src/components/gioi-thieu/GioiThieuDetailLayout.tsx",
		"src/app/(public)/dong-chay-hoang-phap/[slug]/DongChayDetailClient.tsx",
	]) {
		const bare = read(file).match(/(^|[\s"'`])whitespace-nowrap/gm) ?? [];
		assert.equal(bare.length, 0, `${file}: whitespace-nowrap không có tiền tố sm:`);
	}
});
