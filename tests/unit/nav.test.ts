import { describe, expect, it } from "vitest";
import { formatPhone, site } from "@/config/site";
import { isCurrentItem, isCurrentLink } from "@/libs/nav";

describe("isCurrentLink", () => {
	it("matches the page and the pages below it", () => {
		expect(isCurrentLink("/lich-tu-hoc", { label: "", href: "/lich-tu-hoc" })).toBe(true);
		expect(isCurrentLink("/dong-chay-hoang-phap/vu-lan", { label: "", href: "/dong-chay-hoang-phap" })).toBe(true);
	});

	it("does not match a page that only shares a prefix", () => {
		expect(isCurrentLink("/gioi-thieu-khac", { label: "", href: "/gioi-thieu" })).toBe(false);
	});

	it("never marks links to a section of a page", () => {
		expect(isCurrentLink("/lich-tu-hoc", { label: "", href: "/lich-tu-hoc#khoa-tu" })).toBe(false);
	});

	it("matches the home link only on the home page", () => {
		expect(isCurrentLink("/", { label: "", href: "/" })).toBe(true);
		expect(isCurrentLink("/lien-he", { label: "", href: "/" })).toBe(false);
	});
});

describe("isCurrentItem", () => {
	const about = site.nav.find((item) => item.label === "Giới thiệu")!;

	it("marks a dropdown when one of its pages is open", () => {
		expect(isCurrentItem("/bao-tuong-phat-giao", about)).toBe(true);
		expect(isCurrentItem("/lien-he", about)).toBe(false);
	});
});

describe("site config", () => {
	it("has the five agreed menu items in order", () => {
		expect(site.nav.map((item) => item.label)).toEqual(["Giới thiệu", "Tin tức – Pháp thoại", "Lịch tu học", "Đăng ký khóa tu", "Liên hệ"]);
	});

	it("keeps every phone number at 10 digits starting with 0", () => {
		for (const phone of [site.phone, ...site.contacts.map((c) => c.phone)]) expect(phone).toMatch(/^0\d{9}$/);
	});

	it("formats numbers the way the temple writes them", () => {
		expect(formatPhone("0979345373")).toBe("0979.345.373");
	});
});
