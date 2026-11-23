// Ảnh trong thân bài (23/11/2026, src/lib/body-images.ts): HTML từ D1 có <img src="/anh-goc/…"> trỏ bản gốc; sau bộ lọc của admin, V3 viết lại
// thành biến thể 960 px + srcset 360/640/960/1280/1920 + sizes + lazy. Những gì không phải ảnh /anh-goc/ và thân bài không có ảnh phải giữ nguyên.
import assert from "node:assert/strict";
import { test } from "node:test";
import { richHtml } from "@/lib/article-html";
import { BODY_IMAGE_SIZES, bodyImageSources, bodyZoomSrc, optimizeBodyImages } from "@/lib/body-images";

const KEY = "tunglamhoaphuc2/03-dong-chay-hoang-phap/dai-le-su-kien/2-2-scaled.jpg";
const PICTURE = `/anh-goc/media-tunglamhoaphuc/${KEY}`;
const SET = [360, 640, 960, 1280, 1920].map((width) => `${PICTURE}@${width} ${width}w`).join(", ");

test("ảnh /anh-goc/ của khóa có biến thể: src 960, srcset 5 bậc, sizes, lazy + async, giữ alt và thuộc tính khác theo thứ tự", () => {
	const html = `<p>Mở đầu.</p><img src="${PICTURE}" alt="Lễ cầu an &amp; hồi hướng" width="1400" height="933" data-media-id="med_abc"><p>Kết.</p>`;
	assert.equal(
		optimizeBodyImages(html),
		`<p>Mở đầu.</p><img src="${PICTURE}@960" alt="Lễ cầu an &amp; hồi hướng" width="1400" height="933" data-media-id="med_abc" srcset="${SET}" sizes="${BODY_IMAGE_SIZES}" loading="lazy" decoding="async"><p>Kết.</p>`,
	);
});

