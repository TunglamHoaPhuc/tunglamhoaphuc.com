// Mọi ảnh của V3 chỉ nằm trên Cloudflare: tệp tĩnh trong public/ hoặc ảnh trong R2 qua /anh-goc/<bucket>/<khóa>. Bài kiểm này quét
// toàn bộ mã nguồn (src/**) và tệp tĩnh (public/**) để không ai viết lại một địa chỉ ảnh B2, WordPress hay host ngoài (kiểm kê ảnh
// 23/11/2026, docs của www: docs/van-hanh/kiem-ke-anh-23-11-2026.md).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Thư mục không quét: bản sao y hệt lớp nội dung của www (src/lib/tlhp-content). Nó vẫn phải NHẬN địa chỉ B2/WordPress cũ nằm trong D1
 * để đổi sang /anh-goc/ (mediaUrl), nên chứa tên các host đó; nó thuộc về người giữ bản sao, không phải nơi viết ảnh vào trang. */
const EXCLUDED_DIRS = ["src/lib/tlhp-content"];

/** Host của chính site: ảnh tuyệt đối trỏ về đây là hợp lệ. */
const OWN_HOSTS = new Set(["www.tunglamhoaphuc.com", "tunglamhoaphuc.com", "v3.tunglamhoaphuc.com"]);

/** Host chỉ là không gian tên (xmlns, JSON-LD), không phải ảnh được tải. */
const NAMESPACE_HOSTS = new Set(["www.w3.org", "schema.org"]);

/** Liên kết không phải ảnh (video, phông, bản đồ, tài liệu, trang bài viết) được phép dẫn ra ngoài. Chỉ để ghi lại: kiểm tra ảnh bên dưới
 * không xét chúng vì địa chỉ của chúng không kết thúc bằng đuôi ảnh. */
export const ALLOWED_NON_IMAGE_HOSTS = [
	"www.youtube.com", "www.youtube-nocookie.com", "fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com", "cdn.pixabay.com",
	"maps.app.goo.gl", "www.google.com", "docs.google.com", "drive.google.com", "web.facebook.com", "giacngo.vn", "chuahoangphap.com.vn",
	"translate.googleapis.com", "translate.google.com", "aipmtdd-tibetan-tts-service.hf.space",
];

/**
 * Địa chỉ ảnh ngoài còn lại có chủ ý, đang chờ chủ dự án quyết (không viết lại, không bịa thay thế). Mỗi mục: tệp, đoạn đầu của địa chỉ, lý do.
 */
const PENDING_DECISION: { file: string; urlStart: string; reason: string }[] = [
	{
		file: "src/features/home/components/WelcomeSection.tsx",
		urlStart: "https://i.ytimg.com/vi/",
		reason: "Ảnh xem trước video YouTube do YouTube sinh, chỉ hiện khi bài chào mừng không có ảnh riêng; chủ quyết định có tải về R2 hay bỏ.",
	},
];

/** Các đường dẫn /images/... mà mã còn nhắc nhưng public/images không có tệp và R2 không có ảnh tương ứng (nguồn cũ trả 404 ở mọi nơi). Ảnh hỏng
 * sẵn từ trước khi chuyển sang R2; chờ chủ gửi lại ảnh hoặc gỡ tham chiếu. Thêm đường dẫn mới vào đây là sai: hãy đặt ảnh vào public/images
 * hoặc R2 rồi dùng /anh-goc/. */
const KNOWN_MISSING_STATIC_IMAGES = new Set([
	"/images/sach-mau.jpg",
	"/images/lotus-pattern.png",
	"/images/tibetan-pattern.png",
	"/images/vu-tru-phat-giao/to-duong/to-duong-banner.jpg",
	"/images/bao_tuong_phat_giao/linh_vat_phat_giao/cac_an_rong_trieu_dai_nha_nguyen_viet_nam.jpg",
	"/images/bao_tuong_phat_giao/thanh_tinh_dai_hai_chung/BO_TAT_NHAT_NGUYET_QUANG/nhat_nguyet_quang_bo_tat.JPG",
	...[
		"bat_dong_kim_cuong", "bo_trich_kim_cuong", "dai_luan_kim_cuong", "dai_tieu_kim_cuong", "dai_uy_duc_kim_cuong", "giang_tam_the_kim_cuong",
		"ma_dau_kim_cuong", "vo_nang_thang_kim_cuong",
	].map((name) => `/images/bao_tuong_phat_giao/ho_phap_than_vuong/NGHE_THUAT_PHAT_GIAO/bat_bo_kim_cang/${name}.jpg`),
	...[
		"bo_dai", "cu_bat", "hang_long", "khai_tam", "khanh_hy", "khoai_nhi", "ky_tuong", "phuc_ho", "qua_giang", "thac_thap", "tham_thu", "tieu_su",
		"tinh_toa", "toa_loc", "tram_tu", "truong_mi",
	].map((name) => `/images/bao_tuong_phat_giao/thanh_van_thanh_chung/THAP_BAT_LA_HAN/NGHE_THUAT_PHAT_GIAO/${name}_la_han_go.jpg`),
	...[
		"cung_ty", "phat_chiet", "me_suy", "at_ne", "ma_ho", "ba_di", "chan_dat", "chieu_do", "ty_yet", "nhan_dat", "san_de",
	].map((name) => `/images/bao_tuong_phat_giao/ho_phap_than_vuong/TUONG_CHINH/thap_nhi_duoc_xoa/${name}_la_dai_tuong.jpg`),
]);

