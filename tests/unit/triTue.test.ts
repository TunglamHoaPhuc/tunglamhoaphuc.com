import { describe, expect, it } from "vitest";
import { book, bookText, tibetan } from "@/config/triTue";
import { chapterAnchor, scriptRuns, textBlocks } from "@/libs/triTue";

describe("Tibetan runs", () => {
	it("sets the Tibetan words apart from the Vietnamese around them", () => {
		expect(scriptRuns("Bài 2: 4 Nguyên Âm & Cách Đọc (དབྱངས་བཞི)")).toEqual([
			{ text: "Bài 2: 4 Nguyên Âm & Cách Đọc (", tibetan: false },
			{ text: "དབྱངས་བཞི", tibetan: true },
			{ text: ")", tibetan: false },
		]);
	});

	it("keeps a phrase of several Tibetan words in one run, and Latin between runs apart", () => {
		expect(scriptRuns("Tiền Tự (སྔོན་འཇུག - ག ད བ མ འ)").map((run) => [run.text, run.tibetan])).toEqual([
			["Tiền Tự (", false],
			["སྔོན་འཇུག", true],
			[" - ", false],
			["ག ད བ མ འ", true],
			[")", false],
		]);
	});

	it("gives a text that is all Tibetan as one run, with no empty pieces around it", () => {
		expect(scriptRuns("ཀ་གཞས")).toEqual([{ text: "ཀ་གཞས", tibetan: true }]);
	});

	it("leaves a text without Tibetan whole", () => {
		expect(scriptRuns("Bài 12: Đánh Vần Từ Ghép Phức Hợp")).toEqual([{ text: "Bài 12: Đánh Vần Từ Ghép Phức Hợp", tibetan: false }]);
	});

	it("lists the 24 lessons of Sara Book after its opening, over its 120 pages", () => {
		expect(tibetan.contents).toHaveLength(25);
		expect(tibetan.contents.filter((entry) => entry.title.startsWith("Bài "))).toHaveLength(24);
		expect(tibetan.contents.at(-1)!.pages).toBe(`110–${tibetan.pages}`);
	});
});

describe("the book's text (T17b)", () => {
	it("keeps the seven parts of the old reader, 29 pieces, none empty", () => {
		expect(bookText.chapters.map((chapter) => chapter.title)).toEqual(book.contents.map((entry) => entry.title));
		expect(bookText.chapters.flatMap((chapter) => chapter.sections)).toHaveLength(29);
		for (const chapter of bookText.chapters) for (const section of chapter.sections) expect(section.content.trim(), section.title).not.toBe("");
	});

	it("cuts a text into paragraphs at blank lines and keeps the lines of a verse", () => {
		expect(textBlocks("Con sinh ra\nGia cảnh nghèo\n\nQuanh nhà con\n\n\n• Năm 2010")).toEqual([["Con sinh ra", "Gia cảnh nghèo"], ["Quanh nhà con"], ["• Năm 2010"]]);
		expect(textBlocks("  \n\n ")).toEqual([]);
	});

	it("names each part by an anchor the contents link to", () => {
		expect(bookText.chapters.map((_, index) => chapterAnchor(index))).toEqual(["phan-1", "phan-2", "phan-3", "phan-4", "phan-5", "phan-6", "phan-7"]);
	});
});
