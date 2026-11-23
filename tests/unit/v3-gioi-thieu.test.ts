// V3 (Giới thiệu): each of the six topics resolves to its own record by slug alone, from D1, and the bundled copy
// no longer takes part. The fixture (tests/fixtures/gioi-thieu.json) has the ids, slugs and order of the www
// snapshot's gioi-thieu.json (gt-01 … gt-06), with short texts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseAbout } from "@/lib/tlhp-content/about";
import { createMemoryRepository } from "@/lib/tlhp-content/repository";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { liveAbout, liveAboutTopic } from "@/lib/v3-live";
import { createFakeD1, isoIn } from "../helpers/d1";

type Raw = { id: string; slug: string; title: string; groupCategory: string; groupCategoryName: string; subtitle: string; tag: string; content: string; overviewSummary: string };
const fixture = JSON.parse(readFileSync("tests/fixtures/gioi-thieu.json", "utf8")) as Raw[];
const SLUGS = ["lich-su-tung-lam-hoa-phuc", "dai-su-lien-dang", "su-ong-hoang-phap", "su-phu-tru-tri", "tieu-su-su-to", "van-hoa-ung-xu"];

const memoryRepo = () => createMemoryRepository([], { loadAbout: async () => parseAbout(fixture).topics });

function d1Repo(extra?: (db: ReturnType<typeof createFakeD1>) => void) {
	const db = createFakeD1();
	for (const group of new Map(fixture.map((t) => [t.groupCategory, t.groupCategoryName]))) db.insert("category", { id: group[0], slug: group[0], name: group[1], kind: "page-group" });
	fixture.forEach((t, i) => db.insert("page", { id: t.id, slug: t.slug, title: t.title, subtitle: t.subtitle, kicker: t.tag, group_id: t.groupCategory, overview: t.overviewSummary, content_html: `<p>${t.content}</p>`, position: i }));
	extra?.(db);
	return createD1Repository(db);
}

test("fixture giống snapshot: đủ sáu chủ đề, đúng thứ tự", () => {
	assert.deepEqual(fixture.map((t) => t.slug), SLUGS);
	assert.deepEqual(fixture.map((t) => t.id), ["gt-01", "gt-02", "gt-03", "gt-04", "gt-05", "gt-06"]);
});

test("mỗi trong sáu slug ra đúng bản ghi của nó (nguồn tệp và nguồn D1)", async () => {
	for (const repo of [memoryRepo(), d1Repo()]) {
		for (const slug of SLUGS) {
			const topic = await liveAboutTopic(slug, repo);
			const expected = fixture.find((t) => t.slug === slug)!;
			assert.ok(topic, slug);
			assert.equal(topic.slug, slug);
			assert.equal(topic.title, expected.title, `${slug}: tiêu đề`);
			assert.match(topic.mainContentHtml, new RegExp(`Nội dung của ${slug}`), `${slug}: thân bài là của chính nó`);
		}
	}
});

test("điều kiện cũ (slug HOẶC id) dựng nhầm chủ đề: đây là lỗi mà việc tra theo slug sửa", async () => {
	const topics = await liveAbout(memoryRepo());
	// Trang su-phu-tru-tri tìm `slug === 'su-phu-tru-tri' || id === 'gt-02'`, trang van-hoa-ung-xu tìm `… || id === 'gt-05'`.
	assert.equal(topics.find((t) => t.slug === "su-phu-tru-tri" || t.id === "gt-02")?.slug, "dai-su-lien-dang");
	assert.equal(topics.find((t) => t.slug === "van-hoa-ung-xu" || t.id === "gt-05")?.slug, "tieu-su-su-to");
	// Tra theo slug thì không nhầm.
	assert.equal((await liveAboutTopic("su-phu-tru-tri", memoryRepo()))?.title, "SƯ PHỤ TRỤ TRÌ");
	assert.equal((await liveAboutTopic("van-hoa-ung-xu", memoryRepo()))?.title, "VĂN HÓA ỨNG XỬ THIỀN MÔN");
	// Một id không phải là địa chỉ.
	assert.equal(await liveAboutTopic("gt-02", memoryRepo()), null);
	assert.equal(await liveAboutTopic("gt-05", memoryRepo()), null);
});

test("Tiểu sử Sư Tổ lấy đúng bản của D1, không trộn bản đóng gói", async () => {
	const repo = d1Repo((db) => db.exec("update page set content_html = '<p>Bản D1 mới sửa, không có Trần Quán.</p>' where slug = 'tieu-su-su-to'"));
	const topic = await liveAboutTopic("tieu-su-su-to", repo);
	assert.equal(topic?.mainContentHtml, "<p>Bản D1 mới sửa, không có Trần Quán.</p>");
	assert.equal(topic?.content, "");
});

test("chủ đề nháp, hẹn giờ chưa tới, trong thùng rác thì không có (404); chủ đề mới có địa chỉ", async () => {
	const repo = d1Repo((db) => {
		db.exec("update page set status = 'draft' where slug = 'su-ong-hoang-phap'");
		db.exec(`update page set status = 'scheduled', publish_at = '${isoIn(2)}' where slug = 'dai-su-lien-dang'`);
		db.exec(`update page set deleted_at = '${isoIn(-1)}' where slug = 'van-hoa-ung-xu'`);
		db.insert("page", { id: "moi-1", slug: "chu-de-moi-o-admin", title: "CHỦ ĐỀ MỚI", group_id: "nguoi-lien-quan", content_html: "<p>mới</p>", position: 99 });
	});
	for (const slug of ["su-ong-hoang-phap", "dai-su-lien-dang", "van-hoa-ung-xu", "khong-co"]) assert.equal(await liveAboutTopic(slug, repo), null, slug);
	assert.equal((await liveAboutTopic("chu-de-moi-o-admin", repo))?.title, "CHỦ ĐỀ MỚI");
	assert.deepEqual((await liveAbout(repo)).map((t) => t.slug), ["lich-su-tung-lam-hoa-phuc", "su-phu-tru-tri", "tieu-su-su-to", "chu-de-moi-o-admin"]);
});

test("không còn bản đóng gói hay phép trộn trong các trang Giới thiệu", () => {
	const files = [
		"src/app/(public)/gioi-thieu/AboutTopicPage.tsx",
		"src/app/(public)/gioi-thieu/[slug]/page.tsx",
		"src/app/(public)/gioi-thieu/page.tsx",
		...SLUGS.map((slug) => `src/app/(public)/gioi-thieu/${slug}/page.tsx`),
		"src/components/gioi-thieu/GioiThieuDetailLayout.tsx",
		"src/components/gioi-thieu/TieuSuSuToOdysseyView.tsx",
	];
	for (const file of files) {
		const code = readFileSync(file, "utf8");
		assert.doesNotMatch(code, /GIOI_THIEU_DETAILS|id === 'gt-|\.\.\.fallback|isLiveUpToDate|api\/admin\/gioi-thieu/, file);
	}
});
