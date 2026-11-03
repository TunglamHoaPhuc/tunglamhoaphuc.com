// The posts file of the old admin (Dòng Chảy Hoằng Pháp, Trí Tuệ Phật Pháp…) → Post.
import { isEmojiImage, isWordPressMedia, mediaUrl } from "./media";
import { type ContentNote, cleanText, renderContent, toIsoDate } from "./normalize";
import { postsFileSchema, type RawPost, rawPostSchema } from "./schema";
import type { ContentIssue, GalleryImage, MediaImage, Post, Video } from "./types";

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

// Letters and digits only, to compare texts whatever their quotes, marks and line breaks.
const letters = (text: string) => cleanText(text).toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu, "");

/** Most summaries are the first lines of the text again; an article page shows those once. */
function repeatsOpening(summary: string, content: string): boolean {
	const start = letters(summary.replace(/(\.{3}|…)\s*$/, "")).slice(0, 60);
	return !!start && letters(content).startsWith(start);
}

const SUMMARY_MAX = 220;
// What the old admin's form pre-fills, saved as is in a few posts.
const PLACEHOLDER_SUMMARY = /^tóm tắt( nội dung)? bài viết\s*(\.{3}|…)?$/i;

/** For posts without a real summary: the start of the text, markup removed. */
function summaryFromText(raw: RawPost): string {
	const text = plain(
		cleanText(raw.content)
			.split("\n")
			.map((line) => line.replace(/^(#{1,6}|>|[-*•]|\d+[.)])\s+/, ""))
			.filter((line) => !/^!\[/.test(line.trim()) && !/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim()))
			.join(" ")
			.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
			.replace(/https?:\/\/\S+/g, "")
			.replace(/\*\*/g, ""),
	);
	if (text.length <= SUMMARY_MAX) return text;
	return `${text.slice(0, SUMMARY_MAX).replace(/\s+\S*$/, "")}…`;
}

type RawPhoto = RawPost["photoGallery"][number];

/** An album from the old admin: Facebook emoji dropped, addresses through mediaUrl(). */
export function toGallery(photos: RawPhoto[]): { gallery: GalleryImage[]; emoji: number } {
	const gallery: GalleryImage[] = [];
	let emoji = 0;
	for (const photo of photos) {
		if (isEmojiImage(photo.imageUrl)) {
			emoji++;
			continue;
		}
		const src = mediaUrl(photo.imageUrl);
		if (src) gallery.push({ src, title: plain(photo.title), caption: plain(photo.caption) });
	}
	return { gallery, emoji };
}

// youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID
const YOUTUBE = /https?:\/\/(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:\S*&)?v=|embed\/|shorts\/))([\w-]{11})/g;

export function videosOf(content: string): Video[] {
	const ids = [...new Set([...content.matchAll(YOUTUBE)].map((match) => match[1]))];
	return ids.map((id) => ({ id, url: `https://www.youtube.com/watch?v=${id}` }));
}

function toPost(raw: RawPost, publishedDate: string, categoryName: string, issues: ContentIssue[]): Post {
	const notes: ContentNote[] = [];
	const { gallery, emoji: albumEmoji } = toGallery(raw.photoGallery);
	let emoji = albumEmoji;
	if (raw.slug.includes("%")) {
		issues.push({ kind: "encoded-slug", id: raw.id, message: `slug lưu sẵn dạng mã hóa (biểu tượng cảm xúc), API site cũ không mở được: ${raw.slug.slice(0, 60)}` });
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
	let summary = plain(raw.summary);
	let ownSummary = true;
	if (!summary || PLACEHOLDER_SUMMARY.test(summary)) {
		issues.push({ kind: "empty-summary", id: raw.id, message: summary ? `tóm tắt là chữ mẫu "${summary}"` : "không có tóm tắt" });
		summary = summaryFromText(raw);
		ownSummary = false;
	}

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
		summary,
		intro: ownSummary && !repeatsOpening(summary, raw.content) ? summary : "",
		// An album kept apart (post-albums.json) still counts, so lists can say it has photos.
		galleryCount: gallery.length || (raw.galleryCount ?? 0),
		contentHtml,
		videos: videosOf(raw.content),
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
	const byTitle = new Map<string, string>();
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
		const post = toPost(raw, date, names.get(`${raw.mainCategory}/${raw.subCategory}`) ?? "", issues);
		// Same section, same title: usually a post saved twice. Both stay listed.
		const titleKey = `${post.section}|${post.title.toLocaleLowerCase("vi")}`;
		const twin = byTitle.get(titleKey);
		if (twin) issues.push({ kind: "duplicate-title", id: raw.id, message: `cùng tiêu đề với ${twin}: "${post.title}"` });
		else byTitle.set(titleKey, raw.id);
		posts.push(post);
	}
	return { posts, issues, total: root.data.length };
}
