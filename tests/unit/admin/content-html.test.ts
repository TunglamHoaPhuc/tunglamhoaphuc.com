import { describe, expect, it } from "vitest";
import { markdownOf, mediaIdsIn, parseSafe, plainText, sanitizeHtml, textOf } from "../../../src/admin/content/html";
import { signPreview, verifyPreview } from "../../../src/admin/content/preview";
import { parseExtra, youtubeIdOf } from "../../../src/admin/content/extra";
import { searchTextOf, searchWords } from "../../../src/admin/content/search";
import { renderContent } from "../../../src/libs/content/normalize";

const clean = (html: string) => sanitizeHtml(html);

describe("the article sanitiser keeps what the editor makes", () => {
	it("keeps headings, paragraphs, marks, lists, quotes of sutras and verses, rules and tables", () => {
		const html =
			'<h2>Tựa</h2><h3>Mục</h3><h4>Ý</h4><p>Một <strong>đậm</strong> <em>nghiêng</em> <u>gạch</u> <s>xóa</s><br>dòng</p><ul><li><p>a</p></li></ul><ol><li>b</li></ol><blockquote class="kinh"><p>Kinh</p></blockquote><blockquote class="tho"><p>Thơ</p></blockquote><blockquote><p>Thường</p></blockquote><hr><table><tbody><tr><th colspan="2" rowspan="1">A</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>';
		expect(clean(html)).toBe(
			'<h2>Tựa</h2><h3>Mục</h3><h4>Ý</h4><p>Một <strong>đậm</strong> <em>nghiêng</em> <u>gạch</u> <s>xóa</s><br>dòng</p><ul><li><p>a</p></li></ul><ol><li>b</li></ol><blockquote class="kinh"><p>Kinh</p></blockquote><blockquote class="tho"><p>Thơ</p></blockquote><blockquote><p>Thường</p></blockquote><hr><table><tbody><tr><th colspan="2">A</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>',
		);
	});

	it("keeps a picture with its caption and media id, a YouTube video and a sound", () => {
		const html =
			'<figure><img src="/anh-goc/s2-cnv03/cms/media-a/v1/sen.webp" alt="Hoa sen" data-media-id="media-a" loading="lazy"><figcaption>Sen nở</figcaption></figure><div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30" width="640" height="480" allowfullscreen="true" autoplay="false"></iframe></div><audio src="/anh-goc/s2-cnv03/cms/kinh.mp3" data-media-id="audio-1" autoplay></audio>';
		const out = clean(html);
		expect(out).toContain('<figure><img src="/anh-goc/s2-cnv03/cms/media-a/v1/sen.webp" alt="Hoa sen" data-media-id="media-a" loading="lazy"><figcaption>Sen nở</figcaption></figure>');
		expect(out).toContain('<div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30" title="Video YouTube" width="640" height="480" loading="lazy"');
		expect(out).toContain('<audio src="/anh-goc/s2-cnv03/cms/kinh.mp3" controls preload="none" data-media-id="audio-1"></audio>');
		expect(out).not.toContain("autoplay");
	});

	it("keeps only the start time of a video address the editor builds with more options", () => {
		expect(clean('<div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&amp;start=12&amp;controls=0"></iframe></div>')).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=12"');
		expect(clean('<div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=1"></iframe></div>')).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
	});

	it("opens outside links in a new tab with noopener and leaves the site's own links alone", () => {
		expect(clean('<p><a href="https://example.org/x">x</a></p>')).toBe('<p><a href="https://example.org/x" target="_blank" rel="noopener noreferrer">x</a></p>');
		expect(clean('<p><a href="https://www.tunglamhoaphuc.com/lich-tu-hoc" target="_blank">y</a></p>')).toBe('<p><a href="https://www.tunglamhoaphuc.com/lich-tu-hoc">y</a></p>');
		expect(clean('<p><a href="/tong-chi-tu-hoc/niem-phat">z</a> <a href="mailto:chua@example.org">m</a></p>')).toBe('<p><a href="/tong-chi-tu-hoc/niem-phat">z</a> <a href="mailto:chua@example.org">m</a></p>');
	});

	it("maps the old tags onto the kept ones and unwraps what has no place", () => {
		expect(clean("<h1>A</h1><h5>B</h5><p><b>c</b><i>d</i><span class='x' onclick='1'>e</span><font>f</font></p>")).toBe("<h2>A</h2><h4>B</h4><p><strong>c</strong><em>d</em>ef</p>");
	});

	it("gives library pictures their current address by media id", () => {
		const out = sanitizeHtml('<img src="/anh-goc/s2-cnv03/cms/media-a/v1/sen.webp" data-media-id="media-a" alt="">', { mediaSrc: new Map([["media-a", "/anh-goc/s2-cnv03/cms/media-a/v2/sen.webp"]]) });
		expect(out).toBe('<img src="/anh-goc/s2-cnv03/cms/media-a/v2/sen.webp" alt="" data-media-id="media-a" loading="lazy">');
	});
});

