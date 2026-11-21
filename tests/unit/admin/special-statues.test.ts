import { describe, expect, it } from "vitest";
import { cleanBodyHtml } from "../../../src/admin/special/html";
import { count, specialWorld } from "../helpers/specialWorld";

const STATUE = { name: "Phật A Di Đà", code: "TP0001", assemblyId: "assembly::chu-phat", areaId: "tam-bao", isMain: true, status: "published" };

describe("creating statues", () => {
	it("stores the statue with its slug, a revision, the picture usage and an audit entry", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const created = await editor.call("POST", "statues", { ...STATUE, imageMediaId: "media-1", subtitle: "Giáo chủ cõi Cực Lạc", specs: { "Chất liệu": "Đồng" }, quoteText: "Nam mô A Di Đà Phật", quoteAuthor: "Tổ sư" });
		expect(created.status).toBe(200);
		expect(created.data).toMatchObject({ slug: "phat-a-di-da", code: "TP0001", version: 1, isMain: true, assemblyName: "Chư Phật Hải Hội", areaName: "Tam Bảo", imageUrl: "/anh-goc/s2-cnv03/cms/media-1/v1/a1.png", specs: { "Chất liệu": "Đồng" } });
		expect(w.raw.prepare("SELECT quote_text, quote_author, created_by FROM statue WHERE id = ?").get(created.data.id)).toEqual({ quote_text: "Nam mô A Di Đà Phật", quote_author: "Tổ sư", created_by: "editor" });
		expect(count(w.raw, "revision", `entity_type = 'statue' AND entity_id = '${created.data.id}'`)).toBe(1);
		expect(count(w.raw, "media_usage", `entity_type = 'statue' AND entity_id = '${created.data.id}' AND media_id = 'media-1'`)).toBe(1);
		expect(count(w.raw, "audit_log", "action = 'statue.create'")).toBe(1);
	});

	it("answers 409 code_taken for a code in use (any case), allows many empty codes, and frees a trashed code", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const first = await root.call("POST", "statues", STATUE);
		const clash = await root.call("POST", "statues", { ...STATUE, name: "Tượng khác", code: "tp0001" });
		expect(clash.status).toBe(409);
		expect(clash.error.code).toBe("code_taken");
		expect((await root.call("POST", "statues", { name: "Không mã một" })).status).toBe(200);
		expect((await root.call("POST", "statues", { name: "Không mã hai" })).status).toBe(200);
		await root.call("DELETE", `statues/${first.data.id}`);
		expect((await root.call("POST", "statues", { ...STATUE, name: "Tượng khác" })).status).toBe(200);
	});

	it("answers 409 slug_taken, and 400 for a bad code, unknown assembly, area, cluster or picture, and too many specs", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		await root.call("POST", "statues", { name: "Một", slug: "mot" });
		expect((await root.call("POST", "statues", { name: "Hai", slug: "mot" })).error.code).toBe("slug_taken");
		expect((await root.call("POST", "statues", { name: "Hai", code: "TP 12!" })).error.fields.code).toBeTruthy();
		expect((await root.call("POST", "statues", { name: "Hai", assemblyId: "event::cong-tu" })).error.fields.assemblyId).toBeTruthy();
		expect((await root.call("POST", "statues", { name: "Hai", areaId: "khong-co" })).error.fields.areaId).toBeTruthy();
		expect((await root.call("POST", "statues", { name: "Hai", clusterId: "khong-co" })).error.fields.clusterId).toBeTruthy();
		expect((await root.call("POST", "statues", { name: "Hai", imageMediaId: "khong-co" })).error.fields.imageMediaId).toBeTruthy();
		const many = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, "v"]));
		expect((await root.call("POST", "statues", { name: "Hai", specs: many })).error.fields.specs).toBeTruthy();
		expect((await root.call("POST", "statues", { name: "" })).error.fields.name).toBeTruthy();
		expect(count(w.raw, "statue")).toBe(1);
	});

	it("suggests the next TP code from the highest one in use", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "statues/next-code")).data.code).toBe("TP0001");
		await root.call("POST", "statues", { name: "A", code: "TP0009" });
		await root.call("POST", "statues", { name: "B", code: "TP0123" });
		await root.call("POST", "statues", { name: "C", code: "KHAC1" });
		expect((await root.call("GET", "statues/next-code")).data.code).toBe("TP0124");
	});
});

