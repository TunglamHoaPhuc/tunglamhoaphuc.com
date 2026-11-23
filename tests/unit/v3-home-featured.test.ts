// Dải trượt "Khu vực & Bảo tượng" của trang chủ theo khu vực nổi bật do admin chọn (area.featured, featured_position):
// admin chọn thì theo admin và thứ tự của admin; chưa chọn (hoặc không còn khu vực nào hiện trên trang) thì giữ danh sách có sẵn của V3.
// Admin không có khái niệm "tượng nổi bật", nên danh sách tượng không đổi.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { FEATURED_AREA_PICKS, featuredAreaPicks, homeGallery, readFeaturedAreaIds } from "@/lib/v3-home";
import { liveAreas } from "@/lib/v3-live";
import { createFakeD1 } from "../helpers/d1";

type Db = ReturnType<typeof createFakeD1>;

function seed(withFeaturedColumns = true): Db {
	const db = createFakeD1();
	if (withFeaturedColumns) {
		db.exec("alter table area add column featured integer not null default 0");
		db.exec("alter table area add column featured_position integer not null default 0");
	}
	db.insert("media", { id: "m1", r2_key: "pics/a.webp", url: null });
	const area = (row: Record<string, unknown>) => db.insert("area", { temple: "tung-lam-hoa-phuc", cover_media_id: "m1", visible: 1, ...row });
	area({ id: "a1", slug: "tam-bao", name: "TAM BẢO", subtitle: "Đại Hùng Bảo Điện", position: 1 });
	area({ id: "a2", slug: "to-duong", name: "TỔ ĐƯỜNG", subtitle: "Tổ ấn", position: 2 });
	area({ id: "a3", slug: "khu-moi", name: "KHU MỚI", subtitle: "Mới thêm", position: 3 });
	area({ id: "a4", slug: "san-la-han", name: "SÂN LA HÁN", position: 4 });
	area({ id: "a5", slug: "giang-duong", name: "GIẢNG ĐƯỜNG", position: 5 });
	return db;
}

const flag = (db: Db, id: string, position: number) => db.exec(`update area set featured = 1, featured_position = ${position} where id = '${id}'`);
const slugs = (g: ReturnType<typeof homeGallery>) => g.areas.map((a) => a.targetUrl.split("/").pop());

async function gallery(db: Db) {
	const areas = await liveAreas(createD1Repository(db));
	return homeGallery(areas, [], await readFeaturedAreaIds(db));
}

test("admin chưa chọn khu vực nổi bật nào: giữ danh sách có sẵn của V3", async () => {
	const g = await gallery(seed());
	assert.deepEqual(slugs(g), ["tam-bao", "to-duong", "giang-duong"], "những khu vực có sẵn trong danh sách của V3 mà D1 có");
});

test("admin đã chọn: theo đúng các khu vực và thứ tự featured_position của admin, không theo danh sách có sẵn", async () => {
	const db = seed();
	flag(db, "a3", 0);
	flag(db, "a4", 1);
	flag(db, "a1", 2);
	const g = await gallery(db);
	assert.deepEqual(slugs(g), ["khu-moi", "san-la-han", "tam-bao"]);
	assert.equal(g.areas[0].name, "KHU MỚI");
	assert.equal(g.areas[0].subtitle, "Mới thêm");
	assert.match(g.areas[0].imgUrl, /pics\/a\.webp$/);
});

test("khu vực nổi bật bị ẩn hay đã xóa thì không lên dải trượt; còn lại vẫn theo admin", async () => {
	const db = seed();
	flag(db, "a1", 0);
	flag(db, "a2", 1);
	flag(db, "a3", 2);
	db.exec("update area set visible = 0 where id = 'a2'");
	db.exec("update area set deleted_at = '2026-01-01T00:00:00.000Z' where id = 'a3'");
	assert.deepEqual(slugs(await gallery(db)), ["tam-bao"]);
});

test("admin chọn nhưng không khu vực nào đang hiện trên trang: về danh sách có sẵn, không để dải trượt trống", async () => {
	const db = seed();
	flag(db, "a2", 0);
	db.exec("update area set visible = 0 where id = 'a2'");
	assert.deepEqual(slugs(await gallery(db)), ["tam-bao", "giang-duong"]);
});

test("cùng featured_position thì theo id; biểu tượng: khu vực V3 đã biết giữ biểu tượng của nó, khu vực mới lần lượt lấy biểu tượng dự phòng", async () => {
	const db = seed();
	flag(db, "a3", 0);
	flag(db, "a1", 0);
	flag(db, "a4", 1);
	const g = await gallery(db);
	assert.deepEqual(slugs(g), ["tam-bao", "khu-moi", "san-la-han"], "a1 đứng trước a3 khi cùng vị trí");
	const known = FEATURED_AREA_PICKS.find((p) => p.slug === "tam-bao")?.icon;
	assert.equal(g.areas[0].iconName, known);
	assert.ok(g.areas[1].iconName && g.areas[2].iconName);
	assert.notEqual(g.areas[1].iconName, g.areas[2].iconName);
});

test("đọc id nổi bật: chỉ khu vực đang hiện, đúng thứ tự; cơ sở dữ liệu chưa có cột thì rỗng, không làm hỏng trang chủ", async () => {
	const db = seed();
	flag(db, "a2", 1);
	flag(db, "a1", 0);
	flag(db, "a5", 2);
	db.exec("update area set visible = 0 where id = 'a5'");
	assert.deepEqual(await readFeaturedAreaIds(db), ["a1", "a2"]);
	const log = console.error;
	console.error = () => {};
	try {
		assert.deepEqual(await readFeaturedAreaIds(seed(false)), []);
	} finally {
		console.error = log;
	}
});

test("featuredAreaPicks: id lạ (khu vực không còn) bị bỏ; không truyền id thì như trước", async () => {
	const areas = await liveAreas(createD1Repository(seed()));
	assert.deepEqual(featuredAreaPicks(areas, ["không-có", "a3"]).map((p) => p.area.slug), ["khu-moi"]);
	assert.deepEqual(featuredAreaPicks(areas, []).map((p) => p.area.slug), ["tam-bao", "to-duong", "giang-duong"]);
});
