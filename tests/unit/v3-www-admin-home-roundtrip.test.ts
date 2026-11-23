// Khứ hồi admin www -> TRANG CHỦ V3: người biên tập đổi gì ở admin dùng chung (qua ĐÚNG API của admin, bằng CHÍNH mã admin của www trên một
// SQLite đã migrate) thì trang chủ V3 phải hiện đúng điều đó; rồi họ sửa tiếp, ẩn, xóa, thì V3 phải đi theo.
//
// Mỗi tình huống: tests/helpers/www-home-world.mjs (tiến trình con chạy bằng tsx của www, giữ thế giới admin trong bộ nhớ) nhận lệnh từng bước.
// Sau mỗi bước ghi, kiểm thử xin một BẢN SAO SQLite (`view()`), mở chỉ-đọc rồi đọc bằng ĐÚNG các lớp đọc mà src/app/page.tsx dùng:
//   hero      readSettings + loadHeroSources + heroFromSettings   (v3-home-content.ts, v3-home-hero.ts)   home.hero, home.welcome (video)
//   welcome   loadHomeWelcome                                      (v3-home-welcome.ts)                   home.welcome, home.stats, home.buddhist_year
//   quotes    loadHomeQuotes                                       (v3-home-quotes.ts)                    home.quotes + bảng quote + chủ đề tháng
//   news      loadHomeNews                                         (v3-home-news.ts)                      Tin mới nhất
//   tiles     buildDharmaFeatured + dharmaTilesFrom                (v3-dharma.ts)                         Dấu ấn hoằng pháp
//   gallery   readFeaturedAreaIds + homeGallery                    (v3-home.ts)                           khu vực nổi bật
//   calendar  toScheduleData + monthEvents + resolveMonthTheme     (v3-data.ts, v3-calendar.ts)           lịch tu học, chủ đề tháng, khóa lễ thường kỳ
//   programs  loadHomePrograms                                     (v3-home-programs.ts)                  Các chương trình cộng tu
//   chrome    readSettings + buildChrome                           (v3-chrome.ts, v3-menu.ts)             site.info (mạng xã hội, bản đồ), thông báo
// Điều đúng/sai được xác định ĐỘC LẬP với V3: từ phản hồi của admin, từ SQL viết riêng ở đây trên bản sao, và (lịch, Phật lịch) từ hàm của www.
// Ngày giờ: mọi bộ đọc nhận một `now` cố định (NOW, trưa 23/11/2026 giờ Việt Nam) nên kết quả không phụ thuộc đồng hồ máy; riêng bộ lọc "hẹn giờ
// đã tới" của D1 dùng đồng hồ SQLite thật, nên các bài hẹn giờ ở đây đặt cách hiện tại ít nhất vài ngày.
//
// Chạy:  TLHP_WWW_SRC=E:/tlhp-av3/src npm test      (hoặc chỉ tệp này: ... node --import ./scripts/test-register.mjs --test tests/unit/v3-www-admin-home-roundtrip.test.ts)
// Không đặt TLHP_WWW_SRC (hoặc www thiếu node_modules/tsx, migrations/) thì mọi kiểm thử bên dưới bị bỏ qua, như v3-www-admin-roundtrip.test.ts.
// Không chạm Cloudflare thật; tệp tạm nằm trong thư mục tạm của hệ điều hành và bị xóa khi xong.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { MONTH_THEMES } from "@/data/schedule-data";
import { toSlug } from "@/lib/schedule-detail";
import { MEDIA_BASE } from "@/lib/tlhp-content/media";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { readSettings } from "@/lib/tlhp-site/siteData";
import { buildChrome } from "@/lib/v3-chrome";
import { REGULAR_CATEGORY, monthEvents, resolveMonthTheme, type CalendarPayload } from "@/lib/v3-calendar";
import { toScheduleData } from "@/lib/v3-data";
import { buildDharmaFeatured, dharmaTilesFrom } from "@/lib/v3-dharma";
import { FEATURED_AREA_PICKS, homeGallery, readFeaturedAreaIds } from "@/lib/v3-home";
import { DEFAULT_HERO_VIDEO_ID, heroFromSettings } from "@/lib/v3-home-content";
import { DEFAULT_FRAME, loadHeroSources } from "@/lib/v3-home-hero";
import { loadHomeNews } from "@/lib/v3-home-news";
import { loadHomePrograms } from "@/lib/v3-home-programs";
import { loadHomeQuotes } from "@/lib/v3-home-quotes";
import { DEFAULT_VIDEO_LABEL, loadHomeWelcome } from "@/lib/v3-home-welcome";
import { liveAreas, livePost, livePosts, liveTongChiList } from "@/lib/v3-live";
import { NO_LINKS } from "@/lib/v3-statues";
import { d1Over } from "../helpers/d1";

const WWW_SRC = process.env.TLHP_WWW_SRC;
const WWW = WWW_SRC ? path.resolve(WWW_SRC, "..") : "";
const TSX = path.join(WWW, "node_modules", "tsx", "dist", "cli.mjs");
const WORKER = path.resolve("tests/helpers/www-home-world.mjs");

const SKIP: string | false =
	WWW_SRC && existsSync(TSX) && existsSync(path.join(WWW, "migrations"))
		? false
		: "TLHP_WWW_SRC chưa đặt (thư mục src của www, cần có node_modules/tsx và migrations/): bỏ qua khứ hồi admin www -> trang chủ V3";

const tmp = SKIP ? "" : mkdtempSync(path.join(tmpdir(), "tlhp-home-roundtrip-"));
after(() => {
	if (tmp) rmSync(tmp, { recursive: true, force: true });
});

// ------------------------------------------------------------------------------------------------ thế giới admin (tiến trình con)

type Call = { status: number; data: any; error: any };
type View = { sqlite: DatabaseSync; d1: ReturnType<typeof d1Over>; repo: () => ReturnType<typeof createD1Repository>; rows: <T = Record<string, unknown>>(sql: string, ...params: unknown[]) => T[] };
type World = {
	/** Gọi API admin như trình duyệt của Super Admin; không ném lỗi, trả trạng thái để kiểm thử cả trường hợp admin từ chối. */
	call: (method: string, path: string, body?: unknown) => Promise<Call>;
	/** Như `call` nhưng đòi thành công và trả `data`. */
	must: (method: string, path: string, body: unknown, what: string) => Promise<any>;
	sql: (sql: string, ...params: unknown[]) => Promise<number>;
	ask: (msg: Record<string, unknown>) => Promise<any>;
	/** Một bản sao SQLite nguyên vẹn của thế giới ở thời điểm này, mở chỉ-đọc. */
	view: () => Promise<View>;
	stop: () => Promise<void>;
};

async function startWorld(): Promise<World> {
	const dir = mkdtempSync(path.join(tmp, "w-"));
	const child = spawn(process.execPath, [TSX, WORKER, WWW], { cwd: WWW, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(WWW, "tsconfig.json") }, stdio: ["pipe", "pipe", "pipe"] });
	let stderr = "";
	child.stderr.on("data", (chunk) => (stderr += chunk));
	const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
	let ready: { resolve: () => void; reject: (error: Error) => void };
	const readyPromise = new Promise<void>((resolve, reject) => (ready = { resolve, reject }));
	const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
	child.on("exit", (code) => {
		const error = new Error(`tiến trình thế giới admin www thoát (mã ${code}):\n${stderr}`);
		ready.reject(error);
		for (const entry of pending.values()) entry.reject(error);
		pending.clear();
	});
	createInterface({ input: child.stdout }).on("line", (line) => {
		if (!line.startsWith("@@")) return;
		const msg = JSON.parse(line.slice(2));
		if (msg.ready) return ready.resolve();
		const entry = pending.get(msg.id);
		pending.delete(msg.id);
		if (msg.ok) entry?.resolve(msg.result);
		else entry?.reject(new Error(msg.error));
	});

	let seq = 0;
	const ask = (msg: Record<string, unknown>) =>
		new Promise<any>((resolve, reject) => {
			const id = ++seq;
			const timer = setTimeout(() => reject(new Error(`thế giới admin www không trả lời lệnh ${String(msg.op)} trong 60 giây`)), 60_000);
			pending.set(id, { resolve: (value) => (clearTimeout(timer), resolve(value)), reject: (error) => (clearTimeout(timer), reject(error)) });
			child.stdin.write(`${JSON.stringify({ id, ...msg })}\n`);
		});
	const startTimer = setTimeout(() => ready.reject(new Error(`thế giới admin www không sẵn sàng trong 60 giây:\n${stderr}`)), 60_000);
	await readyPromise;
	clearTimeout(startTimer);

	const views: DatabaseSync[] = [];
	let snapshots = 0;
	const call: World["call"] = async (method, route, body) => (await ask({ op: "call", method, path: route, body })) as Call;
	return {
		call,
		ask,
		async must(method, route, body, what) {
			const res = await call(method, route, body);
			assert.ok(res.status < 300, `${what}: admin trả ${res.status} ${JSON.stringify(res.error)}`);
			return res.data;
		},
		async sql(statement, ...params) {
			return (await ask({ op: "sql", sql: statement, params })).changes as number;
		},
		async view() {
			mkdirSync(dir, { recursive: true });
			const file = path.join(dir, `v${++snapshots}.sqlite`);
			await ask({ op: "snapshot", file });
			const sqlite = new DatabaseSync(file, { readOnly: true });
			views.push(sqlite);
			const d1 = d1Over(sqlite);
			return { sqlite, d1, repo: () => createD1Repository(d1), rows: <T = Record<string, unknown>>(statement: string, ...params: unknown[]) => sqlite.prepare(statement).all(...(params as never[])) as T[] };
		},
		async stop() {
			// Windows không xóa được tệp SQLite còn mở.
			for (const sqlite of views) sqlite.close();
			if (child.exitCode === null) child.stdin.write(`${JSON.stringify({ op: "stop" })}\n`);
			await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
			if (child.exitCode === null) child.kill();
			rmSync(dir, { recursive: true, force: true });
		},
	};
}

/** Mỗi tình huống một thế giới admin riêng (mới khởi động chưa tới một giây), để các tình huống không dính vào nhau. */
function scenario(name: string, body: (w: World) => Promise<void>) {
	test(name, { skip: SKIP }, async () => {
		const w = await startWorld();
		try {
			await body(w);
		} finally {
			await w.stop();
		}
	});
}

// ------------------------------------------------------------------------------------------------ hằng số và công cụ của admin

/** Trưa 23/11/2026 giờ Việt Nam: thời điểm V3 tính "còn mấy ngày", Phật lịch, chủ đề tháng này và hạn của thông báo. */
const NOW = new Date("2026-11-23T05:00:00.000Z");
const DC = "dong-chay-hoang-phap";
const TT = "tri-tue-phat-phap";
const CAT_DC = `post:${DC}:cong-tu`;
const CAT_BV = `post:${TT}:bai-viet`;

