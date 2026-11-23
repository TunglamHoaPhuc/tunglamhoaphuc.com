// V2: for the kinds D1 holds (posts of two sections, areas, calendar events) V3 shows what D1 marks as live and
// nothing else: a draft, a post not yet due, a trashed or hidden item is not found (the page answers 404), and no
// bundled copy or page made from the slug takes its place.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { allArticles, dongChayPage, DONG_CHAY_SECTION, relatedArticles } from "@/lib/dong-chay";
import { findScheduleDetail, relatedForEvent, toSlug, youtubeEmbed } from "@/lib/schedule-detail";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { liveArea, liveAreas, livePost, livePosts, liveScheduleDetail } from "@/lib/v3-live";
import { dmy, mediaTypeOf, relatedWisdom, toWisdomItem, TRI_TUE_SECTION } from "@/lib/wisdom";
import { createFakeD1, isoIn } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	db.insert("category", { id: "c1", slug: "cong-tu", name: "Cộng tu", kind: "post" });
	db.insert("category", { id: "c2", slug: "phap-am", name: "Pháp âm", kind: "post" });
	db.insert("category", { id: "e1", slug: "cong-tu", name: "Cộng Tu", kind: "event" });
	db.insert("media", { id: "m1", r2_key: "posts/thumb-1.webp", url: null });
	const post = (id: string, slug: string, section: string, extra: Record<string, unknown> = {}) =>
		db.insert("post", { id, slug, title: `Bài ${slug}`, section, category_id: section === "dong-chay-hoang-phap" ? "c1" : "c2", published_date: "2026-08-23", thumbnail_media_id: "m1", content_html: `<p>thân ${slug}</p>`, summary: `tóm tắt ${slug}`, ...extra });
	post("p1", "cong-tu-vu-lan", "dong-chay-hoang-phap", { legacy_views: 40 });
	post("p2", "ban-nhap-dc", "dong-chay-hoang-phap", { status: "draft" });
	post("p3", "hen-gio-dc", "dong-chay-hoang-phap", { status: "scheduled", publish_at: isoIn(3) });
	post("p4", "thung-rac-dc", "dong-chay-hoang-phap", { deleted_at: isoIn(-1) });
	post("p5", "hen-gio-da-toi-dc", "dong-chay-hoang-phap", { status: "scheduled", publish_at: isoIn(-1) });
	post("p6", "phap-am-001", "tri-tue-phat-phap", { legacy_views: 0, title: "Pháp âm 001" });
	post("p7", "bai-tri-tue", "tri-tue-phat-phap", { legacy_views: 25 });
	post("p8", "ban-nhap-tt", "tri-tue-phat-phap", { status: "draft" });
	db.insert("post", { id: "post-1060", slug: "bai-co-id-cu", title: "Bài id cũ", section: "dong-chay-hoang-phap", category_id: "c1", published_date: "2026-01-01", content_html: "<p>x</p>" });

	db.insert("media", { id: "m2", r2_key: "areas/tam-bao.webp", url: null });
	db.insert("area", { id: "ar1", slug: "tam-bao", name: "TAM BẢO", temple: "tung-lam-hoa-phuc", cover_media_id: "m2", map_x: 10, map_y: 20, intro: "Giới thiệu tam bảo", content_html: "<p>Thân bài tam bảo</p>", position: 1 });
	db.insert("area", { id: "ar2", slug: "tang-kinh-cac", name: "THƯ VIỆN", temple: "tung-lam-hoa-phuc", intro: "Thư viện", position: 2 });
	db.insert("area", { id: "ar3", slug: "to-duong", name: "TỔ ĐƯỜNG", intro: "Bị ẩn", visible: 0, position: 3 });
	db.insert("area", { id: "ar4", slug: "giang-duong", name: "GIẢNG ĐƯỜNG", intro: "Bị xóa", deleted_at: isoIn(-1), position: 4 });

	const event = (id: string, slug: string, title: string, extra: Record<string, unknown> = {}) =>
		db.insert("calendar_event", { id, slug, title, category_id: "e1", start_date: "2026-12-01", end_date: "2026-12-01", times: "[]", ...extra });
	event("ev1", "cong-tu-mot-ngay", "Cộng tu một ngày an lạc", { times: JSON.stringify([{ label: "Khai khóa", time: "07h30" }]), location: "Chánh điện", description: "Mô tả", video: JSON.stringify({ id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }) });
	event("ev2", "nhap", "Sự kiện nháp", { status: "draft" });
	event("ev3", "thung-rac-ev", "Sự kiện xóa", { deleted_at: isoIn(-1) });
	event("ev4", "tron-troi", "Sự kiện trơn");
	db.insert("featured_program", { id: "kp1", title: "Đại sám hối", subtitle: "Khóa lễ định kỳ", summary: "Mỗi ngày 14", time: "19h15", duration: "2 giờ", location: "", position: 1 });
	return createD1Repository(db);
}

