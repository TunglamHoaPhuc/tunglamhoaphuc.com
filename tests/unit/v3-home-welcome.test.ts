// "Lời chào" trên trang chủ V3: chữ, video và số liệu do admin đặt (home.welcome, home.stats, home.buddhist_year) tính như www, và khối vẽ ra đúng.
// Phần so với www (cần TLHP_WWW_SRC = thư mục `src` của www; không đặt thì bỏ qua): Phật lịch của từng ngày 2000-2060 và ngày hôm nay ở Việt Nam
// phải bằng hàm của www (src/libs/lunar.ts, src/libs/calendar.ts), số bài mỗi chuyên mục phải bằng `listPosts().total` của bộ đọc D1.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatFigure, WelcomeSection } from "@/features/home/components/WelcomeSection";
import { MEDIA_BASE } from "@/lib/tlhp-content/media";
import { createD1Repository, type D1Like } from "@/lib/tlhp-content/sources/d1";
import { buddhistYear, countLivePosts, DEFAULT_LINK_LABEL, DEFAULT_VIDEO_LABEL, DONG_CHAY_SECTION, loadHomeWelcome, lunarDate, todayInVietnam, TRI_TUE_SECTION, type HomeWelcome } from "@/lib/v3-home-welcome";
import { DEFAULT_HERO_VIDEO_ID } from "@/lib/v3-home-content";
import { createFakeD1, isoIn, type FakeD1 } from "../helpers/d1";

const NOV_23 = new Date("2026-11-23T05:00:00.000Z");
const welcomeSetting = (over: Record<string, unknown> = {}) => ({ quote: "", author: "", paragraph: "", imageMediaId: null, videoUrl: "", linkLabel: "", linkHref: "", ...over });

let seq = 0;
function post(db: FakeD1, section: string, over: Record<string, unknown> = {}) {
	seq++;
	db.insert("post", { id: `p${seq}`, slug: `bai-${seq}`, title: `Bài ${seq}`, section, status: "published", ...over });
}
function setting(db: FakeD1, key: string, value: unknown) {
	db.insert("setting", { key, value: JSON.stringify(value) });
}
function history(db: FakeD1, over: Record<string, unknown> = {}) {
	db.insert("category", { id: "g-ls", slug: "lich-su-chua", name: "Lịch Sử Chùa", kind: "page" });
	db.insert("page", {
		id: "h1",
		slug: "lich-su-chua-tung-lam",
		title: "Lịch sử Bổn tự",
		subtitle: "Cõi Tịnh độ giữa nhân gian",
		group_id: "g-ls",
		overview: "Chùa được lập để tu học Tịnh độ.",
		quote: JSON.stringify({ title: "", lines: ["Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian."], author: "Sư Tổ" }),
		status: "published",
		...over,
	});
}
/** 3 bài Dòng Chảy và 2 bài Trí Tuệ đang hiện, cùng đủ kiểu bài KHÔNG được đếm. */
function posts(db: FakeD1) {
	for (let i = 0; i < 3; i++) post(db, DONG_CHAY_SECTION);
	for (let i = 0; i < 2; i++) post(db, TRI_TUE_SECTION);
	post(db, DONG_CHAY_SECTION, { status: "scheduled", publish_at: isoIn(-1) }); // hẹn giờ đã tới: đếm
	post(db, DONG_CHAY_SECTION, { status: "scheduled", publish_at: isoIn(+3) }); // hẹn giờ chưa tới
	post(db, DONG_CHAY_SECTION, { status: "draft" });
	post(db, DONG_CHAY_SECTION, { deleted_at: isoIn(-2) });
	post(db, "khac");
}
// 4 Dòng Chảy (3 + hẹn giờ đã tới), 2 Trí Tuệ.
const DONG_CHAY = 4;
const TRI_TUE = 2;

function seeded(welcome: unknown, extra: (db: FakeD1) => void = () => {}) {
	const db = createFakeD1();
	if (welcome !== undefined) setting(db, "home.welcome", welcome);
	posts(db);
	extra(db);
	return db;
}
const load = (db: D1Like, options = {}) => loadHomeWelcome(db, { now: NOV_23, ...options });
const stat = (w: HomeWelcome | null, label: string) => w?.stats.find((item) => item.label === label);

