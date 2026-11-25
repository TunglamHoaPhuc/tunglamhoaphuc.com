// Slide poster cột trái "Lịch tu học": mỗi trang phải là một nội dung khác nhau, chỉ số và vòng lặp đúng, ảnh lỗi không để lại khung trống
// hay ảnh thay thế lặp lại. Logic thuần ở src/features/home/calendar-slides.ts, dùng trong CalendarSection.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildQuoteList,
	buildSlides,
	clampSlide,
	nextSlideIndex,
	prevSlideIndex,
	quoteImageKey,
	quoteImageSlug,
	slideKey,
	swipeDirection,
	webpRetryUrl,
	type QuoteItem,
} from "@/features/home/calendar-slides";

const q = (n: number, ext = "webp"): QuoteItem => ({ id: `quote-${n}`, url: `https://www.tunglamhoaphuc.com/images/lich-tu-hoc/quotes/thang-${String(n).padStart(2, "0")}.${ext}`, title: `T${n}` });
const gallery12 = Array.from({ length: 12 }, (_, i) => q(i + 1));

test("quoteImageKey: cùng một ảnh dù khác tên miền, đuôi tệp, cỡ ảnh hay query", () => {
	const a = quoteImageKey("https://www.tunglamhoaphuc.com/images/x/thang-01.png");
	assert.equal(a, quoteImageKey("/images/x/thang-01.webp"));
	assert.equal(a, quoteImageKey("/images/X/Thang-01.WEBP?v=3"));
	assert.equal(a, quoteImageKey("/images/x/thang-01.webp@640"));
	assert.notEqual(a, quoteImageKey("/images/x/thang-02.webp"));
	assert.equal(quoteImageKey(""), "");
	assert.equal(quoteImageKey(undefined), "");
});

test("buildQuoteList: bỏ mục trùng ảnh, trùng id, không có ảnh; giữ thứ tự", () => {
	const list = buildQuoteList(
		[q(1), q(2), { ...q(2), id: "dup-id-other" }, { id: "quote-2", url: "/images/khac.webp" }, { id: "x", url: "" }, q(1, "png"), q(3)],
		{ currentMonth: 5 },
	);
	assert.deepEqual(list.map((i) => i.id), ["quote-1", "quote-2", "quote-3"]);
	assert.equal(new Set(list.map((i) => quoteImageKey(i.url))).size, list.length);
});

test("buildQuoteList: hai tháng cùng một câu (thang-08-ve-ben-thay, thang-11-ve-ben-thay) chỉ ra một trang, giữ trang đứng trước", () => {
	const named = (n: number, slug: string): QuoteItem => ({ id: `quote-${n}`, url: `/images/lich-tu-hoc/quotes/thang-${String(n).padStart(2, "0")}-${slug}.webp` });
	const items = [named(7, "biet-minh"), named(8, "ve-ben-thay"), named(11, "ve-ben-thay"), named(12, "kho-dau")];
	assert.deepEqual(buildQuoteList(items, { currentMonth: 0 }).map((i) => i.id), ["quote-7", "quote-8", "quote-12"]);
	assert.deepEqual(buildQuoteList(items, { currentMonth: 10 }).map((i) => i.id), ["quote-11", "quote-7", "quote-12"]);
	assert.equal(quoteImageSlug("/a/thang-03.webp"), "");
	assert.equal(quoteImageSlug("/a/thang-03-dung-bo-cuoc.png"), "dung-bo-cuoc");
});

test("buildQuoteList: ảnh tháng đang xem lên đầu, khớp theo ảnh dù đuôi tệp khác (png ở D1, webp ở chủ đề) và không nhân bản", () => {
	const png = gallery12.map((g, i) => q(i + 1, "png"));
	const list = buildQuoteList(png, { currentMonth: 10, currentQuoteUrl: "/images/lich-tu-hoc/quotes/ignored.webp" });
	assert.equal(list[0].id, "quote-11");
	assert.equal(list.length, 12);
	const byUrl = buildQuoteList(png, { currentMonth: 0, currentQuoteUrl: "https://www.tunglamhoaphuc.com/images/lich-tu-hoc/quotes/thang-07.webp" });
	assert.equal(byUrl[0].id, "quote-7");
	assert.equal(byUrl.length, 12);
});

