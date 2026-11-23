// V6, end to end on the server: the real article renderer, fed the admin's HTML, draws headings, lists, quotes,
// links and pictures (legacy-shaped bodies, old look) or the sanitised HTML (tables, video, sound).
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InfographicArticleRenderer } from "@/components/tong-chi-tu-hoc/chi-tiet/InfographicArticleRenderer";

const render = (rawContent: string, extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(InfographicArticleRenderer, { rawContent, title: "Tiêu đề", ...extra }));

test("thân bài kiểu cũ: tiêu đề phần, danh sách, liên kết, ảnh được dựng, không còn thẻ thô trong chữ", () => {
	const html = render(
		'<h2>Phần một</h2><p>Đoạn mở đầu có <strong>chữ đậm</strong> dài dài dài dài dài dài dài dài dài dài dài dài dài dài dài. Xem <a href="/tong-chi-tu-hoc/tam-quy">Tam quy</a> và <a href="https://example.com/x">ngoài</a>.</p><ul><li>mục a</li><li>mục b</li></ul><figure><img src="/anh-goc/a/b.webp" alt="ảnh"><figcaption>Chú thích</figcaption></figure>',
	);
	assert.match(html, /<h3[^>]*>Phần một<\/h3>/);
	assert.match(html, /<strong[^>]*>chữ đậm<\/strong>/);
	assert.match(html, /<a href="\/tong-chi-tu-hoc\/tam-quy"[^>]*>Tam quy<\/a>/);
	assert.match(html, /<a href="https:\/\/example\.com\/x"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>ngoài<\/a>/);
	assert.match(html, /<li[^>]*>[\s\S]*mục a/);
	assert.match(html, /\/anh-goc\/a\/b\.webp/);
	assert.match(html, /Chú thích/);
	assert.doesNotMatch(html, /&lt;(h2|h3|ul|li|p|a|strong|figure)\b/, "không in thẻ HTML thô ra chữ");
	assert.doesNotMatch(html, /class="tlhp-rich"/);
});

test("thân bài có bảng, video, âm thanh: hiện bằng HTML đã lọc, không có mã nguy hiểm", () => {
	const html = render(
		'<h2>Bảng</h2><table><tr><th>Cột</th></tr><tr><td onclick="x()">ô</td></tr></table><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe><audio src="/anh-goc/am.mp3"></audio><script>alert(1)</script>',
	);
	assert.match(html, /class="tlhp-rich"/);
	assert.match(html, /<table>/);
	assert.match(html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
	assert.match(html, /<audio/);
	assert.doesNotMatch(html, /<script|onclick|alert/);
});

test("khối tác giả chỉ là liên kết khi admin nhập liên kết; không còn dẫn tới trang bịa sẵn", () => {
	assert.doesNotMatch(render("<p>Nội dung.</p>", { author: "Tâm Hòa" }), /gioi-thieu\/su-phu-tru-tri/);
	assert.match(render("<p>Nội dung.</p>", { author: "Tâm Hòa", authorLink: "/gioi-thieu/su-phu-tru-tri" }), /<a href="\/gioi-thieu\/su-phu-tru-tri"/);
	assert.match(render("<p>Nội dung.</p>", { author: "Tâm Hòa" }), /Tâm Hòa/);
});

test("Markdown cũ không có thẻ vẫn được dựng như trước", () => {
	const html = render("### Mục một\n\nMột đoạn văn dài dài dài dài dài dài dài dài dài dài dài dài dài dài dài dài.\n\n- a\n- b");
	assert.match(html, /<h3[^>]*>Mục một<\/h3>/);
	assert.match(html, /<li[^>]*>[\s\S]*a/);
});
