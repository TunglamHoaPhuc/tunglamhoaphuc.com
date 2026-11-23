// "Tin mới nhất" của trang chủ theo đúng trạng thái admin đặt: chỉ bài/bài viết/chủ đề/tượng đang hiển thị trong D1 mới có thẻ,
// bài nháp, tạm ẩn, hẹn giờ chưa tới hay đã xóa thì vắng mặt (không thẻ nào dẫn tới trang 404), thẻ trỏ đúng địa chỉ V3 mở được,
// và không còn lớp "serverless / danh sách đã xóa" hay bản tin viết sẵn trong mã.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { buildHomeNews, loadHomeNews, NEWS_SECTIONS, postHref, type HomeNewsInput } from "@/lib/v3-home-news";
import { livePost } from "@/lib/v3-live";
import { NO_LINKS } from "@/lib/v3-statues";
import { createFakeD1, isoIn, type FakeD1 } from "../helpers/d1";

function seed(): FakeD1 {
	const db = createFakeD1();
	db.insert("category", { id: "c1", slug: "khoa-le-truyen-thong", name: "Khóa Lễ Truyền Thống", kind: "post" });
	db.insert("category", { id: "c2", slug: "phap-am", name: "Pháp Âm", kind: "post" });
	db.insert("category", { id: "g1", slug: "nen-tang-tu-hoc", name: "Nền Tảng Tu Học", kind: "group" });
	db.insert("category", { id: "g2", slug: "lich-su-chua", name: "Lịch sử chùa", kind: "group" });
	db.insert("media", { id: "m1", r2_key: "posts/a.webp", url: null });
	db.insert("media", { id: "m2", r2_key: "statues/tp1.webp", url: null });
	const post = (id: string, slug: string, section: string, date: string, extra: Record<string, unknown> = {}) =>
		db.insert("post", { id, slug, title: `Bài ${slug}`, subtitle: `Phụ đề ${slug}`, section, category_id: section === "tri-tue-phat-phap" ? "c2" : "c1", published_date: date, thumbnail_media_id: "m1", content_html: "<p>x</p>", ...extra });
	post("p1", "moi-nhat", "dong-chay-hoang-phap", "2026-11-20");
	post("p2", "cu-hon", "dong-chay-hoang-phap", "2026-11-10");
	post("p3", "ban-nhap", "dong-chay-hoang-phap", "2026-11-22", { status: "draft" });
	post("p4", "tam-an", "dong-chay-hoang-phap", "2026-11-22", { status: "hidden" });
	post("p5", "hen-gio-chua-toi", "dong-chay-hoang-phap", "2026-11-22", { status: "scheduled", publish_at: isoIn(3) });
	post("p6", "hen-gio-da-toi", "dong-chay-hoang-phap", "2026-11-15", { status: "scheduled", publish_at: isoIn(-1) });
	post("p7", "thung-rac", "dong-chay-hoang-phap", "2026-11-22", { deleted_at: isoIn(-1) });
	post("p8", "phap-am-moi", "tri-tue-phat-phap", "2026-11-05");
	post("p9", "cua-vu-tru", "vu-tru-phat-giao", "2026-11-21");
	// Cùng tựa với bài đầu (nhập hai lần): chỉ hiện một thẻ, như trang chủ www.
	db.insert("post", { id: "p10", slug: "moi-nhat-lan-hai", title: "Bài moi-nhat", section: "dong-chay-hoang-phap", category_id: "c1", published_date: "2026-11-19", content_html: "<p>x</p>" });

	db.insert("page", { id: "su-to", slug: "tieu-su-su-to", title: "Tiểu sử Sư Tổ", subtitle: "Phụ đề sư tổ", group_id: "g2", banner_media_id: "m1", banner_position: "center 10%", position: 1 });
	db.insert("teaching_article", { id: "tc1", slug: "bo-de-tam-coi-nguon-thien-phap", title: "Bồ Đề Tâm", subtitle: "Cội nguồn", group_id: "g1", banner_media_id: "m1", position: 1 });
	db.insert("teaching_article", { id: "tc2", slug: "tiep-buoc-thay-toi", title: "Tiếp bước Thầy tôi", subtitle: "", excerpt: "Trích dẫn", group_id: "g1", banner_media_id: "m1", position: 2 });
	db.insert("statue", { id: "s1", code: "TP0001", slug: "thich-ca-tp0001", name: "ĐỨC PHẬT THÍCH CA", subtitle: "Vô Thượng Năng Nhân", image_media_id: "m2", position: 1 });
	db.insert("statue", { id: "s2", code: "TP0002", slug: "a-di-da-tp0002", name: "ĐỨC PHẬT A DI ĐÀ", position: 2 });
	return db;
}

