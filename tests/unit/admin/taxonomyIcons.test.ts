import { describe, expect, it } from "vitest";
import { ICON_LIBRARY } from "../../../src/admin/icons/library";
import { librarySvg, searchIcons } from "../../../src/admin/icons/render";
import { sanitizeSvg, SvgRejected } from "../../../src/admin/icons/sanitize";
import { taxonomyWorld } from "../helpers/taxonomyWorld";

const clean = (svg: string) => sanitizeSvg(svg);

describe("the SVG sanitizer (allow-list)", () => {
	it("keeps a plain icon and writes it out again with the standard namespace", () => {
		const out = clean('<?xml version="1.0"?><!-- c --><svg viewBox="0 0 24 24" fill="none" stroke="#835414" stroke-width="2"><path d="M4 12h16" stroke-linecap="round"/><circle cx="12" cy="12" r="3"/></svg>');
		expect(out).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#835414" stroke-width="2"><path d="M4 12h16" stroke-linecap="round"/><circle cx="12" cy="12" r="3"/></svg>');
	});

	it("drops scripts, event handlers, links, styles, use, foreignObject, animation and images", () => {
		const out = clean(
			`<svg viewBox="0 0 10 10" onload="alert(1)" style="x:y" xmlns:xlink="http://www.w3.org/1999/xlink">
				<script>if (1 < 2) alert("x")</script>
				<style>*{fill:red}</style>
				<foreignObject><div onclick="x()">hi</div></foreignObject>
				<use href="#a" xlink:href="data:text/html,x"/>
				<image href="https://evil.test/a.png"/>
				<a href="javascript:alert(1)"><path d="M0 0h5"/></a>
				<animate attributeName="x"/><set to="1"/>
				<path d="M0 0L5 5" onclick="alert(1)" href="javascript:1" class="a" id="b"/>
			</svg>`,
		);
		expect(out).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L5 5"/></svg>');
		expect(out).not.toMatch(/script|onload|onclick|href|style|foreign|image|animate|use/i);
	});

	it("drops colours and values that are not on the list instead of repairing them", () => {
		const out = clean(
			'<svg viewBox="0 0 10 10"><path d="M0 0" fill="url(#x)" stroke="javascript:alert(1)"/><rect x="1" y="1" width="5" height="5" fill="red" stroke="rgb(1, 2, 3)" opacity="2" transform="translate(1 2) rotate(45)"/><path d="M0 0 <script>" fill="#12"/><line x1="1" y1="1" x2="9" y2="9" stroke="expression(1)"/><circle cx="5" cy="5" r="calc(1+1)" fill="&#x6A;avascript:"/></svg>',
		);
		expect(out).toContain('<path d="M0 0"/>');
		expect(out).toContain('<rect x="1" y="1" width="5" height="5" fill="red" stroke="rgb(1, 2, 3)" transform="translate(1 2) rotate(45)"/>');
		expect(out).toContain("<line x1=\"1\" y1=\"1\" x2=\"9\" y2=\"9\"/>");
		expect(out).toContain("<circle cx=\"5\" cy=\"5\"/>");
		expect(out).not.toMatch(/opacity|url\(|javascript|expression|calc|script/);
	});

	it("keeps a title as text and escapes it", () => {
		expect(clean('<svg viewBox="0 0 4 4"><title>Chùa &amp; <b>x</b>Phúc</title><path d="M0 0"/></svg>')).toContain("<title>Chùa &amp;amp; Phúc</title>");
	});

	it("uses width and height as the view box when there is none, and refuses when it has neither", () => {
		expect(clean('<svg width="32" height="16"><path d="M0 0h5"/></svg>')).toContain('viewBox="0 0 32 16"');
		expect(() => clean('<svg><path d="M0 0h5"/></svg>')).toThrow(SvgRejected);
		expect(() => clean('<svg viewBox="0 0 0 0"><path d="M0 0"/></svg>')).toThrow(SvgRejected);
	});

	it("refuses what is not one valid <svg> root", () => {
		for (const bad of ["", "   ", "hello", "<div>x</div>", "<svg viewBox='0 0 1 1'>", "<svg viewBox='0 0 1 1'><path d='M0 0'></g></svg>", "<svg viewBox='0 0 1 1'/><svg viewBox='0 0 1 1'/>", "<![CDATA[x]]><svg viewBox='0 0 1 1'/>", '<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 1 1"/>', "<svg viewBox='0 0 1 1'><path d='M0 0' <"]) {
			expect(() => clean(bad), JSON.stringify(bad)).toThrow(SvgRejected);
		}
	});

	it("drops a nested <svg> with what is inside it, and refuses more than 50 KB", () => {
		expect(clean('<svg viewBox="0 0 4 4"><svg viewBox="0 0 1 1"><path d="M9 9"/></svg><path d="M0 0"/></svg>')).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M0 0"/></svg>');
		const big = `<svg viewBox="0 0 4 4"><path d="${"M0 0".repeat(13_000)}"/></svg>`;
		expect(() => clean(big)).toThrow(/50 KB/);
	});

	it("limits how deep and how large a drawing may be", () => {
		expect(() => clean(`<svg viewBox="0 0 4 4">${"<g>".repeat(30)}${"</g>".repeat(30)}</svg>`)).toThrow(SvgRejected);
		expect(() => clean(`<svg viewBox="0 0 4 4">${'<path d="M0 0"/>'.repeat(700)}</svg>`)).toThrow(SvgRejected);
	});
});

describe("the icon library", () => {
	it("holds at least 150 icons in under 100 KB, every one drawable", () => {
		expect(ICON_LIBRARY.length).toBeGreaterThanOrEqual(150);
		expect(JSON.stringify(ICON_LIBRARY).length).toBeLessThan(100 * 1024);
		for (const icon of ICON_LIBRARY) {
			const svg = librarySvg(icon.name) as string;
			expect(sanitizeSvg(svg), icon.name).toContain("<svg");
		}
	});

	it("searches names and Vietnamese words, ignoring accents and case", () => {
		expect(searchIcons("chùa").map((hit) => hit.name)).toContain("church");
		expect(searchIcons("CHUA").map((hit) => hit.name)).toContain("church");
		expect(searchIcons("lich thang").map((hit) => hit.name)).toContain("calendar");
		expect(searchIcons("calendar").length).toBeGreaterThan(1);
		expect(searchIcons("khong-co-icon-nao-nhu-vay")).toEqual([]);
		expect(searchIcons("", 10)).toHaveLength(10);
	});

});

describe("icon endpoints", () => {
	it("GET icons answers any signed-in person, GET icons needs a session", async () => {
		const w = await taxonomyWorld();
		const author = await w.as("author@example.test");
		const found = await author.call("GET", "icons?q=chua");
		expect(found.status).toBe(200);
		expect(found.data.map((hit: { name: string }) => hit.name)).toContain("church");
		expect(found.data[0].svg).toMatch(/^<svg /);
		expect((await w.client().call("GET", "icons?q=chua")).status).toBe(401);
	});

	it("POST icons/sanitize-svg returns the cleaned svg, and 400 for what cannot be cleaned", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		const ok = await editor.call("POST", "icons/sanitize-svg", { svg: '<svg viewBox="0 0 8 8" onload="x()"><script>1</script><path d="M0 0h8"/></svg>' });
		expect(ok.status).toBe(200);
		expect(ok.data.svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8"/></svg>');
		const bad = await editor.call("POST", "icons/sanitize-svg", { svg: "<div/>" });
		expect(bad.status).toBe(400);
		expect(bad.error.code).toBe("invalid_svg");
		expect((await editor.call("POST", "icons/sanitize-svg", {})).status).toBe(400);
	});

	it("POST icons/sanitize-svg is for people who may edit menus or categories: an Author gets 403", async () => {
		const w = await taxonomyWorld();
		const author = await w.as("author@example.test");
		expect((await author.call("POST", "icons/sanitize-svg", { svg: '<svg viewBox="0 0 8 8"/>' })).status).toBe(403);
	});
});