// ── Khối vắng, khối đầy đủ, từng trường ─────────────────────────────────────────────────────────────────────────

test("không có home.welcome và không có chủ đề Lịch Sử Chùa: không có khối (null)", async () => {
	assert.equal(await load(seeded(undefined)), null);
	assert.equal(await load(seeded("không phải json")), null);
	assert.equal(await load(seeded(welcomeSetting({ videoUrl: "https://vimeo.com/1" }))), null, "mọi trường sai thì coi như vắng");
});

test("home.welcome đầy đủ: chữ, đường dẫn, nhãn và video của admin; số liệu mặc định tính từ dữ liệu", async () => {
	const db = seeded(welcomeSetting({ quote: "Về nơi bình yên", author: "Thầy", paragraph: "Mời quý vị về chùa.\nNiệm Phật.", linkLabel: "Xem thêm", linkHref: "/gioi-thieu/lich-su", videoUrl: "https://youtu.be/dQw4w9WgXcQ", imageMediaId: "m1" }), (d) => {
		d.insert("media", { id: "m1", r2_key: "anh/loi-chao.webp", url: "" });
	});
	const w = await load(db);
	assert.ok(w);
	assert.equal(w.title, "Về nơi bình yên");
	assert.equal(w.author, "Thầy");
	assert.equal(w.text, "Mời quý vị về chùa.\nNiệm Phật.");
	assert.deepEqual(w.link, { label: "Xem thêm", href: "/gioi-thieu/lich-su" });
	assert.deepEqual(w.video, { id: "dQw4w9WgXcQ", label: "Video giới thiệu Tùng Lâm Hòa Phúc" });
	assert.deepEqual(w.image, { src: `${MEDIA_BASE}/anh/loi-chao.webp`, position: "center 50%" });
	assert.deepEqual(
		w.stats.map((s) => [s.label, s.value, s.year]),
		[
			["Bài viết Dòng Chảy Hoằng Pháp", DONG_CHAY, false],
			["Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp", TRI_TUE, false],
			["Phật lịch", 2570, true],
		],
	);
});

test("chỉ có video: khối vẫn có như www (không chữ, không tiêu đề), video của admin, ba số mặc định", async () => {
	const w = await load(seeded(welcomeSetting({ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })));
	assert.ok(w);
	assert.equal(w.video.id, "dQw4w9WgXcQ");
	assert.equal(w.title, "");
	assert.equal(w.text, "");
	assert.deepEqual(w.link, { label: DEFAULT_LINK_LABEL, href: "/gioi-thieu" });
	assert.equal(w.stats.length, 3);
	const withHistory = await load(seeded(welcomeSetting({ videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }), (d) => history(d)));
	assert.equal(withHistory?.video.id, "dQw4w9WgXcQ");
	assert.equal(withHistory?.title, "Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian.");
});

test("thiếu trường nào thì chủ đề Lịch Sử Chùa của Giới thiệu thay trường đó; video thiếu thì dùng video của chùa", async () => {
	const w = await load(seeded(undefined, (d) => history(d)));
	assert.ok(w);
	assert.equal(w.title, "Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian.");
	assert.equal(w.author, "Sư Tổ");
	assert.equal(w.text, "Chùa được lập để tu học Tịnh độ.");
	assert.deepEqual(w.link, { label: DEFAULT_LINK_LABEL, href: "/gioi-thieu/lich-su-chua-tung-lam" });
	assert.deepEqual(w.video, { id: DEFAULT_HERO_VIDEO_ID, label: DEFAULT_VIDEO_LABEL });
	assert.equal(w.image, null);

	const mixed = await load(seeded(welcomeSetting({ paragraph: "Chữ của admin" }), (d) => history(d)));
	assert.ok(mixed);
	assert.equal(mixed.text, "Chữ của admin");
	assert.equal(mixed.title, "Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian.");
});

test("câu của admin không bị gán tên tác giả của câu trong chủ đề lịch sử", async () => {
	const w = await load(seeded(welcomeSetting({ quote: "Câu của admin" }), (d) => history(d)));
	assert.ok(w);
	assert.equal(w.title, "Câu của admin");
	assert.equal(w.author, "", "www gán 'Sư Tổ' cho câu này; V3 không");
});

