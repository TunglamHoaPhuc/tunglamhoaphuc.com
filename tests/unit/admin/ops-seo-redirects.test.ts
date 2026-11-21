import { describe, expect, it } from "vitest";
import { asD1 } from "../../../src/db/nodeSqlite";
import { candidates, checkFrom, checkTo, countHit, findRedirect, makesLoop, pathOf } from "../../../src/libs/redirects";
import { parseRobotsExtra } from "../../../src/libs/robotsExtra";
import { parseRedirectList } from "../../../src/components/admin/ops/redirectCsv";
import { world } from "../helpers/adminWorld";
import { count, insertMedia, SEEDS } from "../helpers/ops";

const enc = encodeURIComponent;
/** A redirect row's id the way the pages send it: the address percent-encoded twice. */
const id = (from: string) => enc(enc(from));

describe("SEO defaults", () => {
	it("starts empty, saves, and logs the change", async () => {
		const w = await world(SEEDS);
		insertMedia(w.raw, { id: "og1" });
		const editor = await w.as("editor@example.test");
		expect((await editor.call("GET", "seo/defaults")).data).toEqual({ title: "", description: "", ogMediaId: null, ogUrl: "", robotsExtra: "" });
		const saved = await editor.call("PUT", "seo/defaults", { title: "Tùng Lâm Hòa Phúc", description: "Chốn tu học", ogMediaId: "og1", robotsExtra: "Disallow:   /rieng-tu \n\nallow: /rieng-tu/mo" });
		expect(saved.status).toBe(200);
		expect(saved.data).toMatchObject({ title: "Tùng Lâm Hòa Phúc", ogMediaId: "og1", ogUrl: "/anh-goc/s2-cnv03/cms/og1/v1/og1.png", robotsExtra: "Disallow: /rieng-tu\nAllow: /rieng-tu/mo" });
		expect(JSON.parse((w.raw.prepare("SELECT value FROM setting WHERE key = 'seo.defaults'").get() as { value: string }).value).robotsExtra).toBe("Disallow: /rieng-tu\nAllow: /rieng-tu/mo");
		expect(count(w.raw, "media_usage", "media_id = 'og1' AND entity_type = 'setting'")).toBe(1);
		expect(w.raw.prepare("SELECT user_email, entity_id FROM audit_log WHERE action = 'seo.defaults_update'").get()).toEqual({ user_email: "editor@example.test", entity_id: "seo.defaults" });
		// removing the picture drops its usage
		await editor.call("PUT", "seo/defaults", { title: "", description: "", ogMediaId: null, robotsExtra: "" });
		expect(count(w.raw, "media_usage", "entity_type = 'setting'")).toBe(0);
	});

	it("refuses robots lines that are not simple Allow/Disallow rules, and pictures that do not exist", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		for (const bad of ["User-agent: *", "Disallow: tim-kiem", "Sitemap: https://x.test/s.xml", "Disallow: /a b", "Crawl-delay: 10", "Disallow: /<script>"]) {
			const result = await admin.call("PUT", "seo/defaults", { title: "", description: "", robotsExtra: bad });
			expect(result.status, bad).toBe(400);
			expect(result.error.fields.robotsExtra, bad).toContain("Dòng 1");
		}
		const tooMany = await admin.call("PUT", "seo/defaults", { title: "", description: "", robotsExtra: Array.from({ length: 51 }, (_, i) => `Disallow: /a${i}`).join("\n") });
		expect(tooMany.status).toBe(400);
		const ghost = await admin.call("PUT", "seo/defaults", { title: "", description: "", ogMediaId: "khong-co", robotsExtra: "" });
		expect(ghost.status).toBe(400);
		expect(ghost.error.fields.ogMediaId).toBeTruthy();
		const long = await admin.call("PUT", "seo/defaults", { title: "x".repeat(121), description: "" });
		expect(long.status).toBe(400);
		expect(long.error.fields.title).toBeTruthy();
		expect(count(w.raw, "setting", "key = 'seo.defaults'")).toBe(0);
	});

	it("is closed to people without the seo rights (an Author) and read only for none who lack update", async () => {
		const w = await world(SEEDS);
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "seo/defaults")).status).toBe(403);
		expect((await author.call("PUT", "seo/defaults", { title: "", description: "" })).status).toBe(403);
	});

	it("reads robots lines the same way for the admin's form and for robots.txt", () => {
		expect(parseRobotsExtra("")).toMatchObject({ ok: true, value: { allow: [], disallow: [] } });
		expect(parseRobotsExtra("Disallow: /a\nAllow: /b/*\nDisallow: /c$")).toMatchObject({ ok: true, value: { allow: ["/b/*"], disallow: ["/a", "/c$"] } });
		expect(parseRobotsExtra("Disallow: https://x.test").ok).toBe(false);
	});
});

