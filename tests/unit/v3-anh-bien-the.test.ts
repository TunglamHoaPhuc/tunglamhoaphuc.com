// Biến thể ảnh dựng sẵn trong R2 (23/11/2026): công tắc IMAGE_DELIVERY, fitImage theo công tắc, và route /anh-goc/<bucket>/<khóa>@<rộng>.
// (Bản chép của lớp đọc ảnh www; phần logic dày hơn nằm ở tests/unit/content/mediaVariants.test.ts của www.)
import assert from "node:assert/strict";
import { test } from "node:test";
import { IMAGE_DELIVERY, IMAGE_WIDTH, imageSrcSet, parseVariantRequest, variantStep } from "@/lib/tlhp-content/media";
import { serveMedia, type MediaBucket } from "@/lib/tlhp-content/mediaRoute";
import { fitImage, getImageUrl, getOptimizedNextImageUrl } from "@/utils/image";

const KEY = "tunglamhoaphuc2/03-dong-chay-hoang-phap/dai-le-su-kien/2-2-scaled.jpg";
const B2 = `https://s2-cnv03.s3.us-east-005.backblazeb2.com/${KEY}`;
const PICTURE = `/anh-goc/s2-cnv03/${KEY}`;
const CGI = (width: number) => `/cdn-cgi/image/width=${width},quality=75,format=auto,onerror=redirect${PICTURE}`;

test("công tắc giao ảnh mặc định là 'variants', chỉ cho khóa R2 đã có biến thể; ảnh còn lại (WordPress cũ, nhỏ) đi nguyên bản", () => {
	assert.equal(IMAGE_DELIVERY, "variants");
	assert.equal(fitImage(B2, 640), `${PICTURE}@640`);
	assert.equal(getOptimizedNextImageUrl(B2, 640), `${PICTURE}@640`);
	// an old WordPress upload (668 px, small) goes as it is: no transformation quota is spent
	const old = "/anh-goc/s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2018/07/a-668x445.jpg";
	assert.equal(fitImage(old, 640), old);
});

test("fitImage: chế độ 'cgi' giữ địa chỉ /cdn-cgi/image/, chế độ 'variants' dựng /anh-goc/<bucket>/<khóa>@<bậc>", () => {
	assert.equal(fitImage(B2, 640, "cgi"), CGI(640));
	assert.equal(fitImage(B2, 640, "variants"), `${PICTURE}@640`);
	assert.equal(fitImage(B2, 500, "variants"), `${PICTURE}@640`);
	assert.equal(fitImage(PICTURE, IMAGE_WIDTH.icon, "variants"), `${PICTURE}@160`);
	assert.equal(fitImage(PICTURE, IMAGE_WIDTH.mid, "variants"), `${PICTURE}@960`);
	assert.equal(fitImage(PICTURE, 3000, "variants"), `${PICTURE}@max`);
	assert.equal(fitImage(`https://www.tunglamhoaphuc.com${PICTURE}`, 360, "variants"), `${PICTURE}@360`);
	assert.equal(fitImage("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/45-1.jpg", 360, "variants"), "/anh-goc/wordpress/2026/09/45-1.jpg@360");
	assert.equal(fitImage("khong-co-duong-dan", 360, "variants"), "khong-co-duong-dan");
});

test("fitImage 'variants' không chồng hậu tố, để nguyên ảnh không có biến thể, ảnh tĩnh của site và host lạ", () => {
	assert.equal(fitImage(`${PICTURE}@640`, 360, "variants"), `${PICTURE}@360`);
	assert.equal(fitImage("/anh-goc/s2-cnv03/tunglamhoaphuc2/a.gif", 640, "variants"), "/anh-goc/s2-cnv03/tunglamhoaphuc2/a.gif");
	assert.equal(fitImage("/images/hero/toan-canh-chua-1920.webp", 640, "variants"), "/images/hero/toan-canh-chua-1920.webp");
	assert.equal(fitImage("https://example.org/a.jpg", 640, "variants"), "https://example.org/a.jpg");
	assert.equal(fitImage("", 640, "variants"), "");
	assert.equal(fitImage(null, 640, "variants"), "");
});

test("getImageUrl cho địa chỉ biến thể đi qua nguyên vẹn", () => {
	assert.equal(getImageUrl(`${PICTURE}@640`), `${PICTURE}@640`);
	assert.equal(getImageUrl(`${PICTURE}@max.webp`), `${PICTURE}@max.webp`);
});

test("imageSrcSet 'variants': srcset thật theo bậc chuẩn, dừng ở chiều rộng gốc nếu biết", () => {
	assert.equal(imageSrcSet(PICTURE, [360, 640], undefined, "variants"), `${PICTURE}@360 360w, ${PICTURE}@640 640w`);
	assert.equal(imageSrcSet(PICTURE, [], 668, "variants"), `${PICTURE}@160 160w, ${PICTURE}@360 360w, ${PICTURE}@640 640w, ${PICTURE}@max 668w`);
	assert.equal(imageSrcSet("/images/a.webp", [360, 640], 900, "variants"), undefined);
});

