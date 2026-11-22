import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { htmlToArticleText, nguoiLienQuanLayout, toDetail } from "@/components/gioi-thieu/nguoi-lien-quan/content";
import { parseAbout } from "@/libs/content/about";
import { renderContent } from "@/libs/content/normalize";

const SNAPSHOT = "data/snapshot/gioi-thieu.json";

/**
 * What the editors wrote, line by line. InfographicArticleRenderer splits a block of lines into
 * its paragraph and list parts, so a list written right under a paragraph or after a blank line
 * comes out the same; only the lines and their order count.
 */
const normalized = (markdown: string) =>
	markdown
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.trim().replace(/^\*\s+/, "- "))
		.filter(Boolean)
		.join("\n");

describe("htmlToArticleText", () => {
	it("gives back headings, lists, bold, quotes, rules and images", () => {
		const markdown = [
			"### 1. Thân thế",
			"Thầy là **Trụ trì** chùa Hòa Phúc.\nDòng thứ hai.",
			"- **Pháp danh:** Thích Tâm Hòa\n- Bút danh: Vô Trí",
			"1. Một\n2. Hai",
			"> Lời dạy",
			"---",
			"![Chùa](https://s2-cnv03.s3.us-east-005.backblazeb2.com/a/b.webp)",
		].join("\n\n");
		expect(htmlToArticleText(renderContent(markdown))).toBe(
			[
				"### 1. Thân thế",
				"Thầy là **Trụ trì** chùa Hòa Phúc.\nDòng thứ hai.",
				"- **Pháp danh:** Thích Tâm Hòa\n- Bút danh: Vô Trí",
				"1. Một\n2. Hai",
				"> Lời dạy",
				"---",
				"![Chùa](/anh-goc/s2-cnv03/a/b.webp)",
			].join("\n\n"),
		);
	});

	it("decodes entities and keeps text outside blocks", () => {
		expect(htmlToArticleText("Mở đầu<p>A &amp; B &lt;3&gt;</p>")).toBe("Mở đầu\n\nA & B <3>");
		expect(htmlToArticleText("")).toBe("");
	});

	it.skipIf(!existsSync(SNAPSHOT))("round-trips the text of every topic of the snapshot", () => {
		const file = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { topics: { slug: string; content: string }[] };
		const { topics } = parseAbout(file);
		for (const raw of file.topics) {
			const topic = topics.find((item) => item.slug === raw.slug);
			if (!topic) continue;
			expect(normalized(htmlToArticleText(topic.contentHtml)), raw.slug).toBe(normalized(raw.content));
		}
	});
});

describe("nguoiLienQuanLayout", () => {
	const { topics } = parseAbout({
		topics: [
			{ id: "1", slug: "tieu-su-su-to", title: "TIỂU SỬ SƯ TỔ NGỘ CHÂN TỬ", groupCategory: "nguoi-lien-quan", content: "Sư Tổ Ngộ Chân Tử", status: "published" },
			{ id: "2", slug: "dai-su-moi", title: "ĐÔI NÉT VỀ ĐẠI SƯ MỚI", groupCategory: "nguoi-lien-quan", content: "Đại sư mới", status: "published" },
			{ id: "3", slug: "lich-su", title: "LỊCH SỬ", groupCategory: "lich-su-chua", content: "Lịch sử", status: "published" },
		],
	});
	const bySlug = (slug: string) => topics.find((topic) => topic.slug === slug)!;

	it("gives Sư Tổ the Odyssey view and any other topic of the group the detail layout", () => {
		expect(nguoiLienQuanLayout(bySlug("tieu-su-su-to"))?.kind).toBe("odyssey");
		expect(nguoiLienQuanLayout(bySlug("dai-su-moi"))).toEqual({ kind: "detail", detail: toDetail(bySlug("dai-su-moi")) });
	});

	it("leaves the other groups to the site's own topic page", () => {
		expect(nguoiLienQuanLayout(bySlug("lich-su"))).toBeNull();
	});
});