describe("the article sanitiser refuses hostile input", () => {
	const hostile: [string, string][] = [
		["<script>alert(1)</script><p>ok</p>", "<p>ok</p>"],
		["<SCRIPT SRC=//evil.example/x.js></SCRIPT><p>ok</p>", "<p>ok</p>"],
		['<img src="x" onerror="alert(1)">', ""],
		['<img src="/anh-goc/a.webp" onerror="alert(1)" alt="a">', '<img src="/anh-goc/a.webp" alt="a" loading="lazy">'],
		['<p onclick="alert(1)" style="background:url(javascript:alert(1))">x</p>', "<p>x</p>"],
		['<a href="javascript:alert(1)">x</a>', "x"],
		['<a href="JaVaScRiPt:alert(1)">x</a>', "x"],
		['<a href="jav&#x09;ascript:alert(1)">x</a>', "x"],
		['<a href="&#106;avascript:alert(1)">x</a>', "x"],
		['<a href=" javascript:alert(1)">x</a>', "x"],
		['<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', "x"],
		['<a href="//evil.example/">x</a>', "x"],
		['<a href="http://plain.example/">x</a>', "x"],
		['<img src="data:image/svg+xml,<svg onload=alert(1)>">', ""],
		['<img src="javascript:alert(1)">', ""],
		['<iframe src="https://evil.example/embed/x"></iframe>', ""],
		['<iframe src="https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ"></iframe>', ""],
		['<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" srcdoc="<script>alert(1)</script>"></iframe>', 'title="Video YouTube"'],
		["<svg><script>alert(1)</script><a xlink:href='javascript:alert(1)'>x</a></svg><p>sau</p>", "<p>sau</p>"],
		["<math><mi xlink:href='javascript:alert(1)'>x</mi></math>", ""],
		["<style>p{background:url(javascript:alert(1))}</style><p>ok</p>", "<p>ok</p>"],
		["<!--<script>alert(1)</script>--><p>ok</p>", "<p>ok</p>"],
		["<!--><img src=x onerror=alert(1)>-->", "--&gt;"],
		["<scr<script>ipt>alert(1)</script>", "ipt&gt;alert(1)"],
		["<p>a < b > c & d &amp; e</p>", "<p>a &lt; b &gt; c &amp; d &amp; e</p>"],
		['<blockquote class="kinh evil" onmouseover="x">q</blockquote>', "<blockquote>q</blockquote>"],
		['<audio src="javascript:alert(1)" controls></audio>', ""],
		['<object data="x.swf"></object><embed src="x.swf"><form action="/x"><input name="a"></form>', ""],
		["<textarea><img src=x onerror=alert(1)></textarea>", ""],
		['<img src="/anh-goc/a.webp" alt="x" data-media-id="a&quot; onerror=&quot;alert(1)">', '<img src="/anh-goc/a.webp" alt="x" loading="lazy">'],
		['<img src="/anh-goc/a.webp" alt="&quot;&gt;&lt;script&gt;">', '<img src="/anh-goc/a.webp" alt="&quot;&gt;&lt;script&gt;" loading="lazy">'],
		["<p>never closed <strong>bold", "<p>never closed <strong>bold</strong></p>"],
		['<img src="/anh-goc/a.webp', ""],
	];
	for (const [input, expected] of hostile) {
		it(`cleans ${input.slice(0, 60)}`, () => {
			const out = clean(input);
			expect(out).toContain(expected);
			expect(out).not.toMatch(/<script|onerror|onclick|onload|onmouseover|javascript:|style=|srcdoc|xlink|<svg|<math|<object|<embed|<form|<input|<textarea/i);
		});
	}
});

