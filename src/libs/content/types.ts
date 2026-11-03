// Domain types of the content layer. Pages and components see only these, never the raw
// JSON of the old admin, so the source (snapshot, B2, D1) can change underneath.

/** A picture and the CSS object-position the editors chose for it ("center 50%"). */
export type MediaImage = { src: string; position: string };

export type GalleryImage = { src: string; title: string; caption: string };

/** A YouTube video linked from a post. */
export type Video = { id: string; url: string };

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
	/** The wide picture at the top of the post (and of the home hero). */
	banner: MediaImage | null;
	summary: string;
	galleryCount: number;
};

export type Post = PostSummary & {
	/** The summary when it says something of its own; empty when it only repeats the opening lines. */
	intro: string;
	/** Sanitised HTML, safe to render as is. */
	contentHtml: string;
	keywords: Keyword[];
	gallery: GalleryImage[];
	videos: Video[];
};

/** "views": most read first (the home page's Dấu ấn hoằng pháp). */
export type PostSort = "newest" | "oldest" | "az" | "za" | "views";

export type PostQuery = {
	/** One section, or several (the home page lists every section that has its pages). */
	section?: string | string[];
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

/** One time in an event's programme: "Khai khóa" at "07h30". */
export type EventTime = { label: string; time: string };

/** A day, or a run of days, on the schedule (lịch tu học). */
export type ScheduleEvent = {
	id: string;
	slug: string;
	title: string;
	subtitle: string;
	/** "Cộng Tu", "Khóa Lễ Truyền Thống", "Đại Lễ Sự Kiện". */
	category: Category;
	/** YYYY-MM-DD; `end` is `start` for a one-day event. */
	start: string;
	end: string;
	times: EventTime[];
	location: string;
	description: string;
	notes: string;
	image: MediaImage | null;
	video: Video | null;
};

/** A ceremony held on fixed lunar days each month (Đại sám hối on the 14th and the last day). */
export type RegularProgram = {
	id: string;
	title: string;
	subtitle: string;
	/** Says which lunar days, in the editors' words. */
	summary: string;
	time: string;
	duration: string;
	location: string;
	image: MediaImage | null;
};

/** The theme of a calendar month: its poster and a verse. */
export type MonthTheme = {
	/** 1–12. */
	month: number;
	title: string;
	poster: string | null;
	/** Lines of the verse as HTML whose only tag is <b>. */
	lines: string[];
	author: string;
};

/** A picture of a verse (the old site's kho pháp ngữ), for Lời Thầy dạy (T12). */
export type QuoteImage = { id: string; src: string; title: string };

export type Schedule = {
	/** In date order. */
	events: ScheduleEvent[];
	programs: RegularProgram[];
	themes: MonthTheme[];
	quotes: QuoteImage[];
};

/** One step of a timeline: its label (a year, or a phase such as "Thời Cổ Tự"), title, text. */
export type Milestone = { label: string; title: string; description: string };

/** A topic of Giới thiệu: the temple's history, a teacher's life, the rules of the house. */
export type AboutTopic = {
	id: string;
	slug: string;
	title: string;
	subtitle: string;
	/** Small label above the title: "Trụ Trì Bổn Tự". */
	tag: string;
	/** "Lịch Sử Chùa", "Người Liên Quan", "Thanh Quy & Văn Hóa". */
	group: Category;
	banner: MediaImage | null;
	/** Upright picture, 3:4. */
	portrait: MediaImage | null;
	overview: string;
	quote: { title: string; lines: string[]; author: string } | null;
	milestones: Milestone[];
	/** Sanitised HTML, safe to render as is. */
	contentHtml: string;
	gallery: GalleryImage[];
	/** A book of the person's, shown beside their life. */
	book: { title: string; author: string; cover: string | null; description: string } | null;
};

/** An article of Tông Chỉ Tu Học as lists show it: one teaching or practice of the temple. */
export type TongChiSummary = {
	id: string;
	slug: string;
	/** "Niệm Phật" (the editors write titles in capitals). */
	title: string;
	/** The title, with the subtitle where articles share it: "Lộ Trình Tu Học: Dành cho người trẻ". */
	name: string;
	subtitle: string;
	/** One of the five groups, in the editors' order: "Phương Pháp Hành Trì". */
	group: Category;
	banner: MediaImage | null;
	excerpt: string;
};

export type TongChiArticle = TongChiSummary & {
	author: string;
	/** The author's page on this site, when the editors linked one. */
	authorHref: string | null;
	/** YYYY-MM-DD. */
	publishedDate: string;
	views: number;
	/** Sanitised HTML, safe to render as is. */
	contentHtml: string;
	video: (Video & { title: string; description: string }) | null;
	/** An article the editors point to beside this one (on Trí Tuệ Phật Pháp). */
	featured: { label: string; title: string; author: string; href: string | null } | null;
	gallery: GalleryImage[];
	/** The book the teaching comes from. */
	book: { title: string; author: string; cover: string | null; description: string; href: string | null } | null;
	keywords: Keyword[];
};

/** Read-only access to the temple's content, whatever the source. */
export interface ContentRepository {
	listPosts(query?: PostQuery): Promise<Page<PostSummary>>;
	/** `null` when no published post has this slug. */
	getPostBySlug(slug: string): Promise<Post | null>;
	listCategories(section: string): Promise<CategoryCount[]>;
	getSchedule(): Promise<Schedule>;
	/** Giới thiệu, in the editors' order. */
	listAboutTopics(): Promise<AboutTopic[]>;
	/** Tông Chỉ Tu Học, group by group in the editors' order. */
	listTongChi(): Promise<TongChiSummary[]>;
	/** `null` when no published article has this slug. */
	getTongChi(slug: string): Promise<TongChiArticle | null>;
}

/** Something wrong or odd in the source data, for `npm run snapshot:check`. */
export type ContentIssue = {
	kind:
		| "invalid"
		| "missing-title"
		| "duplicate-slug"
		| "duplicate-title"
		| "encoded-slug"
		| "category-name"
		| "emoji-image"
		| "missing-album"
		| "gallery-count"
		| "wordpress-image"
		| "moved-link"
		| "empty-summary"
		| "other-bucket"
		| "about-mismatch"
		| "tong-chi-draft"
		| "unsaved-image";
	id: string;
	message: string;
};
