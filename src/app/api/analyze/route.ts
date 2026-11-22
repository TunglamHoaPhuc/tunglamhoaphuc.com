import { analyze, tibetanText } from "@/libs/tibetan/api";
import { PROMPT_VERSION } from "@/libs/tibetan/prompts";
import { cachedJson, json, overLimit, readBody, tooMany, workerEnv } from "@/libs/tibetan/server";

// The Tibetan course (public/tibetan-study, T17b): what a text means, word by word, from Workers AI.
export async function POST(request: Request) {
	if (await overLimit(request, "analyze", 60)) return tooMany();
	const text = tibetanText((await readBody(request))?.text);
	if (!text) return json({ status: "error", message: "Cần một đoạn chữ Tạng." }, 400);
	const { AI } = await workerEnv();
	return json(await cachedJson(`analyze-v${PROMPT_VERSION}`, text, () => analyze(text, AI)));
}
