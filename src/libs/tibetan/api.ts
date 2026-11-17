import { analysisMessages, askMessages, MODEL } from "./prompts";

// The four services of the Tibetan course (public/tibetan-study, T17b), with the request and
// answer shapes its app.js already uses. AI and the voice service are passed in, so tests run
// without either.

/** The part of the Workers AI binding these services use. */
export type Ai = {
	run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

/** Longest text or question taken, so one request cannot run up the AI bill. */
export const MAX_TEXT = 300;
export const MAX_QUESTION = 600;

const TIBETAN = /[ༀ-࿿]/u;

/** The Tibetan text of a request, trimmed and cut to MAX_TEXT, or "" when it has no Tibetan. */
export function tibetanText(value: unknown): string {
	const text = typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
	return TIBETAN.test(text) ? text : "";
}

/** The syllables of a Tibetan text: split at the tsheg (་), the shad (།) and spaces. */
export function syllablesOf(text: string): string[] {
	return text.split(/[་།-༒\s]+/u).filter((part) => TIBETAN.test(part));
}

/** The text a model answered with, from either answer shape Workers AI gives. */
export function answerText(result: unknown): string {
	if (!result || typeof result !== "object") return typeof result === "string" ? result : "";
	const value = result as {
		response?: unknown;
		choices?: { message?: { content?: unknown } }[];
	};
	if (typeof value.response === "string") return value.response;
	if (value.response && typeof value.response === "object") return JSON.stringify(value.response);
	const content = value.choices?.[0]?.message?.content;
	return typeof content === "string" ? content : "";
}

/** The first JSON object in a text (models sometimes wrap it in ```json fences), or `null`. */
export function firstJsonObject(text: string): Record<string, unknown> | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		const parsed: unknown = JSON.parse(text.slice(start, end + 1));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const strings = (value: unknown) => list(value).filter((item): item is string => typeof item === "string");

/**
 * The analysis app.js draws, from what the model answered: every field it reads is there and
 * of the right kind, whatever the model left out. Without an answer, the syllables of the text
 * and a note that the assistant did not answer.
 */
export function shapeAnalysis(text: string, answer: Record<string, unknown> | null) {
	const raw = answer ?? {};
	const dictionary = obj(raw.dictionary);
	const translation = str(raw.full_translation) || str(dictionary.vn) || (answer ? "" : "Trợ lý AI chưa trả lời được, mời thử lại sau ít phút.");
	const syllables: Record<string, unknown>[] = list(raw.syllables).length ? list(raw.syllables).map(obj) : syllablesOf(text).map((syllable) => ({ syllable }));
	const usage = obj(raw.usage_context);
	const buddhist = obj(raw.buddhist_context);
	return {
		status: answer ? "success" : "fallback",
		wylie: str(raw.wylie),
		full_translation: translation,
		dictionary: {
			vn: str(dictionary.vn) || translation,
			usage: str(dictionary.usage),
		},
		table_rows: list(raw.table_rows)
			.map(obj)
			.map((row) => ({
				tibetan: str(row.tibetan),
				phonetic: str(row.phonetic),
				wylie: str(row.wylie),
				meaning: str(row.meaning),
				pos: str(row.pos, "Từ vựng"),
			}))
			.filter((row) => row.tibetan),
		syllables: syllables.map((syllable) => {
			const coach = obj(syllable.coach_guide);
			const root = obj(coach.root_guide);
			return {
				syllable: str(syllable.syllable),
				wylie: str(syllable.wylie),
				root: str(syllable.root),
				prefix: str(syllable.prefix, "-"),
				suffix: str(syllable.suffix, "-"),
				vowel: str(syllable.vowel, "a"),
				spelling_steps: strings(syllable.spelling_steps),
				coach_guide: {
					root_guide: {
						ipa: str(root.ipa),
						tone: str(root.tone),
						aspiration: str(root.aspiration),
						guide: str(root.guide),
					},
					correction_tips: strings(coach.correction_tips),
				},
			};
		}),
		usage_context: {
			situation: str(usage.situation),
			cultural_notes: str(usage.cultural_notes),
			dialogue_examples: list(usage.dialogue_examples),
		},
		buddhist_context: {
			scripture_quote: str(buddhist.scripture_quote),
			teachings: str(buddhist.teachings),
			philosophy_reflection: str(buddhist.philosophy_reflection),
		},
	};
}

export type Analysis = ReturnType<typeof shapeAnalysis>;

/** Asks the model for the analysis of a text; a failed or unreadable answer gives the fallback shape. */
export async function analyze(text: string, ai: Ai | undefined): Promise<Analysis> {
	if (!ai) return shapeAnalysis(text, null);
	try {
		const result = await ai.run(MODEL, {
			messages: analysisMessages(text),
			max_tokens: 2500,
			temperature: 0.2,
			response_format: { type: "json_object" },
			chat_template_kwargs: { enable_thinking: false },
		});
		return shapeAnalysis(text, firstJsonObject(answerText(result)));
	} catch (error) {
		console.error(
			JSON.stringify({
				event: "tibetan-analyze-error",
				message: error instanceof Error ? error.message : String(error),
			}),
		);
		return shapeAnalysis(text, null);
	}
}

/** The assistant's answer to a question, in Markdown; a fixed note when it cannot answer. */
export async function ask(question: string, target: string, ai: Ai | undefined): Promise<string> {
	const unavailable = "Trợ lý AI chưa trả lời được, mời thử lại sau ít phút.";
	if (!ai) return unavailable;
	try {
		const result = await ai.run(MODEL, {
			messages: askMessages(question.slice(0, MAX_QUESTION), target),
			max_tokens: 1200,
			temperature: 0.3,
			chat_template_kwargs: { enable_thinking: false },
		});
		return answerText(result).trim() || unavailable;
	} catch (error) {
		console.error(
			JSON.stringify({
				event: "tibetan-ask-error",
				message: error instanceof Error ? error.message : String(error),
			}),
		);
		return unavailable;
	}
}

/** One page of sara_words_coords.json: its size in PDF points and its words, [x0, y0, x1, y1, text]. */
export type PageWords = {
	width: number;
	height: number;
	words: [number, number, number, number, string][];
};

/**
 * The words of a page inside a rectangle drawn on it: `rect` is in pixels of the page as shown
 * (`canvasSize` wide and high), the words in PDF points. A word counts when its middle is inside.
 * Read top to bottom, then left to right, and joined as they are written (no spaces in Tibetan).
 */
export function wordsInRect(page: PageWords, rect: number[], canvasSize: number[]): string {
	const [x0, y0, x1, y1] = rect;
	const [width, height] = canvasSize;
	if (![x0, y0, x1, y1, width, height].every((value) => Number.isFinite(value)) || width <= 0 || height <= 0) return "";
	const sx = page.width / width;
	const sy = page.height / height;
	const left = Math.min(x0, x1) * sx;
	const right = Math.max(x0, x1) * sx;
	const top = Math.min(y0, y1) * sy;
	const bottom = Math.max(y0, y1) * sy;
	return page.words
		.filter(([wx0, wy0, wx1, wy1]) => {
			const cx = (wx0 + wx1) / 2;
			const cy = (wy0 + wy1) / 2;
			return cx >= left && cx <= right && cy >= top && cy <= bottom;
		})
		.sort((a, b) => a[1] - b[1] || a[0] - b[0])
		.map((word) => word[4].trim())
		.join("");
}

// The voice: a Tibetan text-to-speech model on Hugging Face (the one the old site used; Workers
// AI has no Tibetan voice). Its Gradio API takes the text, then streams the result.
const VOICE = "https://aipmtdd-tibetan-tts-service.hf.space/gradio_api/call/generate_tibetan_speech";

/** The address of a spoken Tibetan text, or `null` when the voice service does not answer. */
export async function speak(text: string, fetcher: typeof fetch = fetch): Promise<string | null> {
	try {
		const call = await fetcher(VOICE, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ data: [text] }),
		});
		const id = call.ok ? str(obj(await call.json()).event_id) : "";
		if (!id) return null;
		const stream = await fetcher(`${VOICE}/${encodeURIComponent(id)}`);
		if (!stream.ok) return null;
		const events = await stream.text();
		const complete = /event:\s*complete\s*\ndata:\s*(.+)/.exec(events);
		if (!complete) return null;
		const url = str(obj(list(JSON.parse(complete[1]))[0]).url);
		return url.startsWith("https://aipmtdd-tibetan-tts-service.hf.space/") ? url : null;
	} catch {
		return null;
	}
}
