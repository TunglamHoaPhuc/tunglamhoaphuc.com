// B10 (the first edit of an imported row keeps what was imported), B11 (media_usage is rebuilt with the pictures that are
// referenced by address), B12 (related-post search finds rows without search text), B13 (scheduling and dates).
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { backfillContentUsage } from "../../../src/db/mediaBackfill";
import { buildStatements } from "../../../src/db/import";
import { applyMigrations, applyStatements, openDatabase } from "../../../src/db/nodeSqlite";
import { storedMediaAddress } from "../../../src/libs/content/media";
import { vietnamToday } from "../../../src/admin/content/service";
import { contentWorld, type ContentWorld } from "../helpers/contentWorld";
import { content as smallContent, post as smallPost } from "../helpers/importContent";

type Raw = Record<string, unknown>;
const row = (w: ContentWorld, sql: string, ...args: (string | number | null)[]) => w.raw.prepare(sql).get(...args) as Raw | undefined;
const rows = (w: ContentWorld, sql: string, ...args: (string | number | null)[]) => w.raw.prepare(sql).all(...args) as Raw[];

describe("B10: the first edit of an imported row keeps the imported version", () => {
	it("writes a revision of the current version in the same batch, so versions are [2, 1] and restoring 1 gives the import back", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		expect(rows(w, "SELECT version FROM revision WHERE entity_id = 'post-1060'")).toEqual([]);
		const saved = await root.call("PATCH", "posts/post-1060", { version: 1, title: "Lễ Vu Lan báo hiếu 2025", contentHtml: "<p>Nội dung mới</p>" });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		const list = await root.call("GET", "posts/post-1060/revisions");
		expect(list.data.map((r: Raw) => r.version)).toEqual([2, 1]);
		expect(list.data[1].summary).toBe("Bản nhập từ web cũ");
		expect((await root.call("GET", "posts/post-1060/revisions/1")).data.snapshot).toMatchObject({ title: "Lễ Vu Lan báo hiếu", slug: "le-vu-lan", status: "published", contentHtml: "<p>Nội dung cũ</p>", section: "dong-chay-hoang-phap" });
		const restored = await root.call("POST", "posts/post-1060/revisions/1/restore", { version: 2 });
		expect(restored.status, JSON.stringify(restored.json)).toBe(200);
		expect(restored.data).toMatchObject({ version: 3, title: "Lễ Vu Lan báo hiếu", contentHtml: "<p>Nội dung cũ</p>", status: "published" });
		expect(rows(w, "SELECT version FROM revision WHERE entity_id = 'post-1060' ORDER BY version").map((r) => r.version)).toEqual([1, 2, 3]);
	});

	it("does it for a status change too, for a Tông Chỉ article (whose Markdown comes back), and never twice", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		expect((await root.call("POST", "posts/post-1060/hide", {})).data.version).toBe(2);
		expect(rows(w, "SELECT version, summary FROM revision WHERE entity_id = 'post-1060' ORDER BY version")).toEqual([
			{ version: 1, summary: "Bản nhập từ web cũ" },
			{ version: 2, summary: "Tạm ẩn" },
		]);
		expect((await root.call("PATCH", "posts/post-1060", { version: 2, title: "Khác" })).data.version).toBe(3);
		expect(rows(w, "SELECT COUNT(*) AS n FROM revision WHERE entity_id = 'post-1060'")).toEqual([{ n: 3 }]);

		expect((await root.call("PATCH", "teachings/tc-1", { version: 1, title: "Niệm Phật Mới", contentHtml: "<p>Khác</p>" })).data.version).toBe(2);
		expect((await root.call("GET", "teachings/tc-1/revisions")).data.map((r: Raw) => r.version)).toEqual([2, 1]);
		const restored = await root.call("POST", "teachings/tc-1/revisions/1/restore", { version: 2 });
		expect(restored.status, JSON.stringify(restored.json)).toBe(200);
		expect(row(w, "SELECT title, body FROM teaching_article WHERE id = 'tc-1'")).toEqual({ title: "Niệm Phật", body: "## Niệm Phật là gì\n\nNhất tâm **niệm** Phật." });
	});

	it("leaves a row that already has a revision of its version alone, and a failed save leaves no base revision behind", async () => {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		const created = (await editor.call("POST", "posts", { title: "Mới tạo", section: "dong-chay-hoang-phap" })).data;
		await editor.call("PATCH", `posts/${created.id}`, { version: 1, title: "Mới tạo, sửa" });
		expect(rows(w, "SELECT version FROM revision WHERE entity_id = ? ORDER BY version", created.id).map((r) => r.version)).toEqual([1, 2]);
	});
});

