// Tông Chỉ Tu Học's articles put in their five groups, with each group's line and icon
// from the site's words (config/tongChi.ts), for the home block and /tong-chi-tu-hoc.
import { tongChi } from "@/config/tongChi";
import type { TongChiSummary } from "@/libs/content/types";

export type TongChiGroup = { slug: string; name: string; line: string; icon: string; articles: TongChiSummary[] };

/** The groups in the order they first appear, each with its articles in the editors' order. */
export function groupTongChi(articles: TongChiSummary[]): TongChiGroup[] {
	const groups = new Map<string, TongChiGroup>();
	for (const article of articles) {
		const words = tongChi.groups[article.group.slug];
		const group = groups.get(article.group.slug) ?? {
			slug: article.group.slug,
			name: article.group.name,
			line: words?.line ?? "",
			icon: words?.icon ?? "tji-service-1",
			articles: [],
		};
		group.articles.push(article);
		groups.set(group.slug, group);
	}
	return [...groups.values()];
}

/**
 * How an article is named inside its group: by its subtitle where its title is the group's
 * ("Dành cho người trẻ" among the Lộ Trình Tu Học), else by its name.
 */
export function nameInGroup(article: TongChiSummary): string {
	return article.title.toLocaleLowerCase("vi") === article.group.name.toLocaleLowerCase("vi") && article.subtitle ? article.subtitle : article.name;
}

export const tongChiHref = (slug: string) => `${tongChi.path}/${slug}`;
