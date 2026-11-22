// Kiểm thử trên DỮ LIỆU THẬT (TLHP_REAL_DB, xem tests/helpers/real-db.ts), phần 7: "dựng trang không cần trình duyệt".
// Với MỌI dòng của từng loại, gọi đúng hàm đọc mà trang chi tiết gọi (liveTongChi, liveAboutTopic, liveArea, liveStatuePage,
// livePost, liveScheduleDetail) cùng các hàm dựng đi kèm (bài liên quan, thân bài khu vực, bản đồ, trang chủ...): không được
// ném lỗi, tiêu đề và thân bài không được rỗng khi D1 có chữ, và địa chỉ của một dòng phải mở đúng dòng đó (không mở nhầm bài khác).
import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToRendererText } from "@/lib/article-html";
import { areaBodyHtml } from "@/lib/area-body";
import { allArticles, DONG_CHAY_SECTION, relatedArticles, toArticle } from "@/lib/dong-chay";
import { relatedForEvent } from "@/lib/schedule-detail";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { buildTongChiSections, GROUP_TO_SECTION, tongChiNavItems } from "@/lib/tong-chi-sections";
import { toScheduleData } from "@/lib/v3-data";
import { homeGallery } from "@/lib/v3-home";
import { liveAboutTopic, liveArea, liveAreas, livePost, livePosts, liveScheduleDetail, liveTongChi, liveTongChiList, relatedTongChi } from "@/lib/v3-live";
import { assembliesOf, liveStatuePage, liveStatueRecords, readStatueLinks } from "@/lib/v3-statues";
import { mapSpotsOf } from "@/lib/v3-areas";
import { relatedWisdom, toWisdomItem, TRI_TUE_SECTION } from "@/lib/wisdom";
import { nowIso, openReal, rows, SKIP_REAL } from "../helpers/real-db";

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const LIVE = (alias: string) => `${alias}.deleted_at is null and (${alias}.status = 'published' or (${alias}.status = 'scheduled' and ${alias}.publish_at <= ?))`;

function open() {
	const { sqlite, d1 } = openReal();
	return { sqlite, d1, repo: createD1Repository(d1), now: nowIso() };
}

test("trang bài viết: mọi bài (632) mở đúng bài đó ở chuyên mục của nó, có tiêu đề, thân bài, ngày; trang liên quan dựng được", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo, now } = open();
	const truth = rows<Row>(sqlite, `select id, slug, section, title, content_html, summary, published_date from post p where ${LIVE("p")} order by p.rowid`, now);
	assert.equal(truth.length, 632);
	const articles = await allArticles(repo);
	const wisdom = await livePosts(TRI_TUE_SECTION, repo);
	let withBody = 0;
	for (const row of truth) {
		const where = `${row.section}/${row.slug}`;
		const post = await livePost(str(row.slug), str(row.section), repo);
		assert.ok(post, `${where}: trang phải mở được`);
		assert.equal(post.id, row.id, `${where}: mở nhầm bài khác`);
		assert.equal(post.slug, row.slug, where);
		assert.ok(post.title, `${where}: tiêu đề rỗng`);
		assert.equal(post.mainCategory, row.section, where);
		assert.ok(post.publishedDate, `${where}: thiếu ngày`);
		if (str(row.content_html)) {
			withBody++;
			assert.ok(post.contentHtml.trim(), `${where}: thân bài rỗng dù D1 có chữ`);
			assert.ok(htmlToRendererText(post.contentHtml).trim(), `${where}: bước dựng dòng làm rỗng thân bài`);
		}
		if (str(row.summary)) assert.ok(post.summary, `${where}: tóm tắt rỗng`);
		// Địa chỉ có dấu % (một số slug lưu dạng mã hóa) và chữ hoa vẫn mở đúng bài.
		assert.equal((await livePost(encodeURIComponent(str(row.slug)), str(row.section), repo))?.id, row.id, `${where}: slug mã hóa`);
		if (row.section === DONG_CHAY_SECTION) {
			assert.ok(relatedArticles(post, articles).every((r) => r.link !== `/${DONG_CHAY_SECTION}/${post.slug}`), `${where}: bài liên quan có chính nó`);
			assert.ok(toArticle(post).title, where);
		}
		if (row.section === TRI_TUE_SECTION) {
			const item = toWisdomItem(post);
			assert.ok(item.title && item.slug, where);
			assert.ok(relatedWisdom(post, wisdom).every((r) => r.link !== `/${TRI_TUE_SECTION}/${post.slug}`), `${where}: bài liên quan có chính nó`);
		}
	}
	assert.equal(withBody, 629);
	console.log(`  ${truth.length} bài mở được, ${withBody} bài có thân`);
});

