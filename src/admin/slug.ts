/** A Vietnamese text as a URL-safe slug: no accents, đ as d, lower case, dashes between words, at most `max` characters. */
export function slugify(text: string, max = 80): string {
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