describe("redirect rules", () => {
	it("accepts a plain old path and tidies it", () => {
		expect(checkFrom("/bai-cu/abc/")).toEqual({ ok: true, value: "/bai-cu/abc" });
		expect(checkFrom("  /bài-cũ ")).toEqual({ ok: true, value: "/bài-cũ" });
	});

	it("refuses old paths that are not paths, or that belong to the system", () => {
		for (const bad of ["", "bai-cu", "//bai-cu", "/a//b", "/a?x=1", "/a#top", "/a\\b", "/a b", "/", "https://tunglamhoaphuc.com/a", "/quan-tri", "/quan-tri/tai-khoan", "/API/x", "/api", "/anh-goc/x", "/cdn-cgi/y", "/admin/z", "/login", "/van-hanh/x", "/_next/static/a.js", "/x".repeat(200)]) {
			expect(checkFrom(bad).ok, JSON.stringify(bad)).toBe(false);
		}
		expect(checkFrom("/quan-tri-vien").ok).toBe(true);
		expect(checkFrom("/apple").ok).toBe(true);
	});

	it("lets a redirect lead to a path of the site or to its own https address, never elsewhere", () => {
		for (const good of ["/moi", "/moi/trang?x=1#a", "https://www.tunglamhoaphuc.com/moi", "https://tunglamhoaphuc.com/moi"]) expect(checkTo(good).ok, good).toBe(true);
		for (const bad of ["", "moi", "//evil.test/x", "/\\evil.test", "/a//b", "http://www.tunglamhoaphuc.com/x", "https://evil.test/x", "https://www.tunglamhoaphuc.com.evil.test/x", "https://www.tunglamhoaphuc.com@evil.test/x", "https://evil.test@www.tunglamhoaphuc.com/x", "https://www.tunglamhoaphuc.com:8443/x", "https://www.tunglamhoaphuc.com//evil.test", "javascript:alert(1)", "data:text/html,x", "/a b", "https://v2.tunglamhoaphuc.com/x", "ftp://www.tunglamhoaphuc.com/x"]) {
			expect(checkTo(bad).ok, bad).toBe(false);
		}
	});

	it("finds loops within five hops and tells a long chain from a loop", async () => {
		const table = new Map([["/b", "/c"], ["/c", "/d"], ["/d", "/e"], ["/e", "/f"], ["/f", "/g"], ["/g", "/h"]]);
		const next = async (path: string) => table.get(path) ?? null;
		expect(await makesLoop("/a", "/a", next)).toBe(true);
		expect(await makesLoop("/a", "/b", next)).toBe(false);
		table.set("/f", "/a");
		expect(await makesLoop("/a", "/b", next)).toBe(true); // b > c > d > e > f > a
		expect(pathOf("https://www.tunglamhoaphuc.com/x/y/?q=1#z")).toBe("/x/y");
	});

	it("tries the spellings a visitor's address may be stored under", () => {
		expect(candidates("/bài-viết/")).toEqual(["/bài-viết", "/b%C3%A0i-vi%E1%BA%BFt"]);
		expect(candidates("/b%C3%A0i")).toContain("/bài");
		expect(candidates("/")).toEqual([]);
	});
});