const load = (db: FakeD1) => loadHomeNews({ repo: createD1Repository(db), links: NO_LINKS });
const urls = (items: { targetUrl: string }[]) => items.map((i) => i.targetUrl);

test("thẻ theo đúng bảy chỗ của V3: Sư Tổ, bài mới nhất, Tông Chỉ, tượng, các bài tiếp, Tông Chỉ thứ hai", async () => {
	const items = await load(seed());
	assert.deepEqual(urls(items), [
		"/gioi-thieu/tieu-su-su-to",
		"/dong-chay-hoang-phap/moi-nhat",
		"/tong-chi-tu-hoc/bo-de-tam-coi-nguon-thien-phap",
		"/bao-tuong/thich-ca-tp0001",
		"/dong-chay-hoang-phap/hen-gio-da-toi",
		"/tri-tue-phat-phap/phap-am-moi",
		"/dong-chay-hoang-phap/cu-hon",
		"/tong-chi-tu-hoc/tiep-buoc-thay-toi",
	]);
	assert.equal(items[0].title, "TIỂU SỬ SƯ TỔ");
	assert.equal(items[0].imgPosition, "center 10%");
	assert.match(items[1].imgUrl, /posts\/a\.webp$/);
	assert.equal(items[1].category, "Khóa Lễ Truyền Thống");
	assert.equal(items[1].iconUrl, "/images/icons/icon-khoa-le-truyen-thong.png");
	assert.equal(items[5].iconUrl, "/images/icons/icon-phap-am.webp");
	assert.equal(items[3].subtitle, "Vô Thượng Năng Nhân");
	assert.equal(new Set(items.map((i) => i.id)).size, items.length, "không thẻ nào lặp");
});

test("bài nháp, tạm ẩn, hẹn giờ chưa tới, thùng rác và bài mục khác (Vũ trụ) không có thẻ; hẹn giờ đã tới có thẻ", async () => {
	const all = urls(await load(seed())).join("\n");
	for (const gone of ["ban-nhap", "tam-an", "hen-gio-chua-toi", "thung-rac", "cua-vu-tru"]) assert.doesNotMatch(all, new RegExp(gone), gone);
	assert.match(all, /hen-gio-da-toi/);
});

test("cùng tựa nhập hai lần: chỉ một thẻ", async () => {
	const all = urls(await load(seed()));
	assert.equal(all.filter((u) => /moi-nhat/.test(u)).length, 1);
});

test("admin đổi trạng thái thì thẻ đổi theo: ẩn bài mới nhất thì bài kế lên đầu, xuất bản bài nháp thì nó lên đầu", async () => {
	const db = seed();
	db.exec("update post set status = 'hidden' where id = 'p1'");
	assert.equal((await load(db))[1].targetUrl, "/dong-chay-hoang-phap/moi-nhat-lan-hai", "bài trùng tựa (19/11) là bài mới nhất còn lại");
	db.exec("update post set status = 'published' where id = 'p3'");
	assert.equal((await load(db))[1].targetUrl, "/dong-chay-hoang-phap/ban-nhap", "bài vừa xuất bản (22/11) mới nhất");
	db.exec("update post set deleted_at = '2026-11-23T00:00:00.000Z' where id = 'p3'");
	assert.doesNotMatch(urls(await load(db)).join("\n"), /ban-nhap/);
});

test("bài ghim của admin đứng trước bài mới hơn (cùng thứ tự với 'Tin mới' của www)", async () => {
	const db = seed();
	db.exec("update post set pinned = 1 where id = 'p2'");
	assert.equal((await load(db))[1].targetUrl, "/dong-chay-hoang-phap/cu-hon");
});

test("chủ đề Sư Tổ bị ẩn hay xóa thì không có thẻ đó (không thẻ dẫn tới trang 404, không chữ viết sẵn thay vào)", async () => {
	const db = seed();
	db.exec("update page set status = 'hidden' where id = 'su-to'");
	let items = await load(db);
	assert.equal(items.some((i) => i.sourceType === "gioi-thieu"), false);
	assert.equal(items[0].targetUrl, "/dong-chay-hoang-phap/moi-nhat");
	db.exec("update page set status = 'published', deleted_at = '2026-11-23T00:00:00.000Z' where id = 'su-to'");
	items = await load(db);
	assert.equal(items.some((i) => i.sourceType === "gioi-thieu"), false);
});

test("tượng TP0001 bị ẩn: tượng hiển thị đầu tiên thay vào; không còn tượng nào: không thẻ tượng", async () => {
	const db = seed();
	db.exec("update statue set status = 'hidden' where id = 's1'");
	assert.equal((await load(db)).find((i) => i.sourceType === "bao-tuong")?.targetUrl, "/bao-tuong/a-di-da-tp0002");
	db.exec("update statue set deleted_at = '2026-11-23T00:00:00.000Z' where id = 's2'");
	assert.equal((await load(db)).some((i) => i.sourceType === "bao-tuong"), false);
});

