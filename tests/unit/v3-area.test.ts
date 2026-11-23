// V5 (Vũ Trụ Phật Giáo): the area page shows the body the admin saved, keeps the cover position, takes the temple's
// name from D1's slug, and never puts raw intro or body HTML on the page.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { areaBodyHtml } from "@/lib/area-body";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { liveArea } from "@/lib/v3-live";
import { templeName } from "@/lib/v3-data";
import { createFakeD1 } from "../helpers/d1";

function repoWith(row: Record<string, unknown>) {
	const db = createFakeD1();
	db.insert("media", { id: "m1", r2_key: "areas/cover.webp", url: null });
	db.insert("area", { id: "ar1", slug: "tam-bao", name: "TAM BẢO", subtitle: "Đại Hùng Bảo Điện", temple: "tung-lam-hoa-phuc", cover_media_id: "m1", cover_position: "center 35%", map_x: 12.5, map_y: 40, position: 1, ...row });
	return createD1Repository(db);
}

test("khu vực: thân bài, vị trí ảnh bìa, tên chùa lấy từ D1", async () => {
	const area = await liveArea("tam-bao", repoWith({ intro: "Một hai câu.", content_html: "<p>Thân bài đầy đủ.</p><h2>Mục</h2>" }));
	assert.ok(area);
	assert.equal(area.contentHtml, "<p>Thân bài đầy đủ.</p><h2>Mục</h2>");
	assert.equal(area.description, "Một hai câu.");
	assert.equal(area.imgPosition, "center 35%");
	assert.match(area.imgUrl, /areas\/cover\.webp$/);
	assert.equal(area.templeName, "Tùng Lâm Hòa Phúc");
	assert.deepEqual(area.mapPos, { x: 12.5, y: 40 });
	assert.equal(area.fullContent, "");
});

test("tên chùa theo slug của D1, không gắn cứng", async () => {
	assert.equal(templeName("quynh-nhai-cam-lo-tu"), "Quỳnh Nhai Cam Lộ Tự");
	assert.equal(templeName("chua-moi-them"), "Chua Moi Them");
	const area = await liveArea("tam-bao", repoWith({ temple: "quynh-nhai-cam-lo-tu" }));
	assert.equal(area?.templeName, "Quỳnh Nhai Cam Lộ Tự");
});

test("thân bài: HTML của admin được lọc lại, có thân bài thì không in lại phần giới thiệu", () => {
	const html = areaBodyHtml({ intro: "Giới thiệu.", contentHtml: '<p onclick="x()">Thân <strong>bài</strong></p><script>alert(1)</script><iframe src="https://evil"></iframe><a href="javascript:alert(1)">bấm</a>' });
	assert.match(html, /<p>Thân <strong>bài<\/strong><\/p>/);
	assert.doesNotMatch(html, /script|alert|onclick|iframe|javascript:/);
	assert.doesNotMatch(html, /Giới thiệu\./);
});

test("không có thân bài: phần giới thiệu hiện như chữ thường, không phải HTML", () => {
	assert.equal(areaBodyHtml({ intro: "Câu một.\n\nCâu hai.", contentHtml: "" }), "<p>Câu một.</p><p>Câu hai.</p>");
	const hostile = areaBodyHtml({ intro: '<img src=x onerror="alert(1)"> & "dấu"', contentHtml: "" });
	assert.equal(hostile, "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;dấu&quot;</p>");
	assert.equal(areaBodyHtml({ intro: "", contentHtml: "" }), "");
});

test("trang khu vực dùng areaBodyHtml, không còn chèn thẳng phần giới thiệu", () => {
	const code = readFileSync("src/app/(public)/vu-tru-phat-giao/[slug]/AreaDetailClient.tsx", "utf8");
	assert.match(code, /areaBodyHtml\(/);
	assert.doesNotMatch(code, /formatParagraphsHtml/);
	assert.match(code, /bannerPosition=\{area\.imgPosition\}/);
});