describe("changing statues", () => {
	it("keeps an imported slug as it is when saving, and changes it only when asked", async () => {
		const w = await specialWorld();
		w.raw.prepare("INSERT INTO statue (id, code, slug, name, version) VALUES ('st-old', 'TP0005', 'a-di-da_tp0005', 'A Di Đà', 1)").run();
		const root = await w.as("root@example.test");
		const saved = await root.call("PATCH", "statues/st-old", { version: 1, subtitle: "Mới" });
		expect(saved.data).toMatchObject({ slug: "a-di-da_tp0005", subtitle: "Mới", version: 2, status: "published" });
		expect((await root.call("PATCH", "statues/st-old", { version: 2, slug: "Địa chỉ mới" })).data.slug).toBe("dia-chi-moi");
	});

	it("answers 409 to a save on an old version, 404 for an unknown statue, 400 for a missing version", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const created = await root.call("POST", "statues", STATUE);
		await root.call("PATCH", `statues/${created.data.id}`, { version: 1, subtitle: "A" });
		const stale = await root.call("PATCH", `statues/${created.data.id}`, { version: 1, subtitle: "B" });
		expect(stale.status).toBe(409);
		expect(w.raw.prepare("SELECT subtitle FROM statue WHERE id = ?").get(created.data.id)).toEqual({ subtitle: "A" });
		expect((await root.call("PATCH", "statues/khong-co", { version: 1, subtitle: "B" })).status).toBe(404);
		expect((await root.call("PATCH", `statues/${created.data.id}`, { subtitle: "B" })).status).toBe(400);
	});

	it("refuses a code taken by another statue on update, but not its own", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		await root.call("POST", "statues", STATUE);
		const second = await root.call("POST", "statues", { name: "Hai", code: "TP0002" });
		expect((await root.call("PATCH", `statues/${second.data.id}`, { version: 1, code: "TP0001" })).error.code).toBe("code_taken");
		expect((await root.call("PATCH", `statues/${second.data.id}`, { version: 1, code: "TP0002", subtitle: "x" })).status).toBe(200);
	});

	it("cleans the article HTML before storing it", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const dirty = '<p onclick="x()">Chào <strong>bạn</strong></p><script>alert(1)</script><a href="javascript:alert(1)">xấu</a><a href="https://ok.example/a" target="_blank">tốt</a><img src=x onerror=alert(1)><h1>Lớn</h1>';
		const created = await root.call("POST", "statues", { name: "Có bài", body: dirty });
		expect(created.data.body).toBe('<p>Chào <strong>bạn</strong></p>xấu<a href="https://ok.example/a" rel="noopener noreferrer">tốt</a><h2>Lớn</h2>');
		expect(w.raw.prepare("SELECT body FROM statue WHERE id = ?").get(created.data.id)).toEqual({ body: created.data.body });
	});

	it("moves a statue to an area and gives it the area code its neighbours use", async () => {
		const w = await specialWorld();
		w.raw.prepare("INSERT INTO statue (id, slug, name, area_id, area_code) VALUES ('st-a', 'a', 'A', 'tam-bao', 'tam_bao')").run();
		const root = await w.as("root@example.test");
		const created = await root.call("POST", "statues", { name: "Mới", areaId: "tam-bao" });
		expect(w.raw.prepare("SELECT area_code FROM statue WHERE id = ?").get(created.data.id)).toEqual({ area_code: "tam_bao" });
		await root.call("PATCH", `statues/${created.data.id}`, { version: 1, areaId: "to-duong" });
		expect(w.raw.prepare("SELECT area_code FROM statue WHERE id = ?").get(created.data.id)).toEqual({ area_code: "" });
		await root.call("PATCH", `statues/${created.data.id}`, { version: 2, subtitle: "x" });
		expect(w.raw.prepare("SELECT area_id FROM statue WHERE id = ?").get(created.data.id)).toEqual({ area_id: "to-duong" });
	});

	it("needs the publish right to publish, and the delete right and ownership rules for trashing", async () => {
		const w = await specialWorld();
		w.raw.prepare("DELETE FROM role_permission WHERE role_id = 'role-editor' AND module = 'statues' AND action = 'publish'").run();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", "statues", { ...STATUE, status: "published" })).status).toBe(403);
		const draft = await editor.call("POST", "statues", { ...STATUE, status: "draft" });
		expect(draft.status).toBe(200);
		expect((await editor.call("PATCH", `statues/${draft.data.id}`, { version: 1, status: "hidden" })).status).toBe(403);
		expect((await editor.call("DELETE", `statues/${draft.data.id}`)).status).toBe(204);
		expect(w.raw.prepare("SELECT deleted_by FROM statue WHERE id = ?").get(draft.data.id)).toEqual({ deleted_by: "editor" });
		expect((await editor.call("GET", `statues/${draft.data.id}`)).status).toBe(404);
	});
});

