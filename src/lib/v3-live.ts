// What a V3 page may show: exactly what www's D1 holds as live (published, or scheduled with its time come; not in
// the trash; an area not hidden), and nothing else. A page asks here by slug; `null` means "no such live item" and the
// page answers 404 (notFound()). There is no bundled copy to fall back on for these kinds: if D1 cannot be read the
// error goes up to the page's error boundary rather than showing something stale.
//
// Every function takes the repository as its last argument so a test can hand it a fixture.
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { ContentRepository } from "@/lib/tlhp-content/types";
import { findScheduleDetail, type ScheduleDetail } from "@/lib/schedule-detail";
import { toAboutRecord, toAreaRecord, toPostRecord, toScheduleData, toTongChiRecord, type V3About, type V3Area, type V3Post, type V3TongChi } from "@/lib/v3-data";

const open = (repo?: ContentRepository) => repo ?? getContentRepository();

/** Addresses the old site printed in links: they still lead to the article now kept under another slug. */
export const TONG_CHI_ALIASES: Record<string, string[]> = {
	"tiep-buoc-thay-toi": ["tong-phong-truyen-thua-truc-lam"],
	"tong-phong-truyen-thua-truc-lam": ["tiep-buoc-thay-toi"],
};

const decode = (slug: string) => {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
};

// ── Tông Chỉ Tu Học ─────────────────────────────────────────────────────────

/** One live article with its body, or `null`. */
export async function liveTongChi(slug: string, repo?: ContentRepository): Promise<V3TongChi | null> {
	const r = await open(repo);
	const key = decode(slug);
	for (const candidate of [key, ...(TONG_CHI_ALIASES[key] ?? [])]) {
		const article = await r.getTongChi(candidate);
		if (article) return toTongChiRecord(article);
	}
	return null;
}

/** The live articles as list records (no body), group by group in the editors' order. */
export async function liveTongChiList(repo?: ContentRepository): Promise<V3TongChi[]> {
	const r = await open(repo);
	return (await r.listTongChi()).map((a, i) => toTongChiRecord(a, i));
}

/** The cards of "Tìm hiểu thêm": the same group first, then the others, never the article itself. */
export function relatedTongChi(current: Pick<V3TongChi, "id" | "slug" | "category">, all: V3TongChi[], limit = 8) {
	const others = all.filter((a) => a.slug !== current.slug && String(a.id) !== String(current.id));
	return [...others.filter((a) => a.category === current.category), ...others.filter((a) => a.category !== current.category)]
		.slice(0, limit)
		.map((a) => ({
			category: (a.categoryName || a.category || "").toUpperCase(),
			title: a.title,
			url: a.bannerImage || "/images/toan-canh-chua.jpg",
			link: `/tong-chi-tu-hoc/${a.slug}`,
		}));
}

// ── Posts (Dòng chảy hoằng pháp, Trí tuệ Phật pháp) ─────────────────────────

/** Every live post of a section as a summary (no body), newest first. */
async function summariesOf(r: ContentRepository, section: string) {
	const first = await r.listPosts({ section, pageSize: 60, page: 1 });
	const items = [...first.items];
	for (let p = 2; p <= first.pageCount; p++) items.push(...(await r.listPosts({ section, pageSize: 60, page: p })).items);
	return items;
}

/** One live post of `section` (a post of another section is not found here), or `null`. */
export async function livePost(slugOrId: string, section: string, repo?: ContentRepository): Promise<V3Post | null> {
	const r = await open(repo);
	const key = decode(slugOrId);
	const post = await r.getPostBySlug(key);
	if (post) return post.section === section ? toPostRecord(post) : null;
	// V3 sometimes links by id ("post-1060"): only a live post of this section can be found that way.
	const hit = (await summariesOf(r, section)).find((p) => p.id === key || p.id === `post-${key}`);
	const full = hit && (await r.getPostBySlug(hit.slug));
	return full && full.section === section ? toPostRecord(full) : null;
}

/** Every live post of a section as list records, newest first. */
export async function livePosts(section: string, repo?: ContentRepository): Promise<V3Post[]> {
	return (await summariesOf(await open(repo), section)).map(toPostRecord);
}

// ── Giới thiệu ──────────────────────────────────────────────────────────────

/** The live topics of Giới thiệu in the editors' order. */
export async function liveAbout(repo?: ContentRepository): Promise<V3About[]> {
	return (await (await open(repo)).listAboutTopics()).map(toAboutRecord);
}

/**
 * One live topic by its slug alone, or `null`. Never by id or by position: the pages used to also match an id
 * (`gt-02`, `gt-05`) and so showed another topic's text under su-phu-tru-tri and van-hoa-ung-xu.
 */
export async function liveAboutTopic(slug: string, repo?: ContentRepository): Promise<V3About | null> {
	const key = decode(slug);
	return (await liveAbout(repo)).find((topic) => topic.slug === key) ?? null;
}

// ── Vũ Trụ Phật Giáo ────────────────────────────────────────────────────────

/** Addresses the old site printed in links → the slug of the area in D1. They open only when that area is visible. */
export const AREA_ALIASES: Record<string, string> = {
	"bao-thap": "bao-thap-van-phat-xa-loi",
	"bao-tang-phat-giao": "bao-tang",
	"thu-vien": "tang-kinh-cac",
	"tu-an-duong": "tu-an",
	"vang-sinh-duong": "tu-an",
	"khong-gian-tam-linh": "lang-xa-tam-linh",
	"dinh-lang": "lang-xa-tam-linh",
	"lau-kinh-luan": "ho-phong-sinh",
	"kinh-luan": "ho-phong-sinh",
	"san-di-lac": "cong-tam-quan",
	"tam-quan": "cong-tam-quan",
	"nha-mau": "dai-nam-quoc-mau",
	"quoc-mau": "dai-nam-quoc-mau",
	"lam-ty-ni": "san-di-da",
	"san-dan-sinh": "san-di-da",
	"chay-duong": "trai-duong",
};

/** The visible areas in the editors' order. */
export async function liveAreas(repo?: ContentRepository): Promise<V3Area[]> {
	return (await (await open(repo)).listAreas()).map(toAreaRecord);
}

/** One visible area by slug (or by an old address), or `null`: a hidden or deleted area is not there. */
export async function liveArea(slug: string, repo?: ContentRepository): Promise<V3Area | null> {
	const key = decode(slug).toLowerCase().trim();
	const areas = await liveAreas(repo);
	const wanted = [key, AREA_ALIASES[key]].filter(Boolean);
	for (const candidate of wanted) {
		const hit = areas.find((area) => area.slug.toLowerCase() === candidate);
		if (hit) return hit;
	}
	return null;
}

// ── Lịch tu học ─────────────────────────────────────────────────────────────

/** The live event or regular ceremony this slug names, or `null`: no page is made from the slug's words. */
export async function liveScheduleDetail(slug: string, repo?: ContentRepository): Promise<ScheduleDetail | null> {
	return findScheduleDetail(decode(slug), toScheduleData(await (await open(repo)).getSchedule()));
}
