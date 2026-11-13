import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { createMemoryRepository } from "@/libs/content/repository";
import type { AboutTopic, MonthTheme, Post, Schedule, ScheduleEvent } from "@/libs/content/types";
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
	// The two posts filed under Vũ Trụ Phật Giáo have no pages of their own (its pages are its areas).
	post(11, "Bài Vũ Trụ đọc nhiều", "2026-10-30", 35404, { section: "vu-tru-phat-giao" }),
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

	it("Tin mới nhất takes Trí Tuệ Phật Pháp posts too, now that they have pages", async () => {
		const withTriTue = await loadHomeData(createMemoryRepository([...posts, post(12, "Pháp âm mới", "2026-11-01", 10, { section: "tri-tue-phat-phap" })]));
		expect(withTriTue.latest.map((item) => item.id)).toEqual(["p12", "p1", "p2", "p3", "p4", "p5"]);
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
		const page = await repo.listPosts({ section: ["dong-chay-hoang-phap", "vu-tru-phat-giao"], sort: "views", pageSize: 4 });
		expect(page.items.map((item) => item.id)).toEqual(["p11", "p2", "p3", "p4"]);
		expect(page.total).toBe(11);
	});

	it("gives lists the banner too, for the hero", async () => {
		const [first] = (await repo.listPosts({ section: "dong-chay-hoang-phap", pageSize: 2 })).items;
		expect(first).toHaveProperty("banner", null);
	});
});

function event(id: string, title: string, start: string, end = start, extra: Partial<ScheduleEvent> = {}): ScheduleEvent {
	return {
		id,
		slug: `su-kien-${id}`,
		title,
		subtitle: "",
		category: { slug: "cong-tu", name: "Cộng Tu" },
		start,
		end,
		times: [{ label: "Khai khóa", time: "07h30" }],
		location: "Tùng lâm Hòa Phúc",
		description: `Mô tả ${id}`,
		notes: "",
		image: { src: `https://media.example/${id}.webp`, position: "center 30%" },
		video: null,
		...extra,
	};
}

const theme = (month: number, lines: string[]): MonthTheme => ({ month, title: `Chủ đề ${month}`, poster: null, lines, author: "Vô Trí - Tâm Hòa" });

const schedule: Schedule = {
	events: [
		event("a", "PHÁP HỘI NIỆM PHẬT", "2026-10-03"),
		event("b", "LƯƠNG HOÀNG SÁM", "2026-11-01", "2026-11-05"),
		event("c", "PHÁP HỘI NIỆM PHẬT", "2026-11-07"),
		event("d", "Pháp hội niệm Phật", "2026-11-08"),
		event("e", "LỄ TIÊN THƯỜNG", "2026-11-19"),
		event("f", "LÃO TỔ SƯ", "2026-11-20"),
	],
	programs: [],
	themes: [theme(1, ["Câu tháng Giêng"]), theme(8, []), theme(10, ["Câu tháng Mười"]), theme(11, ["<b>Hoằng Pháp</b> mãi nhớ Thầy", "Hải Phòng vẫn còn đây"])],
	quotes: [],
};

// 3 November 2026, 9:00 in Vietnam.
const NOW = new Date("2026-11-03T02:00:00Z");

