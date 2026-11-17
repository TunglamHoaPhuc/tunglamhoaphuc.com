import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { vuTru } from "@/config/vuTru";
import { parseStatues } from "@/libs/content/baoTuong";
import { parseAreas } from "@/libs/content/vuTru";
import { areaCover, statuesIn, templeAreas } from "@/libs/vuTru";

const area = (extra: Record<string, unknown>) => ({
	id: 1,
	pinNumber: 1,
	slug: "tam-bao",
	name: "TAM BẢO",
	subtitle: "ĐẠI HÙNG BẢO ĐIỆN",
	temple: "tung-lam-hoa-phuc",
	imgUrl: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp",
	mapPos: { x: 58, y: 52 },
	description: "Tam Bảo là nơi tôn thờ Đức Phật Bổn Sư Thích Ca Mâu Ni.",
	fullContent: "• Tiền đường: Tôn trí tượng 7 vị Phật Dược Sư.\n• Chính điện: Tôn thờ tượng Đức Phật Thích Ca Mâu Ni.",
	statues: [],
	stories: [],
	...extra,
});

const statue = (extra: Record<string, unknown>) => ({
	id: "TP0001",
	code: "TP0001",
	slug: "duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001",
	name: "ĐỨC PHẬT THÍCH CA MÂU NI",
	subtitle: "Vô Thượng Năng Nhân",
	categoryType: "TƯỢNG CHÍNH",
	areaSlug: "tam_bao",
	avatarUrl: "https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/a.webp",
	imgPosition: "center 20%",
	...extra,
});

describe("Vũ Trụ Phật Giáo file", () => {
	it("reads the areas, names out of capitals, the text kept apart from the intro", () => {
		const { areas } = parseAreas({
			success: true,
			count: 2,
			areas: [area({}), area({ id: 2, slug: "to-duong", name: "TỔ ĐƯỜNG", description: "Tổ đường.", fullContent: " Tổ đường. ", mapPos: null })],
		});
		expect(areas.map((item) => [item.slug, item.name, item.subtitle])).toEqual([
			["tam-bao", "Tam Bảo", "Đại Hùng Bảo Điện"],
			["to-duong", "Tổ Đường", "Đại Hùng Bảo Điện"],
		]);
		expect(areas[0]).toMatchObject({ mapPos: { x: 58, y: 52 }, intro: "Tam Bảo là nơi tôn thờ Đức Phật Bổn Sư Thích Ca Mâu Ni." });
		expect(areas[0].contentHtml).toBe("<ul><li>Tiền đường: Tôn trí tượng 7 vị Phật Dược Sư.</li><li>Chính điện: Tôn thờ tượng Đức Phật Thích Ca Mâu Ni.</li></ul>");
		// The same text in both fields is shown once.
		expect(areas[1]).toMatchObject({ mapPos: null, contentHtml: "" });
	});

	it("reads the statues, main or art, each at its old address", () => {
		const { statues, issues } = parseStatues({
			success: true,
			statues: [
				statue({}),
				statue({ id: "TP0002", code: "TP0002", slug: "duc_phat_chuyen_phap_luan_tp0002", categoryType: "NTPG", areaSlug: "san_di_da" }),
				statue({ id: "x", code: "", slug: "duc_phat_phap_hai_loi_am_nhu_lai", name: "ĐỨC PHẬT PHÁP HẢI LÔI ÂM NHƯ LAI" }),
				statue({ id: "TP0009", code: "TP0009", slug: "sai_duoi" }),
			],
		});
		expect(statues.map((item) => [item.name, item.main, item.href])).toEqual([
			["Đức Phật Thích Ca Mâu Ni", true, "/bao-tuong/duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001"],
			["Đức Phật Thích Ca Mâu Ni", false, "/bao-tuong/duc_phat_chuyen_phap_luan_tp0002"],
			["Đức Phật Pháp Hải Lôi Âm Như Lai", true, "/bao-tuong/duc_phat_phap_hai_loi_am_nhu_lai"],
			["Đức Phật Thích Ca Mâu Ni", true, "/bao-tuong/sai_duoi"],
		]);
		expect(statues[0].image).toEqual({ src: "/anh-goc/media-tunglamhoaphuc/a.webp", position: "center 20%" });
		expect(issues.map((issue) => issue.message)).toEqual(['slug "sai_duoi" không kết thúc bằng mã TP0009', "Đức Phật Pháp Hải Lôi Âm Như Lai"]);
	});
});

