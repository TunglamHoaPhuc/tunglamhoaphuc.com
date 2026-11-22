// Kiểm thử trên DỮ LIỆU THẬT (TLHP_REAL_DB, xem tests/helpers/real-db.ts), phần 3: HIỂN THỊ.
// Làm việc trên BẢN SAO của tệp thật: sửa đúng như admin ghi (trạng thái nháp / chờ duyệt / tạm ẩn / hẹn giờ, thời điểm hẹn dạng ISO,
// thùng rác = deleted_at, khu vực ẩn = visible 0, bảng redirect do admin ghi khi đổi slug) rồi khẳng định: thứ không được hiện
// thì vắng mặt khỏi MỌI danh sách V3 và trang chi tiết của nó không tìm thấy (404); xuất bản/khôi phục thì hiện lại.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DONG_CHAY_PAGE_SIZE, DONG_CHAY_SECTION, dongChayPage } from "@/lib/dong-chay";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import type { ContentRepository } from "@/lib/tlhp-content/types";
import { resolveRedirect } from "@/lib/v3-redirect";
import { liveAbout, liveAboutTopic, liveArea, liveAreas, livePost, livePosts, liveScheduleDetail, liveTongChi, liveTongChiList } from "@/lib/v3-live";
import { liveStatuePage, liveStatueRecords, readStatueLinks } from "@/lib/v3-statues";
import { TRI_TUE_SECTION } from "@/lib/wisdom";
import { type Copy, copyOfReal, nowIso, rows, SKIP_REAL } from "../helpers/real-db";

type Row = Record<string, unknown>;

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const fresh = (c: Copy): ContentRepository => createD1Repository(c.d1);

/** Một thay đổi giống cái admin ghi, và việc V3 có được hiện thứ đó hay không sau thay đổi. */
type Change = { name: string; set: Record<string, unknown>; live: boolean };

const SCHEDULED_CHANGES: Change[] = [
	{ name: "bản nháp", set: { status: "draft" }, live: false },
	{ name: "chờ duyệt", set: { status: "pending" }, live: false },
	{ name: "tạm ẩn", set: { status: "hidden" }, live: false },
	{ name: "hẹn giờ chưa tới", set: { status: "scheduled", publish_at: iso(2) }, live: false },
	{ name: "hẹn giờ không có giờ", set: { status: "scheduled", publish_at: null }, live: false },
	{ name: "hẹn giờ đã tới (đến giờ)", set: { status: "scheduled", publish_at: iso(-1) }, live: true },
	{ name: "trong thùng rác (đang xuất bản)", set: { deleted_at: iso(-1) }, live: false },
	{ name: "trong thùng rác (bản nháp)", set: { status: "draft", deleted_at: iso(-1) }, live: false },
];

/** Áp thay đổi lên một dòng, chạy kiểm, rồi trả dòng về như cũ. */
async function through(c: Copy, table: string, id: string, columns: string[], changes: Change[], check: (live: boolean, change: string) => Promise<void>) {
	const original = rows<Row>(c.sqlite, `select ${columns.join(", ")} from ${table} where id = ?`, id)[0];
	assert.ok(original, `${table}/${id}`);
	for (const change of changes) {
		const set = Object.keys(change.set);
		c.sqlite.prepare(`update ${table} set ${set.map((k) => `${k} = ?`).join(", ")} where id = ?`).run(...(Object.values(change.set) as never[]), id);
		await check(change.live, change.name);
		c.sqlite.prepare(`update ${table} set ${columns.map((k) => `${k} = ?`).join(", ")} where id = ?`).run(...(columns.map((k) => original[k]) as never[]), id);
		await check(true, `${change.name} → trả lại như cũ`);
	}
}

// ── Bài viết ────────────────────────────────────────────────────────────────

