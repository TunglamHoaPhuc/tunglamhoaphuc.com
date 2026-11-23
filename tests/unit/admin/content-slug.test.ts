// B1 (docs: tasks/admin-v3-spec.md): a slug is never changed by a save that does not change it, a live article whose address
// changes leaves a redirect behind (in the same batch), and the public pages ask the redirect table before they say 404.
import { describe, expect, it } from "vitest";
import { contentWorld, type ContentWorld } from "../helpers/contentWorld";

type Raw = Record<string, unknown>;
const row = (w: ContentWorld, sql: string, ...args: (string | number | null)[]) => w.raw.prepare(sql).get(...args) as Raw | undefined;
const rows = (w: ContentWorld, sql: string, ...args: (string | number | null)[]) => w.raw.prepare(sql).all(...args) as Raw[];

/** 145 characters, as the old site's long titles make them. */
const LONG = `${"dai-".repeat(36)}d`;

/** An imported post with a slug longer than the editor's own limit, and the revision a first edit leaves behind. */
function longPost(w: ContentWorld, status = "published") {
	w.raw
		.prepare(
			`INSERT INTO post (id, slug, title, section, category_id, author, published_date, status, content_html, search_text, summary)
			 VALUES ('post-long', ?, 'Bài có đường dẫn rất dài', 'dong-chay-hoang-phap', 'post:dong-chay-hoang-phap:cong-tu', 'Ban', '2025-01-02', ?, '<p>Gốc</p>', 'x', 's')`,
		)
		.run(LONG, status);
}

