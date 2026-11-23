import { describe, expect, it } from "vitest";
import { verifyPreview } from "../../../src/admin/content/preview";
import { fillSearchText, loadPreview } from "../../../src/admin/content/service";
import { KINDS } from "../../../src/admin/content/kinds";
import { trashableOf } from "../../../src/admin/trash";
import { contentWorld, type ContentWorld } from "../helpers/contentWorld";

type Raw = Record<string, unknown>;
const row = (w: ContentWorld, sql: string, ...args: (string | number | null)[]) => w.raw.prepare(sql).get(...args) as Raw | undefined;
const rows = (w: ContentWorld, sql: string, ...args: (string | number | null)[]) => w.raw.prepare(sql).all(...args) as Raw[];

async function newPost(w: ContentWorld, email: string, body: Raw = {}) {
	const client = await w.as(email);
	const created = await client.call("POST", "posts", { title: "Khóa tu mùa hè", section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu", ...body });
	expect(created.status, JSON.stringify(created.json)).toBe(200);
	return { client, post: created.data };
}

describe("creating posts", () => {
	it("makes a draft with a slug from the title, its first revision, an audit entry and searchable text", async () => {
		const w = await contentWorld();
		const { post } = await newPost(w, "editor@example.test", { title: "Lễ Hằng Thuận 2026", summary: "Đám cưới Phật hóa" });
		expect(post).toMatchObject({ status: "draft", version: 1, slug: "le-hang-thuan-2026", section: "dong-chay-hoang-phap", categoryName: "Cộng Tu", createdBy: "editor", canUpdate: true });
		expect(post.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		const stored = row(w, "SELECT status, version, created_by, search_text, created_at FROM post WHERE id = ?", post.id)!;
		expect(stored).toMatchObject({ status: "draft", version: 1, created_by: "editor" });
		expect(stored.search_text).toContain("le hang thuan 2026 dam cuoi phat hoa");
		expect(row(w, "SELECT version, summary, created_by FROM revision WHERE entity_type = 'post' AND entity_id = ?", post.id)).toEqual({ version: 1, summary: "Tạo mới", created_by: "editor" });
		expect(row(w, "SELECT user_email FROM audit_log WHERE action = 'post.create' AND entity_id = ?", post.id)).toEqual({ user_email: "editor@example.test" });
	});

	it("takes the next free slug when the title's is used in the same section, but not across sections", async () => {
		const w = await contentWorld();
		const { post: same } = await newPost(w, "editor@example.test", { title: "Lễ Vu Lan" });
		expect(same.slug).toBe("le-vu-lan-2");
		const { post: other } = await newPost(w, "editor@example.test", { title: "Lễ Vu Lan", section: "tri-tue-phat-phap", categoryId: "post:tri-tue-phat-phap:bai-viet" });
		expect(other.slug).toBe("le-vu-lan");
	});

	it("answers 409 slug_taken for a slug that is asked for and used, and slug-check proposes another", async () => {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		const taken = await editor.call("POST", "posts", { title: "Khác", slug: "le-vu-lan", section: "dong-chay-hoang-phap" });
		expect(taken.status).toBe(409);
		expect(taken.error.code).toBe("slug_taken");
		const check = await editor.call("GET", "posts/slug-check?text=L%E1%BB%85%20Vu%20Lan&section=dong-chay-hoang-phap");
		expect(check.data).toEqual({ slug: "le-vu-lan", available: false, suggestion: "le-vu-lan-2" });
		const free = await editor.call("GET", "posts/slug-check?slug=le-vu-lan&section=dong-chay-hoang-phap&excludeId=post-1060");
		expect(free.data.available).toBe(true);
	});

	it("refuses a missing title, an unknown section, a category of another section, a missing picture, and someone without the right", async () => {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", "posts", { section: "dong-chay-hoang-phap" })).error.fields.title).toBeTruthy();
		expect((await editor.call("POST", "posts", { title: "A", section: "khong-co" })).error.fields.section).toBeTruthy();
		expect((await editor.call("POST", "posts", { title: "A", section: "tri-tue-phat-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu" })).error.fields.categoryId).toBeTruthy();
		expect((await editor.call("POST", "posts", { title: "A", section: "tri-tue-phat-phap", thumbnailMediaId: "media-gone" })).error.fields.thumbnailMediaId).toBeTruthy();
		const viewer = await w.as("viewer@example.test");
		expect((await viewer.call("POST", "posts", { title: "A", section: "dong-chay-hoang-phap" })).status).toBe(403);
		expect(row(w, "SELECT COUNT(*) AS n FROM post")).toEqual({ n: 1 });
	});
});

describe("reading posts", () => {
	it("gives one post with its body, category and rights, and 404 for one that is not there", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const one = await author.call("GET", "posts/post-1060");
		expect(one.data).toMatchObject({ id: "post-1060", contentHtml: "<p>Nội dung cũ</p>", contentJson: null, categoryName: "Cộng Tu", legacyViews: 512, albumId: "album-1", canUpdate: false, canDelete: false, canPublish: false });
		expect((await author.call("GET", "posts/khong-co")).status).toBe(404);
	});

	it("lists without the body, filters, searches without accents and counts each status", async () => {
		const w = await contentWorld();
		const { client: editor, post } = await newPost(w, "editor@example.test", { title: "Khóa tu Bồ Đề", pinned: true });
		await newPost(w, "author@example.test", { title: "Pháp thoại", section: "tri-tue-phat-phap", categoryId: "post:tri-tue-phat-phap:bai-viet" });
		const all = await editor.call("GET", "posts");
		expect(all.json.meta.total).toBe(3);
		expect(all.data[0]).not.toHaveProperty("contentHtml");
		const search = async (query: string) => (await editor.call("GET", `posts?${query}`)).data.map((item: Raw) => item.id);
		expect(await search("q=bo%20de")).toEqual([post.id]);
		expect(await search("q=B%E1%BB%92%20%C4%90%E1%BB%80")).toEqual([post.id]);
		expect(await search("q=vu%20lan")).toEqual(["post-1060"]);
		expect(await search("status=published")).toEqual(["post-1060"]);
		expect(await search("pinned=1")).toEqual([post.id]);
		expect((await search("section=tri-tue-phat-phap")).length).toBe(1);
		expect(await search("authorId=editor")).toEqual([post.id]);
		expect(await search("categoryId=post:dong-chay-hoang-phap:cong-tu&sort=title")).toEqual([post.id, "post-1060"]);
		expect(await search("from=2025-08-01&to=2025-08-31")).toEqual(["post-1060"]);
		expect((await editor.call("GET", "posts?status=xyz")).status).toBe(400);
		const counts = await editor.call("GET", "posts/counts?section=dong-chay-hoang-phap");
		expect(counts.data).toEqual({ all: 2, draft: 1, pending: 0, published: 1, scheduled: 0, hidden: 0 });
		const options = await editor.call("GET", "posts/options");
		expect(options.data.categories.length).toBe(6);
		expect(options.data.authors.map((a: Raw) => a.id).sort()).toEqual(["author", "editor"]);
	});

	it("needs the view right", async () => {
		const w = await contentWorld();
		w.raw.prepare("DELETE FROM role_permission WHERE role_id = 'role-viewer' AND module = 'posts'").run();
		const viewer = await w.as("viewer@example.test");
		expect((await viewer.call("GET", "posts")).status).toBe(403);
		expect((await viewer.call("GET", "posts/post-1060")).status).toBe(403);
	});
});

describe("saving a post", () => {
	it("sanitises the body, points pictures at their current file, records the pictures used, and keeps a revision with what changed", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test");
		const saved = await client.call("PATCH", `posts/${post.id}`, {
			version: 1,
			title: "Khóa tu <b>mùa hè</b> 2026",
			thumbnailMediaId: "media-b",
			contentHtml: '<p onclick="x()">Lời mở</p><script>alert(1)</script><figure><img src="/anh-goc/s2-cnv03/cms/media-a/v1/sen.webp" data-media-id="media-a" alt="Sen"><figcaption>Sen</figcaption></figure>',
			contentJson: { type: "doc", content: [{ type: "paragraph" }] },
		});
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(saved.data).toMatchObject({ version: 2, title: "Khóa tu mùa hè 2026", thumbnailMediaId: "media-b" });
		const stored = row(w, "SELECT content_html, content_json, search_text, version, updated_by FROM post WHERE id = ?", post.id)!;
		expect(stored.content_html).toBe('<p>Lời mở</p><figure><img src="/anh-goc/s2-cnv03/cms/media-a/v2/sen.webp" alt="Sen" data-media-id="media-a" loading="lazy"><figcaption>Sen</figcaption></figure>');
		expect(JSON.parse(String(stored.content_json))).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
		expect(stored.search_text).toContain("loi mo");
		expect(stored).toMatchObject({ version: 2, updated_by: "editor" });
		expect(rows(w, "SELECT media_id, field FROM media_usage WHERE entity_type = 'post' AND entity_id = ? ORDER BY field", post.id)).toEqual([
			{ media_id: "media-a", field: "content" },
			{ media_id: "media-b", field: "thumbnail_media_id" },
		]);
		const revision = row(w, "SELECT summary, snapshot FROM revision WHERE entity_type = 'post' AND entity_id = ? AND version = 2", post.id)!;
		expect(revision.summary).toBe("Sửa tiêu đề, ảnh đại diện, nội dung");
		expect(JSON.parse(String(revision.snapshot))).toMatchObject({ title: "Khóa tu mùa hè 2026", status: "draft" });
		const log = row(w, "SELECT data_before, data_after FROM audit_log WHERE action = 'post.update' AND entity_id = ?", post.id)!;
		expect(JSON.parse(String(log.data_after)).title).toBe("Khóa tu mùa hè 2026");
	});

	it("answers 409 to a save made from an older version, and leaves the row as the first save made it", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test");
		const other = await w.as("root@example.test");
		expect((await other.call("PATCH", `posts/${post.id}`, { version: 1, title: "Người thứ nhất" })).status).toBe(200);
		const late = await client.call("PATCH", `posts/${post.id}`, { version: 1, title: "Người thứ hai" });
		expect(late.status).toBe(409);
		expect(late.error.code).toBe("conflict");
		expect(row(w, "SELECT title, version FROM post WHERE id = ?", post.id)).toEqual({ title: "Người thứ nhất", version: 2 });
	});

	it("turns the revision clash of two saves at once into 409 (the batch is all or nothing)", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test");
		// Another save already wrote version 2's revision (its row update not yet seen): this save must fail whole.
		w.raw.prepare("INSERT INTO revision (entity_type, entity_id, version, snapshot, summary, created_at) VALUES ('post', ?, 2, '{}', 'khác', '2026')").run(post.id);
		const result = await client.call("PATCH", `posts/${post.id}`, { version: 1, title: "Đè lên" });
		expect(result.status).toBe(409);
		expect(row(w, "SELECT title, version FROM post WHERE id = ?", post.id)).toEqual({ title: "Khóa tu mùa hè", version: 1 });
	});

	it("does not make a version when nothing changed", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test");
		const same = await client.call("PATCH", `posts/${post.id}`, { version: 1, title: "Khóa tu mùa hè" });
		expect(same.data.version).toBe(1);
		expect(row(w, "SELECT COUNT(*) AS n FROM revision WHERE entity_id = ?", post.id)).toEqual({ n: 1 });
	});

	it("refuses a broken document, a missing version, a slug that is taken, a deleted picture, and 404s a missing post", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test");
		expect((await client.call("PATCH", `posts/${post.id}`, { version: 1, contentJson: { type: "x" } })).error.fields.contentJson).toBeTruthy();
		expect((await client.call("PATCH", `posts/${post.id}`, { title: "x" })).error.fields.version).toBeTruthy();
		expect((await client.call("PATCH", `posts/${post.id}`, { version: 1, slug: "le-vu-lan" })).error.code).toBe("slug_taken");
		expect((await client.call("PATCH", `posts/${post.id}`, { version: 1, bannerMediaId: "media-gone" })).error.fields.bannerMediaId).toBeTruthy();
		expect((await client.call("PATCH", "posts/khong-co", { version: 1, title: "x" })).status).toBe(404);
	});

	it("lets an author change only their own unpublished posts", async () => {
		const w = await contentWorld();
		const { client: author, post } = await newPost(w, "author@example.test");
		const other = await w.as("author2@example.test");
		expect((await other.call("PATCH", `posts/${post.id}`, { version: 1, title: "Của người khác" })).status).toBe(403);
		expect((await author.call("PATCH", `posts/${post.id}`, { version: 1, title: "Của tôi" })).status).toBe(200);
		expect((await author.call("PATCH", "posts/post-1060", { version: 1, title: "Bài nhập" })).status).toBe(403);
		// Once published by an editor, the author's own post is no longer theirs to change alone.
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", `posts/${post.id}/publish`, {})).data.status).toBe("published");
		const live = await author.call("PATCH", `posts/${post.id}`, { version: 3, title: "Sửa bài đã đăng" });
		expect(live.status).toBe(403);
		expect(live.error.code).toBe("needs_publisher");
		expect((await author.call("GET", `posts/${post.id}`)).data.canUpdate).toBe(false);
	});

	it("leaves the views, the album and the picture count of an imported post alone", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		expect((await root.call("PATCH", "posts/post-1060", { version: 1, title: "Lễ Vu Lan báo hiếu 2025" })).status).toBe(200);
		expect(row(w, "SELECT legacy_views, album_id, gallery_count, content_html FROM post WHERE id = 'post-1060'")).toEqual({ legacy_views: 512, album_id: "album-1", gallery_count: 40, content_html: "<p>Nội dung cũ</p>" });
	});
});

