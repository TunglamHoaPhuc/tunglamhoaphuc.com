// V4/V4b: the home page's "Khu vực & Bảo tượng" sliders show D1's text and pictures for V3's picks, and only the
// picks that are live in D1.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { homeGallery } from "@/lib/v3-home";
import { liveAreas } from "@/lib/v3-live";
import { liveStatueRecords, readStatueLinks } from "@/lib/v3-statues";
import { createFakeD1 } from "../helpers/d1";

async function gallery(mutate: (db: ReturnType<typeof createFakeD1>) => void = () => {}) {
	const db = createFakeD1();
	db.insert("media", { id: "m1", r2_key: "pics/a.webp", url: null });
	db.insert("category", { id: "as1", slug: "chu_phat_hai_hoi", name: "Chư Phật Hải Hội", kind: "assembly" });
	db.insert("area", { id: "a1", slug: "tam-bao", name: "TAM BẢO", subtitle: "Đại Hùng Bảo Điện", temple: "tung-lam-hoa-phuc", cover_media_id: "m1", position: 1, visible: 1 });
	db.insert("area", { id: "a2", slug: "to-duong", name: "TỔ ĐƯỜNG", subtitle: "Tổ ấn", temple: "tung-lam-hoa-phuc", cover_media_id: "m1", position: 2, visible: 1 });
	db.insert("statue", { id: "TP0001", code: "TP0001", slug: "thich-ca_tp0001", name: "ĐỨC PHẬT THÍCH CA", is_main: 1, assembly_id: "as1", image_media_id: "m1", area_id: "a1", status: "published" });
	db.insert("statue", { id: "TP0012", code: "TP0012", slug: "di-da_tp0012", name: "ĐỨC PHẬT DI ĐÀ", is_main: 1, assembly_id: "as1", image_media_id: "m1", status: "published" });
	mutate(db);
	const repo = createD1Repository(db);
	return homeGallery(await liveAreas(repo), await liveStatueRecords({ repo, links: await readStatueLinks(db) }));
}

test("dải trượt trang chủ: chữ và ảnh của D1 cho các mục V3 chọn; mục không có trong D1 không hiện", async () => {
	const g = await gallery();
	assert.deepEqual(g.areas.map((a) => a.targetUrl), ["/vu-tru-phat-giao/tam-bao", "/vu-tru-phat-giao/to-duong"]);
	assert.equal(g.areas[0].subtitle, "Đại Hùng Bảo Điện");
	assert.match(g.areas[0].imgUrl, /pics\/a\.webp$/);
	assert.deepEqual(g.statues.map((s) => s.targetUrl), ["/bao-tuong/thich-ca_tp0001", "/bao-tuong/di-da_tp0012"]);
	assert.equal(g.statues[0].cluster, "CHƯ PHẬT HẢI HỘI");
	assert.equal(g.statues[0].area, "TAM BẢO");
	assert.equal(g.statues[1].imgPosition, "center 15%");
});

test("khu vực ẩn, tượng nháp hay đã xóa biến mất khỏi dải trượt", async () => {
	const g = await gallery((db) => {
		db.exec("update area set visible = 0 where slug = 'to-duong'");
		db.exec("update statue set status = 'draft' where id = 'TP0012'");
	});
	assert.deepEqual(g.areas.map((a) => a.targetUrl), ["/vu-tru-phat-giao/tam-bao"]);
	assert.deepEqual(g.statues.map((s) => s.targetUrl), ["/bao-tuong/thich-ca_tp0001"]);
	const none = await gallery((db) => {
		db.exec("update area set deleted_at = '2026-01-01T00:00:00.000Z'");
		db.exec("update statue set deleted_at = '2026-01-01T00:00:00.000Z'");
	});
	assert.deepEqual(none, { areas: [], statues: [] });
});

test("khu vực và tượng nổi bật không còn viết cứng trong thành phần", () => {
	const code = readFileSync("src/features/home/components/GallerySection.tsx", "utf8");
	assert.doesNotMatch(code, /const FEATURED_(AREAS|STATUES)\b.*=\s*\[/);
	assert.doesNotMatch(code, /duc_phat_thich_ca_mau_ni|vu-tru-phat-giao\/tam-bao/);
});
