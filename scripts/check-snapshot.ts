// npm run snapshot:check: reads data/snapshot/posts.json (and schedule.json) the way the
// site does and prints what it found: posts per section and category, events per month,
// records it had to skip, and data oddities worth fixing in the old admin. Exits 1 only
// when the posts file is missing or unreadable.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePosts } from "../src/libs/content/posts";
import { parseAbout } from "../src/libs/content/about";
import { parseSchedule } from "../src/libs/content/schedule";
import { parseTongChi, tongChiArticle } from "../src/libs/content/tongChi";
import { parseAreas, parseStatues } from "../src/libs/content/vuTru";
import { vuTru } from "../src/config/vuTru";
import { postsFileSchema } from "../src/libs/content/schema";
import type { ContentIssue } from "../src/libs/content/types";

const SECTION_NAMES: Record<string, string> = {
	"dong-chay-hoang-phap": "Dòng Chảy Hoằng Pháp",
	"tri-tue-phat-phap": "Trí Tuệ Phật Pháp",
	"vu-tru-phat-giao": "Vũ Trụ Phật Giáo",
};

const ISSUE_TITLES: Record<ContentIssue["kind"], string> = {
	invalid: "Bản ghi bị bỏ qua (sai cấu trúc)",
	"missing-title": "Bài không có tiêu đề (tạm lấy dòng đầu nội dung)",
	"duplicate-slug": "Trùng slug (bài sau không mở được)",
	"encoded-slug": "Slug lưu sẵn dạng mã hóa, site cũ không mở được (site mới mở được)",
	"duplicate-title": "Trùng tiêu đề trong cùng chuyên mục (có thể là bài lưu hai lần)",
	"category-name": "Một chuyên mục, nhiều tên",
	"emoji-image": "Ảnh biểu tượng cảm xúc Facebook đã bỏ",
	"missing-album": "Album trống dù galleryCount > 0 (API chi tiết của site cũ có ảnh)",
	"gallery-count": "galleryCount khác số ảnh trong album",
	"wordpress-image": "Bài còn ảnh trên WordPress (chưa có trên B2)",
	"moved-link": "Liên kết tunglamhoaphuc.com/wp-content (chuyển sang admin.)",
	"empty-summary": "Bài không có tóm tắt hoặc tóm tắt là chữ mẫu (tạm lấy đầu nội dung)",
	"other-bucket": "Ảnh ở bucket B2 thứ hai (khi chép sang R2 phải chép cả bucket này)",
	"about-mismatch": "Giới thiệu: tiêu đề và nội dung nói về hai người/việc khác nhau (Ban Biên Tập sửa trong admin cũ)",
	"tong-chi-draft": "Tông Chỉ: nội dung còn là bản dặn dàn trang (đã bỏ các dòng ghi chú; Ban Biên Tập nên viết lại)",
	"unsaved-image": "Ảnh WordPress chưa từng tải lên (đường dẫn soạn sẵn, trả 404; trang hiện như không có ảnh)",
	"area-pin": "Vũ Trụ: vị trí ghim trong admin (mapPos) lệch bản đồ; site dùng vị trí trong src/config/vuTru.ts",
	"statue-area": "Bảo Tượng: mã khu vực của tượng không ứng với khu vực nào (tượng không hiện ở trang khu vực)",
	"statue-code": "Bảo Tượng: mã TP của tượng thiếu hoặc không khớp đuôi slug",
};
const EXAMPLES = 5;

const path = resolve("data/snapshot/posts.json");
let file: unknown;
try {
	file = JSON.parse(readFileSync(path, "utf8"));
} catch (error) {
	console.error(`Không đọc được ${path}: ${(error as Error).message}`);
	console.error("Chép các file JSON của admin cũ vào data/snapshot/ (tasks/plan.md, chuẩn bị #1).");
	process.exit(1);
}

const parsed = parsePosts(file);
const { posts, total } = parsed;
let { issues } = parsed;
console.log(`posts.json: ${total} bản ghi, ${posts.length} bài dùng được`);

