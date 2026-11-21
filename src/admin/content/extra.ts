// Fields that belong to one category of posts (docs/admin-architecture.md 7.4), kept in `post.extra` and checked by
// the schema of the post's category (by the category's slug): Pháp Âm has its sound, Video Phật Pháp its YouTube
// video, Ấn phẩm & Sách its book. Any other category keeps no extra fields (what a former category left is dropped).
import { z } from "zod";
import { safeHref, safeMediaSrc } from "./html";

const plain = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`);
const mediaId = z.string().trim().max(120).nullable().optional();
const blankToUndefined = (value: unknown) => (typeof value === "string" && !value.trim() ? undefined : value);

/** A YouTube id, or the id read from a YouTube address. */
export function youtubeIdOf(value: string): string | null {
	const text = value.trim();
	if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
	const match = text.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
	return match ? match[1] : null;
}

export const EXTRA_SCHEMAS = {
	"phap-am": z.object({
		audioMediaId: mediaId,
		audioUrl: z.preprocess(blankToUndefined, z.string().max(500).refine((value) => safeMediaSrc(value) !== null, "Địa chỉ tệp âm thanh phải là https hoặc /anh-goc/….").optional()),
		duration: z.preprocess(blankToUndefined, z.string().trim().regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, "Thời lượng dạng mm:ss hoặc h:mm:ss.").optional()),
	}),
	video: z.object({
		youtubeId: z.preprocess(
			(value) => (typeof value === "string" ? (value.trim() ? (youtubeIdOf(value) ?? value) : undefined) : value),
			z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Nhập mã hoặc địa chỉ video YouTube hợp lệ.").optional(),
		),
	}),
	"an-pham-sach": z.object({
		book: z
			.object({
				title: plain(300).default(""),
				author: plain(200).default(""),
				coverMediaId: mediaId,
				link: z.preprocess(blankToUndefined, z.string().max(500).refine((value) => safeHref(value) !== null, "Liên kết phải là https hoặc đường dẫn trong trang.").optional()),
			})
			.optional(),
	}),
	"cong-tu": z.object({}),
} as const;

export type ExtraKey = keyof typeof EXTRA_SCHEMAS;
export const isExtraKey = (slug: string): slug is ExtraKey => slug in EXTRA_SCHEMAS;

/** The extra fields `value` holds for a post of the category `categorySlug`, or the errors by field. */
export function parseExtra(categorySlug: string, value: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; fields: Record<string, string> } {
	const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
	if (!isExtraKey(categorySlug)) return { ok: true, data: {} };
	const result = EXTRA_SCHEMAS[categorySlug].safeParse(input);
	if (result.success) return { ok: true, data: JSON.parse(JSON.stringify(result.data)) as Record<string, unknown> };
	const fields: Record<string, string> = {};
	for (const issue of result.error.issues) fields[`extra.${issue.path.join(".")}`] ??= issue.message;
	return { ok: false, fields };
}

/** The library pictures and sounds the extra fields point at, as `media_usage` rows. */
export function extraMediaUses(extra: Record<string, unknown>): { mediaId: string; field: string }[] {
	const uses: { mediaId: string; field: string }[] = [];
	if (typeof extra.audioMediaId === "string" && extra.audioMediaId) uses.push({ mediaId: extra.audioMediaId, field: "extra.audioMediaId" });
	const book = extra.book as { coverMediaId?: unknown } | undefined;
	if (book && typeof book.coverMediaId === "string" && book.coverMediaId) uses.push({ mediaId: book.coverMediaId, field: "extra.book.coverMediaId" });
	return uses;
}
