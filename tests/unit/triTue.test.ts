import { describe, expect, it } from "vitest";
import { tibetan } from "@/config/triTue";
import { scriptRuns } from "@/libs/triTue";

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
