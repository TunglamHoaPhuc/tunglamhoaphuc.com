// Kiểm thử trên DỮ LIỆU THẬT (TLHP_REAL_DB, xem tests/helpers/real-db.ts), phần 1: ĐẾM. Số V3 hiện ra bằng số trong D1,
// tính độc lập bằng SQL viết riêng trong kiểm thử (không dùng lại bộ lọc "live" của V3).
import assert from "node:assert/strict";
import { test } from "node:test";
import { DONG_CHAY_PAGE_SIZE, DONG_CHAY_SECTION, dongChayPage } from "@/lib/dong-chay";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { readMenu, readSettings, type MenuNode } from "@/lib/tlhp-site/siteData";
import { liveAbout, liveAreas, liveTongChiList, livePosts } from "@/lib/v3-live";
import { liveStatueRecords, readStatueLinks } from "@/lib/v3-statues";
import { menuToNav } from "@/lib/v3-menu";
import { FEATURED_AREA_PICKS, FEATURED_STATUE_PICKS, homeGallery } from "@/lib/v3-home";
import { toScheduleData } from "@/lib/v3-data";
import { TRI_TUE_SECTION } from "@/lib/wisdom";
import { nowIso, openReal, rows, SKIP_REAL } from "../helpers/real-db";

const LIVE = (alias: string) => `${alias}.deleted_at is null and (${alias}.status = 'published' or (${alias}.status = 'scheduled' and ${alias}.publish_at <= ?))`;

test("bài viết: số bài mỗi chuyên mục (đã xuất bản hoặc hẹn giờ đã tới, không trong thùng rác) bằng số V3 liệt kê", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1 } = openReal();
	const repo = createD1Repository(d1);
	const truth = rows<{ section: string; n: number }>(sqlite, `select section, count(*) n from post p where ${LIVE("p")} group by section`, nowIso());
	assert.ok(truth.length >= 2, "D1 thật có ít nhất hai chuyên mục");
	const total = truth.reduce((sum, r) => sum + r.n, 0);
	assert.equal(total, Number(rows<{ n: number }>(sqlite, "select count(*) n from post")[0].n), "ở bản nhập mới, mọi bài đều hiển thị (không nháp, không thùng rác)");
	let seen = 0;
	for (const { section, n } of truth) {
		const distinct = Number(rows<{ n: number }>(sqlite, `select count(distinct slug) n from post p where p.section = ? and ${LIVE("p")}`, section, nowIso())[0].n);
		assert.equal(distinct, n, `${section}: không có hai bài cùng slug trong một chuyên mục`);
		const first = await repo.listPosts({ section, pageSize: 60, page: 1 });
		assert.equal(first.total, n, `${section}: listPosts().total`);
		// Đi hết các trang 60 bài: không thiếu, không lặp.
		const slugs: string[] = [];
		for (let page = 1; page <= first.pageCount; page++) slugs.push(...(await repo.listPosts({ section, pageSize: 60, page })).items.map((p) => p.slug));
		assert.equal(slugs.length, n, `${section}: số bài qua các trang`);
		assert.equal(new Set(slugs).size, n, `${section}: không lặp bài`);
		const dbSlugs = rows<{ slug: string }>(sqlite, `select slug from post p where p.section = ? and ${LIVE("p")}`, section, nowIso()).map((r) => r.slug);
		assert.deepEqual([...slugs].sort(), [...dbSlugs].sort(), `${section}: đúng tập bài`);
		seen += n;
		// Số bài mỗi chuyên mục con.
		const byCategory = new Map(rows<{ slug: string; n: number }>(sqlite, `select c.slug, count(*) n from post p join category c on c.id = p.category_id where p.section = ? and ${LIVE("p")} group by c.slug`, section, nowIso()).map((r) => [r.slug, r.n]));
		const counted = await repo.listCategories(section);
		assert.equal(counted.length, byCategory.size, `${section}: số chuyên mục con`);
		for (const c of counted) assert.equal(c.count, byCategory.get(c.slug), `${section}/${c.slug}`);
	}
	assert.equal(seen, total);
	// Hai chuyên mục V3 có trang riêng: số bài của lớp đọc trang gọi (livePosts) bằng số trong D1.
	const of = (section: string) => truth.find((r) => r.section === section)?.n ?? 0;
	assert.equal((await livePosts(DONG_CHAY_SECTION, repo)).length, of(DONG_CHAY_SECTION));
	assert.equal((await livePosts(TRI_TUE_SECTION, repo)).length, of(TRI_TUE_SECTION));
	console.log("  bài viết:", Object.fromEntries(truth.map((r) => [r.section, r.n])));
});