describe("a slug that a save does not change", () => {
	it("stays as stored, whatever its length, when the editor sends it back", async () => {
		const w = await contentWorld();
		longPost(w);
		expect(LONG).toHaveLength(145);
		const root = await w.as("root@example.test");
		const saved = await root.call("PATCH", "posts/post-long", { version: 1, title: "Tên mới", slug: LONG });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(saved.data.slug).toBe(LONG);
		expect(row(w, "SELECT slug FROM post WHERE id = 'post-long'")).toEqual({ slug: LONG });
		expect(rows(w, "SELECT from_path FROM redirect")).toEqual([]);
	});

	it("is not a change at all: a save of only the slug makes no version", async () => {
		const w = await contentWorld();
		longPost(w);
		const root = await w.as("root@example.test");
		const same = await root.call("PATCH", "posts/post-long", { version: 1, slug: LONG });
		expect(same.status, JSON.stringify(same.json)).toBe(200);
		expect(same.data).toMatchObject({ version: 1, slug: LONG });
		expect(rows(w, "SELECT * FROM redirect")).toEqual([]);
	});

	it("survives restoring an old version", async () => {
		const w = await contentWorld();
		longPost(w);
		const root = await w.as("root@example.test");
		w.raw
			.prepare("INSERT INTO revision (entity_type, entity_id, version, snapshot, summary, created_at) VALUES ('post', 'post-long', 1, ?, 'Bản nhập', '2026')")
			.run(JSON.stringify({ title: "Bài có đường dẫn rất dài", slug: LONG, section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu", contentHtml: "<p>Gốc</p>" }));
		expect((await root.call("PATCH", "posts/post-long", { version: 1, title: "Đã sửa", contentHtml: "<p>Mới</p>" })).data.version).toBe(2);
		const restored = await root.call("POST", "posts/post-long/revisions/1/restore", { version: 2 });
		expect(restored.status, JSON.stringify(restored.json)).toBe(200);
		expect(restored.data).toMatchObject({ version: 3, slug: LONG, title: "Bài có đường dẫn rất dài", contentHtml: "<p>Gốc</p>" });
		expect(row(w, "SELECT slug FROM post WHERE id = 'post-long'")).toEqual({ slug: LONG });
		expect(rows(w, "SELECT * FROM redirect")).toEqual([]);
	});
});

describe("restoring a slug the editor could not type", () => {
	it("puts a 145-character slug back though the row now has a short one, and redirects the short one", async () => {
		const w = await contentWorld();
		longPost(w);
		const root = await w.as("root@example.test");
		w.raw
			.prepare("INSERT INTO revision (entity_type, entity_id, version, snapshot, summary, created_at) VALUES ('post', 'post-long', 1, ?, 'Bản nhập', '2026')")
			.run(JSON.stringify({ title: "Bài có đường dẫn rất dài", slug: LONG, section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu", contentHtml: "<p>Gốc</p>" }));
		expect((await root.call("PATCH", "posts/post-long", { version: 1, slug: "ngan" })).data.slug).toBe("ngan");
		const restored = await root.call("POST", "posts/post-long/revisions/1/restore", { version: 2 });
		expect(restored.status, JSON.stringify(restored.json)).toBe(200);
		expect(restored.data.slug).toBe(LONG);
		expect(rows(w, "SELECT from_path, to_path FROM redirect")).toEqual([{ from_path: "/dong-chay-hoang-phap/ngan", to_path: `/dong-chay-hoang-phap/${LONG}` }]);
	});
});

describe("a slug the editor types", () => {
	it("is turned into a slug (accents out, dashes between words)", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const saved = await root.call("PATCH", "posts/post-1060", { version: 1, slug: "Lễ Vu Lan 2026" });
		expect(saved.data.slug).toBe("le-vu-lan-2026");
	});

	it("is refused with a message when it is longer than 80 characters (it is never cut without telling)", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const refused = await root.call("PATCH", "posts/post-1060", { version: 1, slug: LONG });
		expect(refused.status).toBe(400);
		expect(refused.error.fields.slug).toMatch(/80/);
		expect((await root.call("POST", "posts", { title: "Dài", slug: LONG, section: "dong-chay-hoang-phap" })).error.fields.slug).toMatch(/80/);
		expect(row(w, "SELECT slug, version FROM post WHERE id = 'post-1060'")).toEqual({ slug: "le-vu-lan", version: 1 });
	});

	it("is checked as stored by slug-check when it is the article's own", async () => {
		const w = await contentWorld();
		longPost(w);
		const root = await w.as("root@example.test");
		const own = await root.call("GET", `posts/slug-check?slug=${LONG}&section=dong-chay-hoang-phap&excludeId=post-long`);
		expect(own.data).toEqual({ slug: LONG, available: true, suggestion: LONG });
		expect((await root.call("GET", `posts/slug-check?slug=${LONG}&section=dong-chay-hoang-phap`)).status).toBe(400);
	});

	it("is a new article's slug taken by another: 409 with the free slug in the payload, nothing renamed", async () => {
		const w = await contentWorld();
		const editor = await w.as("editor@example.test");
		const taken = await editor.call("POST", "posts", { title: "Khác", slug: "le-vu-lan", section: "dong-chay-hoang-phap" });
		expect(taken.status).toBe(409);
		expect(taken.error.code).toBe("slug_taken");
		expect(taken.error.suggestion).toEqual({ slug: "le-vu-lan-2" });
		expect(row(w, "SELECT COUNT(*) AS n FROM post")).toEqual({ n: 1 });
		// from the title alone the server still picks the next free one, as before
		expect((await editor.call("POST", "posts", { title: "Lễ Vu Lan", section: "dong-chay-hoang-phap" })).data.slug).toBe("le-vu-lan-2");
	});
});

describe("a live article whose address changes", () => {
	it("leaves a redirect from the old address to the new one (a post: slug)", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const saved = await root.call("PATCH", "posts/post-1060", { version: 1, slug: "le-vu-lan-2026" });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(rows(w, "SELECT from_path, to_path, code, active, created_by FROM redirect")).toEqual([
			{ from_path: "/dong-chay-hoang-phap/le-vu-lan", to_path: "/dong-chay-hoang-phap/le-vu-lan-2026", code: 301, active: 1, created_by: "root" },
		]);
	});

	it("leaves one when the section changes, too", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const saved = await root.call("PATCH", "posts/post-1060", { version: 1, section: "tri-tue-phat-phap", categoryId: "post:tri-tue-phat-phap:bai-viet" });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect(rows(w, "SELECT from_path, to_path FROM redirect")).toEqual([{ from_path: "/dong-chay-hoang-phap/le-vu-lan", to_path: "/tri-tue-phat-phap/le-vu-lan" }]);
	});

	it("leaves one for a scheduled article and for a restore that changes the slug", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const created = (await root.call("POST", "posts", { title: "Khóa tu", slug: "khoa-tu", section: "dong-chay-hoang-phap" })).data;
		const later = new Date(Date.now() + 3 * 86400_000).toISOString();
		await root.call("POST", `posts/${created.id}/publish`, { publishAt: later });
		const renamed = await root.call("PATCH", `posts/${created.id}`, { version: 2, slug: "khoa-tu-2" });
		expect(renamed.status, JSON.stringify(renamed.json)).toBe(200);
		expect(rows(w, "SELECT from_path, to_path FROM redirect")).toEqual([{ from_path: "/dong-chay-hoang-phap/khoa-tu", to_path: "/dong-chay-hoang-phap/khoa-tu-2" }]);
		// restoring version 1 puts the first slug back: that address is live again, the other one now redirects
		const restored = await root.call("POST", `posts/${created.id}/revisions/1/restore`, { version: 3 });
		expect(restored.data.slug).toBe("khoa-tu");
		expect(rows(w, "SELECT from_path, to_path FROM redirect")).toEqual([{ from_path: "/dong-chay-hoang-phap/khoa-tu-2", to_path: "/dong-chay-hoang-phap/khoa-tu" }]);
	});

	it("leaves no redirect for a draft, and none when only the title changes", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		const draft = (await root.call("POST", "posts", { title: "Nháp", slug: "nhap", section: "dong-chay-hoang-phap" })).data;
		expect((await root.call("PATCH", `posts/${draft.id}`, { version: 1, slug: "nhap-2" })).status).toBe(200);
		expect((await root.call("PATCH", "posts/post-1060", { version: 1, title: "Tiêu đề khác" })).status).toBe(200);
		expect(rows(w, "SELECT * FROM redirect")).toEqual([]);
	});

	it("keeps the table free of chains and loops: older redirects follow the article, a returning address stops redirecting", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		await root.call("PATCH", "posts/post-1060", { version: 1, slug: "b" });
		await root.call("PATCH", "posts/post-1060", { version: 2, slug: "c" });
		expect(rows(w, "SELECT from_path, to_path FROM redirect ORDER BY from_path")).toEqual([
			{ from_path: "/dong-chay-hoang-phap/b", to_path: "/dong-chay-hoang-phap/c" },
			{ from_path: "/dong-chay-hoang-phap/le-vu-lan", to_path: "/dong-chay-hoang-phap/c" },
		]);
		await root.call("PATCH", "posts/post-1060", { version: 3, slug: "le-vu-lan" });
		expect(rows(w, "SELECT from_path, to_path FROM redirect ORDER BY from_path")).toEqual([
			{ from_path: "/dong-chay-hoang-phap/b", to_path: "/dong-chay-hoang-phap/le-vu-lan" },
			{ from_path: "/dong-chay-hoang-phap/c", to_path: "/dong-chay-hoang-phap/le-vu-lan" },
		]);
	});

	it("takes over a redirect the table already has for the old address (one row per address, active again)", async () => {
		const w = await contentWorld();
		w.raw.prepare("INSERT INTO redirect (from_path, to_path, code, note, hits, active, created_at) VALUES ('/dong-chay-hoang-phap/le-vu-lan', '/lich-tu-hoc', 302, 'cũ', 7, 0, '2026')").run();
		const root = await w.as("root@example.test");
		expect((await root.call("PATCH", "posts/post-1060", { version: 1, slug: "le-vu-lan-2026" })).status).toBe(200);
		expect(rows(w, "SELECT from_path, to_path, code, active, hits FROM redirect")).toEqual([
			{ from_path: "/dong-chay-hoang-phap/le-vu-lan", to_path: "/dong-chay-hoang-phap/le-vu-lan-2026", code: 301, active: 1, hits: 7 },
		]);
	});

	it("is written in the batch of the save: a save that fails leaves no redirect", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		w.raw.prepare("INSERT INTO revision (entity_type, entity_id, version, snapshot, summary, created_at) VALUES ('post', 'post-1060', 2, '{}', 'khác', '2026')").run();
		expect((await root.call("PATCH", "posts/post-1060", { version: 1, slug: "le-vu-lan-2026" })).status).toBe(409);
		expect(rows(w, "SELECT * FROM redirect")).toEqual([]);
		expect(row(w, "SELECT slug FROM post WHERE id = 'post-1060'")).toEqual({ slug: "le-vu-lan" });
	});

	it("covers a Tông Chỉ article and a Giới thiệu page (their addresses have no section)", async () => {
		const w = await contentWorld();
		const root = await w.as("root@example.test");
		expect((await root.call("PATCH", "teachings/tc-1", { version: 1, slug: "niem-phat-hang-ngay" })).status).toBe(200);
		expect((await root.call("PATCH", "pages/page-1", { version: 1, slug: "lich-su-chua" })).status).toBe(200);
		expect(rows(w, "SELECT from_path, to_path FROM redirect ORDER BY from_path")).toEqual([
			{ from_path: "/gioi-thieu/lich-su", to_path: "/gioi-thieu/lich-su-chua" },
			{ from_path: "/tong-chi-tu-hoc/niem-phat", to_path: "/tong-chi-tu-hoc/niem-phat-hang-ngay" },
		]);
	});
});