/** Khung đầu trang như form admin lưu (đủ trường, đúng giản đồ www). */
const slide = (id: string, over: Record<string, unknown> = {}) => ({ id, enabled: true, title: `Khung ${id}`, subtitle: "", text: "", imageMediaId: null, portraitMediaId: null, imagePosition: "center 50%", ctaLabel: "", ctaHref: "", ...over });
const heroBlock = (slides: unknown[], over: Record<string, unknown> = {}) => ({ slides, autoEvent: false, autoLatest: false, ...over });
const welcomeBlock = (over: Record<string, unknown> = {}) => ({ quote: "", author: "", paragraph: "Chào mừng quý Phật tử về Tùng Lâm Hòa Phúc.", imageMediaId: null, videoUrl: "", linkLabel: "", linkHref: "", ...over });
/** Lưu một khối trang chủ ở dạng đã xuất bản (ghi vào khóa sống home.<khối>). */
const publishBlock = (w: World, block: string, value: unknown) => w.must("PUT", `home/${block}`, { value, publish: true }, `lưu khối ${block}`);

const createPost = (w: World, body: Record<string, unknown>) => w.must("POST", "posts", { section: DC, categoryId: CAT_DC, publishedDate: "2026-11-01", ...body }, `tạo bài ${String(body.title)}`);
const publishPost = (w: World, post: { id: string }) => w.must("POST", `posts/${post.id}/publish`, {}, `xuất bản ${post.id}`);
const hidePost = (w: World, post: { id: string }) => w.must("POST", `posts/${post.id}/hide`, {}, `tạm ẩn ${post.id}`);
const trashPost = async (w: World, post: { id: string }) => void (await w.must("DELETE", `posts/${post.id}`, undefined, `xóa ${post.id}`));
const restorePost = (w: World, post: { id: string }) => w.must("POST", `trash/post/${post.id}/restore`, {}, `khôi phục ${post.id}`);
const editPost = (w: World, post: { id: string; version: number }, patch: Record<string, unknown>) => w.must("PATCH", `posts/${post.id}`, { version: post.version, ...patch }, `sửa ${post.id}`);
/** Bài đã xuất bản, dùng trong hầu hết tình huống. */
async function livePostOf(w: World, body: Record<string, unknown>) {
	return publishPost(w, await createPost(w, body));
}

const createEvent = (w: World, body: Record<string, unknown>) => w.must("POST", "events", { categoryId: "event::cong-tu", status: "published", ...body }, `tạo sự kiện ${String(body.title)}`);
const editEvent = (w: World, event: { id: string; version: number }, patch: Record<string, unknown>) => w.must("PATCH", `events/${event.id}`, { version: event.version, ...patch }, `sửa sự kiện ${event.id}`);

// ------------------------------------------------------------------------------------------------ bộ đọc của V3, đúng như src/app/page.tsx ghép

const heroOf = async (v: View, now = NOW) => heroFromSettings(await readSettings(v.d1), await loadHeroSources(v.repo()), now);
const welcomeOf = (v: View, now = NOW) => loadHomeWelcome(v.d1, { repo: v.repo(), now });
const quotesOf = (v: View, now = NOW) => loadHomeQuotes(v.repo(), v.d1, now);
const newsOf = (v: View) => loadHomeNews({ repo: v.repo(), links: NO_LINKS });
const programsOf = (v: View) => loadHomePrograms(v.repo());
const chromeOf = async (v: View, now = NOW) => buildChrome({ areas: [], failed: false, nodes: null, settings: await readSettings(v.d1) }, now.getTime());
async function tilesOf(v: View) {
	const repo = v.repo();
	const posts = [...(await livePosts(DC, repo)), ...(await livePosts(TT, repo))];
	return dharmaTilesFrom(buildDharmaFeatured(posts, await liveTongChiList(repo), []));
}
async function galleryOf(v: View) {
	return homeGallery(await liveAreas(v.repo()), [], await readFeaturedAreaIds(v.d1));
}
/** Dữ liệu lịch như /api/admin/schedule gửi cho trang chủ (toScheduleData trên bản ghi lịch của D1). */
async function scheduleOf(v: View) {
	return toScheduleData(await v.repo().getSchedule()) as unknown as CalendarPayload;
}
async function calendarOf(v: View, year: number, month0: number) {
	return monthEvents(await scheduleOf(v), year, month0);
}

const mediaKey = (v: View, id: string) => v.rows<{ r2_key: string }>("select r2_key from media where id = ?", id)[0].r2_key;
const upper = (text: string) => text.toLocaleUpperCase("vi");

// ================================================================================================ 1. KHUNG ĐẦU TRANG (home.hero)

scenario("hero: admin sửa tiêu đề, phụ đề, đoạn chữ và nút bấm của khung thì V3 đổi theo, đúng thứ tự admin xếp", async (w) => {
	const start = await heroOf(await w.view());
	assert.deepEqual(start.frames.map((f) => f.id), [DEFAULT_FRAME.id], "chưa có gì ở admin: V3 giữ khung có sẵn");
	assert.equal(start.title, DEFAULT_FRAME.title);

	await publishBlock(w, "hero", heroBlock([
		slide("a", { title: "Vu Lan báo hiếu", subtitle: "Rằm tháng Bảy", text: "Mời cả nhà về chùa", ctaLabel: "Đăng ký", ctaHref: "/lich-tu-hoc" }),
		slide("b", { title: "Khóa tu mùa đông", ctaLabel: "Xem chi tiết", ctaHref: "https://example.test/dang-ky" }),
	]));
	let hero = await heroOf(await w.view());
	assert.deepEqual(hero.frames.map((f) => f.id), ["tuy-chinh-a", "tuy-chinh-b"]);
	assert.deepEqual(
		{ kind: hero.frames[0].kind, title: hero.frames[0].title, subtitle: hero.frames[0].subtitle, text: hero.frames[0].text, cta: hero.frames[0].cta },
		{ kind: "custom", title: "VU LAN BÁO HIẾU", subtitle: "RẰM THÁNG BẢY", text: "Mời cả nhà về chùa", cta: { label: "Đăng ký", href: "/lich-tu-hoc", external: false } },
	);
	assert.deepEqual(hero.frames[1].cta, { label: "Xem chi tiết", href: "https://example.test/dang-ky", external: true }, "địa chỉ https là liên kết ngoài");
	assert.equal(hero.frames[1].subtitle, "", "khung không phụ đề: V3 không vẽ dòng phụ");
	assert.equal(hero.title, "VU LAN BÁO HIẾU", "tiêu đề đầu trang là của khung đầu tiên");
	assert.equal(hero.subtitle, "RẰM THÁNG BẢY");

	// Sửa khung a và xếp b lên trước.
	await publishBlock(w, "hero", heroBlock([
		slide("b", { title: "Khóa tu mùa đông", ctaLabel: "Xem chi tiết", ctaHref: "https://example.test/dang-ky" }),
		slide("a", { title: "Vu Lan 2026 (đã sửa)", subtitle: "", text: "Chữ mới", ctaLabel: "", ctaHref: "" }),
	]));
	hero = await heroOf(await w.view());
	assert.deepEqual(hero.frames.map((f) => f.id), ["tuy-chinh-b", "tuy-chinh-a"], "thứ tự admin xếp");
	assert.equal(hero.frames[1].title, "VU LAN 2026 (ĐÃ SỬA)");
	assert.equal(hero.frames[1].text, "Chữ mới");
	assert.equal(hero.frames[1].cta, null, "bỏ nhãn nút thì không còn nút");
	assert.equal(hero.title, "KHÓA TU MÙA ĐÔNG");
});

scenario("hero: nút bấm có nhãn mà bỏ trống địa chỉ thì V3 dẫn về trang mặc định của www (/gioi-thieu), như www", async (w) => {
	await publishBlock(w, "hero", heroBlock([slide("a", { ctaLabel: "Tìm hiểu", ctaHref: "" })]));
	const hero = await heroOf(await w.view());
	assert.deepEqual(hero.frames[0].cta, { label: "Tìm hiểu", href: "/gioi-thieu", external: false });
});

scenario("hero: admin tắt một khung thì khung đó biến mất; tắt hết thì V3 về khung có sẵn; bật lại thì hiện lại", async (w) => {
	const both = (aOn: boolean, bOn: boolean) => heroBlock([slide("a", { title: "Khung A", enabled: aOn }), slide("b", { title: "Khung B", enabled: bOn })]);
	await publishBlock(w, "hero", both(true, true));
	assert.deepEqual((await heroOf(await w.view())).frames.map((f) => f.id), ["tuy-chinh-a", "tuy-chinh-b"]);

	await publishBlock(w, "hero", both(false, true));
	const onlyB = await heroOf(await w.view());
	assert.deepEqual(onlyB.frames.map((f) => f.id), ["tuy-chinh-b"], "khung A đã tắt");
	assert.equal(onlyB.title, "KHUNG B");

	await publishBlock(w, "hero", both(false, false));
	const none = await heroOf(await w.view());
	assert.deepEqual(none.frames.map((f) => f.id), [DEFAULT_FRAME.id], "tắt hết: V3 không để trống đầu trang");

	await publishBlock(w, "hero", both(true, false));
	assert.deepEqual((await heroOf(await w.view())).frames.map((f) => f.id), ["tuy-chinh-a"], "bật lại khung A");
});

scenario("hero: bản nháp admin chưa xuất bản không lên trang; xuất bản bản nháp thì lên; bỏ bản nháp thì trang vẫn giữ bản sống", async (w) => {
	await publishBlock(w, "hero", heroBlock([slide("a", { title: "Bản sống" })]));
	await w.must("PUT", "home/hero", { value: heroBlock([slide("a", { title: "Bản nháp" })]) }, "lưu nháp");
	let view = await w.view();
	assert.equal(view.rows("select key from setting where key = 'home.hero.draft'").length, 1, "admin có lưu bản nháp");
	assert.equal((await heroOf(view)).title, "BẢN SỐNG", "nháp chưa lên trang chủ");

	await w.must("POST", "home/hero/publish", {}, "xuất bản bản nháp");
	view = await w.view();
	assert.equal(view.rows("select key from setting where key = 'home.hero.draft'").length, 0, "xuất bản xong, nháp biến mất");
	assert.equal((await heroOf(view)).title, "BẢN NHÁP", "bản nháp đã thành bản sống");

	await w.must("PUT", "home/hero", { value: heroBlock([slide("a", { title: "Nháp thứ hai" })]) }, "lưu nháp lần hai");
	await w.must("DELETE", "home/hero/draft", undefined, "bỏ nháp");
	assert.equal((await heroOf(await w.view())).title, "BẢN NHÁP", "bỏ nháp không đụng tới bản sống");
});