test("bài viết: nháp, chờ duyệt, tạm ẩn, hẹn giờ chưa tới, thùng rác vắng khỏi mọi danh sách và 404; hẹn giờ đã tới thì hiện", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const [target] = rows<{ id: string; slug: string; section: string }>(c.sqlite, "select id, slug, section from post where section = ? order by rowid limit 1 offset 7", DONG_CHAY_SECTION);
		const total = Number(rows<{ n: number }>(c.sqlite, "select count(*) n from post where section = ?", DONG_CHAY_SECTION)[0].n);
		await through(c, "post", target.id, ["status", "publish_at", "deleted_at"], SCHEDULED_CHANGES, async (live, name) => {
			const repo = fresh(c);
			const where = `${name} (${live ? "phải hiện" : "phải ẩn"})`;
			const slugs = (await livePosts(DONG_CHAY_SECTION, repo)).map((p) => p.slug);
			assert.equal(slugs.includes(target.slug), live, `danh sách livePosts: ${where}`);
			assert.equal(slugs.length, live ? total : total - 1, `số bài: ${where}`);
			assert.equal((await livePost(target.slug, DONG_CHAY_SECTION, repo)) !== null, live, `trang chi tiết: ${where}`);
			assert.equal((await repo.getPostBySlug(target.slug)) !== null, live, `getPostBySlug: ${where}`);
			assert.equal((await repo.listPosts({ section: DONG_CHAY_SECTION, pageSize: 60 })).total, live ? total : total - 1, `listPosts: ${where}`);
			// Trang Dòng chảy: không có trong bất kỳ trang nào, số trang cuối đúng.
			const first = await dongChayPage({ page: 1 }, repo);
			assert.equal(first.total, live ? total : total - 1, `Dòng chảy total: ${where}`);
			assert.equal(first.pageCount, Math.ceil((live ? total : total - 1) / DONG_CHAY_PAGE_SIZE));
			const all: string[] = [];
			for (let page = 1; page <= first.pageCount; page++) all.push(...(await dongChayPage({ page }, repo)).items.map((a) => a.slug));
			assert.equal(all.includes(target.slug), live, `phân trang Dòng chảy: ${where}`);
			// Đường id cũ ("post-880") cũng không lách được.
			assert.equal((await livePost(target.id, DONG_CHAY_SECTION, repo)) !== null, live, `mở bằng id: ${where}`);
		});
	} finally {
		c.close();
	}
});

test("bài viết: xuất bản một bài nháp / một bài hẹn giờ rồi khôi phục khỏi thùng rác thì hiện ngay; hẹn giờ tới giờ thì tự hiện", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const [target] = rows<{ id: string; slug: string }>(c.sqlite, "select id, slug from post where section = ? order by rowid limit 1 offset 3", TRI_TUE_SECTION);
		const shown = async () => (await livePost(target.slug, TRI_TUE_SECTION, fresh(c))) !== null;
		const set = (cols: Record<string, unknown>) => c.sqlite.prepare(`update post set ${Object.keys(cols).map((k) => `${k} = ?`).join(", ")} where id = ?`).run(...(Object.values(cols) as never[]), target.id);
		set({ status: "draft" });
		assert.equal(await shown(), false, "nháp");
		set({ status: "published" });
		assert.equal(await shown(), true, "xuất bản");
		set({ status: "scheduled", publish_at: iso(1) });
		assert.equal(await shown(), false, "hẹn giờ");
		set({ status: "published", publish_at: null });
		assert.equal(await shown(), true, "xuất bản ngay khi đang hẹn giờ");
		set({ deleted_at: nowIso() });
		assert.equal(await shown(), false, "vào thùng rác");
		set({ deleted_at: null });
		assert.equal(await shown(), true, "khôi phục");
		// Hẹn giờ vài mili giây nữa: chưa hiện, sau đó hiện, không cần ai làm gì (trạng thái suy ra lúc đọc).
		set({ status: "scheduled", publish_at: new Date(Date.now() + 1500).toISOString() });
		assert.equal(await shown(), false, "sắp tới giờ");
		await new Promise((resolve) => setTimeout(resolve, 1700));
		assert.equal(await shown(), true, "tới giờ thì tự hiện");
	} finally {
		c.close();
	}
});

