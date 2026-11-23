// V4 (Bảo tượng): the list, the page, the area grids and the home slot show the statues D1 holds as live and nothing
// else; what the admin edits (name, subtitle, quote, cluster, area, image, variations, related, order) shows.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { assembliesOf, liveStatuePage, liveStatueRecords, NO_LINKS, readStatueLinks, toStatueRecord } from "@/lib/v3-statues";
import { createFakeD1, type FakeD1 } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	db.insert("media", { id: "m-main", r2_key: "statues/ca.webp", url: null });
	db.insert("media", { id: "m-art", r2_key: "statues/art.webp", url: null });
	db.insert("category", { id: "as1", slug: "chu_phat_hai_hoi", name: "Chư Phật Hải Hội", kind: "assembly" });
	db.insert("category", { id: "as2", slug: "thanh_tinh_dai_hai_chung", name: "Thanh Tịnh Đại Hải Chúng", kind: "assembly" });
	db.insert("statue_cluster", { id: "k1", name: "Hoa Nghiêm Tam Thánh" });
	db.insert("area", { id: "ar-tb", slug: "tam-bao", name: "TAM BẢO", subtitle: "Đại Hùng Bảo Điện", temple: "tung-lam-hoa-phuc", position: 1, visible: 1 });
	db.insert("area", { id: "ar-td", slug: "to-duong", name: "TỔ ĐƯỜNG", temple: "tung-lam-hoa-phuc", position: 2, visible: 1 });
	db.insert("area", { id: "ar-hid", slug: "giang-duong", name: "GIẢNG ĐƯỜNG", temple: "tung-lam-hoa-phuc", position: 3, visible: 0 });
	const statue = (row: Record<string, unknown>) => db.insert("statue", { is_main: 1, assembly_id: "as1", image_media_id: "m-main", status: "published", ...row });
	statue({ id: "TP0001", code: "TP0001", slug: "thich-ca_tp0001", name: "ĐỨC PHẬT THÍCH CA", subtitle: "Vô Thượng Năng Nhân", area_id: "ar-tb", area_code: "tam_bao", cluster_id: "k1", position: 2, quote_text: "Ngài sinh ở thế gian.", quote_author: "Vô Trí", body: "Đoạn một.\n\nĐoạn hai.", editorial_board: "Ban Văn Hóa" });
	statue({ id: "TP0002", code: "TP0002", slug: "van-thu_tp0002", name: "BỒ TÁT VĂN THÙ", area_id: "ar-tb", area_code: "tam_bao", cluster_id: "k1", position: 1, assembly_id: "as2" });
	statue({ id: "TP0003", code: "TP0003", slug: "pho-hien_tp0003", name: "BỒ TÁT PHỔ HIỀN", area_code: "tam_bao", cluster_id: "k1", position: 3, assembly_id: "as2" });
	statue({ id: "TP0004", code: "TP0004", slug: "nhap_tp0004", name: "TƯỢNG NHÁP", status: "draft", position: 4 });
	statue({ id: "TP0005", code: "TP0005", slug: "thung-rac_tp0005", name: "TƯỢNG TRONG THÙNG RÁC", deleted_at: "2026-01-01T00:00:00.000Z", position: 5 });
	statue({ id: "TP0006", code: "TP0006", slug: "an_tp0006", name: "TƯỢNG ẨN", status: "hidden", position: 6 });
	statue({ id: "TP0007", code: "TP0007", slug: "hen-gio_tp0007", name: "TƯỢNG HẸN GIỜ", status: "scheduled", position: 7 });
	statue({ id: "TP0008", code: "TP0008", slug: "o-khu-an_tp0008", name: "TƯỢNG Ở KHU ẨN", area_id: "ar-hid", area_code: "giang_duong", position: 8 });
	statue({ id: "NT0001", code: "TP0010", slug: "nghe-thuat_tp0010", name: "NGHỆ THUẬT THÍCH CA", is_main: 0, area_id: "ar-tb", area_code: "tam_bao", position: 9, assembly_id: "as1" });
	db.insert("art_variation", { id: "v1", statue_id: "TP0001", position: 0, variation_id: "NT0001", art_statue_id: "NT0001", title: "Thích Ca niêm hoa", location: "Tam Bảo", meaning: "Ý nghĩa một", image_media_id: "m-art" });
	db.insert("art_variation", { id: "v2", statue_id: "TP0001", position: 1, variation_id: "x", art_statue_id: "TP0004", title: "Tác phẩm gắn với tượng nháp", location: "Tổ Đường", meaning: "Ý nghĩa hai" });
	return db;
}

const deps = async (db: FakeD1) => ({ repo: createD1Repository(db), links: await readStatueLinks(db) });