test("Tông Chỉ Bồ Đề Tâm không hiện thì bài đầu danh sách thay vào; không có bài nào thì không thẻ Tông Chỉ", async () => {
	const db = seed();
	db.exec("update teaching_article set status = 'draft' where id = 'tc1'");
	const items = await load(db);
	assert.equal(items.find((i) => i.sourceType === "tong-chi")?.targetUrl, "/tong-chi-tu-hoc/tiep-buoc-thay-toi");
	assert.equal(items.filter((i) => i.sourceType === "tong-chi").length, 1, "không lặp một bài ở hai chỗ");
	db.exec("update teaching_article set status = 'draft'");
	assert.equal((await load(db)).some((i) => i.sourceType === "tong-chi"), false);
});

test("D1 trống: không thẻ nào, không bản tin viết sẵn", async () => {
	assert.deepEqual(await load(createFakeD1()), []);
});

test("D1 không đọc được: lỗi đi lên cho nơi gọi quyết định (API trả 500, khối không vẽ), không trả bản cũ", async () => {
	const broken = {
		prepare: () => ({
			bind() {
				return this;
			},
			all: async () => {
				throw new Error("D1 down");
			},
		}),
	} as unknown as FakeD1;
	await assert.rejects(() => loadHomeNews({ repo: createD1Repository(broken), links: NO_LINKS }), /D1 down/);
});

test("địa chỉ thẻ bài mở được: mọi thẻ bài trỏ tới bài mà livePost tìm thấy ở đúng chuyên mục", async () => {
	const db = seed();
	const repo = createD1Repository(db);
	const items = await load(db);
	const posts = items.filter((i) => i.sourceType === "dong-chay-hoang-phap" || i.sourceType === "tri-tue-phat-phap");
	assert.ok(posts.length >= 4);
	for (const item of posts) {
		const [, section, slug] = item.targetUrl.split("/");
		assert.ok(NEWS_SECTIONS.includes(section), item.targetUrl);
		assert.ok(await livePost(slug, section, repo), `${item.targetUrl} phải mở được`);
	}
	assert.equal(postHref({ mainCategory: "tri-tue-phat-phap", slug: "x" }), "/tri-tue-phat-phap/x");
	assert.equal(postHref({ mainCategory: "dong-chay-hoang-phap", slug: "x" }), "/dong-chay-hoang-phap/x");
});

test("bộ dựng thuần: ảnh thiếu dùng ảnh thiết kế, chỗ không có nội dung thì bỏ, chỉ nhận hai chuyên mục V3 mở", () => {
	const post = (id: string, section: string, extra: Record<string, unknown> = {}) =>
		({ id, slug: id, title: `Tựa ${id}`, subtitle: "", mainCategory: section, subCategory: "", categoryName: "", publishedDate: "2026-01-01", thumbnailUrl: "", bannerUrl: "", thumbnailPosition: "", bannerPosition: "", ...extra }) as unknown as HomeNewsInput["posts"][number];
	const items = buildHomeNews({ posts: [post("a", "dong-chay-hoang-phap"), post("b", "vu-tru-phat-giao")], tongChi: [], statues: [], suTo: null });
	assert.equal(items.length, 1);
	assert.match(items[0].imgUrl, /^\/anh-goc\/media-tunglamhoaphuc\//, "ảnh thiết kế khi bài chưa có ảnh (trong R2, không phải host ngoài)");
	assert.equal(items[0].category, "Dòng Chảy Hoằng Pháp");
	assert.deepEqual(buildHomeNews({ posts: [], tongChi: [], statues: [], suTo: null }), []);
});

test("trang chủ không còn đọc lớp serverless, danh sách đã xóa, tuyến admin cũ hay bản tin viết sẵn", () => {
	const route = readFileSync("src/app/api/home/news-carousel/route.ts", "utf8");
	const section = readFileSync("src/features/home/components/NewsSection.tsx", "utf8");
	const lib = readFileSync("src/lib/v3-home-news.ts", "utf8");
	for (const [name, text] of [["route", route], ["NewsSection", section], ["v3-home-news", lib]] as const) {
		assert.doesNotMatch(text, /serverless-db|deleted-posts|deletedList|api\/admin\/(posts|gioi-thieu)|loadServerlessJson/, name);
	}
	assert.doesNotMatch(section, /INITIAL_NEWS_DATA|admin\.tunglamhoaphuc\.com|"post-1060"/);
});
