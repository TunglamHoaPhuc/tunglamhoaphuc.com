// Tối ưu ảnh 23/11/2026, khu vực 1 (docs/toi-uu-anh-23-11-2026.md mục 3 và 4): Trí Tuệ Phật Pháp, Tông Chỉ Tu Học, Giới thiệu, Lịch tu học
// (chi tiết), các khối của trang chủ (trừ Hero) và các thành phần dùng chung của chúng. Mọi thẻ <img>/<Image> ở đó phải cho trình duyệt
// ảnh đúng cỡ (fitImage/imageSrcSet, bậc 160/360/640/960/1280/1920), không phải ảnh gốc từ getImageUrl() hay địa chỉ thô.
// Bài kiểm tra quét mã nguồn (không chạy giao diện): thẻ có `src={...}` lấy từ getImageUrl()/thuộc tính ảnh thô mà không qua fitImage thì hỏng,
// trừ danh sách ngoại lệ ở dưới (mỗi mục có lý do).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Thư mục thuộc khu vực 1. Hero của trang chủ, Dòng Chảy, Bảo tượng, Vũ Trụ do khu vực khác lo nên không quét. */
const AREA_DIRS = [
	"src/app/(public)/tri-tue-phat-phap",
	"src/app/(public)/tong-chi-tu-hoc",
	"src/app/(public)/gioi-thieu",
	"src/app/(public)/lich-tu-hoc",
	"src/components/tong-chi-tu-hoc",
	"src/components/gioi-thieu",
	"src/components/tri-tue-phat-phap",
	"src/features/home/components",
	"src/features/wisdom",
];
/** Thành phần dùng chung mà các trang trên gọi tới, cũng được quét. */
const AREA_FILES = [
	"src/components/public/modals/MediaPlayModal.tsx",
	"src/components/common/SectionHeader.tsx",
	"src/components/common/CategoryIcon.tsx",
	"src/components/common/VerticalAnchorNav.tsx",
];
/** Không quét: Hero của trang chủ thuộc khu vực khác. */
const EXCLUDED = new Set(["src/features/home/components/Hero.tsx"]);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) walk(path, out);
		else if (entry.name.endsWith(".tsx")) out.push(path);
	}
	return out;
}

const files = [...new Set([...AREA_DIRS.flatMap((dir) => walk(dir)), ...AREA_FILES])].filter((f) => !EXCLUDED.has(f)).sort();

/**
 * Ngoại lệ có chủ đích: `tệp::đoạn chữ trong biểu thức src` -> lý do. Mục nào không còn khớp thẻ nào thì phải gỡ (kiểm tra bên dưới).
 */
const ALLOWED: Record<string, string> = {
	// Hiện chưa có ngoại lệ nào: hộp phóng to dùng bậc 1920 (qua fitImage) nên cũng không cần miễn; biểu tượng tĩnh /images/icons giữ nguyên địa chỉ
	// vì fitImage trả lại đúng đường dẫn tĩnh. Ví dụ mục: "src/features/x/Y.tsx::item.imageUrl": "lý do".
};

/** Các tệp chỉ nhắc tới nhau, không trang nào dùng (mã chết): chưa chuyển sang fitImage. Nếu nơi khác nhập chúng thì phải chuyển trước. */
const UNUSED_HERITAGE_DIR = "src/features/home/components/heritage";