test("bậc chuẩn: làm tròn LÊN, quá 1920 là max; ba dạng khóa biến thể", () => {
	assert.equal(variantStep(161), 360);
	assert.equal(variantStep(1921), "max");
	assert.deepEqual(parseVariantRequest(["a", "b.jpg@640.webp"]), { base: ["a", "b.jpg"], step: 640, ext: "webp" });
	assert.deepEqual(parseVariantRequest(["b.jpg@max"]), { base: ["b.jpg"], step: "max", ext: null });
	assert.equal(parseVariantRequest(["logo@2x.png"]), null);
});

// ---- route -------------------------------------------------------------------------------------------------------------------------------

function bucketWith(objects: Record<string, { type: string; body: string }>) {
	const asked: string[] = [];
	const bucket: MediaBucket = {
		get: async (key) => {
			asked.push(key);
			const found = objects[key];
			return found ? { body: new Response(found.body).body!, httpMetadata: { contentType: found.type } } : null;
		},
	};
	return { bucket, asked };
}
const noOrigin = async () => new Response("no", { status: 404 });
const R2 = `s2-cnv03/${KEY}`;

test("route: chọn AVIF theo Accept, làm tròn bậc lên, immutable, Vary: Accept, X-Image-Variant", async () => {
	const { bucket, asked } = bucketWith({ [`${R2}@640.avif`]: { type: "image/avif", body: "avif" }, [`${R2}@640.webp`]: { type: "image/webp", body: "webp" } });
	const parts = [...KEY.split("/").slice(0, -1), "2-2-scaled.jpg@500"];
	const avif = await serveMedia("s2-cnv03", parts, bucket, noOrigin, { accept: "image/avif,image/webp,*/*" });
	assert.equal(await avif.text(), "avif");
	assert.equal(avif.headers.get("Content-Type"), "image/avif");
	assert.equal(avif.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
	assert.equal(avif.headers.get("Vary"), "Accept");
	assert.equal(avif.headers.get("X-Image-Variant"), "hit");
	assert.deepEqual(asked, [`${R2}@640.avif`]);
	const webp = await serveMedia("s2-cnv03", parts, bucket, noOrigin, { accept: "image/webp,*/*" });
	assert.equal(await webp.text(), "webp");
});

test("route: dự phòng định dạng kia, rồi bậc lớn hơn, rồi bản gốc; khóa thường không đổi", async () => {
	const { bucket } = bucketWith({ [`${R2}@960.webp`]: { type: "image/webp", body: "webp-960" }, [R2]: { type: "image/jpeg", body: "original" } });
	const dir = KEY.split("/").slice(0, -1);
	const fallback = await serveMedia("s2-cnv03", [...dir, "2-2-scaled.jpg@640"], bucket, noOrigin, { accept: "image/avif,image/webp" });
	assert.equal(await fallback.text(), "webp-960");
	assert.equal(fallback.headers.get("X-Image-Variant"), "fallback");
	const miss = await serveMedia("s2-cnv03", [...dir, "2-2-scaled.jpg@max.avif"], bucket, noOrigin, { accept: null });
	assert.equal(await miss.text(), "original");
	assert.equal(miss.headers.get("X-Image-Variant"), "miss");
	const plain = await serveMedia("s2-cnv03", [...dir, "2-2-scaled.jpg"], bucket, noOrigin, { accept: "image/avif" });
	assert.equal(await plain.text(), "original");
	assert.equal(plain.headers.get("Cache-Control"), "public, max-age=2592000, stale-while-revalidate=604800");
	assert.equal(plain.headers.get("X-Image-Variant"), null);
});

test("route: Cache API bọc kết quả, ghi qua waitUntil, lần sau trả từ bộ đệm", async () => {
	const { bucket, asked } = bucketWith({ [`${R2}@360.webp`]: { type: "image/webp", body: "webp-360" } });
	const store = new Map<string, Response>();
	const cache = { match: async (r: Request) => store.get(r.url)?.clone(), put: async (r: Request, res: Response) => void store.set(r.url, res) };
	const pending: Promise<unknown>[] = [];
	const options = { accept: "image/webp", cache, waitUntil: (work: Promise<unknown>) => void pending.push(work), siteOrigin: "https://v3.example.test" };
	const dir = KEY.split("/").slice(0, -1);
	const first = await serveMedia("s2-cnv03", [...dir, "2-2-scaled.jpg@360"], bucket, noOrigin, options);
	assert.equal(await first.text(), "webp-360");
	await Promise.all(pending);
	assert.equal(store.size, 1);
	asked.length = 0;
	const second = await serveMedia("s2-cnv03", [...dir, "2-2-scaled.jpg@300"], bucket, noOrigin, options); // 300 làm tròn lên 360: cùng khóa bộ đệm
	assert.equal(await second.text(), "webp-360");
	assert.deepEqual(asked, []);
});
