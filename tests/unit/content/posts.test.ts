import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEDIA_BASE } from "@/libs/content/media";
import { parsePosts } from "@/libs/content/posts";
import { contentSource, createMemoryRepository } from "@/libs/content/repository";
import { loadSnapshotPosts } from "@/libs/content/sources/snapshot";
import type { Post } from "@/libs/content/types";
import fixture from "./fixtures/posts.json";

const parsed = parsePosts(fixture);
const kinds = (kind: string) => parsed.issues.filter((issue) => issue.kind === kind).map((issue) => issue.id);
const bySlug = (slug: string) => parsed.posts.find((post) => post.slug === slug)!;

describe("parsePosts", () => {
	it("keeps the usable published posts and reports the rest without failing", () => {
		expect(parsed.total).toBe(12);
		expect(parsed.posts.map((post) => post.id)).toEqual(["post-101", "post-102", "post-103", "post-104", "post-106", "post-110", "111", "post-112"]);
		expect(kinds("invalid")).toEqual(["post-107", "post-108"]);
		expect(parsed.issues.find((issue) => issue.id === "post-108")?.message).toContain("2026-02-30");
	});

	it("leaves a shared slug to the first post, as the old site does", () => {
		expect(bySlug("cong-tu-thang-10").id).toBe("post-101");
		expect(kinds("duplicate-slug")).toEqual(["post-105"]);
	});

	it("reports a title used twice in a section, and keeps both", () => {
		expect(kinds("duplicate-title")).toEqual(["post-112"]);
		expect(bySlug("an-tru-ban-hai").title).toBe("An trú trong hiện tại");
	});

	it("titles an untitled post with the first sentence of its text", () => {
		expect(bySlug("106-2").title).toBe("THÔNG BÁO: CHƯƠNG TRÌNH TU HỌC THÁNG 4 NĂM CANH TÝ.");
		expect(kinds("missing-title")).toEqual(["post-106"]);
	});

	it("gives each category one name, the most used", () => {
		expect(bySlug("106-2").category).toEqual({ slug: "cong-tu", name: "Cộng Tu Định Kỳ" });
		expect(kinds("category-name")).toEqual(["dong-chay-hoang-phap/cong-tu"]);
	});

	it("normalises fields: plain text, numbers, pictures and their positions", () => {
		const post = bySlug("cong-tu-thang-10");
		expect(post).toMatchObject({
			section: "dong-chay-hoang-phap",
			publishedDate: "2026-10-12",
			summary: "Buổi cộng tu tháng 10.",
			views: 40,
			thumbnail: { src: `${MEDIA_BASE}/tunglamhoaphuc-com/wp-content/uploads/2026/10/a.jpg`, position: "center 35%" },
			banner: { position: "center 50%" },
			keywords: [{ keyword: "Tam Bảo", title: "Tam Bảo", description: "Phật, Pháp, Tăng." }],
		});
		expect(bySlug("bai-viet-tri-tue").views).toBe(77);
		// No thumbnail of its own: the banner stands in, upgraded to https.
		expect(bySlug("an-lac-moi-ngay").thumbnail).toEqual({
			src: `${MEDIA_BASE}/tunglamhoaphuc2/03-dong-chay-hoang-phap/c.webp`,
			position: "center 45%",
		});
		expect(bySlug("an-pham-sach-1").thumbnail).toBeNull();
	});

	it("replaces a missing or placeholder summary with the start of the text", () => {
		expect(bySlug("khoa-le-ram-thang-7").summary).toBe("Mở đầu Nội dung xem ảnh chính của khóa lễ.");
		expect(bySlug("an-lac-moi-ngay").summary).toBe("Thứ nhất Thứ hai Sau danh sách.");
		expect(kinds("empty-summary")).toEqual(["post-102", "post-103", "post-106", "post-110", "111"]);
	});

	it("drops emoji from the album and counts what is left", () => {
		const post = bySlug("cong-tu-thang-10");
		expect(post.gallery).toEqual([
			{ src: `${MEDIA_BASE}/tunglamhoaphuc-com/wp-content/uploads/2026/10/1.jpg`, title: "Ảnh #1", caption: "Chư Tăng" },
			{ src: "https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/10/2.jfif", title: "Ảnh #2", caption: "" },
		]);
		expect(post.galleryCount).toBe(2);
		expect(kinds("emoji-image")).toEqual(["post-101"]);
		expect(kinds("wordpress-image")).toEqual(["post-101"]);
		expect(kinds("gallery-count")).toEqual(["post-101"]);
		expect(kinds("moved-link")).toEqual(["post-101"]);
	});

	it("renders bodies as safe HTML", () => {
		expect(bySlug("cong-tu-thang-10").contentHtml).toContain("<h2>Chương trình</h2>\n<ul><li>Tụng kinh</li><li>Thiền hành</li></ul>");
		const html = bySlug("bai-viet-tri-tue").contentHtml;
		expect(html).not.toMatch(/<script|<img|javascript:/i);
		expect(html).toContain('<a href="https://www.tunglamhoaphuc.com/lich-tu-hoc" rel="noopener noreferrer">trang chùa</a>');
	});

	it("reports a file that is not a list of posts", () => {
		expect(parsePosts({ hello: 1 })).toMatchObject({ posts: [], total: 0, issues: [{ kind: "invalid" }] });
		expect(parsePosts([]).posts).toEqual([]);
	});
});