describe("angle pictures, related statues and art variations", () => {
	it("saves the pictures in order with their labels, bumps the version and keeps the usage in step", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const created = await editor.call("POST", "statues", { ...STATUE, imageMediaId: "media-1" });
		const saved = await editor.call("PUT", `statues/${created.data.id}/images`, { version: 1, images: [{ mediaId: "media-3", label: "Chính diện" }, { mediaId: "media-2", label: "Bên trái", imagePosition: "center 20%" }] });
		expect(saved.status).toBe(200);
		expect(saved.data.version).toBe(2);
		expect(saved.data.images).toMatchObject([{ mediaId: "media-3", label: "Chính diện", url: "/anh-goc/s2-cnv03/cms/media-3/v1/a3.png" }, { mediaId: "media-2", label: "Bên trái", imagePosition: "center 20%" }]);
		expect(w.raw.prepare("SELECT position, media_id FROM statue_image WHERE statue_id = ? ORDER BY position").all(created.data.id)).toEqual([{ position: 0, media_id: "media-3" }, { position: 1, media_id: "media-2" }]);
		expect(count(w.raw, "media_usage", `entity_id = '${created.data.id}'`)).toBe(3);
		// replaced: the old pictures are no longer used, and the main one still is
		await editor.call("PUT", `statues/${created.data.id}/images`, { version: 2, images: [{ mediaId: "media-4" }] });
		expect(w.raw.prepare("SELECT media_id FROM media_usage WHERE entity_id = ? ORDER BY media_id").all(created.data.id)).toEqual([{ media_id: "media-1" }, { media_id: "media-4" }]);
		expect(count(w.raw, "revision", `entity_id = '${created.data.id}'`)).toBe(3);
	});

	it("refuses an unknown picture, more than 20 pictures and an old version", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const created = await editor.call("POST", "statues", STATUE);
		const url = `statues/${created.data.id}/images`;
		expect((await editor.call("PUT", url, { version: 1, images: [{ mediaId: "khong-co" }] })).status).toBe(400);
		expect((await editor.call("PUT", url, { version: 1, images: Array.from({ length: 21 }, () => ({ mediaId: "media-1" })) })).status).toBe(400);
		expect((await editor.call("PUT", url, { version: 7, images: [] })).status).toBe(409);
		expect((await editor.call("PUT", "statues/khong-co/images", { version: 1, images: [] })).status).toBe(404);
		expect(count(w.raw, "statue_image")).toBe(0);
	});

	it("saves hand-picked related statues in order, and refuses itself, duplicates and unknown ones", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const main = await editor.call("POST", "statues", { name: "Chính" });
		const b = await editor.call("POST", "statues", { name: "Bê", code: "TP0002" });
		const c = await editor.call("POST", "statues", { name: "Xê", code: "TP0003" });
		const url = `statues/${main.data.id}/related`;
		const saved = await editor.call("PUT", url, { version: 1, related: [c.data.id, b.data.id] });
		expect(saved.data.related.map((item: { name: string }) => item.name)).toEqual(["Xê", "Bê"]);
		expect((await editor.call("PUT", url, { version: 2, related: [main.data.id] })).error.fields.related).toBeTruthy();
		expect((await editor.call("PUT", url, { version: 2, related: [b.data.id, b.data.id] })).error.fields.related).toBeTruthy();
		expect((await editor.call("PUT", url, { version: 2, related: ["khong-co"] })).error.fields.related).toBeTruthy();
		expect((await editor.call("PUT", url, { version: 2, related: [] })).data.related).toEqual([]);
		expect(count(w.raw, "statue_related")).toBe(0);
	});

	it("drops a trashed statue from the related list shown and cascades when removed for good", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const main = await root.call("POST", "statues", { name: "Chính" });
		const other = await root.call("POST", "statues", { name: "Phụ", code: "TP0002" });
		await root.call("PUT", `statues/${main.data.id}/related`, { version: 1, related: [other.data.id] });
		await root.call("DELETE", `statues/${other.data.id}`);
		expect((await root.call("GET", `statues/${main.data.id}`)).data.related).toEqual([]);
	});

	it("edits the list of art variations, keeping the ids of those that stay", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const created = await editor.call("POST", "statues", STATUE);
		const other = await editor.call("POST", "statues", { name: "Tượng liên kết", code: "TP0002" });
		const url = `statues/${created.data.id}/variations`;
		const first = await editor.call("PUT", url, { version: 1, variations: [{ title: "Tranh một", location: "Chùa A", meaning: "Ý nghĩa", imageMediaId: "media-2" }, { title: "Tranh hai", artStatueId: other.data.id }] });
		expect(first.data.variations).toHaveLength(2);
		expect(first.data.variations[0]).toMatchObject({ title: "Tranh một", imageMediaId: "media-2", imageUrl: "/anh-goc/s2-cnv03/cms/media-2/v1/a2.png" });
		expect(first.data.variations[1].artStatueId).toBe(other.data.id);
		const keptId = first.data.variations[1].id;
		const second = await editor.call("PUT", url, { version: 2, variations: [{ id: keptId, title: "Tranh hai (sửa)" }] });
		expect(second.data.variations).toHaveLength(1);
		expect(second.data.variations[0]).toMatchObject({ id: keptId, title: "Tranh hai (sửa)", variationId: first.data.variations[1].variationId });
		expect(count(w.raw, "media_usage", `entity_id = '${created.data.id}' AND media_id = 'media-2'`)).toBe(0);
		expect((await editor.call("PUT", url, { version: 3, variations: [{ artStatueId: "khong-co" }] })).status).toBe(400);
		expect((await editor.call("PUT", url, { version: 3, variations: [{ imageMediaId: "khong-co" }] })).status).toBe(400);
	});
});

