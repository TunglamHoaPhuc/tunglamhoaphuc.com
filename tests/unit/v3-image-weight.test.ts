// Giai đoạn 0 của tối ưu ảnh (docs/toi-uu-anh-23-11-2026.md): ảnh tĩnh của site (public/images, public/brand) mà mã nhắc tới không được nặng,
// không có thẻ <link rel="preload" as="image"> cho phần tử ẩn, và ảnh chính của thẻ/biểu ngữ có width/height để trang không xê dịch.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function collect(dir: string, files: string[] = []): string[] {
	for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) collect(path, files);
		else if ([".ts", ".tsx", ".js", ".jsx", ".json", ".css"].includes(extname(entry.name))) files.push(path);
	}
	return files;
}

const sourceFiles = collect("src");

/** Mọi đường dẫn tĩnh /images/... và /brand/... mà mã nhắc, kèm tệp nhắc tới (bỏ phần ?v=...). */
function staticReferences(): Map<string, string> {
	const found = new Map<string, string>();
	const pattern = /(?<![A-Za-z0-9_\-./])\/(?:images|brand)\/[A-Za-z0-9_\-./%@+ ]*?\.(?:jpe?g|png|webp|gif|avif|svg)/gi;
	for (const file of sourceFiles) {
		for (const match of read(file).matchAll(pattern)) if (!found.has(match[0])) found.set(match[0], file);
	}
	return found;
}

const references = staticReferences();
const onDisk = (url: string) => join(ROOT, "public", ...url.split("/").filter(Boolean));

/** Giới hạn cho ảnh tĩnh mà trang tải: 200 KB. */
const MAX_BYTES = 200 * 1024;
/** Biểu tượng nhỏ (hiển thị 14–128 px): 20 KB. */
const MAX_ICON_BYTES = 20 * 1024;

/**
 * Ảnh tĩnh được phép quá 200 KB, kèm lý do. Mục nào không còn được nhắc tới hoặc đã nhỏ lại thì phải gỡ khỏi danh sách.
 */
const HEAVY_ALLOWED: Record<string, string> = {
	"/images/lich-tu-hoc/quotes/thang-03-dung-bo-cuoc.webp": "Áp phích 1.489×2.245 mở phóng to ở lịch tu học; chờ biến thể theo bậc (giai đoạn 1–3 của kế hoạch).",
	"/images/lich-tu-hoc/quotes/thang-05-tu-tap-khiem-ha.webp": "Áp phích 1.494×2.245 mở phóng to ở lịch tu học; chờ biến thể theo bậc.",
	"/images/lich-tu-hoc/quotes/thang-01-quy-y-tam-bao.webp": "Áp phích 1.080×1.350 có kênh alpha, PNG gốc 3,87 MB nay 289 KB (q90); mở phóng to ở lịch tu học; chờ biến thể theo bậc.",
};

test("quét thật: mã nhắc tới hàng chục ảnh tĩnh và mọi tệp đều có trong public/", () => {
	assert.ok(references.size > 30, `chỉ thấy ${references.size} đường dẫn`);
	// Ảnh hỏng sẵn đã ghi tên ở v3-no-external-images.test.ts; ở đây chỉ cần mọi tệp đã nhắc mà có thì được cân.
	const present = [...references.keys()].filter((url) => existsSync(onDisk(url)));
	assert.ok(present.length > 30, `chỉ ${present.length} tệp có thật`);
});

test("ảnh tĩnh trong public/images và public/brand mà mã nhắc tới không quá 200 KB (trừ danh sách có lý do)", () => {
	const heavy: string[] = [];
	for (const [url, file] of references) {
		const path = onDisk(url);
		if (!existsSync(path)) continue;
		const bytes = statSync(path).size;
		if (bytes > MAX_BYTES && !(url in HEAVY_ALLOWED)) heavy.push(`${url}: ${Math.round(bytes / 1024)} KB (nhắc ở ${file})`);
	}
	assert.deepEqual(heavy, [], `Ảnh tĩnh quá 200 KB: thu nhỏ/nén (sharp) hoặc ghi lý do vào HEAVY_ALLOWED:\n${heavy.join("\n")}`);
});

