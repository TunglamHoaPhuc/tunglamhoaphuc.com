// V1 (Tông Chỉ): V3 shows the body, video, books, author, banner and date D1 holds, only for live articles,
// and nothing is invented or fetched from WordPress.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { buildTongChiSections, introHtml, tongChiNavItems } from "@/lib/tong-chi-sections";
import { liveTongChi, liveTongChiList, relatedTongChi } from "@/lib/v3-live";
import { createFakeD1, isoIn } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	db.insert("category", { id: "g1", slug: "nen-tang-tu-hoc", name: "Nền tảng tu học", kind: "teaching-group" });
	db.insert("category", { id: "g2", slug: "lo-trinh-tu-hoc", name: "Lộ trình tu học", kind: "teaching-group" });
	db.insert("media", { id: "m1", r2_key: "tong-chi/banner-1.webp", url: null });
	const base = { group_id: "g1", banner_media_id: "m1", banner_position: "center 30%", excerpt: "Tóm tắt", author: "", published_date: "2026-08-23" };
	db.insert("teaching_article", {
		...base,
		id: "a1",
		slug: "bo-de-tam",
		title: "Bồ đề tâm",
		subtitle: "Cội nguồn",
		author: "Tâm Hòa",
		author_href: "/gioi-thieu/su-phu-tru-tri",
		published_date: "2026-09-08",
		video: JSON.stringify({ id: "abc", url: "https://www.youtube.com/watch?v=abc", title: "Pháp thoại", description: "Lời dẫn của video" }),
		book: JSON.stringify({ title: "Sách của admin", author: "Tác giả", cover: null, description: "Mô tả sách", href: null }),
		body: "Nội dung cũ dạng Markdown.",
		content_html: '<h2>Tiêu đề</h2><p>Đoạn <strong>đậm</strong>.</p><table><tr><td>ô</td></tr></table><script>alert(1)</script>',
	});
	// Never opened in the admin: only the old Markdown.
	db.insert("teaching_article", { ...base, id: "a2", slug: "chi-co-markdown", title: "Chỉ có Markdown", body: "## Mục\n\nMột đoạn văn.\n\n- một\n- hai", content_html: "" });
	// Not live.
	db.insert("teaching_article", { ...base, id: "d1", slug: "ban-nhap", title: "Bản nháp", status: "draft", content_html: "<p>x</p>" });
	db.insert("teaching_article", { ...base, id: "d2", slug: "hen-gio-chua-toi", title: "Hẹn giờ", status: "scheduled", publish_at: isoIn(2), content_html: "<p>x</p>" });
	db.insert("teaching_article", { ...base, id: "d3", slug: "thung-rac", title: "Thùng rác", deleted_at: isoIn(-1), content_html: "<p>x</p>" });
	db.insert("teaching_article", { ...base, id: "ok1", slug: "hen-gio-da-toi", title: "Hẹn giờ đã tới", status: "scheduled", publish_at: isoIn(-2), content_html: "<p>đã tới</p>" });
	// Nothing at all besides the title: no author, book, video.
	db.insert("teaching_article", { id: "a3", slug: "tron-troi", title: "Trơn trụi", group_id: "g2", published_date: "2026-10-01", content_html: "<p>Chỉ có chữ.</p>" });
	return createD1Repository(db);
}

test("bài đã xuất bản: thân bài là contentHtml của D1, đã lọc lại", async () => {
	const article = await liveTongChi("bo-de-tam", seed());
	assert.ok(article);
	assert.match(article.contentHtml, /<h2>Tiêu đề<\/h2>/);
	assert.match(article.contentHtml, /<strong>đậm<\/strong>/);
	assert.match(article.contentHtml, /<table>/);
	assert.doesNotMatch(article.contentHtml, /script|alert/);
	assert.equal(article.content, "");
	assert.equal(article.contentHtml.includes("Nội dung cũ"), false, "có HTML thì không dùng Markdown");
});

test("bài chưa mở trong admin: Markdown cũ chỉ được dùng khi HTML trống", async () => {
	const article = await liveTongChi("chi-co-markdown", seed());
	assert.ok(article);
	assert.match(article.contentHtml, /<h2>Mục<\/h2>/);
	assert.match(article.contentHtml, /<p>Một đoạn văn\.<\/p>/);
	assert.match(article.contentHtml, /<li>một<\/li>/);
	assert.match(article.contentHtml, /<li>hai<\/li>/);
});

