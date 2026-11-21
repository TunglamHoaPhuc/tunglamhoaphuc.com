import { describe, expect, it } from "vitest";
import { count, specialWorld } from "../helpers/specialWorld";

const slide = (over: Record<string, unknown> = {}) => ({ id: "s1", enabled: true, title: "Nơi để trở về", subtitle: "", text: "Mô tả", imageMediaId: null, portraitMediaId: null, imagePosition: "center 50%", ctaLabel: "Xem", ctaHref: "/gioi-thieu", ...over });
const HERO = { slides: [slide()], autoEvent: true, autoLatest: false };
const stored = (raw: import("node:sqlite").DatabaseSync, key: string) => {
	const row = raw.prepare("SELECT value FROM setting WHERE key = ?").get(key) as { value: string } | undefined;
	return row ? JSON.parse(row.value) : undefined;
};

describe("reading the home blocks", () => {
	it("lists every block with its live value, its draft, and what the site shows when nothing is set", async () => {
		const w = await specialWorld();
		w.raw.prepare("INSERT INTO setting (key, value) VALUES ('home.quotes', ?)").run(JSON.stringify({ source: "trich-dan", mode: "ngau-nhien" }));
		const editor = await w.as("editor@example.test");
		const home = await editor.call("GET", "home");
		expect(home.status).toBe(200);
		expect(home.data.blocks.map((block: { block: string }) => block.block)).toEqual(["hero", "welcome", "stats", "buddhist_year", "quotes"]);
		expect(home.data.blocks.find((block: { block: string }) => block.block === "quotes")).toMatchObject({ key: "home.quotes", live: { source: "trich-dan", mode: "ngau-nhien" }, draft: null, hasDraft: false });
		expect(home.data.blocks[0]).toMatchObject({ live: null, hasDraft: false });
		expect(home.data.defaults.hero.title).toBe("Nơi để trở về");
		expect(home.data.defaults.buddhist_year).toMatchObject({ mode: "auto" });
		expect(home.data.defaults.stats).toHaveLength(3);
	});

	it("exposes the featured areas in order", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		await editor.call("PUT", "areas/featured", { ids: ["giang-duong", "tam-bao"] });
		const home = await editor.call("GET", "home");
		expect(home.data.featuredAreas.map((area: { id: string }) => area.id)).toEqual(["giang-duong", "tam-bao"]);
	});

	it("names the pictures the blocks use, so the form can show them", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		await editor.call("PUT", "home/hero", { value: { ...HERO, slides: [slide({ imageMediaId: "media-1" })] } });
		const home = await editor.call("GET", "home");
		expect(home.data.media).toEqual({ "media-1": "/anh-goc/s2-cnv03/cms/media-1/v1/a1.png" });
	});
});