describe("category fields and related things", () => {
	it("checks the fields of the post's category and drops them when the category changes", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test", { section: "tri-tue-phat-phap", categoryId: "post:tri-tue-phat-phap:phap-am", extra: { audioUrl: "https://cdn.example/kinh.mp3", duration: "45:10" } });
		expect(post.extra).toEqual({ audioUrl: "https://cdn.example/kinh.mp3", duration: "45:10" });
		const bad = await client.call("PATCH", `posts/${post.id}`, { version: 1, extra: { duration: "lâu" } });
		expect(bad.error.fields["extra.duration"]).toBeTruthy();
		const video = await client.call("PATCH", `posts/${post.id}`, { version: 1, categoryId: "post:tri-tue-phat-phap:video", extra: { youtubeId: "https://youtu.be/dQw4w9WgXcQ" } });
		expect(video.data.extra).toEqual({ youtubeId: "dQw4w9WgXcQ" });
		const moved = await client.call("PATCH", `posts/${post.id}`, { version: 2, categoryId: "post:tri-tue-phat-phap:bai-viet" });
		expect(moved.data.extra).toEqual({});
		const book = await client.call("PATCH", `posts/${post.id}`, { version: 3, categoryId: "post:tri-tue-phat-phap:an-pham-sach", extra: { book: { title: "Kinh Hiền Ngu", author: "", coverMediaId: "media-a", link: "/tri-tue-phat-phap" } } });
		expect(book.data.extra.book).toMatchObject({ title: "Kinh Hiền Ngu", coverMediaId: "media-a" });
		expect(rows(w, "SELECT field FROM media_usage WHERE entity_id = ?", post.id)).toEqual([{ field: "extra.book.coverMediaId" }]);
	});

	it("keeps related posts and statues in the chosen order, and refuses itself or something missing", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test");
		const set = await client.call("PUT", `posts/${post.id}/related`, { items: [{ type: "statue", id: "statue-1" }, { type: "post", id: "post-1060" }] });
		expect(set.data).toEqual([
			{ type: "statue", id: "statue-1", title: "Đức Phật Bổn Sư", href: "/bao-tuong/duc-phat" },
			{ type: "post", id: "post-1060", title: "Lễ Vu Lan báo hiếu", href: "/dong-chay-hoang-phap/le-vu-lan" },
		]);
		expect((await client.call("PUT", `posts/${post.id}/related`, { items: [{ type: "post", id: post.id }] })).status).toBe(400);
		expect((await client.call("PUT", `posts/${post.id}/related`, { items: [{ type: "statue", id: "khong-co" }] })).status).toBe(400);
		expect(rows(w, "SELECT target_id FROM post_related WHERE post_id = ? ORDER BY position", post.id).map((r) => r.target_id)).toEqual(["statue-1", "post-1060"]);
		expect((await client.call("GET", `posts/related-candidates?q=vu%20lan&excludeId=${post.id}`)).data[0]).toMatchObject({ type: "post", id: "post-1060" });
		const author = await w.as("author@example.test");
		expect((await author.call("PUT", `posts/${post.id}/related`, { items: [] })).status).toBe(403);
	});
});

