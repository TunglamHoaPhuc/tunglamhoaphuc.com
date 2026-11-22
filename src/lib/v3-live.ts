// What a V3 page may show: exactly what www's D1 holds as live (published, or scheduled with its time come; not in
// the trash; an area not hidden), and nothing else. A page asks here by slug; `null` means "no such live item" and the
// page answers 404 (notFound()). There is no bundled copy to fall back on for these kinds: if D1 cannot be read the
// error goes up to the page's error boundary rather than showing something stale.
//
// Every function takes the repository as its last argument so a test can hand it a fixture.
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { ContentRepository } from "@/lib/tlhp-content/types";
import { toTongChiRecord, type V3TongChi } from "@/lib/v3-data";

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
