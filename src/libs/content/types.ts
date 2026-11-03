// Domain types of the content layer. Pages and components see only these, never the raw
// JSON of the old admin, so the source (snapshot, B2, D1) can change underneath.

/** A picture and the CSS object-position the editors chose for it ("center 50%"). */
export type MediaImage = { src: string; position: string };

export type GalleryImage = { src: string; title: string; caption: string };

/** Glossary entry shown beside an article ("Địa Tạng Bồ Tát" → who that is). */
export type Keyword = { keyword: string; title: string; description: string };

/** A category inside a section, e.g. "Cộng Tu Định Kỳ" in Dòng Chảy Hoằng Pháp. */
export type Category = { slug: string; name: string };

export type CategoryCount = Category & { count: number };

/** What list pages need: no body, no gallery. */
export type PostSummary = {
	id: string;
	slug: string;
	title: string;
	subtitle: string;
	/** Top-level area of the site and of the URL: "dong-chay-hoang-phap", "tri-tue-phat-phap"… */
	section: string;
	category: Category;
	author: string;
	/** YYYY-MM-DD. */
	publishedDate: string;
	views: number;
	thumbnail: MediaImage | null;
	summary: string;
	galleryCount: number;
};

export type Post = PostSummary & {
	banner: MediaImage | null;
	/** Sanitised HTML, safe to render as is. */
	contentHtml: string;
	keywords: Keyword[];
	gallery: GalleryImage[];
};

export type PostSort = "newest" | "oldest" | "az" | "za";

export type PostQuery = {
	section?: string;
	category?: string;
	sort?: PostSort;
	/** 1-based. */
	page?: number;
	pageSize?: number;
};

export type Page<T> = {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
	pageCount: number;
};

/** Read-only access to the temple's content, whatever the source. */
export interface ContentRepository {
	listPosts(query?: PostQuery): Promise<Page<PostSummary>>;
	/** `null` when no published post has this slug. */
	getPostBySlug(slug: string): Promise<Post | null>;
	listCategories(section: string): Promise<CategoryCount[]>;
}

/** Something wrong or odd in the source data, for `npm run snapshot:check`. */
export type ContentIssue = {
	kind:
		| "invalid"
		| "missing-title"
		| "duplicate-slug"
		| "category-name"
		| "emoji-image"
		| "missing-album"
		| "gallery-count"
		| "wordpress-image"
		| "moved-link"
		| "empty-summary";
	id: string;
	message: string;
};
