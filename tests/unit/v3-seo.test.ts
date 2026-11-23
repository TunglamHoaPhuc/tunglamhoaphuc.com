// Tiêu đề, mô tả và ảnh chia sẻ của các trang chi tiết (src/lib/v3-seo.ts): ưu tiên SEO title, SEO description, ảnh chia sẻ mà người
// biên tập đã lưu; thiếu thì lùi về tiêu đề, tóm tắt, ảnh bìa, rồi ảnh chia sẻ chung; ảnh luôn là địa chỉ tuyệt đối trên host công khai (www, không
// phải v3.); không bao giờ đụng tới `robots` (lập chỉ mục do tiêu đề X-Robots-Tag theo host, next.config.ts). Phần đọc chạy trên D1 giả với đúng SQL của bộ đọc.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { PUBLIC_ORIGIN } from "@/lib/site-url";
import { areaMetadata, areaMetadataFor, aboutMetadata, aboutMetadataFor, bookMetadata, DEFAULT_OG_IMAGE, metaImageUrl, postMetadata, postMetadataFor, tongChiMetadata, tongChiMetadataFor } from "@/lib/v3-seo";
import { createFakeD1, isoIn } from "../helpers/d1";

const img = (src: string) => ({ src, position: "center 50%" });
const post = (over: Record<string, unknown> = {}) =>
	({ title: "Tiêu đề bài", subtitle: "Phụ đề bài", summary: "Tóm tắt bài", seoTitle: "", seoDescription: "", ogImage: null, banner: null, thumbnail: null, ...over }) as Parameters<typeof postMetadata>[0];
const ogImages = (m: ReturnType<typeof postMetadata>) => (m.openGraph as { images?: string[] } | undefined)?.images;

test("ảnh: /anh-goc/ và đường dẫn khác đều về host công khai (www), https giữ nguyên, rỗng thì không có", () => {
	assert.equal(metaImageUrl("/anh-goc/tlhp-media/a.webp"), `${PUBLIC_ORIGIN}/anh-goc/tlhp-media/a.webp`);
	assert.equal(metaImageUrl("/brand/logo.png"), "https://www.tunglamhoaphuc.com/brand/logo.png");
	assert.equal(metaImageUrl("https://cdn.example.com/x.jpg"), "https://cdn.example.com/x.jpg");
	assert.equal(metaImageUrl(""), undefined);
	assert.equal(metaImageUrl(null), undefined);
	assert.equal(metaImageUrl("//evil.example/x.jpg"), undefined, "địa chỉ không rõ giao thức không được dùng");
});

