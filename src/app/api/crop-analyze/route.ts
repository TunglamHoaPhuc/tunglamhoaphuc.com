import { analyze, tibetanText, wordsInRect } from "@/lib/tibetan/api";
import { PROMPT_VERSION } from "@/lib/tibetan/prompts";
import { allow, cachedJson, json, OverLimit, pageWords, readBody, tooMany, workerEnv } from "@/lib/tibetan/server";

// The Tibetan course (T17b): the learner draws a rectangle on a page of the book. The words in
// it come from the book's word positions (sara_words_coords.json, one file a page), not from
// reading the picture; the text the learner had selected is the fallback.
// 40 a minute per visitor, counted only where the model is asked (same as www).
export async function POST(request: Request) {
	const body = await readBody(request);
	if (!body) return json({ status: "error" }, 400);
	const { AI, ASSETS } = await workerEnv();
	const page = await pageWords(Number(body.page_num), request, ASSETS);
	const rect = Array.isArray(body.rect) ? body.rect.map(Number) : [];
	const size = Array.isArray(body.canvas_size) ? body.canvas_size.map(Number) : [];
	const text = tibetanText(page ? wordsInRect(page, rect, size) : "") || tibetanText(body.fallback_text);
	if (!text)
		return json({
			status: "error",
			message: "Không thấy chữ Tạng trong vùng đã chọn.",
		});
	try {
		const analysis = await cachedJson(`analyze-v${PROMPT_VERSION}`, text, async () => {
			// Counted only where the model is asked, not for an answer already kept.
			await allow(request, "crop-analyze", 40);
			return analyze(text, AI);
		});
		return json({
			...analysis,
			status: "success",
			detected_text: text,
			cropped_image: null,
		});
	} catch (error) {
		if (error instanceof OverLimit) return tooMany();
		throw error;
	}
}