describe("listing statues and who may touch them", () => {
	it("filters by name or code, assembly, area, kind and status", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		await root.call("POST", "statues", { ...STATUE });
		await root.call("POST", "statues", { name: "Quán Thế Âm", code: "TP0002", areaId: "to-duong", isMain: false, status: "draft" });
		const names = async (query: string) => (await root.call("GET", `statues?${query}`)).data.map((item: { name: string }) => item.name).sort();
		expect(await names("")).toEqual(["Phật A Di Đà", "Quán Thế Âm"]);
		expect(await names("q=tp0002")).toEqual(["Quán Thế Âm"]);
		expect(await names("q=di%20da")).toEqual([]); // accents are not folded: an honest limit of LIKE
		expect(await names("q=A Di")).toEqual(["Phật A Di Đà"]);
		expect(await names("assembly=assembly::chu-phat")).toEqual(["Phật A Di Đà"]);
		expect(await names("area=to-duong")).toEqual(["Quán Thế Âm"]);
		expect(await names("main=0")).toEqual(["Quán Thế Âm"]);
		expect(await names("status=draft")).toEqual(["Quán Thế Âm"]);
		expect((await root.call("GET", "statues?pageSize=1")).json.meta).toEqual({ page: 1, pageSize: 1, total: 2 });
	});

	it("serves the choices for the form, and creates a cluster once", async () => {
		const w = await specialWorld();
		const editor = await w.as("editor@example.test");
		const options = await editor.call("GET", "statues/options");
		expect(options.data.assemblies).toEqual([{ id: "assembly::chu-phat", name: "Chư Phật Hải Hội" }]);
		expect(options.data.areas.map((item: { id: string }) => item.id)).toEqual(["tam-bao", "to-duong", "giang-duong"]);
		const cluster = await editor.call("POST", "statues/clusters", { name: "Hoa Nghiêm Tam Thánh", assemblyId: "assembly::chu-phat" });
		expect(cluster.data).toMatchObject({ name: "Hoa Nghiêm Tam Thánh", assemblyId: "assembly::chu-phat" });
		expect((await editor.call("POST", "statues/clusters", { name: "hoa nghiêm tam thánh" })).error.code).toBe("name_taken");
		const statue = await editor.call("POST", "statues", { name: "Tượng", clusterId: cluster.data.id });
		expect(statue.data.clusterName).toBe("Hoa Nghiêm Tam Thánh");
	});

	it("lets an Author read only", async () => {
		const w = await specialWorld();
		const root = await w.as("root@example.test");
		const created = await root.call("POST", "statues", STATUE);
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "statues")).status).toBe(200);
		expect((await author.call("GET", `statues/${created.data.id}`)).status).toBe(200);
		expect((await author.call("GET", "statues/next-code")).status).toBe(200);
		expect((await author.call("POST", "statues", STATUE)).status).toBe(403);
		expect((await author.call("PATCH", `statues/${created.data.id}`, { version: 1, name: "X" })).status).toBe(403);
		expect((await author.call("PUT", `statues/${created.data.id}/images`, { version: 1, images: [] })).status).toBe(403);
		expect((await author.call("PUT", `statues/${created.data.id}/related`, { version: 1, related: [] })).status).toBe(403);
		expect((await author.call("DELETE", `statues/${created.data.id}`)).status).toBe(403);
		expect((await author.call("POST", "statues/clusters", { name: "X" })).status).toBe(403);
	});
});