describe("memory repository", () => {
	const repo = createMemoryRepository(parsed.posts);

	it("lists a section newest first, 12 to a page, without bodies", async () => {
		const page = await repo.listPosts({ section: "dong-chay-hoang-phap" });
		expect(page).toMatchObject({ total: 4, page: 1, pageSize: 12, pageCount: 1 });
		expect(page.items.map((post) => post.slug)).toEqual(["cong-tu-thang-10", "an-lac-moi-ngay", "khoa-le-ram-thang-7", "106-2"]);
		expect(page.items[0]).not.toHaveProperty("contentHtml");
		expect(page.items[0]).not.toHaveProperty("gallery");
	});

	it("filters by category and sorts in Vietnamese order", async () => {
		const titles = async (sort: "oldest" | "az" | "za") =>
			(await repo.listPosts({ section: "dong-chay-hoang-phap", category: "cong-tu", sort })).items.map((post) => post.title);
		expect(await titles("oldest")).toEqual(["THÔNG BÁO: CHƯƠNG TRÌNH TU HỌC THÁNG 4 NĂM CANH TÝ.", "Ấn tượng an lạc mỗi ngày", "Cộng tu tháng 10"]);
		expect(await titles("az")).toEqual(["Ấn tượng an lạc mỗi ngày", "Cộng tu tháng 10", "THÔNG BÁO: CHƯƠNG TRÌNH TU HỌC THÁNG 4 NĂM CANH TÝ."]);
		expect(await titles("za")).toEqual(["THÔNG BÁO: CHƯƠNG TRÌNH TU HỌC THÁNG 4 NĂM CANH TÝ.", "Cộng tu tháng 10", "Ấn tượng an lạc mỗi ngày"]);
	});

	it("pages through results and clamps odd page values", async () => {
		const second = await repo.listPosts({ pageSize: 3, page: 2 });
		expect(second).toMatchObject({ total: 8, page: 2, pageSize: 3, pageCount: 3 });
		expect(second.items).toHaveLength(3);
		expect((await repo.listPosts({ pageSize: 3, page: 9 })).items).toEqual([]);
		expect(await repo.listPosts({ page: -2, pageSize: 0 })).toMatchObject({ page: 1, pageSize: 12 });
		expect((await repo.listPosts({ pageSize: 1000 })).pageSize).toBe(60);
	});

	it("finds a post by slug, null when there is none", async () => {
		expect((await repo.getPostBySlug("khoa-le-ram-thang-7"))?.id).toBe("post-102");
		expect(await repo.getPostBySlug("khong-co")).toBeNull();
		expect(await repo.getPostBySlug("ban-nhap")).toBeNull();
	});

	it("counts the categories of a section", async () => {
		expect(await repo.listCategories("dong-chay-hoang-phap")).toEqual([
			{ slug: "cong-tu", name: "Cộng Tu Định Kỳ", count: 3 },
			{ slug: "khoa-le-truyen-thong", name: "Khóa Lễ Truyền Thống", count: 1 },
		]);
	});
});

describe("contentSource", () => {
	it("defaults to the snapshot and refuses unknown names", () => {
		expect(contentSource(undefined)).toBe("snapshot");
		expect(contentSource("b2")).toBe("b2");
		expect(() => contentSource("wordpress")).toThrow(/CONTENT_SOURCE/);
	});
});

// The real export of the old admin, when it has been copied to data/snapshot/ (not in git).
describe.skipIf(!existsSync("data/snapshot/posts.json"))("real snapshot", () => {
	it("parses every record and matches the counts of spec 3.1b", async () => {
		const file = JSON.parse(readFileSync("data/snapshot/posts.json", "utf8"));
		const stored = new Map<string, number>();
		for (const record of file.posts) stored.set(record.mainCategory, (stored.get(record.mainCategory) ?? 0) + 1);
		expect(file.posts).toHaveLength(632);
		expect(Object.fromEntries(stored)).toMatchObject({ "dong-chay-hoang-phap": 472, "tri-tue-phat-phap": 158 });

		const { posts, total } = await loadSnapshotPosts();
		expect(total).toBe(632);
		expect(posts.length).toBeGreaterThan(620);
	});

	it("outputs no script, event handler or javascript: link, and only known picture hosts", async () => {
		const { posts } = await loadSnapshotPosts();
		const pictures = (post: Post) => [
			post.thumbnail?.src,
			post.banner?.src,
			...post.gallery.map((photo) => photo.src),
			...[...post.contentHtml.matchAll(/src="([^"]+)"/g)].map((match) => match[1]),
		];
		const hosts = new Set(posts.flatMap(pictures).filter(Boolean).map((src) => new URL(src!).host));
		expect([...hosts].sort()).toEqual([new URL(MEDIA_BASE).host, "admin.tunglamhoaphuc.com"].sort());
		for (const post of posts) {
			expect(post.contentHtml, post.id).not.toMatch(/<script|<iframe|<style|javascript:/i);
			expect(post.contentHtml, post.id).not.toMatch(/<[^>]+\son[a-z]+\s*=/i);
		}
	});
});
