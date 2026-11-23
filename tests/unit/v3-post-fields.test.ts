// The post fields the shared admin CMS saves and V3 must not ignore: the pin, the lead text (intro), the related posts the
// editors chose, the kind of a Trí Tuệ post by what was filled in. Checked through the real D1 reader on a fake D1 and on pure functions.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { allArticles, dongChayPage, DONG_CHAY_SECTION, relatedArticles, toArticle } from "@/lib/dong-chay";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { chosenRelatedCards, toPostRecord } from "@/lib/v3-data";
import { livePost, livePosts } from "@/lib/v3-live";
import { mediaTypeOf, relatedWisdom, toWisdomItem, TRI_TUE_SECTION } from "@/lib/wisdom";
import { createFakeD1 } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	db.insert("category", { id: "c1", slug: "cong-tu", name: "Cộng tu", kind: "post" });
	db.insert("category", { id: "c2", slug: "phap-am", name: "Pháp âm", kind: "post" });
	db.insert("media", { id: "m1", r2_key: "posts/thumb-1.webp", url: null });
	const post = (id: string, slug: string, section: string, extra: Record<string, unknown> = {}) =>
		db.insert("post", { id, slug, title: `Bài ${slug}`, section, category_id: section === "dong-chay-hoang-phap" ? "c1" : "c2", published_date: "2026-08-23", thumbnail_media_id: "m1", content_html: `<p>thân ${slug}</p>`, summary: `tóm tắt ${slug}`, ...extra });
	post("a", "bai-cu", "dong-chay-hoang-phap", { published_date: "2026-01-01", pinned: 1, intro: "Lời dẫn của bài cũ" });
	post("b", "bai-moi", "dong-chay-hoang-phap", { published_date: "2026-09-01" });
	post("c", "bai-giua", "dong-chay-hoang-phap", { published_date: "2026-05-01" });
	post("d", "bai-chon-1", "dong-chay-hoang-phap", { published_date: "2026-02-01", subtitle: "Phụ đề chọn" });
	post("e", "bai-an", "dong-chay-hoang-phap", { published_date: "2026-03-01", status: "draft" });
	post("f", "bai-tri-tue", "tri-tue-phat-phap", { published_date: "2026-04-01" });
	post("g", "bai-khac-muc", "vu-tru-phat-giao", { published_date: "2026-04-02" });
	// "b" chose: itself, a draft, a post of a section V3 has no page for, a Trí Tuệ post, then an ordinary one.
	[["b", "b"], ["b", "e"], ["b", "g"], ["b", "f"], ["b", "d"]].forEach(([from, to], position) => db.insert("post_related", { post_id: from, target_type: "post", target_id: to, position }));
	return createD1Repository(db);
}

// ── 1. the record carries what the editors saved ────────────────────────────

test("toPostRecord mang theo ghim, lời dẫn và các bài liên quan người biên tập đã chọn", async () => {
	const repo = seed();
	const old = (await livePost("bai-cu", DONG_CHAY_SECTION, repo))!;
	assert.equal(old.pinned, true);
	assert.equal(old.intro, "Lời dẫn của bài cũ");
	assert.deepEqual(old.related, []);

	const chosen = (await livePost("bai-moi", DONG_CHAY_SECTION, repo))!;
	assert.equal(chosen.pinned, false);
	assert.equal(chosen.intro, "");
	// the draft is not public, so the reader leaves it out; the others keep the editors' order
	assert.deepEqual(chosen.related.map((r) => r.slug), ["bai-moi", "bai-khac-muc", "bai-tri-tue", "bai-chon-1"]);
	const first = chosen.related[3];
	assert.equal(first.section, "dong-chay-hoang-phap");
	assert.equal(first.subtitle, "Phụ đề chọn");
	assert.equal(first.categoryName, "Cộng tu");
	assert.ok(first.thumbnailUrl.includes("posts/thumb-1.webp"));
});

test("bản ghi của một dòng trong danh sách có ghim nhưng chưa có lời dẫn hay bài liên quan; hình dạng cũ giữ nguyên", async () => {
	const repo = seed();
	const row = (await livePosts(DONG_CHAY_SECTION, repo)).find((p) => p.slug === "bai-cu")!;
	assert.equal(row.pinned, true);
	assert.equal(row.intro, "");
	assert.deepEqual(row.related, []);
	for (const key of ["id", "slug", "title", "subtitle", "mainCategory", "subCategory", "categoryName", "author", "publishedDate", "viewsCount", "thumbnailUrl", "contentHtml", "keywords", "photoGallery", "audio", "sourceBook"]) assert.ok(key in row, key);
});

