// Các khung của đầu trang chủ: khung của admin (home.hero.slides), rồi khóa tu sắp tới (còn bao nhiêu ngày) và pháp sự mới nhất, theo đúng
// cách www dựng (so với chính mã của www ở v3-home-hero-www-parity.test.ts). Ở đây là phần thuần: thứ tự, từng trường, địa chỉ nút an toàn,
// công tắc autoEvent/autoLatest, ngày tính theo giờ Việt Nam, và việc đọc hỏng không làm vỡ trang.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryRepository } from "@/lib/tlhp-content/repository";
import type { Post, ScheduleEvent } from "@/lib/tlhp-content/types";
import { DEFAULT_HERO, DEFAULT_HERO_VIDEO_ID, heroFromSettings } from "@/lib/v3-home-content";
import { ctaFrom, DEFAULT_FRAME, heroFrames, loadHeroSources, NO_HERO_SOURCES, nextEvent, todayInVietnam } from "@/lib/v3-home-hero";

const NOW = new Date("2026-11-03T02:00:00Z"); // 09h ngày 3/11/2026 ở Việt Nam

const slide = (over: Record<string, unknown> = {}) => ({ id: "s1", enabled: true, title: "Về nơi bình yên", subtitle: "Chốn thiêng", text: "Đoạn chữ ngắn của admin.", imageMediaId: null, portraitMediaId: null, imagePosition: "center 50%", ctaLabel: "Tìm hiểu Bổn tự", ctaHref: "/gioi-thieu", ...over });
const hero = (slides: unknown[], over: Record<string, unknown> = {}) => ({ slides, autoEvent: true, autoLatest: true, ...over });

const event = (id: string, start: string, over: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
	id, slug: `su-kien-${id}`, title: `Khóa tu ${id}`, subtitle: "", category: { slug: "cong-tu", name: "Cộng Tu" }, start, end: start,
	times: [{ label: "Khai khóa", time: "07h30" }], location: "Chánh Điện", description: "", notes: "", image: null, video: null, ...over,
});
const post = (id: number, publishedDate: string, over: Partial<Post> = {}): Post => ({
	id: `p${id}`, slug: `bai-${id}`, title: `Pháp sự ${id}`, subtitle: "", section: "dong-chay-hoang-phap", category: { slug: "cong-tu", name: "Cộng Tu" }, author: "",
	publishedDate, views: 1, thumbnail: null, banner: { src: `/anh-goc/${id}.webp`, position: "center 40%" }, summary: `Tóm tắt ${id}`, galleryCount: 0, intro: "",
	contentHtml: "", keywords: [], gallery: [], videos: [], pinned: false, seoTitle: "", seoDescription: "", ogImage: null, extra: { audio: null, youtubeId: null, book: null }, related: [], ...over,
});

const EVENTS = [event("a", "2026-11-07"), event("b", "2026-11-20")];
const sourcesOf = (events: ScheduleEvent[], posts: Post[]) => loadHeroSources(createMemoryRepository(posts, { loadSchedule: async () => ({ events, programs: [], themes: [], quotes: [] }) }));
const ids = (frames: { id: string }[]) => frames.map((f) => f.id);

// ── Khi chưa có gì ───────────────────────────────────────────────────────────────────────────────────────────────

test("không có cài đặt và không có nguồn: chỉ khung NƠI ĐỂ TRỞ VỀ có sẵn của V3", () => {
	assert.deepEqual(heroFrames(undefined), [DEFAULT_FRAME]);
	assert.deepEqual(heroFromSettings({}), DEFAULT_HERO);
	assert.equal(DEFAULT_FRAME.cta, null, "V3 không bịa nút hay đoạn chữ cho khung có sẵn");
	assert.equal(DEFAULT_FRAME.text, "");
	assert.equal(DEFAULT_HERO.frames.length, 1);
});

test("chưa admin nào đặt khung (như www): khung có sẵn, rồi khóa tu sắp tới, rồi pháp sự mới nhất", async () => {
	const sources = await sourcesOf(EVENTS, [post(1, "2026-10-17"), post(2, "2026-09-01")]);
	const frames = heroFrames(undefined, sources, NOW);
	assert.deepEqual(ids(frames), ["noi-de-tro-ve", "khoa-tu-a", "bai-p1"]);
	assert.equal(frames[1].overline, "Khóa tu sắp tới · Còn 4 ngày");
	assert.equal(frames[1].title, "KHÓA TU A");
	assert.match(frames[1].text, /^Thứ Bảy, 07\/11\/2026 · Âm lịch \d{1,2}\/\d{1,2}N? Bính Ngọ · Khai khóa 07h30 · Chánh Điện$/);
	assert.deepEqual(frames[1].cta, { label: "Xem lịch khóa tu", href: "/lich-tu-hoc/su-kien-a", external: false });
	assert.equal(frames[2].overline, "Pháp sự mới nhất · 17/10/2026");
	assert.equal(frames[2].title, "PHÁP SỰ 1");
	assert.equal(frames[2].text, "Tóm tắt 1");
	assert.deepEqual(frames[2].cta, { label: "Xem bài", href: "/dong-chay-hoang-phap/bai-1", external: false });
});

