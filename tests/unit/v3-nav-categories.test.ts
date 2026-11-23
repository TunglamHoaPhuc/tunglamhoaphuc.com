// Điều hướng và chuyên mục do admin quản lý: bảng điều hướng (Tông Chỉ, Dòng chảy), các nhóm của trang Tông Chỉ, bộ lọc chuyên mục
// của Dòng chảy và icon chuyên mục đều đến từ D1 của www (tên, nhóm mới, icon admin đặt), không còn danh sách đóng gói hay viết sẵn.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { buildDongChayCategories, buildDongChayNavList, dongChayBadge, DONG_CHAY_DEFAULT_ICON, DONG_CHAY_DEFAULT_NAME } from "@/data/dong-chay-hoang-phap-data";
import { DEFAULT_ICON_COLOR, iconSrcOf, librarySvg, readCategoryIcons, svgDataUri } from "@/lib/category-icons";
import { liveDongChayCategories } from "@/lib/dong-chay-categories";
import { ICON_LIBRARY } from "@/lib/icon-library";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { buildTongChiNavGroups, buildTongChiSections, defaultTongChiGroup, tongChiNavItems } from "@/lib/tong-chi-sections";
import { liveTongChiList } from "@/lib/v3-live";
import { createFakeD1, d1Over } from "../helpers/d1";

// ── Tông Chỉ: các nhóm lấy từ D1 ────────────────────────────────────────────

function seedTongChi() {
	const db = createFakeD1();
	db.insert("category", { id: "g1", slug: "nen-tang-tu-hoc", name: "Nền tảng tu học", kind: "tong-chi" });
	db.insert("category", { id: "g2", slug: "tong-phong-truyen-thua", name: "Tông phong truyền thừa", kind: "tong-chi" });
	// Nhóm do biên tập viên tạo trong admin: không có trong thiết kế cũ.
	db.insert("category", { id: "g3", slug: "huong-dan-nguoi-moi", name: "Hướng dẫn người mới", kind: "tong-chi" });
	// Nhóm đã đổi tên trong admin.
	db.insert("category", { id: "g4", slug: "lo-trinh-tu-hoc", name: "Lộ trình tu học cho mọi người", kind: "tong-chi" });
	// Nhóm chỉ có bài ẩn.
	db.insert("category", { id: "g5", slug: "nep-song-thien-gia", name: "Nếp sống thiền gia", kind: "tong-chi" });
	db.insert("media", { id: "m1", r2_key: "tong-chi/banner-1.webp", url: null });
	const article = (id: string, slug: string, title: string, group: string, extra: Record<string, unknown> = {}) =>
		db.insert("teaching_article", { id, slug, title, group_id: group, banner_media_id: "m1", subtitle: `Phụ đề ${slug}`, content_html: "<p>x</p>", ...extra });
	// Thứ tự bài trong D1 (position) đặt nhóm mới lên đầu: các nhóm cũ vẫn giữ chỗ của thiết kế.
	article("a0", "huong-dan-1", "Hướng dẫn một", "g3", { position: 1 });
	article("a1", "bo-de-tam", "Bồ đề tâm", "g1", { position: 2 });
	article("a2", "doi-thay", "Đời Thầy", "g2", { position: 3 });
	article("a3", "lo-trinh-tre", "Lộ trình cho người trẻ", "g4", { position: 4 });
	article("a4", "huong-dan-2", "Hướng dẫn hai", "g3", { position: 5 });
	article("h1", "bai-an", "Bài ẩn", "g5", { position: 6, status: "draft" });
	article("h2", "bai-xoa", "Bài xóa", "g1", { position: 7, deleted_at: "2026-01-01T00:00:00.000Z" });
	return createD1Repository(db);
}