test("danh sách: chỉ tượng đã xuất bản, đúng thứ tự biên tập; nháp, ẩn, hẹn giờ, thùng rác không có", async () => {
	const records = await liveStatueRecords(await deps(seed()));
	assert.deepEqual(
		records.map((s) => s.id),
		["TP0002", "TP0001", "TP0003", "TP0008", "NT0001"],
	);
	assert.equal(records.find((s) => s.id === "TP0001")?.categoryType, "TƯỢNG CHÍNH");
	assert.equal(records.find((s) => s.id === "NT0001")?.categoryType, "NTPG");
});

test("trang tượng: nháp, ẩn, hẹn giờ, thùng rác, không tồn tại đều không tìm thấy", async () => {
	const d = await deps(seed());
	for (const slug of ["nhap_tp0004", "thung-rac_tp0005", "an_tp0006", "hen-gio_tp0007", "khong-co"]) assert.equal(await liveStatuePage(slug, d), null, slug);
	assert.ok(await liveStatuePage("thich-ca_tp0001", d));
});

test("địa chỉ cũ vẫn mở: theo slug, theo mã và theo id, không phân biệt hoa thường", async () => {
	const d = await deps(seed());
	for (const key of ["thich-ca_tp0001", "TP0001", "tp0001"]) assert.equal((await liveStatuePage(key, d))?.statue.id, "TP0001", key);
});

test("trang tượng: tên, phụ đề, lời dạy, cụm, khu vực, ảnh, thân bài do admin lưu", async () => {
	const page = await liveStatuePage("thich-ca_tp0001", await deps(seed()));
	assert.ok(page);
	const s = page.statue;
	assert.equal(s.name, "ĐỨC PHẬT THÍCH CA");
	assert.equal(s.subtitle, "Vô Thượng Năng Nhân");
	assert.equal(s.quote, "Ngài sinh ở thế gian.");
	assert.equal(s.quoteAuthor, "Vô Trí");
	assert.equal(s.clusterName, "Hoa Nghiêm Tam Thánh");
	assert.equal(s.group, "Hoa Nghiêm Tam Thánh");
	assert.equal(s.assemblyName, "Chư Phật Hải Hội");
	assert.equal(s.assemblyId, "chu_phat_hai_hoi");
	assert.equal(s.areaSlug, "tam-bao");
	assert.equal(s.areaName, "TAM BẢO");
	assert.match(s.imgUrl, /statues\/ca\.webp$/);
	assert.match(s.fullHistoryHtml, /<p>Đoạn một\.<\/p>/);
	assert.equal(s.article?.author, "Ban Văn Hóa");
	assert.equal(s.article?.url, "/bao-tuong/thich-ca_tp0001");
	assert.equal(s.video, undefined, "D1 không có video: không thay bằng video nào");
	assert.deepEqual(page.clusterMembers.map((m) => m.name), ["BỒ TÁT VĂN THÙ", "BỒ TÁT PHỔ HIỀN"]);
});

test("không có lời dạy: không có chữ thay vào", async () => {
	const page = await liveStatuePage("van-thu_tp0002", await deps(seed()));
	assert.equal(page?.statue.quote, undefined);
	assert.equal(page?.statue.quoteAuthor, "");
	assert.equal(page?.statue.fullHistoryHtml, "");
});

test("tác phẩm nghệ thuật của tượng là các biến thể trong D1, theo thứ tự", async () => {
	const page = await liveStatuePage("thich-ca_tp0001", await deps(seed()));
	assert.deepEqual(page?.artWorks.map((a) => a.title), ["Thích Ca niêm hoa", "Tác phẩm gắn với tượng nháp"]);
	assert.equal(page?.artWorks[0].meaning, "Ý nghĩa một");
	assert.equal(page?.artWorks[0].areaName, "Tam Bảo");
	assert.match(page?.artWorks[0].imgUrl ?? "", /statues\/art\.webp$/);
	const none = await liveStatuePage("pho-hien_tp0003", await deps(seed()));
	assert.deepEqual(none?.artWorks, [], "tượng không có biến thể: không có tác phẩm đóng gói thay vào");
});

test("tượng liên quan: admin chọn thì đúng những tượng đó (chỉ tượng đang hiển thị), không thì cùng chúng hội", async () => {
	const db = seed();
	let page = await liveStatuePage("thich-ca_tp0001", await deps(db));
	assert.equal(page?.related.length, 2, "không admin chọn: lấy tượng chính khác");
	db.insert("statue_related", { statue_id: "TP0001", related_id: "TP0003", position: 0 });
	db.insert("statue_related", { statue_id: "TP0001", related_id: "TP0004", position: 1 });
	db.insert("statue_related", { statue_id: "TP0001", related_id: "TP0002", position: 2 });
	page = await liveStatuePage("thich-ca_tp0001", await deps(db));
	assert.deepEqual(page?.related.map((s) => s.id), ["TP0003", "TP0002"], "theo thứ tự admin, tượng nháp bị bỏ");
});