test("bản ghi thiếu các trường này (bản tóm tắt cũ) không làm hỏng toPostRecord", () => {
	const record = toPostRecord({ id: "p", slug: "s", title: "t", subtitle: "", section: "tri-tue-phat-phap", category: { slug: "x", name: "X" }, author: "", publishedDate: "2026-11-01", views: 0, thumbnail: null, banner: null, summary: "", galleryCount: 0 } as never);
	assert.equal(record.pinned, false);
	assert.deepEqual(record.related, []);
	const noExtras = toPostRecord({ id: "p", slug: "s", title: "t", contentHtml: "", keywords: [], videos: [], gallery: [], extra: { audio: null, youtubeId: null, book: null }, category: { slug: "x", name: "X" } } as never);
	assert.equal(noExtras.intro, "");
	assert.deepEqual(noExtras.related, []);
});

// ── 2. pinned posts first, in the order www uses ────────────────────────────

test("Dòng chảy: bài được ghim đứng đầu khi xếp theo ngày hoặc tên, như www", async () => {
	const repo = seed();
	const slugs = async (sort: string) => (await dongChayPage({ sort }, repo)).items.map((a) => a.slug);
	// pinned "bai-cu" (the oldest) first, then the rest by the order asked for
	assert.deepEqual(await slugs("newest"), ["bai-cu", "bai-moi", "bai-giua", "bai-chon-1"]);
	assert.deepEqual(await slugs("oldest"), ["bai-cu", "bai-chon-1", "bai-giua", "bai-moi"]);
	assert.deepEqual(await slugs("a-z"), ["bai-cu", "bai-chon-1", "bai-giua", "bai-moi"]);
	assert.deepEqual(await slugs("z-a"), ["bai-cu", "bai-moi", "bai-giua", "bai-chon-1"]);
	assert.equal((await allArticles(repo)).find((a) => a.slug === "bai-cu")?.pinned, true);
});

test("Dòng chảy: không có bài ghim thì vẫn theo ngày; cùng ngày thì theo tên (cùng cách so với www)", async () => {
	const db = createFakeD1();
	db.insert("category", { id: "c1", slug: "cong-tu", name: "Cộng tu", kind: "post" });
	for (const [id, title, date] of [["1", "Bài 10", "2026-01-01"], ["2", "Bài 9", "2026-01-01"], ["3", "Ăn chay", "2026-02-01"]]) {
		db.insert("post", { id, slug: `s${id}`, title, section: "dong-chay-hoang-phap", category_id: "c1", published_date: date });
	}
	const page = await dongChayPage({ sort: "newest" }, createD1Repository(db));
	assert.deepEqual(page.items.map((a) => a.title), ["Ăn chay", "Bài 9", "Bài 10"]);
});

// ── 3. "Tìm hiểu thêm": the chosen posts first, the guess only when none ────

test("Dòng chảy: 'Tìm hiểu thêm' dùng các bài đã chọn (bỏ chính nó, bản nháp, mục không có trang), tối đa 3", async () => {
	const repo = seed();
	const current = (await livePost("bai-moi", DONG_CHAY_SECTION, repo))!;
	const cards = relatedArticles(current, await allArticles(repo));
	assert.deepEqual(cards.map((c) => c.link), ["/tri-tue-phat-phap/bai-tri-tue", "/dong-chay-hoang-phap/bai-chon-1"]);
	assert.equal(cards[1].category, "Phụ đề chọn");
	assert.equal(cards[1].title, "Bài bai-chon-1");
	assert.ok(cards[1].url.includes("posts/thumb-1.webp"));
});

test("Dòng chảy: chọn hơn 3 bài thì chỉ 3 bài đầu, theo thứ tự đã chọn", () => {
	const r = (n: number) => ({ id: `r${n}`, slug: `r${n}`, section: "dong-chay-hoang-phap", title: `R${n}`, subtitle: "", categoryName: "Cộng tu", subCategory: "cong-tu", thumbnailUrl: "t", bannerUrl: "b" });
	const cards = chosenRelatedCards({ id: "x", related: [r(1), r(2), r(3), r(4)] }, "f", "F");
	assert.deepEqual(cards.map((c) => c.title), ["R1", "R2", "R3"]);
	assert.deepEqual(chosenRelatedCards({ id: "x" }, "f", "F"), []);
	assert.equal(chosenRelatedCards({ id: "x", related: [{ ...r(1), thumbnailUrl: "", bannerUrl: "", categoryName: "", subtitle: "" }] }, "anh-du-phong", "Mục dự phòng")[0].url, "anh-du-phong");
});

