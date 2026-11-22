// The one door pages use to read content: `await getContentRepository()`. Filtering,
// sorting and paging happen here on the server, so a list page sends 12 posts, not 472.
import { type StatueEntry, statueArticle, statueSummary } from "./baoTuong";
import type { CacheLike } from "./sources/b2";
import type { D1Like } from "./sources/d1";
import type { FileLoaders } from "./sources/files";
import { type TongChiEntry, tongChiArticle, tongChiSummary } from "./tongChi";
import type { AboutTopic, Area, CategoryCount, ContentRepository, GalleryImage, Page, Post, PostQuery, PostSort, PostSummary, Schedule, Statue, StatueSummary, TongChiArticle } from "./types";

export const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 60;

const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

const compareBy: Record<PostSort, (a: PostSummary, b: PostSummary) => number> = {
	newest: (a, b) => b.publishedDate.localeCompare(a.publishedDate) || collator.compare(a.title, b.title),
	oldest: (a, b) => a.publishedDate.localeCompare(b.publishedDate) || collator.compare(a.title, b.title),
	az: (a, b) => collator.compare(a.title, b.title) || b.publishedDate.localeCompare(a.publishedDate),
	za: (a, b) => collator.compare(b.title, a.title) || b.publishedDate.localeCompare(a.publishedDate),
	views: (a, b) => b.views - a.views || b.publishedDate.localeCompare(a.publishedDate),
};

/** Pinned posts first in the lists ordered by date or title; a ranking by views is left as it is. */
const compare = (sort: PostSort): ((a: PostSummary, b: PostSummary) => number) => {
	const by = compareBy[sort] ?? compareBy.newest;
	return sort === "views" ? by : (a, b) => Number(b.pinned) - Number(a.pinned) || by(a, b);
};

