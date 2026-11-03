import { describe, expect, it } from "vitest";
import { dateBadge, formatDate, formatNumber } from "@/libs/format";
import { DEFAULT_SORT, listHref, pageWindow, readListState, sortOf } from "@/libs/postList";

describe("readListState", () => {
	it("reads category, sort and page from the query string", () => {
		expect(readListState({ "danh-muc": "cong-tu", "sap-xep": "a-z", trang: "3" })).toEqual({ category: "cong-tu", sort: "a-z", page: 3 });
		expect(sortOf(readListState({ "sap-xep": "cu-nhat" }))).toBe("oldest");
	});

	it("falls back to the defaults for missing or odd values", () => {
		expect(readListState({})).toEqual({ category: "", sort: DEFAULT_SORT, page: 1 });
		for (const trang of ["0", "-2", "abc", "", undefined]) expect(readListState({ trang }).page).toBe(1);
		expect(readListState({ "sap-xep": "random" }).sort).toBe(DEFAULT_SORT);
		expect(readListState({ "danh-muc": ["cong-tu", "x"], trang: ["2"] })).toMatchObject({ category: "cong-tu", page: 2 });
	});
});

describe("listHref", () => {
	const path = "/dong-chay-hoang-phap";

	it("leaves defaults out, so the plain list keeps its bare address", () => {
		expect(listHref(path, { category: "", sort: DEFAULT_SORT, page: 1 })).toBe(path);
		expect(listHref(path, { category: "cong-tu", sort: "z-a", page: 2 })).toBe(`${path}?danh-muc=cong-tu&sap-xep=z-a&trang=2`);
	});

	it("round-trips with readListState", () => {
		const state = { category: "dai-le-su-kien", sort: "cu-nhat", page: 4 };
		const query = Object.fromEntries(new URLSearchParams(listHref(path, state).split("?")[1]));
		expect(readListState(query)).toEqual(state);
	});
});

describe("pageWindow", () => {
	it("shows the ends and the neighbours of the current page", () => {
		expect(pageWindow(1, 1)).toEqual([1]);
		expect(pageWindow(1, 5)).toEqual([1, 2, null, 5]);
		expect(pageWindow(5, 40)).toEqual([1, null, 4, 5, 6, null, 40]);
		expect(pageWindow(40, 40)).toEqual([1, null, 39, 40]);
		// A single hidden page is shown instead of "…".
		expect(pageWindow(4, 40)).toEqual([1, 2, 3, 4, 5, null, 40]);
		expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
	});
});

describe("format", () => {
	it("writes dates and numbers the Vietnamese way", () => {
		expect(formatDate("2026-10-07")).toBe("07/10/2026");
		expect(dateBadge("2026-03-07")).toEqual({ day: "07", month: "Th3" });
		expect(formatNumber(35404)).toBe("35.404");
	});
});
