// The three kinds of articles the content module edits (docs/admin-architecture.md 7.4): posts, the Tông Chỉ Tu Học
// articles and the Giới thiệu pages. They share one set of endpoints; what differs (table, columns, the category
// they belong to, where the body is kept) is described here, so the service is written once.
import { z } from "zod";
import { safeHref, safeMediaSrc } from "./html";
import { youtubeIdOf } from "./extra";

export type KindName = "posts" | "teachings" | "pages";

type FieldType = "text" | "nullableText" | "date" | "media" | "position" | "bool" | "int" | "json" | "album" | "href";

export type FieldSpec = {
	/** The name in the API (and in revision snapshots). */
	key: string;
	column: string;
	type: FieldType;
	/** Shown in the history ("Sửa: tiêu đề, ảnh bìa"). */
	label: string;
	max?: number;
	/** For json fields: the shape, and the value when the column is empty. */
	schema?: z.ZodType;
	fallback?: unknown;
};

export type Kind = {
	name: KindName;
	/** The rights module. */
	module: KindName;
	table: "post" | "teaching_article" | "page";
	/** What revision, media_usage, the trash and the audit log call it (the table's name). */
	entityType: "post" | "teaching_article" | "page";
	/** "Bài viết": for messages. */
	label: string;
	/** The admin's path (/quan-tri/<path>) and the preview's (/quan-tri/xem-truoc/<path>/<id>). */
	path: "bai-viet" | "tong-chi" | "gioi-thieu";
	/** The column of its category (`categoryId` in the API) and the category kind it must be. */
	categoryColumn: "category_id" | "group_id";
	categoryKind: "post" | "tong-chi" | "about";
	/** Where the body is kept: HTML, or (Tông Chỉ) the light Markdown its pages read. */
	bodyColumn: "content_html" | "body";
	/** The column for the from/to filter. */
	dateColumn: string;
	/** Columns of the summary that goes into search_text. */
	summaryColumn: string;
	/** The picture a list row shows. */
	thumbSql: string;
	idPrefix: string;
	hasSection: boolean;
	hasCreatedAt: boolean;
	hasPinned: boolean;
	hasExtra: boolean;
	hasMilestones: boolean;
	hasPosition: boolean;
	hasRelated: boolean;
	fields: FieldSpec[];
};

const plainItem = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`).default("");
const href = z
	.string()
	.trim()
	.max(500)
	.refine((value) => !value || safeHref(value) !== null, "Liên kết phải là https, mailto hoặc đường dẫn trong trang.");
const picture = z
	.string()
	.trim()
	.max(500)
	.refine((value) => !value || safeMediaSrc(value) !== null, "Ảnh phải ở thư viện (/anh-goc/…) hoặc là địa chỉ https.");

export const KEYWORDS = z.array(z.object({ keyword: plainItem(200), title: plainItem(300), description: plainItem(2000) })).max(50, "Tối đa 50 từ khóa.");
export const VIDEOS = z
	.array(
		z.object({
			id: z.string().trim().regex(/^[A-Za-z0-9_-]{11}$/, "Mã video YouTube không hợp lệ."),
			url: z.string().trim().max(300).regex(/^https:\/\//, "Địa chỉ video phải là https."),
		}),
	)
	.max(20, "Tối đa 20 video.");
const TEACHING_VIDEO = z
	.object({
		id: z.string().trim().default(""),
		url: z.string().trim().max(300).default(""),
		title: plainItem(300),
		description: plainItem(2000),
	})
	.transform((video, ctx) => {
		// Both empty: the editor took the video off. The address is the newer word: the id of the form is only read when there is none.
		if (!video.url && !video.id) return null;
		const id = youtubeIdOf(video.url || video.id);
		if (!id) {
			ctx.addIssue({ code: "custom", message: "Nhập mã hoặc địa chỉ video YouTube hợp lệ.", path: ["url"] });
			return z.NEVER;
		}
		return { ...video, id, url: video.url || `https://www.youtube.com/watch?v=${id}` };
	})
	.nullable();
