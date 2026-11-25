// "Dấu ấn hoằng pháp" on the home page: the posts and Tông Chỉ articles read most, by the view counts D1 holds (www counts them:
// `post.legacy_views` + `page_view`). One builder serves both the home page (server side, so the first paint already has the real
// numbers) and /api/public/dharma-featured, so the two cannot say different things.
import type { PostItem } from "@/types/post";
import { getDeletedPostsAsync } from "@/lib/deleted-posts";
import { allPostRecords, allTongChi, type V3Post, type V3TongChi } from "@/lib/v3-data";

export const DHARMA_FEATURED_COUNT = 5;

type Deleted = { id: string; wpPostId?: string | number; slug?: string };

export type DharmaFeatured = { featured: PostItem[]; tongChi: PostItem[]; dongChay: PostItem[]; triTue: PostItem[] };

const IMG_TONG_CHI = "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/02-tong-chi-tu-hoc/tong-chi-tu-hoc-hub-banner.webp";
const IMG_DONG_CHAY = "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp";
const IMG_TRI_TUE = "/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp";

/** "2026-11-03" or "2026/11/03 10:00" → "03/11/2026"; anything else as it is. */
export function formatDate(rawDate?: string): string {
	if (!rawDate) return "";
	if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) return rawDate;
	const m = rawDate.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
	if (m) {
		const [, y, mo, d] = m;
		return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${y}`;
	}
	return rawDate;
}

const byViews = (a: PostItem, b: PostItem) => (Number(b.viewsCount) || 0) - (Number(a.viewsCount) || 0);

/** The tiles, most read first, from the records V3 pages are written for (lib/v3-data.ts). Pure. */
export function buildDharmaFeatured(allPosts: V3Post[], tongChiList: V3TongChi[], deletedList: Deleted[] = []): DharmaFeatured {
	const deletedSet = new Set(deletedList.map((d) => d.id));
	const deletedWpIds = new Set(deletedList.filter((d) => d.wpPostId).map((d) => String(d.wpPostId)));
	const deletedSlugs = new Set(deletedList.filter((d) => d.slug).map((d) => d.slug));
	const validPosts = allPosts.filter((p) => !deletedSet.has(p.id) && !deletedWpIds.has(String((p as { wpPostId?: unknown }).wpPostId)) && !deletedSlugs.has(p.slug));

	const tongChi = tongChiList
		.map(
			(item): PostItem => ({
				id: `tc-${item.id}`,
				imageUrl: item.bannerImage || IMG_TONG_CHI,
				category1: "Tông Chỉ Tu Học",
				category2: item.categoryName || "NỀN TẢNG TU HỌC",
				category1Url: "/tong-chi-tu-hoc",
				category1IconUrl: "/images/icons/icon-tong-chi-tu-hoc-256.webp",
				title: item.title,
				subtitle: item.subtitle || item.categoryName || "Tông Chỉ Tu Học",
				description: item.excerpt || item.subtitle || "Hệ thống tông chỉ tu học kế thừa tông phong chư Tổ Tùng Lâm Hòa Phúc.",
				publishedDate: formatDate(item.publishedAt),
				viewsCount: Number(item.viewsCount) || 0,
				targetUrl: `/tong-chi-tu-hoc/${item.slug}`,
				thumbnailPosition: item.bannerPosition || "center 20%",
				imagePosition: item.bannerPosition || "center 20%",
			}),
		)
		.sort(byViews);

	const dongChay = validPosts
		.filter((p) => p.mainCategory === "dong-chay-hoang-phap")
		.map(
			(p): PostItem => ({
				id: p.id,
				imageUrl: p.thumbnailUrl || p.bannerUrl || IMG_DONG_CHAY,
				category1: "Dòng Chảy Hoằng Pháp",
				category2: p.categoryName || p.subCategory || "HOẰNG PHÁP ĐỘ SINH",
				category1Url: "/dong-chay-hoang-phap",
				category1IconUrl: "/images/icons/icon-dong-chay-hoang-phap-128.webp",
				title: p.title,
				subtitle: p.subtitle || p.categoryName || p.subCategory || "Dòng Chảy Hoằng Pháp",
				description: p.summary || p.subtitle || "Hành trình lan tỏa chánh pháp, các sự kiện pháp hội và Phật sự trọng đại.",
				publishedDate: formatDate(p.publishedDate),
				viewsCount: Number(p.viewsCount) || 0,
				targetUrl: `/dong-chay-hoang-phap/${p.slug || p.id}`,
				thumbnailPosition: p.thumbnailPosition || p.bannerPosition || "center 20%",
				imagePosition: p.thumbnailPosition || p.bannerPosition || "center 20%",
			}),
		)
		.sort(byViews);

	const triTue = validPosts
		.filter((p) => p.mainCategory === "tri-tue-phat-phap")
		.map((p): PostItem => {
			const isPhapAm = [p.title, p.categoryName, p.subCategory].some((text) => (text || "").toLowerCase().includes("pháp âm"));
			return {
				id: p.id,
				imageUrl: p.thumbnailUrl || p.bannerUrl || IMG_TRI_TUE,
				category1: "Trí Tuệ Phật Pháp",
				category2: p.categoryName || p.subCategory || "PHÁP ÂM & KHAI THỊ",
				category1Url: "/tri-tue-phat-phap",
				category1IconUrl: isPhapAm ? "/images/icons/icon-phap-am-128.webp" : "/images/icons/icon-tri-tue-phat-phap-128.webp",
				title: p.title,
				subtitle: p.subtitle || p.categoryName || p.subCategory || "Trí Tuệ Phật Pháp",
				description: p.summary || p.subtitle || "Kho tàng giáo lý Phật đà, pháp âm giảng giải và các tác phẩm Phật học sâu sắc.",
				publishedDate: formatDate(p.publishedDate),
				viewsCount: Number(p.viewsCount) || 0,
				targetUrl: `/tri-tue-phat-phap/${p.slug || p.id}`,
				thumbnailPosition: p.thumbnailPosition || p.bannerPosition || "center 20%",
				imagePosition: p.thumbnailPosition || p.bannerPosition || "center 20%",
			};
		})
		.sort(byViews);

	const featured = [...tongChi, ...dongChay, ...triTue].sort(byViews).slice(0, 6);
	return { featured, tongChi: tongChi.slice(0, 6), dongChay: dongChay.slice(0, 6), triTue: triTue.slice(0, 6) };
}

/** Reads the records and builds the tiles. Throws when D1 cannot be read: the caller decides what to show instead. */
export async function loadDharmaFeatured(): Promise<DharmaFeatured> {
	const [allPosts, tongChiList, deletedList] = await Promise.all([allPostRecords(), allTongChi(), getDeletedPostsAsync()]);
	return buildDharmaFeatured(allPosts, tongChiList, deletedList);
}

/**
 * The tiles the home page opens with: the five most read (the view counts are D1's), or `null` when there is nothing to show
 * (D1 could not be read, or it holds no post), where the section keeps its own tiles.
 */
export function dharmaTilesFrom(data: DharmaFeatured | null): PostItem[] | null {
	const tiles = (data?.featured ?? []).slice(0, DHARMA_FEATURED_COUNT);
	return tiles.length ? tiles : null;
}
