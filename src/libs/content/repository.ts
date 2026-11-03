// The one door pages use to read content: `await getContentRepository()`. Filtering,
// sorting and paging happen here on the server, so a list page sends 12 posts, not 472.
import type { CategoryCount, ContentRepository, GalleryImage, Page, Post, PostSort, PostSummary } from "./types";

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
};

/** A repository over posts already in memory (the snapshot today, B2 at launch). */
export function createMemoryRepository(posts: Post[], { loadAlbums }: MemoryRepositoryOptions = {}): ContentRepository {
	const bySlug = new Map(posts.map((post) => [slugKey(post.slug), post]));
	const summaries = posts.map(toSummary);
	let albums: Promise<Map<string, GalleryImage[]>> | undefined;

	return {
		async listPosts({ section, category, sort = "newest", page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}): Promise<Page<PostSummary>> {
			const size = Math.min(Math.max(Math.trunc(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
			const sections = section === undefined ? null : [section].flat();
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
			const post = bySlug.get(slugKey(slug));
			if (!post || post.gallery.length || !loadAlbums) return post ?? null;
			albums ??= loadAlbums();
			const gallery = (await albums).get(post.id);
			return gallery?.length ? { ...post, gallery } : post;
		},

		async listCategories(section) {
			const counts = new Map<string, CategoryCount>();
			for (const post of summaries) {
				if (post.section !== section || !post.category.slug) continue;
				const entry = counts.get(post.category.slug) ?? { ...post.category, count: 0 };
				entry.count++;
				counts.set(post.category.slug, entry);
			}
			return [...counts.values()].sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
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
		const { loadSnapshotAlbums, loadSnapshotPosts } = await import("./sources/snapshot");
		return createMemoryRepository((await loadSnapshotPosts()).posts, { loadAlbums: loadSnapshotAlbums });
	})().catch((error) => {
		// Try again on the next request rather than keep a failed load forever.
		repository = undefined;
		throw error;
	});
	return repository;
}
