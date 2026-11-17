import { describe, expect, it } from "vitest";
import { parseMonks } from "../../../src/libs/content/monks";
import { parsePosts } from "../../../src/libs/content/posts";

const monk = {
	id: "khuong-viet",
	name: "Quốc sư Khuông Việt",
	lifespan: "933–1011",
	region: "Miền Bắc",
	hoi_chung: "Tăng chúng",
	sect: "Tông Lâm Tế",
	era: "Thời Cổ đại",
	sub_era: "Triều Đinh",
	avatarUrl: "https://b1.congngheviet.com.vn/file/s2-cnv03/a/k.webp",
	phapNgu: "Đạo pháp và dân tộc luôn song hành.",
	bio: "Thiền sư đời thứ 4.",
	coordinates: { x: 48, y: 28 },
};

describe("Danh Tăng", () => {
	it("reads the old admin's file and names the fields as the site does", () => {
		const { monks, issues } = parseMonks({ success: true, total: 1, data: [monk] });
		expect(issues).toEqual([]);
		expect(monks).toEqual([
			{
				id: "khuong-viet",
				name: "Quốc sư Khuông Việt",
				lifespan: "933–1011",
				region: "Miền Bắc",
				sangha: "Tăng chúng",
				sect: "Tông Lâm Tế",
				era: "Thời Cổ đại",
				subEra: "Triều Đinh",
				// Both B2 addresses become the one the site uses.
				avatar: "/anh-goc/s2-cnv03/a/k.webp",
				dharmaQuote: "Đạo pháp và dân tộc luôn song hành.",
				bio: "Thiền sư đời thứ 4.",
				coordinates: { x: 48, y: 28 },
			},
		]);
	});

	it("reports a record without an id or a name, and keeps the rest", () => {
		const { monks, issues } = parseMonks([monk, { ...monk, id: "" }, { ...monk, id: "x", name: "" }, { ...monk, id: "y", coordinates: { x: 400, y: 1 } }]);
		expect(monks.map((item) => item.id)).toEqual(["khuong-viet", "y"]);
		expect(issues).toHaveLength(2);
		// A pin off the map is no pin, not a lost record.
		expect(monks[1].coordinates).toBeNull();
	});

	it("reads nothing from a file of another shape", () => {
		expect(parseMonks(null).monks).toEqual([]);
		expect(parseMonks({ data: "nope" }).monks).toEqual([]);
	});
});

describe("posts that share a slug", () => {
	const raw = (id: string) => ({ id, slug: "phap-hoi", title: `Bài ${id}`, mainCategory: "dong-chay-hoang-phap", publishedDate: "2026-10-17", status: "published" });

	it("serves the first and reports the second, as the old site does", () => {
		const { posts, issues } = parsePosts({ posts: [raw("1"), raw("2")] });
		expect(posts.map((post) => post.id)).toEqual(["1"]);
		expect(issues.map((issue) => issue.kind)).toContain("duplicate-slug");
	});

	it("keeps both for the import, still reporting the second", () => {
		const { posts, issues } = parsePosts({ posts: [raw("1"), raw("2")] }, { keepDuplicateSlugs: true });
		expect(posts.map((post) => post.id)).toEqual(["1", "2"]);
		expect(issues.map((issue) => issue.kind)).toContain("duplicate-slug");
	});
});
