// Luật rẻ cho giao diện điện thoại (rộng 360–430 px) của khung chung: chiều cao theo thanh địa chỉ, ô nhập đủ 16 px,
// vùng chạm 44 px ở các nút của đầu trang/menu/hộp thông báo, hiệu ứng làm mờ nền được hạ trên di động.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file: string) => readFileSync(file, "utf8");

const SHELL = [
	"src/app/(public)/layout.tsx",
	"src/app/HomeClient.tsx",
	"src/components/public/layout/Header.tsx",
	"src/components/public/layout/Footer.tsx",
	"src/components/public/modals/WelcomeNoticeModal.tsx",
	"src/components/public/modals/MediaPlayModal.tsx",
	"src/features/home/components/Hero.tsx",
];

test("khung chung không dùng vh/h-screen làm nhảy khi thanh địa chỉ co", () => {
	for (const file of SHELL) {
		const code = read(file);
		assert.doesNotMatch(code, /\b(min-)?h-screen\b/, `${file} còn h-screen`);
		assert.doesNotMatch(code, /\[(calc\()?\d+vh\b|calc\(100vh|minHeight: "100vh"/, `${file} còn chiều cao theo vh`);
	}
});

test("globals.css: ô nhập 16 px và làm mờ nền tối đa 4 px trên điện thoại", () => {
	const css = read("src/app/globals.css");
	const mobile = css.slice(css.indexOf("@media (max-width: 767px)"));
	assert.match(mobile, /textarea\s*\{\s*font-size:\s*16px/);
	assert.match(mobile, /\[class\*="backdrop-blur"\]\s*\{\s*--tw-backdrop-blur:\s*blur\(4px\)/);
	assert.match(css, /prefers-reduced-motion: reduce/);
});

test("đầu trang: nút tìm kiếm và nút menu cao 44 px, menu cuộn trong dvh", () => {
	const header = read("src/components/public/layout/Header.tsx");
	assert.match(header, /aria-label="Tìm kiếm"[\s\S]{0,40}|w-11 h-11/);
	assert.equal((header.match(/w-11 h-11/g) ?? []).length >= 2, true, "nút tìm kiếm và nút menu phải w-11 h-11");
	assert.match(header, /max-h-\[calc\(100dvh-64px\)\]/);
	assert.match(header, /aria-expanded=\{mob\}/);
	assert.equal((header.match(/min-h-11/g) ?? []).length >= 3, true, "mục menu di động phải cao tối thiểu 44 px");
});

test("hộp thông báo chào mừng nằm gọn trong màn hình thấp", () => {
	const modal = read("src/components/public/modals/WelcomeNoticeModal.tsx");
	assert.match(modal, /max-h-\[calc\(100dvh-2rem\)\]/);
	assert.doesNotMatch(modal, /max-h-\[60vh\]/);
	assert.match(modal, /w-11 h-11 sm:w-8 sm:h-8/, "nút đóng 44 px trên di động");
});

test("chân trang: số điện thoại là vùng chạm 44 px trên di động", () => {
	const footer = read("src/components/public/layout/Footer.tsx");
	assert.match(footer, /href=\{`tel:\$\{person\.phone\}`\} className="inline-flex items-center min-h-11 md:min-h-0/);
});

test("không còn chữ dưới 12 px trên di động ở thẻ bài và cụm lọc dùng chung", () => {
	const card = read("src/components/common/PostCard.tsx");
	// Cỡ nhỏ chỉ được xuất hiện kèm tiền tố md: (máy tính), không phải cỡ nền.
	assert.doesNotMatch(card, /(^|[\s"'`])text-\[(9|10|10\.5|11|11\.5)px\]/m);
});

test("hiệu năng cuộn: trang chủ không giữ scrollY, thanh neo dùng rAF, thẻ bài không prefetch cả lưới", () => {
	const home = read("src/app/HomeClient.tsx");
	assert.doesNotMatch(home, /setScrollY|useState<number>\(0\)/, "HomeClient không được dựng lại ở mỗi sự kiện cuộn");
	assert.match(home, /setScrolled\(window\.scrollY > 64\)/);
	assert.match(home, /useMemo\(\(\) => homeSections/);
	const nav = read("src/components/common/VerticalAnchorNav.tsx");
	assert.match(nav, /requestAnimationFrame/);
	assert.match(nav, /matchMedia\("\(min-width: 768px\)"\)/);
	assert.match(read("src/components/common/PostCard.tsx"), /prefetch: false/);
});

test("layout gốc: phông UTM Avo được preload, không còn preconnect/preload tới Google Fonts", () => {
	const layout = read("src/app/layout.tsx");
	assert.match(layout, /href="\/fonts\/UTMAvo\.ttf" as="font"/);
	assert.match(layout, /href="\/fonts\/UTMAvoBold\.ttf" as="font"/);
	assert.doesNotMatch(layout, /rel="preconnect"/);
	assert.doesNotMatch(layout, /rel="preload" as="style"/);
});