test("bài: dùng SEO title, SEO description và ảnh chia sẻ đã lưu", () => {
	const m = postMetadata(post({ seoTitle: "Tiêu đề SEO", seoDescription: "Mô tả SEO", ogImage: img("/anh-goc/tlhp-media/og.webp"), banner: img("/anh-goc/tlhp-media/banner.webp") }));
	assert.equal(m.title, "Tiêu đề SEO | Tùng Lâm Hòa Phúc");
	assert.equal(m.description, "Mô tả SEO");
	assert.deepEqual(ogImages(m), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/og.webp`]);
	assert.equal((m.openGraph as { title?: string }).title, "Tiêu đề SEO");
	assert.equal((m.twitter as { card?: string }).card, "summary_large_image");
});

test("bài: thiếu trường SEO thì lùi về tiêu đề, tóm tắt, ảnh bìa; thiếu bìa thì ảnh nhỏ", () => {
	const m = postMetadata(post({ banner: img("/anh-goc/tlhp-media/banner.webp"), thumbnail: img("/anh-goc/tlhp-media/thumb.webp") }));
	assert.equal(m.title, "Tiêu đề bài | Tùng Lâm Hòa Phúc");
	assert.equal(m.description, "Tóm tắt bài");
	assert.deepEqual(ogImages(m), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/banner.webp`]);
	assert.deepEqual(ogImages(postMetadata(post({ thumbnail: img("/anh-goc/tlhp-media/thumb.webp") }))), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/thumb.webp`]);
	assert.equal(postMetadata(post({ summary: "" })).description, "Phụ đề bài", "không có tóm tắt thì dùng phụ đề");
});

test("bài: khoảng trắng thừa bị gọn, SEO rỗng toàn dấu cách coi như không có, tóm tắt dài bị cắt có dấu ba chấm", () => {
	const m = postMetadata(post({ seoTitle: "   ", title: "  Hai   dòng\nchữ  ", summary: "từ ".repeat(200) }));
	assert.match(String(m.title), /^Hai dòng chữ \| /);
	assert.ok(String(m.description).length <= 200);
	assert.ok(String(m.description).endsWith("…"));
	// Mô tả người biên tập đã viết thì giữ nguyên, không cắt.
	const long = "x".repeat(300);
	assert.equal(postMetadata(post({ seoDescription: long })).description, long);
});

test("bài: không có ảnh nào thì lùi về ảnh chia sẻ chung; không có chữ nào thì không có mô tả; không có tiêu đề thì trả rỗng", () => {
	const m = postMetadata(post({ summary: "", subtitle: "" }));
	assert.deepEqual(ogImages(m), [DEFAULT_OG_IMAGE]);
	assert.equal(DEFAULT_OG_IMAGE, `${PUBLIC_ORIGIN}/brand/og-tung-lam-hoa-phuc.jpg`);
	assert.equal("description" in m, false);
	assert.equal((m.twitter as { card?: string }).card, "summary_large_image");
	assert.deepEqual(postMetadata(post({ title: "" })), {});
});

test("không builder nào đụng tới robots; canonical chỉ có khi truyền đường dẫn", () => {
	for (const m of [
		postMetadata(post()),
		tongChiMetadata({ title: "T", name: "T", subtitle: "", excerpt: "", seoTitle: "", seoDescription: "", ogImage: null, banner: null }),
		aboutMetadata({ title: "T", subtitle: "", overview: "", banner: null, portrait: null }),
		areaMetadata({ name: "K", subtitle: "", description: "", imgUrl: "" }),
		bookMetadata({ title: "S" }),
	]) {
		assert.equal("robots" in m, false);
		assert.equal("alternates" in m, false, "không truyền đường dẫn thì để layout đặt canonical './'");
	}
	const layout = readFileSync("src/app/layout.tsx", "utf8");
	assert.doesNotMatch(layout, /robots:\s*\{/, "layout không còn noindex cứng: lập chỉ mục do X-Robots-Tag theo host");
	assert.match(layout, /metadataBase:\s*new URL\(PUBLIC_ORIGIN\)/);
});

test("Tông Chỉ: SEO title/description/ảnh chia sẻ → tên/trích đoạn/ảnh bìa", () => {
	const base = { title: "Tên bài", name: "Tên bài", subtitle: "Phụ đề", excerpt: "Trích đoạn", seoTitle: "", seoDescription: "", ogImage: null, banner: img("/anh-goc/tlhp-media/b.webp") };
	const plain = tongChiMetadata(base);
	assert.equal(plain.title, "Tên bài | Tùng Lâm Hòa Phúc");
	assert.equal(plain.description, "Trích đoạn");
	assert.deepEqual(ogImages(plain), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/b.webp`]);
	const seo = tongChiMetadata({ ...base, seoTitle: "SEO", seoDescription: "Mô tả", ogImage: img("/anh-goc/tlhp-media/o.webp") });
	assert.equal(seo.title, "SEO | Tùng Lâm Hòa Phúc");
	assert.equal(seo.description, "Mô tả");
	assert.deepEqual(ogImages(seo), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/o.webp`]);
});

test("Giới thiệu: dùng trường SEO nếu chủ đề có, không thì tên, tổng quan, ảnh bìa rồi chân dung", () => {
	const topic = { title: "Sư Ông", subtitle: "Phụ đề", overview: "Tổng quan", banner: null, portrait: img("/anh-goc/tlhp-media/p.webp") };
	const plain = aboutMetadata(topic);
	assert.equal(plain.title, "Sư Ông | Tùng Lâm Hòa Phúc");
	assert.equal(plain.description, "Tổng quan");
	assert.deepEqual(ogImages(plain), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/p.webp`]);
	const seo = aboutMetadata({ ...topic, seoTitle: "SEO Sư Ông", seoDescription: "Mô tả SEO", ogImage: img("/anh-goc/tlhp-media/o.webp"), banner: img("/anh-goc/tlhp-media/b.webp") });
	assert.equal(seo.title, "SEO Sư Ông | Tùng Lâm Hòa Phúc");
	assert.equal(seo.description, "Mô tả SEO");
	assert.deepEqual(ogImages(seo), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/o.webp`]);
	assert.deepEqual(ogImages(aboutMetadata({ ...topic, banner: img("/anh-goc/tlhp-media/b.webp") })), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/b.webp`]);
});

test("khu vực và sách đóng gói: tên, mô tả, ảnh (đã tuyệt đối thì giữ)", () => {
	const area = areaMetadata({ name: "Bảo tháp", subtitle: "Phụ đề", description: "Giới thiệu", imgUrl: "/anh-goc/tlhp-media/a.webp" });
	assert.equal(area.title, "Bảo tháp | Tùng Lâm Hòa Phúc");
	assert.equal(area.description, "Giới thiệu");
	assert.deepEqual(ogImages(area), [`${PUBLIC_ORIGIN}/anh-goc/tlhp-media/a.webp`]);
	const book = bookMetadata({ title: "Đi Qua Khổ Vui Cuộc Đời", description: "Sách", coverImage: "https://media.example.com/c.jpg" });
	assert.equal(book.title, "Đi Qua Khổ Vui Cuộc Đời | Tùng Lâm Hòa Phúc");
	assert.deepEqual(ogImages(book), ["https://media.example.com/c.jpg"]);
});