test("trang Tông Chỉ: nhóm do biên tập viên tạo hiện ra, nhóm cũ giữ chỗ, tên lấy từ D1", async () => {
	const sections = buildTongChiSections(await liveTongChiList(seedTongChi()));
	assert.deepEqual(sections.map((s) => s.id), ["tong-phong", "nen-tang", "lo-trinh", "nhom-huong-dan-nguoi-moi"]);
	assert.deepEqual(sections.map((s) => s.title), ["TÔNG PHONG TRUYỀN THỪA", "NỀN TẢNG TU HỌC", "LỘ TRÌNH TU HỌC CHO MỌI NGƯỜI", "HƯỚNG DẪN NGƯỜI MỚI"]);
	const added = sections[3];
	assert.deepEqual(added.cards.map((c) => c.link), ["/tong-chi-tu-hoc/huong-dan-1", "/tong-chi-tu-hoc/huong-dan-2"]);
	assert.ok(added.bgWatermark, "nhóm mới dùng ảnh nền của thiết kế");
	assert.equal(new Set(sections.map((s) => s.stt)).size, sections.length, "mỗi khối một số thứ tự");
	// Giao diện của nhóm cũ không đổi: ảnh nền và số thứ tự vẫn của thiết kế.
	assert.equal(sections[0].stt, 1);
	assert.match(sections[0].bgWatermark ?? "", /tong-chi-tu-hoc-banner/);
});

test("thanh điều hướng trang Tông Chỉ có đúng các khối đang có, gọi bằng tên của khối", async () => {
	const sections = buildTongChiSections(await liveTongChiList(seedTongChi()));
	assert.deepEqual(tongChiNavItems(sections).map((n) => n.id), ["tong-chi-tu-hoc", "tong-phong", "nen-tang", "lo-trinh", "nhom-huong-dan-nguoi-moi"]);
	assert.equal(tongChiNavItems(sections)[0].label, "GIỚI THIỆU");
	assert.equal(tongChiNavItems(sections)[4].label, "HƯỚNG DẪN NGƯỜI MỚI");
	assert.deepEqual(buildTongChiSections([]), []);
	assert.deepEqual(tongChiNavItems([]).map((n) => n.id), ["tong-chi-tu-hoc"]);
});

test("bảng điều hướng Tông Chỉ: chỉ bài đang hiển thị, nhóm mới có thẻ, số bài đúng", async () => {
	const groups = buildTongChiNavGroups(await liveTongChiList(seedTongChi()));
	assert.deepEqual(groups.map((g) => g.slug), ["tong-phong-truyen-thua", "nen-tang-tu-hoc", "lo-trinh-tu-hoc", "huong-dan-nguoi-moi"]);
	assert.deepEqual(groups.map((g) => g.short), ["TÔNG PHONG", "NỀN TẢNG", "LỘ TRÌNH", "HƯỚNG DẪN NGƯỜI MỚI"]);
	const byGroup = Object.fromEntries(groups.map((g) => [g.slug, g.items.map((i) => i.slug)]));
	assert.deepEqual(byGroup["nen-tang-tu-hoc"], ["bo-de-tam"], "bài đã xóa không có");
	assert.deepEqual(byGroup["huong-dan-nguoi-moi"], ["huong-dan-1", "huong-dan-2"]);
	assert.equal(groups.some((g) => g.slug === "nep-song-thien-gia"), false, "nhóm chỉ có bài ẩn không hiện");
	assert.equal(groups.flatMap((g) => g.items).some((i) => /bai-an|bai-xoa/.test(i.slug)), false);
	const numbers = groups.flatMap((g) => g.items).map((i) => i.number).sort((a, b) => a - b);
	assert.deepEqual(numbers, [...new Set(numbers)], "số thứ tự không trùng");
	assert.equal(groups[0].items[0].subtitle, "Phụ đề doi-thay");
	assert.deepEqual(buildTongChiNavGroups([]), []);
});

test("nhóm mở sẵn của bảng: nhóm của bài đang đọc, rồi phần đang cuộn, rồi nhóm đầu", async () => {
	const groups = buildTongChiNavGroups(await liveTongChiList(seedTongChi()));
	assert.equal(defaultTongChiGroup(groups, { pathname: "/tong-chi-tu-hoc/lo-trinh-tre" }), "lo-trinh-tu-hoc");
	assert.equal(defaultTongChiGroup(groups, { pathname: "/tong-chi-tu-hoc/huong-dan-2" }), "huong-dan-nguoi-moi");
	assert.equal(defaultTongChiGroup(groups, { pathname: "/tong-chi-tu-hoc/khong-co", pageTitle: " bồ đề TÂM " }), "nen-tang-tu-hoc", "theo tiêu đề khi địa chỉ là bí danh");
	assert.equal(defaultTongChiGroup(groups, { pathname: "/tong-chi-tu-hoc", activeSection: "nhom-huong-dan-nguoi-moi" }), "huong-dan-nguoi-moi");
	assert.equal(defaultTongChiGroup(groups, { pathname: "/tong-chi-tu-hoc", activeSection: "tong-chi-tu-hoc" }), "tong-phong-truyen-thua");
	assert.equal(defaultTongChiGroup([], { pathname: "/tong-chi-tu-hoc" }), "");
});

