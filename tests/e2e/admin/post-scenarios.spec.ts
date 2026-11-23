import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";
import { AdminApi, localDb, makeAccount, superAdminApi, unwrap } from "./helpers";

// B: the editing life of an article, from the API to the public page (the server renders it from the same local D1 as the admin
// writes: TLHP_CONTENT_SOURCE=d1). One scenario per test, each with its own articles, so a failure names its cause.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
test.setTimeout(300_000);

const stamp = Date.now().toString(36);
const SECTION = "dong-chay-hoang-phap";
const CATEGORY = { video: "post:tri-tue-phat-phap:video", sound: "post:tri-tue-phat-phap:phap-am", book: "post:tri-tue-phat-phap:an-pham-sach", plain: "post:dong-chay-hoang-phap:cong-tu" };
let base: string;
let root: AdminApi;
let editor: AdminApi;
let author: AdminApi;
let site: APIRequestContext;

type Detail = Record<string, unknown> & { id: string; version: number; slug: string; status: string; section?: string };
const codeOf = (response: { json: unknown }) => (response.json as { error?: { code?: string } } | null)?.error?.code ?? "";

test.beforeAll(async ({ baseURL }) => {
	base = baseURL!;
	root = await superAdminApi(base);
	const e = await makeAccount(root, base, "role-editor", "post-editor");
	editor = await AdminApi.signIn(base, e.email, e.password);
	const a = await makeAccount(root, base, "role-author", "post-author");
	author = await AdminApi.signIn(base, a.email, a.password);
	site = await playwrightRequest.newContext({ baseURL: base });
});
test.afterAll(async () => {
	await Promise.all([root.dispose(), editor.dispose(), author.dispose(), site.dispose()]);
});

const create = async (api: AdminApi, body: Record<string, unknown>) => {
	const made = await api.call("POST", "posts", { section: SECTION, summary: "Tóm tắt kiểm thử", ...body });
	expect(made.status, JSON.stringify(made.json)).toBe(200);
	return unwrap<Detail>(made);
};
/** The public page of an article: the status, and the Location when it redirects. */
const visit = async (path: string) => {
	const response = await site.get(path, { maxRedirects: 0, failOnStatusCode: false });
	return { status: response.status(), location: response.headers().location ?? "", html: response.status() === 200 ? await response.text() : "" };
};
const pathOf = (post: { section?: string; slug: string }) => `/${post.section ?? SECTION}/${post.slug}`;
/** The site re-reads the database after any write that went through the admin API; a row put in by hand needs one such write to be seen. */
const touch = async () => expect((await root.call("PATCH", "me", { name: "Quản trị" })).status).toBe(200);
/** The redirect table says 301; the framework answers a permanent redirect as 308. Either is permanent. */
const PERMANENT = [301, 308];
const unique = (name: string) => `${name}-${stamp}-${Math.random().toString(36).slice(2, 7)}`;

