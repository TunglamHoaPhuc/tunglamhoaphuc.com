// The pure parts of the article editor, kept apart so they can be tested without a browser: YouTube addresses, the way a
// server field error finds its input, the slug rule, what a save sends, and which clicks leave the page.

// ------------------------------------------------------------------ YouTube

/** The 11-character id of a YouTube video given as an id, a watch, share, embed, shorts or live address; null when it is none of them. Same rule as the server's `youtubeIdOf`. */
export function youtubeId(value: string): string | null {
	const text = value.trim();
	if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
	const match = text.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
	return match ? match[1] : null;
}

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** What a pasted address becomes in the video form: the watch address when it is recognised, the text as typed otherwise (the server then says what is wrong). */
export function normalizeYoutubeUrl(value: string): string {
	const id = youtubeId(value);
	return id ? youtubeWatchUrl(id) : value.trim();
}

// ------------------------------------------------------------------ teaching video

export type VideoForm = { url: string; title: string; description: string };

/** The video of a Tông Chỉ article as the form holds it: no `id`, so a stale one can never be sent back. */
export function videoFormOf(video: unknown): VideoForm | null {
	if (!video || typeof video !== "object") return null;
	const item = video as Record<string, unknown>;
	const text = (value: unknown) => (typeof value === "string" ? value : "");
	const url = text(item.url) || (youtubeId(text(item.id)) ? youtubeWatchUrl(text(item.id)) : "");
	return { url, title: text(item.title), description: text(item.description) };
}

/** An empty address means "no video". */
export function tidyVideo(video: unknown): VideoForm | null {
	const form = videoFormOf(video);
	return form && form.url.trim() ? { ...form, url: form.url.trim() } : null;
}

/** The video as the PATCH carries it: `{url, title, description}`, and for none the empty `url` and `id` the server reads as removal. */
export function videoPayload(video: unknown): Record<string, string> {
	const kept = tidyVideo(video);
	return kept ? { url: kept.url, title: kept.title, description: kept.description } : { url: "", id: "", title: "", description: "" };
}

// ------------------------------------------------------------------ errors by field

/** The message for the input at `path` ("video.title", "extra.book.author"): its own, or one for something inside it ("quote.lines.3"). */
export function errorAt(fields: Record<string, string>, path: string): string | undefined {
	if (fields[path]) return fields[path];
	const prefix = `${path}.`;
	for (const [key, message] of Object.entries(fields)) if (key.startsWith(prefix)) return message;
	return undefined;
}

/** Errors no input shows (a path that is none of `shown`, nor inside one): they go to a block of their own, so none stays hidden. */
export function orphanErrors(fields: Record<string, string>, shown: readonly string[], ignored: readonly string[] = []): [string, string][] {
	return Object.entries(fields).filter(([key]) => !ignored.includes(key) && !shown.some((path) => key === path || key.startsWith(`${path}.`)));
}

// ------------------------------------------------------------------ slug

/** Same rule as the server's slugify (src/admin/slug.ts); `max` cuts the result (a title makes at most 80 characters, what somebody types is never cut here: the server says if it is too long). */
export function slugify(value: string, max = Number.MAX_SAFE_INTEGER): string {
	return value
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, max)
		.replace(/-+$/g, "");
}

export const SLUG_FROM_TITLE_MAX = 80;

/** What leaving the slug field does: nothing unless the person typed in it (a slug read from the database is never rewritten). */
export const slugOnBlur = (value: string, typed: boolean): string => (typed ? slugify(value) : value);

// ------------------------------------------------------------------ the form against what was saved

export const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** After something other than the person's typing changed the saved state (a status action), a field they have not touched follows the new state; one they have touched stays as typed. */
export function rebase<T extends Record<string, unknown>>(previous: T, next: T, form: T): T {
	const out: Record<string, unknown> = { ...form };
	for (const key of Object.keys(next)) if (same(form[key], previous[key])) out[key] = next[key];
	return out as T;
}

/** A save that went through makes what it sent the new baseline for those fields; what was typed while it was on its way stays different from it. */
export function advanceBaseline<T extends Record<string, unknown>>(baseline: T, sent: T, keys: readonly string[]): T {
	const out: Record<string, unknown> = { ...baseline };
	for (const key of keys) out[key] = sent[key];
	return out as T;
}

/** The body is unsaved when the editor has produced HTML since it was opened that differs from what was last saved. */
export const bodyIsDirty = (current: { html: string } | null, savedHtml: string | null): boolean => current !== null && current.html !== savedHtml;

// ------------------------------------------------------------------ after a status action

type Status = "draft" | "pending" | "published" | "scheduled" | "hidden";

/** The words after "Xuất bản" or "Hẹn giờ": taken from the status the server answered, so a time less than a minute ahead (published at once) is not called a schedule. */
export function publishMessage(next: { status: Status; publishAt: string | null }, when: (iso: string | null) => string, scheduled: boolean): string {
	if (next.status === "scheduled") return `Đã hẹn giờ đăng lúc ${when(next.publishAt)}.`;
	if (next.status === "published") return scheduled ? "Đã xuất bản ngay: thời điểm hẹn quá gần nên bài không chờ giờ hẹn." : "Đã xuất bản.";
	return "Đã cập nhật trạng thái.";
}

// ------------------------------------------------------------------ leaving the page

export type ClickInfo = {
	href: string | null;
	target?: string | null;
	download?: boolean;
	button: number;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	/** `location.origin`, and `location.pathname + location.search` of the page now. */
	origin: string;
	current: string;
};

/** The in-app address a click on a link would go to, or null when the click does not leave this page (a new tab, a download, the same page, another site: the browser's own warning covers that one). */
export function leavingHref(click: ClickInfo): string | null {
	if (click.button !== 0 || click.ctrlKey || click.metaKey || click.shiftKey || click.altKey || click.download) return null;
	if (click.target && click.target !== "_self") return null;
	if (!click.href) return null;
	let url: URL;
	try {
		url = new URL(click.href, click.origin);
	} catch {
		return null;
	}
	if (url.origin !== click.origin) return null;
	if (url.pathname + url.search === click.current) return null;
	return url.pathname + url.search + url.hash;
}
