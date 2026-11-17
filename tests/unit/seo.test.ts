import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "@/libs/content/repository";
import type { Post, ScheduleEvent } from "@/libs/content/types";
import { FIXED_PATHS, absoluteUrl, articleJsonLd, eventJsonLd, jsonLdText, mayIndex, organizationJsonLd, originOf, sitemapEntries } from "@/libs/seo";

const post = (id: string, section: string, slug: string, publishedDate: string): Post =>
	({
		id,
		slug,
		title: `Bài ${id}`,
		subtitle: "",
		section,
		category: { slug: "c", name: "C" },
		author: "Ban Truyền Thông",
		publishedDate,
		views: 0,
		thumbnail: null,
		banner: null,
		summary: `Tóm tắt ${id}`,
		galleryCount: 0,
		contentHtml: "",
		videos: [],
		keywords: [],
	}) as unknown as Post;

describe("originOf and mayIndex", () => {
	it("builds an origin from the request host", () => {
		expect(originOf("www.tunglamhoaphuc.com")).toBe("https://www.tunglamhoaphuc.com");
		expect(originOf("v2.tunglamhoaphuc.com")).toBe("https://v2.tunglamhoaphuc.com");
		expect(originOf("localhost:4175")).toBe("http://localhost:4175");
		expect(originOf(null)).toBe("https://www.tunglamhoaphuc.com");
	});

	it("lets only the public site be indexed", () => {
		expect(mayIndex("www.tunglamhoaphuc.com")).toBe(true);
		expect(mayIndex("v2.tunglamhoaphuc.com")).toBe(false);
		expect(mayIndex(null)).toBe(false);
	});
});

describe("absoluteUrl", () => {
	it("encodes what needs it and keeps what is encoded", () => {
		expect(absoluteUrl("/dong-chay-hoang-phap/a-b")).toBe("https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/a-b");
		expect(absoluteUrl("/x/%F0%9F%AA%B7")).toBe("https://www.tunglamhoaphuc.com/x/%F0%9F%AA%B7");
		expect(absoluteUrl("/x/🪷")).toBe("https://www.tunglamhoaphuc.com/x/%F0%9F%AA%B7");
	});
});

describe("sitemapEntries", () => {
	it("lists the fixed pages once, then every post of both sections, page after page", async () => {
		const posts = Array.from({ length: 130 }, (_, i) => post(`p${i}`, i % 2 ? "tri-tue-phat-phap" : "dong-chay-hoang-phap", `bai-${i}`, `2026-01-${String((i % 28) + 1).padStart(2, "0")}T08:00:00`));
		const entries = await sitemapEntries(createMemoryRepository(posts));
		const paths = entries.map((entry) => entry.path);
		expect(paths.slice(0, FIXED_PATHS.length)).toEqual(FIXED_PATHS);
		expect(paths.filter((path) => path.startsWith("/dong-chay-hoang-phap/"))).toHaveLength(65);
		expect(paths.filter((path) => path.startsWith("/tri-tue-phat-phap/bai-"))).toHaveLength(65);
		expect(new Set(paths).size).toBe(paths.length);
		expect(entries.find((entry) => entry.path === "/dong-chay-hoang-phap/bai-0")?.lastModified).toBe("2026-01-01");
	});

	it("never lists a page twice, even when a fixed page is also in the data", async () => {
		const entries = await sitemapEntries(createMemoryRepository([post("p1", "dong-chay-hoang-phap", "bai-1", "2026-01-01T00:00:00")]));
		const paths = entries.map((entry) => entry.path);
		expect(paths.filter((path) => path === "/").length).toBe(1);
	});
});

describe("structured data", () => {
	it("describes a post as an Article with its own address and picture", () => {
		const data = articleJsonLd({ ...post("p1", "dong-chay-hoang-phap", "bai-1", "2026-01-02T08:00:00"), banner: { src: "/anh/x.webp", position: "center" } }, "/dong-chay-hoang-phap/bai-1");
		expect(data["@type"]).toBe("Article");
		expect(data.mainEntityOfPage).toBe("https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/bai-1");
		expect(data.image).toEqual(["https://www.tunglamhoaphuc.com/anh/x.webp"]);
		expect(data.datePublished).toBe("2026-01-02T08:00:00");
		expect(data.headline.length).toBeLessThanOrEqual(110);
	});

	it("keeps a headline within Google's 110 characters", () => {
		const long = { ...post("p1", "dong-chay-hoang-phap", "bai-1", "2026-01-02"), title: "x".repeat(300) };
		expect(articleJsonLd(long, "/a").headline).toHaveLength(110);
	});

	it("describes a retreat as an Event with dates, place and organiser", () => {
		const event = { id: "e1", slug: "khoa-tu", title: "Khóa tu một ngày", subtitle: "", category: { slug: "cong-tu", name: "Cộng Tu" }, start: "2026-11-08", end: "2026-11-09", times: [], location: "Chánh điện", description: "Mô tả", notes: "", image: null, video: null } satisfies ScheduleEvent;
		const data = eventJsonLd(event);
		expect(data["@type"]).toBe("Event");
		expect(data.startDate).toBe("2026-11-08");
		expect(data.endDate).toBe("2026-11-09");
		expect(data.location.name).toBe("Chánh điện");
		expect(data.organizer.name).toBe("Tùng Lâm Hòa Phúc");
	});

	it("describes the temple as an organisation with a Vietnamese phone in international form", () => {
		const data = organizationJsonLd();
		expect(data["@type"]).toContain("Organization");
		expect(data.telephone).toBe("+84979345373");
		expect(data.address.addressCountry).toBe("VN");
	});

	it("cannot be closed early by text that holds a tag", () => {
		const text = jsonLdText({ a: "</script><script>alert(1)</script>" });
		expect(text).not.toContain("</script>");
		expect(JSON.parse(text).a).toBe("</script><script>alert(1)</script>");
	});
});
