// V4b (khu vực): the list, the 2D map, "Khám phá khu vực khác" and the navigation panel show the areas D1 holds as visible;
// a hidden or deleted area has no card, no pin and no menu entry, and no hand-written page can answer for it.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { MAP_PINS, mapSpotsOf } from "@/lib/v3-areas";
import { liveAreas } from "@/lib/v3-live";
import { liveStatueRecords, NO_LINKS } from "@/lib/v3-statues";
import { createFakeD1 } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	db.insert("media", { id: "m1", r2_key: "areas/cover.webp", url: null });
	db.insert("category", { id: "as1", slug: "chu_phat_hai_hoi", name: "Chư Phật Hải Hội", kind: "assembly" });
	const area = (row: Record<string, unknown>) => db.insert("area", { temple: "tung-lam-hoa-phuc", cover_media_id: "m1", visible: 1, ...row });
	area({ id: "a1", slug: "to-duong", name: "TỔ ĐƯỜNG", subtitle: "Tổ ấn trùng quang", position: 1, intro: "Giới thiệu tổ đường." });
	area({ id: "a2", slug: "tam-bao", name: "TAM BẢO", subtitle: "Đại hùng bảo điện", position: 2 });
	area({ id: "a3", slug: "giang-duong", name: "GIẢNG ĐƯỜNG", position: 3, visible: 0 });
	area({ id: "a4", slug: "khu-moi", name: "KHU MỚI", position: 4, map_x: 20, map_y: 30 });
	area({ id: "a5", slug: "khu-chua-dat-ghim", name: "KHU CHƯA ĐẶT GHIM", position: 5 });
	area({ id: "a6", slug: "da-xoa", name: "ĐÃ XÓA", position: 6, deleted_at: "2026-01-01T00:00:00.000Z" });
	db.insert("statue", { id: "TP1", code: "TP1", slug: "tuong-1", name: "TƯỢNG MỘT", is_main: 1, assembly_id: "as1", image_media_id: "m1", area_id: "a2", area_code: "tam_bao", status: "published" });
	return db;
}

const spots = async () => {
	const db = seed();
	const repo = createD1Repository(db);
	return mapSpotsOf(await liveAreas(repo), await liveStatueRecords({ repo, links: NO_LINKS }));
};

test("sơ đồ: chỉ khu vực đang hiển thị, theo thứ tự sơ đồ, đánh số từ 1; khu vực ẩn và đã xóa không có ghim", async () => {
	const list = await spots();
	assert.deepEqual(
		list.map((s) => [s.number, s.slug]),
		[
			[1, "to-duong"],
			[2, "tam-bao"],
			[3, "khu-moi"],
		],
	);
	assert.equal(list.some((s) => s.slug === "giang-duong" || s.slug === "da-xoa"), false);
});

test("sơ đồ: vị trí ghim của bảng thiết kế; khu vực mới theo mapPos admin đặt; chưa đặt thì không lên sơ đồ", async () => {
	const list = await spots();
	const pin = (slug: string) => MAP_PINS.find((p) => p.slug === slug);
	assert.deepEqual(list[0].mapPos, { x: pin("to-duong")?.x, y: pin("to-duong")?.y });
	assert.deepEqual(list[2].mapPos, { x: 20, y: 30 });
	assert.equal(list.some((s) => s.slug === "khu-chua-dat-ghim"), false);
});

test("sơ đồ: tên, phụ đề, ảnh, giới thiệu từ D1; tượng chính của khu vực từ D1; không có lời trích đóng gói", async () => {
	const [first, second] = await spots();
	assert.equal(first.name, "TỔ ĐƯỜNG");
	assert.equal(first.subtitle, "TỔ ẤN TRÙNG QUANG");
	assert.equal(first.description, "Giới thiệu tổ đường.");
	assert.match(first.imgUrl, /areas\/cover\.webp$/);
	assert.equal(first.quote, "");
	assert.deepEqual(first.statues, []);
	assert.deepEqual(second.statues.map((s) => s.name), ["TƯỢNG MỘT"]);
});

test("lưới và thẻ khu vực dùng danh sách D1: khu vực ẩn không có trong liveAreas", async () => {
	const areas = await liveAreas(createD1Repository(seed()));
	assert.deepEqual(areas.map((a) => a.slug), ["to-duong", "tam-bao", "khu-moi", "khu-chua-dat-ghim"]);
});

test("không còn trang khu vực viết tay che đường dẫn của trang D1", () => {
	const dir = "src/app/(public)/vu-tru-phat-giao";
	const subdirs = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
	assert.deepEqual(subdirs, ["[slug]"], "mọi khu vực đi qua [slug], nơi kiểm tra khu vực còn hiển thị");
	assert.equal(existsSync(`${dir}/tam-bao/page.tsx`), false);
});

test("danh sách, sơ đồ, khám phá khu vực khác và bảng điều hướng không nhập khu vực đóng gói", () => {
	const files = [
		"src/app/(public)/vu-tru-phat-giao/page.tsx",
		"src/app/(public)/vu-tru-phat-giao/VuTruPhatGiaoClient.tsx",
		"src/app/(public)/vu-tru-phat-giao/[slug]/page.tsx",
		"src/app/(public)/vu-tru-phat-giao/[slug]/AreaDetailClient.tsx",
		"src/features/universe/components/UniverseGridMode.tsx",
		"src/features/universe/components/OtherAreasSection.tsx",
		"src/features/universe/components/InteractiveMap2D.tsx",
		"src/features/universe/components/SpaceGallerySection.tsx",
		"src/components/tong-chi-tu-hoc/NavDropdownPanel.tsx",
		"src/lib/v3-areas.ts",
		"src/lib/v3-chrome.ts",
	];
	for (const file of files) assert.doesNotMatch(readFileSync(file, "utf8"), /@\/data\/universe-data|UNIVERSE_AREAS|MAP_SPOTS_15/, file);
});