function toSummary(post: Post): PostSummary {
	const { id, slug, title, subtitle, section, category, author, publishedDate, views, thumbnail, banner, summary, galleryCount, pinned } = post;
	return { id, slug, title, subtitle, section, category, author, publishedDate, views, thumbnail, banner, summary, galleryCount, pinned };
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

type PostIndex = { bySlug: Map<string, Post>; bySectionSlug: Map<string, Post>; summaries: PostSummary[] };

/** A post's place in an index: slugs are unique per section. */
export const sectionSlugKey = (section: string, slug: string): string => `${section}/${slugKey(slug)}`;

/** The posts of a query, from the summaries of all posts: what every source answers a list page with. */
export function queryPosts(summaries: PostSummary[], { section, category, sort = "newest", page = 1, pageSize = DEFAULT_PAGE_SIZE }: PostQuery = {}): Page<PostSummary> {
	const size = Math.min(Math.max(Math.trunc(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
	const sections = section === undefined ? null : [section].flat();
	const matching = summaries
		.filter((post) => (!sections || sections.includes(post.section)) && (!category || post.category.slug === category))
		.sort(compare(sort));
	const pageCount = Math.max(1, Math.ceil(matching.length / size));
	const current = Math.max(1, Math.trunc(page) || 1);
	return {
		items: matching.slice((current - 1) * size, current * size),
		total: matching.length,
		page: current,
		pageSize: size,
		pageCount,
	};
}

/** The categories of a section with their post counts, the biggest first. */
export function countCategories(summaries: PostSummary[], section: string): CategoryCount[] {
	const counts = new Map<string, CategoryCount>();
	for (const post of summaries) {
		if (post.section !== section || !post.category.slug) continue;
		const entry = counts.get(post.category.slug) ?? { ...post.category, count: 0 };
		entry.count++;
		counts.set(post.category.slug, entry);
	}
	return [...counts.values()].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
}

/** `load`'s value, read on first use and kept; a failed read is tried again on the next use. */
export function lazy<T>(load: () => Promise<T>): () => Promise<T> {
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
		return {
			bySlug: new Map(list.map((post) => [slugKey(post.slug), post])),
			bySectionSlug: new Map(list.map((post) => [sectionSlugKey(post.section, post.slug), post])),
			summaries: list.map(toSummary),
		};
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
		async listPosts(query = {}): Promise<Page<PostSummary>> {
			return queryPosts((await postIndex()).summaries, query);
		},

		async getPostBySlug(slug, section) {
			const index = await postIndex();
			const post = section === undefined ? index.bySlug.get(slugKey(slug)) : index.bySectionSlug.get(sectionSlugKey(section, slug));
			if (!post || post.gallery.length) return post ?? null;
			const gallery = (await albums()).get(post.id);
			return gallery?.length ? { ...post, gallery } : post;
		},

		async listCategories(section) {
			return countCategories((await postIndex()).summaries, section);
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

/**
 * Counts the writes the admin has made in this Worker instance. What the site reads is kept for a while (see `renewing`); a write makes
 * the next read in the same instance start from the database again, so the person who saved sees it without waiting for the time to run
 * out. Other instances (and the pages cached at the edge) still follow their own clocks.
 */
let contentEpoch = 0;
export const bumpContentEpoch = (): number => ++contentEpoch;
export const currentContentEpoch = (): number => contentEpoch;

/** A value made again once `ttl` ms have passed since it was made, or an admin write has happened since (`epoch`). */
export function renewing<T>(make: () => T, ttl: number, now: () => number = Date.now, epoch: () => number = currentContentEpoch): () => T {
	let current: { value: T; until: number; epoch: number } | undefined;
	return () => {
		if (!current || now() >= current.until || current.epoch !== epoch()) current = { value: make(), until: now() + ttl, epoch: epoch() };
		return current.value;
	};
}

/** How often a Worker reading B2 starts a fresh repository (each file is asked about as often, sources/b2.ts). */
const B2_RENEW_MS = 60_000;

/** A repository over the old admin's files, however they are read. */
export function repositoryFromFiles(loaders: FileLoaders): ContentRepository {
	return createMemoryRepository(loaders.posts, {
		loadAlbums: loaders.albums,
		loadSchedule: loaders.schedule,
		loadAbout: loaders.about,
		loadTongChi: loaders.tongChi,
		loadAreas: loaders.areas,
		loadStatues: loaders.statues,
	});
}

/** `make()`, kept; a failed one is made again on the next call rather than kept forever. */
function once<T>(make: () => Promise<T>): () => Promise<T> {
	let value: Promise<T> | undefined;
	return () =>
		(value ??= make().catch((error: unknown) => {
			value = undefined;
			throw error;
		}));
}

/** How often a Worker reading D1 starts a fresh repository, until saving in the admin refreshes the pages that changed (T24, tags). */
const D1_RENEW_MS = 60_000;

const d1Repositories = once(async () => {
	const [{ createD1Repository }, workers] = await Promise.all([import("./sources/d1"), (import("cloudflare:workers" as string) as Promise<{ env?: { DB?: D1Like } }>).catch(() => ({}) as { env?: { DB?: D1Like } }),
	]);
	const db = workers.env?.DB;
	if (!db) throw new Error('Nguồn "d1" thiếu binding DB (cloudflare.config.ts)');
	return renewing(() => createD1Repository(db), D1_RENEW_MS);
});

const snapshotRepository = once(async () => {
	const [{ readSnapshot }, { createFileLoaders }] = await Promise.all([import("./sources/snapshot"), import("./sources/files")]);
	return repositoryFromFiles(createFileLoaders(readSnapshot));
});

const b2Repositories = once(async () => {
	const [{ b2Config, createB2Reader }, { createFileLoaders }] = await Promise.all([import("./sources/b2"), import("./sources/files")]);
	const cache = (globalThis as { caches?: { default?: CacheLike } }).caches?.default;
	const loaders = createFileLoaders(createB2Reader(b2Config(process.env), { cache }));
	return renewing(() => repositoryFromFiles(loaders), B2_RENEW_MS);
});

/**
 * The repository for this server instance. The snapshot never changes, so it is built once.
 * From B2 a fresh one is made every minute on the same loaders, which turn a file into
 * content again only when B2 says it has changed.
 */
export async function getContentRepository(): Promise<ContentRepository> {
	const source = contentSource();
	if (source === "b2") return (await b2Repositories())();
	if (source === "d1") return (await d1Repositories())();
	return snapshotRepository();
}