test("HEAVY_ALLOWED không thừa: mục nào không còn nhắc tới, không còn tệp hay đã dưới 200 KB phải gỡ", () => {
	for (const url of Object.keys(HEAVY_ALLOWED)) {
		assert.ok(references.has(url), `${url} không còn được nhắc trong src/`);
		assert.ok(existsSync(onDisk(url)), `${url} không còn tệp`);
		assert.ok(statSync(onDisk(url)).size > MAX_BYTES, `${url} đã dưới 200 KB, gỡ khỏi HEAVY_ALLOWED`);
	}
});

test("không còn PNG/JPG nặng hơn 150 KB trong ảnh tĩnh mà mã nhắc tới (ảnh chia sẻ og: JPEG để mạng xã hội đọc được)", () => {
	const SHARE_IMAGE = "/brand/og-tung-lam-hoa-phuc.jpg";
	const heavy: string[] = [];
	for (const url of references.keys()) {
		if (url === SHARE_IMAGE || !/\.(png|jpe?g)$/i.test(url) || !existsSync(onDisk(url))) continue;
		if (statSync(onDisk(url)).size > 150 * 1024) heavy.push(url);
	}
	assert.deepEqual(heavy, []);
	// Ảnh chia sẻ giữ dưới 150 KB.
	assert.ok(statSync(onDisk(SHARE_IMAGE)).size < 150 * 1024);
});

test("biểu tượng /images/icons mà mã nhắc tới là bản đã thu nhỏ (≤ 20 KB, tên có hậu tố cỡ), không phải bản 512 hay 2000 px", () => {
	const icons = [...references.keys()].filter((url) => url.startsWith("/images/icons/"));
	assert.ok(icons.length >= 14, `chỉ ${icons.length} biểu tượng`);
	const problems: string[] = [];
	for (const url of icons) {
		if (!/-(128|160|224|256)\.webp$/.test(url)) problems.push(`${url}: tên không có hậu tố cỡ (-128|-160|-224|-256).webp`);
		else if (!existsSync(onDisk(url))) problems.push(`${url}: không có tệp`);
		else if (statSync(onDisk(url)).size > MAX_ICON_BYTES) problems.push(`${url}: ${statSync(onDisk(url)).size} byte`);
	}
	assert.deepEqual(problems, []);
});

test("logo đầu trang/chân trang dùng bản vừa cỡ: logo tròn 192 px, mộc ấn có cặp 200/400 px kèm srcSet", () => {
	const header = read("src/components/public/layout/Header.tsx");
	const footer = read("src/components/public/layout/Footer.tsx");
	assert.match(header, /srcSet="\/brand\/logo-moc-an-200\.webp 200w, \/brand\/logo-moc-an\.webp 400w"/);
	assert.match(header, /width=\{400\}\s+height=\{297\}/);
	assert.doesNotMatch(header.slice(header.indexOf('src="/brand/logo-moc-an.webp"') - 40, header.indexOf('alt="Logo Mộc Ấn')), /loading="lazy"/, "logo đầu trang ở trên nếp gấp, không lazy");
	assert.match(footer, /\/brand\/logo-tung-lam-hoa-phuc-tron-192\.webp/);
	assert.ok(statSync(onDisk("/brand/logo-tung-lam-hoa-phuc-tron-192.webp")).size < 12 * 1024);
	assert.ok(existsSync(onDisk("/brand/logo-moc-an.webp")) && existsSync(onDisk("/brand/logo-moc-an-200.webp")));
});

// ── preload ảnh ──────────────────────────────────────────────────────────────

/** Tệp được phép đặt `priority`/`preload` cho <Image> (vinext sinh <link rel="preload" as="image">): ảnh nhìn thấy ngay ở đầu trang. */
const PRIORITY_ALLOWED: Record<string, string> = {
	"src/components/tong-chi-tu-hoc/HeroBanner.tsx": "Biểu ngữ đầu trang Tông Chỉ/Vũ Trụ: phần tử LCP, phủ toàn khung nhìn.",
	"src/components/gioi-thieu/TieuSuSuToOdysseyView.tsx": "Ảnh chân dung đầu trang tiểu sử Sư Tổ: phần tử LCP.",
};

/** Nội dung mọi thẻ <Image …> (đến "/>"), kèm tệp và dòng. */
function imageTags(): { file: string; line: number; tag: string }[] {
	const tags: { file: string; line: number; tag: string }[] = [];
	for (const file of sourceFiles.filter((f) => /\.(tsx|jsx)$/.test(f))) {
		const text = read(file);
		for (const match of text.matchAll(/<Image\b[\s\S]*?\/>/g)) tags.push({ file, line: text.slice(0, match.index).split("\n").length, tag: match[0] });
	}
	return tags;
}