scenario("hero: khóa tu sắp tới do admin tạo hiện thành khung tự động (còn mấy ngày, giờ, nơi); ẩn, xóa hoặc tắt công tắc thì mất", async (w) => {
	assert.ok(!(await heroOf(await w.view())).frames.some((f) => f.kind === "event"), "chưa có sự kiện: không có khung tự động");

	const event = await createEvent(w, { title: "Khóa tu cuối tuần", startDate: "2026-11-25", location: "Giảng Đường", times: [{ label: "Khai khóa", time: "06h30" }] });
	let hero = await heroOf(await w.view());
	const frame = hero.frames.find((f) => f.kind === "event");
	assert.ok(frame, "khung khóa tu sắp tới");
	assert.equal(frame.id, `khoa-tu-${event.id}`);
	assert.equal(frame.overline, "Khóa tu sắp tới · Còn 2 ngày", "25/11 cách 23/11 hai ngày");
	assert.equal(frame.title, "KHÓA TU CUỐI TUẦN");
	assert.ok(frame.text.includes("Khai khóa 06h30") && frame.text.includes("Giảng Đường"), `giờ và nơi trong khung: ${frame.text}`);
	assert.equal(frame.cta?.href, `/lich-tu-hoc/${event.slug}`, "nút dẫn tới trang chi tiết của sự kiện");

	// Tắt công tắc "khóa tu sắp tới" trong khối hero: khung tự động bỏ đi dù sự kiện vẫn hiện.
	await publishBlock(w, "hero", heroBlock([slide("a")], { autoEvent: false }));
	assert.ok(!(await heroOf(await w.view())).frames.some((f) => f.kind === "event"), "công tắc autoEvent tắt");
	await publishBlock(w, "hero", heroBlock([slide("a")], { autoEvent: true }));
	assert.ok((await heroOf(await w.view())).frames.some((f) => f.kind === "event"), "công tắc autoEvent bật");

	// Sự kiện tạm ẩn, rồi hiện lại, rồi vào thùng rác.
	const hidden = await editEvent(w, event, { status: "hidden" });
	assert.ok(!(await heroOf(await w.view())).frames.some((f) => f.kind === "event"), "sự kiện tạm ẩn không còn trong khung");
	await editEvent(w, hidden, { status: "published" });
	assert.ok((await heroOf(await w.view())).frames.some((f) => f.kind === "event"), "đăng lại thì hiện");
	await w.must("DELETE", `events/${event.id}`, undefined, "xóa sự kiện");
	hero = await heroOf(await w.view());
	assert.ok(!hero.frames.some((f) => f.kind === "event"), "sự kiện vào thùng rác không còn trong khung");
});

scenario("hero: bài mới nhất có ảnh hiện thành khung tự động 'Pháp sự mới nhất'; tạm ẩn, vào thùng rác thì mất, khôi phục thì về", async (w) => {
	assert.ok(!(await heroOf(await w.view())).frames.some((f) => f.kind === "latest"), "bài nhập từ web cũ không có ảnh nên không thành khung");

	const post = await livePostOf(w, { title: "Đại lễ Vu Lan", publishedDate: "2026-11-22", summary: "Lễ báo hiếu lớn", bannerMediaId: "media-b" });
	let frame = (await heroOf(await w.view())).frames.find((f) => f.kind === "latest");
	assert.ok(frame, "khung bài mới nhất");
	assert.deepEqual(
		{ id: frame.id, overline: frame.overline, title: frame.title, text: frame.text, href: frame.cta?.href },
		{ id: `bai-${post.id}`, overline: "Pháp sự mới nhất · 22/11/2026", title: "ĐẠI LỄ VU LAN", text: "Lễ báo hiếu lớn", href: `/${DC}/${post.slug}` },
	);

	const edited = await editPost(w, post, { title: "Đại lễ Vu Lan (đã sửa)", summary: "Tóm tắt mới" });
	frame = (await heroOf(await w.view())).frames.find((f) => f.kind === "latest");
	assert.equal(frame?.title, "ĐẠI LỄ VU LAN (ĐÃ SỬA)");
	assert.equal(frame?.text, "Tóm tắt mới");

	const hidden = await hidePost(w, edited);
	assert.ok(!(await heroOf(await w.view())).frames.some((f) => f.kind === "latest"), "bài tạm ẩn");
	await publishPost(w, hidden);
	assert.ok((await heroOf(await w.view())).frames.some((f) => f.kind === "latest"), "đăng lại");
	await trashPost(w, hidden);
	assert.ok(!(await heroOf(await w.view())).frames.some((f) => f.kind === "latest"), "bài trong thùng rác");
	await restorePost(w, hidden);
	assert.ok((await heroOf(await w.view())).frames.some((f) => f.kind === "latest"), "khôi phục");

	await publishBlock(w, "hero", heroBlock([slide("a")], { autoLatest: false }));
	assert.ok(!(await heroOf(await w.view())).frames.some((f) => f.kind === "latest"), "công tắc autoLatest tắt");
});

scenario("hero: video nền theo ô 'video giới thiệu' của Lời chào; đổi, bỏ trống thì V3 đổi theo (video có sẵn chỉ cắt đoạn đầu)", async (w) => {
	assert.equal((await heroOf(await w.view())).videoId, DEFAULT_HERO_VIDEO_ID);

	await publishBlock(w, "welcome", welcomeBlock({ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }));
	let hero = await heroOf(await w.view());
	assert.equal(hero.videoId, "dQw4w9WgXcQ");
	assert.equal(hero.cutIntro, false, "video khác thì phát nguyên");

	await publishBlock(w, "welcome", welcomeBlock({ videoUrl: "https://youtu.be/aaaaaaaaaaa" }));
	assert.equal((await heroOf(await w.view())).videoId, "aaaaaaaaaaa");

	await publishBlock(w, "welcome", welcomeBlock({ videoUrl: "" }));
	hero = await heroOf(await w.view());
	assert.equal(hero.videoId, DEFAULT_HERO_VIDEO_ID, "bỏ trống: về video có sẵn");
	assert.equal(hero.cutIntro, true);

	const bad = await w.call("PUT", "home/welcome", { value: welcomeBlock({ videoUrl: "https://example.test/video.mp4" }), publish: true });
	assert.equal(bad.status, 400, "admin từ chối địa chỉ không phải YouTube nên không bao giờ tới V3");
});

scenario("hero: khi admin tắt hết khung thì công tắc tự động bị bỏ qua và khung tự động trở lại: V3 làm đúng như www (ghi lại hiện trạng chung)", async (w) => {
	// Cả www (src/libs/home.ts) và V3 đọc cài đặt bằng readHero, mà readHero trả `null` khi không còn khung nào bật: khi đó công tắc autoEvent/autoLatest
	// không còn được đọc và coi như bật. Biên tập viên tắt hết khung VÀ tắt hai công tắc vẫn thấy khung tự động. Đây là hành vi chung của hai trang, không phải
	// lệch giữa V3 và www; nếu www đổi quy tắc thì phải đổi cả hai, và kiểm thử này sẽ báo.
	await createEvent(w, { title: "Khóa tu tới", startDate: "2026-11-25" });
	await publishBlock(w, "hero", heroBlock([slide("a", { enabled: false })], { autoEvent: false, autoLatest: false }));
	const hero = await heroOf(await w.view());
	assert.deepEqual(hero.frames.map((f) => f.kind), ["default", "event"]);
});

// ================================================================================================ 2. LỜI CHÀO (home.welcome)

scenario("welcome: admin sửa câu trích, tác giả, đoạn chữ, ảnh, nút và video thì V3 đổi theo; xóa bớt thì lùi về mặc định", async (w) => {
	assert.equal(await welcomeOf(await w.view()), null, "chưa có cài đặt và chưa có chủ đề Lịch Sử Chùa: V3 không vẽ khối");

	await publishBlock(w, "welcome", welcomeBlock({
		quote: "Tâm an thì vạn sự an",
		author: "Sư Tổ",
		paragraph: "Chùa là nơi để trở về.",
		imageMediaId: "media-a",
		videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		linkLabel: "Đọc thêm",
		linkHref: "/gioi-thieu/lich-su",
	}));
	let view = await w.view();
	let welcome = await welcomeOf(view);
	assert.ok(welcome);
	assert.equal(welcome.title, "Tâm an thì vạn sự an");
	assert.equal(welcome.author, "Sư Tổ");
	assert.equal(welcome.text, "Chùa là nơi để trở về.");
	assert.deepEqual(welcome.link, { label: "Đọc thêm", href: "/gioi-thieu/lich-su" });
	assert.equal(welcome.image?.src, `${MEDIA_BASE}/${mediaKey(view, "media-a")}`, "ảnh admin chọn trong thư viện");
	assert.equal(welcome.video.id, "dQw4w9WgXcQ");
	assert.notEqual(welcome.video.label, DEFAULT_VIDEO_LABEL, "video khác thì nhãn khác nhãn của video có sẵn");

	// Sửa lại chữ, đổi video và ảnh.
	await publishBlock(w, "welcome", welcomeBlock({ quote: "Buông xả", author: "", paragraph: "Chữ đã sửa.", imageMediaId: "media-b", videoUrl: "https://youtu.be/bbbbbbbbbbb", linkLabel: "", linkHref: "" }));
	view = await w.view();
	welcome = await welcomeOf(view);
	assert.equal(welcome?.title, "Buông xả");
	assert.equal(welcome?.text, "Chữ đã sửa.");
	assert.equal(welcome?.image?.src, `${MEDIA_BASE}/${mediaKey(view, "media-b")}`);
	assert.equal(welcome?.video.id, "bbbbbbbbbbb");
	assert.equal(welcome?.link.href, "/gioi-thieu", "không nhập địa chỉ nút: về trang mặc định");

	// Bỏ video và ảnh.
	await publishBlock(w, "welcome", welcomeBlock({ quote: "Buông xả", videoUrl: "", imageMediaId: null }));
	welcome = await welcomeOf(await w.view());
	assert.equal(welcome?.video.id, DEFAULT_HERO_VIDEO_ID);
	assert.equal(welcome?.video.label, DEFAULT_VIDEO_LABEL);
	assert.equal(welcome?.image, null);
});

scenario("welcome: ảnh admin chọn rồi bị đưa vào thùng rác thì V3 không dẫn tới ảnh đã xóa", async (w) => {
	await publishBlock(w, "welcome", welcomeBlock({ imageMediaId: "media-a" }));
	assert.ok((await welcomeOf(await w.view()))?.image, "đang có ảnh");
	const res = await w.call("DELETE", "media/media-a");
	if (res.status >= 300) {
		// Admin không cho xóa ảnh đang được trang chủ dùng: cũng là một cách bảo vệ trang chủ, ghi nhận rồi dừng.
		assert.ok([400, 409].includes(res.status), `admin từ chối xóa ảnh đang dùng bằng 400/409, nhận ${res.status}`);
		return;
	}
	assert.equal((await welcomeOf(await w.view()))?.image, null, "ảnh đã xóa không còn trên trang");
});

// ================================================================================================ 3. SỐ LIỆU (home.stats) VÀ PHẬT LỊCH (home.buddhist_year)

const DEFAULT_STAT_LABELS = ["Bài viết Dòng Chảy Hoằng Pháp", "Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp", "Phật lịch"];

