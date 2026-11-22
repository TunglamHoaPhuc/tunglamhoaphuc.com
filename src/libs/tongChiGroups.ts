// Tông Chỉ Tu Học's articles put in their five groups, with each group's line
// from the site's words (config/tongChi.ts), for the home block and /tong-chi-tu-hoc.
import type { Metadata } from "next";
import { site } from "@/config/site";
import { tongChi } from "@/config/tongChi";
import type { TongChiArticle, TongChiSummary } from "@/libs/content/types";

/** The page's metadata: the SEO title, description and share picture the editors saved, else the name, excerpt and banner. */
export function tongChiArticleMetadata(article: TongChiArticle): Metadata {
	const name = article.seoTitle || article.name;
	const description = article.seoDescription || article.excerpt || article.subtitle;
	const image = article.ogImage ?? article.banner;
	return {
		title: `${name} – ${tongChi.title} – ${site.name}`,
		description,
		openGraph: { title: name, description, images: image ? [image.src] : undefined },
	};
}

export type TongChiGroup = { slug: string; name: string; line: string; articles: TongChiSummary[] };

/** The groups in the order they first appear, each with its articles in the editors' order. */
export function groupTongChi(articles: TongChiSummary[]): TongChiGroup[] {
	const groups = new Map<string, TongChiGroup>();
	for (const article of articles) {
		const words = tongChi.groups[article.group.slug];
		const group = groups.get(article.group.slug) ?? {
			slug: article.group.slug,
			name: article.group.name,
			line: words?.line ?? "",
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
