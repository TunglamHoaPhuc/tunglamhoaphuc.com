import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../../../src/admin/content/html";

describe("sanitiser keeps editor formatting (strict style allow-list)", () => {
	it("keeps alignment, line height, indent on blocks", () => {
		expect(sanitizeHtml('<p style="text-align: center; line-height: 1.5; margin-left: 2em">x</p>')).toBe('<p style="text-align: center; line-height: 1.5; margin-left: 2em">x</p>');
	});
	it("keeps colour, size, family, highlight, sub and sup", () => {
		const out = sanitizeHtml('<p><span style="color: #b00020; font-size: 20px; font-family: Georgia, \'Times New Roman\', serif">a</span><mark style="background-color: #ffeb3b">b</mark>H<sub>2</sub>O<sup>3</sup></p>');
		expect(out).toContain('<span style="color: #b00020; font-size: 20px; font-family: Georgia, \'Times New Roman\', serif">a</span>');
		expect(out).toContain('<mark style="background-color: #ffeb3b">b</mark>');
		expect(out).toContain("<sub>2</sub>");
		expect(out).toContain("<sup>3</sup>");
	});
	it("drops dangerous or unknown style values", () => {
		const out = sanitizeHtml('<p style="position: fixed; text-align: javascript:x"><span style="color: url(http://x); background: red; font-size: 999px; font-family: evil">t</span></p>');
		expect(out).not.toMatch(/style=/);
		expect(out).toContain("t");
	});
});

describe("links", () => {
	it("keeps nofollow, and opens outside links in a new tab", () => {
		expect(sanitizeHtml('<a href="https://example.org/" rel="nofollow">x</a>')).toBe('<a href="https://example.org/" target="_blank" rel="noopener noreferrer nofollow">x</a>');
		expect(sanitizeHtml('<a href="/tri-tue" rel="nofollow">x</a>')).toBe('<a href="/tri-tue" rel="nofollow">x</a>');
		expect(sanitizeHtml('<a href="https://example.org/">x</a>')).toBe('<a href="https://example.org/" target="_blank" rel="noopener noreferrer">x</a>');
	});
});

describe("figure size and alignment", () => {
	it("keeps width in percent and auto/0 margins, drops the rest", () => {
		const img = '<img src="/anh-goc/a.webp" alt="a">';
		expect(sanitizeHtml(`<figure style="width: 50%; margin-left: auto; margin-right: auto; float: left; position: fixed">${img}</figure>`)).toBe(`<figure style="width: 50%; margin-left: auto; margin-right: auto">${img.replace(">", ' loading="lazy">')}</figure>`);
		expect(sanitizeHtml(`<figure style="width: 5000px">${img}</figure>`)).not.toContain("style");
	});
});