// ── Dòng chảy: chuyên mục từ D1 ────────────────────────────────────────────

function seedDongChay() {
	const db = createFakeD1();
	db.insert("category", { id: "c1", slug: "cong-tu", name: "Cộng Tu Định Kỳ", kind: "post" });
	db.insert("category", { id: "c2", slug: "khoa-le-truyen-thong", name: "Khóa Lễ Truyền Thống", kind: "post" });
	db.insert("category", { id: "c3", slug: "chuyen-muc-moi", name: "Chuyên mục mới", kind: "post" });
	db.insert("category", { id: "c4", slug: "dai-le-su-kien", name: "Đại Lễ Sự Kiện", kind: "post" });
	db.insert("category", { id: "c5", slug: "tinh-do-nhan-gian", name: "Tịnh Độ Nhân Gian", kind: "post" });
	const post = (id: string, slug: string, category: string, extra: Record<string, unknown> = {}) =>
		db.insert("post", { id, slug, title: `Bài ${slug}`, section: "dong-chay-hoang-phap", category_id: category, published_date: "2026-08-23", ...extra });
	// Chuyên mục mới có nhiều bài nhất: vẫn đứng sau bốn chuyên mục cũ.
	post("p1", "moi-1", "c3");
	post("p2", "moi-2", "c3");
	post("p3", "moi-3", "c3");
	post("p4", "khoa-le-1", "c2");
	post("p5", "cong-tu-1", "c1");
	// Chuyên mục chỉ có bài nháp và bài đã xóa: không có trong bộ lọc.
	post("p6", "tinh-do-nhap", "c5", { status: "draft" });
	post("p7", "dai-le-xoa", "c4", { deleted_at: "2026-01-01T00:00:00.000Z" });
	return createD1Repository(db);
}

test("bộ lọc Dòng chảy: chuyên mục có bài ở D1, bốn chuyên mục cũ đứng trước, tên lấy từ D1", async () => {
	const categories = await liveDongChayCategories(seedDongChay(), null);
	assert.deepEqual(categories.map((c) => c.id), ["cong-tu", "khoa-le-truyen-thong", "chuyen-muc-moi"]);
	assert.deepEqual(categories.map((c) => c.label), ["Cộng Tu Định Kỳ", "Khóa Lễ Truyền Thống", "Chuyên mục mới"]);
	assert.deepEqual(categories.map((c) => c.name), ["CỘNG TU ĐỊNH KỲ", "KHÓA LỄ TRUYỀN THỐNG", "CHUYÊN MỤC MỚI"]);
	assert.equal(categories.some((c) => c.id === "tinh-do-nhan-gian" || c.id === "dai-le-su-kien"), false, "chuyên mục không còn bài hiện thì không có");
	const empty = await liveDongChayCategories(createD1Repository(createFakeD1()), null);
	assert.deepEqual(empty, [], "D1 trống: không có chuyên mục nào, không có bốn chuyên mục đóng gói");
});

test("chuyên mục: icon admin đặt thắng, rồi icon của bốn chuyên mục cũ, rồi icon của mục Dòng chảy", () => {
	const live = [{ slug: "cong-tu", name: "Cộng tu" }, { slug: "chuyen-muc-moi", name: "Chuyên mục mới" }, { slug: "khac", name: "" }];
	const icons = new Map([["cong-tu", "/anh-goc/s2-cnv03/icon-moi.webp"], ["chuyen-muc-moi", "data:image/svg+xml;charset=utf-8,x#"]]);
	const categories = buildDongChayCategories(live, icons);
	assert.equal(categories[0].iconSrc, "/anh-goc/s2-cnv03/icon-moi.webp");
	assert.equal(categories[1].iconSrc, "data:image/svg+xml;charset=utf-8,x#");
	assert.equal(categories[2].iconSrc, DONG_CHAY_DEFAULT_ICON);
	assert.equal(categories[2].label, "khac", "D1 không có tên: dùng slug, không để trống");
	const noIcons = buildDongChayCategories(live);
	assert.equal(noIcons[0].iconSrc, "/images/icons/icon-cong-tu.png", "không có icon admin: icon đang dùng");
});

