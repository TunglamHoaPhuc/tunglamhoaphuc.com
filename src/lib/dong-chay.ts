// Danh sách Dòng chảy hoằng pháp, lọc, sắp xếp và cắt trang ở máy chủ: trình duyệt chỉ nhận 12 bài mỗi lần
// thay vì cả mấy trăm bài (trước đây trang nặng 2,6 MB HTML).
import { HOANG_PHAP_ARTICLES, type HoangPhapArticle } from "@/data/dong-chay-hoang-phap-data";
import { allPostRecords, type V3Post } from "@/lib/v3-data";

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

function toArticle(p: V3Post): HoangPhapArticle {
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

/** Bỏ phần nội dung dài của bộ dữ liệu dự phòng: danh sách chỉ cần tóm tắt. */
function lightFallback(a: HoangPhapArticle): HoangPhapArticle {
	const { contentHtml: _html, imageCaptions: _captions, videoBlock: _video, ...rest } = a as HoangPhapArticle & Record<string, unknown>;
	return { ...(rest as HoangPhapArticle), summary: shortSummary(a.summary || "") };
}

async function allArticles(): Promise<HoangPhapArticle[]> {
	const posts = await allPostRecords("dong-chay-hoang-phap");
	return posts.length > 0 ? posts.map(toArticle) : HOANG_PHAP_ARTICLES.map(lightFallback);
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

export async function dongChayPage(query: DongChayQuery): Promise<DongChayPage> {
	const { category, sort, page } = normalizeQuery(query);
	const all = await allArticles();
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
