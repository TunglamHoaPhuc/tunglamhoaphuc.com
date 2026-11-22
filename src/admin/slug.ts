/** The longest slug the editor accepts when one is typed or made from a title (the old site's own slugs may be longer: they are kept as they are). */
export const SLUG_MAX = 80;

/** A Vietnamese text as a URL-safe slug: no accents, đ as d, lower case, dashes between words, at most `max` characters. */
export function slugify(text: string, max = SLUG_MAX): string {
	const plain = text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return plain.slice(0, max).replace(/-+$/g, "");
}