test("hai bài trùng slug ở hai chuyên mục khác nhau: mỗi bài mở được ở chuyên mục của mình, danh sách mỗi chuyên mục thêm đúng một", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const a = rows<Row>(c.sqlite, "select * from post where section = ? order by rowid limit 1 offset 2", DONG_CHAY_SECTION)[0];
		const b = rows<Row>(c.sqlite, "select * from post where section = ? order by rowid limit 1 offset 5", TRI_TUE_SECTION)[0];
		const before = { dc: (await livePosts(DONG_CHAY_SECTION, fresh(c))).length, tt: (await livePosts(TRI_TUE_SECTION, fresh(c))).length };
		// Đưa bài của Trí tuệ về cùng slug với bài của Dòng chảy (admin cho phép: slug duy nhất theo chuyên mục).
		c.sqlite.prepare("update post set slug = ? where id = ?").run(a.slug as string, b.id as string);
		const repo = fresh(c);
		const dc = await livePost(a.slug as string, DONG_CHAY_SECTION, repo);
		const tt = await livePost(a.slug as string, TRI_TUE_SECTION, repo);
		assert.equal(dc?.id, a.id, "Dòng chảy mở đúng bài của Dòng chảy");
		assert.equal(tt?.id, b.id, "Trí tuệ mở đúng bài của Trí tuệ");
		assert.equal(tt?.title, b.title);
		assert.equal(tt?.contentHtml, b.content_html, "thân bài của bài thứ hai (không phải của bài trùng slug)");
		assert.equal((await livePosts(DONG_CHAY_SECTION, repo)).length, before.dc);
		assert.equal((await livePosts(TRI_TUE_SECTION, repo)).length, before.tt);
		// Và ngược lại: bài nào đứng trước trong bảng cũng không che bài kia.
		c.sqlite.prepare("update post set slug = ? where id = ?").run(`${a.slug}-khac`, a.id as string);
		c.sqlite.prepare("update post set slug = ? where id = ?").run(a.slug as string, a.id as string);
		const repo2 = fresh(c);
		assert.equal((await livePost(a.slug as string, TRI_TUE_SECTION, repo2))?.id, b.id);
		assert.equal((await livePost(a.slug as string, DONG_CHAY_SECTION, repo2))?.id, a.id);
	} finally {
		c.close();
	}
});

test("đổi slug (có dòng redirect do admin ghi) và đổi chuyên mục: địa chỉ cũ 404 ở trang nhưng bảng chuyển hướng dẫn tới địa chỉ mới đang mở được", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const p = rows<{ id: string; slug: string; section: string }>(c.sqlite, "select id, slug, section from post where section = ? order by rowid limit 1 offset 9", DONG_CHAY_SECTION)[0];
		const oldPath = `/${p.section}/${p.slug}`;
		const newSlug = `${p.slug}-moi`;
		// Đúng như service.ts redirectStatements: đổi slug và ghi redirect trong cùng một lượt.
		c.sqlite.prepare("update post set slug = ? where id = ?").run(newSlug, p.id);
		c.sqlite.prepare("insert into redirect (from_path, to_path, code, note, hits, active, created_by, created_at) values (?, ?, 301, ?, 0, 1, null, ?)").run(oldPath, `/${p.section}/${newSlug}`, "Tự động: bài đổi đường dẫn", nowIso());
		let repo = fresh(c);
		assert.equal(await livePost(p.slug, p.section, repo), null, "địa chỉ cũ không còn là bài");
		assert.equal((await livePost(newSlug, p.section, repo))?.id, p.id, "địa chỉ mới mở bài");
		const found = await resolveRedirect(c.d1, oldPath);
		assert.deepEqual(found && { to: found.to, code: found.code }, { to: `/${p.section}/${newSlug}`, code: 301 });
		assert.ok(await livePost(found!.to.split("/").pop()!, p.section, repo), "đích của chuyển hướng là trang đang mở được");
		// Các cách viết khác của cùng địa chỉ cũ: có "/" cuối, mã hóa.
		assert.ok(await resolveRedirect(c.d1, `${oldPath}/`));
		// Dòng redirect đã tắt, trỏ ra ngoài, hay tạo vòng thì không chuyển hướng (V3 trả 404).
		c.sqlite.prepare("update redirect set active = 0 where from_path = ?").run(oldPath);
		assert.equal(await resolveRedirect(c.d1, oldPath), null, "đã tắt");
		c.sqlite.prepare("update redirect set active = 1, to_path = 'https://example.org/x' where from_path = ?").run(oldPath);
		assert.equal(await resolveRedirect(c.d1, oldPath), null, "ra ngoài trang");
		c.sqlite.prepare("update redirect set to_path = ? where from_path = ?").run(oldPath, oldPath);
		assert.equal(await resolveRedirect(c.d1, oldPath), null, "tự trỏ vào mình");
		// Đổi chuyên mục: bài chuyển từ Dòng chảy sang Trí tuệ, địa chỉ cũ dẫn tới địa chỉ mới.
		const q = rows<{ id: string; slug: string }>(c.sqlite, "select id, slug from post where section = ? order by rowid limit 1 offset 11", DONG_CHAY_SECTION)[0];
		const categoryOfTriTue = rows<{ id: string }>(c.sqlite, "select category_id as id from post where section = ? limit 1", TRI_TUE_SECTION)[0].id;
		c.sqlite.prepare("update post set section = ?, category_id = ? where id = ?").run(TRI_TUE_SECTION, categoryOfTriTue, q.id);
		c.sqlite.prepare("insert into redirect (from_path, to_path, code, note, hits, active, created_by, created_at) values (?, ?, 301, '', 0, 1, null, ?)").run(`/${DONG_CHAY_SECTION}/${q.slug}`, `/${TRI_TUE_SECTION}/${q.slug}`, nowIso());
		repo = fresh(c);
		assert.equal(await livePost(q.slug, DONG_CHAY_SECTION, repo), null, "không mở dưới chuyên mục cũ");
		assert.equal((await livePost(q.slug, TRI_TUE_SECTION, repo))?.id, q.id, "mở dưới chuyên mục mới");
		assert.equal((await resolveRedirect(c.d1, `/${DONG_CHAY_SECTION}/${q.slug}`))?.to, `/${TRI_TUE_SECTION}/${q.slug}`);
		// Địa chỉ dành riêng và địa chỉ không có trong bảng không chuyển hướng.
		assert.equal(await resolveRedirect(c.d1, "/quan-tri/bai-viet"), null);
		assert.equal(await resolveRedirect(c.d1, "/dong-chay-hoang-phap/khong-co-gi-ca"), null);
	} finally {
		c.close();
	}
});