const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".html", ".htm", ".md", ".txt", ".svg", ".xml", ".webmanifest", ".map"]);
const TEXT_NAMES = new Set(["_headers", "_redirects"]);
const IMAGE_EXTENSION = /\.(?:jpe?g|jfif|png|gif|webp|avif|svg|ico|bmp)$/i;
/** Chỗ cuối cùng của một địa chỉ trong mã: dấu nháy, ngoặc, khoảng trắng, hoặc đầu một biểu thức ${...}. */
const URL_PATTERN = /https?:\/\/[^\s"'`<>()\\]+/g;

type SourceFile = { path: string; text: string };

function collect(dir: string, files: SourceFile[] = []): SourceFile[] {
	for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory()) {
			if (EXCLUDED_DIRS.includes(path)) continue;
			collect(path, files);
		} else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase()) || TEXT_NAMES.has(entry.name)) {
			files.push({ path, text: readFileSync(join(ROOT, path), "utf8") });
		}
	}
	return files;
}

const sources = [...collect("src"), ...collect("public")];

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;
const report = (file: string, text: string, index: number, what: string) => `${file}:${lineOf(text, index)}: ${what}`;

test("quét thật: có hàng trăm tệp mã và có data trong src/data (bài kiểm này không rỗng)", () => {
	assert.ok(sources.length > 300, `chỉ quét được ${sources.length} tệp`);
	assert.ok(sources.some((file) => file.path.startsWith("src/data/")));
	assert.ok(sources.some((file) => file.path.startsWith("public/")));
	assert.ok(!sources.some((file) => file.path.startsWith("src/lib/tlhp-content/")));
});

test("không tệp nào nhắc tới B2, WordPress cũ hay host admin/old của web cũ", () => {
	// Khóa R2 của bản gương B2 của WordPress cũ vẫn mang tên thư mục wp-content: đó là khóa thật trong R2, đọc qua /anh-goc/s2-cnv03/.
	const R2_MIRROR_KEY = "/anh-goc/s2-cnv03/tunglamhoaphuc-com/wp-content/";
	const forbidden = [/backblazeb2\.com/gi, /congngheviet/gi, /admin\.tunglamhoaphuc\.com/gi, /old\.tunglamhoaphuc\.com/gi, /wp-content/gi];
	const problems: string[] = [];
	for (const { path, text } of sources) {
		for (const pattern of forbidden) {
			for (const match of text.matchAll(pattern)) {
				const index = match.index ?? 0;
				if (match[0] === "wp-content" && text.slice(Math.max(0, index - R2_MIRROR_KEY.indexOf("wp-content")), index + "wp-content/".length) === R2_MIRROR_KEY) continue;
				problems.push(report(path, text, index, `"${match[0]}"`));
			}
		}
	}
	assert.deepEqual(problems, [], `Địa chỉ ảnh phải là /anh-goc/<bucket>/<khóa> hoặc /images/... (public/):\n${problems.slice(0, 30).join("\n")}`);
});

