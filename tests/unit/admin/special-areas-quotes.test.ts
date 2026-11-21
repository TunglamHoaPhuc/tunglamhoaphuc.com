import { describe, expect, it } from "vitest";
import { count, specialWorld } from "../helpers/specialWorld";

describe("areas", () => {
	it("lists the live areas in order with their statue counts, and reads one", async () => {
		const w = await specialWorld();
		w.raw.prepare("INSERT INTO statue (id, slug, name, area_id) VALUES ('s1', 's1', 'A', 'tam-bao'), ('s2', 's2', 'B', 'tam-bao')").run();
		const editor = await w.as("editor@example.test");
		const list = await editor.call("GET", "areas");
		expect(list.data.areas.map((area: { id: string; statueCount: number }) => [area.id, area.statueCount])).toEqual([["tam-bao", 2], ["to-duong", 0], ["giang-duong", 0]]);
		expect((await editor.call("GET", "areas/to-duong")).data).toMatchObject({ name: "Tổ Đường", version: 1, visible: true, mapX: null });
		expect((await editor.call("GET", "areas/khong-co")).status).toBe(404);
	});

	it("updates the texts, cover, pin and visibility, with a revision, picture usage and a diff in the audit log", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const saved = await editor.call("PATCH", "areas/tam-bao", { version: 1, name: "Tam Bảo", subtitle: "Đại Hùng Bảo Điện", coverMediaId: "media-1", coverPosition: "center 30%", mapX: 50.5, mapY: 49, intro: "Giới thiệu", visible: false, position: 5 });
		expect(saved.status).toBe(200);
		expect(saved.data).toMatchObject({ version: 2, subtitle: "Đại Hùng Bảo Điện", coverUrl: "/anh-goc/s2-cnv03/cms/media-1/v1/a1.png", mapX: 50.5, mapY: 49, visible: false, position: 5 });
		expect(count(w.raw, "revision", "entity_type = 'area' AND entity_id = 'tam-bao' AND version = 2")).toBe(1);
		expect(count(w.raw, "media_usage", "entity_type = 'area' AND entity_id = 'tam-bao' AND media_id = 'media-1'")).toBe(1);
		const log = w.raw.prepare("SELECT data_before, data_after FROM audit_log WHERE action = 'area.update'").get() as { data_before: string; data_after: string };
		expect(JSON.parse(log.data_before)).toMatchObject({ subtitle: "", visible: true, mapX: null });
		expect(JSON.parse(log.data_after)).toMatchObject({ subtitle: "Đại Hùng Bảo Điện", visible: false, mapX: 50.5 });
		expect(JSON.parse(log.data_after)).not.toHaveProperty("name");
	});

	it("refuses a pin outside 0-100, a pin with one coordinate, an empty name, an unknown picture and a stale version", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PATCH", "areas/tam-bao", { version: 1, mapX: 101, mapY: 10 })).error.fields.mapX).toBeTruthy();
		expect((await editor.call("PATCH", "areas/tam-bao", { version: 1, mapX: 10, mapY: -1 })).error.fields.mapY).toBeTruthy();
		expect((await editor.call("PATCH", "areas/tam-bao", { version: 1, mapX: 10 })).status).toBe(400);
		expect((await editor.call("PATCH", "areas/tam-bao", { version: 1, name: " " })).status).toBe(400);
		expect((await editor.call("PATCH", "areas/tam-bao", { version: 1, coverMediaId: "khong-co" })).status).toBe(400);
		await editor.call("PATCH", "areas/tam-bao", { version: 1, subtitle: "A" });
		expect((await editor.call("PATCH", "areas/tam-bao", { version: 1, subtitle: "B" })).status).toBe(409);
		expect((await editor.call("PATCH", "areas/khong-co", { version: 1, subtitle: "B" })).status).toBe(404);
		// pins at the edges are fine, and the pin can be cleared
		expect((await editor.call("PATCH", "areas/to-duong", { version: 1, mapX: 0, mapY: 100 })).status).toBe(200);
		expect((await editor.call("PATCH", "areas/to-duong", { version: 2, mapX: null, mapY: null })).data.mapX).toBeNull();
	});

	it("cleans the HTML of the content", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const saved = await editor.call("PATCH", "areas/tam-bao", { version: 1, contentHtml: '<p>Chào</p><script>x</script><a href="javascript:1">y</a>' });
		expect(saved.data.contentHtml).toBe("<p>Chào</p>y");
	});

	it("sets the featured areas in the given order and switches the others off", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const first = await editor.call("PUT", "areas/featured", { ids: ["giang-duong", "tam-bao"] });
		expect(first.data.areas.filter((area: { featured: boolean }) => area.featured).sort((a: { featuredPosition: number }, b: { featuredPosition: number }) => a.featuredPosition - b.featuredPosition).map((area: { id: string; featuredPosition: number }) => [area.id, area.featuredPosition])).toEqual([["giang-duong", 0], ["tam-bao", 1]]);
		const second = await editor.call("PUT", "areas/featured", { ids: ["to-duong"] });
		expect(second.data.areas.filter((area: { featured: boolean }) => area.featured).map((area: { id: string }) => area.id)).toEqual(["to-duong"]);
		expect(w.raw.prepare("SELECT id FROM area WHERE featured = 1").all()).toEqual([{ id: "to-duong" }]);
		const log = w.raw.prepare("SELECT data_before, data_after FROM audit_log WHERE action = 'area.featured' ORDER BY id DESC").get() as { data_before: string; data_after: string };
		expect(JSON.parse(log.data_before)).toEqual({ ids: ["giang-duong", "tam-bao"] });
		expect(JSON.parse(log.data_after)).toEqual({ ids: ["to-duong"] });
		expect((await editor.call("PUT", "areas/featured", { ids: [] })).data.areas.some((area: { featured: boolean }) => area.featured)).toBe(false);
	});

	it("refuses unknown or repeated areas and too many in the featured list", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PUT", "areas/featured", { ids: ["khong-co"] })).status).toBe(400);
		expect((await editor.call("PUT", "areas/featured", { ids: ["tam-bao", "tam-bao"] })).status).toBe(400);
		expect((await editor.call("PUT", "areas/featured", { ids: Array.from({ length: 13 }, (_, i) => `a${i}`) })).status).toBe(400);
		expect(count(w.raw, "area", "featured = 1")).toBe(0);
	});

	it("moves an area to the trash (and off the featured list), leaving the others", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		await root.call("PUT", "areas/featured", { ids: ["tam-bao"] });
		expect((await root.call("DELETE", "areas/tam-bao")).status).toBe(204);
		expect((await root.call("GET", "areas/tam-bao")).status).toBe(404);
		expect((await root.call("GET", "areas")).data.areas.map((area: { id: string }) => area.id)).toEqual(["to-duong", "giang-duong"]);
		expect(w.raw.prepare("SELECT featured, deleted_by FROM area WHERE id = 'tam-bao'").get()).toEqual({ featured: 0, deleted_by: "root" });
		expect((await root.call("DELETE", "areas/tam-bao")).status).toBe(404);
	});

	it("lets an Author read only", async () => {
		const w = await specialWorld();
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "areas")).status).toBe(200);
		expect((await author.call("PATCH", "areas/tam-bao", { version: 1, name: "X" })).status).toBe(403);
		expect((await author.call("PUT", "areas/featured", { ids: [] })).status).toBe(403);
		expect((await author.call("DELETE", "areas/tam-bao")).status).toBe(403);
	});
});

