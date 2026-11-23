// Ghim trên sơ đồ 2D: vị trí admin đặt (map_x, map_y) thắng bảng ghim đóng gói; chưa đặt thì dùng bảng; không có cả hai thì không lên sơ đồ.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { MAP_PINS, mapSpotsOf } from "@/lib/v3-areas";
import { liveAreas } from "@/lib/v3-live";
import { createFakeD1 } from "../helpers/d1";

async function spots(rows: Record<string, unknown>[]) {
	const db = createFakeD1();
	db.insert("media", { id: "m1", r2_key: "areas/cover.webp", url: null });
	rows.forEach((row, index) => db.insert("area", { temple: "tung-lam-hoa-phuc", cover_media_id: "m1", visible: 1, position: index + 1, ...row }));
	return mapSpotsOf(await liveAreas(createD1Repository(db)), []);
}

const pin = (slug: string) => {
	const found = MAP_PINS.find((p) => p.slug === slug);
	assert.ok(found, slug);
	return { x: found.x, y: found.y };
};

test("khu vực có trong bảng ghim mà admin đã đặt vị trí: lấy vị trí của admin", async () => {
	const [spot] = await spots([{ id: "a1", slug: "tam-bao", name: "TAM BẢO", map_x: 12.5, map_y: 87.25 }]);
	assert.deepEqual(spot.mapPos, { x: 12.5, y: 87.25 });
});

test("khu vực có trong bảng ghim mà admin chưa đặt (hoặc mới đặt một nửa): lấy vị trí của bảng", async () => {
	const list = await spots([
		{ id: "a1", slug: "tam-bao", name: "TAM BẢO" },
		{ id: "a2", slug: "to-duong", name: "TỔ ĐƯỜNG", map_x: 30 },
		{ id: "a3", slug: "giang-duong", name: "GIẢNG ĐƯỜNG", map_y: 40 },
	]);
	const at = (slug: string) => list.find((s) => s.slug === slug)?.mapPos;
	assert.deepEqual(at("tam-bao"), pin("tam-bao"));
	assert.deepEqual(at("to-duong"), pin("to-duong"));
	assert.deepEqual(at("giang-duong"), pin("giang-duong"));
});

test("vị trí 0 do admin đặt là vị trí thật (không bị coi là chưa đặt)", async () => {
	const [spot] = await spots([{ id: "a1", slug: "tam-bao", name: "TAM BẢO", map_x: 0, map_y: 0 }]);
	assert.deepEqual(spot.mapPos, { x: 0, y: 0 });
});

test("khu vực mới: theo admin; không có vị trí nào thì không lên sơ đồ; thứ tự đi theo bảng, khu vực mới ở cuối", async () => {
	const list = await spots([
		{ id: "a1", slug: "khu-moi", name: "KHU MỚI", map_x: 20, map_y: 30 },
		{ id: "a2", slug: "khu-chua-dat", name: "CHƯA ĐẶT" },
		{ id: "a3", slug: "tam-bao", name: "TAM BẢO", map_x: 5, map_y: 6 },
		{ id: "a4", slug: "to-duong", name: "TỔ ĐƯỜNG" },
	]);
	assert.deepEqual(list.map((s) => [s.number, s.slug]), [[1, "to-duong"], [2, "tam-bao"], [3, "khu-moi"]]);
	assert.deepEqual(list[1].mapPos, { x: 5, y: 6 });
});