scenario("số liệu: chưa cấu hình thì V3 hiện ba số mặc định như www; admin đặt lại nhãn, nguồn, số gõ tay thì V3 đổi theo", async (w) => {
	await publishBlock(w, "welcome", welcomeBlock());
	let view = await w.view();
	const base = (await welcomeOf(view))?.stats ?? [];
	assert.deepEqual(base.map((s) => s.label), DEFAULT_STAT_LABELS);
	assert.deepEqual(base.map((s) => s.value), [1, 0, Number((await w.ask({ op: "www", fn: "buddhistYear", args: ["2026-11-23"] })).value)], "một bài nhập từ web cũ; chưa có bài Trí Tuệ; Phật lịch của www");
	assert.deepEqual(base.map((s) => s.year), [false, false, true]);

	await publishBlock(w, "stats", [
		{ label: "Số bài Dòng Chảy", source: "auto-bai-dong-chay", value: 0 },
		{ label: "Khóa tu trong năm", source: "manual", value: 12 },
	]);
	view = await w.view();
	assert.deepEqual((await welcomeOf(view))?.stats, [
		{ label: "Số bài Dòng Chảy", value: 1, year: false },
		{ label: "Khóa tu trong năm", value: 12, year: false },
	]);

	// Đổi số gõ tay, đổi nhãn, thêm số thứ ba chọn nguồn Trí Tuệ rồi sắp lại thứ tự.
	await publishBlock(w, "stats", [
		{ label: "Phật tử quy y", source: "manual", value: 1500 },
		{ label: "Bài Trí Tuệ", source: "auto-bai-tri-tue", value: 0 },
		{ label: "Khóa tu trong năm", source: "manual", value: 15 },
	]);
	const stats = (await welcomeOf(await w.view()))?.stats;
	assert.deepEqual(stats, [
		{ label: "Phật tử quy y", value: 1500, year: false },
		{ label: "Bài Trí Tuệ", value: 0, year: false },
		{ label: "Khóa tu trong năm", value: 15, year: false },
	]);

	// Admin chỉ nhận tối đa 3 số liệu: lần thứ tư bị từ chối và V3 giữ nguyên.
	const four = await w.call("PUT", "home/stats", { value: [1, 2, 3, 4].map((n) => ({ label: `Số ${n}`, source: "manual", value: n })), publish: true });
	assert.equal(four.status, 400);
	assert.deepEqual((await welcomeOf(await w.view()))?.stats, stats, "V3 giữ bộ số liệu đã lưu");
});

scenario("số liệu tự động: số bài tăng khi admin xuất bản, giảm khi tạm ẩn hoặc xóa, tăng lại khi khôi phục; nháp và hẹn giờ chưa tới không tính", async (w) => {
	await publishBlock(w, "welcome", welcomeBlock());
	await publishBlock(w, "stats", [
		{ label: "Dòng Chảy", source: "auto-bai-dong-chay", value: 0 },
		{ label: "Trí Tuệ", source: "auto-bai-tri-tue", value: 0 },
	]);
	/** Sự thật độc lập: đếm trực tiếp trong bản sao SQLite theo quy tắc hiển thị của admin. */
	const truth = (v: View, section: string) =>
		v.rows<{ n: number }>("select count(*) n from post where section = ? and deleted_at is null and (status = 'published' or (status = 'scheduled' and publish_at <= ?))", section, new Date().toISOString())[0].n;
	const counts = async () => {
		const v = await w.view();
		const stats = (await welcomeOf(v))?.stats ?? [];
		const got = [stats[0]?.value, stats[1]?.value];
		assert.deepEqual(got, [truth(v, DC), truth(v, TT)], "V3 khớp phép đếm độc lập trong D1");
		return got;
	};
	assert.deepEqual(await counts(), [1, 0], "khởi đầu");

	const a = await livePostOf(w, { title: "Bài một" });
	assert.deepEqual(await counts(), [2, 0], "xuất bản một bài Dòng Chảy");
	const t = await livePostOf(w, { title: "Bài trí tuệ", section: TT, categoryId: CAT_BV });
	assert.deepEqual(await counts(), [2, 1], "xuất bản một bài Trí Tuệ");

	await createPost(w, { title: "Bản nháp" });
	const future = await createPost(w, { title: "Hẹn giờ chưa tới" });
	await w.must("POST", `posts/${future.id}/publish`, { publishAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }, "hẹn giờ");
	assert.deepEqual(await counts(), [2, 1], "nháp và hẹn giờ chưa tới không tính");

	const hidden = await hidePost(w, a);
	assert.deepEqual(await counts(), [1, 1], "tạm ẩn một bài");
	await publishPost(w, hidden);
	assert.deepEqual(await counts(), [2, 1], "đăng lại");
	await trashPost(w, a);
	assert.deepEqual(await counts(), [1, 1], "xóa vào thùng rác");
	await restorePost(w, a);
	assert.deepEqual(await counts(), [2, 1], "khôi phục từ thùng rác");
	await trashPost(w, t);
	assert.deepEqual(await counts(), [2, 0], "xóa bài Trí Tuệ");
});

scenario("Phật lịch: để tự động thì V3 ra đúng năm theo ngày hôm nay (bằng hàm của www); admin gõ tay thì V3 hiện đúng số đó; trả về tự động thì về năm tính", async (w) => {
	await publishBlock(w, "welcome", welcomeBlock());
	await publishBlock(w, "stats", [{ label: "Phật lịch", source: "auto-phat-lich", value: 0 }]);
	const www = Number((await w.ask({ op: "www", fn: "buddhistYear", args: ["2026-11-23"] })).value);
	assert.equal(www, 2570, "Phật đản 2026 đã qua nên 23/11/2026 là Phật lịch 2570");
	assert.deepEqual((await welcomeOf(await w.view()))?.stats, [{ label: "Phật lịch", value: 2570, year: true }], "chưa đặt khối Phật lịch: tự động");

	await publishBlock(w, "buddhist_year", { mode: "manual", value: 2599 });
	assert.deepEqual((await welcomeOf(await w.view()))?.stats, [{ label: "Phật lịch", value: 2599, year: true }], "gõ tay");
	await publishBlock(w, "buddhist_year", { mode: "manual", value: 2571 });
	assert.equal((await welcomeOf(await w.view()))?.stats[0].value, 2571, "sửa số gõ tay");

	// Chế độ tự động bỏ qua số đã gõ: ngày khác thì năm khác (trước Phật đản 15/4 âm lịch năm 2027 vẫn là 2570).
	await publishBlock(w, "buddhist_year", { mode: "auto", value: 2599 });
	assert.equal((await welcomeOf(await w.view()))?.stats[0].value, 2570, "tự động: số gõ tay cũ không còn tác dụng");
	const after = new Date("2027-06-30T05:00:00.000Z");
	const wwwAfter = Number((await w.ask({ op: "www", fn: "buddhistYear", args: ["2027-06-30"] })).value);
	assert.equal((await welcomeOf(await w.view(), after))?.stats[0].value, wwwAfter, "qua Phật đản: V3 đổi năm đúng như www");
	assert.equal(wwwAfter, 2571);
});

// ================================================================================================ 4. LỜI THẦY DẠY (home.quotes + bảng quote + chủ đề tháng)

const theme = (w: World, month: number, body: Record<string, unknown>) => w.must("PUT", `events/themes/${month}`, body, `chủ đề tháng ${month}`);

scenario("Lời Thầy: mặc định trượt câu kệ chủ đề tháng (từ tháng này, vòng lại đầu năm, bỏ tháng trống); admin sửa câu kệ thì V3 đổi theo", async (w) => {
	assert.equal(await quotesOf(await w.view()), null, "chưa có câu kệ nào: không vẽ khối");

	await theme(w, 11, { title: "Tri ân", lines: ["Câu kệ tháng mười một"], author: "Thầy A" });
	await theme(w, 3, { title: "Tinh tấn", lines: ["Câu kệ tháng ba"], author: "Thầy B" });
	await theme(w, 12, { title: "Trống", lines: [], author: "" });
	const quotes = await quotesOf(await w.view());
	assert.equal(quotes?.kind, "chu-de-thang");
	assert.equal(quotes?.eyebrow, "Chủ đề tháng 11");
	assert.deepEqual(quotes?.items.map((i) => i.id), ["chu-de-11", "chu-de-3"], "tháng 11 trước, vòng lại tháng 3; tháng 12 không có câu kệ thì bỏ");
	assert.equal(quotes?.items[0].text, "Câu kệ tháng mười một");
	assert.equal(quotes?.items[0].author, "Thầy A");
	assert.equal(quotes?.items[0].source, "Chủ đề tháng 11: Tri ân");

	const updated = await theme(w, 11, { title: "Tri ân (đã sửa)", lines: ["Dòng một", "Dòng <b>hai</b>", "Dòng ba"], author: "Thầy C" });
	const edited = await quotesOf(await w.view());
	const expected = (updated.lines as string[]).map((line) => line.replace(/<[^>]*>/g, "").trim()).filter(Boolean).join("\n");
	assert.equal(edited?.items[0].text, expected, "đúng bản admin đã lưu, bỏ thẻ <b>");
	assert.equal(edited?.items[0].text, "Dòng một\nDòng hai\nDòng ba");
	assert.ok(!edited?.items[0].text.includes("<"), `không lọt thẻ: ${edited?.items[0].text}`);
	assert.equal(edited?.items[0].source, "Chủ đề tháng 11: Tri ân (đã sửa)");

	// Sang tháng 12 (theo `now` của V3), tháng 12 vẫn trống nên đầu vòng là tháng 3 rồi tháng 11.
	const dec = await quotesOf(await w.view(), new Date("2026-12-10T05:00:00.000Z"));
	assert.deepEqual(dec?.items.map((i) => i.id), ["chu-de-3", "chu-de-11"]);
	assert.equal(dec?.eyebrow, "Chủ đề tháng 3");
});