test("chủ đề lịch sử nháp hoặc trong thùng rác không được dùng", async () => {
	assert.equal(await load(seeded(undefined, (d) => history(d, { status: "draft" }))), null);
	assert.equal(await load(seeded(undefined, (d) => history(d, { deleted_at: isoIn(-1) }))), null);
});

test("ảnh: media đã xóa hoặc không có thì bỏ ảnh, dùng ảnh của chủ đề lịch sử nếu có", async () => {
	const gone = await load(seeded(welcomeSetting({ quote: "x", imageMediaId: "m9" }), (d) => d.insert("media", { id: "m9", r2_key: "a.webp", url: "", deleted_at: isoIn(-1) })));
	assert.equal(gone?.image, null);
	const missing = await load(seeded(welcomeSetting({ quote: "x", imageMediaId: "khong-co" })));
	assert.equal(missing?.image, null);
	const topicPicture = await load(seeded(welcomeSetting({ quote: "x" }), (d) => {
		d.insert("media", { id: "mp", r2_key: "chan-dung.webp", url: "" });
		history(d, { portrait_media_id: "mp", portrait_position: "center 20%" });
	}));
	assert.deepEqual(topicPicture?.image, { src: `${MEDIA_BASE}/chan-dung.webp`, position: "center 20%" });
});

// ── Số liệu ─────────────────────────────────────────────────────────────────────────────────────────────────────

test("home.stats: nhãn, thứ tự và nguồn của admin; số tự đếm, năm Phật lịch, số gõ tay", async () => {
	const db = seeded(welcomeSetting({ quote: "x" }), (d) =>
		setting(d, "home.stats", [
			{ label: "Phật lịch năm nay", source: "auto-phat-lich", value: 0 },
			{ label: "Bài Trí Tuệ", source: "auto-bai-tri-tue", value: 0 },
			{ label: "Đạo tràng", source: "manual", value: 1234 },
		]),
	);
	const w = await load(db);
	assert.deepEqual(
		w?.stats.map((s) => [s.label, s.value, s.year]),
		[
			["Phật lịch năm nay", 2570, true],
			["Bài Trí Tuệ", TRI_TUE, false],
			["Đạo tràng", 1234, false],
		],
	);
});

test("home.stats chỉ có bản ghi sai hoặc rỗng: dùng ba số mặc định như www; tối đa 3 số", async () => {
	for (const bad of [[], "x", [{ label: "", source: "manual", value: 1 }], [{ label: "A", source: "lạ", value: 1 }]]) {
		const w = await load(seeded(welcomeSetting({ quote: "x" }), (d) => setting(d, "home.stats", bad)));
		assert.equal(w?.stats.length, 3, JSON.stringify(bad));
	}
	const five = Array.from({ length: 5 }, (_, i) => ({ label: `L${i}`, source: "manual", value: i }));
	assert.equal((await load(seeded(welcomeSetting({ quote: "x" }), (d) => setting(d, "home.stats", five))))?.stats.length, 3);
});

test("một bản ghi số liệu sai bị bỏ, các bản ghi đúng giữ nguyên", async () => {
	const w = await load(seeded(welcomeSetting({ quote: "x" }), (d) => setting(d, "home.stats", [{ label: "Tốt", source: "manual", value: 7 }, { label: "Xấu", source: "manual", value: -1 }])));
	assert.deepEqual(w?.stats, [{ label: "Tốt", value: 7, year: false }]);
});

test("home.buddhist_year: chế độ gõ tay thắng quy tắc; chế độ tự động hoặc sai thì tính theo quy tắc", async () => {
	const manual = await load(seeded(welcomeSetting({ quote: "x" }), (d) => setting(d, "home.buddhist_year", { mode: "manual", value: 2571 })));
	assert.equal(stat(manual, "Phật lịch")?.value, 2571);
	assert.equal(stat(manual, "Phật lịch")?.year, true);
	for (const other of [{ mode: "auto", value: 2000 }, { mode: "khác", value: 1 }, "x", null]) {
		const w = await load(seeded(welcomeSetting({ quote: "x" }), (d) => setting(d, "home.buddhist_year", other)));
		assert.equal(stat(w, "Phật lịch")?.value, 2570, JSON.stringify(other));
	}
});