test("loading có sẵn được giữ nguyên (eager không bị đổi sang lazy), decoding chỉ thêm khi thiếu", () => {
	const out = optimizeBodyImages(`<img src="${PICTURE}" alt="" loading="eager" decoding="sync">`);
	assert.match(out, /loading="eager"/);
	assert.match(out, /decoding="sync"/);
	assert.doesNotMatch(out, /lazy|async/);
	assert.match(out, /srcset="/);
});

test("thân bài không có <img> trả đúng chuỗi cũ (cùng nội dung từng byte), kể cả rỗng và văn bản thuần", () => {
	for (const body of ["", "Chỉ là chữ.", "<p>Một <b>đoạn</b> có <a href=\"/x\">liên kết</a>.</p>", "<picture><source srcset=\"a.avif\"></picture>", "a < b > c", "<imgx src=\"/anh-goc/a.jpg\">"]) {
		assert.equal(optimizeBodyImages(body), body);
	}
});

test("ảnh không phải /anh-goc/ giữ nguyên từng byte: /brand, /images, host ngoài, data:, thiếu src, src rỗng", () => {
	for (const tag of [
		`<img src="/brand/logo-moc-an.webp" alt="Logo">`,
		`<img src="/images/hero/toan-canh-chua-1280.webp" alt="">`,
		`<img src="https://example.com/anh-goc/a.jpg" alt="x">`,
		`<img src="https://www.tunglamhoaphuc.com${PICTURE}" alt="x">`,
		`<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">`,
		`<img alt="không có src">`,
		`<img src="" alt="rỗng">`,
		`<img src>`,
		`<IMG SRC='/images/a.webp' ALT='x'>`,
	]) {
		const html = `<p>x</p>${tag}<p>y</p>`;
		assert.equal(optimizeBodyImages(html), html, tag);
	}
});

test("ảnh /anh-goc/ chưa có biến thể (WordPress cũ), GIF, SVG, có query: không srcset, chỉ thêm lazy/async nếu thiếu; không đổi gì nếu đã đủ", () => {
	const old = "/anh-goc/s2-cnv03/ngoai/2018/07/a-668x445.jpg";
	assert.equal(optimizeBodyImages(`<img src="${old}" alt="cũ">`), `<img src="${old}" alt="cũ" loading="lazy" decoding="async">`);
	for (const src of [old, `/anh-goc/media-tunglamhoaphuc/${KEY.replace(".jpg", ".gif")}`, "/anh-goc/media-tunglamhoaphuc/x.svg", `${PICTURE}?v=2`]) {
		const full = `<img src="${src}" alt="a" loading="lazy" decoding="async">`;
		assert.equal(optimizeBodyImages(full), full, src);
		assert.doesNotMatch(optimizeBodyImages(`<img src="${src}">`), /srcset/);
	}
});

test("thẻ đã có srcset hoặc sizes là của tác giả: giữ nguyên; chạy hai lần cho cùng kết quả", () => {
	const own = `<img src="${PICTURE}" srcset="${PICTURE}@360 360w" alt="a">`;
	assert.equal(optimizeBodyImages(own), own);
	const own2 = `<img src="${PICTURE}" sizes="50vw" alt="a">`;
	assert.equal(optimizeBodyImages(own2), own2);
	const once = optimizeBodyImages(`<p><img src="${PICTURE}" alt="a"></p><p><img src="${PICTURE}@640.webp" alt="b"></p>`);
	assert.equal(optimizeBodyImages(once), once);
});

test("nháy đơn, không nháy, tự đóng />, tên thuộc tính hoa, nhiều ảnh: mỗi ảnh viết lại đúng, chữ giữa các ảnh nguyên vẹn", () => {
	const html = `A<img src='${PICTURE}' alt='Tôi "nói"'/>B<IMG SRC=${PICTURE} ALT=ngan>C<img class=x src="${PICTURE}" />D`;
	const out = optimizeBodyImages(html);
	assert.equal([...out.matchAll(/srcset="/g)].length, 3);
	assert.equal([...out.matchAll(/ sizes="/g)].length, 3);
	assert.match(out, /^A<img src="[^"]+@960" alt="Tôi &quot;nói&quot;" srcset="[^"]+" sizes="[^"]+" loading="lazy" decoding="async" \/>B</);
	assert.match(out, /B<IMG SRC="[^"]+@960" ALT="ngan" srcset=/);
	assert.match(out, /C<img class="x" src="[^"]+@960" srcset="[^"]+" sizes="[^"]+" loading="lazy" decoding="async" \/>D$/);
});

test("HTML hỏng: nháy không đóng, thiếu >, > trong giá trị có nháy, lồng thẻ: không ném lỗi, thẻ hỏng giữ nguyên, thẻ lành vẫn viết lại", () => {
	const broken = `<img src="${PICTURE}" alt="chưa đóng`;
	assert.equal(optimizeBodyImages(broken), broken);
	const noEnd = `<p>x</p><img src="${PICTURE}"`;
	assert.equal(optimizeBodyImages(noEnd), noEnd);
	// ">" nằm trong giá trị có nháy không kết thúc thẻ; alt giữ nguyên chữ, "<" ">" trong alt thành thực thể an toàn
	const gt = optimizeBodyImages(`<img alt="a > b" src="${PICTURE}">`);
	assert.match(gt, /^<img alt="a &gt; b" src="[^"]+@960" srcset=/);
	// lồng: <img <img src=…> chỉ thẻ trong cùng cặp <> được xử lý
	const nested = optimizeBodyImages(`<img <img src="${PICTURE}" alt="x">`);
	assert.doesNotThrow(() => optimizeBodyImages(nested));
	// thẻ hỏng đứng trước không làm hỏng thẻ lành đứng sau
	const mixed = optimizeBodyImages(`<img src="${PICTURE}" alt="hỏng ><img src="${PICTURE}" alt="lành">`);
	assert.equal(typeof mixed, "string");
	assert.doesNotThrow(() => optimizeBodyImages("<img ".repeat(2000)));
});

test("thoát thuộc tính: địa chỉ có nháy, &, < không thoát ra khỏi giá trị; không sinh thuộc tính on…", () => {
	const hostile = optimizeBodyImages(`<img src='/anh-goc/media-tunglamhoaphuc/a.jpg?x="onerror=alert(1) y=&lt;b&gt;' alt='"><script>alert(1)</script>'>`);
	assert.doesNotMatch(hostile, /<script/i);
	// không có nháy kép nào chưa thoát nằm trong src
	assert.match(hostile, /src="\/anh-goc\/media-tunglamhoaphuc\/a\.jpg\?x=&quot;onerror=alert\(1\) y=&lt;b&gt;"/);
	assert.doesNotMatch(hostile, /\sonerror=/i);
	const attrs = hostile.match(/<img([^>]*)>/)?.[1] ?? "";
	assert.equal(attrs.includes("<"), false);
});

test("đi sau bộ lọc của admin: bài có ảnh /anh-goc/ nhận srcset; ảnh host ngoài và phần khác của bài không đổi", () => {
	const raw = `<p>Lễ.</p><figure><img src="${PICTURE}" alt="Ảnh lễ" loading="lazy"><figcaption>Chú thích</figcaption></figure><p><img src="https://evil.example/x.jpg" alt="x"></p>`;
	const safe = richHtml(raw);
	assert.match(safe, new RegExp(`<img src="${PICTURE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
	const out = optimizeBodyImages(safe);
	assert.match(out, /<img src="[^"]+@960" alt="Ảnh lễ" loading="lazy" srcset="[^"]+@360 360w[^"]+@1920 1920w" sizes="\(max-width: 768px\) 100vw, 760px" decoding="async">/);
	// ảnh host ngoài (bộ lọc chế độ đọc vẫn cho qua https) không phải /anh-goc/: nguyên vẹn
	assert.match(out, /<p><img src="https:\/\/evil\.example\/x\.jpg" alt="x" loading="lazy"><\/p>/);
	assert.match(out, /<figcaption>Chú thích<\/figcaption>/);
	// bài không có ảnh: bộ lọc rồi bước này vẫn là chuỗi của bộ lọc
	const plain = richHtml("<p>Chỉ chữ <strong>đậm</strong>.</p>");
	assert.equal(optimizeBodyImages(plain), plain);
});

test("bodyImageSources và bodyZoomSrc: cùng quy tắc cho ảnh dựng bằng React (dòng ![chú thích](địa chỉ) của bộ dựng)", () => {
	const set = bodyImageSources(PICTURE);
	assert.equal(set.src, `${PICTURE}@960`);
	assert.equal(set.srcSet, SET);
	assert.equal(set.sizes, BODY_IMAGE_SIZES);
	// địa chỉ B2 cũ cũng chuẩn hóa về /anh-goc/
	assert.equal(bodyImageSources(`https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/${KEY}`).src, `${PICTURE}@960`);
	// khung hẹp hơn có sizes riêng, ảnh chưa có biến thể: một cỡ, không sizes
	assert.equal(bodyImageSources(PICTURE, "(max-width: 704px) 100vw, 672px").sizes, "(max-width: 704px) 100vw, 672px");
	const old = "/anh-goc/s2-cnv03/ngoai/2018/07/a-668x445.jpg";
	assert.deepEqual(bodyImageSources(old), { src: old });
	assert.equal(bodyZoomSrc(PICTURE), `${PICTURE}@1920`);
	assert.equal(bodyZoomSrc(old), old);
	assert.equal(bodyZoomSrc(""), "");
});
