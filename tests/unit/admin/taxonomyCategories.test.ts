import { describe, expect, it } from "vitest";
import { addPost, taxonomyWorld } from "../helpers/taxonomyWorld";

const enc = encodeURIComponent;
const CONG_TU = "post:dong-chay-hoang-phap:cong-tu";

describe("listing categories", () => {
	it("lists every category with its tree depth, public path and how much uses it", async () => {
		const w = await taxonomyWorld();
		addPost(w.raw, "p1", CONG_TU);
		addPost(w.raw, "p2", CONG_TU);
		addPost(w.raw, "p3", CONG_TU, true);
		const editor = await w.as("editor@example.test");
		const list = await editor.call("GET", "categories");
		expect(list.status).toBe(200);
		const cong = list.data.find((item: { id: string }) => item.id === CONG_TU);
		expect(cong).toMatchObject({ name: "Cộng Tu Định Kỳ", depth: 0, path: "/dong-chay-hoang-phap?danh-muc=cong-tu", used: 2, counts: { posts: 2, children: 0 }, iconType: "none", visible: true });
		expect(list.data.find((item: { kind: string }) => item.kind === "event").path).toBe("/lich-tu-hoc");
		expect(list.data.find((item: { kind: string }) => item.kind === "tong-chi").path).toBe("/tong-chi-tu-hoc");
	});

	it("filters by kind and section, and answers 401 without a session", async () => {
		const w = await taxonomyWorld();
		const author = await w.as("author@example.test");
		const only = await author.call("GET", "categories?kind=post&section=tri-tue-phat-phap");
		expect(only.data.map((item: { id: string }) => item.id)).toEqual(["post:tri-tue-phat-phap:cong-tu"]);
		expect((await w.client().call("GET", "categories")).status).toBe(401);
	});

	it("GET one category, 404 when it is not there or in the trash", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("GET", `categories/${enc(CONG_TU)}`)).data.slug).toBe("cong-tu");
		expect((await editor.call("GET", "categories/khong-co")).status).toBe(404);
		w.raw.prepare("UPDATE category SET deleted_at = '2026' WHERE id = ?").run(CONG_TU);
		expect((await editor.call("GET", `categories/${enc(CONG_TU)}`)).status).toBe(404);
		expect((await editor.call("GET", "categories")).data.map((item: { id: string }) => item.id)).not.toContain(CONG_TU);
	});
});