test("Phật lịch theo quy tắc: đổi năm vào ngày Phật đản (15/4 âm lịch), không đổi ở Tết", () => {
	assert.equal(buddhistYear("2026-01-01"), 2569, "trước Tết Bính Ngọ (17/02/2026): năm âm 2025, đã qua Phật đản 2025");
	assert.equal(buddhistYear("2026-02-16"), 2569);
	assert.equal(buddhistYear("2026-02-18"), 2569, "Tết không làm đổi Phật lịch");
	assert.equal(buddhistYear("2026-03-01"), 2569, "sau Tết, trước Phật đản");
	assert.equal(buddhistYear("2026-11-23"), 2570, "sau Phật đản");
	// Đúng ngày Phật đản 2026 (15/4 âm lịch) số đổi.
	let flip = "";
	for (let day = Date.UTC(2026, 4, 1); !flip && day < Date.UTC(2026, 7, 1); day += 86_400_000) {
		const iso = new Date(day).toISOString().slice(0, 10);
		if (buddhistYear(iso) === 2570) flip = iso;
	}
	const { day, month, leap } = lunarDate(flip);
	assert.deepEqual([day, month, leap], [15, 4, false]);
	assert.equal(buddhistYear(new Date(Date.parse(`${flip}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)), 2569, "ngày trước Phật đản vẫn là 2569");
	assert.equal(todayInVietnam(new Date("2026-11-22T18:00:00.000Z")), "2026-11-23", "ngày tính theo giờ Việt Nam (UTC+7)");
});

test("đếm bài: chỉ bài đang hiện (đã xuất bản, hoặc hẹn giờ đã tới), không nháp, không thùng rác, đúng chuyên mục", async () => {
	const db = seeded(undefined);
	assert.deepEqual(await countLivePosts(db, [DONG_CHAY_SECTION, TRI_TUE_SECTION]), { [DONG_CHAY_SECTION]: DONG_CHAY, [TRI_TUE_SECTION]: TRI_TUE });
});

test("hai bài cùng slug trong một chuyên mục chỉ đếm một lần (như danh sách của bộ đọc); cùng slug khác chuyên mục đếm riêng", async () => {
	const db = createFakeD1();
	post(db, DONG_CHAY_SECTION, { slug: "trung" });
	post(db, DONG_CHAY_SECTION, { slug: "trung" });
	post(db, DONG_CHAY_SECTION, { slug: "%C3%A1" });
	post(db, DONG_CHAY_SECTION, { slug: "á" });
	post(db, TRI_TUE_SECTION, { slug: "trung" });
	const counts = await countLivePosts(db, [DONG_CHAY_SECTION, TRI_TUE_SECTION]);
	assert.deepEqual(counts, { [DONG_CHAY_SECTION]: 2, [TRI_TUE_SECTION]: 1 });
	const repo = createD1Repository(db);
	assert.equal((await repo.listPosts({ section: DONG_CHAY_SECTION, pageSize: 1 })).total, counts[DONG_CHAY_SECTION]);
	assert.equal((await repo.listPosts({ section: TRI_TUE_SECTION, pageSize: 1 })).total, counts[TRI_TUE_SECTION]);
});

test("số bài bằng listPosts().total của bộ đọc D1 trên dữ liệu thử đủ kiểu", async () => {
	const db = seeded(welcomeSetting({ quote: "x" }));
	const repo = createD1Repository(db);
	const w = await load(db);
	assert.equal(stat(w, "Bài viết Dòng Chảy Hoằng Pháp")?.value, (await repo.listPosts({ section: DONG_CHAY_SECTION, pageSize: 1 })).total);
	assert.equal(stat(w, "Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp")?.value, (await repo.listPosts({ section: TRI_TUE_SECTION, pageSize: 1 })).total);
});

test("không đọc được số bài: số đó bị bỏ, không bịa số 0; Phật lịch và số gõ tay vẫn còn", async () => {
	const db = seeded(welcomeSetting({ quote: "x" }));
	const broken: D1Like = {
		prepare(sql) {
			if (/from post\b/.test(sql)) throw new Error("D1 hỏng");
			return db.prepare(sql);
		},
	};
	const quiet = console.error;
	console.error = () => {};
	try {
		const w = await load(broken);
		assert.deepEqual(w?.stats, [{ label: "Phật lịch", value: 2570, year: true }]);
	} finally {
		console.error = quiet;
	}
});

test("không đọc được cài đặt: khối rơi về chủ đề lịch sử và ba số mặc định; hỏng hết thì null, không ném lỗi", async () => {
	const db = createFakeD1();
	history(db);
	posts(db);
	const noSettings: D1Like = {
		prepare(sql) {
			if (/from setting\b/.test(sql)) throw new Error("D1 hỏng");
			return db.prepare(sql);
		},
	};
	const quiet = console.error;
	console.error = () => {};
	try {
		const w = await load(noSettings);
		assert.equal(w?.title, "Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian.");
		assert.equal(w?.stats.length, 3);
		const dead: D1Like = {
			prepare() {
				throw new Error("D1 hỏng");
			},
		};
		assert.equal(await load(dead), null);
	} finally {
		console.error = quiet;
	}
});

test("cài đặt truyền sẵn (settings) được dùng, không đọc lại; kết quả là object thuần, JSON được", async () => {
	const db = seeded(undefined, (d) => history(d));
	const w = await load(db, { settings: { "home.welcome": welcomeSetting({ quote: "Từ settings truyền vào" }) } });
	assert.equal(w?.title, "Từ settings truyền vào");
	assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
});

// ── Khối vẽ ─────────────────────────────────────────────────────────────────────────────────────────────────────

const sample: HomeWelcome = {
	title: "Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian.",
	author: "Sư Tổ",
	text: "Đoạn một.\nĐoạn hai.",
	link: { label: "Tìm hiểu Bổn tự", href: "/gioi-thieu/lich-su" },
	image: null,
	video: { id: "HE2MnR8Hl5c", label: DEFAULT_VIDEO_LABEL },
	stats: [
		{ label: "Bài viết Dòng Chảy Hoằng Pháp", value: 1472, year: false },
		{ label: "Bài giảng", value: 158, year: false },
		{ label: "Phật lịch", value: 2570, year: true },
	],
};
const html = (welcome: HomeWelcome | null) => renderToStaticMarkup(createElement(WelcomeSection, { welcome }));

test("khối vẽ: null thì không vẽ gì", () => {
	assert.equal(html(null), "");
});

test("khối vẽ: tiêu đề h2, tác giả, chữ, liên kết, và số THẬT nằm sẵn trong HTML đầu tiên (đọc được như số)", () => {
	const out = html(sample);
	assert.match(out, /<h2[^>]*>Lập chùa là tạo ra một cõi Tịnh độ giữa nhân gian\.<\/h2>/);
	assert.match(out, /aria-labelledby="loi-chao-tieu-de"/);
	assert.match(out, /— Sư Tổ/);
	assert.match(out, /Đoạn một\.\nĐoạn hai\./);
	assert.match(out, /<a[^>]*href="\/gioi-thieu\/lich-su"[^>]*>Tìm hiểu Bổn tự/);
	for (const [label, value] of [["Bài viết Dòng Chảy Hoằng Pháp", "1.472"], ["Bài giảng", "158"], ["Phật lịch", "2570"]]) {
		assert.ok(out.includes(`<dt`) && out.includes(label), label);
		assert.ok(out.includes(`<span class="sr-only">${value}</span>`), `${label}: ${value}`);
		assert.ok(out.includes(`aria-hidden="true" class="tabular-nums">${value}</span>`), `${label}: số hiển thị đầu tiên là số thật`);
	}
	assert.doesNotMatch(out, /Phật lịch[\s\S]{0,400}2\.570/, "năm không có dấu chấm ngăn hàng nghìn");
});

test("khối vẽ: video chỉ là ảnh bìa và nút phát có tên; không có iframe và không có địa chỉ nhúng lúc mở trang", () => {
	const out = html(sample);
	assert.doesNotMatch(out, /<iframe/);
	assert.doesNotMatch(out, /youtube-nocookie\.com\/embed/);
	assert.match(out, /<button[^>]*type="button"[^>]*aria-label="Xem video: Chốn thiêng bình yên – Tùng Lâm Hòa Phúc"/);
	assert.match(out, /<img[^>]*src="https:\/\/i\.ytimg\.com\/vi\/HE2MnR8Hl5c\/hqdefault\.jpg"[^>]*loading="lazy"/);
	const picture = html({ ...sample, image: { src: "/anh-goc/b/a.webp", position: "center 20%" } });
	assert.match(picture, /src="\/anh-goc\/b\/a\.webp"/);
	assert.doesNotMatch(picture, /ytimg/);
});

test("khối vẽ: thiếu tiêu đề, chữ, tác giả hoặc số liệu thì bỏ phần đó, vẫn còn nhãn khối và video", () => {
	const out = html({ ...sample, title: "", author: "", text: "", stats: [] });
	assert.doesNotMatch(out, /<h2/);
	assert.doesNotMatch(out, /<dl/);
	assert.doesNotMatch(out, /— /);
	assert.match(out, /aria-label="Lời chào"/);
	assert.match(out, /<button/);
});

test("chữ của admin được thoát ký tự HTML, không chèn được thẻ", () => {
	const out = html({ ...sample, title: '<img src=x onerror=alert(1)>', text: "<script>x</script>", stats: [{ label: "<b>A</b>", value: 1, year: false }] });
	assert.doesNotMatch(out, /<script>/);
	assert.doesNotMatch(out, /<img src=x/);
	assert.doesNotMatch(out, /<b>A<\/b>/);
});

test("định dạng số: dấu chấm ngăn hàng nghìn; năm thì không", () => {
	assert.equal(formatFigure(0, false), "0");
	assert.equal(formatFigure(472, false), "472");
	assert.equal(formatFigure(1472, false), "1.472");
	assert.equal(formatFigure(1_234_567, false), "1.234.567");
	assert.equal(formatFigure(2570, true), "2570");
	assert.equal(formatFigure(-5, false), "0");
});

// ── So với www ──────────────────────────────────────────────────────────────────────────────────────────────────

const WWW = process.env.TLHP_WWW_SRC;
const SKIP_WWW: string | false = WWW && existsSync(path.join(WWW, "libs/lunar.ts")) ? false : "TLHP_WWW_SRC chưa đặt (thư mục src của www): bỏ qua so khớp Phật lịch với www";

test("Phật lịch và âm lịch của từng ngày 2000-2060 bằng hàm của www", { skip: SKIP_WWW }, async () => {
	const www = (await import(pathToFileURL(path.join(WWW as string, "libs/lunar.ts")).href)) as { buddhistYear(iso: string): number; lunarDate(iso: string): { day: number; month: number; year: number; leap: boolean } };
	let days = 0;
	for (let t = Date.UTC(2000, 0, 1); t < Date.UTC(2061, 0, 1); t += 86_400_000) {
		const iso = new Date(t).toISOString().slice(0, 10);
		if (buddhistYear(iso) !== www.buddhistYear(iso) || JSON.stringify(lunarDate(iso)) !== JSON.stringify(www.lunarDate(iso))) assert.fail(`${iso}: V3 ${buddhistYear(iso)} ${JSON.stringify(lunarDate(iso))}, www ${www.buddhistYear(iso)} ${JSON.stringify(www.lunarDate(iso))}`);
		days++;
	}
	assert.ok(days > 22_000);
});

test("ngày hôm nay ở Việt Nam bằng hàm của www, kể cả quanh nửa đêm UTC+7", { skip: SKIP_WWW }, async () => {
	// libs/calendar.ts của www kéo theo nhiều mô-đun khác; hàm chỉ là một dòng, nên đọc mã nguồn và so công thức thay vì nạp cả chuỗi phụ thuộc.
	const { readFileSync } = await import("node:fs");
	const source = readFileSync(path.join(WWW as string, "libs/calendar.ts"), "utf8");
	assert.match(source, /const VIETNAM_OFFSET_MS = 7 \* 60 \* 60 \* 1000;/);
	assert.match(source, /new Date\(now\.getTime\(\) \+ VIETNAM_OFFSET_MS\)\.toISOString\(\)\.slice\(0, 10\)/);
	for (const instant of ["2026-11-22T16:59:59.999Z", "2026-11-22T17:00:00.000Z", "2026-12-31T17:00:00.000Z"]) {
		const expected = new Date(Date.parse(instant) + 7 * 3_600_000).toISOString().slice(0, 10);
		assert.equal(todayInVietnam(new Date(instant)), expected);
	}
});