test("trang tông chỉ: 25 bài mở đúng bài đó, có tiêu đề và thân bài; danh sách các nhóm dựng được và đủ 25", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo, now } = open();
	const truth = rows<Row>(sqlite, `select id, slug, title, body, content_html from teaching_article a where ${LIVE("a")} order by a.position, a.id`, now);
	const list = await liveTongChiList(repo);
	for (const row of truth) {
		const article = await liveTongChi(str(row.slug), repo);
		assert.ok(article, `${row.slug}: trang phải mở được`);
		assert.equal(String(article.id), String(row.id), `${row.slug}: mở nhầm bài khác`);
		assert.equal(article.slug, row.slug);
		assert.ok(article.title.trim(), `${row.slug}: tiêu đề rỗng`);
		if (str(row.body).trim() || str(row.content_html).trim()) assert.ok(article.contentHtml.trim().length > 40, `${row.slug}: thân bài rỗng dù D1 có chữ`);
		assert.ok(relatedTongChi(article, list).every((r) => r.link !== `/tong-chi-tu-hoc/${article.slug}`), `${row.slug}: liên quan có chính nó`);
	}
	const sections = buildTongChiSections(list);
	// Mỗi bài có một thẻ trên trang tổng (nhóm lạ không có phần thì thẻ biến mất): tổng thẻ bằng tổng bài.
	assert.equal(sections.reduce((sum, section) => sum + section.cards.length, 0), truth.length, "thẻ trên trang tông chỉ");
	assert.deepEqual(new Set(list.map((a) => a.category)).difference(new Set(Object.keys(GROUP_TO_SECTION))), new Set(), "nhóm của D1 không có phần trên trang");
	assert.ok(tongChiNavItems(sections).length > 0);
	console.log(`  ${truth.length} trang tông chỉ mở được`);
});

test("trang Giới thiệu: sáu chủ đề mở đúng theo slug (không theo id), có tiêu đề và thân bài", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo, now } = open();
	for (const row of rows<Row>(sqlite, `select id, slug, title, content_html from page p where ${LIVE("p")} order by p.position, p.id`, now)) {
		const topic = await liveAboutTopic(str(row.slug), repo);
		assert.ok(topic, `${row.slug}: trang phải mở được`);
		assert.equal(topic.id, row.id, `${row.slug}: mở nhầm chủ đề khác`);
		assert.ok(topic.title.trim(), `${row.slug}: tiêu đề rỗng`);
		assert.ok(topic.mainContentHtml.trim(), `${row.slug}: thân bài rỗng`);
		assert.ok(htmlToRendererText(topic.mainContentHtml).trim(), `${row.slug}: bước dựng làm rỗng thân bài`);
		assert.equal(await liveAboutTopic(str(row.id), repo), null, `${row.slug}: không mở bằng id`);
	}
});

