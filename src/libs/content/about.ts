// The old admin's Giới thiệu file (`{ success, total, topics }`) → AboutTopic. Lenient like
// posts.ts: a topic without a slug or title is reported and left out, the rest falls back
// to empty values. Also checks that each topic's text is about what its title says: once
// /gioi-thieu/su-phu-tru-tri carried Thích Tâm Hòa's title over Đại sư Liên Đăng's life.
import { z } from "zod";
import { mediaUrl } from "./media";
import { bare, cleanText, renderContent } from "./normalize";
import type { AboutTopic, ContentIssue, GalleryImage, MediaImage, Milestone } from "./types";

const text = z.string().catch("");

const milestoneSchema = z.object({ year: text, title: text, description: text });

/** The milestones' JSON text, or nothing when the editors' text is not valid JSON. */
function parseList(value: string): unknown {
	try {
		return value.trim() ? JSON.parse(value) : [];
	} catch {
		return [];
	}
}

const rawTopicSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String),
	slug: z.string().trim().min(1),
	title: z.string().trim().min(1),
	subtitle: text,
	tag: text,
	groupCategory: text,
	groupCategoryName: text,
	heroBanner: text,
	heroBannerPosition: text,
	portraitImage: text,
	portraitImagePosition: text,
	overviewSummary: text,
	quoteTitle: text,
	quoteContent: z.union([z.array(text), text.transform((value) => value.split("\n"))]).catch([]),
	quoteAuthor: text,
	// Stored as a JSON string in most topics, as an array in one.
	milestones: z
		.union([z.array(z.unknown()), z.string().transform(parseList)])
		.catch([])
		.transform((items) => (Array.isArray(items) ? items : []).flatMap((item) => milestoneSchema.safeParse(item).data ?? [])),
	content: text,
	galleryImages: z.array(z.object({ url: text, caption: text })).catch([]),
	status: text.default("published"),
	orderIndex: z.coerce.number().catch(0),
	sourceBook: z
		.object({ bookTitle: text, author: text, coverImage: text, description: text })
		.nullish()
		.catch(null),
});

const aboutFileSchema = z.union([
	z.array(z.unknown()),
	z.object({ topics: z.array(z.unknown()) }).transform((file) => file.topics),
]);

const plain = (value: string) => cleanText(value).replace(/\s+/g, " ").trim();

function image(url: string, position: string): MediaImage | null {
	const src = mediaUrl(url);
	return src ? { src, position: position.trim() || "center 50%" } : null;
}

/** Who or what a topic is about: the last two words of its title ("… Thích Tâm Hòa" → "tam hoa"). */
const subjectOf = (title: string) => bare(title).split(" ").slice(-2).join(" ");

// How much of the text has to name the subject.
const OPENING = 600;

export type ParsedAbout = { topics: AboutTopic[]; issues: ContentIssue[] };

export function parseAbout(file: unknown): ParsedAbout {
	const issues: ContentIssue[] = [];
	const records = aboutFileSchema.safeParse(file).data ?? [];
	const topics: AboutTopic[] = [];
	const contents = new Map<string, string>();
	const orders = new Map<string, number>();

	for (const raw of records) {
		const result = rawTopicSchema.safeParse(raw);
		if (!result.success) {
			issues.push({ kind: "invalid", id: String((raw as { id?: unknown })?.id ?? "?"), message: result.error.issues[0]?.message ?? "chủ đề không đọc được" });
			continue;
		}
		const topic = result.data;
		if (topic.status !== "published") continue;
		const gallery: GalleryImage[] = topic.galleryImages.flatMap((photo) => {
			const src = mediaUrl(photo.url);
			return src ? [{ src, title: "", caption: plain(photo.caption) }] : [];
		});
		const lines = topic.quoteContent.map(plain).filter(Boolean);
		const book = topic.sourceBook?.bookTitle
			? {
					title: plain(topic.sourceBook.bookTitle),
					author: plain(topic.sourceBook.author),
					cover: mediaUrl(topic.sourceBook.coverImage),
					description: plain(topic.sourceBook.description),
				}
			: null;
		topics.push({
			id: topic.id,
			slug: topic.slug,
			title: plain(topic.title),
			subtitle: plain(topic.subtitle),
			tag: plain(topic.tag),
			group: { slug: topic.groupCategory.trim(), name: plain(topic.groupCategoryName) },
			banner: image(topic.heroBanner, topic.heroBannerPosition),
			portrait: image(topic.portraitImage, topic.portraitImagePosition),
			overview: plain(topic.overviewSummary),
			quote: lines.length ? { title: plain(topic.quoteTitle), lines, author: plain(topic.quoteAuthor) } : null,
			milestones: topic.milestones
				.map((item): Milestone => ({ label: plain(item.year), title: plain(item.title), description: plain(item.description) }))
				.filter((item) => item.title || item.description),
			contentHtml: renderContent(topic.content),
			gallery,
			book,
		});
		contents.set(topic.id, bare(`${topic.overviewSummary} ${cleanText(topic.content)}`));
		orders.set(topic.id, topic.orderIndex);
	}
	topics.sort((a, b) => (orders.get(a.id) ?? 0) - (orders.get(b.id) ?? 0));

	for (const topic of topics) {
		const subject = subjectOf(topic.title);
		const opening = (contents.get(topic.id) ?? "").slice(0, OPENING);
		if (!subject || opening.includes(subject)) continue;
		const other = topics.find((item) => item !== topic && opening.includes(subjectOf(item.title)));
		issues.push({
			kind: "about-mismatch",
			id: topic.slug,
			message: other
				? `tiêu đề "${topic.title}", nhưng đầu nội dung nói về "${other.title}"`
				: `tiêu đề "${topic.title}", nhưng ${OPENING} chữ đầu của nội dung không nhắc tới`,
		});
	}
	return { topics, issues };
}
