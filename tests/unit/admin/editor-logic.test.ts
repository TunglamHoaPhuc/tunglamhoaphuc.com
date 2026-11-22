// The pure parts of the article editor (src/components/admin/content/editorLogic.ts): YouTube addresses, errors by field,
// the slug rule, what a save sends and keeps, and which clicks leave the page (B2, B3, B4, B13, B15).
import { describe, expect, it } from "vitest";
import { youtubeIdOf } from "@/admin/content/extra";
import { slugify as serverSlugify } from "@/admin/slug";
import {
	advanceBaseline,
	bodyIsDirty,
	errorAt,
	leavingHref,
	normalizeYoutubeUrl,
	orphanErrors,
	publishMessage,
	rebase,
	slugify,
	slugOnBlur,
	tidyVideo,
	videoFormOf,
	videoPayload,
	youtubeId,
} from "@/components/admin/content/editorLogic";

describe("YouTube (B3)", () => {
	const ID = "dQw4w9WgXcQ";
	const forms = [
		ID,
		`https://www.youtube.com/watch?v=${ID}`,
		`https://www.youtube.com/watch?feature=share&v=${ID}`,
		`https://youtu.be/${ID}?t=5`,
		`https://www.youtube.com/embed/${ID}`,
		`https://www.youtube-nocookie.com/embed/${ID}`,
		`https://www.youtube.com/shorts/${ID}`,
		`https://www.youtube.com/live/${ID}`,
	];
	it.each(forms)("takes the id out of %s", (form) => {
		expect(youtubeId(form)).toBe(ID);
		expect(normalizeYoutubeUrl(form)).toBe(`https://www.youtube.com/watch?v=${ID}`);
	});
	it("agrees with the server on every address", () => {
		for (const value of [...forms, "https://example.com/watch?v=dQw4w9WgXcQ", "không phải địa chỉ", "", "abc"]) expect(youtubeId(value)).toBe(youtubeIdOf(value));
	});
	it("leaves what it does not recognise as typed (the server then says what is wrong)", () => {
		expect(youtubeId("https://vimeo.com/12345")).toBeNull();
		expect(normalizeYoutubeUrl("  https://vimeo.com/12345 ")).toBe("https://vimeo.com/12345");
		expect(normalizeYoutubeUrl("")).toBe("");
	});
});

describe("teaching video (B4)", () => {
	it("the form never holds an id: only url, title and description", () => {
		expect(videoFormOf({ id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "T", description: "D" })).toEqual({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "T", description: "D" });
		expect(videoFormOf({ id: "dQw4w9WgXcQ", url: "" })).toEqual({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "", description: "" });
		expect(videoFormOf(null)).toBeNull();
	});
	it("a changed address is sent without an id, so the old one cannot win", () => {
		const payload = videoPayload({ id: "AAAAAAAAAAA", url: "https://youtu.be/BBBBBBBBBBB", title: "T", description: "" });
		expect(payload).toEqual({ url: "https://youtu.be/BBBBBBBBBBB", title: "T", description: "" });
		expect("id" in payload).toBe(false);
	});
	it("an empty address is a removal: url and id both empty", () => {
		expect(videoPayload({ url: "   ", title: "còn tiêu đề", description: "" })).toEqual({ url: "", id: "", title: "", description: "" });
		expect(videoPayload(null)).toEqual({ url: "", id: "", title: "", description: "" });
		expect(tidyVideo({ url: "", title: "x", description: "" })).toBeNull();
	});
});

describe("errors by field (B15b)", () => {
	const fields = { "video.title": "Tối đa 300 ký tự.", "quote.lines.3": "Câu quá dài.", "extra.book.author": "Tối đa 200 ký tự.", slug: "Đường dẫn tối đa 80 ký tự.", "milestones.2.title": "x", _: "chung", version: "7" };
	it("finds the message of a dotted path, or of something inside it", () => {
		expect(errorAt(fields, "video.title")).toBe("Tối đa 300 ký tự.");
		expect(errorAt(fields, "quote.lines")).toBe("Câu quá dài.");
		expect(errorAt(fields, "extra.book.author")).toBe("Tối đa 200 ký tự.");
		expect(errorAt(fields, "slug")).toBe("Đường dẫn tối đa 80 ký tự.");
		expect(errorAt(fields, "book.author")).toBeUndefined();
		// "quote" is not a prefix of "quote2": paths are compared by whole segment.
		expect(errorAt({ quote2: "x" }, "quote")).toBeUndefined();
	});
	it("an error no input shows is listed apart, so none stays hidden", () => {
		const shown = ["video.title", "quote", "extra", "slug", "milestones"];
		expect(orphanErrors(fields, shown, ["version"])).toEqual([["_", "chung"]]);
		expect(orphanErrors({ "book.author": "lạ" }, shown)).toEqual([["book.author", "lạ"]]);
	});
});

