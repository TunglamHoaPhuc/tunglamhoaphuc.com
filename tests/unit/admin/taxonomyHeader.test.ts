import { describe, expect, it } from "vitest";
import { ICON_LIBRARY } from "../../../src/admin/icons/library";
import { librarySvg } from "../../../src/admin/icons/render";
import { site } from "../../../src/config/site";
import { loadHeaderNav } from "../../../src/components/layout/header/headerNav";
import { isInlineSvg, menuToNav } from "../../../src/components/layout/header/menuNav";
import { applyMigrations, asD1, openDatabase } from "../../../src/db/nodeSqlite";
import { readMenu, type MenuNode } from "../../../src/libs/siteData";

const node = (id: string, label: string, over: Partial<MenuNode> = {}): MenuNode => ({
	id,
	label,
	href: `/${id}`,
	openNewTab: false,
	icon: { type: "none", name: "", svg: "", url: "", color: "" },
	children: [],
	...over,
});

const none = () => null;

describe("the seeded header menu", () => {
	it("maps to exactly what site.nav draws today (labels, addresses, icon pictures, two levels)", async () => {
		const db = openDatabase();
		applyMigrations(db);
		const nodes = (await readMenu(asD1(db), "header")) as MenuNode[];
		const strip = (items: { label: string; href: string; image?: string; children?: unknown[] }[]): unknown[] =>
			items.map((item) => ({ label: item.label, href: item.href, image: item.image, children: item.children ? strip(item.children as never) : undefined }));
		expect(strip(menuToNav(nodes, none))).toEqual(strip(site.nav as never));
	});

	it("loadHeaderNav gives null where the site does not read the menu from D1, so the header keeps site.nav", async () => {
		expect(await loadHeaderNav()).toBeNull();
	});
});

describe("menuToNav", () => {
	it("makes a dropdown of an item with children, a plain link of one without, and leaves out the third level", () => {
		const nav = menuToNav(
			[
				node("a", "A", { children: [node("a1", "A1", { children: [node("a11", "A11")] }), node("a2", "A2")] }),
				node("b", "B"),
			],
			none,
		);
		expect(nav.map((item) => item.label)).toEqual(["A", "B"]);
		expect(nav[0].children?.map((child) => child.label)).toEqual(["A1", "A2"]);
		expect(JSON.stringify(nav)).not.toContain("A11");
		expect(nav[1].children).toBeUndefined();
		expect(nav[0].id).toBe("a");
	});

	it("keeps the order it was given and marks items that open in a new tab", () => {
		const nav = menuToNav([node("z", "Z", { openNewTab: true, href: "https://example.test/x" }), node("y", "Y")], none);
		expect(nav.map((item) => item.id)).toEqual(["z", "y"]);
		expect(nav[0]).toMatchObject({ newTab: true, href: "https://example.test/x" });
		expect(nav[1].newTab).toBeUndefined();
	});

	it("an image icon is drawn from its address, but only a path on the site or an https address", () => {
		const icon = (url: string) => node("i", "I", { icon: { type: "image", name: "", svg: "", url, color: "" } });
		expect(menuToNav([icon("/brand/a.webp")], none)[0].image).toBe("/brand/a.webp");
		expect(menuToNav([icon("https://cdn.example.test/a.png")], none)[0].image).toBe("https://cdn.example.test/a.png");
		for (const bad of ["", "//evil.test/a.png", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "http://insecure.test/a.png"]) {
			expect(menuToNav([icon(bad)], none)[0].image, bad).toBeUndefined();
		}
	});

	it("a library icon is looked up by name, fitted to its chip and given its colour; an unknown name draws the gold dot", () => {
		const library = (name: string, color = "#835414") => node("l", "L", { icon: { type: "library", name, svg: "", url: "", color } });
		const [item] = menuToNav([library("church")], librarySvg);
		expect(item.svg).toMatch(/^<svg [^>]*width="100%" height="100%"/);
		expect(item.svg).toContain(ICON_LIBRARY.find((icon) => icon.name === "church")!.body.slice(0, 30));
		expect(item.iconColor).toBe("#835414");
		const unknown = menuToNav([library("khong-co")], librarySvg)[0];
		expect(unknown.svg).toBeUndefined();
		expect(unknown.image).toBeUndefined();
		expect(menuToNav([library("church", "red")], librarySvg)[0].iconColor).toBeUndefined();
	});

	it("an uploaded svg is drawn only when it is svg markup from the server: anything else is dropped", () => {
		const svg = (markup: string) => node("s", "S", { icon: { type: "svg", name: "", svg: markup, url: "", color: "" } });
		const good = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" width="9"><path d="M0 0h4"/></svg>';
		expect(menuToNav([svg(good)], none)[0].svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" width="100%" height="100%" aria-hidden="true" focusable="false"><path d="M0 0h4"/></svg>');
		for (const bad of ["", "<img src=x onerror=alert(1)>", "<div><svg/></div>", '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>', '<svg onload="alert(1)" viewBox="0 0 1 1"/>']) {
			expect(menuToNav([svg(bad)], none)[0].svg, bad).toBeUndefined();
		}
		expect(isInlineSvg(undefined)).toBe(false);
		expect(isInlineSvg(good)).toBe(true);
	});

	it("an item without an icon has none of the icon fields (the header draws the gold dot)", () => {
		const [item] = menuToNav([node("n", "N")], none);
		expect(item.image).toBeUndefined();
		expect(item.svg).toBeUndefined();
	});
});
