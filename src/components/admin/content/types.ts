// What the content screens read from /api/quan-tri/v1/{posts,teachings,pages}, and how the three kinds differ on screen.

export type KindName = "posts" | "teachings" | "pages";
export type Status = "draft" | "pending" | "published" | "scheduled" | "hidden";

export const STATUS_LABELS: Record<Status, string> = { draft: "Bản nháp", pending: "Chờ duyệt", published: "Đã xuất bản", scheduled: "Hẹn giờ đăng", hidden: "Tạm ẩn" };
export const STATUS_TONES: Record<Status, "neutral" | "ok" | "warn" | "danger"> = { draft: "neutral", pending: "warn", published: "ok", scheduled: "warn", hidden: "danger" };

export type KindUi = {
	name: KindName;
	/** Admin path: /quan-tri/<path>. */
	path: "bai-viet" | "tong-chi" | "gioi-thieu";
	title: string;
	/** "bài viết", "bài", "trang" in sentences. */
	one: string;
	addLabel: string;
	categoryLabel: string;
	/** Name of the summary field and its label. */
	summaryKey: "summary" | "excerpt" | "overview";
	summaryLabel: string;
	hasSection: boolean;
	hasPinned: boolean;
	hasDate: boolean;
	hasPosition: boolean;
	/** Where the public page is: for the "Xem trên trang" link. */
	publicPath: (item: { slug: string; section?: string | null }) => string;
};

export const KIND_UI: Record<KindName, KindUi> = {
	posts: {
		name: "posts",
		path: "bai-viet",
		title: "Bài viết",
		one: "bài viết",
		addLabel: "Thêm bài",
		categoryLabel: "Chuyên mục",
		summaryKey: "summary",
		summaryLabel: "Tóm tắt",
		hasSection: true,
		hasPinned: true,
		hasDate: true,
		hasPosition: false,
		publicPath: (item) => `/${item.section ?? ""}/${item.slug}`,
	},
	teachings: {
		name: "teachings",
		path: "tong-chi",
		title: "Bài Tông chỉ tu học",
		one: "bài",
		addLabel: "Thêm bài",
		categoryLabel: "Nhóm",
		summaryKey: "excerpt",
		summaryLabel: "Tóm tắt",
		hasSection: false,
		hasPinned: false,
		hasDate: true,
		hasPosition: true,
		publicPath: (item) => `/tong-chi-tu-hoc/${item.slug}`,
	},
	pages: {
		name: "pages",
		path: "gioi-thieu",
		title: "Trang Giới thiệu",
		one: "trang",
		addLabel: "Thêm trang",
		categoryLabel: "Nhóm",
		summaryKey: "overview",
		summaryLabel: "Tổng quan",
		hasSection: false,
		hasPinned: false,
		hasDate: false,
		hasPosition: true,
		publicPath: (item) => `/gioi-thieu/${item.slug}`,
	},
};

export type MediaPreview = { id: string; url: string; thumbUrl: string; alt: string; mime: string };
export type RelatedItem = { type: "post" | "statue"; id: string; title: string; href: string | null };
export type Keyword = { keyword: string; title: string; description: string };
export type Milestone = { label: string; title: string; description: string };

export type ContentDetail = {
	id: string;
	version: number;
	status: Status;
	publishAt: string | null;
	slug: string;
	section?: string;
	categoryId: string | null;
	categoryName: string;
	categorySlug: string;
	title: string;
	subtitle: string;
	contentHtml: string;
	contentJson: Record<string, unknown> | null;
	createdBy: string | null;
	createdByName: string;
	createdAt: string | null;
	updatedAt: string | null;
	updatedByName: string;
	related?: RelatedItem[];
	media: Record<string, MediaPreview>;
	previewPath: string;
	canUpdate: boolean;
	canDelete: boolean;
	canPublish: boolean;
	canSubmit: boolean;
	[key: string]: unknown;
};

export type ListRow = {
	id: string;
	slug: string;
	title: string;
	section: string | null;
	categoryId: string | null;
	categoryName: string;
	author: string;
	status: Status;
	publishAt: string | null;
	publishedDate: string | null;
	pinned: boolean;
	position: number | null;
	thumbUrl: string;
	createdBy: string | null;
	createdByName: string;
	updatedAt: string | null;
	updatedByName: string;
	version: number;
	canUpdate: boolean;
	canDelete: boolean;
};

export type Options = {
	sections: { slug: string; name: string }[];
	categories: { id: string; name: string; slug: string; section: string }[];
	authors: { id: string; name: string }[];
};

export type Counts = Record<Status | "all", number>;

export type Revision = { version: number; summary: string; createdBy: string | null; createdByName: string; createdAt: string };
export type RevisionFull = Revision & { snapshot: Record<string, unknown> | null };
export type Comparison = { a: RevisionFull; b: RevisionFull; changed: string[]; labels: Record<string, string> };
