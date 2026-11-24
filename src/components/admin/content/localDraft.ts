// A browser-side safety net for the article body: the editor writes its content here a few seconds after typing stops,
// so a crash, a closed tab or a lost connection costs seconds, not the article. It is never sent to the server by itself
// (saving a published article makes it live and a new version), only offered back when the person opens the article again.
import type { JSONContent } from "@tiptap/react";

export type LocalDraft = { html: string; json: JSONContent; savedAt: number };

export const draftKey = (kind: string, id: string | null) => `tq-draft:${kind}:${id ?? "new"}`;

export function readDraft(key: string): LocalDraft | null {
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return null;
		const value = JSON.parse(raw) as LocalDraft;
		return typeof value?.html === "string" && value.json && typeof value.savedAt === "number" ? value : null;
	} catch {
		return null;
	}
}

export function writeDraft(key: string, draft: LocalDraft): void {
	try {
		window.localStorage.setItem(key, JSON.stringify(draft));
	} catch {
		// Storage full or blocked: the draft is a convenience only.
	}
}

export function clearDraft(key: string): void {
	try {
		window.localStorage.removeItem(key);
	} catch {
		// Nothing to clear.
	}
}

/** Reading statistics shown under the editor: words (Vietnamese syllables), characters, minutes at 200 words a minute. */
export function readingStats(text: string): { words: number; chars: number; minutes: number } {
	const trimmed = text.trim();
	const words = trimmed ? trimmed.split(/\s+/).length : 0;
	return { words, chars: trimmed.length, minutes: Math.max(words ? 1 : 0, Math.ceil(words / 200)) };
}