test("khu vực của tượng theo area_id của admin; khu vực ẩn thì tượng không thuộc khu vực nào", async () => {
	const records = await liveStatueRecords(await deps(seed()));
	const area = (id: string) => records.find((s) => s.id === id)?.areaSlug;
	assert.equal(area("TP0001"), "tam-bao");
	assert.equal(area("TP0008"), "", "khu vực Giảng Đường đang ẩn: không rơi sang khu vực khác theo mã cũ");
	assert.equal(area("TP0003"), "tam-bao", "không có area_id: theo mã khu vực của tệp cũ");
});

test("admin đổi khu vực, tên, thứ tự: trang thấy ngay", async () => {
	const db = seed();
	db.exec("update statue set area_id = 'ar-td', name = 'TÊN MỚI', position = 0 where id = 'TP0001'");
	const records = await liveStatueRecords(await deps(db));
	assert.equal(records[0].id, "TP0001");
	assert.equal(records[0].name, "TÊN MỚI");
	assert.equal(records[0].areaSlug, "to-duong");
});

test("ảnh: vị trí chỉ hiện khi admin chọn khác mặc định", async () => {
	const db = seed();
	db.exec("update statue set image_position = 'center 20%' where id = 'TP0002'");
	const records = await liveStatueRecords(await deps(db));
	assert.equal(records.find((s) => s.id === "TP0002")?.imgPosition, "center 20%");
	assert.equal(records.find((s) => s.id === "TP0001")?.imgPosition, undefined);
});

test("chúng hội của danh sách lấy từ tượng chính đang hiển thị, theo thứ tự quen thuộc", async () => {
	const db = seed();
	assert.deepEqual(assembliesOf(await liveStatueRecords(await deps(db))), [
		{ id: "chu_phat_hai_hoi", name: "Chư Phật Hải Hội" },
		{ id: "thanh_tinh_dai_hai_chung", name: "Thanh Tịnh Đại Hải Chúng" },
	]);
	db.exec("update statue set status = 'draft' where assembly_id = 'as2'");
	assert.deepEqual(assembliesOf(await liveStatueRecords(await deps(db))).map((a) => a.id), ["chu_phat_hai_hoi"]);
});

test("không đọc được D1 thì lỗi nổi lên, không có danh sách đóng gói thay vào", async () => {
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
	await assert.rejects(() => liveStatueRecords({ repo: createD1Repository(broken), links: NO_LINKS }), /D1 down/);
	await assert.rejects(() => liveStatuePage("thich-ca_tp0001", { repo: createD1Repository(broken), links: NO_LINKS }), /D1 down/);
});

test("trang tượng, danh sách, lưới khu vực và ô trang chủ không nhập dữ liệu tượng đóng gói", () => {
	const files = [
		"src/app/(public)/bao-tuong/[slug]/page.tsx",
		"src/app/(public)/bao-tuong-phat-giao/page.tsx",
		"src/app/(public)/bao-tuong-phat-giao/StatueListClient.tsx",
		"src/app/(public)/kiem-tra-anh/page.tsx",
		"src/app/(public)/vu-tru-phat-giao/[slug]/page.tsx",
		"src/app/(public)/vu-tru-phat-giao/[slug]/AreaDetailClient.tsx",
		"src/app/api/home/news-carousel/route.ts",
		"src/features/statues/components/StatueDetailCoreLayout.tsx",
		"src/features/universe/components/StatueCollectionGrid.tsx",
		"src/features/universe/components/ArtisticStatueSection.tsx",
		"src/lib/v3-statues.ts",
		"src/lib/serverless-db.ts",
	];
	for (const file of files) assert.doesNotMatch(readFileSync(file, "utf8"), /@\/data\/(statue-data|statues-database|baoTuongFullData|bao-tuong-full-data|universe-data)|OFFICIAL_(STATUE|TUONG|NTPG)/, file);
});

test("toStatueRecord không dựng chữ riêng của tượng khác", () => {
	const record = toStatueRecord(
		{ id: "x", code: "", slug: "x", name: "TƯỢNG X", subtitle: "", areaCode: "", main: true, image: null, href: "/bao-tuong/x", assembly: { slug: "", name: "" }, cluster: "" },
		{ areas: new Map(), links: NO_LINKS },
	);
	assert.equal(record.quote, undefined);
	assert.equal(record.imgUrl, "");
	assert.equal(record.areaName, "");
	assert.equal(record.clusterName, "");
});
