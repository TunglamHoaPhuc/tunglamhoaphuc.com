// zod schemas for the old admin's JSON (spec 3.1b). Lenient on purpose: optional fields
// fall back to empty values, so one odd record never stops the site; a record missing what
// a page cannot do without (id, slug, section, date) is reported and skipped.
import { z } from "zod";

const text = z.string().catch("");
const required = z.string().trim().min(1);

const keywordSchema = z.object({
	keyword: text,
	title: text,
	description: text,
});

const galleryImageSchema = z.object({
	imageUrl: text,
	title: text,
	caption: text,
	isInline: z.boolean().optional(),
});

export const rawPostSchema = z.object({
	id: z.union([z.string(), z.number()]).transform(String).pipe(required),
	slug: required,
	// A few WordPress posts have none; posts.ts then takes the first line of the text.
	title: text,
	subtitle: text,
	mainCategory: required,
	subCategory: text,
	categoryName: text,
	author: text,
	publishedDate: required,
	status: text.default("published"),
	viewsCount: z.coerce.number().int().nonnegative().catch(0),
	thumbnailUrl: text,
	bannerUrl: text,
	thumbnailPosition: text,
	bannerPosition: text,
	summary: text,
	content: text,
	keywords: z.array(keywordSchema).catch([]),
	galleryCount: z.number().optional().catch(undefined),
	photoGallery: z.array(galleryImageSchema).catch([]),
});

export type RawPost = z.infer<typeof rawPostSchema>;

/**
 * The posts file as the admin API serves it (`{ success, total, posts }`), as a bare list,
 * or as `{ posts }`. Records stay unchecked here so each one can fail on its own.
 */
export const postsFileSchema = z.union([
	z.array(z.unknown()),
	z.object({ posts: z.array(z.unknown()) }).transform((file) => file.posts),
]);