test("trang khu vực và bản đồ: 14 khu mở đúng theo slug, luôn có chữ thân; bản đồ và trang chủ dựng được từ D1", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1, repo } = open();
	const areas = await liveAreas(repo);
	const statues = await liveStatueRecords({ repo, links: await readStatueLinks(d1) });
	for (const row of rows<Row>(sqlite, "select id, slug, name, intro, content_html from area where visible = 1 and deleted_at is null order by position, id")) {
		const area = await liveArea(str(row.slug), repo);
		assert.ok(area, `${row.slug}: trang phải mở được`);
		assert.equal(area.id, row.id, `${row.slug}: mở nhầm khu vực khác`);
		assert.ok(area.name.trim(), `${row.slug}: tên rỗng`);
		assert.ok(areaBodyHtml(area).trim(), `${row.slug}: không có chữ thân (cả thân bài lẫn giới thiệu đều rỗng)`);
		assert.ok(area.imgUrl, `${row.slug}: thiếu ảnh bìa`);
		// Tượng của trang khu vực này.
		const here = statues.filter((s) => s.areaSlug === area.slug);
		assert.ok(here.every((s) => s.areaName === area.name), `${row.slug}: tượng gắn nhầm khu vực`);
	}
	const spots = mapSpotsOf(areas, statues);
	assert.ok(spots.length > 0 && spots.every((s) => s.name && s.imgUrl));
	assert.ok(assembliesOf(statues).length > 0);
	const home = homeGallery(areas, statues);
	assert.ok(home.areas.length > 0 && home.statues.length > 0);
	// Mỗi tượng được gắn vào một khu vực đang hiện hoặc không khu vực nào (không trỏ khu vực ẩn).
	const slugs = new Set(areas.map((a) => a.slug));
	for (const s of statues) assert.ok(!s.areaSlug || slugs.has(s.areaSlug), `${s.slug}: gắn vào khu vực không hiện`);
	console.log(`  ${areas.length} khu vực, ${spots.length} điểm trên bản đồ, ${statues.filter((s) => s.areaSlug).length}/${statues.length} tượng có khu vực`);
});

test("trang tượng: 126 tượng mở đúng tượng đó theo slug, id và mã; có tên, ảnh, chữ thân; tượng liên quan không có chính nó", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1, repo } = open();
	const links = await readStatueLinks(d1);
	let withBody = 0;
	for (const row of rows<Row>(sqlite, "select id, slug, code, name, body, image_media_id from statue where deleted_at is null and status = 'published' order by position, id")) {
		const page = await liveStatuePage(str(row.slug), { repo, links });
		assert.ok(page, `${row.slug}: trang phải mở được`);
		assert.equal(page.statue.id, row.id, `${row.slug}: mở nhầm tượng khác`);
		assert.ok(page.statue.name.trim(), `${row.slug}: tên rỗng`);
		assert.ok(page.statue.imgUrl, `${row.slug}: thiếu ảnh`);
		if (str(row.body).trim()) {
			withBody++;
			assert.ok(page.statue.fullHistoryHtml.trim(), `${row.slug}: thân bài rỗng dù D1 có chữ`);
		}
		assert.ok(page.related.every((r) => r.id !== row.id), `${row.slug}: tượng liên quan có chính nó`);
		assert.ok(page.clusterMembers.every((m) => m.slug !== row.slug), `${row.slug}: cụm có chính nó`);
		assert.equal((await liveStatuePage(str(row.id), { repo, links }))?.statue.id, row.id, `${row.slug}: mở bằng id`);
		if (str(row.code)) assert.equal((await liveStatuePage(str(row.code).toLowerCase(), { repo, links }))?.statue.id, row.id, `${row.slug}: mở bằng mã`);
	}
	assert.equal(withBody, 126);
});

test("trang lịch tu học: 15 sự kiện (theo slug và theo id) và 3 khóa lễ mở đúng bản ghi của mình, có tiêu đề; bài liên quan dựng được", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo } = open();
	const articles = await allArticles(repo);
	const schedule = await repo.getSchedule();
	assert.ok(toScheduleData(schedule).customEvents.length > 0);
	for (const row of rows<Row>(sqlite, "select id, slug, title from calendar_event where deleted_at is null and status = 'published' order by start_date, end_date, position, id")) {
		const event = await liveScheduleDetail(str(row.slug), repo);
		assert.ok(event, `${row.slug}: trang phải mở được`);
		assert.equal(event.id, str(row.id), `${row.slug}: mở nhầm sự kiện khác`);
		assert.equal(event.title, row.title);
		assert.equal((await liveScheduleDetail(str(row.id), repo))?.id, str(row.id));
		assert.ok(relatedForEvent(event, articles).length <= 4);
	}
	for (const row of rows<Row>(sqlite, "select id, title from featured_program order by position, id")) {
		const program = await liveScheduleDetail(str(row.id), repo);
		assert.ok(program, `khóa lễ ${row.id}: trang phải mở được`);
		assert.equal(program.id, str(row.id));
		assert.equal(program.title, row.title);
	}
});
