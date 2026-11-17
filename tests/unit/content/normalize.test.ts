import { describe, expect, it } from "vitest";
import { isEmojiImage, MEDIA_BASE, mediaKey, mediaUrl } from "@/libs/content/media";
import { type ContentNote, decodeEntities, renderContent, toIsoDate } from "@/libs/content/normalize";

describe("toIsoDate", () => {
	it("reads the three date styles of the old admin", () => {
		expect(toIsoDate("2026-10-17")).toBe("2026-10-17");
		expect(toIsoDate("04.10.2026")).toBe("2026-10-04");
		expect(toIsoDate("4.1.2026")).toBe("2026-01-04");
		// 17:30 UTC is already the next day in Vietnam.
		expect(toIsoDate("2026-03-01T17:30:00.000Z")).toBe("2026-03-02");
		expect(toIsoDate("2026-03-01T10:00:00+07:00")).toBe("2026-03-01");
	});

	it("rejects days that do not exist and other text", () => {
		for (const value of ["2026-02-30", "31.04.2026", "17/10/2026", "", "   ", null, undefined, "2026-13-01T00:00:00Z"]) {
			expect(toIsoDate(value)).toBeNull();
		}
	});
});

describe("mediaUrl", () => {
	const key = "tunglamhoaphuc-com/wp-content/uploads/2026/09/1-4-512x341.jpg";

	it("gathers both addresses of the B2 bucket on MEDIA_BASE", () => {
		for (const url of [
			`https://b1.congngheviet.com.vn/file/s2-cnv03/${key}`,
			`https://f005.backblazeb2.com/file/s2-cnv03/${key}`,
			`https://s2-cnv03.s3.us-east-005.backblazeb2.com/${key}`,
			`http://s2-cnv03.s3.us-east-005.backblazeb2.com/${key}`,
		]) {
			expect(mediaKey(url)).toBe(key);
			expect(mediaUrl(url)).toBe(`${MEDIA_BASE}/${key}`);
		}
	});

	it("sends WordPress pictures through /anh-goc/wordpress/, also when linked through the domain the new site takes over", () => {
		const wp = "https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/10/65.jfif";
		expect(mediaUrl(wp)).toBe("/anh-goc/wordpress/2026/10/65.jfif");
		expect(mediaKey(wp)).toBeNull();
		expect(mediaUrl("/anh-goc/wordpress/2026/10/65.jfif")).toBe("/anh-goc/wordpress/2026/10/65.jfif");
		expect(mediaUrl("https://tunglamhoaphuc.com/wp-content/uploads/2024/06/a.mp3")).toBe(
			"https://admin.tunglamhoaphuc.com/wp-content/uploads/2024/06/a.mp3",
		);
		expect(mediaUrl("http://www.tunglamhoaphuc.com/wp-content/uploads/x.jpg")).toBe("/anh-goc/wordpress/x.jpg");
		// Pages of the site itself stay where they are.
		expect(mediaUrl("https://www.tunglamhoaphuc.com/lich-tu-hoc")).toBe("https://www.tunglamhoaphuc.com/lich-tu-hoc");
	});

	it("keeps local paths, upgrades other hosts to https and drops what is not a web address", () => {
		expect(mediaUrl("/brand/logo-moc-an.webp")).toBe("/brand/logo-moc-an.webp");
		expect(mediaUrl("//example.org/a.png")).toBe("https://example.org/a.png");
		expect(mediaUrl("http://example.org/a.png")).toBe("https://example.org/a.png");
		for (const value of ["", "  ", null, undefined, "javascript:alert(1)", "data:image/png;base64,AAAA", "not a url"]) {
			expect(mediaUrl(value)).toBeNull();
		}
	});

	it("recognises Facebook emoji pictures", () => {
		expect(isEmojiImage("https://static.xx.fbcdn.net/images/emoji.php/v9/tde/1/16/1f4f8.png")).toBe(true);
		expect(isEmojiImage("https://scontent.xx.fbcdn.net/v/photo.jpg")).toBe(false);
	});
});

