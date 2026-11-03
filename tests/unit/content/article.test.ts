import { describe, expect, it } from "vitest";
import { parsePosts } from "@/libs/content/posts";
import { createMemoryRepository, slugKey } from "@/libs/content/repository";

const base = { mainCategory: "dong-chay-hoang-phap", subCategory: "cong-tu", categoryName: "Cộng Tu Định Kỳ", publishedDate: "2026-01-01" };
const { posts, issues } = parsePosts([
	{
		...base,
		id: "p1",
		slug: "%f0%9f%8c%bathu-moi",
		title: "Thư mời",
		summary: "Đoạn mở đầu của bài, nói lại y như dòng đầu…",
		content: "Đoạn mở đầu của bài, nói lại y như dòng đầu tiên.\n\nXem https://youtu.be/sVrfy4Igykw và https://www.youtube.com/watch?v=sVrfy4Igykw&t=3",
		galleryCount: 2,
		photoGallery: [],
	},
	{
		...base,
		id: "p2",
		slug: "loi-dan",
		title: "Lời dẫn riêng",
		summary: "Một lời giới thiệu riêng cho bài.",
		content: "Nội dung chính bắt đầu khác hẳn.",
		photoGallery: [{ imageUrl: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/a.jpg", title: "Ảnh" }],
	},
]);
const [encoded, own] = posts;

describe("article fields", () => {
	it("keeps a summary as the intro only when it says something the text does not open with", () => {
		expect(encoded.intro).toBe("");
		expect(own.intro).toBe("Một lời giới thiệu riêng cho bài.");
	});

	it("collects each YouTube video once", () => {
		expect(encoded.videos).toEqual([{ id: "sVrfy4Igykw", url: "https://www.youtube.com/watch?v=sVrfy4Igykw" }]);
		expect(own.videos).toEqual([]);
	});

	it("reports slugs stored percent-encoded, and still counts an album kept apart", () => {
		expect(issues.filter((issue) => issue.kind === "encoded-slug").map((issue) => issue.id)).toEqual(["p1"]);
		expect(encoded.galleryCount).toBe(2);
	});
});

describe("slugKey", () => {
	it("compares slugs decoded, whether stored encoded or arriving decoded from the URL", () => {
		expect(slugKey("%f0%9f%8c%bathu-moi")).toBe("🌺thu-moi");
		expect(slugKey("🌺thu-moi")).toBe("🌺thu-moi");
		expect(slugKey("phap-hoi")).toBe("phap-hoi");
		expect(slugKey("50%-giam")).toBe("50%-giam");
	});
});

describe("albums kept apart", () => {
	const albums = new Map([["p1", [{ src: "https://x.test/1.jpg", title: "Một", caption: "" }]]]);
	let loads = 0;
	const repo = createMemoryRepository(posts, {
		loadAlbums: async () => {
			loads++;
			return albums;
		},
	});

	it("fills an empty album on the post page, loading the albums once", async () => {
		expect((await repo.getPostBySlug("🌺thu-moi"))?.gallery).toEqual(albums.get("p1"));
		expect((await repo.getPostBySlug("%f0%9f%8c%bathu-moi"))?.gallery).toHaveLength(1);
		expect(loads).toBe(1);
	});

	it("leaves a post that has its own album alone, without loading", async () => {
		const fresh = createMemoryRepository(posts, {
			loadAlbums: async () => {
				throw new Error("should not load");
			},
		});
		expect((await fresh.getPostBySlug("loi-dan"))?.gallery).toHaveLength(1);
	});
});
