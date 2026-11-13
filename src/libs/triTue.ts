// Trí Tuệ Phật Pháp for its pages: the book's cover and description, and the Tibetan words
// set apart for screen readers and fonts.
import { book } from "@/config/triTue";
import { bare } from "@/libs/content/normalize";
import { getContentRepository } from "@/libs/content/repository";

export type BookDetails = { cover: string | null; description: string };

/** The book's cover and description, as the Giới thiệu topic of its author has them. */
export async function bookDetails(): Promise<BookDetails> {
	const topics = await (await getContentRepository()).listAboutTopics();
	const found = topics.map((topic) => topic.book).find((item) => item && bare(item.title) === bare(book.title));
	return { cover: found?.cover ?? null, description: found?.description ?? "" };
}

/** A text cut where the Tibetan script starts and stops: "Bài 2: 4 Nguyên Âm (དབྱངས་བཞི)". */
export function scriptRuns(text: string): { text: string; tibetan: boolean }[] {
	return text
		.split(/([ༀ-࿿][ༀ-࿿ ]*[ༀ-࿿]|[ༀ-࿿])/u)
		.filter(Boolean)
		.map((part) => ({ text: part, tibetan: /[ༀ-࿿]/u.test(part) }));
}