test("không có địa chỉ ảnh tuyệt đối tới host khác ngoài site (trừ danh sách chờ quyết)", () => {
	const problems: string[] = [];
	const used = new Set<number>();
	for (const { path, text } of sources) {
		for (const match of text.matchAll(URL_PATTERN)) {
			let url: URL;
			try {
				// Đoạn ${...} của mẫu chuỗi không thuộc địa chỉ: cắt ở đó rồi xét phần đã biết.
				url = new URL(match[0].split("${")[0] || match[0]);
			} catch {
				continue;
			}
			if (OWN_HOSTS.has(url.hostname) || NAMESPACE_HOSTS.has(url.hostname)) continue;
			const isImage = IMAGE_EXTENSION.test(url.pathname) || IMAGE_EXTENSION.test(match[0].split(/[?#]/)[0]);
			if (!isImage) continue;
			const pending = PENDING_DECISION.findIndex((item) => item.file === path && match[0].startsWith(item.urlStart));
			if (pending >= 0) {
				used.add(pending);
				continue;
			}
			problems.push(report(path, text, match.index ?? 0, match[0].slice(0, 140)));
		}
	}
	assert.deepEqual(problems, [], `Ảnh phải ở R2 (/anh-goc/) hoặc public/, không tải từ host ngoài:\n${problems.slice(0, 30).join("\n")}`);
	// Danh sách chờ quyết không được thừa: mục nào không còn trong mã thì phải xóa khỏi danh sách.
	PENDING_DECISION.forEach((item, index) => assert.ok(used.has(index), `PENDING_DECISION không còn dùng: ${item.file} ${item.urlStart}`));
});

test("mọi /anh-goc/ trong mã đúng bucket mà route đọc, có khóa và không đi ra ngoài", () => {
	const buckets = new Set(["wordpress", "s2-cnv03", "media-tunglamhoaphuc"]);
	const problems: string[] = [];
	for (const { path, text } of sources) {
		// Chỉ xét chuỗi ký tự (đứng ngay sau dấu nháy), không xét lời chú thích có ghi "/anh-goc/<bucket>/<khóa>".
		for (const match of text.matchAll(/(?<=["'`])\/anh-goc\/([A-Za-z0-9$][^/"'`\s<>\\]*)\/?([^"'`<>\\]*)/g)) {
			const [, bucket, key] = match;
			if (!buckets.has(bucket)) {
				// "/anh-goc/${bucket}" dựng động không phải ảnh cụ thể.
				if (bucket.startsWith("$")) continue;
				problems.push(report(path, text, match.index ?? 0, `bucket lạ "${bucket}"`));
			} else if (key.split("/").some((part) => part === ".." || part === ".")) {
				problems.push(report(path, text, match.index ?? 0, `khóa có "." hoặc ".." trong ${match[0].slice(0, 100)}`));
			}
		}
	}
	assert.deepEqual(problems, [], problems.slice(0, 30).join("\n"));
});

test("đường dẫn /images/... nhắc trong mã phải có tệp trong public/images (trừ các ảnh hỏng sẵn đã ghi tên)", () => {
	const reference = /\/images\/[A-Za-z0-9_\-./%@+]*?\.(?:jpe?g|png|webp|gif|svg|avif)/gi;
	const missing = new Map<string, string>();
	for (const { path, text } of sources) {
		if (path.startsWith("public/")) continue;
		for (const match of text.matchAll(reference)) {
			const url = match[0];
			// Nhắc tới bên trong một địa chỉ khác (…/anh-goc/…/images/x.jpg) thì không phải đường dẫn tĩnh của site.
			const before = text.slice(Math.max(0, (match.index ?? 0) - 1), match.index ?? 0);
			if (before && /[A-Za-z0-9_\-.]/.test(before)) continue;
			if (!existsSync(join(ROOT, "public", ...url.split("/").filter(Boolean)))) missing.set(url, path);
		}
	}
	const unexpected = [...missing].filter(([url]) => !KNOWN_MISSING_STATIC_IMAGES.has(url)).map(([url, file]) => `${file}: ${url}`);
	assert.deepEqual(unexpected, [], `Tệp tĩnh không có trong public/images (route /images/* đã bỏ, không còn chuyển sang B2):\n${unexpected.slice(0, 30).join("\n")}`);
	// Mục nào trong danh sách ảnh hỏng mà nay đã có tệp (hoặc không còn ai nhắc) thì phải gỡ khỏi danh sách.
	const fixed = [...KNOWN_MISSING_STATIC_IMAGES].filter((url) => existsSync(join(ROOT, "public", ...url.split("/").filter(Boolean))));
	assert.deepEqual(fixed, [], "Các ảnh sau đã có trong public/images: bỏ khỏi KNOWN_MISSING_STATIC_IMAGES");
});

test("không còn route /images/[...path] chuyển sang B2, và next.config.ts không còn remotePatterns", () => {
	assert.ok(!existsSync(join(ROOT, "src", "app", "images")), "src/app/images (route chuyển 307 sang B2) đã bỏ");
	const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
	assert.doesNotMatch(config.replace(/\/\/.*$/gm, ""), /remotePatterns/);
});