test("trang Dòng chảy: phân trang 12 bài, mọi bài đúng một lần, bộ lọc chuyên mục con cũng đủ", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1 } = openReal();
	const repo = createD1Repository(d1);
	const total = Number(rows<{ n: number }>(sqlite, `select count(*) n from post p where p.section = ? and ${LIVE("p")}`, DONG_CHAY_SECTION, nowIso())[0].n);
	const first = await dongChayPage({ page: 1 }, repo);
	assert.equal(first.total, total);
	assert.equal(first.pageCount, Math.ceil(total / DONG_CHAY_PAGE_SIZE));
	const all: string[] = [];
	for (let page = 1; page <= first.pageCount; page++) {
		const data = await dongChayPage({ page }, repo);
		assert.equal(data.page, page);
		assert.equal(data.items.length, page < first.pageCount ? DONG_CHAY_PAGE_SIZE : total - DONG_CHAY_PAGE_SIZE * (first.pageCount - 1), `trang ${page}`);
		all.push(...data.items.map((a) => a.slug));
	}
	assert.equal(all.length, total);
	assert.equal(new Set(all).size, total, "mỗi bài đúng một lần qua các trang");
	// Một trang vượt cuối dừng ở trang cuối; sắp xếp mới nhất: ngày không tăng.
	assert.equal((await dongChayPage({ page: first.pageCount + 5 }, repo)).page, first.pageCount);
	const dates = (await dongChayPage({ page: 1, sort: "newest" }, repo)).items.map((a) => a.date);
	assert.deepEqual(dates, [...dates].sort().reverse());
	// Từng chuyên mục con: tổng các trang bằng số bài của chuyên mục đó trong D1.
	const cats = rows<{ slug: string; n: number }>(sqlite, `select c.slug, count(*) n from post p join category c on c.id = p.category_id where p.section = ? and ${LIVE("p")} group by c.slug`, DONG_CHAY_SECTION, nowIso());
	assert.ok(cats.length > 1);
	let sum = 0;
	for (const { slug, n } of cats) {
		const data = await dongChayPage({ category: slug, page: 1 }, repo);
		assert.equal(data.total, n, `danh mục ${slug}`);
		const got: string[] = [];
		for (let page = 1; page <= data.pageCount; page++) got.push(...(await dongChayPage({ category: slug, page }, repo)).items.map((a) => a.slug));
		assert.equal(new Set(got).size, n, `danh mục ${slug}: đủ bài qua các trang`);
		sum += n;
	}
	assert.equal(sum, total);
	console.log(`  Dòng chảy: ${total} bài, ${first.pageCount} trang, ${cats.length} chuyên mục con`);
});

test("Tông chỉ (25), Giới thiệu (6, mỗi trang một slug), khu vực hiện (14), tượng đã xuất bản (126)", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1 } = openReal();
	const repo = createD1Repository(d1);
	const now = nowIso();

	const tongChi = rows<{ slug: string; position: number; id: string }>(sqlite, `select slug, position, id from teaching_article a where ${LIVE("a")} order by position, id`, now);
	assert.equal(tongChi.length, 25);
	assert.deepEqual((await liveTongChiList(repo)).map((a) => a.slug), tongChi.map((r) => r.slug), "Tông chỉ: đúng tập và đúng thứ tự (position, id)");

	const about = rows<{ slug: string; id: string }>(sqlite, `select slug, id from page p where ${LIVE("p")} order by position, id`, now);
	assert.equal(about.length, 6);
	const topics = await liveAbout(repo);
	assert.deepEqual(topics.map((t) => t.slug), about.map((r) => r.slug), "Giới thiệu: đúng sáu slug theo thứ tự");
	assert.equal(new Set(topics.map((t) => t.slug)).size, 6);

	const areas = rows<{ slug: string }>(sqlite, "select slug from area where visible = 1 and deleted_at is null order by position, id");
	assert.equal(areas.length, 14);
	assert.deepEqual((await liveAreas(repo)).map((a) => a.slug), areas.map((r) => r.slug));

	const statues = rows<{ slug: string; code: string }>(sqlite, "select slug, code from statue where deleted_at is null and status = 'published' order by position, id");
	assert.equal(statues.length, 126);
	const records = await liveStatueRecords({ repo, links: await readStatueLinks(d1) });
	assert.deepEqual(records.map((s) => s.slug), statues.map((r) => r.slug));
	assert.equal((await repo.listStatues()).length, 126);
	console.log(`  tông chỉ ${tongChi.length}, giới thiệu ${about.length}, khu vực ${areas.length}, tượng ${statues.length}`);
});