test("không có <link rel=\"preload\" as=\"image\">, ReactDOM.preload hay imageSrcSet trong mã (preload ảnh chỉ qua <Image priority> được liệt kê)", () => {
	const problems: string[] = [];
	for (const file of sourceFiles) {
		if (file.startsWith("src/lib/tlhp-content/")) continue;
		const text = read(file);
		if (/<link\b[^>]*\bas=["']image["']/.test(text)) problems.push(`${file}: <link ... as="image">`);
		if (/\bReactDOM\.preload\(|\bpreloadImage\(/.test(text)) problems.push(`${file}: preload ảnh bằng mã`);
		if (/imageSrcSet=/.test(text)) problems.push(`${file}: imageSrcSet (preload có srcset)`);
	}
	assert.deepEqual(problems, []);
});

test("<Image priority|preload> chỉ ở tệp được liệt kê, và không nằm trong phần tử ẩn", () => {
	const problems: string[] = [];
	const seen = new Set<string>();
	for (const { file, line, tag } of imageTags()) {
		if (!/\b(priority|preload)\b(?!=\{false\})/.test(tag)) continue;
		seen.add(file);
		if (/bieu-tuong-tong-chi-tu-hoc/.test(tag)) problems.push(`${file}:${line}: <Image priority> cho biểu tượng Tông Chỉ`);
		if (!(file in PRIORITY_ALLOWED)) problems.push(`${file}:${line}: <Image priority> chưa được liệt kê`);
		// Phần tử ẩn (0×0, display:none): preload tốn băng thông mà không hiện.
		if (/className=["`{][^"`}]*\b(hidden|invisible|sr-only|w-0|h-0|size-0)\b/.test(tag) || /display:\s*["']?none/.test(tag)) problems.push(`${file}:${line}: <Image priority> nằm trong phần tử ẩn`);
		// Ảnh bị ẩn đúng lúc ở khung bao ngay trên: tìm "hidden" ở 6 dòng trước.
		const before = read(file).split("\n").slice(Math.max(0, line - 7), line - 1).join("\n");
		if (/className=["`{][^"`}]*\b(hidden|invisible)\b[^"`}]*["`}]/.test(before.split("\n").slice(-2).join("\n"))) problems.push(`${file}:${line}: khung bao ngay trên ẩn (hidden/invisible)`);
	}
	assert.deepEqual(problems, []);
	for (const file of Object.keys(PRIORITY_ALLOWED)) assert.ok(seen.has(file), `${file} không còn <Image priority>: gỡ khỏi PRIORITY_ALLOWED`);
});

test("ảnh biểu tượng Tông Chỉ (bieu-tuong-tong-chi-tu-hoc...) không bao giờ được preload", () => {
	for (const file of sourceFiles) {
		const text = read(file);
		for (const match of text.matchAll(/bieu-tuong-tong-chi-tu-hoc[\w-]*\.webp/g)) {
			const around = text.slice(Math.max(0, (match.index ?? 0) - 400), (match.index ?? 0) + 400);
			assert.doesNotMatch(around, /rel=["']preload["']|ReactDOM\.preload/, `${file} preload biểu tượng Tông Chỉ (ẩn ở nhiều khung)`);
		}
	}
});

// ── width/height và loading ──────────────────────────────────────────────────

/** Thẻ <img …> trong mã (đến "/>"), bỏ dòng chú thích. */
function imgTags(file: string): { line: number; tag: string }[] {
	const text = read(file);
	const tags: { line: number; tag: string }[] = [];
	for (const match of text.matchAll(/<img\b[\s\S]*?\/>/g)) {
		const index = match.index ?? 0;
		const lineStart = text.lastIndexOf("\n", index) + 1;
		if (/^\s*(\{\/\*|\/\/|\*)/.test(text.slice(lineStart, index + 4))) continue;
		tags.push({ line: text.slice(0, index).split("\n").length, tag: match[0] });
	}
	return tags;
}

/** Tệp có ảnh chính của thẻ/biểu ngữ/thư viện của các trang đã đo: mọi <img> phải có width và height (trừ ảnh trong hộp phóng to, chỉ hiện khi bấm). */
const MUST_HAVE_DIMENSIONS = [
	"src/components/common/PostCard.tsx",
	"src/components/common/SectionHeader.tsx",
	"src/components/public/layout/Header.tsx",
	"src/components/public/layout/Footer.tsx",
	"src/app/(public)/bao-tuong-phat-giao/StatueListClient.tsx",
	"src/features/statues/components/StatueDetailCoreLayout.tsx",
	"src/features/home/components/GallerySection.tsx",
	"src/features/home/components/NewsSection.tsx",
	"src/features/universe/components/SpaceGallerySection.tsx",
	"src/features/universe/components/StatueCollectionGrid.tsx",
	"src/features/universe/components/OtherAreasSection.tsx",
	"src/features/universe/components/UniverseGridMode.tsx",
	"src/components/tong-chi-tu-hoc/chi-tiet/DiscoverMore.tsx",
	"src/components/tong-chi-tu-hoc/chi-tiet/FeaturedPosts.tsx",
	"src/components/tong-chi-tu-hoc/chi-tiet/PhotoGallery.tsx",
	"src/components/tong-chi-tu-hoc/chi-tiet/TaiNguyenLienQuanCompact.tsx",
	"src/components/tong-chi-tu-hoc/HeroBanner.tsx",
	"src/components/tong-chi-tu-hoc/SubNavbar.tsx",
	"src/components/tong-chi-tu-hoc/SidebarNav.tsx",
];
const POPUP_IMAGE = /currentLightboxItem|zoomImage|selectedItem|selectedStatue|selectedSeal|selectedBook|selectedArticle|currentItem|shuffleCard/;

test("ảnh của thẻ, biểu ngữ và thư viện ở các trang đã đo có width và height", () => {
	const problems: string[] = [];
	for (const file of MUST_HAVE_DIMENSIONS) {
		const tags = imgTags(file);
		assert.ok(tags.length > 0, `${file} không có <img>`);
		for (const { line, tag } of tags) {
			if (POPUP_IMAGE.test(tag)) continue;
			if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) problems.push(`${file}:${line}`);
		}
	}
	assert.deepEqual(problems, [], `<img> thiếu width/height:\n${problems.join("\n")}`);
});

test("ảnh trên nếp gấp không lazy: logo đầu trang, biểu tượng thanh phụ, biểu ngữ; thẻ đầu danh sách nhận priority", () => {
	for (const file of ["src/components/public/layout/Header.tsx", "src/components/tong-chi-tu-hoc/HeroBanner.tsx", "src/components/tong-chi-tu-hoc/SubNavbar.tsx", "src/components/tong-chi-tu-hoc/SidebarNav.tsx"]) {
		for (const { line, tag } of imgTags(file)) assert.doesNotMatch(tag, /loading="lazy"/, `${file}:${line} ở trên nếp gấp mà lazy`);
	}
	const card = read("src/components/common/PostCard.tsx");
	assert.match(card, /priority\?: boolean/);
	assert.equal([...card.matchAll(/loading=\{priority \? 'eager' : 'lazy'\}/g)].length, 2, "hai biến thể thẻ đều theo priority");
	assert.match(read("src/app/(public)/dong-chay-hoang-phap/DongChayHoangPhapClient.tsx"), /priority=\{index === 0\}/);
	const statues = read("src/app/(public)/bao-tuong-phat-giao/StatueListClient.tsx");
	assert.match(statues, /priority=\{index === 0\}/);
	assert.match(statues, /loading=\{priority \? 'eager' : 'lazy'\}/);
});

test("ảnh dưới nếp gấp có loading=lazy decoding=async: chi tiết bảo tượng và các lưới của Vũ Trụ", () => {
	const problems: string[] = [];
	for (const file of [
		"src/features/statues/components/StatueDetailCoreLayout.tsx",
		"src/features/universe/components/DaiNamQuocMauGrid.tsx",
		"src/features/universe/components/ThapNhiDuocXoaGrid.tsx",
		"src/features/universe/components/ChayDuongSection.tsx",
		"src/app/(public)/lich-tu-hoc/[slug]/ScheduleDetailClient.tsx",
	]) {
		for (const { line, tag } of imgTags(file)) {
			if (POPUP_IMAGE.test(tag) || /draggable=\{false\}/.test(tag)) continue;
			if (!/loading=/.test(tag) || !/decoding="async"/.test(tag)) problems.push(`${file}:${line}`);
		}
	}
	assert.deepEqual(problems, []);
});
