// Bản chép của lớp đọc ảnh và bộ lọc HTML của www phải có cùng hành vi mới: ảnh chỉ nằm trên Cloudflare (R2, /anh-goc/).
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSafe, safePictureSrc, sanitizeHtml, serialize } from "@/lib/tlhp-admin/content/html";
import { legacyPicturePath, mediaUrl, storedMediaAddress } from "@/lib/tlhp-content/media";
import { serveMedia } from "@/lib/tlhp-content/mediaRoute";

test("safePictureSrc: chỉ nhận /anh-goc/, /brand/ và địa chỉ WordPress/B2 cũ ánh xạ chắc chắn", () => {
	assert.equal(safePictureSrc("/anh-goc/s2-cnv03/a.jpg"), "/anh-goc/s2-cnv03/a.jpg");
	assert.equal(safePictureSrc("https://www.tunglamhoaphuc.com/anh-goc/s2-cnv03/a.jpg"), "/anh-goc/s2-cnv03/a.jpg");
	assert.equal(safePictureSrc("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/08/a.jpg"), "/anh-goc/wordpress/2026/08/a.jpg");
	assert.equal(safePictureSrc("https://example.com/a.jpg"), null);
	assert.equal(safePictureSrc("//evil.example/anh-goc/a.jpg"), null);
});

test("thân bài: đọc vẫn giữ ảnh https cũ, lưu mới (strictMedia) bỏ ảnh host ngoài", () => {
	const html = '<figure><img src="https://example.com/x.jpg" alt="x"></figure><p>chữ</p>';
	assert.match(sanitizeHtml(html), /example\.com/);
	const changes: string[] = [];
	const out = serialize(parseSafe(html, { strictMedia: true, changes }));
	assert.doesNotMatch(out, /example\.com/);
	assert.ok(changes.includes("img"));
});

test("mediaUrl đổi địa chỉ cũ chắc chắn sang /anh-goc/ và storedMediaAddress giữ nguyên id", () => {
	assert.equal(mediaUrl("https://old.tunglamhoaphuc.com/wp-content/uploads/2018/07/a.jpg"), "/anh-goc/wordpress/2018/07/a.jpg");
	assert.equal(mediaUrl("https://f005.backblazeb2.com/file/media-tunglamhoaphuc/x/a.webp"), "/anh-goc/media-tunglamhoaphuc/x/a.webp");
	assert.equal(mediaUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
	assert.equal(legacyPicturePath("https://f005.backblazeb2.com/file/khac/a.jpg"), null);
	const address = "https://old.tunglamhoaphuc.com/wp-content/uploads/2018/07/a.jpg";
	assert.equal(storedMediaAddress(address), address);
});

test("serveMedia ghi một dòng media-fallback khi phải lấy ảnh từ B2", async () => {
	const original = console.warn;
	const lines: string[] = [];
	console.warn = (line: unknown) => void lines.push(String(line));
	try {
		const bucket = { get: async () => null };
		const png = async () => new Response("png", { headers: { "Content-Type": "image/png" } });
		await serveMedia("s2-cnv03", ["a", "b.png"], bucket, png);
		assert.deepEqual(lines.map((line) => JSON.parse(line)), [{ event: "media-fallback", reason: "r2-miss", key: "s2-cnv03/a/b.png", host: "s2-cnv03.s3.us-east-005.backblazeb2.com" }]);
	} finally {
		console.warn = original;
	}
});