describe("the HTML cleaner", () => {
	it("keeps the allowed tags and a safe link, drops the rest, and closes what was left open", () => {
		expect(cleanBodyHtml("<p>Một<br>hai</p><ul><li>a</li></ul><blockquote>q</blockquote><h3>t</h3><em>x</em>")).toBe("<p>Một<br>hai</p><ul><li>a</li></ul><blockquote>q</blockquote><h3>t</h3><em>x</em>");
		expect(cleanBodyHtml("<p><b>đậm <i>nghiêng")).toBe("<p><strong>đậm <em>nghiêng</em></strong></p>");
		expect(cleanBodyHtml('<a href="/bao-tuong/x">trong</a> <a href="https://a.example/x?y=1&z=2">ngoài</a>')).toBe('<a href="/bao-tuong/x" rel="noopener noreferrer">trong</a> <a href="https://a.example/x?y=1&amp;z=2" rel="noopener noreferrer">ngoài</a>');
	});

	it("drops script, style, iframes, comments, event handlers, and links that are not https or relative", () => {
		expect(cleanBodyHtml("a<script>alert(1)</script>b<style>p{}</style>c<!-- x -->d")).toBe("abcd");
		expect(cleanBodyHtml('<iframe src="https://x"></iframe>t')).toBe("t");
		expect(cleanBodyHtml('<p style="color:red" onclick="x()">t</p>')).toBe("<p>t</p>");
		for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html,x", "//evil.example", "http://plain.example", "&#106;avascript:alert(1)", "vbscript:x", ""]) {
			expect(cleanBodyHtml(`<a href="${href}">t</a>`), href).toBe("t");
		}
		expect(cleanBodyHtml("<a>t</a>")).toBe("t");
	});

	it("shows text that looks like markup as text", () => {
		expect(cleanBodyHtml("1 < 2 và 3 > 2 &amp; &copy;")).toBe("1 &lt; 2 và 3 &gt; 2 &amp; &amp;copy;");
		expect(cleanBodyHtml("<<script>x</script>")).toBe("&lt;");
		expect(cleanBodyHtml("")).toBe("");
	});
});