// ── Tông chỉ và Giới thiệu ───────────────────────────────────────────────────

test("tông chỉ: nháp, hẹn giờ chưa tới, thùng rác biến mất khỏi danh sách (25) và trang 404; hẹn giờ đã tới hiện", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const target = rows<{ id: string; slug: string }>(c.sqlite, "select id, slug from teaching_article order by position, id limit 1 offset 4")[0];
		await through(c, "teaching_article", target.id, ["status", "publish_at", "deleted_at"], SCHEDULED_CHANGES, async (live, name) => {
			const repo = fresh(c);
			const list = await liveTongChiList(repo);
			assert.equal(list.length, live ? 25 : 24, `danh sách: ${name}`);
			assert.equal(list.some((a) => a.slug === target.slug), live, `danh sách theo slug: ${name}`);
			const article = await liveTongChi(target.slug, repo);
			assert.equal(article !== null, live, `trang chi tiết: ${name}`);
			if (article) assert.ok(article.contentHtml.length > 0, `thân bài: ${name}`);
		});
	} finally {
		c.close();
	}
});

test("Giới thiệu: nháp, hẹn giờ chưa tới, thùng rác: trang 404 và còn 5 chủ đề; không mở được bằng id (gt-02) hay vị trí", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const target = rows<{ id: string; slug: string }>(c.sqlite, "select id, slug from page order by position, id limit 1 offset 2")[0];
		await through(c, "page", target.id, ["status", "publish_at", "deleted_at"], SCHEDULED_CHANGES, async (live, name) => {
			const repo = fresh(c);
			assert.equal((await liveAbout(repo)).length, live ? 6 : 5, `danh sách: ${name}`);
			const topic = await liveAboutTopic(target.slug, repo);
			assert.equal(topic !== null, live, `trang chi tiết: ${name}`);
			if (topic) assert.ok(topic.mainContentHtml.length > 0 && topic.title, `chữ: ${name}`);
			assert.equal(await liveAboutTopic(target.id, repo), null, `không mở bằng id: ${name}`);
		});
	} finally {
		c.close();
	}
});

// ── Khu vực, tượng, sự kiện ───────────────────────────────────────────────────

