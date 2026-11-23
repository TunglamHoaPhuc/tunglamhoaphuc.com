// Khung đầu trang của V3 so với www, bằng mã thật của www: tests/helpers/www-hero-world.mjs cho CHÍNH loadHomeData của www dựng các khung
// (khung của admin, khóa tu sắp tới với số ngày còn lại và ngày âm lịch, pháp sự mới nhất) trên một loạt tình huống; kiểm thử này dựng lại
// cùng tình huống bằng mã của V3 (loadHeroSources + heroFrames) và đòi: cùng các khung, cùng thứ tự, cùng id, cùng dòng nhỏ phía trên, cùng
// tiêu đề, dòng phụ, đoạn chữ và nhãn nút. Chỗ V3 cố ý khác www (địa chỉ nút của khóa tu, khung có sẵn không đoạn chữ, nhãn nút trống) được kiểm riêng.
//
// Chạy:  TLHP_WWW_SRC=E:/tlhp-av3/src npm test      (không đặt TLHP_WWW_SRC thì bỏ qua, như v3-calendar-www-parity.test.ts)
// Không chạm Cloudflare; tệp tạm nằm trong thư mục tạm của hệ điều hành và bị xóa khi xong.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { createMemoryRepository } from "@/lib/tlhp-content/repository";
import type { Post, ScheduleEvent } from "@/lib/tlhp-content/types";
import { heroFrames, loadHeroSources } from "@/lib/v3-home-hero";

const WWW_SRC = process.env.TLHP_WWW_SRC;
const WWW = WWW_SRC ? path.resolve(WWW_SRC, "..") : "";
const TSX = path.join(WWW, "node_modules", "tsx", "dist", "cli.mjs");
const HELPER = path.resolve("tests/helpers/www-hero-world.mjs");

const SKIP: string | false =
	WWW_SRC && existsSync(TSX) && existsSync(path.join(WWW_SRC, "libs/home.ts"))
		? false
		: "TLHP_WWW_SRC chưa đặt (thư mục src của www, cần có node_modules/tsx): bỏ qua so khung đầu trang V3 với www";

