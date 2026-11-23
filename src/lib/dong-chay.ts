// Danh sách Dòng chảy hoằng pháp, lọc, sắp xếp và cắt trang ở máy chủ: trình duyệt chỉ nhận 12 bài mỗi lần
// thay vì cả mấy trăm bài (trước đây trang nặng 2,6 MB HTML).
import type { HoangPhapArticle } from "@/data/dong-chay-hoang-phap-data";
import type { ContentRepository } from "@/lib/tlhp-content/types";
import { chosenRelatedCards, type V3Post } from "@/lib/v3-data";
import { livePosts } from "@/lib/v3-live";

export const DONG_CHAY_SECTION = "dong-chay-hoang-phap";

export const DONG_CHAY_PAGE_SIZE = 12;
export const DONG_CHAY_SORTS = ["newest", "oldest", "a-z", "z-a"] as const;
export type DongChaySort = (typeof DONG_CHAY_SORTS)[number];

export interface DongChayQuery {
	category?: string;
	sort?: string;
	page?: number;
}

/** A card of the list; `pinned` is the editors' pin (pinned posts come first when sorted by date or title, as on www). */
export type DongChayArticle = HoangPhapArticle & { pinned?: boolean };

export interface DongChayPage {
	items: DongChayArticle[];
	total: number;
	page: number;
	pageCount: number;
	category: string;
	sort: DongChaySort;
}

const FALLBACK_IMAGE = "/images/toan-canh-chua.jpg";

function shortSummary(text: string): string {
	return text.length > 200 ? `${text.slice(0, 200).trimEnd()}…` : text;
}

export function toArticle(p: V3Post): DongChayArticle {
	return {
		id: p.id,
		slug: p.slug,
		title: p.title,
		subtitle: p.subtitle || "",
		date: p.publishedDate || "",
		// As on www: a post with no author shows none, one with no category has none (nothing is made up).
		author: p.author || "",
		category: p.subCategory || "",
		subCategory: p.subtitle || p.categoryName || "Dòng Chảy Hoằng Pháp",
		subCategoryIcon: "",
		templeLogo: "tung-lam-hoa-phuc",
		templeName: "Tùng Lâm Hòa Phúc",
		views: p.viewsCount || 0,
		thumbnailUrl: p.thumbnailUrl || FALLBACK_IMAGE,
		thumbnailPosition: p.thumbnailPosition || "center center",
		bannerUrl: p.bannerUrl || FALLBACK_IMAGE,
		summary: p.summary && !p.summary.includes("Tóm tắt") ? shortSummary(p.summary) : "",
		pinned: p.pinned === true,
	};
}

/** Chỉ các bài đang hiển thị ở D1. Không có bài thì danh sách trống: không còn bộ bài đóng gói để thay vào. */
export async function allArticles(repo?: ContentRepository): Promise<DongChayArticle[]> {
	return (await livePosts(DONG_CHAY_SECTION, repo)).map(toArticle);
}

// The same order as www (queryPosts in its content repository): by date or title with the same collation, and the
// editors' pinned posts first in every order here (V3 has no "most read" order, which www leaves unpinned).
const collator = new Intl.Collator("vi", { sensitivity: "base", numeric: true });

const byDate = (a: DongChayArticle, b: DongChayArticle) => b.date.localeCompare(a.date) || collator.compare(a.title, b.title);

const ORDERS: Record<DongChaySort, (a: DongChayArticle, b: DongChayArticle) => number> = {
	newest: byDate,
	oldest: (a, b) => a.date.localeCompare(b.date) || collator.compare(a.title, b.title),
	"a-z": (a, b) => collator.compare(a.title, b.title) || b.date.localeCompare(a.date),
	"z-a": (a, b) => collator.compare(b.title, a.title) || b.date.localeCompare(a.date),
};

export function compare(sort: DongChaySort) {
	const by = ORDERS[sort] ?? byDate;
	return (a: DongChayArticle, b: DongChayArticle) => Number(b.pinned === true) - Number(a.pinned === true) || by(a, b);
}

export function normalizeQuery(q: DongChayQuery): Required<DongChayQuery> & { sort: DongChaySort } {
	const sort = (DONG_CHAY_SORTS as readonly string[]).includes(q.sort ?? "") ? (q.sort as DongChaySort) : "newest";
	const category = q.category && q.category !== "moi-nhat" ? q.category : "all";
	const page = Number.isFinite(q.page) && (q.page as number) >= 1 ? Math.floor(q.page as number) : 1;
	return { category, sort, page };
}

export async function dongChayPage(query: DongChayQuery, repo?: ContentRepository): Promise<DongChayPage> {
	const { category, sort, page } = normalizeQuery(query);
	const all = await allArticles(repo);
	const filtered = category === "all" ? all : all.filter((a) => a.category === category);
	const sorted = [...filtered].sort(compare(sort));
	const pageCount = Math.max(1, Math.ceil(sorted.length / DONG_CHAY_PAGE_SIZE));
	const current = Math.min(page, pageCount);
	const start = (current - 1) * DONG_CHAY_PAGE_SIZE;
	return {
		items: sorted.slice(start, start + DONG_CHAY_PAGE_SIZE),
		total: sorted.length,
		page: current,
		pageCount,
		category,
		sort,
	};
}

/**
 * Bài "Tìm hiểu thêm" của một bài: như www, ưu tiên các bài người biên tập đã chọn (`related`, theo thứ tự họ chọn, tối đa 3,
 * không bao giờ là chính nó). Chưa chọn bài nào thì đoán: cùng chuyên mục, trùng từ khóa hoặc trùng từ trong tiêu đề lên trước.
 * Phần đoán chỉ chọn trong các bài đang hiển thị, không bao giờ chọn chính nó.
 */
export function relatedArticles(current: Pick<V3Post, "id" | "slug" | "title" | "subCategory" | "keywords"> & Partial<Pick<V3Post, "related">>, all: DongChayArticle[], limit = 12) {
	const chosen = chosenRelatedCards(current, FALLBACK_IMAGE, "DÒNG CHẢY HOẰNG PHÁP");
	if (chosen.length) return chosen;
	const category = (current.subCategory || "").toLowerCase();
	const keywords = (current.keywords || []).map((k) => (k.keyword || "").toLowerCase()).filter(Boolean);
	const words = (current.title || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
	const score = (a: DongChayArticle) => {
		const title = (a.title || "").toLowerCase();
		return (a.category && a.category.toLowerCase() === category ? 3 : 0) + (keywords.some((kw) => title.includes(kw)) ? 2 : 0) + (words.some((w) => title.includes(w)) ? 1 : 0);
	};
	return all
		.filter((a) => a.id !== current.id && a.slug !== current.slug)
		.map((a, index) => ({ a, index, score: score(a) }))
		.sort((x, y) => y.score - x.score || x.index - y.index)
		.slice(0, limit)
		.map(({ a }) => ({
			category: a.subCategory || a.category || "DÒNG CHẢY HOẰNG PHÁP",
			title: a.title,
			url: a.thumbnailUrl,
			link: `/dong-chay-hoang-phap/${a.slug}`,
		}));
}
