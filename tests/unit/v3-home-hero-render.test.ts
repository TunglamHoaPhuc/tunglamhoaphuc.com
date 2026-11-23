// Hero dựng ở máy chủ: khung đầu có trong HTML (h1, cho SEO và LCP), các khung sau nằm sẵn nhưng ẩn khỏi trình đọc màn hình, nút điều khiển
// có tên tiếng Việt, địa chỉ nút an toàn. (Việc tự chuyển, dừng khi rê chuột/tiêu điểm, không tự chuyển khi giảm chuyển động là mã chạy ở trình duyệt.)
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Hero } from "@/features/home/components/Hero";
import { DEFAULT_HERO, heroFromSettings } from "@/lib/v3-home-content";
import type { HeroSources } from "@/lib/v3-home-hero";

const NOW = new Date("2026-11-03T02:00:00Z");
const slide = (over: Record<string, unknown> = {}) => ({ id: "s1", enabled: true, title: "Về nơi bình yên", subtitle: "Chốn thiêng", text: "Đoạn chữ ngắn của admin.", imageMediaId: null, portraitMediaId: null, imagePosition: "", ctaLabel: "Tìm hiểu Bổn tự", ctaHref: "/gioi-thieu", ...over });
const SOURCES = {
	events: [{ id: "a", slug: "khoa-tu-a", title: "Khóa tu mùa Vu Lan", subtitle: "", category: { slug: "c", name: "C" }, start: "2026-11-07", end: "2026-11-07", times: [], location: "Chánh Điện", description: "", notes: "", image: null, video: null }],
	posts: [{ id: "p1", slug: "bai-1", title: "Lễ Hằng Thuận", subtitle: "", section: "dong-chay-hoang-phap", category: { slug: "c", name: "C" }, author: "", publishedDate: "2026-10-17", views: 1, thumbnail: null, banner: { src: "/anh-goc/1.webp", position: "center" }, summary: "Tóm tắt.", galleryCount: 0, pinned: false }],
} as unknown as HeroSources;
const render = (settings: Record<string, unknown>, sources?: HeroSources) => renderToStaticMarkup(createElement(Hero, { hero: heroFromSettings(settings, sources, NOW) }));

test("chưa có cài đặt: một khung, h1 là chữ có sẵn của V3, không có nút điều khiển hay vai trò trình chiếu", () => {
	const html = render({});
	assert.match(html, /<h1[^>]*>NƠI ĐỂ TRỞ VỀ<\/h1>/);
	assert.match(html, /CHỐN THIÊNG BÌNH YÊN/);
	assert.doesNotMatch(html, /Khung trước|Khung sau|trình chiếu|Tạm dừng|<h2/);
	for (const label of ["PHÁP THOẠI MỚI NHẤT", "KHO ẢNH TƯ LIỆU", "ẤN PHẨM PHẬT GIÁO", "ĐĂNG KÝ CỘNG TU", "TÌM KIẾM &amp; THAM VẤN"]) assert.ok(html.includes(label), `năm nút cố định còn nguyên: ${label}`);
	assert.deepEqual(DEFAULT_HERO.frames.length, 1);
});

test("nhiều khung: khung đầu là h1 có trong HTML máy chủ; khung sau là h2, ẩn khỏi trình đọc màn hình và không tab tới được", () => {
	const html = render({ "home.hero": { slides: [slide(), slide({ id: "b", title: "Khung hai", ctaLabel: "" })], autoEvent: true, autoLatest: true } }, SOURCES);
	assert.match(html, /<h1[^>]*>VỀ NƠI BÌNH YÊN<\/h1>/);
	assert.equal((html.match(/<h1/g) ?? []).length, 1, "chỉ một h1");
	assert.equal((html.match(/<h2/g) ?? []).length, 3);
	// Khung đầu hiện; ba khung sau ẩn (aria-hidden + inert + invisible).
	assert.equal((html.match(/aria-hidden="true"[^>]*inert=""[^>]*class="[^"]*invisible/g) ?? []).length, 3);
	assert.match(html, /aria-roledescription="trình chiếu"[^>]*aria-label="Khung đầu trang"|aria-label="Khung đầu trang"[^>]*aria-roledescription="trình chiếu"/);
	for (const [i, n] of [[1, 4], [2, 4], [3, 4], [4, 4]]) assert.ok(html.includes(`aria-label="Khung ${i} trên ${n}"`), `khung ${i}`);
	assert.match(html, /Khóa tu sắp tới · Còn 4 ngày/);
	assert.match(html, /KHÓA TU MÙA VU LAN/);
	assert.match(html, /Pháp sự mới nhất · 17\/10\/2026/);
});

test("nút điều khiển và chấm có tên tiếng Việt; chấm của khung đang xem có aria-current", () => {
	const html = render({ "home.hero": { slides: [slide(), slide({ id: "b", title: "Khung hai" })], autoEvent: false, autoLatest: false } });
	assert.match(html, /aria-label="Khung trước"/);
	assert.match(html, /aria-label="Khung sau"/);
	assert.match(html, /aria-label="Tạm dừng tự chuyển khung"/);
	assert.match(html, /aria-label="Xem khung 1 trên 2: VỀ NƠI BÌNH YÊN"[^>]*aria-current="true"/);
	assert.match(html, /aria-label="Xem khung 2 trên 2: KHUNG HAI"/);
	assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
	assert.match(html, /aria-live="off"/, "đang tự chuyển thì không đọc từng lần đổi khung");
});

test("nút của khung: địa chỉ trong trang là liên kết thường, https có rel noopener noreferrer, nhãn trống thì không có nút", () => {
	const html = render({ "home.hero": { slides: [slide({ id: "a" }), slide({ id: "b", title: "Hai", ctaLabel: "Đọc thêm", ctaHref: "https://example.org/bai?x=1" }), slide({ id: "c", title: "Ba", ctaLabel: "", ctaHref: "/khong-hien" })], autoEvent: false, autoLatest: false } });
	assert.match(html, /<a href="\/gioi-thieu"[^>]*>Tìm hiểu Bổn tự<\/a>/);
	assert.match(html, /<a href="https:\/\/example\.org\/bai\?x=1" rel="noopener noreferrer"[^>]*>Đọc thêm<\/a>/);
	assert.doesNotMatch(html, /khong-hien/);
});

test("dòng phụ ngắn: trình đọc màn hình nghe cả dòng một lần (từng chữ cái được dàn đều chỉ để nhìn)", () => {
	const html = render({});
	assert.match(html, /<span class="sr-only">CHỐN THIÊNG BÌNH YÊN<\/span><span aria-hidden="true"/);
});

test("đoạn chữ của khung và dòng nhỏ phía trên hiện ra; chữ admin nhập bị thoát ký tự, không thành thẻ", () => {
	const html = render({ "home.hero": { slides: [slide({ text: "<b>đậm</b> & \"trích\"" })], autoEvent: false, autoLatest: false } });
	assert.match(html, /&lt;b&gt;đậm&lt;\/b&gt; &amp; &quot;trích&quot;/);
	assert.doesNotMatch(html, /<b>đậm/);
	const withEvent = render({}, SOURCES);
	assert.match(withEvent, /Thứ Bảy, 07\/11\/2026 · Âm lịch \d+\/\d+N? Bính Ngọ · Chánh Điện/);
});