describe("drafts and publishing", () => {
	it("saves a draft under <key>.draft, leaves the live value alone, and logs before and after", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const saved = await editor.call("PUT", "home/hero", { value: HERO });
		expect(saved.status).toBe(200);
		expect(saved.data).toMatchObject({ block: "hero", live: null, hasDraft: true, draft: { autoEvent: true, autoLatest: false } });
		expect(stored(w.raw, "home.hero.draft")).toEqual(HERO);
		expect(stored(w.raw, "home.hero")).toBeUndefined();
		const changed = { ...HERO, slides: [slide({ title: "Tiêu đề khác" })] };
		await editor.call("PUT", "home/hero", { value: changed });
		const logs = w.raw.prepare("SELECT action, entity_id, data_before, data_after FROM audit_log WHERE entity_type = 'setting' ORDER BY id").all() as { action: string; entity_id: string; data_before: string | null; data_after: string }[];
		expect(logs.map((log) => [log.action, log.entity_id])).toEqual([["home.save_draft", "home.hero.draft"], ["home.save_draft", "home.hero.draft"]]);
		expect(logs[0].data_before).toBeNull();
		expect(JSON.parse(logs[1].data_before as string).slides[0].title).toBe("Nơi để trở về");
		expect(JSON.parse(logs[1].data_after).slides[0].title).toBe("Tiêu đề khác");
	});

	it("publishes the draft over the live key and removes the draft", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		await editor.call("PUT", "home/welcome", { value: { quote: "Lời mới", author: "Thầy", paragraph: "", imageMediaId: "media-2", videoUrl: "", linkLabel: "", linkHref: "" } });
		expect(stored(w.raw, "home.welcome")).toBeUndefined();
		const published = await editor.call("POST", "home/welcome/publish");
		expect(published.status).toBe(200);
		expect(published.data).toMatchObject({ hasDraft: false, live: { quote: "Lời mới" }, draft: null });
		expect(stored(w.raw, "home.welcome").quote).toBe("Lời mới");
		expect(stored(w.raw, "home.welcome.draft")).toBeUndefined();
		const log = w.raw.prepare("SELECT entity_id, data_after FROM audit_log WHERE action = 'home.publish'").get() as { entity_id: string; data_after: string };
		expect(log.entity_id).toBe("home.welcome");
		expect(JSON.parse(log.data_after).author).toBe("Thầy");
		expect(count(w.raw, "media_usage", "entity_type = 'setting' AND entity_id = 'home.welcome' AND media_id = 'media-2'")).toBe(1);
		expect(count(w.raw, "media_usage", "entity_id = 'home.welcome.draft'")).toBe(0);
	});

	it("saves straight to the live key with publish: true, dropping any draft", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		await editor.call("PUT", "home/quotes", { value: { source: "chu-de-thang", mode: "thu-tu" } });
		const live = await editor.call("PUT", "home/quotes", { value: { source: "trich-dan", mode: "ngau-nhien" }, publish: true });
		expect(live.data).toMatchObject({ live: { source: "trich-dan", mode: "ngau-nhien" }, hasDraft: false });
		expect(stored(w.raw, "home.quotes")).toEqual({ source: "trich-dan", mode: "ngau-nhien" });
		expect(stored(w.raw, "home.quotes.draft")).toBeUndefined();
	});

	it("discards a draft, and answers 409 when there is none to publish or discard", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", "home/hero/publish")).error.code).toBe("no_draft");
		expect((await editor.call("DELETE", "home/hero/draft")).status).toBe(409);
		await editor.call("PUT", "home/hero", { value: HERO });
		const gone = await editor.call("DELETE", "home/hero/draft");
		expect(gone.data).toMatchObject({ hasDraft: false, draft: null });
		expect(stored(w.raw, "home.hero.draft")).toBeUndefined();
		expect(count(w.raw, "audit_log", "action = 'home.discard_draft'")).toBe(1);
	});

	it("publishing again replaces the live value (upsert, not a second row)", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		await editor.call("PUT", "home/buddhist_year", { value: { mode: "manual", value: 2571 }, publish: true });
		await editor.call("PUT", "home/buddhist_year", { value: { mode: "auto", value: 2570 }, publish: true });
		expect(count(w.raw, "setting", "key = 'home.buddhist_year'")).toBe(1);
		expect(stored(w.raw, "home.buddhist_year")).toEqual({ mode: "auto", value: 2570 });
	});
});