scenario("Lời Thầy: thêm lời dạy, bật nguồn trích dẫn, tắt, sắp xếp, sửa, xóa, khôi phục; hết lời dạy đang bật thì lùi về câu kệ", async (w) => {
	await theme(w, 11, { title: "Tri ân", lines: ["Câu kệ tháng mười một"], author: "Thầy" });
	const q1 = await w.must("POST", "quotes", { text: "Lời dạy thứ nhất", author: "Thầy", source: "Kinh A", sourceUrl: "https://example.test/kinh-a", active: true }, "thêm lời 1");
	const q2 = await w.must("POST", "quotes", { text: "Lời dạy thứ hai", author: "Thầy", active: true }, "thêm lời 2");
	const q3 = await w.must("POST", "quotes", { text: "Lời dạy thứ ba", author: "Thầy", active: true }, "thêm lời 3");

	// Nguồn còn là chủ đề tháng nên lời dạy chưa lên dù đã bật.
	assert.equal((await quotesOf(await w.view()))?.kind, "chu-de-thang", "chưa đổi nguồn: vẫn câu kệ");

	// Nháp của khối nguồn chưa xuất bản thì chưa đổi.
	await w.must("PUT", "home/quotes", { value: { source: "trich-dan", mode: "thu-tu" } }, "nháp nguồn");
	assert.equal((await quotesOf(await w.view()))?.kind, "chu-de-thang", "bản nháp chưa tác dụng");

	await publishBlock(w, "quotes", { source: "trich-dan", mode: "thu-tu" });
	let quotes = await quotesOf(await w.view());
	assert.equal(quotes?.kind, "trich-dan");
	assert.equal(quotes?.eyebrow, "Lời dạy của Thầy");
	assert.deepEqual(quotes?.items.map((i) => i.id), [q1.id, q2.id, q3.id], "thứ tự admin");
	assert.deepEqual(quotes?.items[0], { id: q1.id, text: "Lời dạy thứ nhất", author: "Thầy", source: "Kinh A", sourceUrl: "https://example.test/kinh-a" });

	// Tắt lời thứ hai (bỏ đăng).
	await w.must("PATCH", `quotes/${q2.id}`, { active: false }, "tắt lời 2");
	quotes = await quotesOf(await w.view());
	assert.deepEqual(quotes?.items.map((i) => i.id), [q1.id, q3.id], "lời tắt không lên trang");
	await w.must("PATCH", `quotes/${q2.id}`, { active: true }, "bật lại lời 2");
	assert.deepEqual((await quotesOf(await w.view()))?.items.map((i) => i.id), [q1.id, q2.id, q3.id]);

	// Sắp lại thứ tự, sửa chữ.
	await w.must("POST", "quotes/reorder", { ids: [q3.id, q1.id, q2.id] }, "sắp lại");
	await w.must("PATCH", `quotes/${q1.id}`, { text: "Lời thứ nhất (đã sửa)", sourceUrl: "" }, "sửa lời 1");
	quotes = await quotesOf(await w.view());
	assert.deepEqual(quotes?.items.map((i) => i.id), [q3.id, q1.id, q2.id], "thứ tự mới");
	assert.equal(quotes?.items[1].text, "Lời thứ nhất (đã sửa)");
	assert.equal(quotes?.items[1].sourceUrl, "");

	// Xóa vào thùng rác, rồi khôi phục.
	await w.must("DELETE", `quotes/${q3.id}`, undefined, "xóa lời 3");
	assert.deepEqual((await quotesOf(await w.view()))?.items.map((i) => i.id), [q1.id, q2.id], "lời đã xóa không còn");
	await w.must("POST", `trash/quote/${q3.id}/restore`, {}, "khôi phục lời 3");
	assert.ok((await quotesOf(await w.view()))?.items.some((i) => i.id === q3.id), "khôi phục thì về");

	// Admin không cho địa chỉ nguồn độc hại; lời dạy không bao giờ có địa chỉ đó.
	const bad = await w.call("PATCH", `quotes/${q1.id}`, { sourceUrl: "javascript:alert(1)" });
	assert.equal(bad.status, 400);

	// Xóa hết lời dạy: nguồn vẫn là trích dẫn nhưng không có lời nào đang bật, V3 lùi về câu kệ như www.
	for (const id of [q1.id, q2.id, q3.id]) await w.must("DELETE", `quotes/${id}`, undefined, `xóa ${id}`);
	quotes = await quotesOf(await w.view());
	assert.equal(quotes?.kind, "chu-de-thang", "không còn lời dạy: về câu kệ");
	assert.equal(quotes?.items[0].text, "Câu kệ tháng mười một");
});

scenario("Lời Thầy: đổi nguồn qua lại giữa trích dẫn và chủ đề tháng, và đổi thứ tự thu-tu/ngau-nhien thì V3 theo", async (w) => {
	await theme(w, 11, { title: "Tri ân", lines: ["Câu kệ"], author: "" });
	await w.must("POST", "quotes", { text: "Lời một", active: true }, "lời 1");
	await w.must("POST", "quotes", { text: "Lời hai", active: true }, "lời 2");

	await publishBlock(w, "quotes", { source: "trich-dan", mode: "ngau-nhien" });
	let quotes = await quotesOf(await w.view());
	assert.deepEqual([quotes?.kind, quotes?.mode, quotes?.items.length], ["trich-dan", "ngau-nhien", 2]);
	await publishBlock(w, "quotes", { source: "trich-dan", mode: "thu-tu" });
	assert.equal((await quotesOf(await w.view()))?.mode, "thu-tu");

	await publishBlock(w, "quotes", { source: "chu-de-thang", mode: "ngau-nhien" });
	quotes = await quotesOf(await w.view());
	assert.equal(quotes?.kind, "chu-de-thang", "về chủ đề tháng dù còn lời dạy đang bật");
	assert.equal(quotes?.mode, "thu-tu", "câu kệ không bao giờ xáo trộn");

	await publishBlock(w, "quotes", { source: "trich-dan", mode: "thu-tu" });
	assert.equal((await quotesOf(await w.view()))?.kind, "trich-dan", "về trích dẫn");
});

// ================================================================================================ 5. TIN MỚI NHẤT

const postCards = (cards: Awaited<ReturnType<typeof newsOf>>) => cards.filter((c) => c.sourceType === "dong-chay-hoang-phap" || c.sourceType === "tri-tue-phat-phap");

scenario("Tin mới nhất: bài admin xuất bản hiện thành thẻ (tên, phụ đề, ảnh, ngày, địa chỉ mở được); nháp, tạm ẩn, hẹn giờ, thùng rác thì vắng", async (w) => {
	const baseline = postCards(await newsOf(await w.view())).map((c) => c.id);
	assert.deepEqual(baseline, ["post-1060"], "chỉ có bài nhập từ web cũ");

	const post = await livePostOf(w, { title: "Đại lễ Vu Lan báo hiếu", subtitle: "Rằm tháng Bảy", publishedDate: "2026-11-22", thumbnailMediaId: "media-a" });
	let view = await w.view();
	let cards = postCards(await newsOf(view));
	assert.deepEqual(cards.map((c) => c.id), [post.id, "post-1060"], "bài mới nhất đứng đầu");
	assert.deepEqual(
		{ title: cards[0].title, subtitle: cards[0].subtitle, targetUrl: cards[0].targetUrl, date: cards[0].date, sourceType: cards[0].sourceType },
		{ title: "ĐẠI LỄ VU LAN BÁO HIẾU", subtitle: "Rằm tháng Bảy", targetUrl: `/${DC}/${post.slug}`, date: "2026-11-22", sourceType: DC },
	);
	assert.ok(cards[0].imgUrl.endsWith(`/${mediaKey(view, "media-a")}`), `ảnh thẻ ${cards[0].imgUrl}`);

	// Những bài admin KHÔNG cho hiện.
	await createPost(w, { title: "Bản nháp" });
	await hidePost(w, await publishPost(w, await createPost(w, { title: "Bài tạm ẩn", publishedDate: "2026-11-21" })));
	const future = await createPost(w, { title: "Bài hẹn giờ", publishedDate: "2026-11-21" });
	await w.must("POST", `posts/${future.id}/publish`, { publishAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }, "hẹn giờ");
	await trashPost(w, await publishPost(w, await createPost(w, { title: "Bài đã xóa", publishedDate: "2026-11-21" })));
	cards = postCards(await newsOf(await w.view()));
	assert.deepEqual(cards.map((c) => c.id), [post.id, "post-1060"], "nháp, tạm ẩn, hẹn giờ chưa tới và thùng rác đều vắng");

	// Mọi thẻ bài trỏ tới địa chỉ V3 mở được (không thẻ nào dẫn tới 404).
	view = await w.view();
	for (const card of postCards(await newsOf(view))) {
		const slug = card.targetUrl.split("/").pop() as string;
		assert.ok(await livePost(slug, card.sourceType, view.repo()), `thẻ ${card.targetUrl} phải mở được`);
	}
});

scenario("Tin mới nhất: admin sửa tên, ngày, ghim, đổi địa chỉ, chuyển chuyên trang, ẩn rồi đăng lại, xóa rồi khôi phục thì thẻ đi theo", async (w) => {
	const older = await livePostOf(w, { title: "Bài cũ hơn", publishedDate: "2026-10-01" });
	const post = await livePostOf(w, { title: "Bài đang theo dõi", subtitle: "Phụ đề ban đầu", publishedDate: "2026-11-22" });
	const idsOf = async () => postCards(await newsOf(await w.view())).map((c) => c.id);
	assert.deepEqual(await idsOf(), [post.id, older.id, "post-1060"]);

	// Sửa tên, phụ đề và đổi địa chỉ.
	const edited = await editPost(w, post, { title: "Bài đã đổi tên", subtitle: "Phụ đề mới", slug: "dia-chi-moi" });
	let card = postCards(await newsOf(await w.view()))[0];
	assert.deepEqual({ id: card.id, title: card.title, subtitle: card.subtitle, targetUrl: card.targetUrl }, { id: post.id, title: "BÀI ĐÃ ĐỔI TÊN", subtitle: "Phụ đề mới", targetUrl: `/${DC}/dia-chi-moi` });

	// Ghim bài cũ: lên đầu dù ngày cũ hơn (quy tắc "ghim trước" của www).
	await editPost(w, older, { pinned: true });
	assert.equal((await idsOf())[0], older.id, "bài ghim đứng đầu");
	await editPost(w, await w.must("GET", `posts/${older.id}`, undefined, "đọc bài cũ"), { pinned: false });
	assert.equal((await idsOf())[0], post.id, "bỏ ghim thì về chỗ cũ");

	// Chuyển sang chuyên trang Trí Tuệ.
	const moved = await editPost(w, edited, { section: TT, categoryId: CAT_BV });
	card = postCards(await newsOf(await w.view())).find((c) => c.id === post.id) as typeof card;
	assert.equal(card.sourceType, TT);
	assert.equal(card.targetUrl, `/${TT}/dia-chi-moi`);

	// Ẩn rồi đăng lại; xóa rồi khôi phục.
	const hidden = await hidePost(w, moved);
	assert.ok(!(await idsOf()).includes(post.id), "tạm ẩn");
	await publishPost(w, hidden);
	assert.ok((await idsOf()).includes(post.id), "đăng lại");
	await trashPost(w, post);
	assert.ok(!(await idsOf()).includes(post.id), "thùng rác");
	await restorePost(w, post);
	assert.ok((await idsOf()).includes(post.id), "khôi phục");
});

// ================================================================================================ 6. DẤU ẤN HOẰNG PHÁP (lượt xem)

scenario("Dấu ấn hoằng pháp: bài được đọc nhiều hiện đầu bảng; ẩn, xóa thì mất; sửa tên thì thẻ đổi; khôi phục thì về", async (w) => {
	const post = await livePostOf(w, { title: "Bài được đọc nhiều", publishedDate: "2026-11-20" });
	// Lượt xem do người đọc tạo ra (www cộng legacy_views với page_view), không do người biên tập đặt.
	await w.sql("update post set legacy_views = ? where id = ?", 999_999, post.id);
	let tiles = await tilesOf(await w.view());
	assert.ok(tiles, "có thẻ");
	assert.equal(tiles[0].id, post.id, "đọc nhiều nhất thì đứng đầu");
	assert.equal(tiles[0].viewsCount, 999_999);
	assert.equal(tiles[0].targetUrl, `/${DC}/${post.slug}`);
	assert.equal(tiles[0].publishedDate, "20/11/2026");

	const edited = await editPost(w, post, { title: "Bài đọc nhiều (đã sửa)", summary: "Tóm tắt mới" });
	tiles = await tilesOf(await w.view());
	assert.equal(tiles?.[0].title, "Bài đọc nhiều (đã sửa)");
	assert.equal(tiles?.[0].description, "Tóm tắt mới");

	const hidden = await hidePost(w, edited);
	assert.ok(!(await tilesOf(await w.view()))?.some((t) => t.id === post.id), "tạm ẩn thì mất khỏi Dấu ấn");
	await publishPost(w, hidden);
	assert.equal((await tilesOf(await w.view()))?.[0].id, post.id, "đăng lại thì về đầu bảng");
	await trashPost(w, post);
	assert.ok(!(await tilesOf(await w.view()))?.some((t) => t.id === post.id), "vào thùng rác thì mất");
	await restorePost(w, post);
	assert.equal((await tilesOf(await w.view()))?.[0].id, post.id, "khôi phục thì về");
});

