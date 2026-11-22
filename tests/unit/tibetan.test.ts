import { describe, expect, it, vi } from "vitest";
import { analyze, answerText, ask, firstJsonObject, shapeAnalysis, speak, syllablesOf, tibetanText, wordsInRect, type Ai, type PageWords } from "@/libs/tibetan/api";
import { MODEL } from "@/libs/tibetan/prompts";

// T17b: the services of the Tibetan course, with Workers AI and the voice service faked.
const TASHI = "བཀྲ་ཤིས་བདེ་ལེགས།";

describe("requests", () => {
	it("takes only Tibetan, trimmed and cut short", () => {
		expect(tibetanText(`  ${TASHI} `)).toBe(TASHI);
		expect(tibetanText("hello")).toBe("");
		expect(tibetanText(42)).toBe("");
		expect(tibetanText("ཀ".repeat(1000))).toHaveLength(300);
	});

	it("splits syllables at the tsheg and the shad", () => {
		expect(syllablesOf(TASHI)).toEqual(["བཀྲ", "ཤིས", "བདེ", "ལེགས"]);
	});
});

describe("model answers", () => {
	it("reads both answer shapes of Workers AI", () => {
		expect(answerText({ response: "a" })).toBe("a");
		expect(answerText({ choices: [{ message: { content: "b" } }] })).toBe("b");
		expect(answerText({ response: { wylie: "x" } })).toBe('{"wylie":"x"}');
		expect(answerText(null)).toBe("");
	});

	it("finds the JSON object, also inside a code fence", () => {
		expect(firstJsonObject('```json\n{"wylie":"bkra shis"}\n```')).toEqual({ wylie: "bkra shis" });
		expect(firstJsonObject("không có")).toBeNull();
		expect(firstJsonObject("{ hỏng")).toBeNull();
	});

	it("fills every field app.js reads, whatever the model left out", () => {
		const shaped = shapeAnalysis(TASHI, { wylie: "bkra shis bde legs", full_translation: "Cát tường như ý", table_rows: [{ tibetan: "བཀྲ་ཤིས", meaning: "cát tường" }, { meaning: "không có chữ" }], syllables: [{ syllable: "བཀྲ", coach_guide: { correction_tips: ["không bật hơi", 3] } }] });
		expect(shaped.status).toBe("success");
		expect(shaped.dictionary.vn).toBe("Cát tường như ý");
		expect(shaped.table_rows).toEqual([{ tibetan: "བཀྲ་ཤིས", phonetic: "", wylie: "", meaning: "cát tường", pos: "Từ vựng" }]);
		expect(shaped.syllables[0]).toMatchObject({ syllable: "བཀྲ", prefix: "-", suffix: "-", vowel: "a", spelling_steps: [], coach_guide: { correction_tips: ["không bật hơi"] } });
		expect(shaped.usage_context.dialogue_examples).toEqual([]);
	});

	it("without an answer, gives the syllables and says the assistant did not answer", () => {
		const shaped = shapeAnalysis(TASHI, null);
		expect(shaped.status).toBe("fallback");
		expect(shaped.full_translation).toMatch(/chưa trả lời/);
		expect(shaped.syllables.map((syllable) => syllable.syllable)).toEqual(["བཀྲ", "ཤིས", "བདེ", "ལེགས"]);
	});
});

describe("analyze and ask", () => {
	it("asks the chosen model for JSON, without its reasoning step", async () => {
		const ai: Ai = { run: vi.fn(async () => ({ choices: [{ message: { content: '{"wylie":"bkra shis bde legs","full_translation":"Cát tường"}' } }] })) };
		const result = await analyze(TASHI, ai);
		expect(result).toMatchObject({ status: "success", wylie: "bkra shis bde legs", full_translation: "Cát tường" });
		expect(ai.run).toHaveBeenCalledWith(MODEL, expect.objectContaining({ response_format: { type: "json_object" }, chat_template_kwargs: { enable_thinking: false } }));
	});

	it("falls back when the model fails or there is no AI binding", async () => {
		expect((await analyze(TASHI, { run: async () => Promise.reject(new Error("quota")) })).status).toBe("fallback");
		expect((await analyze(TASHI, undefined)).status).toBe("fallback");
		expect(await ask("Nghĩa là gì?", TASHI, undefined)).toMatch(/chưa trả lời/);
	});

	it("passes the question and the text being studied", async () => {
		const run = vi.fn(async () => ({ response: "**Tashi Delek** là lời chào." }));
		expect(await ask("Nghĩa là gì?", TASHI, { run })).toBe("**Tashi Delek** là lời chào.");
		const input = (run.mock.calls[0] as unknown as [string, { messages: { content: string }[] }])[1];
		expect(input.messages[1].content).toContain(TASHI);
		expect(input.messages[1].content).toContain("Nghĩa là gì?");
	});
});

