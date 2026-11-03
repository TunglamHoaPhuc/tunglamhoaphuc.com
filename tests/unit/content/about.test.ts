import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAbout } from "@/libs/content/about";

const topic = (extra: Record<string, unknown>) => ({
	id: "gt-x",
	slug: "x",
	title: "TIỂU SỬ SA MÔN THÍCH TÂM HÒA",
	subtitle: "Trụ trì chùa Hòa Phúc",
	tag: "Trụ Trì Bổn Tự",
	groupCategory: "nguoi-lien-quan",
	groupCategoryName: "Người Liên Quan",
	overviewSummary: "Thầy Thích Tâm Hoà là một nhà sư trẻ.",
	content: "### 1. Thân thế\n\nThầy là Trụ trì chùa Hòa Phúc.",
	status: "published",
	orderIndex: 1,
	...extra,
});

describe("Giới thiệu file", () => {
	it("reads topics in the editors' order, milestones stored as text or as a list", () => {
		const { topics } = parseAbout({
			success: true,
			topics: [
				topic({ id: "b", slug: "b", orderIndex: 2, milestones: [{ year: "Trang Phục", title: "Trang nghiêm", description: "Áo tràng." }] }),
				topic({
					id: "a",
					slug: "a",
					orderIndex: 1,
					milestones: JSON.stringify([{ year: "Năm 1901", title: "Thân thế", description: "Sinh tại Thái Bình." }]),
					quoteContent: ["  Hạnh phúc thật sự  ", ""],
					quoteTitle: "LỜI NHẮC NHỞ",
					quoteAuthor: "Sa Môn Thích Tâm Hòa",
					galleryImages: [{ url: "https://b1.congngheviet.com.vn/file/s2-cnv03/a.jpg", caption: "Chân dung" }],
					sourceBook: { bookTitle: "Đi Qua Khổ Vui Cuộc Đời", author: "Thích Tâm Hòa", coverImage: "", description: "Hồi ức." },
				}),
				topic({ id: "c", slug: "c", status: "draft" }),
			],
		});
		expect(topics.map((item) => item.slug)).toEqual(["a", "b"]);
		expect(topics[0]).toMatchObject({
			group: { slug: "nguoi-lien-quan", name: "Người Liên Quan" },
			milestones: [{ label: "Năm 1901", title: "Thân thế", description: "Sinh tại Thái Bình." }],
			quote: { title: "LỜI NHẮC NHỞ", lines: ["Hạnh phúc thật sự"], author: "Sa Môn Thích Tâm Hòa" },
			gallery: [{ src: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/a.jpg", caption: "Chân dung" }],
			book: { title: "Đi Qua Khổ Vui Cuộc Đời", cover: null },
			portrait: null,
		});
		expect(topics[0].contentHtml).toContain("<h3>1. Thân thế</h3>");
		expect(topics[1].milestones).toEqual([{ label: "Trang Phục", title: "Trang nghiêm", description: "Áo tràng." }]);
	});

	it("keeps a broken milestone list from failing the topic", () => {
		const { topics } = parseAbout({ topics: [topic({ milestones: "[{oops" })] });
		expect(topics[0].milestones).toEqual([]);
	});

	it("reports a topic whose text is about someone else, as su-phu-tru-tri once was", () => {
		const { issues } = parseAbout({
			topics: [
				topic({ slug: "su-phu-tru-tri", overviewSummary: "Đại Sư Liên Đăng là một vị cao tăng.", content: "Đại sư Liên Đăng sinh năm…" }),
				topic({ id: "gt-02", slug: "dai-su-lien-dang", title: "ĐÔI NÉT VỀ ĐẠI SƯ LIÊN ĐĂNG", overviewSummary: "Đại Sư Liên Đăng…", orderIndex: 2 }),
			],
		});
		expect(issues).toEqual([
			{ kind: "about-mismatch", id: "su-phu-tru-tri", message: 'tiêu đề "TIỂU SỬ SA MÔN THÍCH TÂM HÒA", nhưng đầu nội dung nói về "ĐÔI NÉT VỀ ĐẠI SƯ LIÊN ĐĂNG"' },
		]);
	});

	it("finds nothing amiss in the topics as the old admin holds them now", () => {
		const path = "data/snapshot/gioi-thieu.json";
		if (!existsSync(path)) return;
		const { topics, issues } = parseAbout(JSON.parse(readFileSync(path, "utf8")));
		expect(topics).toHaveLength(6);
		expect(new Set(topics.map((item) => item.group.slug)).size).toBe(3);
		expect(issues).toEqual([]);
	});
});