const tmp = SKIP ? "" : mkdtempSync(path.join(tmpdir(), "tlhp-hero-parity-"));
after(() => {
	if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const lf = (text: string) => text.replace(/\r\n/g, "\n");

test("v3-hero-lunar.ts giống từng byte src/libs/lunar.ts của www (trừ kiểu xuống dòng): ngày âm lịch của khung khóa tu không lệch", { skip: SKIP }, () => {
	const mine = lf(readFileSync(path.resolve("src/lib/v3-hero-lunar.ts"), "utf8"));
	const theirs = lf(readFileSync(path.join(WWW_SRC as string, "libs/lunar.ts"), "utf8"));
	assert.equal(mine, theirs, "lib/v3-hero-lunar.ts lệch khỏi src/libs/lunar.ts của www: chép lại tệp của www");
});

const slide = (over: Record<string, unknown> = {}) => ({ id: "s1", enabled: true, title: "Về nơi bình yên", subtitle: "Chốn thiêng", text: "Đoạn chữ ngắn.", imageMediaId: null, portraitMediaId: null, imagePosition: "center 50%", ctaLabel: "Tìm hiểu Bổn tự", ctaHref: "/gioi-thieu", ...over });
const hero = (slides: unknown[], over: Record<string, unknown> = {}) => ({ slides, autoEvent: true, autoLatest: true, ...over });

const event = (id: string, start: string, over: Partial<ScheduleEvent> = {}): ScheduleEvent => ({
	id, slug: `su-kien-${id}`, title: `Khóa tu ${id}`, subtitle: "", category: { slug: "cong-tu", name: "Cộng Tu" }, start, end: start,
	times: [{ label: "Khai khóa", time: "07h30" }, { label: "", time: "19h00" }], location: "Chánh Điện", description: "", notes: "", image: null, video: null, ...over,
});
const post = (id: number, publishedDate: string, over: Partial<Post> = {}): Post => ({
	id: `p${id}`, slug: `bai-${id}`, title: `Pháp sự ${id}`, subtitle: "", section: "dong-chay-hoang-phap", category: { slug: "cong-tu", name: "Cộng Tu" }, author: "",
	publishedDate, views: 1, thumbnail: null, banner: { src: `https://media.example/${id}.jpg`, position: "center 40%" }, summary: `Tóm tắt ${id}`, galleryCount: 0, intro: "",
	contentHtml: "", keywords: [], gallery: [], videos: [], pinned: false, seoTitle: "", seoDescription: "", ogImage: null, extra: { audio: null, youtubeId: null, book: null }, related: [], ...over,
});

type Scenario = { name: string; now: string; settings: Record<string, unknown>; events: ScheduleEvent[]; posts: Post[] };
const NOW = "2026-11-03T02:00:00Z";
const POSTS = [post(1, "2026-10-17"), post(2, "2026-09-01"), post(3, "2026-10-25", { section: "tri-tue-phat-phap" }), post(4, "2026-10-30", { section: "khong-co-trang" })];
const EVENTS = [event("cu", "2026-10-01"), event("a", "2026-11-07"), event("b", "2026-11-20", { end: "2026-11-22" })];

const SCENARIOS: Scenario[] = [
	{ name: "chưa có cài đặt", now: NOW, settings: {}, events: EVENTS, posts: POSTS },
	{ name: "cài đặt hỏng", now: NOW, settings: { "home.hero": "hỏng", "home.welcome": 5 }, events: EVENTS, posts: POSTS },
	{ name: "hai khung của admin, một khung tắt, một khung có địa chỉ https", now: NOW, settings: { "home.hero": hero([slide(), slide({ id: "t", title: "Tắt", enabled: false }), slide({ id: "h", title: "Khung https", ctaLabel: "Đọc", ctaHref: "https://example.org/a" }), slide({ id: "x", title: "Xấu", ctaHref: "javascript:alert(1)" })]) }, events: EVENTS, posts: POSTS },
	{ name: "autoEvent tắt", now: NOW, settings: { "home.hero": hero([slide()], { autoEvent: false }) }, events: EVENTS, posts: POSTS },
	{ name: "autoLatest tắt", now: NOW, settings: { "home.hero": hero([slide()], { autoLatest: false }) }, events: EVENTS, posts: POSTS },
	{ name: "cả hai tắt", now: NOW, settings: { "home.hero": hero([slide()], { autoEvent: false, autoLatest: false }) }, events: EVENTS, posts: POSTS },
	{ name: "không có sự kiện nào sắp tới", now: NOW, settings: {}, events: [event("cu", "2026-10-01")], posts: POSTS },
	{ name: "khóa tu hôm nay", now: NOW, settings: {}, events: [event("nay", "2026-11-03"), event("sau", "2026-11-09")], posts: POSTS },
	{ name: "sát nửa đêm Việt Nam, trước", now: "2026-11-06T16:59:00Z", settings: {}, events: [event("ngay7", "2026-11-07")], posts: POSTS },
	{ name: "sát nửa đêm Việt Nam, sau", now: "2026-11-06T17:01:00Z", settings: {}, events: [event("ngay7", "2026-11-07")], posts: POSTS },
	{ name: "khóa tu nhiều ngày qua Tết âm lịch", now: "2026-02-01T02:00:00Z", settings: {}, events: [event("tet", "2026-02-10", { end: "2026-02-20", times: [], location: "" })], posts: POSTS },
	{ name: "khóa tu qua năm dương lịch", now: "2026-12-20T02:00:00Z", settings: {}, events: [event("cuoi-nam", "2026-12-30", { end: "2027-01-03" })], posts: POSTS },
	{ name: "khóa tu một ngày không giờ giấc, không nơi", now: NOW, settings: {}, events: [event("tron", "2026-11-05", { times: [], location: "" })], posts: POSTS },
	{ name: "bài mới nhất không có ảnh thì lấy bài kế", now: NOW, settings: {}, events: EVENTS, posts: [post(9, "2026-11-01", { banner: null }), ...POSTS] },
	{ name: "không bài nào có ảnh", now: NOW, settings: {}, events: EVENTS, posts: POSTS.map((p) => ({ ...p, banner: null })) },
	{ name: "bài ghim đứng đầu danh sách mới nhất", now: NOW, settings: {}, events: EVENTS, posts: [...POSTS, post(8, "2026-01-01", { pinned: true })] },
	{ name: "chỉ bài của chuyên mục khác", now: NOW, settings: {}, events: EVENTS, posts: [post(7, "2026-11-01", { section: "khong-co-trang" })] },
];

let www: Record<string, { id: string; overline: string; title: string; subtitle: string; text: string; link: { label: string; href: string } }[]>;
function wwwWorld() {
	if (www) return www;
	const input = path.join(tmp, "vao.json");
	const output = path.join(tmp, "ra.json");
	writeFileSync(input, JSON.stringify({ scenarios: SCENARIOS }));
	const run = spawnSync(process.execPath, [TSX, HELPER, WWW, input, output], {
		cwd: WWW,
		env: { ...process.env, TSX_TSCONFIG_PATH: path.join(WWW, "tsconfig.json") },
		encoding: "utf8",
		timeout: 120_000,
	});
	assert.equal(run.status, 0, `www không dựng được khung đầu trang:\n${run.stdout}\n${run.stderr}`);
	www = JSON.parse(readFileSync(output, "utf8"));
	return www;
}

for (const scenario of SCENARIOS) {
	test(`khung đầu trang giống www: ${scenario.name}`, { skip: SKIP }, async () => {
		const theirs = wwwWorld()[scenario.name];
		const sources = await loadHeroSources(createMemoryRepository(scenario.posts, { loadSchedule: async () => ({ events: scenario.events, programs: [], themes: [], quotes: [] }) }));
		const mine = heroFrames(scenario.settings["home.hero"], sources, new Date(scenario.now));

		assert.deepEqual(mine.map((f) => f.id), theirs.map((f) => f.id), "cùng các khung, cùng thứ tự");
		mine.forEach((frame, i) => {
			const www = theirs[i];
			const what = `${scenario.name} / ${frame.id}`;
			assert.equal(frame.overline, www.overline, `${what}: dòng nhỏ phía trên`);
			assert.equal(frame.title, www.title.toLocaleUpperCase("vi"), `${what}: tiêu đề`);
			assert.equal(frame.subtitle, www.subtitle.toLocaleUpperCase("vi"), `${what}: dòng phụ`);
			if (frame.kind === "default") {
				// Chỗ khác có chủ ý: V3 không bịa đoạn chữ và nút cho khung có sẵn (www lấy từ site.intro và site.hero.link của nó).
				assert.equal(frame.text, "");
				assert.equal(frame.cta, null);
				return;
			}
			assert.equal(frame.text, www.text, `${what}: đoạn chữ`);
			if (frame.kind === "latest") assert.deepEqual(frame.cta, { label: www.link.label, href: www.link.href, external: false }, `${what}: nút`);
			else if (frame.kind === "event") {
				assert.equal(frame.cta?.label, www.link.label, `${what}: nhãn nút`);
				// V3 có trang riêng cho từng sự kiện; www dẫn tới thẻ của sự kiện trên trang lịch của nó.
				const slug = www.link.href.split("#su-kien-")[1];
				assert.equal(frame.cta?.href, `/lich-tu-hoc/${slug}`, `${what}: địa chỉ nút`);
			} else {
				// Khung của admin: có nhãn thì nhãn và địa chỉ như www; nhãn trống thì www vẫn vẽ nút mặc định còn V3 không vẽ nút.
				if (frame.cta) assert.deepEqual({ label: frame.cta.label, href: frame.cta.href }, www.link, `${what}: nút`);
			}
		});
	});
}
