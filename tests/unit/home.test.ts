import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { createMemoryRepository } from "@/libs/content/repository";
import type { Post } from "@/libs/content/types";
import { loadHomeData } from "@/libs/home";

function post(id: number, title: string, publishedDate: string, views: number, extra: Partial<Post> = {}): Post {
	return {
		id: `p${id}`,
		slug: `bai-${id}`,
		title,
		subtitle: "",
		section: "dong-chay-hoang-phap",
		category: { slug: "cong-tu", name: "Cộng Tu Định Kỳ" },
		author: "",
		publishedDate,
		views,
		thumbnail: null,
		banner: { src: `https://media.example/${id}.jpg`, position: "center 40%" },
		summary: `Tóm tắt ${id}`,
		galleryCount: 0,
		intro: "",
		contentHtml: "",
		keywords: [],
		gallery: [],
		videos: [],
		...extra,
	};
}

const posts = [
	post(1, "Thông báo không ảnh", "2026-10-20", 5, { banner: null }),
	post(2, "Lễ Hằng Thuận", "2026-10-17", 115),
	post(3, "Cộng tu niệm Phật", "2026-09-21", 115),
	post(4, "Tháng Bảy", "2026-09-03", 111),
	post(5, "Huyết Bồn Trai", "2026-09-02", 109),
	post(6, "Khai mạc Phật Đản", "2026-09-01", 111),
	post(7, "Đêm thắp nến", "2026-01-07", 108),
	post(8, "Đêm  thắp NẾN", "2026-01-02", 108),
	post(9, "Lễ khai khóa", "2025-11-25", 109),
	post(10, "Chưa ai đọc", "2025-01-01", 0),
	post(11, "Bài Trí Tuệ đọc nhiều", "2026-10-30", 35404, { section: "tri-tue-phat-phap" }),
];

describe("home data", async () => {
	const data = await loadHomeData(createMemoryRepository(posts));

	it("Tin mới nhất: the six newest posts of sections whose pages exist", () => {
		expect(data.latest.map((item) => item.id)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"]);
	});

	it("Dấu ấn hoằng pháp: most read, each title once, none already in Tin mới nhất, none unread", () => {
		expect(data.popular.map((item) => item.id)).toEqual(["p9", "p7"]);
	});

	it("the hero: Nơi để trở về, then the newest post that has a picture", () => {
		expect(data.hero.map((slide) => slide.id)).toEqual(["noi-de-tro-ve", "bai-p2"]);
		expect(data.hero[0]).toMatchObject({ title: "Nơi để trở về", accent: "trở về", text: site.intro, image: site.hero.image });
		expect(data.hero[1]).toMatchObject({
			overline: "Pháp sự mới nhất · 17/10/2026",
			title: "Lễ Hằng Thuận",
			text: "Tóm tắt 2",
			link: { label: "Xem bài", href: "/dong-chay-hoang-phap/bai-2" },
			image: { src: "https://media.example/2.jpg", thumb: "https://media.example/2.jpg", position: "center 40%" },
		});
	});

	it("keeps only the welcome frame when no post has a picture", async () => {
		const bare = await loadHomeData(createMemoryRepository([post(1, "Một bài", "2026-01-01", 1, { banner: null })]));
		expect(bare.hero.map((slide) => slide.id)).toEqual(["noi-de-tro-ve"]);
		expect(bare.popular).toEqual([]);
	});
});

describe("repository lists for the home page", () => {
	const repo = createMemoryRepository(posts);

	it("sorts by views, newer first on a tie, and takes several sections", async () => {
		const page = await repo.listPosts({ section: ["dong-chay-hoang-phap", "tri-tue-phat-phap"], sort: "views", pageSize: 4 });
		expect(page.items.map((item) => item.id)).toEqual(["p11", "p2", "p3", "p4"]);
		expect(page.total).toBe(11);
	});

	it("gives lists the banner too, for the hero", async () => {
		const [first] = (await repo.listPosts({ section: "dong-chay-hoang-phap", pageSize: 2 })).items;
		expect(first).toHaveProperty("banner", null);
	});
});