test("create, save a draft, send for review, publish, hide, unpublish: each state is what the public page shows", async () => {
	const title = `Bài vòng đời ${stamp}`;
	const post = await create(author, { title });
	expect(post.status).toBe("draft");
	expect((await visit(pathOf(post))).status, "a draft is not public").toBe(404);

	// an Author saves the draft and sends it for review; may not publish
	const saved = unwrap<Detail>(await author.call("PATCH", `posts/${post.id}`, { version: post.version, contentHtml: "<p>Nội dung nháp</p>" }));
	expect(saved.version).toBe(post.version + 1);
	const publishByAuthor = await author.call("POST", `posts/${post.id}/publish`, { version: saved.version });
	expect([publishByAuthor.status, codeOf(publishByAuthor)]).toEqual([403, "forbidden"]);
	const pending = unwrap<Detail>(await author.call("POST", `posts/${post.id}/submit`, { version: saved.version }));
	expect(pending.status).toBe("pending");
	expect((await visit(pathOf(post))).status, "a post waiting for review is not public").toBe(404);
	// an Author may not edit it live either, and cannot send it twice
	expect((await author.call("POST", `posts/${post.id}/submit`, { version: pending.version })).status).toBe(409);

	// an Editor publishes: public at once, with its text and its publication date set at the first publication
	const live = unwrap<Detail>(await editor.call("POST", `posts/${post.id}/publish`, { version: pending.version }));
	expect(live.status).toBe("published");
	expect(live.publishedDate).toBe(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
	const page = await visit(pathOf(post));
	expect(page.status).toBe(200);
	expect(page.html).toContain(title);
	expect(page.html).toContain("Nội dung nháp");
	// hide and unpublish take it off the site
	const hidden = unwrap<Detail>(await editor.call("POST", `posts/${post.id}/hide`, { version: live.version }));
	expect(hidden.status).toBe("hidden");
	expect((await visit(pathOf(post))).status, "hidden").toBe(404);
	const again = unwrap<Detail>(await editor.call("POST", `posts/${post.id}/publish`, { version: hidden.version }));
	expect((await visit(pathOf(post))).status, "published again").toBe(200);
	const draft = unwrap<Detail>(await editor.call("POST", `posts/${post.id}/unpublish`, { version: again.version }));
	expect(draft.status).toBe("draft");
	expect((await visit(pathOf(post))).status, "back to draft").toBe(404);
	// the history holds every step, newest first, numbered without a gap
	const versions = unwrap<{ version: number }[]>(await root.call("GET", `posts/${post.id}/revisions`)).map((item) => item.version);
	expect(versions).toEqual(Array.from({ length: versions.length }, (_, i) => versions.length - i));
});

test("schedule: a future time keeps it off the site; a live article refuses (409); a due one is shown without any job", async () => {
	const post = await create(editor, { title: `Bài hẹn giờ ${stamp}`, contentHtml: "<p>Hẹn giờ</p>" });
	const at = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
	const scheduled = unwrap<Detail>(await editor.call("POST", `posts/${post.id}/publish`, { version: post.version, publishAt: at }));
	expect(scheduled.status).toBe("scheduled");
	expect(new Date(String(scheduled.publishAt)).toISOString()).toBe(at);
	expect((await visit(pathOf(post))).status, "scheduled for later").toBe(404);
	// the time comes: the status is read, not stored
	const db = localDb();
	db.prepare("UPDATE post SET publish_at = ? WHERE id = ?").run(new Date(Date.now() - 60_000).toISOString(), post.id);
	db.close();
	await touch();
	expect((await visit(pathOf(post))).status, "scheduled and due").toBe(200);
	// a live one cannot be scheduled: it would vanish until then
	const live = await create(editor, { title: `Bài đang hiển thị ${stamp}`, contentHtml: "<p>Đang hiển thị</p>" });
	const published = unwrap<Detail>(await editor.call("POST", `posts/${live.id}/publish`, { version: live.version }));
	const refused = await editor.call("POST", `posts/${live.id}/publish`, { version: published.version, publishAt: at });
	expect([refused.status, codeOf(refused)]).toEqual([409, "already_live"]);
	expect((await visit(pathOf(live))).status, "still public after the refusal").toBe(200);
	// an invalid time is a 400 on that field
	const bad = await editor.call("POST", `posts/${post.id}/publish`, { version: scheduled.version, publishAt: "không phải giờ" });
	expect(bad.status).toBe(400);
});

test("trash, restore and purge: who may, what is left behind, what the public sees", async () => {
	const post = await create(editor, { title: `Bài thùng rác ${stamp}`, contentHtml: "<p>Sắp xóa</p>" });
	const live = unwrap<Detail>(await editor.call("POST", `posts/${post.id}/publish`, { version: post.version }));
	expect((await visit(pathOf(post))).status).toBe(200);
	// an Author cannot trash a live post (even their own: posts.delete:own but a live post is the editors' to unpublish first)
	const mine = await create(author, { title: `Bài của tác giả ${stamp}` });
	const mineLive = unwrap<Detail>(await editor.call("POST", `posts/${mine.id}/publish`, { version: mine.version }));
	const refused = await author.call("DELETE", `posts/${mine.id}`);
	expect([refused.status, codeOf(refused)], "a Collaborator cannot take a live post off the site by deleting it").toEqual([403, "needs_publisher"]);
	expect(mineLive.status).toBe("published");

	expect((await editor.call("DELETE", `posts/${post.id}`)).status).toBe(204);
	expect((await visit(pathOf(post))).status, "in the trash").toBe(404);
	expect((await editor.call("GET", `posts/${post.id}`)).status, "the admin no longer opens a trashed post").toBe(404);
	expect(unwrap<{ id: string }[]>(await editor.call("GET", "trash?type=post")).map((row) => row.id)).toContain(post.id);
	// an Editor restores (trash.update) but cannot remove for good (no trash.delete)
	expect((await editor.call("DELETE", `trash/post/${post.id}`)).status).toBe(403);
	expect((await editor.call("POST", `trash/post/${post.id}/restore`)).status).toBe(200);
	const back = unwrap<Detail>(await editor.call("GET", `posts/${post.id}`));
	expect(back.version, "restoring from the trash does not change the article").toBe(live.version);
	expect((await visit(pathOf(post))).status, "restored: public again as it was").toBe(200);

	// purge: the Super Admin removes it for good, with what hangs off it
	expect((await editor.call("DELETE", `posts/${post.id}`)).status).toBe(204);
	expect((await root.call("DELETE", `trash/post/${post.id}`)).status).toBe(204);
	const db = localDb();
	const left = (sql: string) => (db.prepare(sql).get(post.id) as { n: number }).n;
	expect(left("SELECT COUNT(*) AS n FROM post WHERE id = ?")).toBe(0);
	expect(left("SELECT COUNT(*) AS n FROM revision WHERE entity_type = 'post' AND entity_id = ?")).toBe(0);
	expect(left("SELECT COUNT(*) AS n FROM media_usage WHERE entity_type = 'post' AND entity_id = ?")).toBe(0);
	expect(left("SELECT COUNT(*) AS n FROM post_related WHERE post_id = ?")).toBe(0);
	expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	db.close();
});

test("a new slug or section of a live post leaves a redirect from the old address, and the public old address follows it", async () => {
	const slug = unique("slug-cu");
	const post = await create(editor, { title: `Bài đổi đường dẫn ${stamp}`, slug, contentHtml: "<p>Đổi đường dẫn</p>" });
	const live = unwrap<Detail>(await editor.call("POST", `posts/${post.id}/publish`, { version: post.version }));
	const oldPath = pathOf(live);
	// slug
	const newSlug = unique("slug-moi");
	const renamed = unwrap<Detail>(await editor.call("PATCH", `posts/${post.id}`, { version: live.version, slug: newSlug }));
	expect(renamed.slug).toBe(newSlug);
	const redirected = await visit(oldPath);
	expect([PERMANENT.includes(redirected.status), new URL(redirected.location, base).pathname]).toEqual([true, `/${SECTION}/${newSlug}`]);
	expect((await visit(`/${SECTION}/${newSlug}`)).status).toBe(200);
	// section (and the category follows or is cleared)
	const moved = unwrap<Detail>(await editor.call("PATCH", `posts/${post.id}`, { version: renamed.version, section: "tri-tue-phat-phap", categoryId: CATEGORY.book.replace("an-pham-sach", "bai-viet") }));
	expect(moved.section).toBe("tri-tue-phat-phap");
	const afterMove = await visit(`/${SECTION}/${newSlug}`);
	expect([PERMANENT.includes(afterMove.status), new URL(afterMove.location, base).pathname]).toEqual([true, `/tri-tue-phat-phap/${newSlug}`]);
	expect((await visit(oldPath)).location, "the first address does not chain through the second").toContain(`/tri-tue-phat-phap/${newSlug}`);
	expect((await visit(`/tri-tue-phat-phap/${newSlug}`)).status).toBe(200);
	// a draft has no public address to keep: no redirect
	const draft = await create(editor, { title: `Bài nháp đổi đường dẫn ${stamp}`, slug: unique("nhap-cu") });
	await editor.call("PATCH", `posts/${draft.id}`, { version: draft.version, slug: unique("nhap-moi") });
	const db = localDb();
	expect((db.prepare("SELECT COUNT(*) AS n FROM redirect WHERE from_path = ?").get(pathOf(draft)) as { n: number }).n).toBe(0);
	db.close();
});

test("an out-of-date save is a 409 and changes nothing; the newest version can then be saved", async () => {
	const post = await create(editor, { title: `Bài xung đột ${stamp}` });
	const first = await editor.call("PATCH", `posts/${post.id}`, { version: post.version, title: "Sửa lần một" });
	expect(first.status).toBe(200);
	const second = await root.call("PATCH", `posts/${post.id}`, { version: post.version, title: "Sửa lần hai (cũ)" });
	expect([second.status, codeOf(second)]).toEqual([409, "conflict"]);
	expect(unwrap<Detail>(await root.call("GET", `posts/${post.id}`)).title).toBe("Sửa lần một");
	// every other action carries the version too
	expect((await root.call("POST", `posts/${post.id}/publish`, { version: post.version })).status).toBe(409);
	expect((await root.call("POST", `posts/${post.id}/revisions/1/restore`, { version: post.version })).status).toBe(409);
	const newest = unwrap<Detail>(await root.call("GET", `posts/${post.id}`));
	expect((await root.call("PATCH", `posts/${post.id}`, { version: newest.version, title: "Sửa lần hai" })).status).toBe(200);
});

test("cover and thumbnail with their positions, SEO, related posts: saved, shown on the public page, and tracked as usage", async () => {
	const cover = await root.upload(`bia-${stamp}.png`);
	const share = await root.upload(`chia-se-${stamp}.png`);
	const other = await create(root, { title: `Bài liên quan ${stamp}`, contentHtml: "<p>Liên quan</p>" });
	const otherLive = unwrap<Detail>(await root.call("POST", `posts/${other.id}/publish`, { version: other.version }));
	const post = await create(root, { title: `Bài ảnh bìa ${stamp}`, contentHtml: "<p>Có ảnh bìa</p>" });
	const saved = await root.call("PATCH", `posts/${post.id}`, {
		version: post.version,
		thumbnailMediaId: cover,
		thumbnailPosition: "center 20%",
		bannerMediaId: cover,
		bannerPosition: "left 30%",
		ogMediaId: share,
		seoTitle: `Tiêu đề SEO ${stamp}`,
		seoDescription: `Mô tả SEO ${stamp}`,
		pinned: true,
	});
	expect(saved.status, JSON.stringify(saved.json)).toBe(200);
	const detail = unwrap<Detail>(saved);
	expect(detail).toMatchObject({ thumbnailMediaId: cover, thumbnailPosition: "center 20%", bannerMediaId: cover, bannerPosition: "left 30%", ogMediaId: share, seoTitle: `Tiêu đề SEO ${stamp}`, pinned: true });
	// a picture that is not in the library is refused, on its own field
	const missing = await root.call("PATCH", `posts/${post.id}`, { version: detail.version, thumbnailMediaId: "khong-co-anh-nay" });
	expect([missing.status, (missing.json as { error: { fields?: Record<string, string> } }).error.fields?.thumbnailMediaId ? "on-field" : "no-field"]).toEqual([400, "on-field"]);
	// a bad position is refused
	expect((await root.call("PATCH", `posts/${post.id}`, { version: detail.version, thumbnailPosition: "<script>" })).status).toBe(400);
	// related posts: the first goes in, a post cannot be its own relative
	expect((await root.call("PUT", `posts/${post.id}/related`, { items: [{ type: "post", id: post.id }] })).status).toBe(400);
	const related = await root.call("PUT", `posts/${post.id}/related`, { items: [{ type: "post", id: other.id }] });
	expect(related.status, JSON.stringify(related.json)).toBe(200);
	expect(unwrap<{ id: string }[]>(related).map((item) => item.id)).toEqual([other.id]);
	const liveNow = unwrap<Detail>(await root.call("POST", `posts/${post.id}/publish`, { version: (unwrap<Detail>(await root.call("GET", `posts/${post.id}`))).version }));
	const page = await visit(pathOf(liveNow));
	expect(page.status).toBe(200);
	expect(page.html).toContain(`Tiêu đề SEO ${stamp}`);
	expect(page.html).toContain(`Mô tả SEO ${stamp}`);
	expect(page.html, "the share picture is the og:image").toMatch(new RegExp(`og:image[^>]*${share}|${share}[^>]*og:image|og:image[^>]*chia-se`));
	expect(page.html, "the related post is linked").toContain(`Bài liên quan ${stamp}`);
	expect(page.html).toContain(pathOf(otherLive));
	// usage: the three picture fields are recorded, and the library will not let a used picture go
	const db = localDb();
	const usage = db.prepare("SELECT media_id, field FROM media_usage WHERE entity_type = 'post' AND entity_id = ? ORDER BY field").all(post.id) as { media_id: string; field: string }[];
	db.close();
	expect(usage.map((row) => `${row.field}=${row.media_id}`).sort()).toEqual([`banner_media_id=${cover}`, `og_media_id=${share}`, `thumbnail_media_id=${cover}`].sort());
	expect((await root.call("DELETE", `media/${cover}`)).status, "a picture in use cannot be deleted").toBe(409);
});

test("video, book and the fields of a category: normalised, kept, shown", async () => {
	const video = await create(root, { title: `Bài video ${stamp}`, categoryId: CATEGORY.video, section: "tri-tue-phat-phap", extra: { youtubeId: "https://www.youtube.com/embed/dQw4w9WgXcQ" } });
	expect(video.extra, "an /embed/ address becomes the id").toEqual({ youtubeId: "dQw4w9WgXcQ" });
	const liveVideo = unwrap<Detail>(await root.call("POST", `posts/${video.id}/publish`, { version: video.version }));
	const page = await visit(pathOf(liveVideo));
	expect(page.status).toBe(200);
	expect(page.html, "the video is on the page").toContain("dQw4w9WgXcQ");
	// the id is changed, then taken off
	const changed = unwrap<Detail>(await root.call("PATCH", `posts/${video.id}`, { version: liveVideo.version, extra: { youtubeId: "https://youtu.be/9bZkp7q19f0" } }));
	expect(changed.extra).toEqual({ youtubeId: "9bZkp7q19f0" });
	expect((await visit(pathOf(liveVideo))).html).toContain("9bZkp7q19f0");
	const bad = await root.call("PATCH", `posts/${video.id}`, { version: changed.version, extra: { youtubeId: "không phải youtube" } });
	expect(bad.status).toBe(400);
	const removed = unwrap<Detail>(await root.call("PATCH", `posts/${video.id}`, { version: changed.version, extra: {} }));
	expect(removed.extra).toEqual({});
	expect((await visit(pathOf(liveVideo))).html, "the video is gone from the page").not.toContain("9bZkp7q19f0");

	// a book
	const cover = await root.upload(`sach-${stamp}.png`);
	const book = await create(root, { title: `Bài sách ${stamp}`, categoryId: CATEGORY.book, section: "tri-tue-phat-phap", extra: { book: { title: `Cuốn sách ${stamp}`, author: "Tác giả thử", coverMediaId: cover, link: "https://example.test/mua" } } });
	expect((book.extra as { book: { title: string } }).book.title).toBe(`Cuốn sách ${stamp}`);
	const liveBook = unwrap<Detail>(await root.call("POST", `posts/${book.id}/publish`, { version: book.version }));
	expect((await visit(pathOf(liveBook))).status).toBe(200);
	// The public page draws the book of an "Ấn phẩm & Sách" post: label, title, author, the cover and a link that opens safely.
	const bookPage = (await visit(pathOf(liveBook))).html;
	expect(bookPage, "the book is on the page").toContain(`Cuốn sách ${stamp}`);
	expect(bookPage).toContain("Tác giả thử");
	expect(bookPage).toContain("tlhp-post-book");
	expect(bookPage, "the cover is the library picture").toContain(`/cms/${cover}/`);
	expect(bookPage, "the link opens in another tab and keeps the opener shut").toMatch(/<a[^>]*href="https:\/\/example\.test\/mua"[^>]*rel="noopener noreferrer"|<a[^>]*rel="noopener noreferrer"[^>]*href="https:\/\/example\.test\/mua"/);

	// a Pháp Âm sound: a player with the sound's address and its length
	const sound = await create(root, { title: `Bài pháp âm ${stamp}`, categoryId: CATEGORY.sound, section: "tri-tue-phat-phap", extra: { audioUrl: "/anh-goc/media/cms/am-thanh-thu/v1/am-thanh.mp3", duration: "12:34" } });
	const liveSound = unwrap<Detail>(await root.call("POST", `posts/${sound.id}/publish`, { version: sound.version }));
	const soundPage = (await visit(pathOf(liveSound))).html;
	expect(soundPage, "the player is on the page").toMatch(/<audio[^>]*controls/);
	expect(soundPage).toContain("am-thanh.mp3");
	expect(soundPage).toContain("12:34");
	const db = localDb();
	expect((db.prepare("SELECT field FROM media_usage WHERE entity_type = 'post' AND entity_id = ? AND media_id = ?").get(book.id, cover) as { field: string }).field).toBe("extra.book.coverMediaId");
	db.close();
	// the extra fields belong to the category: moving the post to another category drops them
	const moved = unwrap<Detail>(await root.call("PATCH", `posts/${book.id}`, { version: liveBook.version, categoryId: "post:tri-tue-phat-phap:bai-viet" }));
	expect(moved.extra).toEqual({});
});

test("a Tông Chỉ video is changed from its address and removed by clearing it; its book is kept", async () => {
	const article = unwrap<Detail>(await root.call("POST", "teachings", { title: `Tông chỉ video ${stamp}`, video: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Video một", description: "d" }, book: { title: `Sách tông chỉ ${stamp}`, author: "A", description: "d" } }));
	expect(article.video).toMatchObject({ id: "dQw4w9WgXcQ", title: "Video một" });
	const live = unwrap<Detail>(await root.call("POST", `teachings/${article.id}/publish`, { version: article.version }));
	const page = () => visit(`/tong-chi-tu-hoc/${article.slug}`);
	expect((await page()).html).toContain("dQw4w9WgXcQ");
	// the address is the newer word: the id the article had is not kept over it
	const changed = unwrap<Detail>(await root.call("PATCH", `teachings/${article.id}`, { version: live.version, video: { id: "dQw4w9WgXcQ", url: "https://youtu.be/9bZkp7q19f0", title: "Video hai", description: "d" } }));
	expect(changed.video).toMatchObject({ id: "9bZkp7q19f0", title: "Video hai" });
	const afterChange = (await page()).html;
	expect(afterChange).toContain("9bZkp7q19f0");
	expect(afterChange).not.toContain("dQw4w9WgXcQ");
	// an /embed/ address, then none
	const embedded = unwrap<Detail>(await root.call("PATCH", `teachings/${article.id}`, { version: changed.version, video: { url: "https://www.youtube.com/embed/aqz-KE-bpKQ", title: "Video ba", description: "d" } }));
	expect(embedded.video).toMatchObject({ id: "aqz-KE-bpKQ" });
	const removed = unwrap<Detail>(await root.call("PATCH", `teachings/${article.id}`, { version: embedded.version, video: { url: "", title: "", description: "" } }));
	expect(removed.video, "an empty address takes the video off").toBeNull();
	const afterRemove = (await page()).html;
	expect(afterRemove).not.toContain("aqz-KE-bpKQ");
	expect(afterRemove, "the book stays").toContain(`Sách tông chỉ ${stamp}`);
	// the name follows the title while it still is the title
	const retitled = unwrap<Detail>(await root.call("PATCH", `teachings/${article.id}`, { version: removed.version, title: `Tông chỉ đổi tên ${stamp}` }));
	expect(retitled.name).toBe(`Tông chỉ đổi tên ${stamp}`);
	expect((await page()).html).toContain(`Tông chỉ đổi tên ${stamp}`);
});

test("edge cases: a 145-character slug, a title with <, two posts with one slug in two sections", async () => {
	// a slug of the old site (longer than the editor's limit) is kept by any save and stays public; a new one that long is refused, not cut
	const long = `${unique("chuoi-dai")}-${"a".repeat(145)}`.slice(0, 145);
	const db = localDb();
	const id = `post-qa-long-${stamp}`;
	db.prepare("INSERT INTO post (id, slug, title, section, category_id, published_date, status, content_html, version, search_text, created_at) VALUES (?, ?, ?, ?, ?, '2026-11-01', 'published', '<p>Dài</p>', 1, 'dai', '2026')").run(
		id,
		long,
		`Bài slug dài ${stamp}`,
		SECTION,
		CATEGORY.plain,
	);
	db.close();
	await touch();
	expect(long.length).toBe(145);
	expect((await visit(`/${SECTION}/${long}`)).status, "the long address is public").toBe(200);
	const kept = unwrap<Detail>(await root.call("PATCH", `posts/${id}`, { version: 1, title: `Bài slug dài đổi tên ${stamp}`, slug: long }));
	expect(kept.slug).toBe(long);
	expect((await visit(`/${SECTION}/${long}`)).html).toContain(`Bài slug dài đổi tên ${stamp}`);
	const tooLong = await root.call("POST", "posts", { title: "Quá dài", section: SECTION, slug: "b".repeat(145), summary: "s" });
	expect([tooLong.status, (tooLong.json as { error: { fields?: Record<string, string> } }).error.fields?.slug ? "on-slug" : "elsewhere"]).toEqual([400, "on-slug"]);

	// a title with < and tags: text that is not a tag stays, tags go
	const odd = await create(root, { title: `Tuổi < 18 & >= 5 ${stamp}` });
	expect(odd.title).toBe(`Tuổi < 18 & >= 5 ${stamp}`);
	const tagged = unwrap<Detail>(await root.call("PATCH", `posts/${odd.id}`, { version: odd.version, title: `Có <b>thẻ</b> <script>alert(1)</script>trong tiêu đề ${stamp}` }));
	expect(String(tagged.title)).not.toMatch(/<\/?(b|script)>/);
	expect(String(tagged.title)).toContain("trong tiêu đề");
	const liveOdd = unwrap<Detail>(await root.call("POST", `posts/${odd.id}/publish`, { version: tagged.version }));
	const oddPage = await visit(pathOf(liveOdd));
	expect(oddPage.status).toBe(200);
	expect(oddPage.html).not.toContain("<script>alert(1)</script>");

	// the same slug in two sections: both are public, each at its own address with its own text
	const shared = unique("trung-slug");
	const a = await create(root, { title: `Bài một ${stamp}`, slug: shared, contentHtml: "<p>Của dòng chảy</p>" });
	const b = await create(root, { title: `Bài hai ${stamp}`, slug: shared, section: "tri-tue-phat-phap", contentHtml: "<p>Của trí tuệ</p>" });
	expect([a.slug, b.slug]).toEqual([shared, shared]);
	await root.call("POST", `posts/${a.id}/publish`, { version: a.version });
	await root.call("POST", `posts/${b.id}/publish`, { version: b.version });
	const pageA = await visit(`/${SECTION}/${shared}`);
	const pageB = await visit(`/tri-tue-phat-phap/${shared}`);
	expect([pageA.status, pageB.status]).toEqual([200, 200]);
	expect(pageA.html).toContain("Của dòng chảy");
	expect(pageB.html).toContain("Của trí tuệ");
	expect(pageA.html).not.toContain("Của trí tuệ");
	// the same slug in the SAME section is the admin's to refuse (the second is not created behind the person's back)
	const clash = await root.call("PATCH", `posts/${b.id}`, { version: b.version + 1, section: SECTION });
	expect([clash.status, codeOf(clash)]).toEqual([409, "slug_taken"]);
});

test("an editor body: a table, a list, a http link, an audio tag, sub and sup, an /embed/ video: what is stored is what is shown", async () => {
	const post = await create(root, { title: `Bài nội dung ${stamp}` });
	const html = [
		"<table><tbody><tr><th>Cột 1</th><th>Cột 2</th></tr><tr><td>Ô 1</td><td>Ô 2</td></tr></tbody></table>",
		"<ul><li>Mục một</li><li>Mục hai</li></ul>",
		'<p><a href="https://example.test/an-toan">Liên kết https</a> <a href="http://example.test/khong-an-toan">Liên kết http</a> <a href="tel:0123456789">Gọi</a></p>',
		'<p>H<sub>2</sub>O và x<sup>2</sup></p>',
		'<audio controls src="https://example.test/am-thanh.mp3"></audio>',
		'<audio controls src="/anh-goc/media/cms/am-thanh-thu/v1/am-thanh.mp3"></audio>',
		'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
		'<script>alert(1)</script><p onclick="x()">Chữ</p>',
	].join("");
	const saved = await root.call("PATCH", `posts/${post.id}`, { version: post.version, contentHtml: html });
	expect(saved.status, JSON.stringify(saved.json)).toBe(200);
	const detail = unwrap<Detail & { contentHtml: string; bodyChanged?: boolean }>(saved);
	const stored = detail.contentHtml;
	expect(stored).toContain("<table>");
	expect(stored).toContain("<li>Mục một</li>");
	expect(stored).toContain("https://example.test/an-toan");
	expect(stored).not.toContain("<script");
	expect(stored).not.toContain("onclick");
	expect(stored).not.toContain("http://example.test");
	expect(stored, "audio from the library is kept").toContain("/anh-goc/media/cms/am-thanh-thu/v1/am-thanh.mp3");
	expect(stored, "audio from another site is dropped").not.toContain("example.test/am-thanh.mp3");
	expect(stored, "an /embed/ YouTube address is kept as a video").toContain("dQw4w9WgXcQ");
	// the server says when its cleaning changed the body (the editor then reloads what is stored), and the next save changes nothing
	expect(detail.bodyChanged, "the cleaning removed script, onclick and the http link").toBe(true);
	const again = unwrap<Detail & { bodyChanged?: boolean }>(await root.call("PATCH", `posts/${post.id}`, { version: detail.version, contentHtml: stored }));
	expect(again.version, "saving what is stored changes nothing").toBe(detail.version);
	expect(again.bodyChanged).toBeFalsy();
	// an Editor-made body of the imported kind (a table and a heading) survives a round trip too
	const live = unwrap<Detail>(await root.call("POST", `posts/${post.id}/publish`, { version: detail.version }));
	const page = await visit(pathOf(live));
	expect(page.html).toContain("Ô 2");
	expect(page.html).toContain("Mục hai");
	expect(page.html).not.toContain("alert(1)");
});

test("a picture inside the body, by library id or by address only, is tracked as used and kept from deletion until it leaves the body", async () => {
	const uploaded = await root.upload(`trong-bai-${stamp}.png`);
	const media = unwrap<{ id: string; url: string }>(await root.call("GET", `media/${uploaded}`));
	const post = await create(root, { title: `Bài ảnh trong nội dung ${stamp}` });
	// 1. by data-media-id
	const withId = unwrap<Detail>(await root.call("PATCH", `posts/${post.id}`, { version: post.version, contentHtml: `<p>Ảnh</p><img src="${media.url}" alt="Ảnh trong bài" data-media-id="${uploaded}">` }));
	const db = localDb();
	const usage = () => (db.prepare("SELECT field FROM media_usage WHERE entity_type = 'post' AND entity_id = ? AND media_id = ?").all(post.id, uploaded) as { field: string }[]).map((row) => row.field);
	expect(usage()).toEqual(["content"]);
	expect((await root.call("DELETE", `media/${uploaded}`)).status, "a picture in a body cannot be deleted").toBe(409);
	// 2. a save of something else keeps the usage (the old bug: a save forgot pictures held by address)
	const renamed = unwrap<Detail>(await root.call("PATCH", `posts/${post.id}`, { version: withId.version, title: `Bài ảnh trong nội dung (sửa) ${stamp}` }));
	expect(usage(), "saving the title does not forget the picture").toEqual(["content"]);
	// 3. by address only (an imported article holds its pictures this way; so may a pasted address of the library): the body names /anh-goc/… with no id
	const byAddress = unwrap<Detail>(await root.call("PATCH", `posts/${post.id}`, { version: renamed.version, contentHtml: `<p>Ảnh theo địa chỉ</p><img src="${media.url}" alt="x">` }));
	expect(usage(), "a picture held by address is tracked too").toEqual(["content"]);
	// 4. in the intro text as well as the body is not required; taking it out frees the picture
	const gone = unwrap<Detail>(await root.call("PATCH", `posts/${post.id}`, { version: byAddress.version, contentHtml: "<p>Không còn ảnh</p>" }));
	expect(usage()).toEqual([]);
	db.close();
	expect(gone.version).toBe(byAddress.version + 1);
	expect((await root.call("DELETE", `media/${uploaded}`)).status, "unused: it can go").toBeLessThan(300);
});