// ── posts ───────────────────────────────────────────────────────────────────

test("danh sách Dòng chảy: chỉ bài đang hiển thị, không bộ 60 bài đóng gói", async () => {
	const repo = seed();
	const slugs = (await allArticles(repo)).map((a) => a.slug).sort();
	assert.deepEqual(slugs, ["bai-co-id-cu", "cong-tu-vu-lan", "hen-gio-da-toi-dc"]);
	const empty = await dongChayPage({ page: 1 }, createD1Repository(createFakeD1()));
	assert.deepEqual(empty.items, []);
	assert.equal(empty.total, 0);
});

test("bài nháp, hẹn giờ chưa tới, thùng rác, sai chuyên mục, không có: không tìm thấy", async () => {
	const repo = seed();
	for (const slug of ["ban-nhap-dc", "hen-gio-dc", "thung-rac-dc", "khong-co", "phap-am-001"]) assert.equal(await livePost(slug, DONG_CHAY_SECTION, repo), null, slug);
	assert.equal(await livePost("cong-tu-vu-lan", TRI_TUE_SECTION, repo), null, "bài Dòng chảy không mở được dưới Trí tuệ");
	assert.equal(await livePost("ban-nhap-tt", TRI_TUE_SECTION, repo), null);
	assert.ok(await livePost("hen-gio-da-toi-dc", DONG_CHAY_SECTION, repo));
});

test("bài mở được bằng slug có dấu %, và bằng id cũ 'post-…' (chỉ khi đang hiển thị)", async () => {
	const repo = seed();
	assert.equal((await livePost("cong-tu-vu-lan", DONG_CHAY_SECTION, repo))?.contentHtml, "<p>thân cong-tu-vu-lan</p>");
	assert.equal((await livePost("post-1060", DONG_CHAY_SECTION, repo))?.slug, "bai-co-id-cu");
	assert.equal((await livePost("1060", DONG_CHAY_SECTION, repo))?.slug, "bai-co-id-cu");
	assert.equal(await livePost("p2", DONG_CHAY_SECTION, repo), null, "id của bài nháp cũng không mở được");
});

test("'Tìm hiểu thêm' không chọn bài ẩn hay chính nó", async () => {
	const repo = seed();
	const all = await allArticles(repo);
	const current = (await livePost("cong-tu-vu-lan", DONG_CHAY_SECTION, repo))!;
	const related = relatedArticles(current, all);
	assert.equal(related.some((r) => /ban-nhap|thung-rac|hen-gio-dc|cong-tu-vu-lan/.test(r.link)), false);
	assert.ok(related.length > 0);
});

test("Trí tuệ: lượt xem là số thật, không có số thì ẩn (không còn 108)", async () => {
	const repo = seed();
	const items = (await livePosts(TRI_TUE_SECTION, repo)).map(toWisdomItem);
	assert.deepEqual(items.map((i) => i.slug).sort(), ["bai-tri-tue", "phap-am-001"]);
	assert.equal(items.find((i) => i.slug === "phap-am-001")!.views, 0);
	assert.equal(items.find((i) => i.slug === "bai-tri-tue")!.views, 25);
	assert.equal(items.some((i) => i.views === 108), false);
	assert.equal(items[0].originTag.label.length > 0, true);
	assert.equal(dmy("2026-08-23"), "23/08/2026");
	assert.equal(mediaTypeOf({ subCategory: "phap-am", title: "x", videoBlock: undefined }), "audio");
	const current = (await livePost("bai-tri-tue", TRI_TUE_SECTION, repo))!;
	assert.deepEqual(relatedWisdom(current, await livePosts(TRI_TUE_SECTION, repo)).map((r) => r.link), ["/tri-tue-phat-phap/phap-am-001"]);
});

// ── areas ───────────────────────────────────────────────────────────────────

test("khu vực: ẩn, đã xóa, hoặc không có thì không tìm thấy; địa chỉ cũ chỉ mở khi khu vực đang hiển thị", async () => {
	const repo = seed();
	assert.deepEqual((await liveAreas(repo)).map((a) => a.slug), ["tam-bao", "tang-kinh-cac"]);
	assert.equal(await liveArea("to-duong", repo), null, "bị ẩn");
	assert.equal(await liveArea("giang-duong", repo), null, "bị xóa");
	assert.equal(await liveArea("khu-vuc-tu-dung-theo-slug", repo), null, "không dựng khu vực từ slug");
	assert.equal((await liveArea("thu-vien", repo))?.slug, "tang-kinh-cac", "bí danh cũ → khu vực đang hiển thị");
	assert.equal((await liveArea("TAM-BAO", repo))?.slug, "tam-bao");
	assert.equal(await liveArea("nha-mau", repo), null, "bí danh trỏ tới khu vực không có");
});

// ── schedule ────────────────────────────────────────────────────────────────