describe("the temple map", () => {
	it("numbers the temple's areas in the map's order, pins at the map's places, newcomers last at their own", () => {
		const { areas } = parseAreas([
			area({ slug: "tam-bao" }),
			area({ id: 99, slug: "khu-moi", name: "KHU MỚI", mapPos: { x: 10, y: 10 } }),
			area({ id: 3, slug: "ho-phong-sinh", name: "LẦU KINH LUÂN" }),
			area({ id: 4, slug: "chua-khac", temple: "quynh-nhai-cam-lo-tu" }),
		]);
		expect(templeAreas(areas).map((item) => [item.number, item.slug, item.pin])).toEqual([
			[1, "ho-phong-sinh", { x: 6, y: 46 }],
			[2, "tam-bao", { x: 50, y: 49 }],
			[3, "khu-moi", { x: 10, y: 10 }],
		]);
	});

	it("finds an area's statues through the Bảo Tượng file's own area names", () => {
		const { areas } = parseAreas([area({ slug: "ho-phong-sinh" })]);
		const { statues } = parseStatues([
			statue({ areaSlug: "lau_kinh_luan" }),
			statue({ id: "TP0002", areaSlug: "lau_kinh_luan", categoryType: "NTPG" }),
			statue({ id: "TP0003", areaSlug: "cong_thap" }),
		]);
		const found = statuesIn(areas[0], statues);
		expect([found.main.map((item) => item.id), found.art.map((item) => item.id)]).toEqual([["TP0001"], ["TP0002"]]);
	});

	it("shows all 14 areas of the real data, and Tam Bảo's 20 main statues the old site links to", () => {
		if (!existsSync("data/snapshot/vu-tru.json") || !existsSync("data/snapshot/bao-tuong.json")) return;
		const areas = templeAreas(parseAreas(JSON.parse(readFileSync("data/snapshot/vu-tru.json", "utf8"))).areas);
		expect(areas).toHaveLength(14);
		expect(areas.every((item) => item.pin)).toBe(true);
		expect(areas.map((item) => item.slug)).toEqual(vuTru.pins.map((pin) => pin.slug));
		const { statues } = parseStatues(JSON.parse(readFileSync("data/snapshot/bao-tuong.json", "utf8")));
		const tamBao = statuesIn(areas.find((item) => item.slug === "tam-bao")!, statues);
		expect(tamBao.main).toHaveLength(20);
		expect(tamBao.main.map((item) => item.href)).toContain("/bao-tuong/duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001");
		expect(tamBao.main.map((item) => item.href)).toContain("/bao-tuong/su_to_ngo_chan_tu_khai_sang_to_dinh_hoang_phap_tp0061");
		for (const item of statues.filter((one) => one.code)) expect(item.href, item.id).toMatch(new RegExp(`^/bao-tuong/[a-z0-9_]+_${item.code.toLowerCase()}$`));
	});
});

describe("an area's picture", () => {
	it("is its own from the old site's set, not the admin's stand-in", () => {
		// The admin gives the library a book cover and four areas the same view of the temple.
		const admin = { src: "/anh-goc/s2-cnv03/tunglamhoaphuc2/08-tu-an-book/di-qua-kho-vui-cuoc-doi-bia-1.webp", position: "center 20%" };
		expect(areaCover({ slug: "tang-kinh-cac", cover: admin })?.src).toMatch(/04-vu-tru-phat-giao\/khu-vuc\/tang-kinh-cac-v2\.webp$/);
		expect(areaCover({ slug: "bao-thap-van-phat-xa-loi", cover: null })?.src).toMatch(/khu-vuc\/bao-thap\.webp$/);
		expect(areaCover({ slug: "ho-phong-sinh", cover: admin })?.src).toMatch(/khu-vuc\/lau-kinh-luan\.webp$/);
	});

	it("is the admin's for an area the set does not know", () => {
		const admin = { src: "/anh-goc/s2-cnv03/x.webp", position: "center 20%" };
		expect(areaCover({ slug: "khu-moi", cover: admin })).toEqual(admin);
		expect(areaCover({ slug: "khu-moi", cover: null })).toBeNull();
	});

	it("has a picture for every pin of the map, each a different file", () => {
		const files = vuTru.pins.map((pin) => vuTru.covers[pin.slug]);
		expect(files.every(Boolean)).toBe(true);
		expect(new Set(files).size).toBe(files.length);
	});
});