describe("creating a category", () => {
	it("makes the id from kind, section and slug, appends after its brothers, and writes an audit entry", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		const made = await editor.call("POST", "categories", { kind: "post", section: "dong-chay-hoang-phap", name: "Đại Lễ Phật Đản", template: "tin-tuc", description: "Các đại lễ" });
		expect(made.status).toBe(200);
		expect(made.data).toMatchObject({ id: "post:dong-chay-hoang-phap:dai-le-phat-dan", slug: "dai-le-phat-dan", position: 2, template: "tin-tuc", visible: true, section: "dong-chay-hoang-phap" });
		const row = w.raw.prepare("SELECT updated_by, template FROM category WHERE id = ?").get(made.data.id) as { updated_by: string; template: string };
		expect(row).toEqual({ updated_by: "editor", template: "tin-tuc" });
		const log = w.raw.prepare("SELECT user_email, entity_id FROM audit_log WHERE action = 'category.create'").get() as { user_email: string };
		expect(log.user_email).toBe("editor@example.test");
	});

	it("turns a typed slug into its plain form, đ as d", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		const made = await editor.call("POST", "categories", { kind: "event", name: "Lễ Đặc Biệt", slug: "Đại Lễ  Vu-Lan!" });
		expect(made.data.slug).toBe("dai-le-vu-lan");
		expect(made.data.id).toBe("event::dai-le-vu-lan");
		expect(made.data.section).toBe("");
	});

	it("ignores the section for kinds that have one list only, and requires it for post categories", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", "categories", { kind: "about", section: "gi-do", name: "Nhóm" })).data.section).toBe("");
		const missing = await editor.call("POST", "categories", { kind: "post", name: "Thiếu mục" });
		expect(missing.status).toBe(400);
		expect(missing.error.fields.section).toMatch(/mục/);
	});

	it("refuses a slug another live category of the same list has (409), but allows it in another section or once the other is trashed", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		const clash = await editor.call("POST", "categories", { kind: "post", section: "dong-chay-hoang-phap", name: "Cộng tu khác", slug: "cong-tu" });
		expect(clash.status).toBe(409);
		expect(clash.error.code).toBe("slug_taken");
		expect((await editor.call("POST", "categories", { kind: "post", section: "vu-tru-phat-giao", name: "Cộng tu", slug: "cong-tu" })).status).toBe(200);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("DELETE", `categories/${enc(CONG_TU)}`)).status).toBe(204);
		const again = await editor.call("POST", "categories", { kind: "post", section: "dong-chay-hoang-phap", name: "Cộng tu mới", slug: "cong-tu" });
		expect(again.status).toBe(200);
		// The trashed row still owns the plain id, so the new one gets a number: ids are never reused.
		expect(again.data.id).toBe(`${CONG_TU}-2`);
		expect(again.data.slug).toBe("cong-tu");
	});

	it("checks the template, the parent, the icon and the picture", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		const base = { kind: "post", section: "dong-chay-hoang-phap", name: "Thử" };
		expect((await editor.call("POST", "categories", { ...base, template: "la-lam" })).error.fields.template).toBeTruthy();
		expect((await editor.call("POST", "categories", { ...base, name: "" })).status).toBe(400);
		expect((await editor.call("POST", "categories", { ...base, kind: "bai-la" })).status).toBe(400);
		expect((await editor.call("POST", "categories", { ...base, parentId: "khong-co" })).error.fields.parentId).toBeTruthy();
		expect((await editor.call("POST", "categories", { ...base, parentId: "tong-chi::tu-hoc" })).error.fields.parentId).toMatch(/cùng nhóm/);
		expect((await editor.call("POST", "categories", { ...base, iconType: "library", iconName: "khong-co" })).error.fields.iconName).toBeTruthy();
		expect((await editor.call("POST", "categories", { ...base, iconType: "image" })).error.fields.iconMediaId).toBeTruthy();
		expect((await editor.call("POST", "categories", { ...base, iconType: "image", iconMediaId: "khong-co" })).status).toBe(400);
		expect((await editor.call("POST", "categories", { ...base, iconType: "library", iconName: "church", iconColor: "red" })).error.fields.iconColor).toBeTruthy();
		expect((await editor.call("POST", "categories", { ...base, ogMediaId: "khong-co" })).error.fields.ogMediaId).toBeTruthy();
	});

	it("an Author cannot create (403)", async () => {
		const w = await taxonomyWorld();
		const author = await w.as("author@example.test");
		expect((await author.call("POST", "categories", { kind: "event", name: "X" })).status).toBe(403);
	});
});

