// Ảnh của Dòng Chảy Hoằng Pháp (23/11/2026, docs/toi-uu-anh-23-11-2026.md mục 3-4): thẻ danh sách, ảnh bìa bài, album (lưới + hộp phóng to),
// thẻ "Tìm hiểu thêm" và ảnh trong thân bài phải nhận biến thể vừa cỡ (fitImage / imageSrcSet), không được giao ảnh gốc.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PostCard } from "@/components/common/PostCard";
import { InfographicArticleRenderer } from "@/components/tong-chi-tu-hoc/chi-tiet/InfographicArticleRenderer";
import { DiscoverMore } from "@/components/tong-chi-tu-hoc/chi-tiet/DiscoverMore";
import { PhotoGallery } from "@/components/tong-chi-tu-hoc/chi-tiet/PhotoGallery";
import { HeroBanner } from "@/components/tong-chi-tu-hoc/HeroBanner";
import { fallbackOnError, imageSources } from "@/lib/image-sources";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const KEY = "tunglamhoaphuc2/03-dong-chay-hoang-phap/dai-le-su-kien/2-2-scaled.jpg";
const PICTURE = `/anh-goc/media-tunglamhoaphuc/${KEY}`;
const B2 = `https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/${KEY}`;
/** Ảnh WordPress cũ ngoài các khóa có biến thể: đi nguyên bản, nhỏ sẵn. */
const OLD = "/anh-goc/s2-cnv03/ngoai/2018/07/a-668x445.jpg";
const widthsOf = (srcset: string) => [...srcset.matchAll(/ (\d+)w/g)].map((match) => Number(match[1]));
const tags = (html: string, tag = "img") => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((match) => match[0]);

// ── Hành vi ──────────────────────────────────────────────────────────────────

test("imageSources: src là biến thể cỡ yêu cầu, srcset theo các bậc, sizes đi cùng; ảnh chưa có biến thể chỉ có src", () => {
	const set = imageSources(B2, 640, [360, 640, 960, 1280], "50vw");
	assert.equal(set.src, `${PICTURE}@640`);
	assert.deepEqual(widthsOf(set.srcSet ?? ""), [360, 640, 960, 1280]);
	assert.equal(set.sizes, "50vw");
	assert.deepEqual(imageSources(OLD, 640, [360, 640], "50vw"), { src: OLD });
	assert.deepEqual(imageSources("/images/hero/toan-canh-chua-1280.webp", 640, [360, 640], "50vw"), { src: "/images/hero/toan-canh-chua-1280.webp" });
});

test("fallbackOnError: bỏ srcset trước, rồi thử từng địa chỉ thay thế một lần, hết thì dừng (không lặp vô hạn)", () => {
	const attributes = new Map([["srcset", "x 1w"], ["sizes", "1px"]]);
	const element = {
		dataset: {} as Record<string, string>,
		src: "a",
		removeAttribute: (name: string) => void attributes.delete(name),
	};
	const handler = fallbackOnError("b", null, "c");
	const fire = () => handler({ currentTarget: element as unknown as HTMLImageElement });
	fire();
	assert.equal(element.src, "b");
	assert.equal(attributes.size, 0, "srcset và sizes bị bỏ để src mới có tác dụng");
	fire();
	assert.equal(element.src, "c");
	fire();
	assert.equal(element.src, "c", "hết địa chỉ thay thế: giữ nguyên, không đặt lại src gây lỗi lặp");
});

test("thẻ golden của danh sách Dòng Chảy: src 640, srcset 360-1280, sizes theo lưới, ảnh đầu danh sách eager + fetchpriority high", () => {
	const post = { id: "1", imageUrl: B2, title: "Lễ", category1: "Đại lễ", targetUrl: "/dong-chay-hoang-phap/le" } as never;
	const html = renderToStaticMarkup(createElement(PostCard, { post, variant: "golden", priority: true }));
	const [cover] = tags(html);
	assert.match(cover, new RegExp(`src="${PICTURE}@640"`));
	assert.match(cover, /srcSet="[^"]+@360 360w, [^"]+@640 640w, [^"]+@960 960w, [^"]+@1280 1280w"/i);
	assert.match(cover, /sizes="\(max-width: 767px\) calc\(100vw - 32px\), \(max-width: 1279px\) calc\(\(100vw - 120px\) \/ 2\), 580px"/);
	assert.match(cover, /loading="eager"/);
	assert.match(cover, /fetchPriority="high"/i);
	assert.match(cover, /width="640"/);
	// thẻ không ở đầu danh sách: lazy
	const lazy = tags(renderToStaticMarkup(createElement(PostCard, { post, variant: "golden" })))[0];
	assert.match(lazy, /loading="lazy"/);
	assert.doesNotMatch(lazy, /fetchPriority/i);
});