const FEATURED = z.object({ label: plainItem(100), title: plainItem(300), author: plainItem(200), href: href.nullable().default(null) }).nullable();
const TEACHING_BOOK = z.object({ title: plainItem(300), author: plainItem(200), cover: picture.nullable().default(null), description: plainItem(2000), href: href.nullable().default(null) }).nullable();
const PAGE_BOOK = z.object({ title: plainItem(300), author: plainItem(200), cover: picture.nullable().default(null), description: plainItem(2000) }).nullable();
const QUOTE = z.object({ title: plainItem(300), lines: z.array(z.string().trim().max(500)).max(40).default([]), author: plainItem(200) }).nullable();
export const MILESTONES = z.array(z.object({ label: plainItem(100), title: plainItem(300), description: plainItem(4000) })).max(100, "Tối đa 100 mốc.");

const common = {
	title: { key: "title", column: "title", type: "text", label: "tiêu đề", max: 300 },
	subtitle: { key: "subtitle", column: "subtitle", type: "text", label: "tiêu đề phụ", max: 300 },
	banner: { key: "bannerMediaId", column: "banner_media_id", type: "media", label: "ảnh bìa" },
	bannerPosition: { key: "bannerPosition", column: "banner_position", type: "position", label: "vị trí ảnh bìa" },
	album: { key: "albumId", column: "album_id", type: "album", label: "album ảnh" },
	seoTitle: { key: "seoTitle", column: "seo_title", type: "nullableText", label: "tiêu đề SEO", max: 200 },
	seoDescription: { key: "seoDescription", column: "seo_description", type: "nullableText", label: "mô tả SEO", max: 400 },
	og: { key: "ogMediaId", column: "og_media_id", type: "media", label: "ảnh chia sẻ" },
	author: { key: "author", column: "author", type: "text", label: "tác giả", max: 200 },
	publishedDate: { key: "publishedDate", column: "published_date", type: "date", label: "ngày đăng" },
	keywords: { key: "keywords", column: "keywords", type: "json", label: "từ khóa giải nghĩa", schema: KEYWORDS, fallback: [] },
	position: { key: "position", column: "position", type: "int", label: "thứ tự" },
} satisfies Record<string, FieldSpec>;

export const POSTS: Kind = {
	name: "posts",
	module: "posts",
	table: "post",
	entityType: "post",
	label: "Bài viết",
	path: "bai-viet",
	categoryColumn: "category_id",
	categoryKind: "post",
	bodyColumn: "content_html",
	dateColumn: "published_date",
	summaryColumn: "summary",
	thumbSql: "COALESCE(t.thumbnail_media_id, t.banner_media_id)",
	idPrefix: "post",
	hasSection: true,
	hasCreatedAt: true,
	hasPinned: true,
	hasExtra: true,
	hasMilestones: false,
	hasPosition: false,
	hasRelated: true,
	fields: [
		common.title,
		common.subtitle,
		common.author,
		common.publishedDate,
		{ key: "thumbnailMediaId", column: "thumbnail_media_id", type: "media", label: "ảnh đại diện" },
		{ key: "thumbnailPosition", column: "thumbnail_position", type: "position", label: "vị trí ảnh đại diện" },
		common.banner,
		common.bannerPosition,
		{ key: "summary", column: "summary", type: "text", label: "tóm tắt", max: 2000 },
		{ key: "intro", column: "intro", type: "text", label: "lời dẫn", max: 4000 },
		common.keywords,
		{ key: "videos", column: "videos", type: "json", label: "video", schema: VIDEOS, fallback: [] },
		common.album,
		common.seoTitle,
		common.seoDescription,
		common.og,
		{ key: "pinned", column: "pinned", type: "bool", label: "ghim" },
	],
};