describe("status", () => {
	it("follows the workflow: an author submits, an editor publishes, schedules, hides and takes back", async () => {
		const w = await contentWorld();
		const { client: author, post } = await newPost(w, "author@example.test");
		expect((await author.call("POST", `posts/${post.id}/publish`, {})).status).toBe(403);
		const submitted = await author.call("POST", `posts/${post.id}/submit`, { version: 1 });
		expect(submitted.data).toMatchObject({ status: "pending", version: 2 });
		expect((await author.call("POST", `posts/${post.id}/submit`, {})).error.code).toBe("invalid_status");

		const editor = await w.as("editor@example.test");
		const later = new Date(Date.now() + 3 * 86400_000).toISOString();
		const scheduled = await editor.call("POST", `posts/${post.id}/publish`, { publishAt: later });
		expect(scheduled.data).toMatchObject({ status: "scheduled", publishAt: later });
		const now = await editor.call("POST", `posts/${post.id}/publish`, { publishAt: "2020-01-01T00:00:00Z" });
		expect(now.data).toMatchObject({ status: "published", publishAt: null });
		expect((await editor.call("POST", `posts/${post.id}/hide`, {})).data.status).toBe("hidden");
		expect((await editor.call("POST", `posts/${post.id}/unpublish`, {})).data.status).toBe("draft");
		expect((await editor.call("POST", `posts/${post.id}/unpublish`, {})).error.code).toBe("invalid_status");
		expect((await editor.call("POST", `posts/${post.id}/hide`, { version: 1 })).status).toBe(409);
		expect((await editor.call("POST", `posts/${post.id}/publish`, { publishAt: "không phải ngày" })).status).toBe(400);
		expect((await editor.call("POST", "posts/khong-co/publish", {})).status).toBe(404);
		expect(rows(w, "SELECT summary FROM revision WHERE entity_id = ? ORDER BY version", post.id).map((r) => r.summary)).toEqual([
			"Tạo mới",
			"Gửi duyệt",
			expect.stringMatching(/^Hẹn giờ đăng /),
			"Xuất bản",
			"Tạm ẩn",
			"Đưa về bản nháp",
		]);
		expect(rows(w, "SELECT action FROM audit_log WHERE entity_id = ? ORDER BY id", post.id).map((r) => r.action)).toEqual(["post.create", "post.submit", "post.publish", "post.publish", "post.hide", "post.unpublish"]);
	});
});

