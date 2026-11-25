// Searching the site (/tim-kiem?q=&muc=&trang=): the sections searched, the query on the URL,
// and the matching. A title or text matches when it holds every word of the query as a whole
// word, marks or not ("niem phat" finds "niệm Phật", "co" does not find "Cộng"); titles that
// hold them come first.
import { bare } from "@/lib/tlhp-content/normalize";

export const SEARCH_PATH = "/tim-kiem";
export const SEARCH_PAGE_SIZE = 12;
/** Results of each section when every section is shown. */
export const SEARCH_GROUP_SIZE = 4;
const MAX_QUERY = 100;

export type SearchSection = { slug: string; name: string; href: string };

/** In the order of the menu. */
export const SEARCH_SECTIONS: SearchSection[] = [
	{ slug: "dong-chay-hoang-phap", name: "Dòng Chảy Hoằng Pháp", href: "/dong-chay-hoang-phap" },
	{ slug: "tong-chi-tu-hoc", name: "Tông Chỉ Tu Học", href: "/tong-chi-tu-hoc" },
	{ slug: "tri-tue-phat-phap", name: "Trí Tuệ Phật Pháp", href: "/tri-tue-phat-phap" },
	{ slug: "gioi-thieu", name: "Giới thiệu", href: "/gioi-thieu" },
	{ slug: "vu-tru-phat-giao", name: "Vũ Trụ Phật Giáo", href: "/vu-tru-phat-giao" },
	{ slug: "bao-tuong-phat-giao", name: "Bảo Tượng Phật Giáo", href: "/bao-tuong-phat-giao" },
	{ slug: "lich-tu-hoc", name: "Lịch tu học", href: "/lich-tu-hoc" },
];

export type SearchItem = {
	section: string;
	title: string;
	/** A line under the title: the summary, the second name… */
	text: string;
	href: string;
	/** YYYY-MM-DD, or "" when the thing has no date. */
	date: string;
	/** The title and the text without marks, between spaces, for matching whole words. */
	bareTitle: string;
	bareText: string;
};

export function searchItem(fields: Omit<SearchItem, "bareTitle" | "bareText">): SearchItem {
	return { ...fields, bareTitle: ` ${bare(fields.title)} `, bareText: ` ${bare(fields.text)} ` };
}

export type SearchQuery = {
	q: string;
	/** A section's slug, or "" for every section. */
	section: string;
	/** 1-based, within the section. */
	page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
	return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Unknown sections and odd pages fall back to every section and page 1. */
export function readSearchQuery(params: SearchParams): SearchQuery {
	const section = first(params.muc).trim();
	const page = Number.parseInt(first(params.trang), 10);
	return {
		q: first(params.q).replace(/\s+/g, " ").trim().slice(0, MAX_QUERY),
		section: SEARCH_SECTIONS.some((item) => item.slug === section) ? section : "",
		page: Number.isFinite(page) && page > 1 ? page : 1,
	};
}

export function searchHref(query: SearchQuery): string {
	const params = new URLSearchParams();
	if (query.q) params.set("q", query.q);
	if (query.section) params.set("muc", query.section);
	if (query.page > 1) params.set("trang", String(query.page));
	const text = params.toString();
	return text ? `${SEARCH_PATH}?${text}` : SEARCH_PATH;
}

/**
 * Every item holding all the query's words: first a title that is the query, then titles
 * holding the whole query, then titles holding all its words; newest first among equals.
 */
export function searchItems(items: SearchItem[], q: string): SearchItem[] {
	const words = bare(q)
		.split(" ")
		.filter(Boolean)
		.map((word) => ` ${word} `);
	if (!words.length) return [];
	const phrase = ` ${bare(q)} `;
	const scored = items.flatMap((item) => {
		const all = `${item.bareTitle}${item.bareText}`;
		if (!words.every((word) => all.includes(word))) return [];
		const score = item.bareTitle === phrase ? 3 : item.bareTitle.includes(phrase) ? 2 : words.every((word) => item.bareTitle.includes(word)) ? 1 : 0;
		return [{ item, score }];
	});
	return scored.sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date)).map(({ item }) => item);
}

export type SearchGroup = { section: SearchSection; items: SearchItem[] };

/** The results by section, in the order of SEARCH_SECTIONS, leaving out sections without any. */
export function groupResults(results: SearchItem[]): SearchGroup[] {
	return SEARCH_SECTIONS.map((section) => ({ section, items: results.filter((item) => item.section === section.slug) })).filter((group) => group.items.length);
}