describe("B10: a save that fails leaves no base revision", () => {
	it("is all or nothing", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		w.raw.prepare("INSERT INTO revision (entity_type, entity_id, version, snapshot, summary, created_at) VALUES ('post', 'post-1060', 2, '{}', 'khác', '2026')").run();
		expect((await root.call("PATCH", "posts/post-1060", { version: 1, title: "Đè lên" })).status).toBe(409);
		expect(rows(w, "SELECT version FROM revision WHERE entity_id = 'post-1060' ORDER BY version").map((r) => r.version)).toEqual([2]);
	});
});

// ------------------------------------------------------------------ B11

const idOf = (src: string) => createHash("sha1").update(storedMediaAddress(src)!).digest("hex").slice(0, 20);
const PICTURE = "/anh-goc/s2-cnv03/2026/07/anh-trong-bai.jpg";

function importedPicture(w: ContentWorld, src = PICTURE) {
	const key = src.replace("/anh-goc/s2-cnv03/", "");
	w.raw.prepare("INSERT INTO media (id, r2_key, filename, mime, created_at) VALUES (?, ?, ?, 'image/jpeg', '2026')").run(idOf(src), key, key.split("/").pop()!);
	return idOf(src);
}
const usage = (w: ContentWorld, entity: string, id: string) => rows(w, "SELECT media_id, field FROM media_usage WHERE entity_type = ? AND entity_id = ? ORDER BY field, media_id", entity, id);

