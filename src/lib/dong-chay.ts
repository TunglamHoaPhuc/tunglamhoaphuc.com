// Danh sách Dòng chảy hoằng pháp, lọc, sắp xếp và cắt trang ở máy chủ: trình duyệt chỉ nhận 12 bài mỗi lần
// thay vì cả mấy trăm bài (trước đây trang nặng 2,6 MB HTML).
import type { HoangPhapArticle } from "@/data/dong-chay-hoang-phap-data";
import type { ContentRepository } from "@/lib/tlhp-content/types";
import type { V3Post } from "@/lib/v3-data";
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

export interface DongChayPage {
	items: HoangPhapArticle[];
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

export function toArticle(p: V3Post): HoangPhapArticle {
	return {
		id: p.id,
		slug: p.slug,
		title: p.title,
		subtitle: p.subtitle || "",
		date: p.publishedDate || "",
		author: p.author || "Ban Văn Hóa Tùng Lâm",
		category: p.subCategory || "cong-tu",
		subCategory: p.subtitle || p.categoryName || "Dòng Chảy Hoằng Pháp",
		subCategoryIcon: "",
		templeLogo: "tung-lam-hoa-phuc",
		templeName: "Tùng Lâm Hòa Phúc",
		views: p.viewsCount || 0,
		thumbnailUrl: p.thumbnailUrl || FALLBACK_IMAGE,
		thumbnailPosition: p.thumbnailPosition || "center center",
		bannerUrl: p.bannerUrl || FALLBACK_IMAGE,
		summary: p.summary && !p.summary.includes("Tóm tắt") ? shortSummary(p.summary) : "",
	};
}

/** Chỉ các bài đang hiển thị ở D1. Không có bài thì danh sách trống: không còn bộ bài đóng gói để thay vào. */
export async function allArticles(repo?: ContentRepository): Promise<HoangPhapArticle[]> {
	return (await livePosts(DONG_CHAY_SECTION, repo)).map(toArticle);
}

const time = (d: string) => (d ? new Date(d).getTime() || 0 : 0);

function compare(sort: DongChaySort) {
	switch (sort) {
		case "oldest":
			return (a: HoangPhapArticle, b: HoangPhapArticle) => time(a.date) - time(b.date);
		case "a-z":
			return (a: HoangPhapArticle, b: HoangPhapArticle) => a.title.localeCompare(b.title, "vi");
		case "z-a":
			return (a: HoangPhapArticle, b: HoangPhapArticle) => b.title.localeCompare(a.title, "vi");
		default:
			return (a: HoangPhapArticle, b: HoangPhapArticle) => time(b.date) - time(a.date);
	}
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
	const filtered = category === "all" ? all : all.filter((a) => (a.category || "cong-tu") === category);
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
 * Bài "Tìm hiểu thêm" của một bài: cùng chuyên mục, trùng từ khóa hoặc trùng từ trong tiêu đề lên trước.
 * Chỉ chọn trong các bài đang hiển thị, không bao giờ chọn chính nó.
 */
export function relatedArticles(current: Pick<V3Post, "id" | "slug" | "title" | "subCategory" | "keywords">, all: HoangPhapArticle[], limit = 12) {
	const category = (current.subCategory || "").toLowerCase();
	const keywords = (current.keywords || []).map((k) => (k.keyword || "").toLowerCase()).filter(Boolean);
	const words = (current.title || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
	const score = (a: HoangPhapArticle) => {
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
