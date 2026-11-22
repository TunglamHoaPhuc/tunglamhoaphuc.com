import { speak, tibetanText } from "@/lib/tibetan/api";
import { json, readBody } from "@/lib/tibetan/server";

// The Tibetan course (T17b): a spoken text. The 34 letters are recorded files the app plays
// itself; anything longer goes to the Tibetan voice service. Without it, the app falls back to
// the browser's own voice.
export async function POST(request: Request) {
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