test("khu vực: ẩn (visible 0) hoặc đã xóa thì mất khỏi danh sách (14), trang 404, kể cả qua địa chỉ cũ; hiện lại khi bật; tượng của khu vực ẩn không gắn khu vực", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const target = rows<{ id: string; slug: string }>(c.sqlite, "select id, slug from area where slug = 'tang-kinh-cac'")[0];
		assert.ok(target, "khu vực có bí danh cũ 'thu-vien'");
		const changes: Change[] = [
			{ name: "ẩn", set: { visible: 0 }, live: false },
			{ name: "đã xóa", set: { deleted_at: iso(-1) }, live: false },
			{ name: "ẩn và xóa", set: { visible: 0, deleted_at: iso(-1) }, live: false },
		];
		const statueIn = rows<{ id: string }>(c.sqlite, "select id from statue where area_id = ? and status = 'published' and deleted_at is null limit 1", target.id)[0];
		await through(c, "area", target.id, ["visible", "deleted_at"], changes, async (live, name) => {
			const repo = fresh(c);
			assert.equal((await liveAreas(repo)).length, live ? 14 : 13, `danh sách: ${name}`);
			assert.equal((await liveArea(target.slug, repo)) !== null, live, `trang theo slug: ${name}`);
			assert.equal((await liveArea("thu-vien", repo)) !== null, live, `trang theo địa chỉ cũ: ${name}`);
			if (statueIn) {
				const links = await readStatueLinks(c.d1);
				assert.equal(links.area.get(statueIn.id), live ? target.slug : null, `tượng thuộc khu vực: ${name}`);
			}
		});
	} finally {
		c.close();
	}
});

test("tượng: nháp, chờ duyệt, tạm ẩn, hẹn giờ, thùng rác vắng khỏi danh sách (126) và trang 404; xuất bản/khôi phục thì hiện", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const target = rows<{ id: string; slug: string }>(c.sqlite, "select id, slug from statue order by position, id limit 1 offset 20")[0];
		const related = rows<{ id: string }>(c.sqlite, "select id from statue order by position, id limit 1 offset 30")[0];
		c.sqlite.prepare("insert into statue_related (statue_id, related_id, position) values (?, ?, 0)").run(related.id, target.id);
		const changes: Change[] = [
			{ name: "bản nháp", set: { status: "draft" }, live: false },
			{ name: "chờ duyệt", set: { status: "pending" }, live: false },
			{ name: "tạm ẩn", set: { status: "hidden" }, live: false },
			{ name: "hẹn giờ", set: { status: "scheduled" }, live: false },
			{ name: "thùng rác", set: { deleted_at: iso(-1) }, live: false },
		];
		await through(c, "statue", target.id, ["status", "deleted_at"], changes, async (live, name) => {
			const repo = fresh(c);
			const links = await readStatueLinks(c.d1);
			const records = await liveStatueRecords({ repo, links });
			assert.equal(records.length, live ? 126 : 125, `danh sách: ${name}`);
			assert.equal(records.some((s) => s.slug === target.slug), live, `danh sách theo slug: ${name}`);
			assert.equal((await liveStatuePage(target.slug, { repo, links })) !== null, live, `trang theo slug: ${name}`);
			assert.equal((await liveStatuePage(target.id, { repo, links })) !== null, live, `trang theo id: ${name}`);
			assert.equal((links.related.get(related.id) ?? []).includes(target.id), live, `tượng liên quan: ${name}`);
			// Cụm tượng của tượng khác không nhắc tới tượng ẩn.
			if (!live) for (const s of records) assert.equal(s.clusterMembers.some((m) => m.slug === target.slug), false, `cụm tượng của ${s.slug}: ${name}`);
		});
	} finally {
		c.close();
	}
});

test("sự kiện lịch tu học: nháp, tạm ẩn, thùng rác vắng khỏi lịch (15) và trang 404; xuất bản thì hiện", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const target = rows<{ id: string; slug: string }>(c.sqlite, "select id, slug from calendar_event order by start_date, id limit 1 offset 6")[0];
		const changes: Change[] = [
			{ name: "bản nháp", set: { status: "draft" }, live: false },
			{ name: "chờ duyệt", set: { status: "pending" }, live: false },
			{ name: "tạm ẩn", set: { status: "hidden" }, live: false },
			{ name: "thùng rác", set: { deleted_at: iso(-1) }, live: false },
		];
		await through(c, "calendar_event", target.id, ["status", "deleted_at"], changes, async (live, name) => {
			const repo = fresh(c);
			const schedule = await repo.getSchedule();
			assert.equal(schedule.events.length, live ? 15 : 14, `lịch: ${name}`);
			assert.equal(schedule.events.some((e) => e.slug === target.slug), live, `lịch theo slug: ${name}`);
			assert.equal((await liveScheduleDetail(target.slug, repo)) !== null, live, `trang theo slug: ${name}`);
			assert.equal((await liveScheduleDetail(target.id, repo)) !== null, live, `trang theo id: ${name}`);
		});
	} finally {
		c.close();
	}
});
