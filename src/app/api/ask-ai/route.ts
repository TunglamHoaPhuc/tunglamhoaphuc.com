import { ask, MAX_QUESTION, tibetanText } from "@/libs/tibetan/api";
import { PROMPT_VERSION } from "@/libs/tibetan/prompts";
import { allow, cachedJson, json, OverLimit, readBody, tooMany, workerEnv } from "@/libs/tibetan/server";

// The Tibetan course (T17b): the learner's question about the text being studied, from Workers AI.
export async function POST(request: Request) {
	const body = await readBody(request);
	const question = typeof body?.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
	if (!question) return json({ answer: "Mời nhập câu hỏi." }, 400);
	const target = tibetanText(body?.target_text);
	const { AI } = await workerEnv();
	try {
		const result = await cachedJson(`ask-v${PROMPT_VERSION}`, `${target}\n${question}`, async () => {
			// Counted only here, where the model is asked: an answer already kept costs nothing and is not counted.
			await allow(request, "ask-ai", 20);
			const answer = await ask(question, target, AI);
			return {
				status: /chưa trả lời được/.test(answer) ? "fallback" : "success",
				answer,
			};
		});
		return json({ answer: result.answer });
	} catch (error) {
		if (error instanceof OverLimit) return tooMany();
		throw error;
	}
}
