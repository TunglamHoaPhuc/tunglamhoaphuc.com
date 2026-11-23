// /tim-kiem: luật tìm và xếp hạng là BẢN CHÉP của www (src/libs/search.ts, chỉ khác dòng import `bare`); chỉ mục dựng từ kho nội dung
// với địa chỉ trang của V3. Cần TLHP_WWW_SRC (thư mục `src` của www) cho phần so khớp với www; không đặt thì phần đó bị bỏ qua.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ContentRepository, Page, PostSummary } from "@/lib/tlhp-content/types";
import { groupResults, readSearchQuery, SEARCH_SECTIONS, searchHref, searchItem, searchItems } from "@/lib/v3-search";
import { buildSearchIndex, searchIndex } from "@/lib/v3-search-index";
import SearchView, { pageNumbers } from "../../src/app/(public)/tim-kiem/SearchView";

const WWW = process.env.TLHP_WWW_SRC;
const SKIP_WWW: string | false = WWW && existsSync(path.join(WWW, "libs/search.ts")) ? false : "TLHP_WWW_SRC chưa đặt (thư mục src của www): bỏ qua so khớp với www";
const lf = (text: string) => text.replace(/\r\n/g, "\n");

test("v3-search.ts giống từng byte libs/search.ts của www (trừ kiểu xuống dòng và dòng import bare)", { skip: SKIP_WWW }, () => {
	const mine = lf(readFileSync(path.resolve("src/lib/v3-search.ts"), "utf8"));
	const theirs = lf(readFileSync(path.join(WWW as string, "libs/search.ts"), "utf8")).replace('"@/libs/content/normalize"', '"@/lib/tlhp-content/normalize"');
	assert.equal(mine, theirs, "lib/v3-search.ts lệch khỏi src/libs/search.ts của www: chép lại tệp của www, chỉ đổi dòng import");
});

test("cùng bảng chuyên mục với www", { skip: SKIP_WWW }, () => {
	const www = readFileSync(path.join(WWW as string, "libs/search.ts"), "utf8");
	for (const section of SEARCH_SECTIONS) assert.ok(www.includes(`slug: "${section.slug}", name: "${section.name}", href: "${section.href}"`), section.slug);
});

test("thứ tự khu vực trong chỉ mục theo cùng bảng chân đồi bản đồ với www", { skip: SKIP_WWW }, async () => {
	const { MAP_PINS } = await import("@/lib/v3-areas");
	const config = readFileSync(path.join(WWW as string, "config/vuTru.ts"), "utf8");
	const slugs = [...config.matchAll(/slug:\s*"([a-z0-9-]+)"\s*,\s*x:/g)].map((m) => m[1]);
	assert.deepEqual(MAP_PINS.map((pin) => pin.slug), slugs);
});

const item = (section: string, title: string, text: string, date = "") => searchItem({ section, title, text, href: `/${section}/${title}`, date });

test("tìm không phân biệt dấu, theo từ nguyên vẹn: 'niem phat' thấy 'niệm Phật', 'co' không thấy 'Cộng'", () => {
	const items = [item("tong-chi-tu-hoc", "Niệm Phật", ""), item("dong-chay-hoang-phap", "Cộng tu", "")];
	assert.deepEqual(searchItems(items, "niem phat").map((i) => i.title), ["Niệm Phật"]);
	assert.deepEqual(searchItems(items, "niệm Phật").map((i) => i.title), ["Niệm Phật"]);
	assert.deepEqual(searchItems(items, "co"), []);
	assert.deepEqual(searchItems(items, "   "), []);
});

test("xếp hạng: tiêu đề đúng bằng từ khóa, rồi tiêu đề chứa cả cụm, rồi tiêu đề chứa đủ từ, rồi chỉ có trong chữ; cùng hạng thì mới nhất trước", () => {
	const items = [
		item("a", "Pháp hội lớn", "nói về niệm Phật", "2026-01-01"),
		item("a", "Niệm Phật", "", "2020-01-01"),
		item("a", "Công đức niệm Phật", "", "2021-01-01"),
		item("a", "Phật dạy niệm", "", "2022-01-01"),
		item("a", "Niệm Phật tinh tấn", "", "2025-01-01"),
	];
	assert.deepEqual(
		searchItems(items, "niệm phật").map((i) => i.title),
		["Niệm Phật", "Niệm Phật tinh tấn", "Công đức niệm Phật", "Phật dạy niệm", "Pháp hội lớn"],
	);
});