test("mọi chữ đều là tiếng Việt có dấu đầy đủ: không có khung nào để lộ mã, id hay undefined", async () => {
	const frames = heroFrames(hero([slide()]), await sourcesOf(EVENTS, [post(1, "2026-10-17")]), NOW);
	for (const frame of frames) for (const value of [frame.overline, frame.title, frame.subtitle, frame.text, frame.cta?.label ?? ""]) assert.doesNotMatch(value, /undefined|null|\[object/);
});

// ── Khung của admin ──────────────────────────────────────────────────────────────────────────────────────────────

test("khung của admin: tiêu đề và dòng phụ viết hoa, đoạn chữ giữ nguyên, nút có nhãn và địa chỉ", () => {
	const [frame] = heroFrames(hero([slide()], { autoEvent: false, autoLatest: false }));
	assert.deepEqual(frame, {
		id: "tuy-chinh-s1", kind: "custom", overline: "", title: "VỀ NƠI BÌNH YÊN", subtitle: "CHỐN THIÊNG", text: "Đoạn chữ ngắn của admin.",
		cta: { label: "Tìm hiểu Bổn tự", href: "/gioi-thieu", external: false },
	});
});

test("nhiều khung đang bật hiện đủ và đúng thứ tự admin xếp; khung tắt hoặc sai thì bỏ", () => {
	const frames = heroFrames(hero([slide({ id: "a", title: "Một" }), slide({ id: "b", title: "Tắt", enabled: false }), slide({ id: "c", title: "" }), slide({ id: "d", title: "Bốn" }), { nonsense: true }, slide({ id: "e", title: "Năm" })], { autoEvent: false, autoLatest: false }));
	assert.deepEqual(frames.map((f) => f.title), ["MỘT", "BỐN", "NĂM"]);
});

test("tám khung của admin (mức tối đa khi lưu) hiện đủ cả tám, khung tự động đứng sau", async () => {
	const eight = Array.from({ length: 8 }, (_, i) => slide({ id: `s${i}`, title: `Khung ${i}` }));
	const frames = heroFrames(hero(eight), await sourcesOf(EVENTS, [post(1, "2026-10-17")]), NOW);
	assert.equal(frames.length, 10);
	assert.deepEqual(frames.slice(0, 8).map((f) => f.title), eight.map((_, i) => `KHUNG ${i}`));
	assert.deepEqual(ids(frames.slice(8)), ["khoa-tu-a", "bai-p1"]);
});

test("nút: có nhãn mới có nút; chỉ nhãn không địa chỉ thì tới trang mặc định của www; địa chỉ https là liên kết ngoài", () => {
	assert.equal(ctaFrom("", "/gioi-thieu"), null, "không nhãn thì không nút (admin cũng không hiện nút khi nhãn trống)");
	assert.equal(ctaFrom("   ", "https://x.example"), null);
	assert.deepEqual(ctaFrom("Đọc thêm", ""), { label: "Đọc thêm", href: "/gioi-thieu", external: false });
	assert.deepEqual(ctaFrom(" Xem ", " https://example.org/trang?a=1 "), { label: "Xem", href: "https://example.org/trang?a=1", external: true });
	assert.deepEqual(ctaFrom("Lịch", "/lich-tu-hoc/khoa-tu"), { label: "Lịch", href: "/lich-tu-hoc/khoa-tu", external: false });
});

test("địa chỉ nút nguy hiểm không bao giờ thành href: javascript:, //máy-khác, http://, mailto:, có khoảng trắng hay dấu gạch ngược", () => {
	for (const href of ["javascript:alert(1)", "//evil.example/x", "http://example.org", "mailto:a@b.c", "/a b", "/a\\b", "data:text/html,x", "ftp://x"]) {
		assert.equal(ctaFrom("Xem", href), null, href);
		// Qua cả đường đọc cài đặt: khung có địa chỉ sai bị bỏ cả khung (như www), khung đúng bên cạnh vẫn còn.
		const frames = heroFrames(hero([slide({ id: "xau", ctaHref: href }), slide({ id: "tot", title: "Tốt" })], { autoEvent: false, autoLatest: false }));
		assert.deepEqual(ids(frames), ["tuy-chinh-tot"], href);
	}
});

test("cài đặt hỏng (không phải đối tượng, không có mảng khung, khung nào cũng sai): giữ khung có sẵn, khung tự động vẫn tính", async () => {
	const sources = await sourcesOf(EVENTS, [post(1, "2026-10-17")]);
	for (const raw of ["hỏng", 42, null, [], { slides: "x" }, hero([]), hero([{ nonsense: true }]), hero([slide({ enabled: false })])]) {
		const frames = heroFrames(raw, sources, NOW);
		assert.equal(frames[0].id, "noi-de-tro-ve", JSON.stringify(raw));
		assert.deepEqual(ids(frames.slice(1)), ["khoa-tu-a", "bai-p1"]);
	}
});

// ── Công tắc và khung tự động ────────────────────────────────────────────────────────────────────────────────────

test("autoEvent và autoLatest tắt từng cái, hoặc tắt cả hai", async () => {
	const sources = await sourcesOf(EVENTS, [post(1, "2026-10-17")]);
	assert.deepEqual(ids(heroFrames(hero([slide()], { autoEvent: false }), sources, NOW)), ["tuy-chinh-s1", "bai-p1"]);
	assert.deepEqual(ids(heroFrames(hero([slide()], { autoLatest: false }), sources, NOW)), ["tuy-chinh-s1", "khoa-tu-a"]);
	assert.deepEqual(ids(heroFrames(hero([slide()], { autoEvent: false, autoLatest: false }), sources, NOW)), ["tuy-chinh-s1"]);
	assert.deepEqual(ids(heroFrames(hero([slide()]), sources, NOW)), ["tuy-chinh-s1", "khoa-tu-a", "bai-p1"]);
});

test("khóa tu sắp tới là sự kiện đầu tiên (theo thứ tự ngày) bắt đầu từ hôm nay trở đi; sự kiện đã qua bị bỏ", () => {
	const events = [event("cu", "2026-10-01"), event("nay", "2026-11-03"), event("sau", "2026-11-09")];
	assert.equal(nextEvent(events, "2026-11-03")?.id, "nay");
	assert.equal(nextEvent(events, "2026-11-04")?.id, "sau");
	assert.equal(nextEvent(events, "2026-11-10"), undefined);
	const today = heroFrames(undefined, { events, posts: [] }, NOW).find((f) => f.kind === "event");
	assert.equal(today?.overline, "Khóa tu sắp tới · Diễn ra hôm nay");
	const none = heroFrames(undefined, { events: [event("cu", "2026-10-01")], posts: [] }, NOW);
	assert.deepEqual(ids(none), ["noi-de-tro-ve"], "hết sự kiện sắp tới thì không có khung khóa tu");
});

test("ngày tính theo giờ Việt Nam: qua nửa đêm ở Việt Nam là sang ngày mới dù đồng hồ máy chủ (UTC) còn ngày cũ", () => {
	const events = [event("ngay-7", "2026-11-07")];
	const label = (iso: string) => heroFrames(undefined, { events, posts: [] }, new Date(iso)).find((f) => f.kind === "event")?.overline;
	assert.equal(todayInVietnam(new Date("2026-11-06T16:59:00Z")), "2026-11-06");
	assert.equal(todayInVietnam(new Date("2026-11-06T17:01:00Z")), "2026-11-07");
	assert.equal(label("2026-11-06T16:59:00Z"), "Khóa tu sắp tới · Còn 1 ngày");
	assert.equal(label("2026-11-06T17:01:00Z"), "Khóa tu sắp tới · Diễn ra hôm nay");
	assert.equal(label("2026-11-07T17:01:00Z"), undefined, "sang ngày 8 thì khóa tu 7/11 đã qua");
});

test("sự kiện nhiều ngày, qua năm âm lịch: ngày dương và âm đủ hai đầu; sự kiện của khóa lễ thường kỳ dẫn về lịch trang chủ", () => {
	const multi = event("tet", "2026-02-10", { end: "2026-02-20", times: [], location: "" });
	const frame = heroFrames(undefined, { events: [multi], posts: [] }, new Date("2026-02-01T02:00:00Z")).find((f) => f.kind === "event");
	assert.equal(frame?.overline, "Khóa tu sắp tới · Còn 9 ngày");
	assert.match(frame?.text ?? "", /^10\/02 – 20\/02\/2026 · Âm lịch \d+\/\d+N? (Ất Tỵ|Bính Ngọ) – \d+\/\d+N? Bính Ngọ$/);
	const regular = heroFrames(undefined, { events: [event("lt", "2026-11-04", { programId: "p1" })], posts: [] }, NOW).find((f) => f.kind === "event");
	assert.equal(regular?.cta?.href, "/#lich-tu-hoc");
});

test("khung tự động thiếu chữ không để lại dấu nối thừa: không giờ, không nơi thì chỉ còn ngày dương và âm", () => {
	const frame = heroFrames(undefined, { events: [event("x", "2026-11-07", { times: [], location: "" })], posts: [] }, NOW).find((f) => f.kind === "event");
	assert.doesNotMatch(frame?.text ?? "", / · $|^ · | ·  · /);
	assert.equal((frame?.text ?? "").split(" · ").length, 2);
});

test("pháp sự mới nhất là bài mới nhất CÓ ảnh: bài không ảnh bị bỏ qua, không bài nào có ảnh thì không có khung", async () => {
	const withoutBanner = post(9, "2026-11-01", { banner: null });
	const frames = heroFrames(undefined, await sourcesOf([], [withoutBanner, post(1, "2026-10-17")]), NOW);
	assert.deepEqual(ids(frames), ["noi-de-tro-ve", "bai-p1"]);
	assert.deepEqual(ids(heroFrames(undefined, await sourcesOf([], [withoutBanner]), NOW)), ["noi-de-tro-ve"]);
});

test("chỉ lấy bài của chuyên mục đã có trang ở V3; bài đã ghim đứng đầu danh sách mới nhất như www", async () => {
	const other = post(5, "2026-11-02", { section: "khong-co-trang" });
	const sources = await sourcesOf([], [other, post(1, "2026-10-17"), post(2, "2026-10-20", { section: "tri-tue-phat-phap" }), post(3, "2026-08-01", { pinned: true })]);
	assert.deepEqual(sources.posts.map((p) => p.id), ["p3", "p2", "p1"]);
	const latest = heroFrames(undefined, sources, NOW).find((f) => f.kind === "latest");
	assert.equal(latest?.id, "bai-p3");
	assert.equal(latest?.cta?.href, "/dong-chay-hoang-phap/bai-3");
	assert.equal(heroFrames(undefined, sources, NOW).at(-1)?.id, "bai-p3");
});

// ── Đọc nguồn hỏng ───────────────────────────────────────────────────────────────────────────────────────────────

test("đọc lịch hoặc bài hỏng: không ném lỗi, chỉ mất các khung tự động; khung của admin vẫn còn", async () => {
	const broken = { getSchedule: async () => { throw new Error("D1 hỏng"); }, listPosts: async () => { throw new Error("D1 hỏng"); } };
	const log = console.error;
	console.error = () => {};
	try {
		const sources = await loadHeroSources(broken as never);
		assert.deepEqual(sources, NO_HERO_SOURCES);
		assert.deepEqual(ids(heroFrames(hero([slide()]), sources, NOW)), ["tuy-chinh-s1"]);
	} finally {
		console.error = log;
	}
});

// ── Ghép với video ───────────────────────────────────────────────────────────────────────────────────────────────

test("heroFromSettings: tiêu đề và dòng phụ ở ngoài là của khung đầu; video đọc riêng, khung đọc riêng", async () => {
	const sources = await sourcesOf(EVENTS, [post(1, "2026-10-17")]);
	const h = heroFromSettings({ "home.hero": hero([slide({ title: "Khung đầu", subtitle: "" }), slide({ id: "b", title: "Khung hai" })]), "home.welcome": { videoUrl: "https://youtu.be/dQw4w9WgXcQ" } }, sources, NOW);
	assert.equal(h.title, "KHUNG ĐẦU");
	assert.equal(h.subtitle, "");
	assert.equal(h.frames.length, 4);
	assert.equal(h.videoId, "dQw4w9WgXcQ");
	assert.equal(h.cutIntro, false);
	const bad = heroFromSettings({ "home.hero": hero([slide()]), "home.welcome": "hỏng" }, sources, NOW);
	assert.equal(bad.videoId, DEFAULT_HERO_VIDEO_ID);
	assert.equal(bad.frames.length, 3);
});

test("những gì admin nhập chỉ đi vào chữ: tiêu đề có thẻ HTML không thành thẻ (React thoát ký tự), và hết khung thì vẫn còn một khung", () => {
	const [frame] = heroFrames(hero([slide({ title: "<img src=x onerror=alert(1)>", text: "<script>alert(1)</script>" })], { autoEvent: false, autoLatest: false }));
	assert.equal(frame.title, "<IMG SRC=X ONERROR=ALERT(1)>");
	assert.equal(frame.text, "<script>alert(1)</script>");
	assert.ok(heroFrames(hero([]), NO_HERO_SOURCES, NOW).length >= 1);
});
