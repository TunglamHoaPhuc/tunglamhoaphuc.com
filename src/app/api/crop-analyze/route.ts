import { analyze, tibetanText, wordsInRect } from "@/libs/tibetan/api";
import { cachedJson, json, pageWords, readBody, workerEnv } from "@/libs/tibetan/server";

// The Tibetan course (T17b): the learner draws a rectangle on a page of the book. The words in
// it come from the book's word positions (sara_words_coords.json, one file a page), not from
// reading the picture; the text the learner had selected is the fallback.
export async function POST(request: Request) {
	const body = await readBody(request);
	if (!body) return json({ status: "error" }, 400);
	const { AI, ASSETS } = await workerEnv();
	const page = await pageWords(Number(body.page_num), request, ASSETS);
	const rect = Array.isArray(body.rect) ? body.rect.map(Number) : [];
	const size = Array.isArray(body.canvas_size) ? body.canvas_size.map(Number) : [];
	const text = tibetanText(page ? wordsInRect(page, rect, size) : "") || tibetanText(body.fallback_text);
	if (!text) return json({ status: "error", message: "Không thấy chữ Tạng trong vùng đã chọn." });
	const analysis = await cachedJson("analyze", text, () => analyze(text, AI));
	return json({ ...analysis, status: "success", detected_text: text, cropped_image: null });
}
