// The reading layer (a byte copy of www's) gives what the admin stores and V3 needs to order and show things as the editors set:
// category positions, Tông Chỉ group positions, a statue's other angles, specs and SEO, and Lời Thầy dạy.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { createFakeD1 } from "../helpers/d1";

const SECTION = "dong-chay-hoang-phap";

test("chuyên mục của một mục: đi theo vị trí biên tập viên đặt (kèm position), không theo số bài", async () => {
	const db = createFakeD1();
	db.insert("category", { id: "post:s:dai", slug: "dai", name: "Dài", kind: "post", section: SECTION, position: 30 });
	db.insert("category", { id: "post:s:nho", slug: "nho", name: "Nhỏ", kind: "post", section: SECTION, position: 10 });
	db.insert("category", { id: "post:s:vua", slug: "vua", name: "Vừa", kind: "post", section: SECTION, position: 20 });
	const post = (id: string, category: string) => db.insert("post", { id, slug: `bai-${id}`, title: `Bài ${id}`, section: SECTION, category_id: `post:s:${category}`, published_date: "2026-10-01" });
	["1", "2", "3"].forEach((id) => post(id, "dai"));
	["4", "5"].forEach((id) => post(id, "vua"));
	post("6", "nho");
	const list = await createD1Repository(db).listCategories(SECTION);
	assert.deepEqual(
		list.map((item) => [item.slug, item.position, item.count]),
		[
			["nho", 10, 1],
			["vua", 20, 2],
			["dai", 30, 3],
		],
	);
});

test("Tông Chỉ: bài đi từng nhóm theo vị trí nhóm (groupPosition), bài trong nhóm giữ thứ tự của admin", async () => {
	const db = createFakeD1();
	db.insert("category", { id: "tc:g1", slug: "g1", name: "Một", kind: "tong-chi", position: 3 });
	db.insert("category", { id: "tc:g2", slug: "g2", name: "Hai", kind: "tong-chi", position: 1 });
	const article = (id: string, group: string, position: number) => db.insert("teaching_article", { id, slug: `bai-${id}`, title: `Bài ${id}`, group_id: `tc:${group}`, position, status: "published", content_html: "<p>x</p>" });
	article("a", "g1", 1);
	article("b", "g2", 2);
	article("c", "g1", 3);
	const list = await createD1Repository(db).listTongChi();
	assert.deepEqual(
		list.map((item) => [item.slug, item.groupPosition]),
		[
			["bai-b", 1],
			["bai-a", 3],
			["bai-c", 3],
		],
	);
});

test("bảo tượng: ảnh nhiều góc theo thứ tự, thông số theo thứ tự lưu, SEO; tượng không có gì thì rỗng", async () => {
	const db = createFakeD1();
	db.insert("media", { id: "m1", r2_key: "cms/m1/a.webp", url: null });
	db.insert("media", { id: "m2", r2_key: "cms/m2/b.webp", url: null });
	db.insert("media", { id: "m3", r2_key: "cms/m3/c.webp", url: null, deleted_at: "2026-11-01T00:00:00.000Z" });
	const statue = (row: Record<string, unknown>) => db.insert("statue", { is_main: 1, status: "published", ...row });
	statue({ id: "S1", code: "TP1", slug: "mot_tp1", name: "MỘT", position: 1, specs: JSON.stringify({ "Chất liệu": "Đồng", Cao: "3 m" }), seo_title: "SEO một", seo_description: "Mô tả một" });
	statue({ id: "S2", code: "TP2", slug: "hai_tp2", name: "HAI", position: 2 });
	db.insert("statue_image", { statue_id: "S1", position: 1, media_id: "m2", label: "Bên trái", image_position: "center 30%" });
	db.insert("statue_image", { statue_id: "S1", position: 0, media_id: "m1", label: "Chính diện", image_position: "center 50%" });
	db.insert("statue_image", { statue_id: "S1", position: 2, media_id: "m3", label: "Đã xóa", image_position: "center 50%" });
	const repo = createD1Repository(db);
	const one = await repo.getStatue("mot_tp1");
	assert.deepEqual(
		one?.images?.map((image) => [image.label, image.position]),
		[
			["Chính diện", "center 50%"],
			["Bên trái", "center 30%"],
		],
	);
	assert.deepEqual(one?.specs, [
		{ name: "Chất liệu", value: "Đồng" },
		{ name: "Cao", value: "3 m" },
	]);
	assert.equal(one?.seoTitle, "SEO một");
	assert.equal(one?.seoDescription, "Mô tả một");
	const two = await repo.getStatue("hai_tp2");
	assert.deepEqual([two?.images, two?.specs, two?.seoTitle, two?.seoDescription], [[], [], "", ""]);
});

test("Lời Thầy: listQuotes chỉ lấy lời đang bật, chưa xóa, theo thứ tự admin", async () => {
	const db = createFakeD1();
	db.insert("quote", { id: "q2", text: "Hai", position: 2, active: 1 });
	db.insert("quote", { id: "q1", text: "Một", author: "Thầy", source: "Kinh A", source_url: "https://a.vn", position: 1, active: 1 });
	db.insert("quote", { id: "q3", text: "Tắt", position: 3, active: 0 });
	db.insert("quote", { id: "q4", text: "Xóa", position: 4, active: 1, deleted_at: "2026-11-01T00:00:00.000Z" });
	assert.deepEqual(await createD1Repository(db).listQuotes(), [
		{ id: "q1", text: "Một", author: "Thầy", source: "Kinh A", sourceUrl: "https://a.vn" },
		{ id: "q2", text: "Hai", author: "", source: "", sourceUrl: "" },
	]);
});