describe("icons of a category", () => {
	it("stores a library icon with its colour, and clears the other icon fields", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		const made = await editor.call("POST", "categories", { kind: "event", name: "Lễ", iconType: "library", iconName: "church", iconColor: "#835414", iconSvg: "<svg viewBox='0 0 1 1'/>", iconUrl: "/x.png" });
		expect(made.data).toMatchObject({ iconType: "library", iconName: "church", iconColor: "#835414", iconSvg: "", iconUrl: "" });
	});

	it("cleans an uploaded SVG again on save, whatever the page sent, and refuses one that cannot be cleaned", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		const dirty = '<svg viewBox="0 0 8 8" onload="alert(1)"><script>alert(1)</script><path d="M0 0h8" fill="red" onclick="x()"/></svg>';
		const made = await editor.call("POST", "categories", { kind: "event", name: "Lễ svg", iconType: "svg", iconSvg: dirty });
		expect(made.data.iconSvg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8" fill="red"/></svg>');
		const stored = w.raw.prepare("SELECT icon_svg FROM category WHERE id = ?").get(made.data.id) as { icon_svg: string };
		expect(stored.icon_svg).not.toMatch(/script|onload|onclick/);
		const bad = await editor.call("PATCH", `categories/${enc(made.data.id)}`, { iconSvg: "<html></html>" });
		expect(bad.status).toBe(400);
		expect(bad.error.fields.iconSvg).toBeTruthy();
		expect((w.raw.prepare("SELECT icon_svg FROM category WHERE id = ?").get(made.data.id) as { icon_svg: string }).icon_svg).toBe(made.data.iconSvg);
	});

	it("a media picture is recorded in media_usage and released when the icon changes", async () => {
		const w = await taxonomyWorld();
		w.raw.prepare("INSERT INTO media (id, filename, r2_key, mime, created_at) VALUES ('m1', 'a.png', 'cms/m1/v1/a.png', 'image/png', '2026')").run();
		const editor = await w.as("editor@example.test");
		const made = await editor.call("POST", "categories", { kind: "event", name: "Lễ ảnh", iconType: "image", iconMediaId: "m1" });
		expect(made.data).toMatchObject({ iconType: "image", iconMediaId: "m1" });
		const usage = () => w.raw.prepare("SELECT field FROM media_usage WHERE media_id = 'm1' AND entity_type = 'category' AND entity_id = ?").all(made.data.id);
		expect(usage()).toEqual([{ field: "icon_media_id" }]);
		await editor.call("PATCH", `categories/${enc(made.data.id)}`, { iconType: "none" });
		expect(usage()).toEqual([]);
		// A site path is also accepted; a full address is not.
		expect((await editor.call("PATCH", `categories/${enc(made.data.id)}`, { iconType: "image", iconUrl: "/brand/icons/a.webp" })).data.iconUrl).toBe("/brand/icons/a.webp");
		expect((await editor.call("PATCH", `categories/${enc(made.data.id)}`, { iconType: "image", iconUrl: "https://evil.test/a.png" })).status).toBe(400);
		expect((await editor.call("PATCH", `categories/${enc(made.data.id)}`, { iconType: "image", iconUrl: "//evil.test/a.png" })).status).toBe(400);
	});
});

describe("updating a category", () => {
	it("changes the slug but never the id, and moves the menu items that lead to it", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		w.raw
			.prepare("INSERT INTO menu_item (id, menu_id, position, label, link_type, category_id, href) VALUES ('mi-x', 'footer', 1, 'Cộng tu', 'category', ?, '/dong-chay-hoang-phap?danh-muc=cong-tu')")
			.run(CONG_TU);
		addPost(w.raw, "p1", CONG_TU);
		const changed = await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { slug: "Cộng Tu Định Kỳ", name: "Cộng tu định kỳ" });
		expect(changed.status).toBe(200);
		expect(changed.data).toMatchObject({ id: CONG_TU, slug: "cong-tu-dinh-ky", name: "Cộng tu định kỳ", used: 1 });
		expect(w.raw.prepare("SELECT category_id FROM post WHERE id = 'p1'").get()).toEqual({ category_id: CONG_TU });
		expect(w.raw.prepare("SELECT href FROM menu_item WHERE id = 'mi-x'").get()).toEqual({ href: "/dong-chay-hoang-phap?danh-muc=cong-tu-dinh-ky" });
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'category.update' AND entity_id = ?").get(CONG_TU)).toEqual({ n: 1 });
	});

	it("a save that changes only some fields keeps the others", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { description: "Mô tả", template: "tin-tuc", seoTitle: "SEO" });
		const after = await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { visible: false });
		expect(after.data).toMatchObject({ description: "Mô tả", template: "tin-tuc", seoTitle: "SEO", visible: false, name: "Cộng Tu Định Kỳ", slug: "cong-tu" });
	});

	it("refuses a slug in use (409), a parent in another list or below itself, and unknown ids (404)", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { slug: "vu-lan" })).status).toBe(409);
		expect((await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { slug: "cong-tu" })).status).toBe(200);
		expect((await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { parentId: CONG_TU })).status).toBe(400);
		expect((await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { parentId: "post:tri-tue-phat-phap:cong-tu" })).error.fields.parentId).toMatch(/cùng nhóm/);
		await editor.call("PATCH", `categories/${enc("post:dong-chay-hoang-phap:vu-lan")}`, { parentId: CONG_TU });
		const below = await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { parentId: "post:dong-chay-hoang-phap:vu-lan" });
		expect(below.status).toBe(400);
		expect((await editor.call("PATCH", "categories/khong-co", { name: "x" })).status).toBe(404);
		expect((await editor.call("PATCH", `categories/${enc(CONG_TU)}`, { name: "" })).status).toBe(400);
	});

	it("an Author cannot update (403)", async () => {
		const w = await taxonomyWorld();
		const author = await w.as("author@example.test");
		expect((await author.call("PATCH", `categories/${enc(CONG_TU)}`, { name: "x" })).status).toBe(403);
	});
});