describe("slug (B15c)", () => {
	const LONG = `${"dai-".repeat(36)}d`;
	it("leaving the field changes nothing unless the person typed in it", () => {
		expect(slugOnBlur(LONG, false)).toBe(LONG);
		expect(slugOnBlur("Đường Dẫn Mới", false)).toBe("Đường Dẫn Mới");
		expect(slugOnBlur("Đường Dẫn Mới", true)).toBe("duong-dan-moi");
	});
	it("what was typed is never cut here (the server reports a slug over 80)", () => {
		expect(slugify(LONG)).toBe(LONG);
		expect(slugify(LONG, 80).length).toBeLessThanOrEqual(80);
	});
	it("follows the server's rule", () => {
		for (const value of ["Tuổi < 18: Đạo đức", "  --Xin  chào!! ", "Đ-đ", "a".repeat(100)]) expect(slugify(value, 80)).toBe(serverSlugify(value));
	});
});

describe("saving without rebuilding (B2)", () => {
	it("a field the person changed while the save was on its way stays different from the new baseline", () => {
		const baseline = { title: "A", summary: "x" };
		const sent = { title: "B", summary: "x" };
		const next = advanceBaseline(baseline, sent, ["title"]);
		expect(next).toEqual({ title: "B", summary: "x" });
		// typed "Bc" meanwhile: still unsaved
		expect(JSON.stringify({ title: "Bc" }.title) === JSON.stringify(next.title)).toBe(false);
	});
	it("the body is unsaved only when the editor's HTML differs from what was last saved", () => {
		expect(bodyIsDirty(null, null)).toBe(false);
		expect(bodyIsDirty({ html: "<p>a</p>" }, null)).toBe(true);
		expect(bodyIsDirty({ html: "<p>a</p>" }, "<p>a</p>")).toBe(false);
		expect(bodyIsDirty({ html: "<p>ab</p>" }, "<p>a</p>")).toBe(true);
	});
	it("after a status change an untouched field follows the server and a typed one stays", () => {
		const previous = { title: "A", publishedDate: "" };
		const stored = { title: "A", publishedDate: "2026-11-22" };
		expect(rebase(previous, stored, { title: "A", publishedDate: "" })).toEqual({ title: "A", publishedDate: "2026-11-22" });
		expect(rebase(previous, stored, { title: "A đang gõ", publishedDate: "" })).toEqual({ title: "A đang gõ", publishedDate: "2026-11-22" });
		expect(rebase(previous, stored, { title: "A", publishedDate: "2020-01-01" })).toEqual({ title: "A", publishedDate: "2020-01-01" });
	});
});

describe("words after publishing (B13)", () => {
	const when = (iso: string | null) => `<${iso}>`;
	it("says what the server answered, not what was asked", () => {
		expect(publishMessage({ status: "scheduled", publishAt: "2026-12-01T00:00:00.000Z" }, when, true)).toBe("Đã hẹn giờ đăng lúc <2026-12-01T00:00:00.000Z>.");
		const soon = publishMessage({ status: "published", publishAt: null }, when, true);
		expect(soon).not.toMatch(/hẹn giờ đăng/);
		expect(soon).toMatch(/xuất bản ngay/);
		expect(publishMessage({ status: "published", publishAt: null }, when, false)).toBe("Đã xuất bản.");
	});
});

describe("which clicks leave the page (B15a)", () => {
	const base = { button: 0, origin: "https://www.tunglamhoaphuc.com", current: "/quan-tri/bai-viet/post-1" };
	it("an in-app link leaves", () => {
		expect(leavingHref({ ...base, href: "/quan-tri/media" })).toBe("/quan-tri/media");
		expect(leavingHref({ ...base, href: "https://www.tunglamhoaphuc.com/quan-tri/bai-viet?x=1#a" })).toBe("/quan-tri/bai-viet?x=1#a");
	});
	it("a new tab, a download, a modified or middle click, the same page, another site and a mailto do not", () => {
		expect(leavingHref({ ...base, href: "/quan-tri/media", target: "_blank" })).toBeNull();
		expect(leavingHref({ ...base, href: "/quan-tri/media", download: true })).toBeNull();
		expect(leavingHref({ ...base, href: "/quan-tri/media", ctrlKey: true })).toBeNull();
		expect(leavingHref({ ...base, href: "/quan-tri/media", metaKey: true })).toBeNull();
		expect(leavingHref({ ...base, href: "/quan-tri/media", button: 1 })).toBeNull();
		expect(leavingHref({ ...base, href: "/quan-tri/bai-viet/post-1#top" })).toBeNull();
		expect(leavingHref({ ...base, href: "https://example.com/" })).toBeNull();
		expect(leavingHref({ ...base, href: "mailto:a@b.vn" })).toBeNull();
		expect(leavingHref({ ...base, href: null })).toBeNull();
	});
});