test("huy hiệu thẻ bài: tên và icon của chuyên mục, chuyên mục lạ không bị gọi nhầm là chuyên mục cũ", () => {
	const categories = buildDongChayCategories([{ slug: "cong-tu", name: "Cộng tu định kỳ" }, { slug: "chuyen-muc-moi", name: "Chuyên mục mới" }], new Map([["chuyen-muc-moi", "/icon-moi.svg"]]));
	assert.deepEqual(dongChayBadge("chuyen-muc-moi", categories), { name: "CHUYÊN MỤC MỚI", iconSrc: "/icon-moi.svg" });
	assert.deepEqual(dongChayBadge("cong-tu", categories), { name: "CỘNG TU ĐỊNH KỲ", iconSrc: "/images/icons/icon-cong-tu.png" });
	assert.deepEqual(dongChayBadge("khoa-le-truyen-thong", []), { name: "KHÓA LỄ TRUYỀN THỐNG", iconSrc: "/images/icons/icon-khoa-le-truyen-thong.png" });
	assert.deepEqual(dongChayBadge("dai-le-su-kien", []).name, "ĐẠI LỄ SỰ KIỆN");
	assert.deepEqual(dongChayBadge("khong-biet", categories), { name: DONG_CHAY_DEFAULT_NAME, iconSrc: DONG_CHAY_DEFAULT_ICON });
	assert.deepEqual(dongChayBadge(undefined, categories), { name: DONG_CHAY_DEFAULT_NAME, iconSrc: DONG_CHAY_DEFAULT_ICON });
});

test("bảng điều hướng Dòng chảy: bài mới nhất, tổng số bài thật, không có bài đóng gói", () => {
	const article = (n: number) => ({ id: `p${n}`, slug: `bai-${n}`, title: `Bài ${n}`, subtitle: n % 2 ? "" : `Phụ đề ${n}`, subCategory: "CỘNG TU" });
	const all = Array.from({ length: 100 }, (_, i) => article(i + 1));
	const list = buildDongChayNavList(all);
	assert.equal(list.total, 100);
	assert.equal(list.items.length, 40);
	assert.equal(list.items[0].slug, "bai-1");
	assert.equal(list.items[1].subtitle, "Phụ đề 2");
	assert.equal(list.items[0].subtitle, "CỘNG TU", "không có phụ đề: dùng tên chuyên mục như bảng cũ");
	assert.deepEqual(buildDongChayNavList([]), { total: 0, items: [] });
	assert.equal(buildDongChayNavList(all, 5).items.length, 5);
});

// ── Icon chuyên mục do admin đặt ───────────────────────────────────────────

function iconsDb() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(`
		create table media (id text primary key, r2_key text, url text);
		create table category (id text primary key, kind text, section text default '', slug text, name text, icon_type text default 'none', icon_name text default '', icon_svg text default '',
			icon_media_id text, icon_url text default '', icon_color text default '', deleted_at text);
		insert into media (id, r2_key, url) values ('m1', 'icons/hoa-sen.webp', null), ('m2', null, 'https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/sen.png');
		insert into category (id, kind, section, slug, name, icon_type, icon_name, icon_svg, icon_media_id, icon_url, icon_color, deleted_at) values
			('1', 'post', 'dong-chay-hoang-phap', 'anh-thu-vien', 'Ảnh thư viện', 'image', '', '', 'm1', '', '', null),
			('2', 'post', 'dong-chay-hoang-phap', 'thu-vien-wp', 'Ảnh WordPress', 'image', '', '', 'm2', '', '', null),
			('3', 'post', 'dong-chay-hoang-phap', 'duong-dan-web', 'Đường dẫn web', 'image', '', '', null, '/brand/icons/hoa-sen.svg', '', null),
			('4', 'post', 'dong-chay-hoang-phap', 'thu-vien-icon', 'Thư viện icon', 'library', 'landmark', '', null, '', '#C0392B', null),
			('5', 'post', 'dong-chay-hoang-phap', 'svg-rieng', 'SVG riêng', 'svg', '', '<svg viewBox="0 0 24 24"><path d="M1 1h22" stroke="currentColor"/></svg>', null, '', '', null),
			('6', 'post', 'dong-chay-hoang-phap', 'khong-icon', 'Không icon', 'none', 'landmark', '', null, '', '', null),
			('7', 'post', 'dong-chay-hoang-phap', 'icon-la', 'Tên icon lạ', 'library', 'khong-co-icon-nay', '', null, '', '', null),
			('8', 'post', 'dong-chay-hoang-phap', 'da-xoa', 'Đã xóa', 'library', 'landmark', '', null, '', '', '2026-01-01T00:00:00.000Z'),
			('9', 'post', 'tri-tue-phat-phap', 'muc-khac', 'Mục khác', 'library', 'landmark', '', null, '', '', null),
			('10', 'event', 'dong-chay-hoang-phap', 'su-kien', 'Sự kiện', 'library', 'landmark', '', null, '', '', null);
	`);
	return d1Over(sqlite);
}

