// B3 (YouTube /embed/ and telling the editor when the body was changed by sanitising), B9 (markdownOf keeps the bold of a
// list item) and B14 (plainText keeps a "<" that is not a tag): the body and the plain fields of an article.
import { describe, expect, it } from "vitest";
import { markdownOf, parseSafe, plainText, sanitizeHtml } from "../../../src/admin/content/html";
import { contentWorld } from "../helpers/contentWorld";

type Raw = Record<string, unknown>;

describe("B3: YouTube addresses", () => {
	const video = (src: string) => `<div data-youtube-video><iframe src="${src}"></iframe></div>`;

	it("accepts the /embed/ address of youtube.com and writes it in its no-cookie form", () => {
		expect(sanitizeHtml(video("https://www.youtube.com/embed/dQw4w9WgXcQ"))).toContain('<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
		expect(sanitizeHtml(video("https://youtube.com/embed/dQw4w9WgXcQ?rel=0&start=30"))).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30"');
		expect(sanitizeHtml(video("https://youtube-nocookie.com/embed/dQw4w9WgXcQ"))).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
		expect(sanitizeHtml(video("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"))).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
	});

	it("still refuses what is not YouTube's embed address", () => {
		for (const src of [
			"http://www.youtube.com/embed/dQw4w9WgXcQ",
			"https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ",
			"https://evil.example/www.youtube.com/embed/dQw4w9WgXcQ",
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			"https://www.youtube.com/embed/",
			"javascript:alert(1)",
		]) {
			expect(sanitizeHtml(video(src)), src).not.toContain("<iframe");
		}
	});
});

describe("B3: the server says when sanitising changed the body", () => {
	async function opened(contentHtml?: string) {
		const w = await contentWorld();
		const client = await w.as("editor@example.test");
		const post = (await client.call("POST", "posts", { title: "Bài thử", section: "dong-chay-hoang-phap", ...(contentHtml ? { contentHtml } : {}) })).data;
		return { w, client, post };
	}

	it("answers bodyChanged: false when nothing was lost (and when the body is not sent)", async () => {
		const { client, post } = await opened();
		const clean = await client.call("PATCH", `posts/${post.id}`, { version: 1, contentHtml: '<h2>Tựa</h2><p>Một <strong>đậm</strong> <a href="https://example.org/x" target="_blank" rel="noopener noreferrer nofollow" class="link">x</a></p>' });
		expect(clean.status, JSON.stringify(clean.json)).toBe(200);
		expect(clean.data.bodyChanged).toBe(false);
		expect((await client.call("PATCH", `posts/${post.id}`, { version: 2, title: "Tên khác" })).data.bodyChanged).toBe(false);
	});

	it("answers bodyChanged: true when a tag, a link or a video was dropped or rewritten, and the stored HTML is what the editor must reload", async () => {
		const { w, client, post } = await opened();
		const html = '<p>H<sub>2</sub>O gọi <a href="tel:0900000000">0900</a></p><div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe></div>';
		const saved = await client.call("PATCH", `posts/${post.id}`, { version: 1, contentHtml: html });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(saved.data.bodyChanged).toBe(true);
		expect(saved.data.contentHtml).toContain("<p>H2O gọi 0900</p>");
		expect(saved.data.contentHtml).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
		expect((w.raw.prepare("SELECT content_html FROM post WHERE id = ?").get(post.id) as Raw).content_html).toBe(saved.data.contentHtml);
		// the same body again changes nothing in the row (no new version), but the editor still holds the lossy one: still told
		const again = await client.call("PATCH", `posts/${post.id}`, { version: 2, contentHtml: html });
		expect(again.data).toMatchObject({ version: 2, bodyChanged: true });
	});

	it("says it for a new article too", async () => {
		const { post } = await opened("<p>x<sup>2</sup></p>");
		expect(post.bodyChanged).toBe(true);
		expect(post.contentHtml).toBe("<p>x2</p>");
	});
});

describe("B9: markdownOf keeps the bold of a list item", () => {
	const md = (html: string) => markdownOf(parseSafe(html));

	it("keeps a ** that opens an item, whether the bold is the whole item or only its start", () => {
		expect(md("<ul><li><strong>Giới</strong>: không sát sinh</li><li><strong>Định</strong></li></ul>")).toBe("- **Giới**: không sát sinh\n- **Định**");
		expect(md("<ol><li><p><strong>Một</strong> việc</p></li></ol>")).toBe("1. **Một** việc");
	});

	it("still drops one list, quote or heading marker an item carries inside it", () => {
		expect(md("<ul><li>Cha<ul><li>Con</li></ul></li></ul>")).toBe("- Cha Con");
		expect(md("<ul><li><blockquote><p>Lời</p></blockquote></li></ul>")).toBe("- Lời");
		expect(md("<ul><li><h3>Tựa</h3></li></ul>")).toBe("- Tựa");
	});
});

describe("B14: plainText keeps a < that is not a tag", () => {
	it("keeps text around a less-than sign", () => {
		expect(plainText("Tuổi < 18 được miễn phí")).toBe("Tuổi < 18 được miễn phí");
		expect(plainText("1 < 2 và 3 > 2")).toBe("1 < 2 và 3 > 2");
		expect(plainText("a <3 b")).toBe("a <3 b");
	});

	it("still removes well-formed tags, closing tags and comments' brackets", () => {
		expect(plainText("  <b>Lễ</b> Vu Lan <script>x</script> ")).toBe("Lễ Vu Lan x");
		expect(plainText('<a href="https://x.example" title="a > b">liên kết</a> <br/> <p class=x>đoạn')).toBe("liên kết  đoạn");
	});

	it("saves a title with a < whole", async () => {
		const w = await contentWorld();
		const client = await w.as("editor@example.test");
		const post = (await client.call("POST", "posts", { title: "Tuổi < 18 được miễn phí", section: "dong-chay-hoang-phap", summary: "Dưới 18 tuổi: < 18" })).data;
		expect(post).toMatchObject({ title: "Tuổi < 18 được miễn phí", summary: "Dưới 18 tuổi: < 18", slug: "tuoi-18-duoc-mien-phi" });
	});
});

describe("B4: the video of a Tông Chỉ article", () => {
	const OLD = "dQw4w9WgXcQ";
	const NEW = "MKt_sLwxmNU";

	async function withVideo() {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		const saved = await editor.call("PATCH", "teachings/tc-1", { version: 1, video: { id: OLD, url: `https://www.youtube.com/watch?v=${OLD}`, title: "Khóa lễ", description: "" } });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		return { w, editor, version: saved.data.version as number };
	}

	it("takes the id from the new address, not from the id the form still holds", async () => {
		const { editor, version } = await withVideo();
		const changed = await editor.call("PATCH", "teachings/tc-1", { version, video: { id: OLD, url: `https://youtu.be/${NEW}`, title: "Khóa lễ", description: "" } });
		expect(changed.status, JSON.stringify(changed.json)).toBe(200);
		expect(changed.data.video).toMatchObject({ id: NEW, url: `https://youtu.be/${NEW}` });
	});

	it("falls back to the id only when there is no address (and builds the address)", async () => {
		const { editor, version } = await withVideo();
		const byId = await editor.call("PATCH", "teachings/tc-1", { version, video: { id: NEW, url: "", title: "", description: "" } });
		expect(byId.data.video).toMatchObject({ id: NEW, url: `https://www.youtube.com/watch?v=${NEW}` });
	});

	it("refuses an address that is not YouTube's even when an id is there", async () => {
		const { editor, version } = await withVideo();
		const bad = await editor.call("PATCH", "teachings/tc-1", { version, video: { id: OLD, url: "https://example.org/v", title: "", description: "" } });
		expect(bad.status).toBe(400);
		expect(Object.keys(bad.error.fields).join()).toMatch(/video/);
	});

	it("removes the video when both the address and the id are empty", async () => {
		const { w, editor, version } = await withVideo();
		const gone = await editor.call("PATCH", "teachings/tc-1", { version, video: { id: "", url: "", title: "Khóa lễ", description: "" } });
		expect(gone.status, JSON.stringify(gone.json)).toBe(200);
		expect(gone.data.video).toBeNull();
		expect((w.raw.prepare("SELECT video FROM teaching_article WHERE id = 'tc-1'").get() as Raw).video).toBeNull();
		expect((await editor.call("PATCH", "teachings/tc-1", { version: gone.data.version, video: null })).data.version).toBe(gone.data.version);
	});
});

describe("B5: the display name of a Tông Chỉ article follows its title", () => {
	const nameOf = (w: Awaited<ReturnType<typeof contentWorld>>, id = "tc-1") => (w.raw.prepare("SELECT name FROM teaching_article WHERE id = ?").get(id) as Raw).name;

	it("follows a new title when the name was the old title, whether or not the form sends the name back", async () => {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		const saved = await editor.call("PATCH", "teachings/tc-1", { version: 1, title: "Niệm Phật Hằng Ngày", name: "Niệm Phật" });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(saved.data).toMatchObject({ title: "Niệm Phật Hằng Ngày", name: "Niệm Phật Hằng Ngày" });
		expect(nameOf(w)).toBe("Niệm Phật Hằng Ngày");
		expect((await editor.call("PATCH", "teachings/tc-1", { version: 2, title: "Niệm Phật Tinh Tấn" })).data.name).toBe("Niệm Phật Tinh Tấn");
		const revision = JSON.parse(String((w.raw.prepare("SELECT snapshot FROM revision WHERE entity_id = 'tc-1' AND version = 3").get() as Raw).snapshot));
		expect(revision).toMatchObject({ title: "Niệm Phật Tinh Tấn", name: "Niệm Phật Tinh Tấn" });
	});

	it("follows the old 'title: subtitle' form of twins, and a name left empty by the import", async () => {
		const w = await contentWorld();
		w.raw.prepare("UPDATE teaching_article SET subtitle = 'Dành cho người trẻ', name = 'Niệm Phật: Dành cho người trẻ' WHERE id = 'tc-1'").run();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PATCH", "teachings/tc-1", { version: 1, title: "Tịnh Độ" })).data.name).toBe("Tịnh Độ: Dành cho người trẻ");
		expect((await editor.call("PATCH", "teachings/tc-1", { version: 2, subtitle: "Cho mọi người" })).data.name).toBe("Tịnh Độ: Cho mọi người");
		w.raw.prepare("UPDATE teaching_article SET name = '' WHERE id = 'tc-1'").run();
		expect((await editor.call("PATCH", "teachings/tc-1", { version: 3, title: "Tịnh Độ Tông", subtitle: "" })).data.name).toBe("Tịnh Độ Tông");
	});

	it("leaves a name the editors wrote themselves, and takes the one sent with the title", async () => {
		const w = await contentWorld();
		w.raw.prepare("UPDATE teaching_article SET name = 'Tên riêng' WHERE id = 'tc-1'").run();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PATCH", "teachings/tc-1", { version: 1, title: "Niệm Phật Mới", name: "Tên riêng" })).data.name).toBe("Tên riêng");
		expect((await editor.call("PATCH", "teachings/tc-1", { version: 2, title: "Niệm Phật Nữa", name: "Tên khác" })).data.name).toBe("Tên khác");
		expect(nameOf(w)).toBe("Tên khác");
	});
});

describe("B9: the Tông Chỉ preview shows the saved HTML the way the public page does", () => {
	it("gives the same body as the page for what Markdown cannot say (table, caption, sound, bold list items)", async () => {
		const { sanitizeHtml } = await import("../../../src/admin/content/html");
		const { tongChiArticle } = await import("../../../src/libs/content/tongChi");
		const html = '<h2>Giới</h2><ul><li><strong>Một</strong>: không sát sinh</li></ul><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table><figure><img src="/anh-goc/s2-cnv03/a.webp" alt="Sen"><figcaption>Hoa sen</figcaption></figure><audio controls src="https://example.test/p.mp3"></audio>';
		const entry = { id: "t", slug: "x", title: "X", name: "X", subtitle: "", group: { slug: "g", name: "G" }, banner: null, excerpt: "", author: "", authorHref: null, publishedDate: "", views: 0, video: null, featured: null, gallery: [], book: null, keywords: [], body: "", html } as never;
		const page = tongChiArticle(entry, []).contentHtml;
		expect(sanitizeHtml(html)).toBe(page);
		expect(page).toContain("<li><strong>Một</strong>: không sát sinh</li>");
		expect(page).toContain("<table>");
		expect(page).toContain("<figcaption>Hoa sen</figcaption>");
	});
});