describe("deleting a category", () => {
	it("moves an unused category to the trash with an audit entry; the unique slug is free again", async () => {
		const w = await taxonomyWorld();
		const admin = await w.as("admin@example.test");
		expect((await admin.call("DELETE", `categories/${enc("event::khoa-tu")}`)).status).toBe(204);
		const row = w.raw.prepare("SELECT deleted_at, deleted_by FROM category WHERE id = 'event::khoa-tu'").get() as { deleted_at: string; deleted_by: string };
		expect(row.deleted_by).toBe("admin");
		expect(row.deleted_at).toBeTruthy();
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'category.delete'").get()).toEqual({ n: 1 });
		expect((await admin.call("DELETE", `categories/${enc("event::khoa-tu")}`)).status).toBe(404);
	});

	it("refuses while posts still use it (409) and says how many; trashed posts do not count", async () => {
		const w = await taxonomyWorld();
		const admin = await w.as("admin@example.test");
		addPost(w.raw, "p1", CONG_TU);
		addPost(w.raw, "p2", CONG_TU);
		addPost(w.raw, "p3", CONG_TU, true);
		const refused = await admin.call("DELETE", `categories/${enc(CONG_TU)}`);
		expect(refused.status).toBe(409);
		expect(refused.error.code).toBe("in_use");
		expect(refused.error.message).toMatch(/2 bài viết/);
		expect(w.raw.prepare("SELECT deleted_at FROM category WHERE id = ?").get(CONG_TU)).toEqual({ deleted_at: null });
		w.raw.prepare("UPDATE post SET deleted_at = '2026' WHERE category_id = ?").run(CONG_TU);
		expect((await admin.call("DELETE", `categories/${enc(CONG_TU)}`)).status).toBe(204);
	});

	it("refuses while articles, pages, events or statues use it, and while it has children", async () => {
		const w = await taxonomyWorld();
		const admin = await w.as("admin@example.test");
		w.raw.prepare("INSERT INTO teaching_article (id, slug, title, group_id) VALUES ('t1', 't1', 'T', 'tong-chi::tu-hoc')").run();
		const refused = await admin.call("DELETE", `categories/${enc("tong-chi::tu-hoc")}`);
		expect(refused.status).toBe(409);
		expect(refused.error.message).toMatch(/1 bài Tông chỉ tu học/);
		await admin.call("PATCH", `categories/${enc("post:dong-chay-hoang-phap:vu-lan")}`, { parentId: CONG_TU });
		const parent = await admin.call("DELETE", `categories/${enc(CONG_TU)}`);
		expect(parent.status).toBe(409);
		expect(parent.error.message).toMatch(/1 chuyên mục con/);
	});

	it("an Editor cannot delete (403)", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("DELETE", `categories/${enc("event::khoa-tu")}`)).status).toBe(403);
	});
});

