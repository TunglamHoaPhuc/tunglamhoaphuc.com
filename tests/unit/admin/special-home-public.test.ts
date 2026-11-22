// The public side of the home builder: how loadHomeData merges the admin's settings over what the site shows today, and how
// they are read from D1. With nothing set, the page must be exactly what it was.
import { describe, expect, it } from "vitest";
import { shuffled } from "@/components/home/quoteOrder";
import { site } from "@/config/site";
import { createMemoryRepository } from "@/libs/content/repository";
import type { AboutTopic, MonthTheme, Post, Schedule, ScheduleEvent } from "@/libs/content/types";
import { loadHomeData } from "@/libs/home";
import { EMPTY_HOME_EXTRAS, getHomeExtras, mediaIdsOf, readHomeExtras, type HomeExtras } from "@/libs/homeData";
import { readBuddhistYear, readHero, readQuotesSetting, readStats, readWelcome, safeHref, youtubeId } from "@/libs/homeSettings";
import { nextEvent } from "@/libs/nextEvent";
import { applyMigrations, asD1, openDatabase } from "../../../src/db/nodeSqlite";

const post = (id: number, title: string, publishedDate: string, extra: Partial<Post> = {}): Post => ({
	id: `p${id}`,
	slug: `bai-${id}`,
	title,
	subtitle: "",
	section: "dong-chay-hoang-phap",
	category: { slug: "cong-tu", name: "Cộng Tu" },
	author: "",
	publishedDate,
	views: 5,
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
});
const posts = [post(1, "Bài mới", "2026-10-17"), post(2, "Bài cũ", "2026-09-01")];

const event = (id: string, start: string): ScheduleEvent => ({
	id, slug: `su-kien-${id}`, title: `Sự kiện ${id}`, subtitle: "", category: { slug: "cong-tu", name: "Cộng Tu" }, start, end: start, times: [], location: "Chùa", description: "", notes: "", image: null, video: null,
});
const theme = (month: number, lines: string[]): MonthTheme => ({ month, title: `Chủ đề ${month}`, poster: null, lines, author: "Tác giả" });
const schedule: Schedule = { events: [event("a", "2026-11-07"), event("b", "2026-11-20")], programs: [], themes: [theme(11, ["Câu tháng mười một"])], quotes: [] };

const history: AboutTopic = {
	id: "lich-su", slug: "lich-su-chua", title: "Lịch sử", subtitle: "", tag: "", group: { slug: "lich-su-chua", name: "x" }, banner: null,
	portrait: { src: "https://media.example/ls.jpg", position: "center 30%" }, overview: "Tổng quan", quote: { title: "T", lines: ["Lập chùa là tạo cõi Tịnh độ."], author: "Thượng tọa" },
	milestones: [], contentHtml: "", gallery: [], book: null,
};

const NOW = new Date("2026-11-03T02:00:00Z");
const repo = () => createMemoryRepository(posts, { loadSchedule: async () => schedule, loadAbout: async () => [history] });
const extras = (settings: Record<string, unknown>, more: Partial<HomeExtras> = {}): HomeExtras => ({ ...EMPTY_HOME_EXTRAS, settings, ...more });

const slide = (over: Record<string, unknown> = {}) => ({ id: "s1", enabled: true, title: "Chào mừng", subtitle: "Phụ đề", text: "Mô tả", imageMediaId: null, portraitMediaId: null, imagePosition: "center 50%", ctaLabel: "Xem", ctaHref: "/lich-tu-hoc", ...over });

describe("with nothing set the page is what it was", () => {
	it("gives the same data with no extras, empty extras, empty settings, or settings that are all wrong", async () => {
		const base = await loadHomeData(repo(), NOW);
		expect(await loadHomeData(repo(), NOW, EMPTY_HOME_EXTRAS)).toEqual(base);
		expect(await loadHomeData(repo(), NOW, extras({}))).toEqual(base);
		const broken = extras({ "home.hero": "x", "home.welcome": 5, "home.stats": { a: 1 }, "home.buddhist_year": { mode: "weird" }, "home.quotes": null }, { quotes: [{ id: "q", text: "t", author: "", source: "", sourceUrl: "" }] });
		expect(await loadHomeData(repo(), NOW, broken)).toEqual(base);
		expect(base.quotes).toBeNull();
		expect(base.hero.map((item) => item.id)).toEqual(["noi-de-tro-ve", "khoa-tu-a", "bai-p1"]);
		expect(base.welcome?.stats.map((item) => item.value)).toEqual([2, 0, 2570]);
	});
});

