import { speak, tibetanText } from "@/lib/tibetan/api";
import { json, overLimit, readBody, tooMany } from "@/lib/tibetan/server";

// The Tibetan course (T17b): a spoken text. The 34 letters are recorded files the app plays
// itself; anything longer goes to the Tibetan voice service. Without it, the app falls back to
// the browser's own voice. 240 a minute: after each analysis the course preloads up to 20 words of vocabulary.
export async function POST(request: Request) {
	if (await overLimit(request, "tts", 240)) return tooMany();
	const text = tibetanText((await readBody(request))?.text);
	if (!text) return json({ status: "error" }, 400);
	const url = await speak(text);
	return json(
		url
			? {
					status: "success",
					audio_url: url,
					type: "neural_tibetan",
					text,
					speed: 0.75,
				}
			: { status: "fallback", text, speed: 0.75 },
	);
}
