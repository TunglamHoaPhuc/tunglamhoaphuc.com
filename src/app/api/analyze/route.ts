import { analyze, tibetanText } from "@/libs/tibetan/api";
import { cachedJson, json, readBody, workerEnv } from "@/libs/tibetan/server";

// The Tibetan course (public/tibetan-study, T17b): what a text means, word by word, from Workers AI.
export async function POST(request: Request) {
	const text = tibetanText((await readBody(request))?.text);
	if (!text) return json({ status: "error", message: "Cần một đoạn chữ Tạng." }, 400);
	const { AI } = await workerEnv();
	return json(await cachedJson("analyze", text, () => analyze(text, AI)));
}
