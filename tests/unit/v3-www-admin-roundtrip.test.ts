// Khứ hồi admin www -> V3: nội dung do CHÍNH mã admin của www ghi (tạo, xuất bản, tạm ẩn, hẹn giờ, thùng rác, khôi phục, đổi slug, đổi
// chuyên trang, trường riêng của Pháp Âm / Video / Ấn phẩm) có được lớp đọc của V3 đọc đúng không.
//
// Cách làm: tests/helpers/www-admin-world.mjs chạy mã admin của www trong MỘT TIẾN TRÌNH RIÊNG (bằng tsx của www; mã admin dùng cú pháp
// TypeScript mà `node --test` của V3 không nạp được), để admin ghi bài qua đúng API của nó trên một SQLite đã migrate thật, rồi xuất tệp
// SQLite + "ý định" của admin (bài nào đáng hiện, bài nào không). Kiểm thử này chỉ ĐỌC tệp đó bằng lớp đọc của V3 (createD1Repository,
// livePosts/livePost, toPostRecord, resolveRedirect), và so với SQL viết riêng ở đây (không dùng lại bộ lọc "live" của V3).
//
// Chạy:  TLHP_WWW_SRC=E:/tlhp-av3/src npm test      (không đặt TLHP_WWW_SRC thì bỏ qua, như v3-www-parity.test.ts)
// Cần: cây www có node_modules (tsx, vitest không cần) và thư mục migrations/. Không chạm Cloudflare thật; tệp tạm nằm trong thư mục tạm
// của hệ điều hành và bị xóa khi xong.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { DONG_CHAY_SECTION } from "@/lib/dong-chay";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { resolveRedirect } from "@/lib/v3-redirect";
import { livePost, livePosts } from "@/lib/v3-live";
import { toPostRecord } from "@/lib/v3-data";
import { TRI_TUE_SECTION } from "@/lib/wisdom";
import { d1Over } from "../helpers/d1";
import { nowIso, rows } from "../helpers/real-db";

type Scenario = {
	id: string;
	slug: string;
	section: string;
	title: string;
	live: boolean;
	oldSlug?: string;
	oldSection?: string;
	expect?: Record<string, string>;
};
type Row = Record<string, unknown>;

const WWW_SRC = process.env.TLHP_WWW_SRC;
const WWW = WWW_SRC ? path.resolve(WWW_SRC, "..") : "";
const TSX = path.join(WWW, "node_modules", "tsx", "dist", "cli.mjs");
const PRODUCER = path.resolve("tests/helpers/www-admin-world.mjs");

const SKIP: string | false =
	WWW_SRC && existsSync(TSX) && existsSync(path.join(WWW, "migrations"))
		? false
		: "TLHP_WWW_SRC chưa đặt (thư mục src của www, cần có node_modules/tsx và migrations/): bỏ qua khứ hồi admin www -> V3";