scenario("Dấu ấn hoằng pháp: bản nháp và bài hẹn giờ chưa tới không bao giờ lên dù nhiều lượt xem", async (w) => {
	const draft = await createPost(w, { title: "Bản nháp nhiều xem" });
	const future = await createPost(w, { title: "Hẹn giờ nhiều xem" });
	await w.must("POST", `posts/${future.id}/publish`, { publishAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }, "hẹn giờ");
	await w.sql("update post set legacy_views = 5000000 where id in (?, ?)", draft.id, future.id);
	const tiles = await tilesOf(await w.view());
	assert.ok(tiles && !tiles.some((t) => t.id === draft.id || t.id === future.id));
});

// ================================================================================================ 7. LỊCH TU HỌC

const pad = (n: number) => String(n).padStart(2, "0");
const isRegular = (id: unknown) => /^p\d+-\d{4}-\d{2}-\d{2}$/.test(String(id));

/** Lịch của một tháng theo V3, tách sự kiện riêng và ngày khóa lễ thường kỳ, mỗi mục là "ngày:mã". */
async function v3Month(v: View, year: number, month0: number) {
	const { byDay, source } = await calendarOf(v, year, month0);
	const own: string[] = [];
	const regular: string[] = [];
	for (const [day, events] of Object.entries(byDay)) {
		for (const event of events) (isRegular(event.id) ? regular : own).push(isRegular(event.id) ? `${day}:${String(event.id).split("-")[0]}` : `${day}:${event.id}`);
	}
	return { own: own.sort(), regular: regular.sort(), source, byDay };
}

/** Lịch của cùng tháng theo CHÍNH mã đọc lịch của www trên cùng dữ liệu, trải ra từng ngày để so với V3. */
async function wwwMonth(w: World, year: number, month0: number) {
	const month = `${year}-${pad(month0 + 1)}`;
	const got = await w.ask({ op: "wwwCalendar", month });
	const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
	const own: string[] = [];
	for (const e of got.events as { id: string; start: string; end: string }[]) {
		for (let day = 1; day <= last; day++) {
			const iso = `${month}-${pad(day)}`;
			if (iso >= e.start && iso <= e.end) own.push(`${day}:${e.id}`);
		}
	}
	const regular = (got.regular as { start: string; programId: string }[]).map((e) => `${Number(e.start.slice(8))}:${e.programId}`);
	return { own: own.sort(), regular: regular.sort() };
}

/** Lịch V3 phải bằng lịch www ở tháng đó, từng ngày (cả sự kiện riêng lẻ lẫn khóa lễ thường kỳ). */
async function assertCalendarMatchesWww(w: World, year: number, month0: number, what: string) {
	const v3 = await v3Month(await w.view(), year, month0);
	const www = await wwwMonth(w, year, month0);
	assert.deepEqual({ own: v3.own, regular: v3.regular }, www, `${what}: lịch tháng ${month0 + 1}/${year} của V3 khác của www`);
	return v3;
}

scenario("lịch: sự kiện admin tạo hiện đúng ngày với giờ, nơi, loại; nháp, tạm ẩn, xóa thì vắng; đăng lại, khôi phục thì về; dời ngày thì chỉ ở ngày mới", async (w) => {
	const base = await assertCalendarMatchesWww(w, 2026, 10, "khởi đầu");
	assert.equal(base.source, "d1", "có khóa lễ thường kỳ nên lịch lấy từ D1");
	assert.deepEqual(base.own, [], "chưa có sự kiện riêng");

	const event = await createEvent(w, { title: "Cộng tu một ngày an lạc", startDate: "2026-11-25", location: "Giảng đường", times: [{ label: "Khai khóa", time: "06h30" }, { label: "Hoàn mãn", time: "16h00" }] });
	let month = await assertCalendarMatchesWww(w, 2026, 10, "đã xuất bản");
	let cell = (await v3Month(await w.view(), 2026, 10)).byDay[25].find((e) => e.id === event.id);
	assert.ok(cell, "sự kiện ở ngày 25");
	assert.deepEqual(
		{ title: cell.title, location: cell.location, slot1: [cell.timeSlot1Label, cell.timeSlot1Time], slot2: [cell.timeSlot2Label, cell.timeSlot2Time], category: cell.category, tag: cell.lunarTag },
		{ title: "Cộng tu một ngày an lạc", location: "Giảng đường", slot1: ["Khai khóa", "06h30"], slot2: ["Hoàn mãn", "16h00"], category: "Cộng Tu", tag: "CỘNG TU" },
	);
	assert.ok(month.own.includes(`25:${event.id}`));

	// Sửa tên, nơi và giờ.
	const edited = await editEvent(w, event, { title: "Cộng tu (đã sửa)", location: "Chánh điện", times: [{ label: "Khai khóa", time: "07h00" }] });
	cell = (await v3Month(await w.view(), 2026, 10)).byDay[25].find((e) => e.id === event.id);
	assert.deepEqual([cell?.title, cell?.location, cell?.timeSlot1Time], ["Cộng tu (đã sửa)", "Chánh điện", "07h00"]);

	// Tạm ẩn, đăng lại, xóa, khôi phục.
	const hidden = await editEvent(w, edited, { status: "hidden" });
	assert.ok(!(await assertCalendarMatchesWww(w, 2026, 10, "tạm ẩn")).own.includes(`25:${event.id}`), "tạm ẩn thì vắng");
	const again = await editEvent(w, hidden, { status: "published" });
	assert.ok((await assertCalendarMatchesWww(w, 2026, 10, "đăng lại")).own.includes(`25:${event.id}`), "đăng lại thì về");
	await w.must("DELETE", `events/${event.id}`, undefined, "xóa sự kiện");
	assert.ok(!(await assertCalendarMatchesWww(w, 2026, 10, "đã xóa")).own.includes(`25:${event.id}`), "thùng rác thì vắng");
	await w.must("POST", `trash/calendar_event/${event.id}/restore`, {}, "khôi phục sự kiện");
	assert.ok((await assertCalendarMatchesWww(w, 2026, 10, "khôi phục")).own.includes(`25:${event.id}`), "khôi phục thì về");

	// Dời sang ngày 26.
	const restored = await w.must("GET", `events/${event.id}`, undefined, "đọc sự kiện");
	await editEvent(w, restored, { startDate: "2026-11-26", endDate: "2026-11-26" });
	month = await assertCalendarMatchesWww(w, 2026, 10, "dời ngày");
	assert.ok(month.own.includes(`26:${event.id}`) && !month.own.includes(`25:${event.id}`), "chỉ còn ở ngày mới");
	void again;
});

scenario("lịch: bản nháp admin chưa đăng không lên lịch; sự kiện nhiều ngày trải qua cả hai tháng với số thứ tự ngày đúng", async (w) => {
	const draft = await createEvent(w, { title: "Sự kiện nháp", startDate: "2026-11-14", status: "draft" });
	assert.ok(!(await assertCalendarMatchesWww(w, 2026, 10, "nháp")).own.some((s) => s.endsWith(`:${draft.id}`)));

	const multi = await createEvent(w, { title: "Khóa tu mùa đông", startDate: "2026-11-29", endDate: "2026-12-02", categoryId: "event::khoa-le" });
	const nov = await assertCalendarMatchesWww(w, 2026, 10, "nhiều ngày, tháng 11");
	const dec = await assertCalendarMatchesWww(w, 2026, 11, "nhiều ngày, tháng 12");
	assert.deepEqual(nov.own.filter((s) => s.endsWith(multi.id)), [`29:${multi.id}`, `30:${multi.id}`]);
	assert.deepEqual(dec.own.filter((s) => s.endsWith(multi.id)), [`1:${multi.id}`, `2:${multi.id}`]);
	const info = (await v3Month(await w.view(), 2026, 11)).byDay[1].find((e) => e.id === multi.id)?.multiDayInfo;
	assert.deepEqual([info?.totalDays, info?.currentDayIndex, info?.isFirstDay, info?.isLastDay], [4, 3, false, false], "1/12 là ngày thứ 3 trong 4 ngày");
});

scenario("khóa lễ thường kỳ: admin sửa tên, ngày âm, giờ và nơi thì ngày của khóa lễ trên lịch V3 đổi theo, đúng như www", async (w) => {
	const before = await assertCalendarMatchesWww(w, 2026, 10, "trước khi sửa");
	// "mùng 8 và 23 âm lịch": trong tháng 11/2026 chỉ có 16/11 (23 âm rơi sang tháng 12).
	assert.ok(before.regular.includes("16:p2"));

	await w.must("PATCH", "events/programs/p2", { title: "TIỂU SÁM HỐI (đổi)", summary: "Tụng kinh tối ngày mùng 10 và 20 âm lịch", time: "20h00", location: "Giảng Đường" }, "sửa khóa lễ");
	const after = await assertCalendarMatchesWww(w, 2026, 10, "sau khi sửa");
	assert.ok(!after.regular.includes("16:p2"), "mùng 8 không còn");
	assert.ok(after.regular.includes("18:p2") && after.regular.includes("28:p2"), `mùng 10 và 20 âm lịch là 18/11 và 28/11 (rằm là 23/11): ${after.regular.join(",")}`);
	const byDay = (await v3Month(await w.view(), 2026, 10)).byDay;
	const cell = byDay[18].find((e) => isRegular(e.id) && String(e.id).startsWith("p2-"));
	assert.deepEqual(
		{ title: cell?.title, time: cell?.timeSlot1Time, location: cell?.location, category: cell?.category },
		{ title: "TIỂU SÁM HỐI (đổi)", time: "20h00", location: "Giảng Đường", category: REGULAR_CATEGORY },
	);
	assert.ok(byDay[28].some((e) => String(e.id).startsWith("p2-")));

	// Sửa tiếp: bỏ ngày 20, chỉ còn mùng 10.
	await w.must("PATCH", "events/programs/p2", { summary: "Tụng kinh tối ngày mùng 10 âm lịch" }, "sửa lần hai");
	const only = await assertCalendarMatchesWww(w, 2026, 10, "sau lần sửa hai");
	assert.ok(only.regular.includes("18:p2") && !only.regular.includes("28:p2"));
});