describe("B11: media_usage keeps pictures referenced by address", () => {
	it("keeps a picture an imported post holds by its /anh-goc/ address when an unrelated field is edited", async () => {
		const w = await contentWorld();
		const mediaId = importedPicture(w);
		w.raw.prepare("UPDATE post SET content_html = ? WHERE id = 'post-1060'").run(`<p>Có ảnh</p><img src="${PICTURE}" alt="">`);
		w.raw.prepare("INSERT INTO media_usage (media_id, entity_type, entity_id, field) VALUES (?, 'post', 'post-1060', 'content')").run(mediaId);
		const root = await w.as("root@example.test");
		expect((await root.call("PATCH", "posts/post-1060", { version: 1, title: "Tên khác" })).status).toBe(200);
		expect(usage(w, "post", "post-1060")).toEqual([{ media_id: mediaId, field: "content" }]);
		// a body that no longer has it lets go of it; one that gets it records it
		expect((await root.call("PATCH", "posts/post-1060", { version: 2, contentHtml: "<p>Không ảnh</p>" })).status).toBe(200);
		expect(usage(w, "post", "post-1060")).toEqual([]);
		expect((await root.call("PATCH", "posts/post-1060", { version: 3, contentHtml: `<p>Lại có</p><img src="${PICTURE}" alt="">` })).status).toBe(200);
		expect(usage(w, "post", "post-1060")).toEqual([{ media_id: mediaId, field: "content" }]);
	});

	it("also counts a picture named in the intro or summary text, the way the backfill does", async () => {
		const w = await contentWorld();
		const mediaId = importedPicture(w);
		w.raw.prepare("UPDATE post SET summary = ? WHERE id = 'post-1060'").run(`Xem ảnh ${PICTURE} nhé`);
		const root = await w.as("root@example.test");
		expect((await root.call("PATCH", "posts/post-1060", { version: 1, title: "Tên khác" })).status).toBe(200);
		expect(usage(w, "post", "post-1060")).toEqual([{ media_id: mediaId, field: "content" }]);
	});

	it("keeps the cover of a Tông Chỉ book and a Giới thiệu book", async () => {
		const w = await contentWorld();
		const mediaId = importedPicture(w);
		const root = await w.as("root@example.test");
		const teaching = await root.call("PATCH", "teachings/tc-1", { version: 1, book: { title: "Kinh", author: "", cover: PICTURE, description: "", href: null } });
		expect(teaching.status, JSON.stringify(teaching.json)).toBe(200);
		expect(usage(w, "teaching_article", "tc-1")).toEqual([{ media_id: mediaId, field: "book.cover" }]);
		expect((await root.call("PATCH", "teachings/tc-1", { version: 2, title: "Niệm Phật Khác" })).status).toBe(200);
		expect(usage(w, "teaching_article", "tc-1")).toEqual([{ media_id: mediaId, field: "book.cover" }]);
		const page = await root.call("PATCH", "pages/page-1", { version: 1, book: { title: "Sách", author: "", cover: PICTURE, description: "" } });
		expect(page.status, JSON.stringify(page.json)).toBe(200);
		expect(usage(w, "page", "page-1")).toEqual([{ media_id: mediaId, field: "book.cover" }]);
		expect((await root.call("PATCH", "teachings/tc-1", { version: 3, book: null })).status).toBe(200);
		expect(usage(w, "teaching_article", "tc-1")).toEqual([]);
	});

	it("still saves when a body names a library picture that is gone (no foreign key error), and keeps the usage of the others", async () => {
		const w = await contentWorld();
		w.raw.prepare("UPDATE post SET content_html = ? WHERE id = 'post-1060'").run('<img src="/anh-goc/s2-cnv03/cms/ghost/v1/x.webp" data-media-id="ghost" alt=""><img src="/anh-goc/s2-cnv03/cms/media-a/v2/sen.webp" data-media-id="media-a" alt="">');
		const root = await w.as("root@example.test");
		const saved = await root.call("PATCH", "posts/post-1060", { version: 1, title: "Tên khác" });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(usage(w, "post", "post-1060")).toEqual([{ media_id: "media-a", field: "content" }]);
	});

	it("handles more than 90 pictures in one body (the library lookups are chunked)", async () => {
		const w = await contentWorld();
		const insert = w.raw.prepare("INSERT INTO media (id, r2_key, filename, mime, created_at, version) VALUES (?, ?, 'f.webp', 'image/webp', '2026', 1)");
		for (let n = 0; n < 130; n++) insert.run(`many-${n}`, `cms/many-${n}/v1/f.webp`);
		const body = Array.from({ length: 130 }, (_, n) => `<img src="/anh-goc/s2-cnv03/cms/many-${n}/v0/f.webp" data-media-id="many-${n}" alt="">`).join("");
		const root = await w.as("root@example.test");
		const saved = await root.call("PATCH", "posts/post-1060", { version: 1, contentHtml: body });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(usage(w, "post", "post-1060")).toHaveLength(130);
		const html = String(row(w, "SELECT content_html FROM post WHERE id = 'post-1060'")!.content_html);
		expect(html.match(/\/v1\/f\.webp/g)).toHaveLength(130);
		expect(html).not.toContain("/v0/");
	});
});