describe("the hero", () => {
	it("shows the admin's frames, then the next event and the latest post unless switched off", async () => {
		const data = await loadHomeData(repo(), NOW, extras({ "home.hero": { slides: [slide(), slide({ id: "s2", title: "Hai", enabled: false }), slide({ id: "s3", title: "Ba", ctaLabel: "", ctaHref: "" })], autoEvent: true, autoLatest: true } }));
		expect(data.hero.map((item) => item.id)).toEqual(["tuy-chinh-s1", "tuy-chinh-s3", "khoa-tu-a", "bai-p1"]);
		expect(data.hero[0]).toMatchObject({ title: "Chào mừng", subtitle: "Phụ đề", text: "Mô tả", link: { label: "Xem", href: "/lich-tu-hoc" }, image: site.hero.image });
		expect(data.hero[1].link).toEqual(site.hero.link);
		const none = await loadHomeData(repo(), NOW, extras({ "home.hero": { slides: [slide()], autoEvent: false, autoLatest: false } }));
		expect(none.hero.map((item) => item.id)).toEqual(["tuy-chinh-s1"]);
		const eventOnly = await loadHomeData(repo(), NOW, extras({ "home.hero": { slides: [slide()], autoEvent: true, autoLatest: false } }));
		expect(eventOnly.hero.map((item) => item.id)).toEqual(["tuy-chinh-s1", "khoa-tu-a"]);
	});

	it("uses the pictures the frame names, desktop and portrait, and keeps the site's picture when one is gone", async () => {
		const settings = { "home.hero": { slides: [slide({ imageMediaId: "m1", portraitMediaId: "m2", imagePosition: "center 20%" }), slide({ id: "s2", imageMediaId: "da-xoa" })], autoEvent: false, autoLatest: false } };
		const data = await loadHomeData(repo(), NOW, extras(settings, { media: { m1: "/anh-goc/s2-cnv03/cms/m1/v1/a.png", m2: "/anh-goc/s2-cnv03/cms/m2/v1/b.png" } }));
		expect(data.hero[0].image).toMatchObject({ position: "center 20%" });
		expect(data.hero[0].image.src).toContain("m1");
		expect(data.hero[0].image.portrait).toContain("m2");
		expect(data.hero[1].image).toEqual(site.hero.image);
	});

	it("offers phones a 640 px copy of the frames and 360 px thumbnails (PageSpeed 22/11/2026)", async () => {
		const settings = { "home.hero": { slides: [slide({ imageMediaId: "m1", portraitMediaId: "m2" })], autoEvent: false, autoLatest: false } };
		const data = await loadHomeData(repo(), NOW, extras(settings, { media: { m1: "/anh-goc/s2-cnv03/cms/m1/v1/a.png", m2: "/anh-goc/s2-cnv03/cms/m2/v1/b.png" } }));
		const { image } = data.hero[0];
		const widths = (srcSet?: string) => srcSet?.split(", ").map((candidate) => candidate.split(" ")[1]);
		expect(widths(image.srcSet)).toEqual(["640w", "1280w", "1920w"]);
		expect(image.srcSet).toContain("/cdn-cgi/image/width=640,");
		expect(image.src).toContain("/cdn-cgi/image/width=1920,");
		expect(image.thumb).toContain("/cdn-cgi/image/width=360,");
		expect(widths(image.portraitSrcSet)).toEqual(["640w", "1280w"]);
		expect(image.portraitSrcSet).toContain("m2");
	});

	it("ignores a frame that is not valid, keeps the valid ones, and falls back to the site's own frame when none is left", async () => {
		const mixed = await loadHomeData(repo(), NOW, extras({ "home.hero": { slides: [slide({ ctaHref: "javascript:alert(1)" }), slide({ id: "ok" }), { nonsense: true }], autoEvent: false, autoLatest: false } }));
		expect(mixed.hero.map((item) => item.id)).toEqual(["tuy-chinh-ok"]);
		const none = await loadHomeData(repo(), NOW, extras({ "home.hero": { slides: [slide({ title: "" })], autoEvent: false } }));
		expect(none.hero.map((item) => item.id)).toEqual(["noi-de-tro-ve", "khoa-tu-a", "bai-p1"]);
		expect(readHero({ slides: [slide({ enabled: false })] })).toBeNull();
	});
});