const tmp = SKIP ? "" : mkdtempSync(path.join(tmpdir(), "tlhp-admin-roundtrip-"));
after(() => {
	// Windows không xóa được tệp SQLite còn mở.
	world?.sqlite.close();
	if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Dựng thế giới admin một lần (tiến trình con), mở tệp SQLite kết quả chỉ để đọc. */
function build() {
	const dbFile = path.join(tmp, "admin.sqlite");
	const jsonFile = path.join(tmp, "intent.json");
	const run = spawnSync(process.execPath, [TSX, PRODUCER, WWW, dbFile, jsonFile], {
		cwd: WWW,
		env: { ...process.env, TSX_TSCONFIG_PATH: path.join(WWW, "tsconfig.json") },
		encoding: "utf8",
		timeout: 120_000,
	});
	assert.equal(run.status, 0, `không dựng được thế giới admin www:\n${run.stdout}\n${run.stderr}`);
	const sqlite = new DatabaseSync(dbFile, { readOnly: true });
	const d1 = d1Over(sqlite);
	return { sqlite, d1, intent: JSON.parse(readFileSync(jsonFile, "utf8")) as Record<string, Scenario> };
}
const world = SKIP ? null : build();
const W = () => world as NonNullable<typeof world>;
/** Mỗi lần đọc dùng một repository mới: repository giữ danh sách trong bộ nhớ cho tới khi hết hạn. */
const repo = () => createD1Repository(W().d1);

const named = (name: string): Scenario => {
	const s = W().intent[name];
	assert.ok(s, `ý định của admin thiếu tình huống "${name}"`);
	return s;
};

/** Mọi bài V3 liệt kê, theo từng chuyên trang có trong bảng. */
async function listedByV3(): Promise<ReturnType<typeof toPostRecord>[]> {
	const sections = rows<{ section: string }>(W().sqlite, "select distinct section from post").map((r) => r.section);
	const out: ReturnType<typeof toPostRecord>[] = [];
	for (const section of sections) out.push(...(await livePosts(section, repo())));
	return out;
}

/** Sự thật độc lập: những bài đang hiển thị theo quy tắc của admin (không thùng rác; đã xuất bản, hoặc hẹn giờ đã tới). */
function liveTruth(): Row[] {
	return rows(
		W().sqlite,
		`select id, slug, section, title from post where deleted_at is null and (status = 'published' or (status = 'scheduled' and publish_at <= ?)) order by id`,
		nowIso(),
	);
}

test("dữ liệu thử đủ phong phú: có bài hiện, bài không hiện, đủ mọi tình huống", { skip: SKIP }, () => {
	const intent = Object.values(W().intent);
	assert.ok(intent.filter((s) => s.live).length >= 10, "đủ bài đang hiện");
	assert.ok(intent.filter((s) => !s.live).length >= 4, "đủ bài không hiện (nháp, tạm ẩn, hẹn giờ chưa tới, thùng rác)");
	const states = new Set(rows<{ s: string }>(W().sqlite, "select status || (case when deleted_at is null then '' else '+trash' end) s from post").map((r) => r.s));
	for (const wanted of ["published", "draft", "hidden", "scheduled", "published+trash"]) assert.ok(states.has(wanted), `bảng post có bài ở trạng thái ${wanted}`);
});

test("V3 liệt kê đúng những bài admin để hiển thị, cùng slug, chuyên trang và tiêu đề", { skip: SKIP }, async () => {
	const truth = liveTruth();
	assert.ok(truth.length >= 10);
	const listed = await listedByV3();
	assert.deepEqual(
		listed.map((p) => p.id).sort(),
		truth.map((r) => r.id as string).sort(),
		"tập bài V3 liệt kê khác tập bài đang hiển thị trong D1",
	);
	const byId = new Map(listed.map((p) => [p.id, p]));
	for (const r of truth) {
		const p = byId.get(r.id as string);
		assert.equal(p?.slug, r.slug, `slug của ${r.id}`);
		assert.equal(p?.mainCategory, r.section, `chuyên trang của ${r.id}`);
		assert.equal(p?.title, r.title, `tiêu đề của ${r.id}`);
	}
});

test("V3 đối chiếu với ý định của admin: mỗi bài admin muốn hiện thì hiện, mỗi bài admin muốn ẩn thì vắng mặt", { skip: SKIP }, async () => {
	const listed = new Set((await listedByV3()).map((p) => p.id));
	for (const [name, s] of Object.entries(W().intent)) assert.equal(listed.has(s.id), s.live, `${name} (${s.id}): admin muốn ${s.live ? "hiện" : "ẩn"}`);
});

test("bài nháp, tạm ẩn, hẹn giờ chưa tới và trong thùng rác: không có trong danh sách và trang chi tiết của chúng không tìm thấy", { skip: SKIP }, async () => {
	for (const name of ["draft", "hidden", "scheduled-future", "trashed"]) {
		const s = named(name);
		assert.equal(await livePost(s.slug, s.section, repo()), null, `${name}: livePost theo slug`);
		assert.equal(await livePost(s.id, s.section, repo()), null, `${name}: livePost theo id`);
		assert.equal(await repo().getPostBySlug(s.slug), null, `${name}: getPostBySlug`);
	}
});

test("bài hẹn giờ đã tới giờ, bài khôi phục từ thùng rác và bài ẩn rồi đăng lại: đều hiện", { skip: SKIP }, async () => {
	for (const name of ["scheduled-due", "restored", "republished"]) {
		const s = named(name);
		const post = await livePost(s.slug, s.section, repo());
		assert.equal(post?.id, s.id, `${name}: mở được theo slug`);
		assert.equal(post?.title, s.title, `${name}: tiêu đề`);
	}
});

test("bài admin đã sửa sau khi xuất bản: V3 hiện bản mới nhất, đủ chữ, ảnh, từ khóa và thân bài đã được admin làm sạch", { skip: SKIP }, async () => {
	const s = named("published-edited");
	const post = await livePost(s.slug, s.section, repo());
	assert.ok(post, "bài mở được");
	const [stored] = rows<Row>(W().sqlite, "select * from post where id = ?", s.id);
	assert.equal(stored.version, 3, "tạo, xuất bản, sửa = phiên bản 3");
	assert.equal(post.title, "Lễ Vu Lan báo hiếu 2026 (đã sửa)");
	assert.equal(post.title, stored.title);
	assert.equal(post.subtitle, stored.subtitle);
	assert.equal(post.author, stored.author);
	assert.equal(post.summary, stored.summary);
	assert.equal(post.publishedDate, stored.published_date);
	assert.equal(post.contentHtml, stored.content_html, "thân bài V3 hiện đúng từng byte cái admin đã lưu");
	assert.ok(post.contentHtml.includes("<strong>mới</strong>") && !post.contentHtml.includes("<script") && !post.contentHtml.includes("onclick"), "bản đã sửa và đã làm sạch");
	assert.deepEqual(post.keywords, [{ keyword: "Vu Lan", title: "Vu Lan", description: "Lễ báo hiếu cha mẹ" }]);
	assert.equal(post.mainCategory, "dong-chay-hoang-phap");
	assert.equal(post.subCategory, "cong-tu");
	assert.equal(post.categoryName, "Cộng Tu");
	const key = (id: string) => rows<{ r2_key: string }>(W().sqlite, "select r2_key from media where id = ?", id)[0].r2_key;
	assert.ok(post.thumbnailUrl.endsWith(`/${key("media-a")}`), `ảnh đại diện ${post.thumbnailUrl}`);
	assert.ok(post.bannerUrl.endsWith(`/${key("media-b")}`), `ảnh bìa ${post.bannerUrl}`);
});

test("bài admin ghim đứng đầu danh sách dù ngày đăng cũ hơn mọi bài khác", { skip: SKIP }, async () => {
	const s = named("pinned");
	const first = (await livePosts(DONG_CHAY_SECTION, repo()))[0];
	assert.equal(first.id, s.id);
	assert.equal(first.publishedDate, "2020-01-01");
});

test("bài admin đổi slug: mở được bằng slug mới, slug cũ không mở nhưng bảng redirect (do admin ghi) đưa về địa chỉ mới", { skip: SKIP }, async () => {
	const s = named("renamed");
	assert.ok(s.oldSlug && s.oldSlug !== s.slug);
	assert.equal((await livePost(s.slug, s.section, repo()))?.id, s.id, "slug mới mở được");
	assert.equal(await livePost(s.oldSlug as string, s.section, repo()), null, "slug cũ không còn mở bài");
	const found = await resolveRedirect(W().d1, `/${s.section}/${s.oldSlug}`);
	assert.deepEqual(found && { to: found.to, code: found.code }, { to: `/${s.section}/${s.slug}`, code: 301 }, "địa chỉ cũ chuyển vĩnh viễn về địa chỉ mới");
});

test("bài admin chuyển sang chuyên trang khác: hiện ở chuyên trang mới, vắng ở chuyên trang cũ, địa chỉ cũ chuyển về địa chỉ mới", { skip: SKIP }, async () => {
	const s = named("moved-section");
	assert.equal(s.section, TRI_TUE_SECTION);
	assert.equal(s.oldSection, DONG_CHAY_SECTION);
	const now = await livePost(s.slug, TRI_TUE_SECTION, repo());
	assert.equal(now?.id, s.id);
	assert.equal(now?.mainCategory, TRI_TUE_SECTION);
	assert.equal(now?.subCategory, "bai-viet");
	assert.equal(await livePost(s.slug, DONG_CHAY_SECTION, repo()), null, "chuyên trang cũ không còn bài");
	const found = await resolveRedirect(W().d1, `/${DONG_CHAY_SECTION}/${s.slug}`);
	assert.deepEqual(found && { to: found.to, code: found.code }, { to: `/${TRI_TUE_SECTION}/${s.slug}`, code: 301 });
});

test("âm thanh của bài Pháp Âm, video YouTube của bài Video và sách của bài Ấn phẩm & Sách tới được bản ghi V3", { skip: SKIP }, async () => {
	const am = named("phap-am");
	const audio = (await livePost(am.slug, am.section, repo()))?.audio;
	assert.ok(audio?.src.endsWith(`/${am.expect?.audioKey}`), `âm thanh ${audio?.src}`);
	assert.equal(audio?.duration, am.expect?.duration);

	const video = named("video");
	const record = await livePost(video.slug, video.section, repo());
	assert.equal(record?.videoBlock?.videoUrl, `https://www.youtube.com/watch?v=${video.expect?.youtubeId}`);

	const sach = named("an-pham-sach");
	const book = (await livePost(sach.slug, sach.section, repo()))?.sourceBook;
	assert.equal(book?.bookTitle, sach.expect?.title);
	assert.equal(book?.author, sach.expect?.author);
	assert.equal(book?.linkUrl, sach.expect?.link);
	assert.ok(book?.coverImage.endsWith(`/${sach.expect?.coverKey}`), `bìa sách ${book?.coverImage}`);
});

test("bài thường không có âm thanh, sách hay video của V3 (trường riêng không rò sang chuyên mục khác)", { skip: SKIP }, async () => {
	const s = named("published-edited");
	const record = await livePost(s.slug, s.section, repo());
	assert.equal(record?.audio, undefined);
	assert.equal(record?.sourceBook, undefined);
	assert.equal(record?.videoBlock, undefined);
});

test("bài nhập từ web cũ (do admin chưa sửa) vẫn hiện cùng bài mới", { skip: SKIP }, async () => {
	const s = named("imported");
	const post = await livePost(s.slug, s.section, repo());
	assert.equal(post?.id, "post-1060");
	assert.equal(post?.contentHtml, "<p>Nội dung cũ</p>");
});