describe("B11: the backfill finds the pictures the import knows", () => {
	it("hashes a picture's address the way the import does, so the rows it adds are rows the editor keeps", () => {
		const content = smallContent({ posts: [smallPost("1", { contentHtml: '<p><img src="https://s2-cnv03.s3.us-east-005.backblazeb2.com/a/thumb.webp" alt=""></p>' })] });
		const db = openDatabase();
		applyMigrations(db);
		applyStatements(db, buildStatements(content).statements);
		const result = backfillContentUsage(db);
		expect(result.found).toBeGreaterThan(0);
		expect(db.prepare("SELECT field FROM media_usage WHERE entity_type = 'post' AND entity_id = '1' AND field = 'content'").all()).toEqual([{ field: "content" }]);
	});
});

// ------------------------------------------------------------------ B12

describe("B12: the related-post search finds rows without search text", () => {
	it("matches by title, without accents, when search_text is empty, and still by search_text otherwise", async () => {
		const w = await contentWorld();
		w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date, status, search_text) VALUES ('post-empty', 'khoa-tu-bo-de', 'Khóa tu Bồ Đề', 'dong-chay-hoang-phap', '2025-09-01', 'published', '')").run();
		w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date, status, search_text) VALUES ('post-gone', 'bo-de-cu', 'Bồ Đề cũ', 'dong-chay-hoang-phap', '2025-09-02', 'published', '')").run();
		w.raw.prepare("UPDATE post SET deleted_at = '2026-01-01' WHERE id = 'post-gone'").run();
		const editor = await w.as("editor@example.test");
		const ids = async (q: string, exclude = "") => (await editor.call("GET", `posts/related-candidates?q=${encodeURIComponent(q)}&excludeId=${exclude}`)).data.filter((item: Raw) => item.type === "post").map((item: Raw) => item.id);
		expect(await ids("bo de")).toEqual(["post-empty"]);
		expect(await ids("BỒ ĐỀ")).toEqual(["post-empty"]);
		expect(await ids("khoa tu")).toEqual(["post-empty"]);
		expect(await ids("bo de", "post-empty")).toEqual([]);
		expect(await ids("vu lan")).toEqual(["post-1060"]);
		expect(await ids("khong co")).toEqual([]);
	});
});

// ------------------------------------------------------------------ B13

