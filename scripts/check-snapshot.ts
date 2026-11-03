// npm run snapshot:check: reads data/snapshot/posts.json the way the site does and prints
// what it found: posts per section and category, records it had to skip, and data oddities
// worth fixing in the old admin. Exits 1 only when the file is missing or unreadable.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePosts } from "../src/libs/content/posts";
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
	"duplicate-title": "Trùng tiêu đề trong cùng chuyên mục (có thể là bài lưu hai lần)",
	"category-name": "Một chuyên mục, nhiều tên",
	"emoji-image": "Ảnh biểu tượng cảm xúc Facebook đã bỏ",
	"missing-album": "Album trống dù galleryCount > 0 (API chi tiết của site cũ có ảnh)",
	"gallery-count": "galleryCount khác số ảnh trong album",
	"wordpress-image": "Bài còn ảnh trên WordPress (chưa có trên B2)",
	"moved-link": "Liên kết tunglamhoaphuc.com/wp-content (chuyển sang admin.)",
	"empty-summary": "Bài không có tóm tắt hoặc tóm tắt là chữ mẫu (tạm lấy đầu nội dung)",
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

const { posts, issues, total } = parsePosts(file);
console.log(`posts.json: ${total} bản ghi, ${posts.length} bài dùng được\n`);

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

console.log("\nBất thường dữ liệu");
const byKind = new Map<ContentIssue["kind"], ContentIssue[]>();
for (const issue of issues) byKind.set(issue.kind, [...(byKind.get(issue.kind) ?? []), issue]);
if (!byKind.size) console.log("  (không có)");
for (const [kind, list] of byKind) {
	console.log(`  ${ISSUE_TITLES[kind]}: ${list.length}`);
	for (const issue of list.slice(0, EXAMPLES)) console.log(`    - ${issue.id}: ${issue.message}`);
	if (list.length > EXAMPLES) console.log(`    … và ${list.length - EXAMPLES} mục nữa`);
}