test("Dòng chảy: chưa chọn bài nào (hoặc chỉ chọn bài không mở được) thì vẫn đoán như trước", async () => {
	const repo = seed();
	const current = (await livePost("bai-giua", DONG_CHAY_SECTION, repo))!;
	assert.deepEqual(current.related, []);
	const guessed = relatedArticles(current, await allArticles(repo));
	assert.ok(guessed.length > 0);
	assert.equal(guessed.some((c) => c.link.endsWith("/bai-giua")), false);

	const article = (id: string, title: string) => ({ id, slug: id, title, category: "", subCategory: "", thumbnailUrl: "t", summary: "" }) as never;
	const onlyOffSite = { id: "x", slug: "x", title: "Mùa Vu Lan", subCategory: "", keywords: [], related: [{ id: "z", slug: "z", section: "vu-tru-phat-giao", title: "Z", subtitle: "", categoryName: "", subCategory: "", thumbnailUrl: "", bannerUrl: "" }] };
	const picks = relatedArticles(onlyOffSite, [article("a", "Chuyện xa xôi"), article("b", "Vu Lan báo hiếu")]);
	assert.deepEqual(picks.map((p) => p.link), ["/dong-chay-hoang-phap/b", "/dong-chay-hoang-phap/a"]);
});

test("Trí tuệ: 'Tìm hiểu thêm' dùng các bài đã chọn, không thì chọn theo chuyên mục như trước", async () => {
	const repo = seed();
	const all = await livePosts(TRI_TUE_SECTION, repo);
	const withChosen = { id: "f", slug: "bai-tri-tue", subCategory: "phap-am", related: (await livePost("bai-moi", DONG_CHAY_SECTION, repo))!.related };
	// the current post ("f") is left out of its own list; the post of a section without a page is left out too
	assert.deepEqual(relatedWisdom(withChosen, all).map((c) => c.link), ["/dong-chay-hoang-phap/bai-moi", "/dong-chay-hoang-phap/bai-chon-1"]);
	const none = { id: "f", slug: "bai-tri-tue", subCategory: "phap-am", related: [] };
	const other = { ...all[0], id: "zz", slug: "bai-khac-tri-tue", subCategory: "phap-am" };
	assert.deepEqual(relatedWisdom(none, [...all, other]).map((c) => c.link), ["/tri-tue-phat-phap/bai-khac-tri-tue"]);
});

// ── 5. the kind of a Trí Tuệ post ───────────────────────────────────────────

const kind = (extra: Partial<Parameters<typeof mediaTypeOf>[0]>) => mediaTypeOf({ subCategory: "", title: "Bài", videoBlock: undefined, ...extra });

test("Trí tuệ: loại bài theo trường người biên tập điền trước (âm thanh, video, sách), rồi mới đoán theo chuyên mục", () => {
	assert.equal(kind({ audio: { src: "/a.mp3", duration: "" } }), "audio");
	assert.equal(kind({ audio: { src: "/a.mp3", duration: "" }, subCategory: "video-phat-phap" }), "audio", "âm thanh được điền thì hơn mọi đoán mò");
	assert.equal(kind({ youtubeId: "dQw4w9WgXcQ" }), "video");
	assert.equal(kind({ videoBlock: { videoUrl: "https://www.youtube.com/watch?v=x", title: "t", summary: "" } }), "video");
	assert.equal(kind({ sourceBook: { bookTitle: "S", author: "", coverImage: "", description: "", linkUrl: undefined } }), "book");
	assert.equal(kind({ sourceBook: { bookTitle: "S", author: "", coverImage: "", description: "", linkUrl: undefined }, subCategory: "phap-am" }), "book");
	// no extras: the category slug and the title decide, as before
	assert.equal(kind({ subCategory: "video-phat-phap" }), "video");
	assert.equal(kind({ subCategory: "phap-am" }), "audio");
	assert.equal(kind({ title: "Pháp Âm số 5" }), "audio");
	assert.equal(kind({ subCategory: "an-pham-sach" }), "book");
	assert.equal(kind({}), "article");
	assert.equal(kind({ audio: { src: "", duration: "" } }), "article", "âm thanh trống không tính");
});

