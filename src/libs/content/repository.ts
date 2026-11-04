// The one door pages use to read content: `await getContentRepository()`. Filtering,
// sorting and paging happen here on the server, so a list page sends 12 posts, not 472.
import { type StatueEntry, statueArticle, statueSummary } from "./baoTuong";
import { type TongChiEntry, tongChiArticle, tongChiSummary } from "./tongChi";
import type { AboutTopic, Area, CategoryCount, ContentRepository, GalleryImage, Page, Post, PostSort, PostSummary, Schedule, Statue, StatueSummary, TongChiArticle } from "./types";

export const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 60;

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

const compare: Record<PostSort, (a: PostSummary, b: PostSummary) => number> = {
	newest: (a, b) => b.publishedDate.localeCompare(a.publishedDate) || collator.compare(a.title, b.title),
	oldest: (a, b) => a.publishedDate.localeCompare(b.publishedDate) || collator.compare(a.title, b.title),
	az: (a, b) => collator.compare(a.title, b.title) || b.publishedDate.localeCompare(a.publishedDate),
	za: (a, b) => collator.compare(b.title, a.title) || b.publishedDate.localeCompare(a.publishedDate),
	views: (a, b) => b.views - a.views || b.publishedDate.localeCompare(a.publishedDate),
};

function toSummary(post: Post): PostSummary {
	const { id, slug, title, subtitle, section, category, author, publishedDate, views, thumbnail, banner, summary, galleryCount } = post;
	return { id, slug, title, subtitle, section, category, author, publishedDate, views, thumbnail, banner, summary, galleryCount };
}

/** Slugs arrive decoded from the URL; a few are stored percent-encoded (emoji). Compare both decoded. */
export function slugKey(slug: string): string {
	try {
		return decodeURIComponent(slug).normalize("NFC");
	} catch {
		return slug.normalize("NFC");
	}
}

export type MemoryRepositoryOptions = {
	/** Albums kept apart from the posts (by post id), loaded the first time a post page needs one. */
	loadAlbums?: () => Promise<Map<string, GalleryImage[]>>;
	/** The schedule, loaded the first time a page asks for it. */
	loadSchedule?: () => Promise<Schedule>;
	/** Giới thiệu, loaded the first time a page asks for it. */
	loadAbout?: () => Promise<AboutTopic[]>;
	/** Tông Chỉ Tu Học, loaded the first time a page asks for it. */
	loadTongChi?: () => Promise<TongChiEntry[]>;
	/** Vũ Trụ Phật Giáo's areas, loaded the first time a page asks for them. */
	loadAreas?: () => Promise<Area[]>;
	/** Bảo Tượng's statues, loaded the first time a page asks for them. */
	loadStatues?: () => Promise<StatueEntry[]>;
};

const EMPTY_SCHEDULE: Schedule = { events: [], programs: [], themes: [], quotes: [] };

type PostIndex = { bySlug: Map<string, Post>; summaries: PostSummary[] };

/** `load`'s value, read on first use and kept; a failed read is tried again on the next use. */
function lazy<T>(load: () => Promise<T>): () => Promise<T> {
	let value: Promise<T> | undefined;
	return () =>
		(value ??= load().catch((error: unknown) => {
			value = undefined;
			throw error;
		}));
}

const none = async () => [];

/**
 * A repository over content in memory (the snapshot today, B2 at launch). The posts are given
 * as they are, or as a loader read the first time a page asks about posts: reading all 632
 * of them costs a cold Worker about 100 ms of CPU, which pages without posts should not pay.
 */
