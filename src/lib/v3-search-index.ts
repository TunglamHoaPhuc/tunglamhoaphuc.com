// What /tim-kiem looks in: every page V3 serves from the content repository, as a title, a line of text and its address.
// It is www's index (src/libs/searchIndex.ts) with the addresses of V3's pages: the same sections, the same fields in the same
// order, so a query ranks the same on both. Differences, on purpose: an event of the schedule links to its own page
// (/lich-tu-hoc/<slug>, which V3 has) instead of an anchor on the month's list, and a day made from a regular ceremony is not
// indexed (it has no page of its own; www lists it among the events).
// Made from the repository once per Worker and kept, like the repository's data (the finished index is kept, never one still being
// made: a request must not await a promise another request started).
import type { ContentRepository, PostSummary } from "@/lib/tlhp-content/types";
import { MAP_PINS } from "@/lib/v3-areas";
import { type SearchItem, searchItem } from "@/lib/v3-search";

/** The sections that have posts of their own (www src/libs/home.ts LIVE_SECTIONS). */
export const SEARCH_POST_SECTIONS = ["dong-chay-hoang-phap", "tri-tue-phat-phap"];

/** The temple whose areas are on the map of Vũ Trụ Phật Giáo. */
const TEMPLE = "tung-lam-hoa-phuc";

const indexes = new WeakMap<ContentRepository, SearchItem[]>();

/**
 * The index of this repository's content, made on the first search; made again after a failure. Only a finished index is kept: while
 * one is being made, a search that arrives makes its own rather than awaiting the first search's (another request's) promise.
 */
export async function searchIndex(repo: ContentRepository): Promise<SearchItem[]> {
	const kept = indexes.get(repo);
	if (kept) return kept;
	let index: SearchItem[];
	try {
		index = await buildSearchIndex(repo);
	} catch (error) {
		console.error("searchIndex: đọc lỗi", error);
		throw error;
	}
	if (!indexes.has(repo)) indexes.set(repo, index);
	return indexes.get(repo) ?? index;
}

async function allPosts(repo: ContentRepository): Promise<PostSummary[]> {
	const query = { section: SEARCH_POST_SECTIONS, pageSize: 60 };
	const first = await repo.listPosts(query);
	const rest = await Promise.all(Array.from({ length: first.pageCount - 1 }, (_, index) => repo.listPosts({ ...query, page: index + 2 })));
	return [first, ...rest].flatMap((page) => page.items);
}

const line = (...parts: string[]) => parts.filter(Boolean).join(" · ");

/** The areas of the temple in the order of the map's walk, then the ones the map does not know yet in the editors' order (www templeAreas). */
function templeAreas<T extends { slug: string; temple: string }>(areas: T[]): T[] {
	const order = MAP_PINS.map((pin) => pin.slug);
	const rank = (area: T) => {
		const at = order.indexOf(area.slug);
		return at < 0 ? order.length : at;
	};
	return areas
		.filter((area) => area.temple === TEMPLE)
		.map((area, index) => ({ area, index }))
		.sort((a, b) => rank(a.area) - rank(b.area) || a.index - b.index)
		.map(({ area }) => area);
}

/** The index of what the repository holds now (the function a test calls with a fixture; pages use `searchIndex`). */
export async function buildSearchIndex(repo: ContentRepository): Promise<SearchItem[]> {
	const [posts, tongChi, topics, areas, statues, schedule] = await Promise.all([
		allPosts(repo),
		repo.listTongChi(),
		repo.listAboutTopics(),
		repo.listAreas(),
		repo.listStatues(),
		repo.getSchedule(),
	]);
	return [
		...posts.map((post) => searchItem({ section: post.section, title: post.title, text: post.summary, href: `/${post.section}/${post.slug}`, date: post.publishedDate })),
		...tongChi.map((article) => searchItem({ section: "tong-chi-tu-hoc", title: article.name, text: line(article.group.name, article.excerpt), href: `/tong-chi-tu-hoc/${article.slug}`, date: "" })),
		...topics.map((topic) => searchItem({ section: "gioi-thieu", title: topic.title, text: topic.subtitle || topic.overview, href: `/gioi-thieu/${topic.slug}`, date: "" })),
		...templeAreas(areas).map((area) => searchItem({ section: "vu-tru-phat-giao", title: area.name, text: line(area.subtitle, area.intro), href: `/vu-tru-phat-giao/${area.slug}`, date: "" })),
		...statues.map((statue) => searchItem({ section: "bao-tuong-phat-giao", title: statue.name, text: line(statue.subtitle, statue.code), href: statue.href, date: "" })),
		...schedule.events.filter((event) => !event.programId).map((event) => searchItem({ section: "lich-tu-hoc", title: event.title, text: event.subtitle || event.description, href: `/lich-tu-hoc/${event.slug}`, date: event.start })),
	];
}