describe("duplicating and deleting", () => {
	it("copies a post as a draft with -sao-chep, without its views or album, with its related things", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		await root.call("PUT", "posts/post-1060/related", { items: [{ type: "statue", id: "statue-1" }] });
		const copy = await root.call("POST", "posts/post-1060/duplicate", {});
		expect(copy.data).toMatchObject({ status: "draft", slug: "le-vu-lan-sao-chep", title: "Lễ Vu Lan báo hiếu (bản sao)", albumId: null, contentHtml: "<p>Nội dung cũ</p>", createdBy: "root", version: 1 });
		expect(copy.data.related).toHaveLength(1);
		expect(row(w, "SELECT legacy_views, gallery_count FROM post WHERE id = ?", copy.data.id)).toEqual({ legacy_views: 0, gallery_count: 0 });
		expect((await root.call("POST", "posts/post-1060/duplicate", {})).data.slug).toBe("le-vu-lan-sao-chep-2");
		const viewer = await w.as("viewer@example.test");
		expect((await viewer.call("POST", "posts/post-1060/duplicate", {})).status).toBe(403);
	});

	it("moves a post to the trash (own posts only for an author) and it leaves the lists", async () => {
		const w = await contentWorld();
		const { client: author, post } = await newPost(w, "author@example.test");
		const other = await w.as("author2@example.test");
		expect((await other.call("DELETE", `posts/${post.id}`)).status).toBe(403);
		expect((await author.call("DELETE", "posts/post-1060")).status).toBe(403);
		expect((await author.call("DELETE", `posts/${post.id}`)).status).toBe(204);
		expect(row(w, "SELECT deleted_by FROM post WHERE id = ?", post.id)).toEqual({ deleted_by: "author" });
		expect((await author.call("GET", `posts/${post.id}`)).status).toBe(404);
		expect((await author.call("DELETE", `posts/${post.id}`)).status).toBe(404);
		expect((await author.call("GET", "posts")).json.meta.total).toBe(1);
		// The slug is free again for a new post.
		expect((await author.call("POST", "posts", { title: "Khóa tu mùa hè", section: "dong-chay-hoang-phap" })).data.slug).toBe("khoa-tu-mua-he");
		expect(trashableOf("post")).toMatchObject({ table: "post", module: "posts", hasCreatedBy: true });
		expect(trashableOf("teaching_article")).toBeTruthy();
		expect(trashableOf("page")).toBeTruthy();
	});
});

