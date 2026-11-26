// What /tim-kiem looks in: every page the site serves, as title, a line of text and its
// address. Made from the repository once per Worker and kept, like the repository's data (the finished index is kept, never one
// still being made: see `lazy` in content/repository.ts).
import { calendarHref } from "@/libs/calendar";
import type { ContentRepository, PostSummary } from "@/libs/content/types";
import { LIVE_SECTIONS } from "@/libs/home";
import { postHref } from "@/libs/postList";
import { type SearchItem, searchItem } from "@/libs/search";
import { tongChiHref } from "@/libs/tongChiGroups";
import { areaHref, templeAreas } from "@/libs/vuTru";

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
		index = await buildIndex(repo);
	} catch (error) {
		console.error("searchIndex: đọc lỗi", error);
		throw error;
	}
	if (!indexes.has(repo)) indexes.set(repo, index);
	return indexes.get(repo) ?? index;
}

async function allPosts(repo: ContentRepository): Promise<PostSummary[]> {
	const query = { section: LIVE_SECTIONS, pageSize: 60 };
	const first = await repo.listPosts(query);
	const rest = await Promise.all(Array.from({ length: first.pageCount - 1 }, (_, index) => repo.listPosts({ ...query, page: index + 2 })));
	return [first, ...rest].flatMap((page) => page.items);
}

const line = (...parts: string[]) => parts.filter(Boolean).join(" · ");

async function buildIndex(repo: ContentRepository): Promise<SearchItem[]> {
	const [posts, tongChi, topics, areas, statues, schedule] = await Promise.all([
		allPosts(repo),
		repo.listTongChi(),
		repo.listAboutTopics(),
		repo.listAreas(),
		repo.listStatues(),
		repo.getSchedule(),
	]);
	return [
		...posts.map((post) =>
			searchItem({ section: post.section, title: post.title, text: post.summary, href: postHref(post), date: post.publishedDate }),
		),
		...tongChi.map((article) =>
			searchItem({ section: "tong-chi-tu-hoc", title: article.name, text: line(article.group.name, article.excerpt), href: tongChiHref(article.slug), date: "" }),
		),
		...topics.map((topic) =>
			searchItem({ section: "gioi-thieu", title: topic.title, text: topic.subtitle || topic.overview, href: `/gioi-thieu/${topic.slug}`, date: "" }),
		),
		...templeAreas(areas).map((area) =>
			searchItem({ section: "vu-tru-phat-giao", title: area.name, text: line(area.subtitle, area.intro), href: areaHref(area.slug), date: "" }),
		),
		...statues.map((statue) =>
			searchItem({ section: "bao-tuong-phat-giao", title: statue.name, text: line(statue.subtitle, statue.code), href: statue.href, date: "" }),
		),
		// The month is always on the address (no "today" here), and the card's own anchor.
		...schedule.events.map((event) =>
			searchItem({
				section: "lich-tu-hoc",
				title: event.title,
				text: event.subtitle || event.description,
				href: calendarHref({ month: event.start.slice(0, 7), type: "" }, "", `#su-kien-${event.slug}`),
				date: event.start,
			}),
		),
	];
}
