// Slug là duy nhất theo chuyên mục (chỉ mục của admin), không duy nhất toàn trang: hai bài cùng slug ở hai chuyên mục là hai bài,
// mỗi bài mở ở địa chỉ chuyên mục của mình. Lỗi cũ: livePost hỏi kho "bài có slug này" không kèm chuyên mục, nhận bài đứng trước
// trong bảng, thấy khác chuyên mục thì trả 404 cho bài thứ hai. (Bản chạy trên dữ liệu thật: v3-real-visibility.test.ts.)
import assert from "node:assert/strict";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { livePost, livePosts } from "@/lib/v3-live";
import { createFakeD1 } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	db.insert("category", { id: "c1", slug: "cong-tu", name: "Cộng tu", kind: "post" });
	db.insert("category", { id: "c2", slug: "phap-am", name: "Pháp âm", kind: "post" });
	const post = (id: string, slug: string, section: string, category: string, extra: Record<string, unknown> = {}) =>
		db.insert("post", { id, slug, title: `Bài ${id}`, section, category_id: category, published_date: "2026-08-23", content_html: `<p>thân ${id}</p>`, ...extra });
	post("dc-1", "vu-lan", "dong-chay-hoang-phap", "c1");
	post("tt-1", "vu-lan", "tri-tue-phat-phap", "c2");
	post("tt-2", "chi-o-tri-tue", "tri-tue-phat-phap", "c2");
	post("dc-nhap", "nhap", "dong-chay-hoang-phap", "c1", { status: "draft" });
	post("tt-nhap", "nhap", "tri-tue-phat-phap", "c2");
	return createD1Repository(db);
}

test("hai bài cùng slug ở hai chuyên mục: mỗi bài mở đúng ở chuyên mục của mình", async () => {
	const repo = seed();
	assert.equal((await livePost("vu-lan", "dong-chay-hoang-phap", repo))?.id, "dc-1");
	const second = await livePost("vu-lan", "tri-tue-phat-phap", repo);
	assert.equal(second?.id, "tt-1", "bài của Trí tuệ không bị bài Dòng chảy cùng slug che mất");
	assert.equal(second?.contentHtml, "<p>thân tt-1</p>");
	assert.equal((await livePosts("tri-tue-phat-phap", repo)).length, 3);
	assert.equal((await livePosts("dong-chay-hoang-phap", repo)).length, 1);
});

test("slug chỉ có ở chuyên mục kia hoặc bài ẩn ở chuyên mục này thì vẫn 404, không mượn bài của chuyên mục khác", async () => {
	const repo = seed();
	assert.equal(await livePost("chi-o-tri-tue", "dong-chay-hoang-phap", repo), null);
	// 'nhap' là bản nháp ở Dòng chảy và đang hiện ở Trí tuệ: Dòng chảy 404, Trí tuệ mở.
	assert.equal(await livePost("nhap", "dong-chay-hoang-phap", repo), null);
	assert.equal((await livePost("nhap", "tri-tue-phat-phap", repo))?.id, "tt-nhap");
	assert.equal(await livePost("dc-nhap", "dong-chay-hoang-phap", repo), null, "id của bài nháp cũng không mở được");
});
