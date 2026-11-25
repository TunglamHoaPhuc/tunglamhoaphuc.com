import { analyze, tibetanText } from "@/lib/tibetan/api";
import { PROMPT_VERSION } from "@/lib/tibetan/prompts";
import { allow, cachedJson, json, OverLimit, readBody, tooMany, workerEnv } from "@/lib/tibetan/server";

// The Tibetan course (public/tibetan-study, T17b): what a text means, word by word, from Workers AI.
// 60 a minute per visitor, counted only where the model is asked (same as www).
export async function POST(request: Request) {
	const text = tibetanText((await readBody(request))?.text);
	if (!text) return json({ status: "error", message: "Cần một đoạn chữ Tạng." }, 400);
	const { AI } = await workerEnv();
	try {
		return json(
			await cachedJson(`analyze-v${PROMPT_VERSION}`, text, async () => {
				// Counted only where the model is asked, not for an answer already kept.
				await allow(request, "analyze", 60);
				return analyze(text, AI);
			}),
		);
	} catch (error) {
		if (error instanceof OverLimit) return tooMany();
		throw error;
	}
}