export function createMemoryRepository(
	posts: Post[] | (() => Promise<Post[]>),
	{ loadAlbums, loadSchedule, loadAbout, loadTongChi, loadAreas, loadStatues }: MemoryRepositoryOptions = {},
): ContentRepository {
	const postIndex = lazy(async (): Promise<PostIndex> => {
		const list = typeof posts === "function" ? await posts() : posts;
		return { bySlug: new Map(list.map((post) => [slugKey(post.slug), post])), summaries: list.map(toSummary) };
	});
	const albums = lazy(loadAlbums ?? (async () => new Map<string, GalleryImage[]>()));
	const schedule = lazy(loadSchedule ?? (async () => EMPTY_SCHEDULE));
	const about = lazy<AboutTopic[]>(loadAbout ?? none);
	const tongChiEntries = lazy<TongChiEntry[]>(loadTongChi ?? none);
	const areas = lazy<Area[]>(loadAreas ?? none);
	const statues = lazy<StatueEntry[]>(loadStatues ?? none);
	// Bodies are turned into HTML one page at a time, once each.
	const tongChiPages = new Map<string, TongChiArticle>();
	const statuePages = new Map<string, Statue>();

	return {
		async listPosts({ section, category, sort = "newest", page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}): Promise<Page<PostSummary>> {
			const size = Math.min(Math.max(Math.trunc(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
			const sections = section === undefined ? null : [section].flat();
			const { summaries } = await postIndex();
			const matching = summaries
				.filter((post) => (!sections || sections.includes(post.section)) && (!category || post.category.slug === category))
				.sort(compare[sort] ?? compare.newest);
			const pageCount = Math.max(1, Math.ceil(matching.length / size));
			const current = Math.max(1, Math.trunc(page) || 1);
			return {
				items: matching.slice((current - 1) * size, current * size),
				total: matching.length,
				page: current,
				pageSize: size,
				pageCount,
			};
		},

		async getPostBySlug(slug) {
			const post = (await postIndex()).bySlug.get(slugKey(slug));
			if (!post || post.gallery.length) return post ?? null;
			const gallery = (await albums()).get(post.id);
			return gallery?.length ? { ...post, gallery } : post;
		},

		async listCategories(section) {
			const counts = new Map<string, CategoryCount>();
			for (const post of (await postIndex()).summaries) {
				if (post.section !== section || !post.category.slug) continue;
				const entry = counts.get(post.category.slug) ?? { ...post.category, count: 0 };
				entry.count++;
				counts.set(post.category.slug, entry);
			}
			return [...counts.values()].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
		},

		getSchedule: schedule,

		listAboutTopics: about,

		async listTongChi() {
			return (await tongChiEntries()).map(tongChiSummary);
		},

		async getTongChi(slug) {
			const key = slugKey(slug);
			const cached = tongChiPages.get(key);
			if (cached) return cached;
			const entries = await tongChiEntries();
			const entry = entries.find((item) => slugKey(item.slug) === key);
			if (!entry) return null;
			const article = tongChiArticle(entry, entries);
			tongChiPages.set(key, article);
			return article;
		},

		listAreas: areas,

		async listStatues(): Promise<StatueSummary[]> {
			return (await statues()).map(statueSummary);
		},

		async getStatue(slug) {
			const key = slugKey(slug);
			const cached = statuePages.get(key);
			if (cached) return cached;
			const entry = (await statues()).find((item) => slugKey(item.slug) === key);
			if (!entry) return null;
			const statue = statueArticle(entry);
			statuePages.set(key, statue);
			return statue;
		},
	};
}

export type ContentSource = "snapshot" | "b2" | "d1";

/** CONTENT_SOURCE picks the source: `snapshot` (now), `b2` (launch, T19), `d1` (cutover). */
export function contentSource(value = process.env.CONTENT_SOURCE): ContentSource {
	if (!value || value === "snapshot") return "snapshot";
	if (value === "b2" || value === "d1") return value;
	throw new Error(`CONTENT_SOURCE không hợp lệ: "${value}" (snapshot | b2 | d1)`);
}

let repository: Promise<ContentRepository> | undefined;

/** The repository for this server instance, built once from the chosen source. */
export function getContentRepository(): Promise<ContentRepository> {
	repository ??= (async () => {
		const source = contentSource();
		if (source !== "snapshot") throw new Error(`Nguồn "${source}" chưa có (b2: T19, d1: chuyển hẳn).`);
		const { loadSnapshotAbout, loadSnapshotAlbums, loadSnapshotAreas, loadSnapshotPosts, loadSnapshotSchedule, loadSnapshotStatues, loadSnapshotTongChi } = await import(
			"./sources/snapshot"
		);
		return createMemoryRepository(async () => (await loadSnapshotPosts()).posts, {
			loadAlbums: loadSnapshotAlbums,
			loadSchedule: async () => (await loadSnapshotSchedule()).schedule,
			loadAbout: async () => (await loadSnapshotAbout()).topics,
			loadTongChi: async () => (await loadSnapshotTongChi()).entries,
			loadAreas: async () => (await loadSnapshotAreas()).areas,
			loadStatues: async () => (await loadSnapshotStatues()).statues,
		});
	})().catch((error) => {
		// Try again on the next request rather than keep a failed load forever.
		repository = undefined;
		throw error;
	});
	return repository;
}