describe("redirect endpoints", () => {
	it("creates, reads, changes and deletes one, each logged", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		const made = await admin.call("POST", "redirects", { from: "/bai-cu/", to: "/bai-moi", note: "Từ site cũ" });
		expect(made.status).toBe(200);
		expect(made.data).toMatchObject({ from: "/bai-cu", to: "/bai-moi", code: 301, note: "Từ site cũ", hits: 0, active: true, createdBy: "admin" });
		expect((await admin.call("GET", `redirects/${id("/bai-cu")}`)).data.to).toBe("/bai-moi");
		// the id also works encoded once
		expect((await admin.call("GET", `redirects/${enc("/bai-cu")}`)).data.to).toBe("/bai-moi");
		const changed = await admin.call("PATCH", `redirects/${id("/bai-cu")}`, { to: "https://www.tunglamhoaphuc.com/bai-khac", code: 302, active: false });
		expect(changed.data).toMatchObject({ to: "https://www.tunglamhoaphuc.com/bai-khac", code: 302, active: false, note: "Từ site cũ" });
		const kept = await admin.call("PATCH", `redirects/${id("/bai-cu")}`, { note: "Ghi chú mới" });
		expect(kept.data).toMatchObject({ code: 302, active: false, note: "Ghi chú mới" });
		expect((await admin.call("DELETE", `redirects/${id("/bai-cu")}`)).status).toBe(204);
		expect(count(w.raw, "redirect")).toBe(0);
		const actions = (w.raw.prepare("SELECT action FROM audit_log WHERE entity_type = 'redirect' ORDER BY id").all() as { action: string }[]).map((r) => r.action);
		expect(actions).toEqual(["redirect.create", "redirect.update", "redirect.update", "redirect.delete"]);
		expect((await admin.call("GET", `redirects/${id("/bai-cu")}`)).status).toBe(404);
		expect((await admin.call("DELETE", `redirects/${id("/bai-cu")}`)).status).toBe(404);
		expect((await admin.call("PATCH", `redirects/${id("/khong-co")}`, { note: "x" })).status).toBe(404);
	});

	it("validates what comes in, field by field", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		const fromBad = await admin.call("POST", "redirects", { from: "/quan-tri/x", to: "/moi" });
		expect(fromBad.status).toBe(400);
		expect(fromBad.error.fields.from).toContain("hệ thống");
		const toBad = await admin.call("POST", "redirects", { from: "/cu", to: "https://evil.test/phish" });
		expect(toBad.status).toBe(400);
		expect(toBad.error.fields.to).toContain("tunglamhoaphuc.com");
		expect((await admin.call("POST", "redirects", { from: "/cu", to: "//evil.test" })).status).toBe(400);
		expect((await admin.call("POST", "redirects", { from: "/cu", to: "/moi", code: 303 })).status).toBe(400);
		expect((await admin.call("POST", "redirects", { from: "/cu", to: "/cu" })).error.fields.to).toContain("trùng");
		expect((await admin.call("POST", "redirects", { from: "/cu", to: "https://www.tunglamhoaphuc.com/cu/?a=1" })).error.fields.to).toContain("trùng");
		expect(count(w.raw, "redirect")).toBe(0);
	});

	it("answers 409 for a second redirect from the same path", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		await admin.call("POST", "redirects", { from: "/cu", to: "/moi" });
		const again = await admin.call("POST", "redirects", { from: "/cu/", to: "/khac" });
		expect(again.status).toBe(409);
		expect(again.error.code).toBe("duplicate");
		expect(count(w.raw, "redirect")).toBe(1);
	});

	it("refuses a redirect that would run in a circle, however long the way round", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		await admin.call("POST", "redirects", { from: "/b", to: "/c" });
		await admin.call("POST", "redirects", { from: "/c", to: "/d" });
		await admin.call("POST", "redirects", { from: "/d", to: "/e" });
		const loop = await admin.call("POST", "redirects", { from: "/e", to: "/b" });
		expect(loop.status).toBe(400);
		expect(loop.error.fields.to).toContain("vòng lặp");
		const direct = await admin.call("POST", "redirects", { from: "/a", to: "/a" });
		expect(direct.status).toBe(400);
		// a chain that ends is fine; switching an old link back on is checked too
		expect((await admin.call("POST", "redirects", { from: "/a", to: "/b" })).status).toBe(200);
		const edit = await admin.call("PATCH", `redirects/${id("/d")}`, { to: "https://www.tunglamhoaphuc.com/a" });
		expect(edit.status).toBe(400);
		expect(w.raw.prepare("SELECT to_path FROM redirect WHERE from_path = '/d'").get()).toEqual({ to_path: "/e" });
	});

	it("lists with search, status filter and paging", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		for (let i = 0; i < 7; i++) await admin.call("POST", "redirects", { from: `/cu-${i}`, to: `/moi-${i}`, note: i === 3 ? "đặc biệt" : "", active: i !== 4 });
		const all = await admin.call("GET", "redirects?pageSize=5");
		expect(all.json.meta).toMatchObject({ total: 7, pageSize: 5 });
		expect(all.data).toHaveLength(5);
		expect((await admin.call("GET", "redirects?q=đặc")).data.map((r: { from: string }) => r.from)).toEqual(["/cu-3"]);
		expect((await admin.call("GET", "redirects?q=moi-5")).data).toHaveLength(1);
		expect((await admin.call("GET", "redirects?active=0")).data.map((r: { from: string }) => r.from)).toEqual(["/cu-4"]);
	});

	it("follows the rights: an Editor may look and change but not add or remove, an Author has none", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		await admin.call("POST", "redirects", { from: "/cu", to: "/moi" });
		const editor = await w.as("editor@example.test");
		expect((await editor.call("GET", "redirects")).status).toBe(200);
		expect((await editor.call("PATCH", `redirects/${id("/cu")}`, { note: "ok" })).status).toBe(200);
		expect((await editor.call("POST", "redirects", { from: "/x", to: "/y" })).status).toBe(403);
		expect((await editor.call("POST", "redirects/import", { rows: [{ from: "/x", to: "/y" }] })).status).toBe(403);
		expect((await editor.call("DELETE", `redirects/${id("/cu")}`)).status).toBe(403);
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "redirects")).status).toBe(403);
		expect(count(w.raw, "redirect")).toBe(1);
	});
});