export const TEACHINGS: Kind = {
	name: "teachings",
	module: "teachings",
	table: "teaching_article",
	entityType: "teaching_article",
	label: "Bài Tông chỉ tu học",
	path: "tong-chi",
	categoryColumn: "group_id",
	categoryKind: "tong-chi",
	bodyColumn: "body",
	dateColumn: "published_date",
	summaryColumn: "excerpt",
	thumbSql: "t.banner_media_id",
	idPrefix: "tongchi",
	hasSection: false,
	hasCreatedAt: false,
	hasPinned: false,
	hasExtra: false,
	hasMilestones: false,
	hasPosition: true,
	hasRelated: false,
	fields: [
		common.title,
		{ key: "name", column: "name", type: "text", label: "tên hiển thị", max: 300 },
		common.subtitle,
		common.banner,
		common.bannerPosition,
		{ key: "excerpt", column: "excerpt", type: "text", label: "tóm tắt", max: 2000 },
		common.author,
		{ key: "authorHref", column: "author_href", type: "href", label: "liên kết tác giả" },
		common.publishedDate,
		{ key: "video", column: "video", type: "json", label: "video", schema: TEACHING_VIDEO, fallback: null },
		{ key: "featured", column: "featured", type: "json", label: "bài nổi bật", schema: FEATURED, fallback: null },
		{ key: "book", column: "book", type: "json", label: "sách nguồn", schema: TEACHING_BOOK, fallback: null },
		common.keywords,
		common.album,
		common.position,
		common.seoTitle,
		common.seoDescription,
		common.og,
	],
};

export const PAGES: Kind = {
	name: "pages",
	module: "pages",
	table: "page",
	entityType: "page",
	label: "Trang Giới thiệu",
	path: "gioi-thieu",
	categoryColumn: "group_id",
	categoryKind: "about",
	bodyColumn: "content_html",
	dateColumn: "updated_at",
	summaryColumn: "overview",
	thumbSql: "COALESCE(t.portrait_media_id, t.banner_media_id)",
	idPrefix: "page",
	hasSection: false,
	hasCreatedAt: false,
	hasPinned: false,
	hasExtra: false,
	hasMilestones: true,
	hasPosition: true,
	hasRelated: false,
	fields: [
		common.title,
		common.subtitle,
		{ key: "kicker", column: "kicker", type: "text", label: "nhãn nhỏ", max: 200 },
		common.banner,
		common.bannerPosition,
		{ key: "portraitMediaId", column: "portrait_media_id", type: "media", label: "ảnh chân dung" },
		{ key: "portraitPosition", column: "portrait_position", type: "position", label: "vị trí ảnh chân dung" },
		{ key: "overview", column: "overview", type: "text", label: "tổng quan", max: 4000 },
		{ key: "quote", column: "quote", type: "json", label: "trích dẫn", schema: QUOTE, fallback: null },
		{ key: "book", column: "book", type: "json", label: "tác phẩm", schema: PAGE_BOOK, fallback: null },
		common.album,
		common.position,
		common.seoTitle,
		common.seoDescription,
		common.og,
	],
};

export const KINDS: Record<KindName, Kind> = { posts: POSTS, teachings: TEACHINGS, pages: PAGES };

/** The address the public site serves an article at: /<section>/<slug>, /tong-chi-tu-hoc/<slug> or /gioi-thieu/<slug>. */
export function publicPathOf(kind: Kind, section: string | null, slug: string): string {
	if (kind.table === "post") return `/${section ?? ""}/${slug}`;
	return `${kind.table === "teaching_article" ? "/tong-chi-tu-hoc" : "/gioi-thieu"}/${slug}`;
}
export const kindByPath = (path: string): Kind | undefined => Object.values(KINDS).find((kind) => kind.path === path);

/** The parts of the site posts belong to (the first part of their address). */
export const SECTIONS: { slug: string; name: string }[] = [
	{ slug: "dong-chay-hoang-phap", name: "Dòng Chảy Hoằng Pháp" },
	{ slug: "tri-tue-phat-phap", name: "Trí Tuệ Phật Pháp" },
	{ slug: "vu-tru-phat-giao", name: "Vũ Trụ Phật Giáo" },
];

/** Labels of the fields that are not plain columns, for the history. */
export const SPECIAL_LABELS: Record<string, string> = {
	slug: "đường dẫn",
	section: "chuyên trang",
	categoryId: "chuyên mục",
	contentHtml: "nội dung",
	contentJson: "nội dung",
	extra: "trường riêng của chuyên mục",
	milestones: "mốc niên biểu",
};

export const STATUSES = ["draft", "pending", "published", "scheduled", "hidden"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = { draft: "Bản nháp", pending: "Chờ duyệt", published: "Đã xuất bản", scheduled: "Hẹn giờ đăng", hidden: "Tạm ẩn" };
