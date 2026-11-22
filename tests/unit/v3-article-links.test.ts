// V6: links in an article line. The renderer used to drop links (only <b>, <i>, <u> and pictures survived); now a
// line holds them as [text](address) and splitLinks cuts the line for the renderer to draw them.
import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToRendererText, splitLinks } from "@/lib/article-html";

test("dòng không có liên kết là một mảnh", () => {
	assert.deepEqual(splitLinks("Chỉ có chữ."), [{ text: "Chỉ có chữ." }]);
	assert.deepEqual(splitLinks(""), [{ text: "" }]);
	assert.deepEqual(splitLinks("Chữ [ngoặc] và (tròn) không phải liên kết."), [{ text: "Chữ [ngoặc] và (tròn) không phải liên kết." }]);
});

test("liên kết trong trang, ngoài trang, thư và neo được tách đúng chỗ, theo thứ tự", () => {
	assert.deepEqual(splitLinks("Xem [Tam quy](/tong-chi-tu-hoc/tam-quy), [bên ngoài](https://example.com/a?b=1) hay [thư](mailto:a@b.vn) và [neo](#muc)."), [
		{ text: "Xem " },
		{ text: "Tam quy", href: "/tong-chi-tu-hoc/tam-quy" },
		{ text: ", " },
		{ text: "bên ngoài", href: "https://example.com/a?b=1" },
		{ text: " hay " },
		{ text: "thư", href: "mailto:a@b.vn" },
		{ text: " và " },
		{ text: "neo", href: "#muc" },
		{ text: "." },
	]);
});

test("địa chỉ nguy hiểm không bao giờ thành liên kết", () => {
	for (const bad of ["[x](javascript:alert(1))", "[x](http://example.com)", "[x](//evil.example/p)", "[x](data:text/html,hi)"]) {
		assert.equal(splitLinks(bad).some((p) => p.href), false, bad);
	}
});

test("liên kết đi từ HTML của admin tới dòng chữ rồi tới mảnh liên kết, giữ chữ đậm trong chữ liên kết", () => {
	const line = htmlToRendererText('<p>Đọc <a href="/gioi-thieu/su-phu-tru-tri"><strong>Sư Phụ</strong></a> nhé.</p>');
	assert.equal(line, "Đọc [<b>Sư Phụ</b>](/gioi-thieu/su-phu-tru-tri) nhé.");
	assert.deepEqual(splitLinks(line).map((p) => p.href ?? null), [null, "/gioi-thieu/su-phu-tru-tri", null]);
});