describe("redirect import", () => {
	it("adds the good rows and reports every other row with its reason", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		await admin.call("POST", "redirects", { from: "/co-san", to: "/x" });
		await admin.call("POST", "redirects", { from: "/z", to: "/y1" });
		const result = await admin.call("POST", "redirects/import", {
			rows: [
				{ from: "/ok-1", to: "/dich-1" },
				{ from: "/ok-2", to: "https://www.tunglamhoaphuc.com/dich-2", code: "302" },
				{ from: "/co-san", to: "/khac" },
				{ from: "/ok-1/", to: "/dich-trung" },
				{ from: "/quan-tri/a", to: "/b" },
				{ from: "/ngoai", to: "https://evil.test" },
				{ from: "/ma", to: "/b", code: 404 },
				{ from: "/tu", to: "/tu" },
				{ from: "/y1", to: "/z" },
				{ from: "", to: "/b" },
			],
		});
		expect(result.status).toBe(200);
		expect(result.data).toMatchObject({ created: 2, skipped: 2, errors: 6 });
		const by = Object.fromEntries(result.data.report.map((r: { line: number; status: string }) => [r.line, r.status]));
		expect(by).toEqual({ 1: "created", 2: "created", 3: "skipped", 4: "skipped", 5: "error", 6: "error", 7: "error", 8: "error", 9: "error", 10: "error" });
		expect(result.data.report[8].message).toContain("vòng lặp");
		expect(w.raw.prepare("SELECT to_path, code FROM redirect WHERE from_path = '/ok-2'").get()).toEqual({ to_path: "https://www.tunglamhoaphuc.com/dich-2", code: 302 });
		expect(w.raw.prepare("SELECT to_path FROM redirect WHERE from_path = '/co-san'").get()).toEqual({ to_path: "/x" });
		expect(count(w.raw, "redirect")).toBe(4);
		expect(count(w.raw, "audit_log", "action = 'redirect.import'")).toBe(1);
	});

	it("stops loops made by rows of the same file", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		const result = await admin.call("POST", "redirects/import", { rows: [{ from: "/a", to: "/b" }, { from: "/b", to: "/c" }, { from: "/c", to: "/a" }] });
		expect(result.data).toMatchObject({ created: 2, errors: 1 });
		expect(result.data.report[2]).toMatchObject({ line: 3, status: "error" });
	});

	it("takes up to 500 rows, in one go", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		const rows = Array.from({ length: 500 }, (_, i) => ({ from: `/cu/${i}`, to: `/moi/${i}` }));
		const result = await admin.call("POST", "redirects/import", { rows });
		expect(result.data).toMatchObject({ created: 500, errors: 0 });
		expect(count(w.raw, "redirect")).toBe(500);
		const tooMany = await admin.call("POST", "redirects/import", { rows: [...rows, { from: "/them", to: "/nua" }] });
		expect(tooMany.status).toBe(400);
		expect((await admin.call("POST", "redirects/import", { rows: [] })).status).toBe(400);
		expect(count(w.raw, "redirect")).toBe(500);
	});
});