test("địa chỉ tìm kiếm: chuyên mục lạ và trang lạ về mặc định; từ khóa gọn khoảng trắng và cắt 100 ký tự", () => {
	assert.deepEqual(readSearchQuery({ q: "  niệm   Phật ", muc: "khong-co", trang: "abc" }), { q: "niệm Phật", section: "", page: 1 });
	assert.deepEqual(readSearchQuery({ q: ["a", "b"], muc: "lich-tu-hoc", trang: "3" }), { q: "a", section: "lich-tu-hoc", page: 3 });
	assert.equal(readSearchQuery({ q: "x".repeat(300) }).q.length, 100);
	assert.equal(searchHref({ q: "a b", section: "", page: 1 }), "/tim-kiem?q=a+b");
	assert.equal(searchHref({ q: "a", section: "gioi-thieu", page: 2 }), "/tim-kiem?q=a&muc=gioi-thieu&trang=2");
	assert.equal(searchHref({ q: "", section: "", page: 1 }), "/tim-kiem");
});

test("nhóm kết quả theo thứ tự chuyên mục của menu, bỏ chuyên mục không có kết quả", () => {
	const groups = groupResults([item("gioi-thieu", "A", ""), item("dong-chay-hoang-phap", "B", ""), item("gioi-thieu", "C", "")]);
	assert.deepEqual(groups.map((g) => [g.section.slug, g.items.length]), [["dong-chay-hoang-phap", 1], ["gioi-thieu", 2]]);
});

// ── chỉ mục từ kho nội dung ──────────────────────────────────────────────────

const post = (over: Partial<PostSummary>): PostSummary => ({
	id: "p", slug: "bai", title: "Bài", subtitle: "", section: "dong-chay-hoang-phap", category: { slug: "c", name: "C" }, author: "", publishedDate: "2026-05-01",
	views: 0, thumbnail: null, banner: null, summary: "Tóm tắt", galleryCount: 0, pinned: false, ...over,
});

function fakeRepo(parts: { posts?: PostSummary[]; calls?: { n: number } } = {}): ContentRepository {
	const posts = parts.posts ?? [post({})];
	const notUsed = async (): Promise<never> => {
		throw new Error("not used by the index");
	};
	return {
		listPosts: async (q): Promise<Page<PostSummary>> => {
			if (parts.calls) parts.calls.n++;
			const page = q?.page ?? 1;
			const size = q?.pageSize ?? 60;
			return { items: posts.slice((page - 1) * size, page * size), total: posts.length, page, pageSize: size, pageCount: Math.max(1, Math.ceil(posts.length / size)) };
		},
		getPostBySlug: notUsed,
		listCategories: notUsed,
		getSchedule: async () => ({
			events: [
				{ id: "e1", slug: "le-vu-lan", title: "Lễ Vu Lan", subtitle: "", category: { slug: "dai-le", name: "Đại Lễ" }, start: "2026-08-27", end: "2026-08-27", times: [], location: "", description: "Báo hiếu cha mẹ", notes: "", image: null, video: null },
				{ id: "e2", slug: "dai-sam-hoi-ngay-14", title: "Đại sám hối", subtitle: "Ngày 14", category: { slug: "k", name: "K" }, start: "2026-09-14", end: "2026-09-14", times: [], location: "", description: "", notes: "", image: null, video: null, programId: "prog1" },
			],
			programs: [],
			themes: [],
			quotes: [],
		}),
		listAboutTopics: async () => [{ id: "g1", slug: "lich-su", title: "Lịch sử", subtitle: "", tag: "", group: { slug: "g", name: "G" }, banner: null, portrait: null, overview: "Chùa ra đời", quote: null, milestones: [], contentHtml: "", gallery: [], book: null }],
		listTongChi: async () => [{ id: "t1", slug: "niem-phat", title: "NIỆM PHẬT", name: "Niệm Phật", subtitle: "", group: { slug: "pp", name: "Phương Pháp Hành Trì" }, banner: null, excerpt: "Cách niệm" }],
		getTongChi: notUsed,
		listAreas: async () => [
			{ id: "a3", slug: "khu-moi", name: "Khu mới", subtitle: "", temple: "tung-lam-hoa-phuc", cover: null, mapPos: null, intro: "", contentHtml: "" },
			{ id: "a2", slug: "tam-bao", name: "Tam Bảo", subtitle: "Đại Hùng Bảo Điện", temple: "tung-lam-hoa-phuc", cover: null, mapPos: null, intro: "Chính điện", contentHtml: "" },
			{ id: "a4", slug: "chua-khac", name: "Chùa khác", subtitle: "", temple: "chua-khac", cover: null, mapPos: null, intro: "", contentHtml: "" },
			{ id: "a1", slug: "ho-phong-sinh", name: "Hồ phóng sinh", subtitle: "", temple: "tung-lam-hoa-phuc", cover: null, mapPos: null, intro: "", contentHtml: "" },
		],
		listStatues: async () => [{ id: "s1", code: "TP0001", slug: "duc_phat_tp0001", name: "Đức Phật Thích Ca", subtitle: "Vô Thượng", areaCode: "tam_bao", main: true, image: null, href: "/bao-tuong/duc_phat_tp0001", assembly: { slug: "x", name: "X" }, cluster: "" }],
		getStatue: notUsed,
		listQuotes: async () => [],
	};
}