test("buildQuoteList: bỏ ảnh đã báo lỗi theo khóa ảnh (đuôi tệp không quan trọng)", () => {
	const list = buildQuoteList(gallery12, { currentMonth: 0, failedKeys: new Set([quoteImageKey(q(4, "png").url), quoteImageKey(q(9).url)]) });
	assert.equal(list.length, 10);
	assert.ok(!list.some((i) => i.id === "quote-4" || i.id === "quote-9"));
});

test("buildQuoteList: kho rỗng hoặc một ảnh không lỗi, không đổi thứ tự", () => {
	assert.deepEqual(buildQuoteList([], { currentMonth: 0 }), []);
	assert.deepEqual(buildQuoteList([q(3)], { currentMonth: 5 }).map((i) => i.id), ["quote-3"]);
});

test("buildSlides: trang 0 là chủ đề tháng, mỗi ảnh đúng một trang, khóa trang không trùng", () => {
	const slides = buildSlides(buildQuoteList(gallery12, { currentMonth: 2 }));
	assert.equal(slides.length, 13);
	assert.equal(slides[0].type, "theme");
	assert.ok(slides.slice(1).every((s) => s.type === "quote"));
	const keys = slides.map(slideKey);
	assert.equal(new Set(keys).size, keys.length);
	assert.equal(buildSlides([]).length, 1);
});

test("chỉ số: tiến vòng từ trang cuối về trang đầu, lùi từ trang đầu về trang cuối, đi đủ một vòng thì thăm mọi trang đúng một lần", () => {
	const n = 13;
	assert.equal(nextSlideIndex(n - 1, n), 0);
	assert.equal(prevSlideIndex(0, n), n - 1);
	const seen: number[] = [];
	let i = 0;
	for (let k = 0; k < n; k++) {
		seen.push(i);
		i = nextSlideIndex(i, n);
	}
	assert.equal(i, 0);
	assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: n }, (_, k) => k));
	let j = 0;
	const back: number[] = [];
	for (let k = 0; k < n; k++) {
		back.push(j);
		j = prevSlideIndex(j, n);
	}
	assert.equal(new Set(back).size, n);
});

test("chỉ số: một trang hoặc rỗng thì ở yên; chỉ số vượt do danh sách ngắn lại được kéo về trang cuối hợp lệ", () => {
	assert.equal(nextSlideIndex(0, 1), 0);
	assert.equal(prevSlideIndex(0, 1), 0);
	assert.equal(nextSlideIndex(3, 0), 0);
	assert.equal(clampSlide(12, 10), 9);
	assert.equal(clampSlide(-2, 10), 0);
	assert.equal(clampSlide(Number.NaN, 10), 0);
	assert.equal(nextSlideIndex(12, 10), 0, "chỉ số ngoài phạm vi tiến sang đầu, không văng ra ngoài danh sách");
	assert.equal(prevSlideIndex(12, 10), 8);
});

test("webpRetryUrl: chỉ thử lại với png/jpg, giữ query, không với webp", () => {
	assert.equal(webpRetryUrl("/images/a/thang-01.png"), "/images/a/thang-01.webp");
	assert.equal(webpRetryUrl("https://x.vn/a/b.JPEG?v=1"), "https://x.vn/a/b.webp");
	assert.equal(webpRetryUrl("/images/a/thang-01.webp"), null);
	assert.equal(webpRetryUrl("/images/a/thang-01"), null);
});

test("swipeDirection: vuốt trái sang trang sau, vuốt phải về trang trước, vuốt ngắn hoặc chéo dọc thì không đổi", () => {
	assert.equal(swipeDirection(-80, 5), 1);
	assert.equal(swipeDirection(80, -5), -1);
	assert.equal(swipeDirection(-20, 0), 0);
	assert.equal(swipeDirection(-80, 70), 0);
	assert.equal(swipeDirection(0, 0), 0);
});
