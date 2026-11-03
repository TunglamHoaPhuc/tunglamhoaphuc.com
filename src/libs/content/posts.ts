// The posts file of the old admin (Dòng Chảy Hoằng Pháp, Trí Tuệ Phật Pháp…) → Post.
import { isEmojiImage, isWordPressMedia, mediaUrl } from "./media";
import { type ContentNote, cleanText, renderContent, toIsoDate } from "./normalize";
import { postsFileSchema, type RawPost, rawPostSchema } from "./schema";
import type { ContentIssue, GalleryImage, MediaImage, Post } from "./types";

const DEFAULT_POSITION = "center 50%";

function image(url: string, position: string): MediaImage | null {
	const src = mediaUrl(url);
	return src ? { src, position: position.trim() || DEFAULT_POSITION } : null;
}

function plain(text: string): string {
	return cleanText(text).replace(/\s+/g, " ").trim();
}

const TITLE_MAX = 100;

/** For untitled posts: the first sentence of the text, cut at a word near TITLE_MAX. */
function titleFromText(raw: RawPost): string {
	const first = cleanText(raw.content || raw.summary)
		.split("\n")
		.map((line) => line.replace(/^#+\s*/, "").trim())
		.find(Boolean);
	if (!first) return "";
	const sentence = first.match(/^.{10,}?[.!?](?=\s|$)/)?.[0] ?? first;
	if (sentence.length <= TITLE_MAX) return sentence;
	return `${sentence.slice(0, TITLE_MAX).replace(/\s+\S*$/, "")}…`;
}

function toPost(raw: RawPost, publishedDate: string, categoryName: string, issues: ContentIssue[]): Post {
	const notes: ContentNote[] = [];
	const gallery: GalleryImage[] = [];
	let emoji = 0;
	for (const photo of raw.photoGallery) {
		if (isEmojiImage(photo.imageUrl)) {
			emoji++;
			continue;
		}
		const src = mediaUrl(photo.imageUrl);
		if (src) gallery.push({ src, title: plain(photo.title), caption: plain(photo.caption) });
	}

	const contentHtml = renderContent(raw.content, notes);
	emoji += notes.filter((note) => note.kind === "emoji-image").length;
	if (emoji) issues.push({ kind: "emoji-image", id: raw.id, message: `bỏ ${emoji} ảnh biểu tượng cảm xúc của Facebook` });
	const moved = notes.filter((note) => note.kind === "moved-link");
	if (moved.length) {
		issues.push({ kind: "moved-link", id: raw.id, message: `${moved.length} liên kết tunglamhoaphuc.com/wp-content chuyển sang admin.: ${moved[0].url}` });
	}
	const fromWordPress = [raw.thumbnailUrl, raw.bannerUrl, ...raw.photoGallery.map((photo) => photo.imageUrl)].filter(isWordPressMedia).length;
	if (fromWordPress) issues.push({ kind: "wordpress-image", id: raw.id, message: `${fromWordPress} ảnh còn nằm trên WordPress, chưa có trên B2` });
	if (!raw.photoGallery.length && raw.galleryCount) {
		issues.push({ kind: "missing-album", id: raw.id, message: `galleryCount ${raw.galleryCount}, album trong file trống` });
	} else if (raw.galleryCount !== undefined && raw.galleryCount !== raw.photoGallery.length) {
		issues.push({ kind: "gallery-count", id: raw.id, message: `galleryCount ${raw.galleryCount}, album có ${raw.photoGallery.length} ảnh` });
	}
	if (!raw.summary.trim()) issues.push({ kind: "empty-summary", id: raw.id, message: "không có tóm tắt" });

	return {
		id: raw.id,
		slug: raw.slug.trim(),
		title: plain(raw.title) || titleFromText(raw),
		subtitle: plain(raw.subtitle),
		section: raw.mainCategory.trim(),
		category: { slug: raw.subCategory.trim(), name: categoryName },
		author: plain(raw.author),
		publishedDate,
		views: raw.viewsCount,
		thumbnail: image(raw.thumbnailUrl, raw.thumbnailPosition) ?? image(raw.bannerUrl, raw.bannerPosition),
		banner: image(raw.bannerUrl, raw.bannerPosition) ?? image(raw.thumbnailUrl, raw.thumbnailPosition),
		summary: plain(raw.summary),
		galleryCount: gallery.length,
		contentHtml,
		keywords: raw.keywords
			.map((keyword) => ({ keyword: plain(keyword.keyword), title: plain(keyword.title), description: plain(keyword.description) }))
			.filter((keyword) => keyword.keyword),
		gallery,
	};
}

/** One name per category: the one most records use ("Ấn Phẩm & Sách" over "Ấn Phẩm Sách"). */
function categoryNames(records: RawPost[], issues: ContentIssue[]): Map<string, string> {
	const counts = new Map<string, Map<string, number>>();
	for (const record of records) {
		const key = `${record.mainCategory}/${record.subCategory}`;
		const names = counts.get(key) ?? new Map<string, number>();
		const name = plain(record.categoryName);
		names.set(name, (names.get(name) ?? 0) + 1);
		counts.set(key, names);
	}
	const chosen = new Map<string, string>();
	for (const [key, names] of counts) {
		const ranked = [...names].sort((a, b) => b[1] - a[1]);
		chosen.set(key, ranked[0][0]);
		if (ranked.length > 1) {
			issues.push({ kind: "category-name", id: key, message: `nhiều tên: ${ranked.map(([name, n]) => `"${name}" (${n})`).join(", ")}; dùng "${ranked[0][0]}"` });
		}
	}
	return chosen;
}

export type ParsedPosts = { posts: Post[]; issues: ContentIssue[]; total: number };

/**
 * Reads the posts file: checks every record, skips and reports the ones a page cannot use,
 * and normalises the rest. Only published posts are returned. Order is kept from the file,
 * which decides who keeps a slug that two posts share (the old site serves the first).
 */
export function parsePosts(file: unknown): ParsedPosts {
	const issues: ContentIssue[] = [];
	const root = postsFileSchema.safeParse(file);
	if (!root.success) {
		issues.push({ kind: "invalid", id: "(tệp)", message: "không phải danh sách bài viết" });
		return { posts: [], issues, total: 0 };
	}

	const records: { raw: RawPost; date: string }[] = [];
	root.data.forEach((item, index) => {
		const parsed = rawPostSchema.safeParse(item);
		const id = String((item as { id?: unknown } | null)?.id ?? `#${index}`);
		if (!parsed.success) {
			const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "(bản ghi)"))];
			issues.push({ kind: "invalid", id, message: `thiếu hoặc sai: ${fields.join(", ")}` });
			return;
		}
		if (!plain(parsed.data.title)) {
			if (!titleFromText(parsed.data)) {
				issues.push({ kind: "invalid", id, message: "không có tiêu đề lẫn nội dung" });
				return;
			}
			issues.push({ kind: "missing-title", id, message: `slug "${parsed.data.slug}": "${titleFromText(parsed.data)}"` });
		}
		const date = toIsoDate(parsed.data.publishedDate);
		if (!date) {
			issues.push({ kind: "invalid", id, message: `ngày đăng không đọc được: "${parsed.data.publishedDate}"` });
			return;
		}
		records.push({ raw: parsed.data, date });
	});

	const names = categoryNames(
		records.map(({ raw }) => raw),
		issues,
	);
	const bySlug = new Map<string, string>();
	const posts: Post[] = [];
	for (const { raw, date } of records) {
		if (raw.status !== "published") continue;
		const slug = raw.slug.trim();
		const owner = bySlug.get(slug);
		if (owner) {
			issues.push({ kind: "duplicate-slug", id: raw.id, message: `slug "${slug}" đã thuộc ${owner}; bài này không mở được bằng đường dẫn` });
			continue;
		}
		bySlug.set(slug, raw.id);
		posts.push(toPost(raw, date, names.get(`${raw.mainCategory}/${raw.subCategory}`) ?? "", issues));
	}
	return { posts, issues, total: root.data.length };
}