// ── Phần đọc, trên D1 giả ────────────────────────────────────────────────────

function seed() {
	const db = createFakeD1();
	db.insert("category", { id: "c1", slug: "cong-tu", name: "Cộng tu", kind: "post" });
	db.insert("category", { id: "g1", slug: "hanh-tri", name: "Hành trì", kind: "teaching" });
	db.insert("media", { id: "m-thumb", r2_key: "posts/thumb.webp", url: null });
	db.insert("media", { id: "m-banner", r2_key: "posts/banner.webp", url: null });
	db.insert("media", { id: "m-og", r2_key: "posts/og.webp", url: null });
	const p = (id: string, slug: string, section: string, extra: Record<string, unknown> = {}) =>
		db.insert("post", { id, slug, title: `Bài ${slug}`, section, category_id: "c1", published_date: "2026-08-23", thumbnail_media_id: "m-thumb", banner_media_id: "m-banner", content_html: "<p>thân</p>", summary: `tóm tắt ${slug}`, ...extra });
	p("p1", "co-seo", "dong-chay-hoang-phap", { seo_title: "SEO của bài", seo_description: "Mô tả SEO của bài", og_media_id: "m-og" });
	p("p2", "khong-seo", "dong-chay-hoang-phap");
	p("p3", "nhap", "dong-chay-hoang-phap", { status: "draft" });
	p("p4", "khac-muc", "tri-tue-phat-phap");
	p("p5", "hen-gio", "dong-chay-hoang-phap", { status: "scheduled", publish_at: isoIn(3) });
	db.insert("teaching_article", { id: "t1", slug: "tiep-buoc-thay-toi", title: "Tiếp bước Thầy tôi", name: "Tiếp bước Thầy tôi", group_id: "g1", banner_media_id: "m-banner", excerpt: "Trích đoạn bài", seo_title: "SEO tông chỉ", seo_description: "Mô tả tông chỉ", og_media_id: "m-og", content_html: "<p>x</p>" });
	db.insert("teaching_article", { id: "t2", slug: "khong-seo-tc", title: "Bài tông chỉ", name: "Bài tông chỉ", group_id: "g1", banner_media_id: "m-banner", excerpt: "Trích", content_html: "<p>x</p>" });
	db.insert("page", { id: "gt-1", slug: "su-ong", title: "Sư Ông", subtitle: "Phụ đề", group_id: "g1", banner_media_id: "m-banner", overview: "Tổng quan Sư Ông", content_html: "<p>x</p>" });
	db.insert("area", { id: "a1", slug: "bao-thap-van-phat-xa-loi", name: "Bảo tháp", subtitle: "", cover_media_id: "m-banner", intro: "Giới thiệu bảo tháp", visible: 1 });
	db.insert("area", { id: "a2", slug: "kin", name: "Khu ẩn", cover_media_id: "m-banner", intro: "Ẩn", visible: 0 });
	return createD1Repository(db);
}

test("đọc bài: có SEO thì dùng, không thì lùi về tóm tắt và ảnh bìa; đúng chuyên mục mới có", async () => {
	const repo = seed();
	const seo = await postMetadataFor("co-seo", "dong-chay-hoang-phap", repo);
	assert.equal(seo.title, "SEO của bài | Tùng Lâm Hòa Phúc");
	assert.equal(seo.description, "Mô tả SEO của bài");
	assert.deepEqual(ogImages(seo), [`${PUBLIC_ORIGIN}/anh-goc/s2-cnv03/posts/og.webp`]);
	const plain = await postMetadataFor("khong-seo", "dong-chay-hoang-phap", repo);
	assert.equal(plain.title, "Bài khong-seo | Tùng Lâm Hòa Phúc");
	assert.equal(plain.description, "tóm tắt khong-seo");
	assert.deepEqual(ogImages(plain), [`${PUBLIC_ORIGIN}/anh-goc/s2-cnv03/posts/banner.webp`]);
	// Bài nháp, hẹn giờ chưa tới, của chuyên mục khác, không có: trang trả 404, metadata rỗng.
	for (const [slug, section] of [["nhap", "dong-chay-hoang-phap"], ["hen-gio", "dong-chay-hoang-phap"], ["khac-muc", "dong-chay-hoang-phap"], ["khong-co", "dong-chay-hoang-phap"], ["co-seo", "tri-tue-phat-phap"]] as const) {
		assert.deepEqual(await postMetadataFor(slug, section, repo), {}, `${slug} / ${section}`);
	}
	// Địa chỉ bằng mã ("post-1060") như trang vẫn mở.
	assert.equal((await postMetadataFor("p1", "dong-chay-hoang-phap", repo)).title, "SEO của bài | Tùng Lâm Hòa Phúc");
	// Slug có dấu bị mã hóa phần trăm.
	assert.deepEqual(await postMetadataFor("%E0%A4%A", "dong-chay-hoang-phap", repo), {}, "mã hóa hỏng không làm trang lỗi");
});

