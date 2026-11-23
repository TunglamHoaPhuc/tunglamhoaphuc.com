// The old admin's Tông Chỉ Tu Học file (`{ success, data }`, 25 articles in five groups)
// → TongChiSummary and TongChiArticle. Lenient like about.ts: an article without a slug or
// title is reported and left out, the rest falls back to empty values. The bodies are
// turned into HTML only when a page asks for one (tongChiBody.ts says why they need work).
import { parseSafe, serialize } from "../../admin/content/html";
import { z } from "zod";
import { cleanPosition, isUnsavedUpload, mediaUrl } from "./media";
import { bare, cleanText, renderContent, toIsoDate } from "./normalize";
import { videosOf } from "./posts";
import { type BodyTarget, tongChiMarkdown } from "./tongChiBody";
import type { ContentIssue, GalleryImage, Keyword, MediaImage, TongChiArticle, TongChiSummary } from "./types";
import { titleCase } from "../format";
import { liveHref } from "../livePaths";

const text = z.string().catch("");

const rawArticleSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String),
	slug: z.string().trim().min(1),
	title: z.string().trim().min(1),
	subtitle: text,
	category: text,
	categoryName: text,
	bannerImage: text,
	bannerPosition: text,
	excerpt: text,
	content: text,
	author: text,
	authorLink: text,
	publishedAt: text,
	status: text.default("published"),
	viewsCount: z.coerce.number().catch(0),
	videoBlock: z.object({ title: text, description: text, videoUrl: text }).nullish().catch(null),
	featuredArticle: z.object({ label: text, title: text, author: text, linkUrl: text }).nullish().catch(null),
	photoGallery: z.array(z.object({ title: text, imageUrl: text, khuVuc: text, noiDung: text })).catch([]),
	sourceBook: z.object({ bookTitle: text, author: text, coverImage: text, description: text, linkUrl: text }).nullish().catch(null),
	keywords: z.array(z.object({ keyword: text, title: text, description: text })).catch([]),
});

const tongChiFileSchema = z.union([
	z.array(z.unknown()),
	z.object({ data: z.array(z.unknown()) }).transform((file) => file.data),
]);

/** An article as read, its body still the editors' text. */
export type TongChiEntry = Omit<TongChiArticle, "contentHtml"> & { body: string; /** HTML the admin's editor saved; when present the page shows it instead of converting `body`. */ html?: string };

export type ParsedTongChi = { entries: TongChiEntry[]; issues: ContentIssue[] };

const plain = (value: string) => cleanText(value).replace(/\s+/g, " ").trim();

export function parseTongChi(file: unknown): ParsedTongChi {
	const issues: ContentIssue[] = [];
	const unsaved = (id: string, url: string) => issues.push({ kind: "unsaved-image", id, message: url });
	const picture = (id: string, url: string): string | null => {
		if (!isUnsavedUpload(url)) return mediaUrl(url);
		unsaved(id, url);
		return null;
	};
	const entries: TongChiEntry[] = [];

	for (const raw of tongChiFileSchema.safeParse(file).data ?? []) {
		const result = rawArticleSchema.safeParse(raw);
		if (!result.success) {
			issues.push({ kind: "invalid", id: String((raw as { id?: unknown })?.id ?? "?"), message: result.error.issues[0]?.message ?? "bài không đọc được" });
			continue;
		}
		const article = result.data;
		if (article.status !== "published") continue;
		const id = article.slug;
		const bannerSrc = picture(id, article.bannerImage);
		const banner: MediaImage | null = bannerSrc ? { src: bannerSrc, position: cleanPosition(article.bannerPosition) } : null;
		const video = article.videoBlock ? videosOf(article.videoBlock.videoUrl)[0] : undefined;
		const gallery: GalleryImage[] = article.photoGallery.flatMap((photo) => {
			const src = picture(id, photo.imageUrl);
			return src ? [{ src, title: plain(photo.title), caption: [photo.khuVuc, photo.noiDung].map(plain).filter(Boolean).join(" – ") }] : [];
		});
		const book = article.sourceBook?.bookTitle.trim() ? article.sourceBook : null;
		const featured = article.featuredArticle?.title.trim() ? article.featuredArticle : null;
		entries.push({
			id: article.id,
			slug: article.slug,
			title: titleCase(plain(article.title)),
			name: titleCase(plain(article.title)),
			subtitle: plain(article.subtitle),
			group: { slug: article.category.trim(), name: titleCase(plain(article.categoryName)) },
			banner,
			excerpt: plain(article.excerpt),
			author: plain(article.author),
			authorHref: liveHref(article.authorLink),
			publishedDate: toIsoDate(article.publishedAt) ?? "",
			views: article.viewsCount,
			video: video && article.videoBlock ? { ...video, title: plain(article.videoBlock.title), description: plain(article.videoBlock.description) } : null,
			featured: featured
				? { label: titleCase(plain(featured.label)), title: titleCase(plain(featured.title)), author: plain(featured.author), href: liveHref(featured.linkUrl) }
				: null,
			gallery,
			book: book
				? {
						title: plain(book.bookTitle),
						author: plain(book.author),
						cover: picture(id, book.coverImage),
						description: plain(book.description),
						href: liveHref(book.linkUrl),
					}
				: null,
			keywords: article.keywords
				.map((keyword): Keyword => ({ keyword: plain(keyword.keyword), title: plain(keyword.title), description: plain(keyword.description) }))
				.filter((keyword) => keyword.description && (keyword.title || keyword.keyword)),
			seoTitle: "",
			seoDescription: "",
			ogImage: null,
			body: article.content,
		});
	}

	// Articles that share a title are told apart by their subtitle: the four "Lộ Trình Tu Học"
	// (named like their group, by design) and the two "Tam Quy" (reported: one may be old).
	for (const entry of entries) {
		const twins = entries.filter((other) => bare(other.title) === bare(entry.title));
		if (twins.length < 2) continue;
		if (entry.subtitle) entry.name = `${entry.title}: ${entry.subtitle}`;
		if (bare(entry.title) !== bare(entry.group.name) && twins[0] === entry) {
			issues.push({ kind: "duplicate-title", id: entry.slug, message: `${twins.length} bài tên "${entry.title}": ${twins.map((twin) => twin.slug).join(", ")}` });
		}
	}

	// Group by group, in the order the groups first appear; articles keep the file's order.
	const groups = [...new Set(entries.map((entry) => entry.group.slug))];
	entries.sort((a, b) => groups.indexOf(a.group.slug) - groups.indexOf(b.group.slug));
	return { entries, issues };
}

export function tongChiSummary({ id, slug, title, name, subtitle, group, groupPosition, banner, excerpt }: TongChiEntry): TongChiSummary {
	return { id, slug, title, name, subtitle, group, ...(groupPosition === undefined ? {} : { groupPosition }), banner, excerpt };
}

/** The article with its body as safe HTML; `notes` collects what the body's conversion dropped. */
export function tongChiArticle(entry: TongChiEntry, entries: TongChiEntry[], notes: string[] = []): TongChiArticle {
	const targets: BodyTarget[] = entries.map((other) => ({ slug: other.slug, title: other.title, group: other.group.slug }));
	const { body, html, ...article } = entry;
	// HTML the admin saved is cleaned once more here, on the public side, before it is shown.
	if (html?.trim()) return { ...article, contentHtml: serialize(parseSafe(html)) };
	const { markdown, notes: dropped } = tongChiMarkdown(body, { title: entry.title, slug: entry.slug, targets });
	notes.push(...dropped);
	return { ...article, contentHtml: renderContent(markdown) };
}