/** Hàm cho ra đúng cỡ: có một trong các hàm này trong biểu thức là đạt. */
const FITTED = /\b(fitImage|imageSources|fitProps|bodyImageSources|bodyZoomSrc|getOptimizedNextImageUrl)\(/;
/** Biểu thức còn nguyên ảnh gốc: hàm chuẩn hóa địa chỉ nhưng không đổi cỡ. */
const RAW_CALL = /\b(getImageUrl|getHighResImageUrl|mediaUrl)\(/;
/** Truy cập thuộc tính ảnh thô của dữ liệu D1: item.imageUrl, topic.portraitImage, art.bannerUrl... */
const RAW_MEMBER = /\.\w*(?:[Uu]rl|[Ii]mage|[Ii]mg|[Bb]anner|[Tt]humbnail|[Cc]over|[Ww]atermark|[Ll]ogo|[Ii]con)\w*/;

type Site = { file: string; line: number; kind: string; expr: string };

/** Biểu thức trong `name={...}` hoặc chuỗi `name="..."` của một thẻ; `null` nếu thẻ không có thuộc tính đó. */
function attribute(tag: string, name: string): string | null {
	const match = new RegExp(`(?<![\\w-])${name}=`).exec(tag);
	if (!match) return null;
	let i = match.index + match[0].length;
	if (tag[i] === '"' || tag[i] === "'") {
		const end = tag.indexOf(tag[i], i + 1);
		return `"${tag.slice(i + 1, end)}"`;
	}
	if (tag[i] !== "{") return null;
	let depth = 0;
	const start = i;
	for (; i < tag.length; i++) {
		if (tag[i] === "{") depth++;
		else if (tag[i] === "}" && --depth === 0) return tag.slice(start + 1, i);
	}
	return null;
}

/** Câu lệnh `const <tên> = ...;` của một biến (để kiểm biến đó có qua fitImage không). */
function declaration(text: string, name: string): string | null {
	const match = new RegExp(`const ${name}\\s*=([\\s\\S]*?);\\n`).exec(text);
	return match ? match[1] : null;
}

function sitesOf(file: string): Site[] {
	const text = read(file);
	const sites: Site[] = [];
	const lineOf = (index: number) => text.slice(0, index).split("\n").length;

	// Thẻ ảnh: <img ...>, <Image ...>, <motion.img ...> (sau tên thẻ phải là khoảng trắng thật, để không dính biểu thức chính quy trong mã).
	for (const match of text.matchAll(/<(?:img|Image|motion\.img)(?=\s)[\s\S]*?\/>/g)) {
		const tag = match[0];
		const index = match.index ?? 0;
		const lineStart = text.lastIndexOf("\n", index) + 1;
		if (/^\s*(\{\/\*|\/\/|\*)/.test(text.slice(lineStart, index + 4))) continue;
		const src = attribute(tag, "src");
		if (src === null) continue; // ảnh dựng bằng {...imageSources(...)} hay không có src
		sites.push({ file, line: lineOf(index), kind: "src", expr: src });
	}

	// Ảnh nền: url(${...}) trong style.
	for (const match of text.matchAll(/url\(\s*['"]?\$\{([^}]*)\}/g)) sites.push({ file, line: lineOf(match.index ?? 0), kind: "url()", expr: match[1] });
	for (const match of text.matchAll(/backgroundImage:\s*([^\n]*)/g)) {
		const expr = match[1];
		if (/url\(\s*['"]?\$\{/.test(expr)) continue; // đã tính ở trên
		const literal = /url\(\s*['"]?([^'")]+)/.exec(expr);
		if (literal) sites.push({ file, line: lineOf(match.index ?? 0), kind: "url()", expr: `"${literal[1]}"` });
	}
	return sites;
}

/** Vị trí này còn xin ảnh gốc không? Trả về lý do nếu có. */
function problem(site: Site, text: string): string | null {
	const { expr } = site;
	if (FITTED.test(expr)) return null;
	// Chuỗi tĩnh: ảnh của site (/images, /brand) thì được; ảnh /anh-goc/ viết cứng thì phải qua fitImage.
	const literal = /^"([^"]*)"$/.exec(expr.trim());
	if (literal) return literal[1].includes("/anh-goc/") ? `địa chỉ /anh-goc/ viết cứng không qua fitImage: ${literal[1]}` : null;
	if (RAW_CALL.test(expr)) return `biểu thức dùng getImageUrl()/mediaUrl() mà không qua fitImage: ${expr.trim().slice(0, 90)}`;
	if (RAW_MEMBER.test(expr)) return `thuộc tính ảnh thô, không qua fitImage: ${expr.trim().slice(0, 90)}`;
	// Tên biến trơn (src={videoThumb}): xem câu lệnh khai báo trong cùng tệp.
	const name = /^\s*([A-Za-z_]\w*)\s*$/.exec(expr)?.[1];
	if (name) {
		const declared = declaration(text, name);
		if (declared !== null && !FITTED.test(declared) && (RAW_CALL.test(declared) || RAW_MEMBER.test(declared))) {
			return `biến ${name} lấy từ getImageUrl()/thuộc tính thô mà không qua fitImage`;
		}
	}
	return null;
}

const allSites = files.flatMap(sitesOf);
const allowedHits = new Set<string>();

function allowedBy(site: Site): string | null {
	for (const key of Object.keys(ALLOWED)) {
		const [file, snippet] = key.split("::");
		if (file === site.file && site.expr.includes(snippet)) {
			allowedHits.add(key);
			return key;
		}
	}
	return null;
}

test("quét thật: khu vực 1 có hàng chục thẻ ảnh, và phần lớn đã qua fitImage", () => {
	assert.ok(files.length > 40, `chỉ quét ${files.length} tệp`);
	const withSrc = allSites.filter((site) => site.kind === "src");
	assert.ok(withSrc.length > 60, `chỉ thấy ${withSrc.length} thẻ có src`);
	const fitted = allSites.filter((site) => FITTED.test(site.expr));
	assert.ok(fitted.length > 50, `chỉ ${fitted.length} vị trí đã qua fitImage`);
});

test("không thẻ <img>/<Image> hay ảnh nền nào ở khu vực 1 xin ảnh gốc: src lấy từ getImageUrl()/thuộc tính ảnh thô đều phải qua fitImage", () => {
	const bad: string[] = [];
	for (const site of allSites) {
		if (site.file.startsWith(`${UNUSED_HERITAGE_DIR}/`)) continue;
		const why = problem(site, read(site.file));
		if (why && !allowedBy(site)) bad.push(`${site.file}:${site.line} (${site.kind}): ${why}`);
	}
	assert.deepEqual(bad, [], `Ảnh chưa vừa cỡ (dùng fitImage(url, bậc) và imageSrcSet), hoặc ghi lý do vào ALLOWED:\n${bad.join("\n")}`);
});

test("bộ dò hoạt động: bắt src lấy từ getImageUrl()/thuộc tính thô, cho qua fitImage, ảnh tĩnh và biến đã qua fitImage", () => {
	const check = (expr: string, text = "") => problem({ file: "x.tsx", line: 1, kind: "src", expr }, text);
	assert.match(check("getImageUrl(item.url)") ?? "", /getImageUrl/);
	assert.match(check("getImageUrl(card.imageUrl) || '/images/a.webp'") ?? "", /getImageUrl/);
	assert.match(check("item.thumbnailUrl") ?? "", /thuộc tính ảnh thô/);
	assert.match(check("topic.portraitImage") ?? "", /thuộc tính ảnh thô/);
	assert.match(check('"/anh-goc/media-tunglamhoaphuc/a.webp"') ?? "", /viết cứng/);
	assert.match(check("videoThumb", "const videoThumb = getImageUrl(heroBanner) || '/x.webp';\n") ?? "", /biến videoThumb/);
	assert.equal(check("fitImage(item.thumbnailUrl, 640)"), null);
	assert.equal(check("fitImage(getImageUrl(item.url), 960) || '/images/a.webp'"), null);
	assert.equal(check('"/images/hero/toan-canh-chua-1280.webp"'), null);
	assert.equal(check("videoThumb", "const videoThumb = fitImage(getImageUrl(heroBanner), 640);\n"), null);
	assert.equal(check("qrDataUrl"), null);
	// Đọc đúng thuộc tính của thẻ, kể cả biểu thức lồng ngoặc nhọn.
	assert.equal(attribute('<img width={640} src={fitImage(a ? { b: 1 } : c, 640)} alt="x" />', "src"), "fitImage(a ? { b: 1 } : c, 640)");
	assert.equal(attribute('<img {...imageSources(a, 640)} alt="x" />', "src"), null);
});

test("ALLOWED không thừa: mục nào không còn khớp thẻ ảnh nào phải gỡ", () => {
	for (const site of allSites) {
		if (!site.file.startsWith(`${UNUSED_HERITAGE_DIR}/`) && problem(site, read(site.file))) allowedBy(site);
	}
	for (const key of Object.keys(ALLOWED)) assert.ok(allowedHits.has(key), `${key} không còn khớp: gỡ khỏi ALLOWED`);
});

test("thư mục heritage của trang chủ vẫn là mã chết: nơi nào nhập vào nó thì phải chuyển sang fitImage trước", () => {
	const importers: string[] = [];
	for (const file of walkAll("src")) {
		if (file.startsWith(`${UNUSED_HERITAGE_DIR}/`)) continue;
		if (/from\s+["'][^"']*heritage\/[^"']*["']/.test(read(file))) importers.push(file);
	}
	assert.deepEqual(importers, [], `Đã có nơi nhập heritage/: chuyển các <img> trong ${UNUSED_HERITAGE_DIR} sang fitImage và bỏ ngoại lệ này`);
});

test("cỡ ảnh: mọi fitImage dùng bậc chuẩn; hộp phóng to là bậc 1920; ảnh đại diện nhỏ của Tông Chỉ là bậc 360", () => {
	const widthsOf = (file: string) => [...read(file).matchAll(/fitImage\([^;\n]*?,\s*(\d{2,4})\)/g)].map((m) => Number(m[1]));
	const STANDARD = new Set([160, 360, 640, 960, 1280, 1920]);
	const bad: string[] = [];
	for (const file of files) {
		for (const width of widthsOf(file)) if (!STANDARD.has(width)) bad.push(`${file}: bậc ${width} không phải bậc chuẩn`);
	}
	assert.deepEqual(bad, []);
	// Hộp phóng to của Sư Tổ, lịch tu học, bộ ảnh Galaxy: bậc 1920.
	assert.match(read("src/components/gioi-thieu/TieuSuSuToOdysseyView.tsx"), /fitImage\(lightboxState\.items\[lightboxState\.idx\]\.url, 1920\)/);
	assert.match(read("src/features/home/components/CalendarSection.tsx"), /fitImage\(selectedZoomQuote\?\.url \|\| monthTheme\.quoteImg \|\| monthTheme\.bannerImg, 1920\)/);
	assert.match(read("src/features/home/components/GalaxyTimelineGallery.tsx"), /fitImage\(lightboxImg, 1920\)/);
	// Ảnh đại diện nhỏ của Tông Chỉ (ô vuông ~112 px) không còn xin ảnh 4.160×6.240.
	assert.match(read("src/components/tong-chi-tu-hoc/chi-tiet/DetailModal.tsx"), /fitImage\(getImageUrl\(activeKeywordPopup\.imageUrl\), 360\)/);
});

test("thẻ có srcSet thì có sizes, và khi lỗi gỡ srcSet trước khi đổi sang ảnh dự phòng", () => {
	const problems: string[] = [];
	for (const file of files) {
		const text = read(file);
		for (const match of text.matchAll(/<(?:img|Image|motion\.img)(?=\s)[\s\S]*?\/>/g)) {
			const tag = match[0];
			if (!/\bsrcSet=/.test(tag)) continue;
			const line = text.slice(0, match.index ?? 0).split("\n").length;
			if (!/\bsizes=/.test(tag)) problems.push(`${file}:${line}: có srcSet mà không có sizes`);
			if (/onError=/.test(tag) && !/removeAttribute\(['"]srcset['"]\)|fallbackOnError|swapOnError/.test(tag)) problems.push(`${file}:${line}: onError đổi src nhưng không gỡ srcset (trình duyệt vẫn chọn từ srcset)`);
		}
	}
	assert.deepEqual(problems, []);
});

function walkAll(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) walkAll(path, out);
		else if (/\.(tsx|ts)$/.test(entry.name)) out.push(path);
	}
	return out;
}
