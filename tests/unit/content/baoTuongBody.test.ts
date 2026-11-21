import { describe, expect, it } from "vitest";
import { statueArticle, type StatueEntry } from "../../../src/libs/content/baoTuong";

const entry = (text: string) => ({ id: "1", code: "TP0001", slug: "x", name: "X", subtitle: "", areaCode: "", main: true, image: null, href: "/bao-tuong/x", assembly: null, cluster: "", text }) as unknown as StatueEntry;

describe("the text of a statue", () => {
	it("turns the old admin's plain paragraphs into HTML, and escapes tags typed there", () => {
		expect(statueArticle(entry("Một.\n\nHai.")).contentHtml).toContain("<p>");
		expect(statueArticle(entry("a & b")).contentHtml).not.toContain("<script");
	});

	it("keeps the HTML the admin saved, cleaned again for the public page", () => {
		const html = statueArticle(entry('<p>Đức <strong>Phật</strong></p><script>alert(1)</script><p onclick="x()">Hai</p>')).contentHtml;
		expect(html).toContain("<strong>Phật</strong>");
		expect(html).not.toMatch(/script|onclick/i);
	});
});