describe("history", () => {
	it("lists versions, gives one, compares two and restores an old one as a new version", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test", { contentHtml: "<p>Bản đầu</p>" });
		await client.call("PATCH", `posts/${post.id}`, { version: 1, title: "Tên mới", contentHtml: "<p>Bản sau</p>" });
		const list = await client.call("GET", `posts/${post.id}/revisions`);
		expect(list.data.map((r: Raw) => r.version)).toEqual([2, 1]);
		expect(list.data[0]).toMatchObject({ createdByName: "Biên tập", summary: "Sửa tiêu đề, nội dung" });
		const one = await client.call("GET", `posts/${post.id}/revisions/1`);
		expect(one.data.snapshot).toMatchObject({ title: "Khóa tu mùa hè", contentHtml: "<p>Bản đầu</p>" });
		const diff = await client.call("GET", `posts/${post.id}/revisions/1/diff/2`);
		expect(diff.data.changed).toEqual(["title", "contentHtml"]);
		expect(diff.data.b.snapshot.contentHtml).toBe("<p>Bản sau</p>");
		const restored = await client.call("POST", `posts/${post.id}/revisions/1/restore`, { version: 2 });
		expect(restored.data).toMatchObject({ version: 3, title: "Khóa tu mùa hè", contentHtml: "<p>Bản đầu</p>" });
		expect(row(w, "SELECT summary FROM revision WHERE entity_id = ? AND version = 3", post.id)).toEqual({ summary: "Khôi phục phiên bản 1" });
		expect((await client.call("GET", `posts/${post.id}/revisions/9`)).status).toBe(404);
		expect((await client.call("POST", `posts/${post.id}/revisions/1/restore`, { version: 2 })).status).toBe(409);
		const author = await w.as("author@example.test");
		expect((await author.call("POST", `posts/${post.id}/revisions/1/restore`, {})).status).toBe(403);
	});
});