scenario("Các chương trình cộng tu: admin sửa khóa lễ thường kỳ (tên, lời mô tả ngày, ảnh) thì thẻ trên trang chủ V3 đổi theo", async (w) => {
	let programs = await programsOf(await w.view());
	assert.deepEqual(programs.map((p) => p.id), ["p1", "p2", "p3"], "ba khóa lễ nhập từ web cũ, đúng thứ tự");
	assert.equal(programs[1].schedule, "Thời khóa tụng kinh tối 19h00 ngày mùng 8 và 23 âm lịch");

	await w.must("PATCH", "events/programs/p2", { title: "Tiểu sám hối (đổi)", summary: "Mùng 10 và 20 hằng tháng", imageMediaId: "media-b" }, "sửa khóa lễ");
	const view = await w.view();
	programs = await programsOf(view);
	const p2 = programs.find((p) => p.id === "p2");
	assert.deepEqual(
		{ title: p2?.title, schedule: p2?.schedule, href: p2?.href },
		{ title: "Tiểu sám hối (đổi)", schedule: "Mùng 10 và 20 hằng tháng", href: `/lich-tu-hoc/${toSlug("Tiểu sám hối (đổi)")}` },
	);
	assert.ok(p2?.imgUrl.endsWith(`/${mediaKey(view, "media-b")}`), `ảnh thẻ ${p2?.imgUrl}`);

	// Sửa thời khóa mà để trống lời mô tả: thẻ nói giờ.
	await w.must("PATCH", "events/programs/p3", { summary: "", time: "08h30" }, "sửa p3");
	assert.equal((await programsOf(await w.view())).find((p) => p.id === "p3")?.schedule, "08h30", "không có lời mô tả thì thẻ nói giờ");
});

scenario("chủ đề tháng: admin nhập chủ đề (tên, câu kệ, tác giả, tranh) thì lịch V3 hiện đúng; xóa trắng thì lùi về chủ đề V3 đóng gói sẵn", async (w) => {
	const bundled = MONTH_THEMES[10];
	let view = await w.view();
	// "Chủ đề có sẵn của V3" là bản trong schedule-database.json mà toScheduleData lấy làm gốc (khác chút so với MONTH_THEMES): lấy lúc chưa nhập gì làm mốc.
	const baseline = resolveMonthTheme(await scheduleOf(view), 10);
	assert.equal(baseline.title, bundled.title, "chưa nhập: chủ đề có sẵn của V3");

	const saved = await theme(w, 11, { title: "Tháng Mười Một của admin", lines: ["Dòng một", "Dòng <b>hai</b>", "<script>x</script>"], author: "Người biên tập", posterMediaId: "media-a" });
	view = await w.view();
	let got = resolveMonthTheme(await scheduleOf(view), 10);
	assert.equal(got.title, "Tháng Mười Một của admin");
	assert.deepEqual(got.quoteLines, saved.lines, "đúng các dòng admin đã làm sạch");
	assert.ok(!got.quoteLines.join("").includes("<script"), "không lọt thẻ script");
	assert.equal(got.author, "Người biên tập");
	assert.ok(got.bannerImg.endsWith(`/${mediaKey(view, "media-a")}`), `tranh của tháng ${got.bannerImg}`);
	assert.equal(got.primaryColor, bundled.primaryColor, "màu là phần thiết kế của V3");

	await theme(w, 11, { title: "Tên đã sửa", lines: ["Câu mới"], author: "Tác giả mới" });
	got = resolveMonthTheme(await scheduleOf(await w.view()), 10);
	assert.deepEqual([got.title, got.quoteLines, got.author], ["Tên đã sửa", ["Câu mới"], "Tác giả mới"]);

	await theme(w, 11, { title: "", lines: [], author: "", posterMediaId: null });
	got = resolveMonthTheme(await scheduleOf(await w.view()), 10);
	assert.equal(got.title, baseline.title, "xóa trắng: về chủ đề đóng gói sẵn");
	assert.deepEqual(got.quoteLines, baseline.quoteLines);
	assert.equal(got.author, baseline.author);
});