describe("Lời chào and the figures", () => {
	it("lays the admin's words over the site's, field by field", async () => {
		const welcome = { quote: "Lời mới", author: "", paragraph: "", imageMediaId: "m1", videoUrl: "https://www.youtube.com/watch?v=HE2MnR8Hl5c", linkLabel: "Đọc tiếp", linkHref: "/gioi-thieu/khac" };
		const data = await loadHomeData(repo(), NOW, extras({ "home.welcome": welcome }, { media: { m1: "/anh-goc/x/m1.png" } }));
		expect(data.welcome).toMatchObject({ title: "Lời mới", author: "Thượng tọa", text: "Tổng quan", href: "/gioi-thieu/khac", linkLabel: "Đọc tiếp", videoId: "HE2MnR8Hl5c", image: { src: "/anh-goc/x/m1.png" } });
	});

	it("drops a video that is not YouTube and a link that is not safe, and keeps the rest", async () => {
		const data = await loadHomeData(repo(), NOW, extras({ "home.welcome": { quote: "Lời mới", videoUrl: "https://vimeo.com/1", linkHref: "javascript:alert(1)", paragraph: "Đoạn" } }));
		expect(data.welcome).toMatchObject({ title: "Lời mới", text: "Đoạn", href: "/gioi-thieu/lich-su-chua" });
		expect(data.welcome).not.toHaveProperty("videoId");
	});

	it("builds the greeting from the settings alone when the site has no history topic", async () => {
		const bare = await loadHomeData(createMemoryRepository(posts), NOW, extras({ "home.welcome": { quote: "Chỉ có lời" } }));
		expect(bare.welcome).toMatchObject({ title: "Chỉ có lời", href: "/gioi-thieu", faces: [] });
	});

	it("counts figures by their source, takes a typed value, and honours a manual Buddhist year", async () => {
		const stats = [
			{ label: "Bài Dòng Chảy", source: "auto-bai-dong-chay", value: 0 },
			{ label: "Phật tử", source: "manual", value: 1200 },
			{ label: "Phật lịch nay", source: "auto-phat-lich", value: 0 },
		];
		const data = await loadHomeData(repo(), NOW, extras({ "home.stats": stats, "home.buddhist_year": { mode: "manual", value: 2571 } }));
		expect(data.welcome?.stats).toEqual([{ label: "Bài Dòng Chảy", value: 2 }, { label: "Phật tử", value: 1200 }, { label: "Phật lịch nay", value: 2571, year: true }]);
		const onlyYear = await loadHomeData(repo(), NOW, extras({ "home.buddhist_year": { mode: "manual", value: 2600 } }));
		expect(onlyYear.welcome?.stats.at(-1)).toEqual({ label: "Phật lịch", value: 2600, year: true });
		const auto = await loadHomeData(repo(), NOW, extras({ "home.buddhist_year": { mode: "auto", value: 1 } }));
		expect(auto.welcome?.stats.at(-1)?.value).toBe(2570);
	});

	it("reads at most three figures and skips an invalid one", () => {
		const good = { label: "A", source: "manual", value: 1 };
		expect(readStats([good, { label: "", source: "manual", value: 1 }, { label: "B", source: "tu-bay", value: 1 }, good, good, good])).toHaveLength(1);
		expect(readStats([good, good, good, good, good])).toHaveLength(3);
		expect(readStats([{ label: "Âm", source: "manual", value: -1 }])).toBeNull();
		expect(readStats("x")).toBeNull();
		expect(readBuddhistYear({ mode: "manual", value: 0 })).toBeNull();
	});
});

describe("Lời Thầy dạy", () => {
	const quotes = [
		{ id: "q1", text: "Một", author: "Thầy", source: "", sourceUrl: "" },
		{ id: "q2", text: "Hai", author: "", source: "Kinh", sourceUrl: "" },
	];

	it("shows the admin's quotes, in order, when the source is trich-dan, and the verses stay for anything else", async () => {
		const data = await loadHomeData(repo(), NOW, extras({ "home.quotes": { source: "trich-dan", mode: "thu-tu" } }, { quotes }));
		expect(data.quotes).toEqual({ items: quotes, mode: "thu-tu" });
		expect(data.verses).toHaveLength(1);
		const random = await loadHomeData(repo(), NOW, extras({ "home.quotes": { source: "trich-dan", mode: "ngau-nhien" } }, { quotes }));
		expect(random.quotes?.mode).toBe("ngau-nhien");
		expect(random.quotes?.items).toEqual(quotes); // the page keeps the stored order; the browser shuffles
		expect((await loadHomeData(repo(), NOW, extras({ "home.quotes": { source: "chu-de-thang", mode: "thu-tu" } }, { quotes }))).quotes).toBeNull();
	});

	it("falls back to the verses when there is no active quote", async () => {
		expect((await loadHomeData(repo(), NOW, extras({ "home.quotes": { source: "trich-dan", mode: "thu-tu" } }))).quotes).toBeNull();
		expect(readQuotesSetting({ source: "x", mode: "thu-tu" })).toBeNull();
	});

	it("shuffles without losing or repeating any, and the same way for the same dice", () => {
		const items = [1, 2, 3, 4, 5, 6];
		const out = shuffled(items);
		expect([...out].sort()).toEqual(items);
		expect(items).toEqual([1, 2, 3, 4, 5, 6]);
		let n = 0;
		const dice = () => [0.1, 0.9, 0.5, 0.3, 0.7][n++ % 5];
		const a = shuffled(items, dice);
		n = 0;
		expect(shuffled(items, dice)).toEqual(a);
		expect(shuffled([], dice)).toEqual([]);
	});
});