describe("preview links", () => {
	it("signs a link to the current version that the preview page reads without a session, until the article changes", async () => {
		const w = await contentWorld();
		const { client, post } = await newPost(w, "editor@example.test", { contentHtml: "<p>Nháp</p>" });
		const link = await client.call("POST", `posts/${post.id}/preview-token`, {});
		expect(link.data.url).toMatch(new RegExp(`^/quan-tri/xem-truoc/bai-viet/${post.id}\\?token=`));
		const token = decodeURIComponent(link.data.url.split("token=")[1]);
		const secret = w.deps.env.ADMIN_JWT_SECRET;
		expect(await verifyPreview(token, "posts", post.id, secret, new Date())).toMatchObject({ version: 1 });
		const first = await loadPreview(w.db, secret, new Date(), KINDS.posts, post.id, token);
		expect(first?.state.contentHtml).toBe("<p>Nháp</p>");
		await client.call("PATCH", `posts/${post.id}`, { version: 1, contentHtml: "<p>Sau</p>" });
		// The link still shows the version it was made for.
		expect((await loadPreview(w.db, secret, new Date(), KINDS.posts, post.id, token))?.state.contentHtml).toBe("<p>Nháp</p>");
		expect(await loadPreview(w.db, secret, new Date(Date.now() + 31 * 60_000), KINDS.posts, post.id, token)).toBeNull();
		expect(await loadPreview(w.db, secret, new Date(), KINDS.pages, post.id, token)).toBeNull();
		const viewer = await w.as("viewer@example.test");
		expect((await viewer.call("POST", `posts/${post.id}/preview-token`, {})).status).toBe(403);
	});
});