// ---- Ký tự đặc biệt trong câu kệ: admin lưu mỗi dòng dưới dạng HTML chỉ có thẻ <b> (admin/special/events.ts cleanVerseLine: & -> &amp;, < -> &lt;, > -> &gt;),
// nên người đọc phải thấy đúng ký tự đã gõ. Câu kệ đi tới hai nơi trên trang chủ V3: khối Lời Thầy (v3-home-quotes.ts) và hộp "chủ đề tháng" của lịch
// (CalendarSection.tsx, đọc từ resolveMonthTheme). Cả hai vẽ chữ thuần bằng React nên KHÔNG tự giải mã thực thể.
/** Điều người đọc phải thấy từ một dòng đã lưu: bỏ thẻ <b>, giải mã ba thực thể mà admin tạo ra. */
const asTyped = (stored: string) => stored.replace(/<\/?b>/gi, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

scenario("câu kệ có dấu &: khối Lời Thầy của V3 hiện đúng dấu & admin đã gõ", async (w) => {
	const saved = await theme(w, 11, { title: "Tri ân", lines: ["Tâm & Trí hòa một"], author: "" });
	assert.deepEqual(saved.lines, ["Tâm &amp; Trí hòa một"], "admin lưu dạng thực thể");
	const quotes = await quotesOf(await w.view());
	assert.equal(quotes?.items[0].text, "Tâm & Trí hòa một");
});

scenario("LỆCH THẬT: câu kệ có dấu < hoặc >: khối Lời Thầy của V3 phải hiện đúng ký tự, không hiện '&lt;' '&gt;'", async (w) => {
	// v3-home-quotes.ts:62 (`plain`) dùng decodeHtmlEntities (html-entities.ts), bộ này giải mã &amp; &quot; nhưng KHÔNG giải mã &lt; &gt;,
	// trong khi admin lưu `<` thành `&lt;`. QuotesSection vẽ chữ thuần nên người đọc thấy nguyên "&lt;".
	const saved = await theme(w, 11, { title: "So sánh", lines: ["Một < hai và ba > bốn"], author: "" });
	assert.deepEqual(saved.lines, ["Một &lt; hai và ba &gt; bốn"], "admin lưu dạng thực thể");
	const quotes = await quotesOf(await w.view());
	assert.equal(quotes?.items[0].text, asTyped(saved.lines[0]), "chữ người đọc thấy phải là chữ admin đã gõ");
});

scenario("LỆCH THẬT: câu kệ có dấu & trong hộp chủ đề tháng của lịch V3 phải hiện đúng dấu &, không hiện '&amp;'", async (w) => {
	// v3-data.ts toScheduleData gán `quoteLines: t.lines` nguyên dạng (còn &amp; &lt; &gt; do admin lưu); CalendarSection.tsx vẽ các dòng này bằng
	// renderQuoteSegment như chữ thuần (không giải mã). Sửa ở một trong hai chỗ đều làm kiểm thử này qua: giải mã khi dựng dữ liệu, hoặc giải mã
	// trong CalendarSection.
	const saved = await theme(w, 11, { title: "Tri ân", lines: ["Tâm & Trí hòa một", "Dòng <b>đậm</b> & còn lại"], author: "" });
	const view = await w.view();
	const lines = resolveMonthTheme(await scheduleOf(view), 10).quoteLines;
	const component = readFileSync(path.resolve("src/features/home/components/CalendarSection.tsx"), "utf8");
	const componentDecodes = /decodeHtmlEntities|html-entities/.test(component);
	assert.ok(
		componentDecodes || lines.every((line) => !/&(amp|lt|gt);/.test(line)),
		`hộp chủ đề tháng nhận ${JSON.stringify(lines)} (admin lưu ${JSON.stringify(saved.lines)}) và vẽ như chữ thuần: người đọc sẽ thấy nguyên '&amp;'`,
	);
});

scenario("bài hẹn giờ đã tới giờ hiện ở Tin mới nhất, khung bài mới nhất, Dấu ấn và số liệu; bài hẹn giờ chưa tới thì không", async (w) => {
	await publishBlock(w, "welcome", welcomeBlock());
	const due = await createPost(w, { title: "Bài hẹn giờ đã tới", publishedDate: "2026-11-22", bannerMediaId: "media-b" });
	await w.must("POST", `posts/${due.id}/publish`, { publishAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }, "hẹn giờ");
	const notYet = await w.view();
	assert.ok(!postCards(await newsOf(notYet)).some((c) => c.id === due.id), "chưa tới giờ");
	assert.ok(!(await heroOf(notYet)).frames.some((f) => f.kind === "latest"));
	assert.equal((await welcomeOf(notYet))?.stats[0].value, 1);

	// Giờ trôi qua: admin không cho hẹn vào quá khứ, nên lùi publish_at như thời gian đã trôi (cách www-admin-world.mjs làm).
	await w.sql("update post set publish_at = ? where id = ?", new Date(Date.now() - 60_000).toISOString(), due.id);
	const view = await w.view();
	assert.ok(postCards(await newsOf(view)).some((c) => c.id === due.id), "đã tới giờ: có thẻ tin");
	assert.equal((await heroOf(view)).frames.find((f) => f.kind === "latest")?.id, `bai-${due.id}`, "đã tới giờ: có khung đầu trang");
	assert.ok((await tilesOf(view))?.some((t) => t.id === due.id), "đã tới giờ: có trong Dấu ấn");
	assert.equal((await welcomeOf(view))?.stats[0].value, 2, "đã tới giờ: được đếm");
});

// ================================================================================================ 8. KHU VỰC NỔI BẬT

const SLUGS = (g: Awaited<ReturnType<typeof galleryOf>>) => g.areas.map((a) => a.targetUrl.split("/").pop());

scenario("khu vực nổi bật: admin chọn và sắp khu vực thì dải trượt trang chủ V3 theo đúng thứ tự; bỏ chọn hết thì V3 về danh sách có sẵn", async (w) => {
	const fallback = SLUGS(await galleryOf(await w.view()));
	assert.deepEqual(fallback, ["tam-bao", "to-duong", "giang-duong"], "chưa chọn gì: danh sách có sẵn của V3 (những khu vực có thật)");

	await w.must("PUT", "areas/featured", { ids: ["giang-duong", "tang-kinh-cac"] }, "chọn nổi bật");
	let view = await w.view();
	assert.deepEqual(await readFeaturedAreaIds(view.d1), ["giang-duong", "tang-kinh-cac"]);
	let gallery = await galleryOf(view);
	assert.deepEqual(SLUGS(gallery), ["giang-duong", "tang-kinh-cac"]);
	assert.deepEqual(gallery.areas.map((a) => a.name), ["GIẢNG ĐƯỜNG", "TÀNG KINH CÁC"]);
	assert.equal(gallery.areas[0].subtitle, "Nơi học đạo");
	assert.equal(gallery.areas[0].targetUrl, "/vu-tru-phat-giao/giang-duong");

	// Sắp lại và thêm một khu vực.
	await w.must("PUT", "areas/featured", { ids: ["tang-kinh-cac", "tam-bao", "giang-duong"] }, "sắp lại");
	assert.deepEqual(SLUGS(await galleryOf(await w.view())), ["tang-kinh-cac", "tam-bao", "giang-duong"]);

	// Admin sửa tên và phụ đề khu vực nổi bật.
	const area = await w.must("GET", "areas/tam-bao", undefined, "đọc khu vực");
	await w.must("PATCH", "areas/tam-bao", { version: area.version, name: "Tam Bảo Điện", subtitle: "Chánh điện mới" }, "sửa khu vực");
	gallery = await galleryOf(await w.view());
	assert.deepEqual([gallery.areas[1].name, gallery.areas[1].subtitle], ["TAM BẢO ĐIỆN", "Chánh điện mới"]);

	await w.must("PUT", "areas/featured", { ids: [] }, "bỏ chọn hết");
	view = await w.view();
	assert.deepEqual(await readFeaturedAreaIds(view.d1), []);
	assert.deepEqual(SLUGS(await galleryOf(view)), ["tam-bao", "to-duong", "giang-duong"], "về danh sách có sẵn");
	assert.deepEqual(
		SLUGS(await galleryOf(view)),
		FEATURED_AREA_PICKS.map((p) => p.slug).filter((slug) => ["tam-bao", "to-duong", "giang-duong"].includes(slug)),
		"đúng bảng khu vực có sẵn của V3",
	);
});

scenario("khu vực nổi bật: khu vực admin ẩn hoặc xóa biến khỏi dải trượt dù đã được chọn; hiện lại thì về; chọn khu vực đã xóa bị admin từ chối", async (w) => {
	await w.must("PUT", "areas/featured", { ids: ["giang-duong", "to-duong", "tang-kinh-cac"] }, "chọn nổi bật");
	assert.deepEqual(SLUGS(await galleryOf(await w.view())), ["giang-duong", "to-duong", "tang-kinh-cac"]);

	// Ẩn Giảng Đường.
	const area = await w.must("GET", "areas/giang-duong", undefined, "đọc khu vực");
	const hidden = await w.must("PATCH", "areas/giang-duong", { version: area.version, visible: false }, "ẩn khu vực");
	assert.deepEqual(SLUGS(await galleryOf(await w.view())), ["to-duong", "tang-kinh-cac"], "khu vực ẩn không còn trên dải trượt");
	await w.must("PATCH", "areas/giang-duong", { version: hidden.version, visible: true }, "hiện lại");
	assert.deepEqual(SLUGS(await galleryOf(await w.view())), ["giang-duong", "to-duong", "tang-kinh-cac"], "hiện lại thì về chỗ cũ trong thứ tự admin");

	// Xóa Tổ Đường vào thùng rác (admin tự bỏ cờ nổi bật).
	await w.must("DELETE", "areas/to-duong", undefined, "xóa khu vực");
	const view = await w.view();
	assert.deepEqual(SLUGS(await galleryOf(view)), ["giang-duong", "tang-kinh-cac"]);
	assert.deepEqual(await readFeaturedAreaIds(view.d1), ["giang-duong", "tang-kinh-cac"]);
	const bad = await w.call("PUT", "areas/featured", { ids: ["to-duong"] });
	assert.equal(bad.status, 400, "không chọn được khu vực đã xóa");

	// Ẩn hết các khu vực đã chọn: V3 về danh sách có sẵn thay vì để trống.
	for (const slug of ["giang-duong", "tang-kinh-cac"]) {
		const a = await w.must("GET", `areas/${slug}`, undefined, "đọc khu vực");
		await w.must("PATCH", `areas/${slug}`, { version: a.version, visible: false }, "ẩn khu vực");
	}
	assert.deepEqual(SLUGS(await galleryOf(await w.view())), ["tam-bao"], "các khu vực đã chọn đều ẩn: còn khu vực có sẵn mà admin chưa ẩn");
});

// ================================================================================================ 9. THÔNG TIN CHÙA VÀ THÔNG BÁO (site.info, site.announcement)

const siteInfo = (over: Record<string, unknown> = {}) => ({
	name: "Tùng Lâm Hòa Phúc",
	slogan: "Chốn thiêng bình yên",
	address: "Thôn Hòa Phúc",
	phones: [{ role: "Thư ký", name: "Cô A", phone: "0901 234 567" }],
	openingHours: "5h đến 20h",
	mapsUrl: "https://maps.example.test/tlhp",
	social: [
		{ label: "Facebook", url: "https://facebook.com/tlhp" },
		{ label: "YouTube", url: "https://youtube.com/@tlhp" },
	],
	announcement: { text: "", link: null, expires: "", active: false },
	...over,
});
const saveSiteInfo = (w: World, over: Record<string, unknown> = {}) => w.must("PUT", "settings/site-info", siteInfo(over), "lưu thông tin chùa");

scenario("thông tin chùa: admin thêm, sửa, bớt liên kết mạng xã hội, đổi bản đồ và số điện thoại thì V3 (chân trang) đổi theo", async (w) => {
	const start = await chromeOf(await w.view());
	assert.equal(start.info, null, "chưa lưu: V3 giữ chữ viết sẵn trong chân trang");
	assert.deepEqual(start.notice, { state: "absent" });

	await saveSiteInfo(w);
	let chrome = await chromeOf(await w.view());
	assert.deepEqual(chrome.info?.social, [
		{ label: "Facebook", url: "https://facebook.com/tlhp", network: "facebook" },
		{ label: "YouTube", url: "https://youtube.com/@tlhp", network: "youtube" },
	]);
	assert.deepEqual(
		{ name: chrome.info?.name, address: chrome.info?.address, hours: chrome.info?.openingHours, slogan: chrome.info?.slogan, maps: chrome.info?.mapsUrl },
		{ name: "Tùng Lâm Hòa Phúc", address: "Thôn Hòa Phúc", hours: "5h đến 20h", slogan: "Chốn thiêng bình yên", maps: "https://maps.example.test/tlhp" },
	);
	assert.deepEqual(chrome.contacts, [{ role: "Thư ký", name: "Cô A", phone: "0901234567" }], "số điện thoại đã bỏ khoảng trắng");

	// Sửa liên kết Facebook, bỏ YouTube, thêm Zalo và TikTok; đổi bản đồ.
	await saveSiteInfo(w, {
		mapsUrl: "https://maps.example.test/moi",
		social: [
			{ label: "Facebook chính thức", url: "https://facebook.com/tlhp.chinhthuc" },
			{ label: "Zalo", url: "https://zalo.me/tlhp" },
			{ label: "TikTok", url: "https://tiktok.com/@tlhp" },
		],
	});
	chrome = await chromeOf(await w.view());
	assert.deepEqual(chrome.info?.social.map((s) => [s.label, s.url, s.network]), [
		["Facebook chính thức", "https://facebook.com/tlhp.chinhthuc", "facebook"],
		["Zalo", "https://zalo.me/tlhp", "zalo"],
		["TikTok", "https://tiktok.com/@tlhp", "tiktok"],
	]);
	assert.equal(chrome.info?.mapsUrl, "https://maps.example.test/moi");

	// Bỏ hết liên kết và số điện thoại: V3 không vẽ liên kết nào, không còn dòng điện thoại nào (khác "chưa lưu").
	await saveSiteInfo(w, { social: [], phones: [], mapsUrl: "" });
	chrome = await chromeOf(await w.view());
	assert.deepEqual(chrome.info?.social, []);
	assert.equal(chrome.info?.mapsUrl, "");
	assert.deepEqual(chrome.contacts, [], "admin cố ý để trống: không còn dòng điện thoại");

	// Admin chặn liên kết không phải https, nên không bao giờ tới V3.
	const bad = await w.call("PUT", "settings/site-info", siteInfo({ social: [{ label: "Xấu", url: "javascript:alert(1)" }] }));
	assert.equal(bad.status, 400);
	assert.deepEqual((await chromeOf(await w.view())).info?.social, [], "V3 giữ bản đã lưu");
});

scenario("thông báo chào mừng: admin bật, sửa chữ và liên kết, đặt hạn, tắt thì V3 đổi theo; qua hạn thì thông báo tự ẩn", async (w) => {
	await saveSiteInfo(w, { announcement: { text: "Khai khóa tu mùa đông, mời quý Phật tử đăng ký.", link: { label: "Đăng ký", href: "/lich-tu-hoc" }, expires: "2026-12-31", active: true } });
	let notice = (await chromeOf(await w.view())).notice;
	assert.equal(notice.state, "on");
	if (notice.state !== "on") return;
	assert.equal(notice.text, "Khai khóa tu mùa đông, mời quý Phật tử đăng ký.");
	assert.deepEqual(notice.link, { label: "Đăng ký", href: "/lich-tu-hoc", newTab: false });
	assert.equal(notice.endsAt, Date.parse("2026-12-31T23:59:59.999+07:00"), "hết hạn cuối ngày 31/12 giờ Việt Nam");
	const firstId = notice.id;

	// Sửa chữ: mã thông báo đổi, để ai đã đóng bản cũ thấy bản mới. Liên kết ngoài mở tab mới.
	await saveSiteInfo(w, { announcement: { text: "Đổi giờ khai khóa.", link: { label: "Xem", href: "https://example.test/gio" }, expires: "2026-12-31", active: true } });
	notice = (await chromeOf(await w.view())).notice;
	assert.equal(notice.state, "on");
	if (notice.state !== "on") return;
	assert.equal(notice.text, "Đổi giờ khai khóa.");
	assert.deepEqual(notice.link, { label: "Xem", href: "https://example.test/gio", newTab: true });
	assert.notEqual(notice.id, firstId, "sửa chữ thì mã đổi");

	// Qua hạn: cùng thông báo nhưng V3 tính theo `now` nên đã tắt (trang chủ hỏi lại mỗi lần mở).
	assert.equal((await chromeOf(await w.view(), new Date("2027-01-01T00:00:00.000+07:00"))).notice.state, "off", "qua ngày hết hạn");
	assert.equal((await chromeOf(await w.view(), new Date("2026-12-31T23:00:00.000+07:00"))).notice.state, "on", "còn trong ngày cuối");

	// Hạn đã qua ngay lúc lưu.
	await saveSiteInfo(w, { announcement: { text: "Thông báo cũ.", link: null, expires: "2026-11-22", active: true } });
	assert.equal((await chromeOf(await w.view())).notice.state, "off", "hết hạn từ hôm qua");

	// Bỏ hạn thì hiện mãi; không có liên kết thì V3 không vẽ nút.
	await saveSiteInfo(w, { announcement: { text: "Thông báo không hạn.", link: null, expires: "", active: true } });
	notice = (await chromeOf(await w.view())).notice;
	assert.equal(notice.state, "on");
	if (notice.state === "on") assert.deepEqual([notice.link, notice.endsAt], [null, null]);

	// Tắt công tắc, rồi để chữ trống.
	await saveSiteInfo(w, { announcement: { text: "Thông báo không hạn.", link: null, expires: "", active: false } });
	assert.equal((await chromeOf(await w.view())).notice.state, "off", "admin tắt công tắc");
	await saveSiteInfo(w, { announcement: { text: "", link: null, expires: "", active: true } });
	assert.equal((await chromeOf(await w.view())).notice.state, "off", "bật mà không có chữ thì không có thông báo");
});