test("đọc Tông Chỉ: SEO, lùi về trích đoạn, địa chỉ cũ vẫn ra bài", async () => {
	const repo = seed();
	const seo = await tongChiMetadataFor("tiep-buoc-thay-toi", repo);
	assert.equal(seo.title, "SEO tông chỉ | Tùng Lâm Hòa Phúc");
	assert.equal(seo.description, "Mô tả tông chỉ");
	assert.deepEqual(ogImages(seo), [`${PUBLIC_ORIGIN}/anh-goc/s2-cnv03/posts/og.webp`]);
	assert.equal((await tongChiMetadataFor("tong-phong-truyen-thua-truc-lam", repo)).title, seo.title, "địa chỉ cũ");
	const plain = await tongChiMetadataFor("khong-seo-tc", repo);
	assert.equal(plain.description, "Trích");
	assert.deepEqual(ogImages(plain), [`${PUBLIC_ORIGIN}/anh-goc/s2-cnv03/posts/banner.webp`]);
	assert.deepEqual(await tongChiMetadataFor("khong-co", repo), {});
});

test("đọc Giới thiệu và khu vực: có thì ra metadata, ẩn hay không có thì rỗng", async () => {
	const repo = seed();
	const about = await aboutMetadataFor("su-ong", repo);
	assert.equal(about.title, "Sư Ông | Tùng Lâm Hòa Phúc");
	assert.equal(about.description, "Tổng quan Sư Ông");
	assert.deepEqual(ogImages(about), [`${PUBLIC_ORIGIN}/anh-goc/s2-cnv03/posts/banner.webp`]);
	assert.deepEqual(await aboutMetadataFor("khong-co", repo), {});
	assert.equal((await areaMetadataFor("bao-thap-van-phat-xa-loi", repo)).description, "Giới thiệu bảo tháp");
	assert.equal((await areaMetadataFor("bao-thap", repo)).title, "Bảo tháp | Tùng Lâm Hòa Phúc", "địa chỉ cũ của khu vực");
	assert.deepEqual(await areaMetadataFor("kin", repo), {});
});

test("các trang chi tiết xuất generateMetadata, revalidate 30 và vẫn đọc bằng bộ đọc của v3-live", () => {
	const pages: Array<[string, RegExp]> = [
		["dong-chay-hoang-phap/[slug]", /postMetadataFor/],
		["tri-tue-phat-phap/[slug]", /postMetadataFor/],
		["tong-chi-tu-hoc/[slug]", /tongChiMetadataFor/],
		["vu-tru-phat-giao/[slug]", /areaMetadataFor/],
		["gioi-thieu/[slug]", /aboutMetadataFor/],
	];
	for (const [dir, used] of pages) {
		const code = readFileSync(`src/app/(public)/${dir}/page.tsx`, "utf8");
		assert.match(code, /export async function generateMetadata/, dir);
		assert.match(code, used, dir);
		assert.match(code, /export const revalidate = 30;/, `${dir}: revalidate 30`);
	}
	assert.match(readFileSync("src/app/(public)/dong-chay-hoang-phap/page.tsx", "utf8"), /export const revalidate = 60;/);
});

test("revalidate không nhỏ hơn thời gian làm mới bản đọc D1 (15 giây), nếu không bản đọc cũ che mất lần dựng lại", () => {
	const renew = Number(/const D1_RENEW_MS = ([\d_]+);/.exec(readFileSync("src/lib/tlhp-content/repository.ts", "utf8"))?.[1].replace(/_/g, ""));
	assert.ok(renew > 0 && renew <= 15_000, `D1_RENEW_MS = ${renew}`);
	for (const dir of ["dong-chay-hoang-phap/[slug]", "tri-tue-phat-phap/[slug]", "tong-chi-tu-hoc/[slug]", "vu-tru-phat-giao/[slug]", "gioi-thieu/[slug]", "dong-chay-hoang-phap"]) {
		const seconds = Number(/export const revalidate = (\d+);/.exec(readFileSync(`src/app/(public)/${dir}/page.tsx`, "utf8"))?.[1]);
		assert.ok(seconds * 1000 >= renew * 2, `${dir}: revalidate ${seconds}s phải gấp ít nhất hai lần ${renew / 1000}s`);
	}
});