describe("B13: scheduling, first publication, dates", () => {
	it("refuses to schedule a post that is already published (it would leave the site), and tells why", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const later = new Date(Date.now() + 3 * 86400_000).toISOString();
		const refused = await root.call("POST", "posts/post-1060/publish", { publishAt: later });
		expect(refused.status).toBe(409);
		expect(refused.error.code).toBe("already_live");
		expect(refused.error.message).toMatch(/đang hiển thị/);
		expect(row(w, "SELECT status, publish_at, version FROM post WHERE id = 'post-1060'")).toEqual({ status: "published", publish_at: null, version: 1 });
		// a post that is scheduled may be given another time; a draft may be scheduled
		const draft = (await root.call("POST", "posts", { title: "Hẹn giờ", section: "dong-chay-hoang-phap" })).data;
		expect((await root.call("POST", `posts/${draft.id}/publish`, { publishAt: later })).data.status).toBe("scheduled");
		const evenLater = new Date(Date.now() + 5 * 86400_000).toISOString();
		expect((await root.call("POST", `posts/${draft.id}/publish`, { publishAt: evenLater })).data).toMatchObject({ status: "scheduled", publishAt: evenLater });
	});

	it("publishes at once, and says so, when the time is less than a minute away or past", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const soon = (await root.call("POST", "posts", { title: "Sắp", section: "dong-chay-hoang-phap" })).data;
		const published = await root.call("POST", `posts/${soon.id}/publish`, { publishAt: new Date(Date.now() + 30_000).toISOString() });
		expect(published.data).toMatchObject({ status: "published", publishAt: null });
		expect(row(w, "SELECT summary FROM revision WHERE entity_id = ? AND version = 2", soon.id)).toEqual({ summary: "Xuất bản" });
	});

	it("sets the publication date when a draft is first published, and only then", async () => {
		const w = await contentWorld();
		const today = vietnamToday(new Date());
		w.raw
			.prepare("INSERT INTO post (id, slug, title, section, published_date, status, created_at, created_by) VALUES ('old-draft', 'ban-nhap-cu', 'Bản nháp cũ', 'dong-chay-hoang-phap', '2026-01-02', 'draft', '2026-01-02T03:00:00.000Z', 'root')")
			.run();
		w.raw
			.prepare("INSERT INTO post (id, slug, title, section, published_date, status, created_at, created_by) VALUES ('dated-draft', 'ban-nhap-dat-ngay', 'Bản nháp đặt ngày', 'dong-chay-hoang-phap', '2026-03-05', 'draft', '2026-01-02T03:00:00.000Z', 'root')")
			.run();
		const root = await w.as("root@example.test");
		const first = await root.call("POST", "posts/old-draft/publish", {});
		expect(first.data).toMatchObject({ status: "published", publishedDate: today });
		// the editors set a date by hand on a draft: it is theirs
		expect((await root.call("POST", "posts/dated-draft/publish", {})).data.publishedDate).toBe("2026-03-05");
		// take it back, change nothing, publish again: the date it first went out stays; so does one edited since
		await root.call("POST", "posts/old-draft/unpublish", {});
		w.raw.prepare("UPDATE post SET published_date = '2026-02-02' WHERE id = 'old-draft'").run();
		expect((await root.call("POST", "posts/old-draft/publish", {})).data.publishedDate).toBe("2026-02-02");
		// an imported post that is hidden and shown again keeps the date it was published on
		await root.call("POST", "posts/post-1060/hide", {});
		expect((await root.call("POST", "posts/post-1060/publish", {})).data.publishedDate).toBe("2025-08-20");
		// a post published again while it is published changes nothing in its date
		expect((await root.call("POST", "posts/post-1060/publish", {})).data.publishedDate).toBe("2025-08-20");
	});

	it("dates a scheduled post by the day it goes out", async () => {
		const w = await contentWorld();
		w.raw
			.prepare("INSERT INTO post (id, slug, title, section, published_date, status, created_at, created_by) VALUES ('sched', 'se-dang', 'Sẽ đăng', 'dong-chay-hoang-phap', '2026-01-02', 'draft', '2026-01-02T03:00:00.000Z', 'root')")
			.run();
		const root = await w.as("root@example.test");
		const at = new Date(Date.now() + 10 * 86400_000);
		const scheduled = await root.call("POST", "posts/sched/publish", { publishAt: at.toISOString() });
		expect(scheduled.data).toMatchObject({ status: "scheduled", publishedDate: vietnamToday(at) });
	});

	it("shows a scheduled post whose time has passed as published, in the detail, the list, the filters and the counts", async () => {
		const w = await contentWorld();
		w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date, status, publish_at) VALUES ('s-past', 'da-toi-gio', 'Đã tới giờ', 'dong-chay-hoang-phap', '2026-01-02', 'scheduled', '2020-01-01T00:00:00.000Z')").run();
		w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date, status, publish_at) VALUES ('s-future', 'chua-toi-gio', 'Chưa tới giờ', 'dong-chay-hoang-phap', '2026-01-03', 'scheduled', '2999-01-01T00:00:00.000Z')").run();
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "posts/s-past")).data.status).toBe("published");
		expect((await root.call("GET", "posts/s-future")).data.status).toBe("scheduled");
		const ids = async (query: string) => (await root.call("GET", `posts?${query}`)).data.map((item: Raw) => `${item.id}:${item.status}`).sort();
		expect(await ids("status=published")).toEqual(["post-1060:published", "s-past:published"]);
		expect(await ids("status=scheduled")).toEqual(["s-future:scheduled"]);
		expect((await root.call("GET", "posts/counts")).data).toEqual({ all: 3, draft: 0, pending: 0, published: 2, scheduled: 1, hidden: 0 });
		// the public reader lists the one whose time has come (tests/unit/content/d1Admin.test.ts) and not the other
	});
});
