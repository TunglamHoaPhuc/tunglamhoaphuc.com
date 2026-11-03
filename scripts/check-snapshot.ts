// npm run snapshot:check: reads data/snapshot/posts.json (and schedule.json) the way the
// site does and prints what it found: posts per section and category, events per month,
// records it had to skip, and data oddities worth fixing in the old admin. Exits 1 only
// when the posts file is missing or unreadable.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePosts } from "../src/libs/content/posts";
import { parseAbout } from "../src/libs/content/about";
import { parseSchedule } from "../src/libs/content/schedule";
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