describe("Tông Chỉ articles", () => {
	it("opens the Markdown body as HTML and saves the editor's HTML back as the Markdown its page reads", async () => {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		const one = await editor.call("GET", "teachings/tc-1");
		expect(one.data.contentHtml).toBe("<h2>Niệm Phật là gì</h2>\n<p>Nhất tâm <strong>niệm</strong> Phật.</p>");
		expect(one.data).toMatchObject({ categoryId: "tong-chi::nen-tang", categoryName: "Nền Tảng Tu Học" });
		const saved = await editor.call("PATCH", "teachings/tc-1", { version: 1, contentHtml: "<h2>Niệm Phật</h2><p>Nhất tâm <strong>niệm</strong>.</p><blockquote class=\"kinh\"><p>Nam mô</p></blockquote>", excerpt: "Pháp môn" });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(row(w, "SELECT body, excerpt FROM teaching_article WHERE id = 'tc-1'")).toEqual({ body: "## Niệm Phật\n\nNhất tâm **niệm**.\n\n> Nam mô", excerpt: "Pháp môn" });
		expect(saved.data.contentHtml).toContain('<blockquote class="kinh"><p>Nam mô</p></blockquote>'); // the sutra variant now survives (it did not in Markdown)
	});

	it("keeps what Markdown cannot hold (a table, a sound, a caption) by saving the HTML too, and the page shows that HTML", async () => {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		const html = '<h2>Bảng</h2><table><tbody><tr><td>Một</td><td>Hai</td></tr></tbody></table><figure><img src="/anh-goc/s2-cnv03/cms/media-a/v2/sen.webp" alt="Sen"><figcaption>Hoa sen</figcaption></figure><audio controls src="/anh-goc/s2-cnv03/cms/phap-am.mp3"></audio>';
		const saved = await editor.call("PATCH", "teachings/tc-1", { version: 1, contentHtml: html });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		const stored = row(w, "SELECT body, content_html FROM teaching_article WHERE id = 'tc-1'") as { body: string; content_html: string };
		expect(stored.content_html).toContain("<table>");
		expect(stored.content_html).toContain("<figcaption>Hoa sen</figcaption>");
		expect(stored.content_html).toContain("<audio");
		expect(stored.body).toContain("## Bảng"); // the Markdown stays, for the sources that read it
		// opening it again gives the HTML back as saved, not a Markdown round trip
		expect((await editor.call("GET", "teachings/tc-1")).data.contentHtml).toContain("<table>");

		const { tongChiArticle } = await import("../../../src/libs/content/tongChi");
		const entry = { id: "tc-1", slug: "x", title: "X", name: "X", subtitle: "", group: { slug: "nen-tang", name: "Nền tảng" }, banner: null, excerpt: "", author: "", authorHref: null, publishedDate: "", views: 0, video: null, featured: null, gallery: [], book: null, keywords: [], body: stored.body, html: stored.content_html } as never;
		expect(tongChiArticle(entry, []).contentHtml).toContain("<table>");
		const plain = tongChiArticle({ ...(entry as object), html: "" } as never, []).contentHtml;
		expect(plain).not.toContain("<table>");
	});

	it("creates in a group, keeps slugs unique, refuses a group of another kind, and applies the author rules", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const created = await author.call("POST", "teachings", { title: "Niệm Phật", categoryId: "tong-chi::nen-tang" });
		expect(created.data).toMatchObject({ slug: "niem-phat-2", status: "draft", name: "Niệm Phật" });
		expect((await author.call("POST", "teachings", { title: "X", categoryId: "about::lich-su" })).error.fields.categoryId).toBeTruthy();
		expect((await author.call("PATCH", "teachings/tc-1", { version: 1, title: "Y" })).status).toBe(403);
		expect((await author.call("POST", `teachings/${created.data.id}/publish`, {})).status).toBe(403);
		// The imported article has no search text yet: found by its title as typed, and by any spelling once filled.
		expect((await author.call("GET", "teachings?q=niem%20phat")).json.meta.total).toBe(1);
		expect((await author.call("GET", `teachings?q=${encodeURIComponent("Niệm Phật")}`)).json.meta.total).toBe(2);
		expect(await fillSearchText(w.db, KINDS.teachings)).toBe(1);
		expect(row(w, "SELECT search_text FROM teaching_article WHERE id = 'tc-1'")!.search_text).toBe("niem phat niem phat la gi nhat tam niem phat");
		expect((await author.call("GET", "teachings?q=niem%20phat")).json.meta.total).toBe(2);
	});
});