test("icon chuyên mục: đọc đúng loại, đúng mục, bỏ chuyên mục đã xóa và loại 'none'", async () => {
	const icons = await readCategoryIcons(iconsDb(), "post", "dong-chay-hoang-phap");
	assert.deepEqual([...icons.keys()].sort(), ["anh-thu-vien", "duong-dan-web", "svg-rieng", "thu-vien-icon", "thu-vien-wp"]);
	assert.equal(icons.get("anh-thu-vien"), "/anh-goc/s2-cnv03/icons/hoa-sen.webp", "ảnh thư viện đi qua /anh-goc/");
	assert.match(icons.get("thu-vien-wp") ?? "", /^\/anh-goc\/wordpress\//, "ảnh WordPress cũng đi qua /anh-goc/");
	assert.equal(icons.get("duong-dan-web"), "https://www.tunglamhoaphuc.com/brand/icons/hoa-sen.svg", "đường dẫn của web đi kèm thì trỏ về www");
	assert.equal((await readCategoryIcons(iconsDb(), "post", "tri-tue-phat-phap")).size, 1);
});

test("icon SVG: thành địa chỉ data:, currentColor thành màu admin chọn (không chọn: vàng), kết thúc bằng # để PostCard thêm ?v=4 không làm hỏng", async () => {
	const icons = await readCategoryIcons(iconsDb(), "post", "dong-chay-hoang-phap");
	const decode = (src: string) => decodeURIComponent(src.replace(/^data:image\/svg\+xml;charset=utf-8,/, "").replace(/#$/, ""));
	const library = icons.get("thu-vien-icon") ?? "";
	assert.match(library, /^data:image\/svg\+xml;charset=utf-8,/);
	assert.ok(library.endsWith("#"));
	assert.match(decode(library), /stroke="#C0392B"/);
	assert.doesNotMatch(decode(library), /currentColor/i);
	assert.match(decode(library), /^<svg xmlns=/);
	const own = decode(icons.get("svg-rieng") ?? "");
	assert.match(own, /stroke="#F2C14E"/, "không chọn màu: vàng của trang");
	assert.match(own, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, "SVG của admin thiếu xmlns thì được thêm, để <img> vẽ được");
	assert.match(decode(svgDataUri('<svg><path stroke="currentColor"/></svg>', "javascript:evil")), /stroke="#F2C14E"/, "màu không hợp lệ bị bỏ, dùng vàng");
	assert.equal(DEFAULT_ICON_COLOR, "#F2C14E");
	// PostCard nối "?v=4" vào địa chỉ icon: với địa chỉ data: nó phải rơi vào phần sau "#", không vào chính SVG.
	const url = new URL(`${library}?v=4`);
	assert.equal(url.hash, "#?v=4");
	assert.ok(decodeURIComponent(url.pathname).endsWith("</svg>"));
});

test("icon không dùng được thì không có địa chỉ (người gọi giữ icon cũ)", () => {
	assert.equal(iconSrcOf({ icon_type: "none", icon_name: "landmark" }), "");
	assert.equal(iconSrcOf({ icon_type: "library", icon_name: "khong-co-icon-nay" }), "");
	assert.equal(iconSrcOf({ icon_type: "svg", icon_svg: "<script>alert(1)</script>" }), "");
	assert.equal(iconSrcOf({ icon_type: "image" }), "");
	assert.equal(iconSrcOf({}), "");
	assert.equal(librarySvg("khong-co"), null);
});

test("D1 chưa đọc được hoặc không phải D1: không có icon, không lỗi", async () => {
	const { liveCategoryIcons } = await import("@/lib/category-icons");
	assert.equal((await liveCategoryIcons("post", "dong-chay-hoang-phap", null)).size, 0);
	const broken = { prepare: () => { throw new Error("D1 hỏng"); } } as never;
	const original = console.error;
	console.error = () => undefined;
	try {
		assert.equal((await liveCategoryIcons("post", "dong-chay-hoang-phap", broken)).size, 0);
	} finally {
		console.error = original;
	}
	assert.equal(ICON_LIBRARY.length > 100, true);
});

// ── Bản chép thư viện icon của www ──────────────────────────────────────────

const WWW = process.env.TLHP_WWW_SRC;
const SKIP_WWW: string | false = WWW && existsSync(path.join(WWW, "admin/icons/library.ts")) ? false : "TLHP_WWW_SRC chưa đặt (thư mục src của www): bỏ qua so khớp thư viện icon";

test("thư viện icon (lib/icon-library.ts) giống bản của www, hình vẽ giống từng byte", { skip: SKIP_WWW }, async () => {
	const lf = (text: string) => text.replace(/\r\n/g, "\n");
	assert.equal(lf(readFileSync("src/lib/icon-library.ts", "utf8")), lf(readFileSync(path.join(WWW as string, "admin/icons/library.ts"), "utf8")), "icon-library.ts lệch khỏi www/admin/icons/library.ts");
	const { pathToFileURL } = await import("node:url");
	const www = (await import(pathToFileURL(path.join(WWW as string, "admin/icons/render.ts")).href)) as { librarySvg(name: string): string | null };
	for (const { name } of ICON_LIBRARY) assert.equal(librarySvg(name), www.librarySvg(name), name);
});

// ── Quét mã nguồn: không còn danh sách đóng gói ───────────────────────────

test("bảng điều hướng, trang Tông Chỉ và bộ lọc Dòng chảy không còn dùng danh sách đóng gói hay viết sẵn", () => {
	const panel = readFileSync("src/components/tong-chi-tu-hoc/NavDropdownPanel.tsx", "utf8");
	assert.doesNotMatch(panel, /tong-chi-data\.json|HOANG_PHAP_ARTICLES|TONG_CHI_CATEGORIES/);
	const data = readFileSync("src/data/dong-chay-hoang-phap-data.ts", "utf8");
	assert.doesNotMatch(data, /HOANG_PHAP_ARTICLES|HOANG_PHAP_CATEGORIES|"contentHtml"/, "34 bài cũ không còn nằm trong mã");
	const client = readFileSync("src/app/(public)/dong-chay-hoang-phap/DongChayHoangPhapClient.tsx", "utf8");
	assert.doesNotMatch(client, /HOANG_PHAP_CATEGORIES|icon-cong-tu|icon-tinh-do-nhan-gian/, "tên và icon chuyên mục không viết sẵn trong trang");
	for (const file of ["src/app/(public)/tong-chi-tu-hoc/page.tsx", "src/app/(public)/tong-chi-tu-hoc/[slug]/page.tsx", "src/app/(public)/dong-chay-hoang-phap/[slug]/page.tsx"]) {
		assert.match(readFileSync(file, "utf8"), /NavPanelProvider/, `${file} chưa đưa danh sách bài của D1 cho bảng điều hướng`);
	}
	assert.match(readFileSync("src/app/(public)/dong-chay-hoang-phap/page.tsx", "utf8"), /liveDongChayCategories/);
});

test("the tabs of Dòng chảy follow the editors' order when the reader gives positions, and the original four first when it does not", () => {
	const fromD1 = buildDongChayCategories([
		{ slug: "chuyen-muc-moi", name: "Chuyên mục mới", position: 1 },
		{ slug: "dai-le-su-kien", name: "Đại lễ sự kiện", position: 2 },
		{ slug: "cong-tu", name: "Cộng tu", position: 3 },
	]);
	assert.deepEqual(
		fromD1.map((c) => c.id),
		["chuyen-muc-moi", "dai-le-su-kien", "cong-tu"],
	);
	const fromFiles = buildDongChayCategories([
		{ slug: "chuyen-muc-moi", name: "Chuyên mục mới" },
		{ slug: "dai-le-su-kien", name: "Đại lễ sự kiện" },
		{ slug: "cong-tu", name: "Cộng tu" },
	]);
	assert.deepEqual(
		fromFiles.map((c) => c.id),
		["cong-tu", "dai-le-su-kien", "chuyen-muc-moi"],
	);
});