describe("decodeEntities", () => {
	it("turns the entities found in the data into characters", () => {
		expect(decodeEntities("a&nbsp;b &amp; c &#273; &#x1EA5;")).toBe("a b & c đ ấ");
		expect(decodeEntities("&unknown; &#0;")).toBe("&unknown; &#0;");
	});
});

describe("renderContent", () => {
	it("makes paragraphs, line breaks, headings below h1 and lists", () => {
		expect(renderContent("Một.\nHai.\n\n# Lớn\n## Vừa\n### Nhỏ\n#### Nhỏ hơn\n\n* a\n- b\n\n1. c\n2) d\nSau.")).toBe(
			[
				"<p>Một.<br>Hai.</p>",
				"<h2>Lớn</h2>",
				"<h2>Vừa</h2>",
				"<h3>Nhỏ</h3>",
				"<h4>Nhỏ hơn</h4>",
				"<ul><li>a</li><li>b</li></ul>",
				"<ol><li>c</li><li>d</li></ol>",
				"<p>Sau.</p>",
			].join("\n"),
		);
	});

	it("links bare addresses and [text](url), and makes **bold**", () => {
		expect(renderContent("Xem https://example.org/a?b=1. Và [lịch](https://example.org/l) **đậm**")).toBe(
			'<p>Xem <a href="https://example.org/a?b=1" rel="noopener noreferrer">https://example.org/a?b=1</a>. Và <a href="https://example.org/l" rel="noopener noreferrer">lịch</a> <strong>đậm</strong></p>',
		);
	});

	it("lets no markup or script through", () => {
		const html = renderContent(
			'<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[bấm](javascript:alert(1)) [x](data:text/html,hi)\n\n![](javascript:alert(1))',
		);
		expect(html).not.toMatch(/<script|<img|javascript:|data:text/i);
		expect(html).not.toMatch(/<[^>]+\son[a-z]+=/i);
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
		expect(html).toContain("<p>bấm x</p>");
	});

	it("drops Facebook emoji pictures and notes links that must move to WordPress", () => {
		const notes: ContentNote[] = [];
		const html = renderContent(
			"![](https://static.xx.fbcdn.net/images/emoji.php/v9/a.png)\n\nNghe: https://tunglamhoaphuc.com/wp-content/uploads/a.mp3\n\n![Chùa](https://b1.congngheviet.com.vn/file/s2-cnv03/x/y.jpg)",
			notes,
		);
		expect(html).not.toContain("fbcdn");
		expect(html).toContain('href="https://admin.tunglamhoaphuc.com/wp-content/uploads/a.mp3"');
		expect(html).toContain(`<img src="${MEDIA_BASE}/x/y.jpg" alt="Chùa" loading="lazy" decoding="async">`);
		expect(notes.map((note) => note.kind)).toEqual(["emoji-image", "moved-link"]);
	});

	it("makes > quotes (dropping heading marks inside) and --- or ***** rules", () => {
		expect(renderContent("> ### Lời dẫn\n> dòng hai\n\n*****\n\n---")).toBe("<blockquote><p>Lời dẫn<br>dòng hai</p></blockquote>\n<hr>\n<hr>");
	});

	it("reads link targets that hold brackets, so none slips through as text", () => {
		expect(renderContent("[ảnh](https://example.org/anh_(1).jpg)")).toBe(
			'<p><a href="https://example.org/anh_(1).jpg" rel="noopener noreferrer">ảnh</a></p>',
		);
		expect(renderContent("[bấm](javascript:alert(1))")).toBe("<p>bấm</p>");
	});

	it("drops half an emoji left by a cut text", () => {
		expect(renderContent("Giao thừa 🎆\ud83d")).toBe("<p>Giao thừa 🎆</p>");
	});

	it("turns &nbsp; into a real no-break space and escapes the rest", () => {
		expect(renderContent("A&nbsp;B & <C>")).toBe("<p>A B &amp; &lt;C&gt;</p>");
		expect(renderContent("")).toBe("");
	});
});