test("Trí tuệ: bài đầy đủ từ D1 có audio hay sách thì thẻ lưu trữ nhận đúng loại", async () => {
	const db = createFakeD1();
	db.insert("category", { id: "c9", slug: "chuyen-muc-la", name: "Chuyên mục lạ", kind: "post" });
	db.insert("media", { id: "au", r2_key: "media/cms/a/v1/am-thanh.mp3", url: null });
	db.insert("post", { id: "x1", slug: "co-am-thanh", title: "T", section: "tri-tue-phat-phap", category_id: "c9", published_date: "2026-01-01", extra: JSON.stringify({ audioMediaId: "au", duration: "10:00" }) });
	db.insert("post", { id: "x2", slug: "co-youtube", title: "T", section: "tri-tue-phat-phap", category_id: "c9", published_date: "2026-01-01", extra: JSON.stringify({ youtubeId: "dQw4w9WgXcQ" }) });
	db.insert("post", { id: "x3", slug: "co-sach", title: "T", section: "tri-tue-phat-phap", category_id: "c9", published_date: "2026-01-01", extra: JSON.stringify({ book: { title: "Cuốn sách", author: "Tác giả" } }) });
	db.insert("post", { id: "x4", slug: "thuong", title: "T", section: "tri-tue-phat-phap", category_id: "c9", published_date: "2026-01-01" });
	const repo = createD1Repository(db);
	const typeOf = async (slug: string) => toWisdomItem((await livePost(slug, TRI_TUE_SECTION, repo))!).type;
	assert.equal(await typeOf("co-am-thanh"), "audio");
	assert.equal(await typeOf("co-youtube"), "video");
	assert.equal(await typeOf("co-sach"), "book");
	assert.equal(await typeOf("thuong"), "article");
	assert.equal((await livePost("co-youtube", TRI_TUE_SECTION, repo))?.youtubeId, "dQw4w9WgXcQ");
});

// ── 6. no author or category made up ────────────────────────────────────────

test("Dòng chảy: bài không có tác giả hay chuyên mục thì không bịa ra (www cũng không hiện)", () => {
	const base = toPostRecord({ id: "p", slug: "s", title: "t", subtitle: "", section: "dong-chay-hoang-phap", category: { slug: "", name: "" }, author: "", publishedDate: "2026-11-01", views: 0, thumbnail: null, banner: null, summary: "", galleryCount: 0, pinned: false } as never);
	const card = toArticle(base);
	assert.equal(card.author, "");
	assert.equal(card.category, "");
	const real = toArticle({ ...base, author: "Thầy A", subCategory: "khoa-le-truyen-thong" });
	assert.equal(real.author, "Thầy A");
	assert.equal(real.category, "khoa-le-truyen-thong");
});

test("Dòng chảy: bài không có chuyên mục không lọt vào mục 'cong-tu' khi lọc", async () => {
	const db = createFakeD1();
	db.insert("category", { id: "c1", slug: "cong-tu", name: "Cộng tu", kind: "post" });
	db.insert("post", { id: "1", slug: "co-muc", title: "Có mục", section: "dong-chay-hoang-phap", category_id: "c1", published_date: "2026-01-01" });
	db.insert("post", { id: "2", slug: "khong-muc", title: "Không mục", section: "dong-chay-hoang-phap", published_date: "2026-01-02" });
	const repo = createD1Repository(db);
	assert.deepEqual((await dongChayPage({ category: "cong-tu" }, repo)).items.map((a) => a.slug), ["co-muc"]);
	assert.equal((await dongChayPage({}, repo)).total, 2);
});

// ── 4. the lead text is shown on the detail pages ───────────────────────────

test("trang chi tiết hiện lời dẫn (intro) chỉ khi có", () => {
	for (const [file, field] of [
		["src/app/(public)/dong-chay-hoang-phap/[slug]/DongChayDetailClient.tsx", "article.intro"],
		["src/app/(public)/tri-tue-phat-phap/[slug]/TriTueDetailClient.tsx", "item.intro"],
	]) {
		const source = readFileSync(file, "utf8");
		assert.match(source, new RegExp(`\\{${field.replace(".", "\\.")} \\? \\(`), `${file} chỉ hiện khi có`);
		assert.ok(source.includes(`{${field}}`), `${file} in lời dẫn`);
		assert.ok(source.indexOf(`{${field}}`) < source.indexOf("<InfographicArticleRenderer"), `${file}: lời dẫn nằm trước thân bài`);
	}
});