// Albums fetched apart (npm run snapshot:fetch -- --albums) no longer count as missing.
const albumsPath = resolve("data/snapshot/post-albums.json");
if (existsSync(albumsPath)) {
	const albums = JSON.parse(readFileSync(albumsPath, "utf8")) as Record<string, unknown[]>;
	const filled = issues.filter((issue) => issue.kind === "missing-album" && albums[issue.id]?.length).length;
	issues = issues.filter((issue) => issue.kind !== "missing-album" || !albums[issue.id]?.length);
	console.log(`post-albums.json: ${Object.keys(albums).length} album lấy riêng, bù cho ${filled} bài album trống`);
}
console.log();

// Records per section as stored, before anything is skipped.
const stored = new Map<string, number>();
for (const item of postsFileSchema.safeParse(file).data ?? []) {
	const section = String((item as { mainCategory?: unknown } | null)?.mainCategory ?? "(không rõ)");
	stored.set(section, (stored.get(section) ?? 0) + 1);
}

const sections = new Map<string, Map<string, number>>();
for (const post of posts) {
	const categories = sections.get(post.section) ?? new Map<string, number>();
	const label = `${post.category.name || "(không tên)"} (${post.category.slug || "–"})`;
	categories.set(label, (categories.get(label) ?? 0) + 1);
	sections.set(post.section, categories);
}
for (const [section, categories] of sections) {
	const count = [...categories.values()].reduce((sum, n) => sum + n, 0);
	console.log(`${SECTION_NAMES[section] ?? section}: ${stored.get(section) ?? 0} bản ghi, ${count} bài dùng được`);
	for (const [label, n] of [...categories].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${label}`);
}

// Giới thiệu, from npm run snapshot:fetch.
const aboutPath = resolve("data/snapshot/gioi-thieu.json");
if (existsSync(aboutPath)) {
	const { topics, issues: aboutIssues } = parseAbout(JSON.parse(readFileSync(aboutPath, "utf8")));
	const groups = new Map<string, number>();
	for (const topic of topics) groups.set(topic.group.name, (groups.get(topic.group.name) ?? 0) + 1);
	const perGroup = [...groups].map(([name, n]) => `${name}: ${n}`).join(", ");
	const mismatches = aboutIssues.filter((issue) => issue.kind === "about-mismatch").length;
	console.log(`
gioi-thieu.json: ${topics.length} chủ đề (${perGroup}); ${mismatches ? `${mismatches} chủ đề lệch nội dung` : "tiêu đề và nội dung khớp nhau"}`);
	issues = [...issues, ...aboutIssues];
}

// Tông Chỉ Tu Học, from npm run snapshot:fetch. Each body is converted as its page would
// be, to report the designer's notes it still holds.
const tongChiPath = resolve("data/snapshot/tong-chi.json");
if (existsSync(tongChiPath)) {
	const { entries, issues: tongChiIssues } = parseTongChi(JSON.parse(readFileSync(tongChiPath, "utf8")));
	const groups = new Map<string, number>();
	for (const entry of entries) groups.set(entry.group.name, (groups.get(entry.group.name) ?? 0) + 1);
	const drafts: ContentIssue[] = [];
	for (const entry of entries) {
		const notes: string[] = [];
		tongChiArticle(entry, entries, notes);
		if (notes.length) drafts.push({ kind: "tong-chi-draft", id: entry.slug, message: `bỏ ${notes.length} dòng, vd "${notes.slice(0, 2).join('", "').slice(0, 90)}"` });
	}
	console.log(`
tong-chi.json: ${entries.length} bài (${[...groups].map(([name, n]) => `${name}: ${n}`).join(", ")})`);
	issues = [...issues, ...tongChiIssues, ...drafts];
}

// Vũ Trụ Phật Giáo and its statues, from npm run snapshot:fetch. The map's pins come from
// src/config/vuTru.ts; an admin mapPos far from them is reported, as is a statue whose area
// code no area claims.
const areasPath = resolve("data/snapshot/vu-tru.json");
if (existsSync(areasPath)) {
	const { areas, issues: areaIssues } = parseAreas(JSON.parse(readFileSync(areasPath, "utf8")));
	const own = areas.filter((area) => area.temple === vuTru.temple);
	const pinned = vuTru.pins.map((pin) => pin.slug);
	for (const area of own) {
		const pin = vuTru.pins.find((item) => item.slug === area.slug);
		if (!pin) areaIssues.push({ kind: "area-pin", id: area.slug, message: "chưa có chỗ trên bản đồ (thêm vào pins)" });
		else if (area.mapPos && Math.max(Math.abs(area.mapPos.x - pin.x), Math.abs(area.mapPos.y - pin.y)) > 5) {
			areaIssues.push({ kind: "area-pin", id: area.slug, message: `admin ${area.mapPos.x}%, ${area.mapPos.y}% · bản đồ ${pin.x}%, ${pin.y}%` });
		}
	}
	for (const slug of pinned) if (!own.some((area) => area.slug === slug)) areaIssues.push({ kind: "area-pin", id: slug, message: "có ghim nhưng không còn khu vực" });
	// Another temple's areas are left out by design; a blank or mistyped temple would vanish too.
	for (const area of areas) if (area.temple !== vuTru.temple) areaIssues.push({ kind: "area-pin", id: area.slug, message: `tự viện "${area.temple}" (không hiện trên site)` });
	console.log(
		`\nvu-tru.json: ${areas.length} khu vực, ${own.length} của Tùng Lâm Hòa Phúc; site mới hiện cả ${own.length} (lưới của site cũ dừng ở 12 bản ghi đầu, bản đồ và trang riêng của nó có đủ)`,
	);
	issues = [...issues, ...areaIssues];
}

// Bảo Tượng's statues: the area codes no area claims (their statues show on no area page).
const statuesPath = resolve("data/snapshot/bao-tuong.json");
if (existsSync(statuesPath)) {
	const { statues, issues: statueIssues } = parseStatues(JSON.parse(readFileSync(statuesPath, "utf8")));
	const claimed = new Set(Object.values(vuTru.statueAreas).flat());
	const loose = new Map<string, number>();
	for (const statue of statues) if (!claimed.has(statue.areaCode)) loose.set(statue.areaCode, (loose.get(statue.areaCode) ?? 0) + 1);
	for (const [code, n] of loose) statueIssues.push({ kind: "statue-area", id: code || "(trống)", message: `${n} tượng` });
	console.log(`bao-tuong.json: ${statues.length} tôn tượng, ${statues.filter((statue) => statue.main).length} tượng chính`);
	issues = [...issues, ...statueIssues];
}

// The schedule (lịch tu học), from npm run snapshot:fetch.
const schedulePath = resolve("data/snapshot/schedule.json");
if (existsSync(schedulePath)) {
	const { schedule, issues: scheduleIssues } = parseSchedule(JSON.parse(readFileSync(schedulePath, "utf8")));
	const months = new Map<string, number>();
	for (const event of schedule.events) months.set(event.start.slice(0, 7), (months.get(event.start.slice(0, 7)) ?? 0) + 1);
	const perMonth = [...months].map(([month, n]) => `${month}: ${n}`).join(", ");
	console.log(
		`\nschedule.json: ${schedule.events.length} sự kiện (${perMonth}), ${schedule.programs.length} khóa lễ thường kỳ, ` +
			`${schedule.themes.length} chủ đề tháng, ${schedule.quotes.length} ảnh câu kệ`,
	);
	issues = [...issues, ...scheduleIssues];
}

console.log("\nBất thường dữ liệu");
const byKind = new Map<ContentIssue["kind"], ContentIssue[]>();
for (const issue of issues) byKind.set(issue.kind, [...(byKind.get(issue.kind) ?? []), issue]);
if (!byKind.size) console.log("  (không có)");
for (const [kind, list] of byKind) {
	console.log(`  ${ISSUE_TITLES[kind]}: ${list.length}`);
	for (const issue of list.slice(0, EXAMPLES)) console.log(`    - ${issue.id}: ${issue.message}`);
	if (list.length > EXAMPLES) console.log(`    … và ${list.length - EXAMPLES} mục nữa`);
}