test("lịch tu học: sự kiện đã xuất bản, khóa lễ nổi bật, chủ đề tháng, ảnh Lời Thầy; trang V3 nhận cùng số", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1 } = openReal();
	const repo = createD1Repository(d1);
	const schedule = await repo.getSchedule();
	const events = Number(rows<{ n: number }>(sqlite, "select count(*) n from calendar_event where deleted_at is null and status = 'published'")[0].n);
	const programs = Number(rows<{ n: number }>(sqlite, "select count(*) n from featured_program")[0].n);
	const themes = Number(rows<{ n: number }>(sqlite, "select count(*) n from month_theme")[0].n);
	const quotes = Number(rows<{ n: number }>(sqlite, "select count(*) n from quote_image q join media m on m.id = q.media_id")[0].n);
	assert.deepEqual([schedule.events.length, schedule.programs.length, schedule.themes.length, schedule.quotes.length], [events, programs, themes, quotes]);
	assert.deepEqual([events, programs, themes], [15, 3, 12]);
	// Hình dạng V3 trang đọc (toScheduleData): không mất sự kiện nào, mọi tháng đều có chủ đề.
	const shaped = toScheduleData(schedule);
	assert.equal(shaped.customEvents.length, events);
	assert.equal(shaped.featuredPrograms.length, programs);
	assert.equal(shaped.quoteGallery.length, quotes);
	const months = rows<{ month: number; title: string }>(sqlite, "select month, title from month_theme order by month");
	for (const { month, title } of months) {
		const theme = Object.values(shaped.monthThemes).find((t) => Number((t as { month?: number }).month) === month) as { title?: string } | undefined;
		assert.equal(theme?.title, title, `chủ đề tháng ${month}`);
	}
	console.log(`  lịch: ${events} sự kiện, ${programs} khóa lễ nổi bật, ${themes} chủ đề tháng, ${quotes} ảnh Lời Thầy`);
});

test("menu: mỗi menu hiện đúng các mục hiện/chưa xóa của nó; menu đầu trang thành thanh điều hướng", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1 } = openReal();
	const walk = (nodes: MenuNode[]): number => nodes.reduce((sum, node) => sum + 1 + walk(node.children), 0);
	let total = 0;
	for (const menu of rows<{ id: string }>(sqlite, "select id from menu order by id")) {
		const truth = Number(rows<{ n: number }>(sqlite, "select count(*) n from menu_item where menu_id = ? and deleted_at is null and visible = 1", menu.id)[0].n);
		const tree = await readMenu(d1, menu.id);
		assert.equal(tree ? walk(tree) : 0, truth, `menu ${menu.id}`);
		total += truth;
	}
	assert.equal(total, Number(rows<{ n: number }>(sqlite, "select count(*) n from menu_item")[0].n), "ở bản nhập mới mọi mục đều hiện");
	const header = (await readMenu(d1, "header")) ?? [];
	const nav = menuToNav(header);
	const topLevel = Number(rows<{ n: number }>(sqlite, "select count(*) n from menu_item where menu_id = 'header' and parent_id is null and visible = 1 and deleted_at is null and trim(label) <> ''")[0].n);
	assert.equal(nav.length, topLevel);
	assert.equal(nav.reduce((sum, item) => sum + item.children.length, 0), Number(rows<{ n: number }>(sqlite, "select count(*) n from menu_item where menu_id = 'header' and parent_id is not null and visible = 1 and deleted_at is null and trim(label) <> ''")[0].n));
	// Cài đặt: mỗi dòng của `setting` là JSON đọc được (bản nhập mới chưa có dòng nào: V3 giữ chữ trong thành phần).
	const settings = await readSettings(d1);
	assert.equal(Object.keys(settings).length, Number(rows<{ n: number }>(sqlite, "select count(*) n from setting")[0].n));
	console.log(`  menu: ${total} mục, ${nav.length} mục đầu trang, ${Object.keys(settings).length} cài đặt`);
});

test("trang chủ: các khu vực và tượng được chọn nổi bật đều có thật và hiện", { skip: SKIP_REAL }, async () => {
	const { d1 } = openReal();
	const repo = createD1Repository(d1);
	const areas = await liveAreas(repo);
	const statues = await liveStatueRecords({ repo, links: await readStatueLinks(d1) });
	const home = homeGallery(areas, statues);
	assert.deepEqual(home.areas.map((a) => a.targetUrl.split("/").pop()), FEATURED_AREA_PICKS.map((p) => p.slug), "mọi khu vực nổi bật có trong D1");
	assert.deepEqual(home.statues.length, FEATURED_STATUE_PICKS.length, "mọi tượng nổi bật (theo mã) có trong D1");
	for (const item of [...home.areas, ...home.statues]) assert.ok(item.name && item.imgUrl, `thiếu chữ hoặc ảnh: ${item.id}`);
});