test("huy hiệu chuyên mục: icon tĩnh /images/icons giữ ?v=4, icon ở /anh-goc/ (admin chọn hay logo) đi bằng biến thể 160, không còn ?v=4 cản biến thể", () => {
	const staticIcon = renderToStaticMarkup(createElement(PostCard, { post: { id: "1", imageUrl: PICTURE, title: "t", category1IconUrl: "/images/icons/icon-cong-tu-128.webp" } as never, variant: "golden" }));
	assert.match(staticIcon, /src="\/images\/icons\/icon-cong-tu-128\.webp\?v=4"/);
	const adminIcon = renderToStaticMarkup(createElement(PostCard, { post: { id: "1", imageUrl: PICTURE, title: "t", category1IconUrl: `/anh-goc/media-tunglamhoaphuc/${KEY}` } as never, variant: "golden" }));
	assert.match(adminIcon, new RegExp(`src="${PICTURE}@160"`));
	assert.doesNotMatch(adminIcon, /@160\?v=4|\?v=4"[^>]*alt/);
	const fallback = renderToStaticMarkup(createElement(PostCard, { post: { id: "1", imageUrl: PICTURE, title: "Chủ đề lạ", category1: "x" } as never, variant: "golden" }));
	assert.match(fallback, /bieu-tuong-tong-chi-tu-hoc-tung-lam-hoa-phuc\.webp@160"/);
});

test("'Tìm hiểu thêm': thẻ 260-300 px nhận biến thể 640 + srcset 360/640/960, không phải ảnh gốc", () => {
	const html = renderToStaticMarkup(createElement(DiscoverMore, { relatedArticles: [{ title: "Bài", url: B2, link: "/dong-chay-hoang-phap/bai", category: "Đại lễ" }] }));
	const [card] = tags(html);
	assert.match(card, new RegExp(`src="${PICTURE}@640"`));
	assert.deepEqual(widthsOf(card.match(/srcSet="([^"]+)"/i)?.[1] ?? ""), [360, 640, 960]);
	assert.match(card, /sizes="\(max-width: 639px\) 540px, 600px"/);
	assert.match(card, /loading="lazy"/);
	assert.doesNotMatch(card, new RegExp(`src="${PICTURE}"`));
});

test("album: lưới dùng biến thể 640 + srcset (sizes theo ô cao/ngang/vừa), lazy; ảnh chưa có biến thể đi nguyên; không có ảnh gốc trong lưới", () => {
	const photos = Array.from({ length: 8 }, (_, index) => ({ imageUrl: index === 7 ? OLD : B2, title: `Ảnh ${index + 1}` }));
	const html = renderToStaticMarkup(createElement(PhotoGallery, { photoGallery: photos }));
	const grid = tags(html);
	assert.equal(grid.length, 8);
	for (const [index, tag] of grid.entries()) {
		assert.match(tag, /loading="lazy"/);
		assert.match(tag, /decoding="async"/);
		assert.match(tag, /width="640"/);
		if (index === 7) {
			assert.match(tag, new RegExp(`src="${OLD}"`));
			assert.doesNotMatch(tag, /srcSet/i);
			continue;
		}
		assert.match(tag, new RegExp(`src="${PICTURE}@640"`));
		assert.deepEqual(widthsOf(tag.match(/srcSet="([^"]+)"/i)?.[1] ?? ""), [360, 640, 960, 1280]);
	}
	// ô 0 và 2 cao, 4 và 7 ngang 2 cột, còn lại vừa
	assert.match(grid[0], /sizes="\(max-width: 639px\) 130vw, 600px"/);
	assert.match(grid[2], /sizes="\(max-width: 639px\) 130vw, 600px"/);
	assert.match(grid[4], /sizes="\(max-width: 639px\) 100vw, 490px"/);
	assert.match(grid[1], /sizes="\(max-width: 639px\) 100vw, 340px"/);
	assert.ok(!html.includes(`src="${PICTURE}"`), "lưới không bao giờ giao ảnh gốc");
});

test("album: hộp phóng to ở bậc 1920, và mỗi lần đổi ảnh là một phần tử img mới (key) để địa chỉ thay thế tính lại", () => {
	const source = read("src/components/tong-chi-tu-hoc/chi-tiet/PhotoGallery.tsx");
	assert.match(source, /LIGHTBOX_IMAGE_WIDTH = 1920/);
	assert.match(source, /src=\{fitImage\(getImageUrl\(currentItem\.imageUrl \|\| currentItem\.url\), LIGHTBOX_IMAGE_WIDTH\)\}/);
	assert.match(source, /key=\{lightboxIndex\}/);
	assert.equal([...source.matchAll(/<img\b/g)].length, 2, "chỉ có ô lưới và ảnh hộp phóng to");
});

test("ảnh bìa bài (HeroBanner): eager + fetchpriority high + srcset 960/1280/1920, src 1920; không còn next/image preload", () => {
	const html = renderToStaticMarkup(createElement(HeroBanner, { bannerUrl: B2, title: "Bài" }));
	const [cover] = tags(html);
	assert.match(cover, new RegExp(`src="${PICTURE}@1920"`));
	assert.deepEqual(widthsOf(cover.match(/srcSet="([^"]+)"/i)?.[1] ?? ""), [960, 1280, 1920]);
	assert.match(cover, /sizes="\(max-width: 767px\) 240vw, 100vw"/);
	assert.match(cover, /loading="eager"/);
	assert.match(cover, /fetchPriority="high"/i);
	assert.doesNotMatch(cover, /loading="lazy"/);
	assert.match(cover, /width="1920"/);
	assert.match(cover, /height="1080"/);
	assert.match(cover, /object-cover/);
	// bìa chưa có biến thể: một tệp, vẫn eager + high
	const old = tags(renderToStaticMarkup(createElement(HeroBanner, { bannerUrl: OLD, title: "Bài" })))[0];
	assert.match(old, new RegExp(`src="${OLD}"`));
	assert.doesNotMatch(old, /srcSet/i);
	assert.match(old, /fetchPriority="high"/i);
	assert.doesNotMatch(read("src/components/tong-chi-tu-hoc/HeroBanner.tsx"), /from ['"]next\/image['"]/);
});

test("thân bài kiểu cũ (dòng ![chú thích](ảnh)): ảnh nhận src 960 + srcset 5 bậc + sizes khung 672 px; hộp phóng to dùng bậc 1920", () => {
	const html = renderToStaticMarkup(createElement(InfographicArticleRenderer, { rawContent: `<h2>Phần</h2><figure><img src="${PICTURE}" alt="ảnh"><figcaption>Chú thích</figcaption></figure>`, title: "Tiêu đề" }));
	const picture = tags(html).find((tag) => tag.includes(PICTURE));
	assert.ok(picture, "ảnh có mặt");
	assert.match(picture, new RegExp(`src="${PICTURE}@960"`));
	assert.deepEqual(widthsOf(picture.match(/srcSet="([^"]+)"/i)?.[1] ?? ""), [360, 640, 960, 1280, 1920]);
	assert.match(picture, /sizes="\(max-width: 704px\) 100vw, 672px"/);
	assert.match(picture, /loading="lazy"/);
	assert.match(picture, /decoding="async"/);
});

test("thân bài HTML đầy đủ (có bảng): ảnh /anh-goc/ trong khối tlhp-rich được viết lại, ảnh khác nguyên vẹn", () => {
	const html = renderToStaticMarkup(
		createElement(InfographicArticleRenderer, {
			rawContent: `<table><tr><td>ô</td></tr></table><p><img src="${PICTURE}" alt="Lễ"></p><p><img src="/brand/logo-moc-an.webp" alt="Logo"></p>`,
			title: "Tiêu đề",
		}),
	);
	assert.match(html, /class="tlhp-rich"/);
	const [picture] = tags(html).filter((tag) => tag.includes("/anh-goc/"));
	assert.match(picture, new RegExp(`src="${PICTURE}@960"`));
	assert.match(picture, /srcset="[^"]+@1920 1920w"/);
	assert.match(picture, /sizes="\(max-width: 768px\) 100vw, 760px"/);
	assert.ok(tags(html).some((tag) => tag === '<img src="/brand/logo-moc-an.webp" alt="Logo" loading="lazy">'));
});

test("danh sách Dòng Chảy: hình nền đầu trang là bản vừa (640, 1280 cho máy tính), tải mức thấp, không phải ảnh gốc", () => {
	const source = read("src/app/(public)/dong-chay-hoang-phap/DongChayHoangPhapClient.tsx");
	assert.match(source, /HEADER_BG_WIDTH = 640/);
	assert.match(source, /HEADER_BG_WIDTHS = \[640, 1280\]/);
	assert.match(source, /fetchPriority="low"/);
	assert.match(source, /const headerBgImage = fitImage\(/);
	assert.doesNotMatch(source, /headerBgImage = getImageUrl\(/);
});

// ── Chốt chặn: không còn <img src={…}> dựng từ địa chỉ ảnh thô ──────────────────────────────

/** Tệp của khu vực này có thẻ <img> hoặc dựng ảnh nền. */
const FILES = [
	"src/app/(public)/dong-chay-hoang-phap/DongChayHoangPhapClient.tsx",
	"src/app/(public)/dong-chay-hoang-phap/[slug]/DongChayDetailClient.tsx",
	"src/components/common/PostCard.tsx",
	"src/components/tong-chi-tu-hoc/HeroBanner.tsx",
	"src/components/tong-chi-tu-hoc/chi-tiet/DiscoverMore.tsx",
	"src/components/tong-chi-tu-hoc/chi-tiet/PhotoGallery.tsx",
	"src/components/tong-chi-tu-hoc/chi-tiet/InfographicArticleRenderer.tsx",
	"src/components/article/RichHtmlBody.tsx",
];

/** Thẻ <img> được phép có src không đi qua fitImage/imageSources, kèm lý do: "tệp::biểu thức src". */
const ALLOWED_RAW: Record<string, string> = {
	"src/components/tong-chi-tu-hoc/HeroBanner.tsx::resolvedEmblem":
		"Biểu tượng linh thiêng 48-128 px phía trên tiêu đề, do trang truyền vào (chỉ trang chính Tông Chỉ, không phải bài Dòng Chảy): ảnh tĩnh nhỏ sẵn; khu vực của Tông Chỉ.",
};

/** Cách dựng được coi là đã qua biến thể. */
const DELIVERED = /\b(fitImage|imageSources|bodyImageSources|bodyZoomSrc)\(/;

/** Các thẻ <img …/> của tệp (bỏ dòng chú thích), mỗi thẻ cắt đến "/>" ngoài dấu ngoặc nhọn của biểu thức. */
function imgTags(text: string): string[] {
	const out: string[] = [];
	for (let at = text.indexOf("<img"); at !== -1; at = text.indexOf("<img", at + 4)) {
		if (!/\s/.test(text[at + 4] ?? "")) continue; // thẻ JSX: <img rồi khoảng trắng (bỏ /^<img/ trong chuỗi, biểu thức chính quy)
		const lineStart = text.lastIndexOf("\n", at) + 1;
		if (/^\s*(\{\/\*|\/\/|\*)/.test(text.slice(lineStart, at + 4))) continue;
		let depth = 0;
		let end = at;
		for (; end < text.length; end++) {
			const ch = text[end];
			if (ch === "{") depth++;
			else if (ch === "}") depth--;
			else if (ch === ">" && depth === 0 && text[end - 1] === "/") break;
		}
		out.push(text.slice(at, end + 1));
	}
	return out;
}

/** Biểu thức trong ngoặc nhọn đi sau `prefix` (cân ngoặc), hoặc chuỗi trong nháy. */
function braced(tag: string, prefix: string): string | null {
	const start = tag.indexOf(prefix);
	if (start === -1) return null;
	let depth = 0;
	// prefix such as "src={" or "{...": the opening brace is the last "{" of it
	for (let i = start + prefix.lastIndexOf("{"); i < tag.length; i++) {
		if (tag[i] === "{") depth++;
		else if (tag[i] === "}" && --depth === 0) return tag.slice(start + prefix.length, i);
	}
	return null;
}

/** Phần định nghĩa của một tên: dòng `const …name… =` đến dấu chấm phẩy, trong cùng tệp. */
function definition(text: string, name: string): string {
	const match = new RegExp(`(?:const|let)\\s+[^=;]*\\b${name}\\b[^=;]*=([\\s\\S]*?);\\n`).exec(text);
	return match?.[1] ?? "";
}

test("chốt chặn: mọi <img> trong tệp của Dòng Chảy có src qua fitImage/imageSources (hoặc nằm trong danh sách ngoại lệ có lý do)", () => {
	const problems: string[] = [];
	let checked = 0;
	for (const file of FILES) {
		const text = read(file);
		for (const tag of imgTags(text)) {
			checked++;
			const spread = /\{\.\.\.([A-Za-z_]\w*)\}/.exec(tag)?.[1];
			const spreadCall = braced(tag, "{...");
			const src = braced(tag, "src={");
			const literal = /\ssrc=(["'])([^"']*)\1/.exec(tag)?.[2];
			let ok = false;
			if (spreadCall && DELIVERED.test(spreadCall)) ok = true;
			else if (spread && DELIVERED.test(definition(text, spread))) ok = true;
			else if (src && DELIVERED.test(src)) ok = true;
			else if (src && /^[A-Za-z_]\w*$/.test(src.trim()) && DELIVERED.test(definition(text, src.trim()))) ok = true;
			else if (literal && /^\/(images|brand)\//.test(literal)) ok = true;
			const key = `${file}::${src ?? literal ?? spreadCall ?? "(không src)"}`;
			if (!ok && !(key in ALLOWED_RAW)) problems.push(`${file}: <img ${(src ?? literal ?? spreadCall ?? "không có src").replace(/\s+/g, " ").slice(0, 90)}>`);
		}
	}
	assert.ok(checked >= 9, `chỉ thấy ${checked} thẻ img`);
	assert.deepEqual(problems, []);
	for (const key of Object.keys(ALLOWED_RAW)) assert.ok(read(key.split("::")[0]).includes(key.split("::")[1] ?? ""), `${key} không còn: gỡ khỏi ALLOWED_RAW`);
});

test("chốt chặn: tệp của Dòng Chảy không gọi getOptimizedNextImageUrl và không dùng getImageUrl/getHighResImageUrl làm src trực tiếp", () => {
	for (const file of FILES) {
		const text = read(file);
		assert.doesNotMatch(text, /\bgetOptimizedNextImageUrl\(/, `${file} dùng hàm ảnh cũ`);
		assert.doesNotMatch(text, /src=\{(getImageUrl|getHighResImageUrl)\(/, `${file} dùng địa chỉ chuẩn hóa nhưng chưa thu nhỏ làm src`);
	}
	// thân bài đi qua bước viết lại ngay sau bộ lọc
	assert.match(read("src/components/article/RichHtmlBody.tsx"), /optimizeBodyImages\(richHtml\(html\)\)/);
});

test("chốt chặn: bộ dò hoạt động (bắt được một <img src={getImageUrl(x)} /> thô)", () => {
	const sample = `<div>
<img width={1} src={getImageUrl(item.url)} alt="x" />
{/* <img src={y} /> */}
const re = /^<img/i;
</div>`;
	const found = imgTags(sample);
	assert.equal(found.length, 1);
	const src = braced(found[0], "src={");
	assert.equal(src, "getImageUrl(item.url)");
	assert.equal(DELIVERED.test(src ?? ""), false);
	assert.equal(DELIVERED.test("fitImage(getImageUrl(x), 640)"), true);
});