describe("home data from the schedule", async () => {
	const data = await loadHomeData(createMemoryRepository(posts, { loadSchedule: async () => schedule }), NOW);

	it("Khóa tu sắp tới: the next three events still running or to come, each title once", () => {
		expect(data.upcoming.map((item) => item.event.id)).toEqual(["b", "c", "e"]);
		expect(data.upcoming[0]).toMatchObject({ status: { label: "Đang diễn ra" }, countdown: "Đang diễn ra" });
		expect(data.upcoming[1]).toMatchObject({ countdown: "Còn 4 ngày", href: "/lich-tu-hoc#su-kien-su-kien-c" });
		expect(data.upcoming[2].href).toBe("/lich-tu-hoc#su-kien-su-kien-e");
	});

	it("hero frame 2 is the next event to begin, with its countdown, between the welcome and the latest post", () => {
		expect(data.hero.map((slide) => slide.id)).toEqual(["noi-de-tro-ve", "khoa-tu-c", "bai-p2"]);
		expect(data.hero[1]).toMatchObject({
			overline: "Khóa tu sắp tới · Còn 4 ngày",
			title: "PHÁP HỘI NIỆM PHẬT",
			text: "Thứ Bảy, 07/11/2026 · Âm lịch 29/9 Bính Ngọ · Khai khóa 07h30 · Tùng lâm Hòa Phúc",
			link: { label: "Xem lịch khóa tu", href: "/lich-tu-hoc#su-kien-su-kien-c" },
			image: { src: "https://media.example/c.webp", thumb: "https://media.example/c.webp", position: "center 30%" },
		});
	});

	it("links an event of another month by its month", async () => {
		const later = await loadHomeData(createMemoryRepository(posts, { loadSchedule: async () => schedule }), new Date("2026-10-20T02:00:00Z"));
		expect(later.upcoming[0]).toMatchObject({ countdown: "Còn 12 ngày", href: "/lich-tu-hoc?thang=2026-11#su-kien-su-kien-b" });
	});

	it("Lời Thầy dạy: verses from this month's theme on, skipping themes without one", () => {
		expect(data.verses.map((verse) => verse.month)).toEqual([11, 1, 10]);
		expect(data.verses[0]).toMatchObject({ title: "Chủ đề 11", lines: ["<b>Hoằng Pháp</b> mãi nhớ Thầy", "Hải Phòng vẫn còn đây"] });
	});

	it("drops frame 2 and the block when nothing is left on the schedule", async () => {
		const after = await loadHomeData(createMemoryRepository(posts, { loadSchedule: async () => schedule }), new Date("2027-01-10T02:00:00Z"));
		expect(after.upcoming).toEqual([]);
		expect(after.hero.map((slide) => slide.id)).toEqual(["noi-de-tro-ve", "bai-p2"]);
	});
});

const about = (id: string, group: string, extra: Partial<AboutTopic> = {}): AboutTopic => ({
	id,
	slug: `chu-de-${id}`,
	title: `Chủ đề ${id}`,
	subtitle: "",
	tag: "",
	group: { slug: group, name: group },
	banner: null,
	portrait: { src: `https://media.example/${id}.jpg`, position: "center 30%" },
	overview: `Tổng quan ${id}`,
	quote: null,
	milestones: [],
	contentHtml: "",
	gallery: [],
	book: null,
	...extra,
});

const topics = [
	about("lich-su", "lich-su-chua", {
		slug: "lich-su-tung-lam-hoa-phuc",
		quote: { title: "TINH THẦN", lines: ["Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian.", "Ở đó…"], author: "Thượng tọa Thích Tâm Hòa" },
	}),
	about("a", "nguoi-lien-quan"),
	about("b", "nguoi-lien-quan", { portrait: null, banner: { src: "https://media.example/b-banner.jpg", position: "center 50%" } }),
	about("c", "nguoi-lien-quan"),
	about("d", "nguoi-lien-quan"),
	about("quy", "thanh-quy-van-hoa"),
];

describe("home data from Giới thiệu", async () => {
	const repo = createMemoryRepository(posts, { loadAbout: async () => topics });
	const data = await loadHomeData(repo, NOW);

	it("Chư Tôn Đức: the teachers of Giới thiệu, in the editors' order", () => {
		expect(data.teachers.map((topic) => topic.id)).toEqual(["a", "b", "c", "d"]);
	});

	it("Lời chào: the history topic's teaching, overview and link, the teachers' faces and the figures", () => {
		expect(data.welcome).toMatchObject({
			title: "Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian.",
			author: "Thượng tọa Thích Tâm Hòa",
			text: "Tổng quan lich-su",
			href: "/gioi-thieu/lich-su-tung-lam-hoa-phuc",
			image: { src: "https://media.example/lich-su.jpg" },
		});
		expect(data.welcome?.faces.map((face) => face.src)).toEqual(["https://media.example/a.jpg", "https://media.example/b-banner.jpg", "https://media.example/c.jpg"]);
		// 10 Dòng Chảy posts and none of Trí Tuệ in the fixture; 3 November 2026 is after Phật đản.
		expect(data.welcome?.stats).toEqual([
			{ label: "Bài viết Dòng Chảy Hoằng Pháp", value: 10 },
			{ label: "Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp", value: 0 },
			{ label: "Phật lịch", value: 2570, year: true },
		]);
	});

	it("leaves both blocks out without Giới thiệu", async () => {
		const bare = await loadHomeData(createMemoryRepository(posts), NOW);
		expect(bare.welcome).toBeNull();
		expect(bare.teachers).toEqual([]);
	});
});
