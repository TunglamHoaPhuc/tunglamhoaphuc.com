import { describe, expect, it } from "vitest";
import { groupResults, readSearchQuery, searchHref, searchItem, searchItems, SEARCH_SECTIONS } from "@/libs/search";

const item = (section: string, title: string, text = "", date = "") => searchItem({ section, title, text, href: `/${section}/${title}`, date });

const items = [
	item("dong-chay-hoang-phap", "Cộng tu Niệm Phật tháng 7", "Đại chúng trì danh hiệu.", "2026-07-20"),
	item("dong-chay-hoang-phap", "Pháp hội Huyết Bồn Trai", "Khóa lễ niệm Phật cầu siêu.", "2026-09-03"),
	item("tong-chi-tu-hoc", "Niệm Phật", "Phương pháp trì danh."),
	item("tri-tue-phat-phap", "Tu như trồng cây", "Tu tập là quá trình rèn luyện thân tâm.", "2025-10-05"),
	item("bao-tuong-phat-giao", "Đức Phật Thích Ca Mâu Ni", "Vô Thượng Năng Nhân · TP0001"),
	item("lich-tu-hoc", "Đại lễ Vu Lan", "Lễ báo hiếu.", "2026-08-27"),
];
const titles = (list: { title: string }[]) => list.map((entry) => entry.title);

describe("search", () => {
	it("finds the same with and without marks: “niem phat” is “niệm Phật”", () => {
		expect(titles(searchItems(items, "niem phat"))).toEqual(titles(searchItems(items, "niệm Phật")));
		expect(searchItems(items, "NIỆM PHẬT")).toHaveLength(3);
	});

	it("needs every word, wherever it is in the title or the text", () => {
		expect(titles(searchItems(items, "phật cầu siêu"))).toEqual(["Pháp hội Huyết Bồn Trai"]);
		expect(searchItems(items, "niệm phật vu lan")).toEqual([]);
	});

	it("puts the title that holds the words first, the newest first among equals", () => {
		expect(titles(searchItems(items, "niem phat"))).toEqual(["Niệm Phật", "Cộng tu Niệm Phật tháng 7", "Pháp hội Huyết Bồn Trai"]);
	});

	it("among titles that match alike, puts the newest first", () => {
		const vuLan = [item("dong-chay-hoang-phap", "Đại lễ Vu Lan 2024", "", "2024-08-18"), item("dong-chay-hoang-phap", "Đại lễ Vu Lan 2026", "", "2026-08-27")];
		expect(titles(searchItems(vuLan, "vu lan"))).toEqual(["Đại lễ Vu Lan 2026", "Đại lễ Vu Lan 2024"]);
	});

	it("matches whole words: “co” is not inside “Cộng”, nor “tu” inside “tượng”", () => {
		expect(titles(searchItems(items, "co"))).toEqual([]);
		expect(titles(searchItems(items, "cong tu"))).toEqual(["Cộng tu Niệm Phật tháng 7"]);
		expect(titles(searchItems([item("bao-tuong-phat-giao", "Tôn tượng")], "tu"))).toEqual([]);
	});

	it("finds a statue by its code", () => {
		expect(titles(searchItems(items, "tp0001"))).toEqual(["Đức Phật Thích Ca Mâu Ni"]);
	});

	it("finds nothing for an empty query, nor for marks and signs alone", () => {
		expect(searchItems(items, "")).toEqual([]);
		expect(searchItems(items, " – ? ")).toEqual([]);
	});

	it("groups the results by section, in the order of the site's sections", () => {
		const groups = groupResults(searchItems(items, "phat"));
		expect(groups.map((group) => [group.section.slug, group.items.length])).toEqual([
			["dong-chay-hoang-phap", 2],
			["tong-chi-tu-hoc", 1],
			["bao-tuong-phat-giao", 1],
		]);
		expect(SEARCH_SECTIONS.map((section) => section.slug)).toContain("lich-tu-hoc");
	});

	it("reads and writes its query on the URL, leaving out what is empty", () => {
		const query = readSearchQuery({ q: "  niệm   Phật ", muc: "tong-chi-tu-hoc", trang: "2" });
		expect(query).toEqual({ q: "niệm Phật", section: "tong-chi-tu-hoc", page: 2 });
		expect(searchHref(query)).toBe("/tim-kiem?q=ni%E1%BB%87m+Ph%E1%BA%ADt&muc=tong-chi-tu-hoc&trang=2");
		expect(searchHref({ q: "vu lan", section: "", page: 1 })).toBe("/tim-kiem?q=vu+lan");
		expect(readSearchQuery({ muc: "khong-co", trang: "-1" })).toEqual({ q: "", section: "", page: 1 });
		expect(readSearchQuery({ q: "x".repeat(300) }).q).toHaveLength(100);
	});
});