describe("small readers", () => {
	it("tells YouTube addresses from everything else", () => {
		for (const url of ["https://www.youtube.com/watch?v=HE2MnR8Hl5c", "https://youtu.be/HE2MnR8Hl5c?t=3", "https://www.youtube.com/embed/HE2MnR8Hl5c", "https://youtube.com/shorts/HE2MnR8Hl5c", "HE2MnR8Hl5c"]) expect(youtubeId(url), url).toBe("HE2MnR8Hl5c");
		for (const url of ["http://youtu.be/HE2MnR8Hl5c", "https://evil.example/watch?v=HE2MnR8Hl5c", "https://youtube.com.evil.example/watch?v=HE2MnR8Hl5c", "https://www.youtube.com/watch?v=short", "", "javascript:alert(1)"]) expect(youtubeId(url), url).toBeNull();
	});

	it("accepts site paths and https links only", () => {
		for (const ok of ["", "/gioi-thieu", "/lich-tu-hoc?thang=2026-11#x", "https://a.example/x"]) expect(safeHref(ok), ok).toBe(true);
		for (const bad of ["//evil.example", "javascript:alert(1)", "http://a.example", "gioi-thieu", "/a b", "/a\\b", "data:text/html,x"]) expect(safeHref(bad), bad).toBe(false);
	});

	it("reads only the valid fields of Lời chào", () => {
		expect(readWelcome({ quote: "A", author: 5, videoUrl: "https://vimeo.com/1", linkHref: "/x" })).toEqual({ quote: "A", linkHref: "/x" });
		expect(readWelcome({})).toBeNull();
		expect(readWelcome(null)).toBeNull();
	});

	it("picks the next event the way the home page does", () => {
		const events = [{ start: "2026-11-01" }, { start: "2026-11-07" }, { start: "2026-11-20" }];
		expect(nextEvent(events, "2026-11-03")).toEqual({ start: "2026-11-07" });
		expect(nextEvent(events, "2026-11-07")).toEqual({ start: "2026-11-07" });
		expect(nextEvent(events, "2026-12-01")).toBeUndefined();
	});
});

describe("reading from D1", () => {
	const database = () => {
		const db = openDatabase();
		applyMigrations(db);
		db.exec("insert into media (id, r2_key, filename) values ('m1', 'cms/m1/v1/a.png', 'a.png')");
		db.exec("insert into media (id, url, filename) values ('m2', 'https://admin.tunglamhoaphuc.com/wp-content/uploads/w.png', 'w.png')");
		db.exec("insert into media (id, r2_key, filename, deleted_at) values ('m3', 'cms/m3/v1/c.png', 'c.png', '2026-01-01')");
		db.exec("insert into quote (id, text, author, position, active) values ('q2', 'Hai', 'B', 2, 1), ('q1', 'Một', 'A', 1, 1), ('q3', 'Tắt', '', 3, 0), ('q4', 'Đã xóa', '', 4, 1)");
		db.exec("update quote set deleted_at = '2026-01-01' where id = 'q4'");
		return db;
	};

	it("finds the pictures the home blocks name, and leaves out a trashed one", async () => {
		const settings = { "home.hero": { slides: [slide({ imageMediaId: "m1", portraitMediaId: "m3" })] }, "home.welcome": { imageMediaId: "m2" } };
		expect(mediaIdsOf(settings).sort()).toEqual(["m1", "m2", "m3"]);
		const found = await readHomeExtras(asD1(database()), settings);
		expect(found.media).toEqual({ m1: "/anh-goc/s2-cnv03/cms/m1/v1/a.png", m2: "https://admin.tunglamhoaphuc.com/wp-content/uploads/w.png" });
		expect(found.quotes).toEqual([]);
	});

	it("reads the active quotes in order only when the admin chose them", async () => {
		const chosen = await readHomeExtras(asD1(database()), { "home.quotes": { source: "trich-dan", mode: "thu-tu" } });
		expect(chosen.quotes.map((item) => item.id)).toEqual(["q1", "q2"]);
		const other = await readHomeExtras(asD1(database()), { "home.quotes": { source: "chu-de-thang", mode: "thu-tu" } });
		expect(other.quotes).toEqual([]);
	});

	it("is empty where the site does not read from D1", async () => {
		expect(await getHomeExtras()).toEqual(EMPTY_HOME_EXTRAS);
	});
});