describe("what is refused", () => {
	it("checks each block's shape and says which field is wrong", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const bad = async (block: string, value: unknown) => (await editor.call("PUT", `home/${block}`, { value })).error;
		expect((await bad("hero", { slides: [slide({ title: "" })], autoEvent: true, autoLatest: true })).fields["slides.0.title"]).toBeTruthy();
		expect((await bad("hero", { slides: [slide({ ctaHref: "javascript:alert(1)" })], autoEvent: true, autoLatest: true })).fields["slides.0.ctaHref"]).toBeTruthy();
		expect((await bad("hero", { slides: Array.from({ length: 9 }, (_, i) => slide({ id: `s${i}` })), autoEvent: true, autoLatest: true })).fields.slides).toBeTruthy();
		expect((await bad("hero", { slides: [slide(), slide()], autoEvent: true, autoLatest: true })).fields.slides).toBeTruthy();
		expect((await bad("hero", { slides: [slide({ imageMediaId: "khong-co" })], autoEvent: true, autoLatest: true })).fields.imageMediaId).toBeTruthy();
		expect((await bad("hero", "x")).code).toBe("invalid_input");
		expect((await bad("welcome", { quote: "", author: "", paragraph: "", imageMediaId: null, videoUrl: "https://vimeo.com/1", linkLabel: "", linkHref: "" })).fields.videoUrl).toBeTruthy();
		expect((await bad("welcome", { quote: "", author: "", paragraph: "", imageMediaId: null, videoUrl: "", linkLabel: "", linkHref: "//evil.example" })).fields.linkHref).toBeTruthy();
		const stat = { label: "A", source: "manual", value: 1 };
		expect((await bad("stats", [stat, stat, stat, stat])).fields._).toBeTruthy();
		expect((await bad("stats", [{ label: "A", source: "tu-bay", value: 1 }])).fields["0.source"]).toBeTruthy();
		expect((await bad("stats", [{ label: "A", source: "manual", value: -5 }])).fields["0.value"]).toBeTruthy();
		expect((await bad("buddhist_year", { mode: "manual", value: 0 })).fields.value).toBeTruthy();
		expect((await bad("quotes", { source: "tu-do", mode: "thu-tu" })).fields.source).toBeTruthy();
		expect(count(w.raw, "setting", "key LIKE 'home.%'")).toBe(0);
	});

	it("answers 404 for a block that does not exist (home.featured_areas is derived, not edited)", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PUT", "home/featured_areas", { value: [] })).status).toBe(404);
		expect((await editor.call("PUT", "home/khong-co", { value: {} })).status).toBe(404);
		expect((await editor.call("POST", "home/khong-co/publish")).status).toBe(404);
		expect((await editor.call("DELETE", "home/khong-co/draft")).status).toBe(404);
		expect((await editor.call("PUT", "home/hero", {})).status).toBe(400);
	});

	it("checks the picture again at publish: a draft whose picture was deleted since cannot go live", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		await editor.call("PUT", "home/hero", { value: { ...HERO, slides: [slide({ imageMediaId: "media-3" })] } });
		w.raw.prepare("UPDATE media SET deleted_at = '2026-11-01' WHERE id = 'media-3'").run();
		expect((await editor.call("POST", "home/hero/publish")).status).toBe(400);
		expect(stored(w.raw, "home.hero")).toBeUndefined();
	});
});

describe("who may do what", () => {
	it("lets an Author read the home blocks but not change them", async () => {
		const w = await specialWorld();
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "home")).status).toBe(200);
		expect((await author.call("PUT", "home/hero", { value: HERO })).status).toBe(403);
		expect((await author.call("POST", "home/hero/publish")).status).toBe(403);
		expect((await author.call("DELETE", "home/hero/draft")).status).toBe(403);
		expect((await w.client().call("GET", "home")).status).toBe(401);
	});

	it("keeps live saves for people with the publish right: without it, a person may only prepare a draft", async () => {
		const w = await specialWorld();
		w.raw.prepare("DELETE FROM role_permission WHERE role_id = 'role-editor' AND module = 'home' AND action = 'publish'").run();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PUT", "home/hero", { value: HERO })).status).toBe(200);
		expect((await editor.call("PUT", "home/hero", { value: HERO, publish: true })).status).toBe(403);
		expect((await editor.call("POST", "home/hero/publish")).status).toBe(403);
		expect(stored(w.raw, "home.hero")).toBeUndefined();
		const admin = await w.as("admin@example.test");
		expect((await admin.call("POST", "home/hero/publish")).status).toBe(200);
		expect(stored(w.raw, "home.hero")).toEqual(HERO);
	});
});
