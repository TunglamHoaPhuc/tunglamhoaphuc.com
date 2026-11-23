// Two things the real data showed (tests/unit/admin/data-integrity.test.ts), kept here on a small world:
//  - restoring a version puts back the text it kept, as it was: the old site's HTML is not sanitised again (that added target="_blank"
//    to its links), while a version that holds library pictures still has them pointed at their current address;
//  - the first save of an imported Tông Chỉ article fixes the HTML its page shows, so editing only its title does not change the text
//    (the page of an article without HTML is made from the designer's brief, which depends on the title).
import { describe, expect, it } from "vitest";
import { asD1 } from "../../../src/db/nodeSqlite";
import { createD1Repository } from "../../../src/libs/content/sources/d1";
import { contentWorld } from "../helpers/contentWorld";

const OLD_HTML = '<p>Xem <a href="https://example.test/bai" rel="noopener noreferrer">liên kết cũ</a> và <a href="https://example.test/b">liên kết thứ hai</a></p>';

describe("restoring a version", () => {
	it("gives the old site's HTML back byte for byte (no target added to its links)", async () => {
		const w = await contentWorld();
		w.raw.prepare("UPDATE post SET content_html = ? WHERE id = 'post-1060'").run(OLD_HTML);
		const root = await w.as("root@example.test");
		const edited = await root.call("PATCH", "posts/post-1060", { version: 1, title: "Tiêu đề mới", contentHtml: `${OLD_HTML}<p>thêm</p>` });
		expect(edited.status, JSON.stringify(edited.json)).toBe(200);
		expect(w.raw.prepare("SELECT content_html FROM post WHERE id = 'post-1060'").get()).toEqual({ content_html: expect.stringContaining('target="_blank"') });
		const restored = await root.call("POST", "posts/post-1060/revisions/1/restore", { version: 2 });
		expect(restored.status, JSON.stringify(restored.json)).toBe(200);
		expect(w.raw.prepare("SELECT title, content_html FROM post WHERE id = 'post-1060'").get()).toEqual({ title: "Lễ Vu Lan báo hiếu", content_html: OLD_HTML });
	});

	it("still points the library pictures of a version at their current address", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const picture = (src: string) => `<p>x</p><img src="${src}" alt="Hoa sen" data-media-id="media-a">`;
		const first = await root.call("PATCH", "posts/post-1060", { version: 1, contentHtml: picture("/anh-goc/cms/media-a/v1/sen.webp") });
		expect(first.status, JSON.stringify(first.json)).toBe(200);
		const second = await root.call("PATCH", "posts/post-1060", { version: 2, contentHtml: "<p>khác</p>" });
		expect(second.status).toBe(200);
		const restored = await root.call("POST", "posts/post-1060/revisions/2/restore", { version: 3 });
		expect(restored.status, JSON.stringify(restored.json)).toBe(200);
		const html = String((w.raw.prepare("SELECT content_html FROM post WHERE id = 'post-1060'").get() as { content_html: string }).content_html);
		expect(html).toContain("/v2/sen.webp");
		expect(html).not.toContain("/v1/sen.webp");
	});
});

describe("the first save of an imported Tông Chỉ article", () => {
	const BRIEF = "BANNER, TIÊU ĐỀ, GIỚI THIỆU\nNIỆM PHẬT\nMột câu Phật hiệu giữ tâm an.\nNIỆM PHẬT LÀ GÌ?\nTrở về với hơi thở.";
	const pageOf = async (w: Awaited<ReturnType<typeof contentWorld>>) => (await createD1Repository(asD1(w.raw)).getTongChi("niem-phat"))?.contentHtml;

	it("keeps the text its page shows when only the title is changed", async () => {
		const w = await contentWorld();
		w.raw.prepare("UPDATE teaching_article SET body = ?, title = 'Niệm Phật', name = 'Niệm Phật' WHERE id = 'tc-1'").run(BRIEF);
		const before = await pageOf(w);
		expect(before).toBeTruthy();
		const root = await w.as("root@example.test");
		const saved = await root.call("PATCH", "teachings/tc-1", { version: 1, title: "Niệm Phật (bản mới)" });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(await pageOf(w)).toBe(before);
		expect((w.raw.prepare("SELECT content_html FROM teaching_article WHERE id = 'tc-1'").get() as { content_html: string }).content_html).toBeTruthy();
		// and what the first save fixed is what the history keeps: restoring changes nothing either
		const restored = await root.call("POST", "teachings/tc-1/revisions/1/restore", { version: 2 });
		expect(restored.status, JSON.stringify(restored.json)).toBe(200);
		expect(await pageOf(w)).toBe(before);
	});
});

describe("a picture of the library held by its address only", () => {
	it("is found by the id in its /anh-goc/<bucket>/cms/<id>/v<n>/ path and counted as used (a body, an intro, a book cover)", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		// media-a is in the library at cms/media-a/v2/sen.webp; the body names it with no data-media-id
		const saved = await root.call("PATCH", "posts/post-1060", { version: 1, contentHtml: '<p>Ảnh</p><img src="/anh-goc/s2-cnv03/cms/media-a/v2/sen.webp" alt="Hoa sen">' });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(w.raw.prepare("SELECT field FROM media_usage WHERE entity_type = 'post' AND entity_id = 'post-1060' AND media_id = 'media-a'").all()).toEqual([{ field: "content" }]);
		// an address that names no row of the library is not recorded (and does not break the save)
		const other = await root.call("PATCH", "posts/post-1060", { version: 2, contentHtml: '<img src="/anh-goc/s2-cnv03/cms/khong-co/v1/x.webp" alt="">' });
		expect(other.status).toBe(200);
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM media_usage WHERE entity_type = 'post' AND entity_id = 'post-1060'").get()).toEqual({ n: 0 });
	});
});
