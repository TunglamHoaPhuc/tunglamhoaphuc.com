// Những trang công khai mà sitemap.xml liệt kê, cùng tập địa chỉ với sitemap của www (src/libs/seo.ts `sitemapEntries`) trừ:
//   - /lich-tu-hoc: V3 chuyển hướng về trang chủ (src/app/(public)/lich-tu-hoc/page.tsx), nên không được nằm trong sitemap. Có trang
//     danh sách thật thì thêm lại vào FIXED_PATHS;
//   - địa chỉ đã chuyển hướng cố định (MOVED_PATHS): ghi địa chỉ mới (Tông Chỉ "tiep-buoc-thay-toi").
// Không có /tim-kiem (noindex), /tra-cuu-bai-vi và /kiem-tra-anh (trang nội bộ), /bao-tuong (chuyển hướng).
// `/lien-he` do việc khác thêm trang; liệt kê ở đây như www.
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { ContentRepository } from "@/lib/tlhp-content/types";
import { canonicalPath } from "@/lib/site-url";
import { toSlug } from "@/lib/schedule-detail";

export const DONG_CHAY_PATH = "/dong-chay-hoang-phap";
export const TRI_TUE_PATH = "/tri-tue-phat-phap";
/** Cuốn sách đọc song ngữ duy nhất nằm trong sitemap của www (V3 còn bốn cuốn khác nhưng www không có). */
export const BOOK_PATH = "/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi";

/** Các trang không có dữ liệu phía sau: danh sách các chuyên mục và trang tĩnh. */
export const FIXED_PATHS = [
	"/",
	"/gioi-thieu",
	"/tong-chi-tu-hoc",
	DONG_CHAY_PATH,
	"/vu-tru-phat-giao",
	"/bao-tuong-phat-giao",
	TRI_TUE_PATH,
	BOOK_PATH,
	"/tri-tue-phat-phap/hoc-tieng-tang",
	"/lien-he",
] as const;

export type SitemapEntry = { path: string; lastModified?: string };

const SECTIONS = [
	{ slug: "dong-chay-hoang-phap", path: DONG_CHAY_PATH },
	{ slug: "tri-tue-phat-phap", path: TRI_TUE_PATH },
];

/** Mọi trang công khai: các trang cố định, rồi từng bài, chủ đề, khu vực, tượng, sự kiện và khóa lễ. Mỗi địa chỉ một lần. */
export async function sitemapEntries(repository?: ContentRepository): Promise<SitemapEntry[]> {
	const repo = repository ?? (await getContentRepository());
	const entries: SitemapEntry[] = FIXED_PATHS.map((path) => ({ path }));

	for (const section of SECTIONS) {
		for (let page = 1; ; page++) {
			const result = await repo.listPosts({ section: section.slug, sort: "newest", page, pageSize: 60 });
			for (const post of result.items) entries.push({ path: `${section.path}/${post.slug}`, lastModified: post.publishedDate.slice(0, 10) });
			if (page >= result.pageCount) break;
		}
	}
	for (const topic of await repo.listAboutTopics()) entries.push({ path: `/gioi-thieu/${topic.slug}` });
	for (const article of await repo.listTongChi()) entries.push({ path: `/tong-chi-tu-hoc/${article.slug}` });
	for (const area of await repo.listAreas()) entries.push({ path: `/vu-tru-phat-giao/${area.slug}` });
	for (const statue of await repo.listStatues()) entries.push({ path: statue.href });
	// Mỗi sự kiện và khóa lễ định kỳ có trang riêng (/lich-tu-hoc/<slug>), chỉ vào được bằng liên kết.
	const schedule = await repo.getSchedule();
	for (const event of schedule.events) if (!event.programId) entries.push({ path: `/lich-tu-hoc/${event.slug}` });
	for (const program of schedule.programs) entries.push({ path: `/lich-tu-hoc/${toSlug(program.title)}` });

	// Địa chỉ đã chuyển thì ghi địa chỉ mới; mỗi địa chỉ một lần, theo thứ tự gặp.
	const seen = new Set<string>();
	return entries
		.map((entry) => ({ ...entry, path: canonicalPath(entry.path) }))
		.filter(({ path }) => (seen.has(path) ? false : (seen.add(path), true)));
}