test("chỉ mục: mỗi loại trang có địa chỉ của V3 (bài, Tông Chỉ, Giới thiệu, khu vực theo bản đồ, bảo tượng, sự kiện)", async () => {
	const index = await buildSearchIndex(fakeRepo());
	const hrefs = index.map((i) => [i.section, i.href]);
	assert.deepEqual(hrefs, [
		["dong-chay-hoang-phap", "/dong-chay-hoang-phap/bai"],
		["tong-chi-tu-hoc", "/tong-chi-tu-hoc/niem-phat"],
		["gioi-thieu", "/gioi-thieu/lich-su"],
		["vu-tru-phat-giao", "/vu-tru-phat-giao/ho-phong-sinh"],
		["vu-tru-phat-giao", "/vu-tru-phat-giao/tam-bao"],
		["vu-tru-phat-giao", "/vu-tru-phat-giao/khu-moi"],
		["bao-tuong-phat-giao", "/bao-tuong/duc_phat_tp0001"],
		["lich-tu-hoc", "/lich-tu-hoc/le-vu-lan"],
	]);
	for (const [, href] of hrefs) assert.doesNotMatch(href, /^https?:|#/, "địa chỉ trong site, không neo, không sang www");
});

test("chỉ mục: khu vực của chùa khác không có; ngày của khóa lễ thường kỳ không có (không có trang riêng); chữ phụ gộp bằng ' · '", async () => {
	const index = await buildSearchIndex(fakeRepo());
	assert.ok(!index.some((i) => i.title === "Chùa khác"));
	assert.ok(!index.some((i) => i.title === "Đại sám hối"));
	assert.equal(index.find((i) => i.title === "Niệm Phật")?.text, "Phương Pháp Hành Trì · Cách niệm");
	assert.equal(index.find((i) => i.title === "Tam Bảo")?.text, "Đại Hùng Bảo Điện · Chính điện");
	assert.equal(index.find((i) => i.title === "Đức Phật Thích Ca")?.text, "Vô Thượng · TP0001");
	assert.equal(index.find((i) => i.title === "Lễ Vu Lan")?.date, "2026-08-27");
});

test("chỉ mục: đọc đủ mọi trang bài (60 bài một lần) và tìm theo mã bảo tượng, theo chữ phụ", async () => {
	const posts = Array.from({ length: 130 }, (_, i) => post({ id: `p${i}`, slug: `bai-${i}`, title: `Bài số ${i}` }));
	const index = await buildSearchIndex(fakeRepo({ posts }));
	assert.equal(index.filter((i) => i.section === "dong-chay-hoang-phap").length, 130);
	assert.deepEqual(searchItems(index, "tp0001").map((i) => i.title), ["Đức Phật Thích Ca"]);
	assert.deepEqual(searchItems(index, "bao hieu").map((i) => i.title), ["Lễ Vu Lan"]);
});

test("chỉ mục được giữ cho cùng một kho (chỉ dựng một lần), kho khác dựng riêng", async () => {
	const calls = { n: 0 };
	const repo = fakeRepo({ calls });
	const [a, b] = await Promise.all([searchIndex(repo), searchIndex(repo)]);
	assert.equal(a, b);
	assert.equal(calls.n, 1);
	await searchIndex(fakeRepo({ calls }));
	assert.equal(calls.n, 2);
});

// ── trang kết quả ────────────────────────────────────────────────────────────

function sample() {
	return [
		...Array.from({ length: 30 }, (_, i) => item("dong-chay-hoang-phap", `Niệm Phật ${i}`, "", `2026-01-${String((i % 28) + 1).padStart(2, "0")}`)),
		item("tong-chi-tu-hoc", "Niệm Phật", "Phương pháp"),
	];
}

const view = (q: string, results = searchItems(sample(), q), extra: { section?: string; page?: number } = {}) =>
	renderToStaticMarkup(createElement(SearchView, { query: { q, section: extra.section ?? "", page: extra.page ?? 1 }, results }));

const countResults = (html: string) => (html.match(/<li class="rounded-xl/g) ?? []).length;

test("trang kết quả: biểu mẫu GET về /tim-kiem (chạy khi không có JS), từ khóa điền sẵn, tiêu đề, số kết quả bằng tiếng Việt", () => {
	const html = view("niem phat");
	assert.match(html, /<form[^>]*action="\/tim-kiem"[^>]*method="get"/);
	assert.match(html, /<input[^>]*name="q"[^>]*/);
	assert.ok(html.includes('value="niem phat"'));
	assert.match(html, /<h1[^>]*>Tìm kiếm<\/h1>/);
	assert.match(html, /31 kết quả cho “niem phat”/);
	assert.match(html, /Xem cả 30 kết quả trong Dòng Chảy Hoằng Pháp/);
	assert.ok(html.includes('href="/tim-kiem?q=niem+phat&amp;muc=dong-chay-hoang-phap"'));
	assert.equal(countResults(html), 5, "mỗi nhóm tối đa 4 kết quả: 4 của Dòng Chảy + 1 của Tông Chỉ");
});

test("trang kết quả: một chuyên mục thì 12 kết quả một trang, có số trang và 'Trang sau'", () => {
	const html = view("niem phat", undefined, { section: "dong-chay-hoang-phap", page: 1 });
	assert.match(html, /30 kết quả cho “niem phat” trong Dòng Chảy Hoằng Pháp · trang 1\/3/);
	assert.equal(countResults(html), 12);
	assert.ok(html.includes('href="/tim-kiem?q=niem+phat&amp;muc=dong-chay-hoang-phap&amp;trang=2"'));
	assert.match(html, /rel="next"/);
	assert.match(html, /aria-current="page"/);
	const last = view("niem phat", undefined, { section: "dong-chay-hoang-phap", page: 3 });
	assert.equal(countResults(last), 6);
	assert.match(last, /rel="prev"/);
	assert.doesNotMatch(last, /rel="next"/);
	assert.match(view("niem phat", undefined, { section: "dong-chay-hoang-phap", page: 9 }), /Không có trang 9/);
});

test("trang kết quả: không có từ khóa hoặc không có kết quả thì gợi ý bảy chuyên mục", () => {
	const none = view("", []);
	assert.match(none, /Quý vị muốn tìm điều gì\?/);
	assert.match(none, /Nhập từ khóa để tìm/);
	assert.equal((none.match(/aria-label="Gợi ý chuyên mục"/g) ?? []).length, 1);
	for (const section of SEARCH_SECTIONS) assert.ok(none.includes(`href="${section.href}"`), section.href);
	const empty = view("zzz", searchItems(sample(), "zzz"));
	assert.match(empty, /Không tìm thấy kết quả cho “zzz”/);
	assert.match(empty, /Kính mời quý vị thử từ khóa ngắn hơn hoặc khác đi\./);
});

test("trang kết quả: từ khóa có ký tự HTML được thoát, không chèn thẻ", () => {
	const html = view("<b>x</b>", []);
	assert.ok(!html.includes("<b>x</b>"));
	assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
});

test("số trang: trang đầu, trang cuối và hai trang mỗi bên, chỗ hở là dấu ba chấm", () => {
	assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
	assert.deepEqual(pageNumbers(1, 10), [1, 2, 3, "...", 10]);
	assert.deepEqual(pageNumbers(5, 10), [1, "...", 3, 4, 5, 6, 7, "...", 10]);
	assert.deepEqual(pageNumbers(10, 10), [1, "...", 8, 9, 10]);
});

test("trang tìm kiếm không cho máy tìm kiếm lập chỉ mục (noindex), và đầu trang V3 có liên kết tới /tim-kiem", () => {
	const page = readFileSync("src/app/(public)/tim-kiem/page.tsx", "utf8");
	assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
	assert.match(readFileSync("src/components/public/layout/Header.tsx", "utf8"), /href="\/tim-kiem"/);
});
