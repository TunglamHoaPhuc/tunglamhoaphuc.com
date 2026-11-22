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