describe("quotes", () => {
	it("creates quotes at the end of the list, trimmed, active by default", async () => {
		const w = await specialWorld();
		const admin = await w.as("admin@example.test");
		const one = await admin.call("POST", "quotes", { text: "  Buông bỏ là tự tại.  ", author: "Thầy", source: "Pháp thoại" });
		const two = await admin.call("POST", "quotes", { text: "Niệm Phật là hạnh phúc.", active: false, sourceUrl: "https://example.test/bai" });
		expect(one.data).toMatchObject({ text: "Buông bỏ là tự tại.", author: "Thầy", source: "Pháp thoại", active: true, position: 1, createdBy: "admin" });
		expect(two.data).toMatchObject({ active: false, position: 2, sourceUrl: "https://example.test/bai" });
		expect(count(w.raw, "audit_log", "action = 'quote.create'")).toBe(2);
	});

	it("refuses an empty text and a link that is not https or relative", async () => {
		const w = await specialWorld();
		const admin = await w.as("admin@example.test");
		expect((await admin.call("POST", "quotes", { text: "  " })).error.fields.text).toBeTruthy();
		expect((await admin.call("POST", "quotes", { text: "x", sourceUrl: "javascript:alert(1)" })).error.fields.sourceUrl).toBeTruthy();
		expect((await admin.call("POST", "quotes", { text: "x".repeat(2001) })).status).toBe(400);
		expect(count(w.raw, "quote")).toBe(0);
	});

	it("updates a quote, switches it on and off, and logs what changed", async () => {
		const w = await specialWorld();
		const admin = await w.as("admin@example.test");
		const made = await admin.call("POST", "quotes", { text: "Một" });
		const off = await admin.call("PATCH", `quotes/${made.data.id}`, { active: false });
		expect(off.data).toMatchObject({ active: false, text: "Một" });
		expect((await admin.call("PATCH", `quotes/${made.data.id}`, { text: "Một (sửa)", author: "Thầy" })).data).toMatchObject({ text: "Một (sửa)", author: "Thầy", active: false });
		const logs = w.raw.prepare("SELECT data_before, data_after FROM audit_log WHERE action = 'quote.update' ORDER BY id").all() as { data_before: string; data_after: string }[];
		expect(JSON.parse(logs[0].data_before)).toEqual({ active: true });
		expect(JSON.parse(logs[0].data_after)).toEqual({ active: false });
		expect((await admin.call("PATCH", "quotes/khong-co", { active: true })).status).toBe(404);
		expect((await admin.call("PATCH", `quotes/${made.data.id}`, { text: "" })).status).toBe(400);
	});

	it("reorders; quotes not named follow in their old order; unknown or repeated ids are refused", async () => {
		const w = await specialWorld();
		const admin = await w.as("admin@example.test");
		const ids: string[] = [];
		for (const label of ["A", "B", "C", "D"]) ids.push((await admin.call("POST", "quotes", { text: label })).data.id);
		const order = async () => (await admin.call("GET", "quotes")).data.map((item: { text: string }) => item.text);
		expect(await order()).toEqual(["A", "B", "C", "D"]);
		expect((await admin.call("POST", "quotes/reorder", { ids: [ids[3], ids[1]] })).status).toBe(204);
		expect(await order()).toEqual(["D", "B", "A", "C"]);
		expect((await admin.call("POST", "quotes/reorder", { ids: [ids[0], ids[0]] })).status).toBe(400);
		expect((await admin.call("POST", "quotes/reorder", { ids: ["khong-co"] })).status).toBe(400);
		expect(await order()).toEqual(["D", "B", "A", "C"]);
		expect(w.raw.prepare("SELECT data_after FROM audit_log WHERE action = 'quote.reorder'").get()).toEqual({ data_after: JSON.stringify({ ids: [ids[3], ids[1], ids[0], ids[2]] }) });
	});

	it("filters by active and by a word, and pages", async () => {
		const w = await specialWorld();
		const admin = await w.as("admin@example.test");
		await admin.call("POST", "quotes", { text: "Niệm Phật", author: "Thầy A" });
		await admin.call("POST", "quotes", { text: "Buông bỏ", author: "Thầy B", active: false });
		await admin.call("POST", "quotes", { text: "Tinh tấn", source: "Kinh Pháp Cú" });
		const texts = async (query: string) => (await admin.call("GET", `quotes?${query}`)).data.map((item: { text: string }) => item.text);
		expect(await texts("active=1")).toEqual(["Niệm Phật", "Tinh tấn"]);
		expect(await texts("active=0")).toEqual(["Buông bỏ"]);
		expect(await texts("q=Thầy B")).toEqual(["Buông bỏ"]);
		expect(await texts("q=Pháp Cú")).toEqual(["Tinh tấn"]);
		expect(await texts("q=%25")).toEqual([]);
		expect((await admin.call("GET", "quotes?pageSize=2&page=2")).data).toHaveLength(1);
	});

	it("moves a quote to the trash, out of the list and the reorder", async () => {
		const w = await specialWorld();
		const admin = await w.as("admin@example.test");
		const one = await admin.call("POST", "quotes", { text: "Một" });
		const two = await admin.call("POST", "quotes", { text: "Hai" });
		expect((await admin.call("DELETE", `quotes/${one.data.id}`)).status).toBe(204);
		expect((await admin.call("GET", `quotes/${one.data.id}`)).status).toBe(404);
		expect((await admin.call("GET", "quotes")).data.map((item: { id: string }) => item.id)).toEqual([two.data.id]);
		expect((await admin.call("POST", "quotes/reorder", { ids: [one.data.id] })).status).toBe(400);
		expect(w.raw.prepare("SELECT deleted_by FROM quote WHERE id = ?").get(one.data.id)).toEqual({ deleted_by: "admin" });
		expect((await admin.call("DELETE", `quotes/${one.data.id}`)).status).toBe(404);
	});

	it("follows the role catalogue: Editor may edit and reorder but not create or delete; Author reads", async () => {
		const w = await specialWorld();
		const admin = await w.as("admin@example.test");
		const made = await admin.call("POST", "quotes", { text: "Một" });
		const editor = await w.as("editor@example.test");
		expect((await editor.call("GET", "quotes")).status).toBe(200);
		expect((await editor.call("PATCH", `quotes/${made.data.id}`, { active: false })).status).toBe(200);
		expect((await editor.call("POST", "quotes/reorder", { ids: [made.data.id] })).status).toBe(204);
		expect((await editor.call("POST", "quotes", { text: "Hai" })).status).toBe(403);
		expect((await editor.call("DELETE", `quotes/${made.data.id}`)).status).toBe(403);
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "quotes")).status).toBe(200);
		expect((await author.call("PATCH", `quotes/${made.data.id}`, { active: true })).status).toBe(403);
		expect((await author.call("POST", "quotes/reorder", { ids: [] })).status).toBe(403);
	});
});