test("video, sách, tác giả, ngày đăng, ảnh bìa lấy từ D1; video có description", async () => {
	const article = await liveTongChi("bo-de-tam", seed());
	assert.ok(article);
	assert.deepEqual(article.videoBlock, { title: "Pháp thoại", videoUrl: "https://www.youtube.com/watch?v=abc", description: "Lời dẫn của video", summary: "Lời dẫn của video" });
	assert.equal(article.sourceBook?.bookTitle, "Sách của admin");
	assert.equal(article.author, "Tâm Hòa");
	assert.equal(article.authorLink, "/gioi-thieu/su-phu-tru-tri");
	assert.equal(article.publishedAt, "2026-09-08", "ngày như D1, không gắn giờ T08:00");
	assert.match(article.bannerImage, /tong-chi\/banner-1\.webp$/);
	assert.equal(article.bannerPosition, "center 30%");
});

test("D1 không có tác giả, sách, video: trang không có gì thay vào", async () => {
	const article = await liveTongChi("tron-troi", seed());
	assert.ok(article);
	assert.equal(article.author, "");
	assert.equal(article.authorLink, undefined);
	assert.equal(article.sourceBook, undefined);
	assert.equal(article.videoBlock, undefined);
	assert.equal(article.featuredArticle, undefined);
	assert.deepEqual(article.photoGallery, []);
	assert.deepEqual(article.keywords, []);
});

test("nháp, hẹn giờ chưa tới, thùng rác, không tồn tại: không tìm thấy (trang trả 404)", async () => {
	const repo = seed();
	for (const slug of ["ban-nhap", "hen-gio-chua-toi", "thung-rac", "khong-co-bai-nay"]) assert.equal(await liveTongChi(slug, repo), null, slug);
	assert.ok(await liveTongChi("hen-gio-da-toi", repo), "hẹn giờ đã tới thì hiện");
});

test("danh sách và 'tìm hiểu thêm' chỉ có bài đang hiển thị", async () => {
	const repo = seed();
	const list = await liveTongChiList(repo);
	assert.deepEqual(list.map((a) => a.slug).sort(), ["bo-de-tam", "chi-co-markdown", "hen-gio-da-toi", "tron-troi"]);
	const current = list.find((a) => a.slug === "bo-de-tam")!;
	const related = relatedTongChi(current, list);
	assert.equal(related.some((r) => r.link === "/tong-chi-tu-hoc/bo-de-tam"), false);
	assert.equal(related.some((r) => /ban-nhap|thung-rac|hen-gio-chua-toi/.test(r.link)), false);
	assert.equal(related[0].category.length > 0, true);
});

test("trang danh sách: nhóm hết bài thì mất, không có thẻ đóng gói thay vào", async () => {
	const list = await liveTongChiList(seed());
	const sections = buildTongChiSections(list);
	assert.deepEqual(sections.map((s) => s.id), ["nen-tang", "lo-trinh"]);
	const nenTang = sections.find((s) => s.id === "nen-tang")!;
	assert.deepEqual(nenTang.cards.map((c) => c.link).sort(), ["/tong-chi-tu-hoc/bo-de-tam", "/tong-chi-tu-hoc/chi-co-markdown", "/tong-chi-tu-hoc/hen-gio-da-toi"]);
	for (const section of sections) for (const card of section.cards) assert.equal(card.link.includes("tiep-buoc-thay-toi"), false);
	assert.deepEqual(tongChiNavItems(sections).map((n) => n.id), ["tong-chi-tu-hoc", "nen-tang", "lo-trinh"]);
	assert.deepEqual(buildTongChiSections([]), [], "D1 trống: không có khối nào");
	assert.equal(introHtml(["a < b"]), "<p>a &lt; b</p>");
});

test("bí danh của địa chỉ cũ chỉ mở được khi bài đích đang hiển thị", async () => {
	const db = createFakeD1();
	db.insert("category", { id: "g1", slug: "tong-phong-truyen-thua", name: "Tông phong", kind: "teaching-group" });
	db.insert("teaching_article", { id: "t1", slug: "tong-phong-truyen-thua-truc-lam", title: "Trúc Lâm", group_id: "g1", content_html: "<p>x</p>" });
	assert.equal((await liveTongChi("tiep-buoc-thay-toi", createD1Repository(db)))?.slug, "tong-phong-truyen-thua-truc-lam");
	db.exec("update teaching_article set status = 'draft'");
	assert.equal(await liveTongChi("tiep-buoc-thay-toi", createD1Repository(db)), null);
});

test("trang chi tiết và danh sách Tông Chỉ không gọi WordPress lúc chạy", () => {
	for (const file of ["src/app/(public)/tong-chi-tu-hoc/page.tsx", "src/app/(public)/tong-chi-tu-hoc/TongChiTuHocClient.tsx", "src/app/(public)/tong-chi-tu-hoc/[slug]/page.tsx", "src/app/(public)/tong-chi-tu-hoc/[slug]/TongChiDetailClient.tsx"]) {
		const code = readFileSync(file, "utf8");
		assert.doesNotMatch(code, /wp-json|admin\.tunglamhoaphuc\.com|forceWp/, file);
	}
});