describe("redirect lookup for the public 404", () => {
	it("finds an active redirect with one query and counts a hit", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		await admin.call("POST", "redirects", { from: "/bài-cũ", to: "/bai-moi" });
		await admin.call("POST", "redirects", { from: "/tam-dung", to: "/b", active: false });
		await admin.call("POST", "redirects", { from: "/tam-thoi", to: "/c", code: 302 });
		const db = asD1(w.raw);
		const queries: string[] = [];
		const spy = { prepare: (sql: string) => (queries.push(sql), db.prepare(sql)) };
		expect(await findRedirect(spy, "/bài-cũ")).toEqual({ fromPath: "/bài-cũ", to: "/bai-moi", code: 301 });
		expect(queries).toHaveLength(1);
		// asked in its encoded form, or with a closing slash
		expect(await findRedirect(db, "/b%C3%A0i-c%C5%A9")).toMatchObject({ to: "/bai-moi" });
		expect(await findRedirect(db, "/bài-cũ/")).toMatchObject({ to: "/bai-moi" });
		expect(await findRedirect(db, "/tam-thoi")).toMatchObject({ to: "/c", code: 302 });
		expect(await findRedirect(db, "/tam-dung")).toBeNull();
		expect(await findRedirect(db, "/khong-co")).toBeNull();
		await countHit({ prepare: (sql) => ({ bind: (...values) => ({ all: async () => ({ results: [] }), run: async () => w.raw.prepare(sql).run(...(values as never[])) }) }) }, "/bài-cũ");
		expect(w.raw.prepare("SELECT hits FROM redirect WHERE from_path = '/bài-cũ'").get()).toEqual({ hits: 1 });
	});

	it("never looks up the admin's or the system's addresses, and never follows a bad row out of the site", async () => {
		const w = await world(SEEDS);
		w.raw.prepare("INSERT INTO redirect (from_path, to_path, code, active) VALUES ('/quan-tri/x', '/a', 301, 1), ('/ngoai', 'https://evil.test/x', 301, 1), ('/ngoai2', '//evil.test', 301, 1)").run();
		const db = asD1(w.raw);
		const queries: string[] = [];
		const spy = { prepare: (sql: string) => (queries.push(sql), db.prepare(sql)) };
		expect(await findRedirect(spy, "/quan-tri/x")).toBeNull();
		expect(await findRedirect(spy, "/api/quan-tri/v1/x")).toBeNull();
		expect(queries).toHaveLength(0);
		expect(await findRedirect(db, "/ngoai")).toBeNull();
		expect(await findRedirect(db, "/ngoai2")).toBeNull();
	});
});

describe("reading a pasted redirect list", () => {
	it("takes comma, semicolon or tab, an optional code, quotes, comments and a header line", () => {
		const { rows, skippedHeader } = parseRedirectList('﻿from,to,code\n/a,/b\n/c;/d;302\n"/e",/f,301\n/g\t/h\n# ghi chú\n\n/i,/j,');
		expect(skippedHeader).toBe(true);
		expect(rows).toEqual([{ from: "/a", to: "/b" }, { from: "/c", to: "/d", code: "302" }, { from: "/e", to: "/f", code: "301" }, { from: "/g", to: "/h" }, { from: "/i", to: "/j" }]);
		expect(parseRedirectList("/a,/b").skippedHeader).toBe(false);
		expect(parseRedirectList("").rows).toEqual([]);
	});
});