describe("reordering categories", () => {
	const ids = ["post:dong-chay-hoang-phap:vu-lan", CONG_TU];

	it("saves the order and the nesting, and a second identical save changes nothing", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		const first = await editor.call("POST", "categories/reorder", { items: [{ id: ids[0], parentId: null }, { id: ids[1], parentId: ids[0] }] });
		expect(first.status).toBe(200);
		expect(first.data.changed).toBe(1);
		expect(w.raw.prepare("SELECT id, parent_id, position FROM category WHERE id IN (?, ?) ORDER BY id").all(...ids)).toEqual([
			{ id: CONG_TU, parent_id: ids[0], position: 1 },
			{ id: ids[0], parent_id: null, position: 1 },
		]);
		const list = await editor.call("GET", "categories?kind=post&section=dong-chay-hoang-phap");
		expect(list.data.map((item: { id: string; depth: number }) => [item.id, item.depth])).toEqual([[ids[0], 0], [CONG_TU, 1]]);
		expect((await editor.call("POST", "categories/reorder", { items: [{ id: ids[0], parentId: null }, { id: ids[1], parentId: ids[0] }] })).data.changed).toBe(0);
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'category.reorder'").get()).toEqual({ n: 1 });
	});

	it("refuses a cycle, a missing parent, a parent from another list, duplicates and unknown ids", async () => {
		const w = await taxonomyWorld();
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", "categories/reorder", { items: [{ id: ids[0], parentId: ids[1] }, { id: ids[1], parentId: ids[0] }] })).error.code).toBe("cycle");
		expect((await editor.call("POST", "categories/reorder", { items: [{ id: ids[0], parentId: ids[0] }] })).status).toBe(400);
		expect((await editor.call("POST", "categories/reorder", { items: [{ id: ids[0], parentId: ids[1] }] })).status).toBe(400);
		expect((await editor.call("POST", "categories/reorder", { items: [{ id: ids[0], parentId: "tong-chi::tu-hoc" }, { id: "tong-chi::tu-hoc", parentId: null }] })).error.fields.parentId).toMatch(/cùng nhóm/);
		expect((await editor.call("POST", "categories/reorder", { items: [{ id: ids[0], parentId: null }, { id: ids[0], parentId: null }] })).status).toBe(400);
		expect((await editor.call("POST", "categories/reorder", { items: [{ id: "khong-co", parentId: null }] })).status).toBe(404);
		expect((await editor.call("POST", "categories/reorder", { items: [] })).status).toBe(400);
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM category WHERE parent_id IS NOT NULL").get()).toEqual({ n: 0 });
	});

	it("an Author cannot reorder (403)", async () => {
		const w = await taxonomyWorld();
		const author = await w.as("author@example.test");
		expect((await author.call("POST", "categories/reorder", { items: [{ id: ids[0], parentId: null }] })).status).toBe(403);
	});
});

describe("GET slug", () => {
	it("makes a slug without accents, đ as d, and says whether it is free in that list", async () => {
		const w = await taxonomyWorld();
		const author = await w.as("author@example.test");
		const free = await author.call("GET", `slug?text=${enc("Đại Lễ Vu Lan – 2026!")}&type=category&section=dong-chay-hoang-phap`);
		expect(free.data).toEqual({ slug: "dai-le-vu-lan-2026", available: true, suggestion: "dai-le-vu-lan-2026" });
		const taken = await author.call("GET", "slug?text=C%E1%BB%99ng%20tu&type=category&section=dong-chay-hoang-phap");
		expect(taken.data).toEqual({ slug: "cong-tu", available: false, suggestion: "cong-tu-2" });
		const own = await author.call("GET", `slug?text=Cong%20tu&type=category&section=dong-chay-hoang-phap&excludeId=${enc(CONG_TU)}`);
		expect(own.data.available).toBe(true);
		expect((await author.call("GET", "slug?text=Cong%20tu&type=category&section=vu-tru-phat-giao")).data.available).toBe(true);
	});

	it("checks other content types too, and refuses an unknown type", async () => {
		const w = await taxonomyWorld();
		w.raw.prepare("INSERT INTO teaching_article (id, slug, title) VALUES ('t1', 'tu-hoc', 'T')").run();
		const author = await w.as("author@example.test");
		expect((await author.call("GET", "slug?text=Tu%20hoc&type=teaching")).data).toMatchObject({ available: false, suggestion: "tu-hoc-2" });
		expect((await author.call("GET", "slug?text=Tu%20hoc&type=page")).data.available).toBe(true);
		expect((await author.call("GET", "slug?text=x&type=lung-tung")).status).toBe(400);
		expect((await w.client().call("GET", "slug?text=x")).status).toBe(401);
	});
});
