// V6: the V3 article pages show the admin's HTML. Legacy-shaped bodies keep the old look through the renderer's lines
// (now with headings, lists, quotes, pictures and links instead of dropping them); bodies with tables, video, sound or
// struck-out text are shown as sanitised HTML.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { htmlToRendererText, looksLikeHtml, needsRichHtml, richHtml } from "@/lib/article-html";

test("chữ không có thẻ đi qua nguyên vẹn (Markdown cũ, bài thơ)", () => {
	const markdown = "### Tiêu đề\n\nĐoạn **đậm** và *nghiêng*.\n\n> Lời trích\n\n- một\n- hai";
	assert.equal(looksLikeHtml(markdown), false);
	assert.equal(htmlToRendererText(markdown), markdown);
	assert.equal(needsRichHtml(markdown), false);
	assert.equal(looksLikeHtml("Tuổi < 18 và a > b"), false);
});

test("thân bài kiểu cũ (p, br, h3, a, blockquote, ul, ol, li, hr, ảnh): dùng đường cũ và không mất cấu trúc", () => {
	const html =
		'<h3>Phần một</h3><p>Dòng một<br>dòng hai <strong>đậm</strong> và <em>nghiêng</em>.</p>' +
		'<blockquote><p>Lời Thầy dạy</p><p>Vô Trí - Tâm Hòa</p></blockquote>' +
		'<ul><li>mục a</li><li>mục <b>b</b></li></ul><ol><li>một</li><li>hai</li></ol><hr>' +
		'<p>Xem <a href="/tong-chi-tu-hoc/tam-quy">Tam quy</a> và <a href="https://example.com/x">ngoài</a>.</p>' +
		'<figure><img src="/anh-goc/a/b.webp" alt="alt"><figcaption>Chú thích ảnh</figcaption></figure>';
	assert.equal(needsRichHtml(html), false);
	assert.equal(
		htmlToRendererText(html),
		[
			"### Phần một",
			"Dòng một\ndòng hai <b>đậm</b> và <i>nghiêng</i>.",
			"> Lời Thầy dạy\n> Vô Trí - Tâm Hòa",
			"- mục a\n- mục <b>b</b>",
			"1. một\n2. hai",
			"---",
			"Xem [Tam quy](/tong-chi-tu-hoc/tam-quy) và [ngoài](https://example.com/x).",
			"![Chú thích ảnh](/anh-goc/a/b.webp)",
		].join("\n\n"),
	);
});

test("danh sách lồng nhau, thẻ lạ và thẻ nguy hiểm: không lọt qua đường cũ", () => {
	const text = htmlToRendererText('<ul><li>cha<ul><li>con</li></ul></li></ul><p onclick="x()">Chữ <span style="color:red">xanh</span><script>alert(1)</script></p><p><a href="javascript:alert(1)">bẫy</a></p>');
	assert.equal(text, "- cha\n- con\n\nChữ xanh\n\nbẫy");
	assert.doesNotMatch(text, /script|alert|onclick|javascript/);
});

test("thực thể HTML và dấu < trong chữ được giải mã, không in thẻ thô", () => {
	assert.equal(htmlToRendererText("<p>Tuổi &lt; 18 &amp; &quot;hiếu&quot;&nbsp;thảo</p>"), 'Tuổi < 18 & "hiếu" thảo');
});

test("bảng, video, âm thanh, chữ gạch: dùng đường HTML", () => {
	for (const html of [
		"<table><tr><td>ô</td></tr></table>",
		'<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>',
		'<audio src="/anh-goc/am/thanh.mp3" controls></audio>',
		"<p>chữ <s>gạch</s></p>",
		'<div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>',
	]) assert.equal(needsRichHtml(html), true, html);
	assert.equal(needsRichHtml("<div><p>bọc ngoài thường</p></div>"), false);
});

test("đường HTML lọc lại bằng bộ lọc của admin: giữ bảng, video, chú thích; bỏ mã nguy hiểm", () => {
	const html = richHtml(
		'<h2>Bảng</h2><table><thead><tr><th scope="col">Cột</th></tr></thead><tbody><tr><td colspan="2" onclick="x()">ô</td></tr></tbody></table>' +
			'<figure><img src="/anh-goc/a.webp" alt="ảnh" onerror="x()"><figcaption>Chú thích</figcaption></figure>' +
			'<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" onload="x()"></iframe><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><iframe src="https://evil.example/x"></iframe>' +
			'<audio src="/anh-goc/am.mp3"></audio><a href="https://example.com/">liên kết</a><a href="javascript:alert(1)">bẫy</a><script>alert(1)</script><img src="javascript:alert(1)">',
	);
	for (const kept of ["<h2>Bảng</h2>", "<table>", '<th scope="col">', '<td colspan="2">', "<figcaption>Chú thích</figcaption>", 'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"', "<audio", 'href="https://example.com/"']) assert.ok(html.includes(kept), kept);
	assert.doesNotMatch(html, /onclick|onerror|onload|<script|javascript:|evil\.example|alert/);
});

test("trình dựng bài dùng đúng hai đường và chỉ đưa HTML đã lọc vào trang", () => {
	const renderer = readFileSync("src/components/tong-chi-tu-hoc/chi-tiet/InfographicArticleRenderer.tsx", "utf8");
	assert.match(renderer, /needsRichHtml\(rawContent\)/);
	assert.match(renderer, /parseSections\(htmlToRendererText\(rawContent\)\)/);
	const rich = readFileSync("src/components/article/RichHtmlBody.tsx", "utf8");
	assert.match(rich, /richHtml\(/);
	const raw = [...rich.matchAll(/__html:\s*([^}\n]+)/g)].map((m) => m[1].trim());
	assert.deepEqual(raw, ["safe"], "dangerouslySetInnerHTML chỉ nhận chuỗi đã qua richHtml");
});