describe("wordsInRect", () => {
	const page: PageWords = {
		width: 600,
		height: 800,
		words: [
			[100, 200, 200, 240, "ཕྱི་རྒྱལ་"],
			[210, 200, 300, 240, "སློབ་མ།"],
			[100, 600, 200, 640, "ཀ"],
		],
	};

	it("reads the words whose middle is inside the drawn rectangle, scaled from the page as shown", () => {
		// The page shown at 300 × 400 px: half the size of its 600 × 800 points.
		expect(wordsInRect(page, [40, 90, 160, 130], [300, 400])).toBe("ཕྱི་རྒྱལ་སློབ་མ།");
		expect(wordsInRect(page, [40, 290, 110, 330], [300, 400])).toBe("ཀ");
		expect(wordsInRect(page, [0, 0, 10, 10], [300, 400])).toBe("");
	});

	it("takes a rectangle drawn backwards, and refuses odd sizes", () => {
		expect(wordsInRect(page, [160, 130, 40, 90], [300, 400])).toBe("ཕྱི་རྒྱལ་སློབ་མ།");
		expect(wordsInRect(page, [0, 0, 300, 400], [0, 400])).toBe("");
		expect(wordsInRect(page, [Number.NaN, 0, 300, 400], [300, 400])).toBe("");
	});
});

describe("speak", () => {
	const SPACE = "https://aipmtdd-tibetan-tts-service.hf.space";

	it("calls the voice service and gives the address of the sound", async () => {
		const fetcher = vi.fn(async (url: string | URL | Request) =>
			String(url).endsWith("generate_tibetan_speech")
				? Response.json({ event_id: "abc" })
				: new Response(`event: complete\ndata: [{"url": "${SPACE}/gradio_api/file=/tmp/a.wav"}, "ok"]\n\n`),
		);
		expect(await speak(TASHI, fetcher as unknown as typeof fetch)).toBe(`${SPACE}/gradio_api/file=/tmp/a.wav`);
		expect(fetcher).toHaveBeenLastCalledWith(`${SPACE}/gradio_api/call/generate_tibetan_speech/abc`);
	});

	it("gives nothing when the service fails, errs, or answers with another host", async () => {
		expect(await speak(TASHI, (async () => new Response("", { status: 503 })) as unknown as typeof fetch)).toBeNull();
		expect(await speak(TASHI, (async () => Promise.reject(new Error("down"))) as unknown as typeof fetch)).toBeNull();
		const elsewhere = (async (url: string | URL | Request) =>
			String(url).endsWith("speech") ? Response.json({ event_id: "x" }) : new Response('event: complete\ndata: [{"url": "https://evil.example/a.wav"}]\n')) as unknown as typeof fetch;
		expect(await speak(TASHI, elsewhere)).toBeNull();
		const errored = (async (url: string | URL | Request) => (String(url).endsWith("speech") ? Response.json({ event_id: "x" }) : new Response("event: error\ndata: null\n"))) as unknown as typeof fetch;
		expect(await speak(TASHI, errored)).toBeNull();
	});
});

describe("overLimit", () => {
	const request = (ip: string) => new Request("https://www.example.test/api/analyze", { method: "POST", headers: { "cf-connecting-ip": ip } });

	it("lets a visitor ask `limit` times a minute, then says no, and starts again the next minute", async () => {
		const { overLimit } = await import("@/libs/tibetan/server");
		const at = Date.UTC(2026, 10, 23, 8, 0, 10);
		for (let i = 0; i < 3; i++) expect(await overLimit(request("1.1.1.1"), "t1", 3, at), `call ${i + 1}`).toBe(false);
		expect(await overLimit(request("1.1.1.1"), "t1", 3, at)).toBe(true);
		// another visitor, another route and the next minute each have their own allowance
		expect(await overLimit(request("2.2.2.2"), "t1", 3, at)).toBe(false);
		expect(await overLimit(request("1.1.1.1"), "t2", 3, at)).toBe(false);
		expect(await overLimit(request("1.1.1.1"), "t1", 3, at + 60_000)).toBe(false);
	});

	it("answers 429 with a Vietnamese message and Retry-After", async () => {
		const { tooMany } = await import("@/libs/tibetan/server");
		const response = tooMany();
		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("60");
		expect(((await response.json()) as { message: string }).message).toContain("đợi một phút");
	});
});
