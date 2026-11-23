// Trang /tri-tue-phat-phap/<slug> của năm ấn phẩm đóng gói (src/data/sach-an-pham-data.json): trước đây bốn quyển chỉ có
// volumes[].chapters[] = { chapterNumber, title, content } (không có `sections`) nên BookDualReader gọi `chap.sections.forEach`
// trên undefined và trang trả 500. Test dựng thật bằng renderToStaticMarkup cho cả năm sách, hai dạng dữ liệu.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sachAnPhamData from "@/data/sach-an-pham-data.json";
import { BookDualReader, bookVolumes, readerChapters } from "@/components/tri-tue-phat-phap/BookDualReader";

const SLUGS = [
	"di-qua-kho-vui-cuoc-doi",
	"khuyen-phat-bo-de-tam-giang-luan",
	"37-pham-tro-dao-dien-tho",
	"loi-day-cua-duc-phat",
	"ba-nuong-tua-va-nam-thuc-hanh",
];

test("dữ liệu có đủ năm sách", () => {
	assert.deepEqual(sachAnPhamData.map((b) => b.slug), SLUGS);
});

for (const slug of SLUGS) {
	test(`${slug}: dựng được trang đọc (không ném lỗi), có tên sách, mục lục và chương đầu`, () => {
		const book = sachAnPhamData.find((b) => b.slug === slug)!;
		const html = renderToStaticMarkup(createElement(BookDualReader, { book: book as never }));
		assert.ok(html.includes(book.title), "có tên sách");
		const chapters = readerChapters(bookVolumes(book as never)[0]);
		assert.ok(chapters.length > 0, "có chương");
		for (const chapter of chapters) {
			assert.ok(Array.isArray(chapter.sections) && chapter.sections.length > 0, `chương "${chapter.title}" có đoạn`);
			for (const section of chapter.sections) assert.equal(typeof section.content, "string");
		}
		assert.ok(html.includes(chapters[0].title.slice(0, 20).replace(/&/g, "&amp;")), "hiện chương đầu");
	});
}

test("sách nhiều quyển có thanh chọn quyển, sách một quyển thì không", () => {
	const many = renderToStaticMarkup(createElement(BookDualReader, { book: sachAnPhamData.find((b) => b.slug === "khuyen-phat-bo-de-tam-giang-luan") as never }));
	assert.match(many, /aria-label="Chọn quyển"/);
	const one = renderToStaticMarkup(createElement(BookDualReader, { book: sachAnPhamData.find((b) => b.slug === "37-pham-tro-dao-dien-tho") as never }));
	assert.doesNotMatch(one, /aria-label="Chọn quyển"/);
});

test("chương không có `sections` được dựng thành đoạn từ `content`; chương có sẵn `sections` giữ nguyên", () => {
	const [plain] = readerChapters({ title: "Q", pageCount: 1, chapters: [{ chapterNumber: 1, title: "MỞ ĐẦU", content: "Dòng một\n\nDòng hai" }] } as never);
	assert.equal(plain.sections.length, 1);
	assert.equal(plain.sections[0].content, "Dòng một\n\nDòng hai");
	const sections = [{ type: "essay", title: "T", content: "x" }];
	const [kept] = readerChapters({ title: "Q", pageCount: 1, chapters: [{ chapterNumber: 1, title: "C", sections }] } as never);
	assert.equal(kept.sections, sections);
});