describe("reading a body", () => {
	it("lists media ids, gives the words one block a line, and strips tags from plain fields", () => {
		const tree = parseSafe('<h2>Đề</h2><p>Một<br>hai</p><figure><img src="/anh-goc/a.webp" alt="Sen" data-media-id="m1"></figure><audio src="/anh-goc/b.mp3" data-media-id="m2"></audio><table><tr><td>a</td><td>b</td></tr></table>');
		expect(mediaIdsIn(tree)).toEqual(["m1", "m2"]);
		expect(textOf(tree)).toBe("Đề\nMột\nhai\n[Ảnh: Sen]\na b");
		expect(plainText("  <b>Lễ</b> Vu Lan <script>x</script> ")).toBe("Lễ Vu Lan x");
	});

	it("turns the editor's HTML into the Markdown the Tông Chỉ pages read, and back to the same structure", () => {
		const tree = parseSafe('<h2>Niệm Phật</h2><p>Nhất tâm <strong>niệm</strong> <a href="/tong-chi-tu-hoc/thien">Thiền</a></p><blockquote><p>Nam mô A Di Đà Phật</p></blockquote><ul><li><p>Một</p></li><li><p>Hai</p></li></ul><ol><li>Ba</li></ol><hr><figure><img src="/anh-goc/a.webp" alt="Tượng"></figure><table><tr><td>Giờ</td><td>Việc</td></tr></table>');
		const markdown = markdownOf(tree);
		expect(markdown).toBe("## Niệm Phật\n\nNhất tâm **niệm** [Thiền](/tong-chi-tu-hoc/thien)\n\n> Nam mô A Di Đà Phật\n\n- Một\n- Hai\n\n1. Ba\n\n---\n\n![Tượng](/anh-goc/a.webp)\n\n- Giờ – Việc");
		const html = renderContent(markdown);
		expect(html).toContain("<h2>Niệm Phật</h2>");
		expect(html).toContain("<strong>niệm</strong>");
		expect(html).toContain("<blockquote><p>Nam mô A Di Đà Phật</p></blockquote>");
		expect(html).toContain("<ul><li>Một</li><li>Hai</li></ul>");
	});
});

describe("search words", () => {
	it("match without accents", () => {
		expect(searchTextOf("Lễ Vu Lan", "Đại lễ báo hiếu")).toBe("le vu lan dai le bao hieu");
		expect(searchWords("  Bồ ĐỀ bồ đề tâm ")).toEqual(["bo", "de", "tam"]);
	});
});

describe("category fields", () => {
	it("checks each category's own fields and drops what another category left", () => {
		expect(parseExtra("phap-am", { audioUrl: "https://cdn.example/kinh.mp3", duration: "12:30", youtubeId: "x" })).toEqual({ ok: true, data: { audioUrl: "https://cdn.example/kinh.mp3", duration: "12:30" } });
		expect(parseExtra("phap-am", { duration: "12 phút" })).toMatchObject({ ok: false, fields: { "extra.duration": expect.any(String) } });
		expect(parseExtra("video", { youtubeId: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3" })).toEqual({ ok: true, data: { youtubeId: "dQw4w9WgXcQ" } });
		expect(parseExtra("an-pham-sach", { book: { title: "Kinh", link: "javascript:alert(1)" } })).toMatchObject({ ok: false });
		expect(parseExtra("cong-tu", { audioUrl: "https://x.example/a.mp3" })).toEqual({ ok: true, data: {} });
		expect(parseExtra("bai-viet", { anything: 1 })).toEqual({ ok: true, data: {} });
		expect(youtubeIdOf("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
	});
});

describe("preview tokens", () => {
	const secret = "s".repeat(40);
	const now = new Date("2026-11-21T03:00:00Z");

	it("are bound to the kind, the id and the version, and last 30 minutes", async () => {
		const { token, expiresAt } = await signPreview({ kind: "posts", id: "post-1", version: 3 }, secret, now);
		expect(expiresAt).toBe("2026-11-21T03:30:00.000Z");
		expect(await verifyPreview(token, "posts", "post-1", secret, now)).toMatchObject({ version: 3 });
		expect(await verifyPreview(token, "posts", "post-2", secret, now)).toBeNull();
		expect(await verifyPreview(token, "pages", "post-1", secret, now)).toBeNull();
		expect(await verifyPreview(token, "posts", "post-1", "k".repeat(40), now)).toBeNull();
		expect(await verifyPreview(token, "posts", "post-1", secret, new Date(now.getTime() + 30 * 60_000 + 1))).toBeNull();
	});

	it("refuse a changed payload or signature", async () => {
		const { token } = await signPreview({ kind: "posts", id: "post-1", version: 3 }, secret, now);
		const [payload, signature] = token.split(".");
		const forged = Buffer.from(JSON.stringify(["posts", "post-1", 4, now.getTime() + 60_000])).toString("base64url");
		expect(await verifyPreview(`${forged}.${signature}`, "posts", "post-1", secret, now)).toBeNull();
		expect(await verifyPreview(`${payload}.${signature.slice(0, -2)}xx`, "posts", "post-1", secret, now)).toBeNull();
		expect(await verifyPreview("", "posts", "post-1", secret, now)).toBeNull();
		expect(await verifyPreview(`${payload}.${signature}.x`, "posts", "post-1", secret, now)).toBeNull();
	});
});