test("thời khóa: nháp, đã xóa, slug lạ không có trang; không dựng trang từ chữ của slug", async () => {
	const repo = seed();
	assert.equal(await liveScheduleDetail("sự-kiện-nháp", repo), null);
	for (const slug of ["nhap", "thung-rac-ev", "sk-thang-8-tu-dung", "le-vu-lan-bo-nhiem"]) assert.equal(await liveScheduleDetail(slug, repo), null, slug);
	const event = await liveScheduleDetail("cong-tu-mot-ngay", repo);
	assert.equal(event?.title, "Cộng tu một ngày an lạc");
	assert.equal(event?.timeSlot, "Khai khóa: 07h30");
	assert.equal(event?.location, "Chánh điện");
	assert.equal(event?.videoUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
	assert.equal((await liveScheduleDetail(toSlug("Cộng tu một ngày an lạc"), repo))?.id, "ev1", "tìm được cả bằng slug làm từ tiêu đề");
});

test("thời khóa: D1 để trống thì để trống (không địa chỉ, giờ, lời dặn mặc định)", async () => {
	const repo = seed();
	const bare = await liveScheduleDetail("tron-troi", repo);
	assert.ok(bare);
	assert.equal(bare.location, "");
	assert.equal(bare.timeSlot, "");
	assert.equal(bare.notes, "");
	assert.equal(bare.description, "");
	assert.equal(bare.lunarDate, "");
	assert.equal(bare.videoUrl, "");
	const program = await liveScheduleDetail("dai-sam-hoi", repo);
	assert.equal(program?.timeSlot, "Giờ bắt đầu: 19h15");
	assert.equal(program?.location, "");
	assert.equal(findScheduleDetail("", { customEvents: [], featuredPrograms: [] }), null);
});

test("gợi ý bài cho thời khóa lấy từ các bài đang hiển thị", async () => {
	const repo = seed();
	const picks = relatedForEvent({ title: "Cộng tu một ngày", category: "Cộng Tu" }, await allArticles(repo));
	assert.ok(picks.length > 0 && picks.length <= 4);
	assert.equal(picks.some((p) => /ban-nhap|thung-rac|hen-gio-dc/.test(p.slug)), false);
	assert.equal(youtubeEmbed("https://example.com/video.mp4"), "");
	assert.equal(youtubeEmbed("https://youtu.be/dQw4w9WgXcQ?t=5"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
});

// ── source scan: nothing bundled stands in for D1 ───────────────────────────

test("các trang và API của những loại này không còn dùng bản đóng gói hay dựng trang từ slug", () => {
	const files: Record<string, RegExp> = {
		"src/lib/dong-chay.ts": /HOANG_PHAP_ARTICLES/,
		"src/app/(public)/dong-chay-hoang-phap/[slug]/page.tsx": /HOANG_PHAP_ARTICLES/,
		"src/app/(public)/dong-chay-hoang-phap/[slug]/DongChayDetailClient.tsx": /HOANG_PHAP_ARTICLES|\/api\/admin/,
		"src/app/(public)/tri-tue-phat-phap/page.tsx": /WISDOM_ITEMS/,
		"src/app/(public)/tri-tue-phat-phap/[slug]/page.tsx": /WISDOM_ITEMS/,
		"src/app/(public)/tri-tue-phat-phap/[slug]/TriTueDetailClient.tsx": /WISDOM_ITEMS|\|\| 108|\/api\/admin/,
		"src/features/wisdom/components/WisdomArchiveSection.tsx": /WISDOM_ITEMS|\|\| 108|wp-json|\/api\/admin/,
		"src/app/(public)/vu-tru-phat-giao/[slug]/AreaDetailClient.tsx": /UNIVERSE_AREAS|UniverseArea\s*=\s*UNIVERSE|\/api\/admin/,
		"src/app/(public)/lich-tu-hoc/[slug]/page.tsx": /getEventsForMonth|FEATURED_PROGRAMS|HOANG_PHAP_ARTICLES/,
		"src/app/(public)/lich-tu-hoc/[slug]/ScheduleDetailClient.tsx": /getEventsForMonth|FEATURED_PROGRAMS|HOANG_PHAP_ARTICLES|\/api\/admin|dangerouslySetInnerHTML/,
	};
	for (const [file, banned] of Object.entries(files)) assert.doesNotMatch(readFileSync(file, "utf8"), banned, file);
});

test("gợi ý theo từ trong tiêu đề: tách theo khoảng trắng", () => {
	const article = (id: string, title: string) => ({ id, slug: id, title, category: "", subCategory: "", thumbnailUrl: "t", summary: "" }) as never;
	const current = { id: "x", slug: "x", title: "Mùa Vu Lan", subCategory: "", keywords: [] };
	const picks = relatedArticles(current, [article("a", "Chuyện xa xôi"), article("b", "Vu Lan báo hiếu")]);
	assert.deepEqual(picks.map((p) => p.link), ["/dong-chay-hoang-phap/b", "/dong-chay-hoang-phap/a"]);
});