describe("Giới thiệu pages", () => {
	it("saves the milestones with the page and keeps them in the revision", async () => {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		const one = await editor.call("GET", "pages/page-1");
		expect(one.data.milestones).toEqual([{ label: "1990", title: "Khởi dựng", description: "Thầy về núi" }]);
		const milestones = Array.from({ length: 23 }, (_, index) => ({ label: String(2000 + index), title: `Mốc ${index}`, description: "" }));
		const saved = await editor.call("PATCH", "pages/page-1", { version: 1, milestones, portraitMediaId: "media-a", kicker: "Trụ trì" });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(rows(w, "SELECT label FROM milestone WHERE page_id = 'page-1' ORDER BY position").map((r) => r.label)).toEqual(milestones.map((m) => m.label));
		expect(JSON.parse(String(row(w, "SELECT snapshot FROM revision WHERE entity_id = 'page-1' AND version = 2")!.snapshot)).milestones).toHaveLength(23);
		expect(rows(w, "SELECT field FROM media_usage WHERE entity_id = 'page-1'")).toEqual([{ field: "portrait_media_id" }]);
		expect((await editor.call("PATCH", "pages/page-1", { version: 2, milestones: [{ label: "x".repeat(200) }] })).status).toBe(400);
		expect((await editor.call("POST", "pages", { title: "Lịch sử Bổn tự", slug: "lich-su" })).error.code).toBe("slug_taken");
		const viewer = await w.as("viewer@example.test");
		expect((await viewer.call("PATCH", "pages/page-1", { version: 2, title: "x" })).status).toBe(403);
	});
});
