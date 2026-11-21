import { describe, expect, it } from "vitest";
import { taxonomyWorld } from "../helpers/taxonomyWorld";

const CONG_TU = "post:dong-chay-hoang-phap:cong-tu";

async function setup() {
	const w = await taxonomyWorld();
	return { w, editor: await w.as("editor@example.test"), admin: await w.as("admin@example.test"), author: await w.as("author@example.test") };
}

describe("reading a menu", () => {
	it("GET menus/header returns the seeded tree with depth, hidden items included", async () => {
		const { w, editor } = await setup();
		w.raw.prepare("UPDATE menu_item SET visible = 0 WHERE id = 'mi-thanh-quy'").run();
		w.raw.prepare("UPDATE menu_item SET deleted_at = '2026' WHERE id = 'mi-lien-he'").run();
		const menu = await editor.call("GET", "menus/header");
		expect(menu.status).toBe(200);
		expect(menu.data).toMatchObject({ id: "header", name: "Menu đầu trang", shownLevels: 2, warnings: [] });
		const labels = menu.data.items.map((item: { label: string; depth: number }) => `${"-".repeat(item.depth)}${item.label}`);
		expect(labels.slice(0, 7)).toEqual(["Giới thiệu", "-Lịch sử Bổn tự", "-Chư Tôn Đức", "-Thanh quy", "-Vũ Trụ Phật Giáo", "-Bảo Tượng Phật Giáo", "Tin tức – Pháp thoại"]);
		expect(labels).not.toContain("Liên hệ");
		expect(menu.data.items.find((item: { id: string }) => item.id === "mi-thanh-quy")).toMatchObject({ visible: false, linkType: "url", href: "/gioi-thieu/van-hoa-ung-xu" });
		expect(menu.data.items.find((item: { id: string }) => item.id === "mi-lich-su")).toMatchObject({ iconType: "image", iconUrl: "/brand/logo-tung-lam-hoa-phuc-tron-nga.webp" });
	});

	it("footer and sidebar are empty and marked as not shown yet; an unknown menu is 404; no session is 401", async () => {
		const { w, author } = await setup();
		const footer = await author.call("GET", "menus/footer");
		expect(footer.data.items).toEqual([]);
		expect(footer.data.shownLevels).toBeNull();
		expect(footer.data.warnings[0]).toMatch(/chưa hiển thị/);
		expect((await author.call("GET", "menus/khac")).status).toBe(404);
		expect((await w.client().call("GET", "menus/header")).status).toBe(401);
	});
});

describe("adding an item", () => {
	it("a url item: internal path or https address, saved with an audit entry, at the end of its brothers", async () => {
		const { w, editor } = await setup();
		const made = await editor.call("POST", "menus/footer/items", { label: "Liên hệ", linkType: "url", href: "/lien-he" });
		expect(made.status).toBe(200);
		expect(made.data).toMatchObject({ menuId: "footer", label: "Liên hệ", href: "/lien-he", linkType: "url", position: 1, visible: true, openNewTab: false, parentId: null });
		const second = await editor.call("POST", "menus/footer/items", { label: "Facebook", linkType: "url", href: "https://facebook.com/tunglam", openNewTab: true, parentId: made.data.id });
		expect(second.data).toMatchObject({ href: "https://facebook.com/tunglam", openNewTab: true, parentId: made.data.id, position: 1 });
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'menu_item.create'").get()).toEqual({ n: 2 });
		const tree = await editor.call("GET", "menus/footer");
		expect(tree.data.items.map((item: { label: string; depth: number }) => [item.label, item.depth])).toEqual([["Liên hệ", 0], ["Facebook", 1]]);
	});

	it("refuses javascript:, data:, protocol-relative and other unsafe addresses", async () => {
		const { w, editor } = await setup();
		for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "//evil.test/x", "http://insecure.test", "ftp://x.test", "vbscript:x", "/ok path", "/x\\y", "lien-he", "", "  ", "https://", "/\tjavascript:1"]) {
			const refused = await editor.call("POST", "menus/header/items", { label: "X", linkType: "url", href });
			expect(refused.status, JSON.stringify(href)).toBe(400);
			expect(refused.error.fields.href, JSON.stringify(href)).toBeTruthy();
		}
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM menu_item WHERE label = 'X'").get()).toEqual({ n: 0 });
		const ok = await editor.call("POST", "menus/header/items", { label: "Có mỏ neo", linkType: "url", href: "/gioi-thieu#nguoi-lien-quan" });
		expect(ok.status).toBe(200);
	});

	it("a category item leads to the category's page: a post category filters its section, the others go to their section", async () => {
		const { editor } = await setup();
		const post = await editor.call("POST", "menus/header/items", { label: "Cộng tu", linkType: "category", categoryId: CONG_TU });
		expect(post.data).toMatchObject({ linkType: "category", categoryId: CONG_TU, href: "/dong-chay-hoang-phap?danh-muc=cong-tu" });
		const tongChi = await editor.call("POST", "menus/header/items", { label: "Tu học", linkType: "category", categoryId: "tong-chi::tu-hoc" });
		expect(tongChi.data.href).toBe("/tong-chi-tu-hoc");
		const event = await editor.call("POST", "menus/header/items", { label: "Khóa tu", linkType: "category", categoryId: "event::khoa-tu" });
		expect(event.data.href).toBe("/lich-tu-hoc");
		expect((await editor.call("POST", "menus/header/items", { label: "Thiếu", linkType: "category" })).error.fields.categoryId).toBeTruthy();
		expect((await editor.call("POST", "menus/header/items", { label: "Mất", linkType: "category", categoryId: "khong-co" })).error.fields.categoryId).toBeTruthy();
	});

	it("a page item leads to a Giới thiệu page, a Tông chỉ article or a post, by id", async () => {
		const { w, editor } = await setup();
		w.raw.prepare("INSERT INTO page (id, slug, title) VALUES ('pg1', 'lich-su', 'Lịch sử')").run();
		w.raw.prepare("INSERT INTO teaching_article (id, slug, title) VALUES ('ta1', 'lo-trinh', 'Lộ trình')").run();
		w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date) VALUES ('po1', 'vu-lan-2026', 'Vu Lan 2026', 'dong-chay-hoang-phap', '2026-08-01')").run();
		const hrefOf = async (pageRef: unknown) => (await editor.call("POST", "menus/header/items", { label: "Trang", linkType: "page", pageRef })).data?.href;
		expect(await hrefOf({ type: "page", id: "pg1" })).toBe("/gioi-thieu/lich-su");
		expect(await hrefOf({ type: "teaching_article", id: "ta1" })).toBe("/tong-chi-tu-hoc/lo-trinh");
		expect(await hrefOf({ type: "post", id: "po1" })).toBe("/dong-chay-hoang-phap/vu-lan-2026");
		const missing = await editor.call("POST", "menus/header/items", { label: "Trang", linkType: "page", pageRef: { type: "page", id: "khong-co" } });
		expect(missing.status).toBe(400);
		expect((await editor.call("POST", "menus/header/items", { label: "Trang", linkType: "page" })).error.fields.pageRef).toBeTruthy();
	});

	it("searches the things an item can link to", async () => {
		const { w, author } = await setup();
		w.raw.prepare("INSERT INTO page (id, slug, title) VALUES ('pg1', 'lich-su', 'Lịch sử Bổn tự')").run();
		const found = await author.call("GET", "link-targets?type=page&q=l%E1%BB%8Bch");
		expect(found.data).toEqual([{ type: "page", id: "pg1", title: "Lịch sử Bổn tự", path: "/gioi-thieu/lich-su" }]);
		expect((await author.call("GET", "link-targets?type=bao-tuong")).status).toBe(400);
	});

	it("validates the label, the parent, the menu and the icon", async () => {
		const { editor } = await setup();
		expect((await editor.call("POST", "menus/header/items", { label: " ", linkType: "url", href: "/x" })).error.fields.label).toBeTruthy();
		expect((await editor.call("POST", "menus/header/items", { label: "X", linkType: "url", href: "/x", parentId: "khong-co" })).error.fields.parentId).toBeTruthy();
		const footer = await editor.call("POST", "menus/footer/items", { label: "F", linkType: "url", href: "/f" });
		expect((await editor.call("POST", "menus/header/items", { label: "X", linkType: "url", href: "/x", parentId: footer.data.id })).error.fields.parentId).toMatch(/trong menu này/);
		expect((await editor.call("POST", "menus/khac/items", { label: "X", linkType: "url", href: "/x" })).status).toBe(404);
		expect((await editor.call("POST", "menus/header/items", { label: "X", linkType: "url", href: "/x", iconType: "library", iconName: "khong-co" })).error.fields.iconName).toBeTruthy();
		expect((await editor.call("POST", "menus/header/items", { label: "X", linkType: "kieu-la", href: "/x" })).status).toBe(400);
	});

	it("stores library, cleaned svg and image icons; svg is cleaned on the server", async () => {
		const { w, editor } = await setup();
		w.raw.prepare("INSERT INTO media (id, filename, r2_key, mime, created_at) VALUES ('m1', 'a.png', 'cms/m1/v1/a.png', 'image/png', '2026')").run();
		const lib = await editor.call("POST", "menus/header/items", { label: "Chùa", linkType: "url", href: "/", iconType: "library", iconName: "church", iconColor: "#F2C14E" });
		expect(lib.data).toMatchObject({ iconType: "library", iconName: "church", iconColor: "#f2c14e" });
		const svg = await editor.call("POST", "menus/header/items", { label: "Svg", linkType: "url", href: "/", iconType: "svg", iconSvg: '<svg viewBox="0 0 4 4" onload="x()"><script>1</script><path d="M0 0h4"/></svg>' });
		expect(svg.data.iconSvg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M0 0h4"/></svg>');
		expect((await editor.call("POST", "menus/header/items", { label: "Bad", linkType: "url", href: "/", iconType: "svg", iconSvg: "<script>alert(1)</script>" })).status).toBe(400);
		const image = await editor.call("POST", "menus/header/items", { label: "Ảnh", linkType: "url", href: "/", iconType: "image", iconMediaId: "m1" });
		expect(image.data.iconMediaId).toBe("m1");
		expect(w.raw.prepare("SELECT entity_id, field FROM media_usage WHERE media_id = 'm1' AND entity_type = 'menu_item'").all()).toEqual([{ entity_id: image.data.id, field: "icon_media_id" }]);
	});

	it("an Author may only view (403 on create); an Editor may create", async () => {
		const { author } = await setup();
		expect((await author.call("POST", "menus/header/items", { label: "X", linkType: "url", href: "/x" })).status).toBe(403);
	});
});

describe("updating an item", () => {
	it("changes the label and the link, keeps what it was not sent, and logs before and after", async () => {
		const { w, editor } = await setup();
		const changed = await editor.call("PATCH", "menu-items/mi-lien-he", { label: "Liên hệ chùa", href: "/lien-he?x=1", visible: false });
		expect(changed.status).toBe(200);
		expect(changed.data).toMatchObject({ label: "Liên hệ chùa", href: "/lien-he?x=1", visible: false, linkType: "url", position: 4, parentId: null });
		const log = w.raw.prepare("SELECT data_before, data_after FROM audit_log WHERE action = 'menu_item.update' AND entity_id = 'mi-lien-he'").get() as { data_before: string; data_after: string };
		expect(JSON.parse(log.data_before)).toMatchObject({ label: "Liên hệ", visible: true });
		expect(JSON.parse(log.data_after)).toMatchObject({ label: "Liên hệ chùa", visible: false });
		const kept = await editor.call("PATCH", "menu-items/mi-lien-he", { visible: true });
		expect(kept.data).toMatchObject({ label: "Liên hệ chùa", href: "/lien-he?x=1", visible: true });
	});

	it("switching to a category link stores the category and its address; switching back to url clears the category", async () => {
		const { editor } = await setup();
		const toCategory = await editor.call("PATCH", "menu-items/mi-lien-he", { linkType: "category", categoryId: CONG_TU });
		expect(toCategory.data).toMatchObject({ linkType: "category", categoryId: CONG_TU, href: "/dong-chay-hoang-phap?danh-muc=cong-tu" });
		const back = await editor.call("PATCH", "menu-items/mi-lien-he", { linkType: "url", href: "/lien-he" });
		expect(back.data).toMatchObject({ linkType: "url", categoryId: null, href: "/lien-he" });
		expect((await editor.call("PATCH", "menu-items/mi-lien-he", { href: "javascript:alert(1)" })).status).toBe(400);
		expect((await editor.call("PATCH", "menu-items/mi-lien-he", { linkType: "url", href: "//evil.test" })).status).toBe(400);
	});

	it("refuses to put an item inside itself or its own child, and unknown ids are 404", async () => {
		const { editor } = await setup();
		expect((await editor.call("PATCH", "menu-items/mi-gioi-thieu", { parentId: "mi-gioi-thieu" })).status).toBe(400);
		expect((await editor.call("PATCH", "menu-items/mi-gioi-thieu", { parentId: "mi-lich-su" })).status).toBe(400);
		expect((await editor.call("PATCH", "menu-items/khong-co", { label: "x" })).status).toBe(404);
		expect((await editor.call("PATCH", "menu-items/mi-lien-he", { label: "" })).status).toBe(400);
	});

	it("an item changed to an svg icon and then to none leaves no svg behind", async () => {
		const { w, editor } = await setup();
		await editor.call("PATCH", "menu-items/mi-lien-he", { iconType: "svg", iconSvg: '<svg viewBox="0 0 4 4"><path d="M0 0h4"/></svg>' });
		await editor.call("PATCH", "menu-items/mi-lien-he", { iconType: "none" });
		expect(w.raw.prepare("SELECT icon_type, icon_svg, icon_color FROM menu_item WHERE id = 'mi-lien-he'").get()).toEqual({ icon_type: "none", icon_svg: "", icon_color: "" });
	});

	it("an Author cannot update (403)", async () => {
		const { author } = await setup();
		expect((await author.call("PATCH", "menu-items/mi-lien-he", { label: "x" })).status).toBe(403);
	});
});

describe("deleting an item", () => {
	it("trashes the item and everything below it, and the public reader no longer sees them", async () => {
		const { w, admin } = await setup();
		const gone = await admin.call("DELETE", "menu-items/mi-gioi-thieu");
		expect(gone.status).toBe(200);
		expect(gone.data.removed).toBe(6);
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM menu_item WHERE deleted_at IS NOT NULL").get()).toEqual({ n: 6 });
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM menu_item WHERE deleted_at IS NULL").get()).toEqual({ n: 6 });
		const menu = await admin.call("GET", "menus/header");
		expect(menu.data.items.map((item: { label: string }) => item.label)).not.toContain("Lịch sử Bổn tự");
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'menu_item.delete'").get()).toEqual({ n: 1 });
		expect((await admin.call("DELETE", "menu-items/mi-gioi-thieu")).status).toBe(404);
	});

	it("a leaf is trashed alone; an Editor cannot delete (403)", async () => {
		const { w, admin, editor } = await setup();
		expect((await editor.call("DELETE", "menu-items/mi-lien-he")).status).toBe(403);
		expect((await admin.call("DELETE", "menu-items/mi-lien-he")).data.removed).toBe(1);
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM menu_item WHERE deleted_at IS NOT NULL").get()).toEqual({ n: 1 });
	});
});

describe("saving the tree", () => {
	const all = async (editor: Awaited<ReturnType<typeof setup>>["editor"]) => (await editor.call("GET", "menus/header")).data.items as { id: string; parentId: string | null }[];

	it("saves a new order and nesting from the drag and drop, and warns when the public header would not show the depth", async () => {
		const { w, editor } = await setup();
		const items = await all(editor);
		const body = items.map((item) => ({ id: item.id, parentId: item.parentId }));
		// "Liên hệ" moves to the top, "Lịch tu học" goes inside it (a third level once it is under a child).
		const move = (id: string, parentId: string | null) => (body.find((item) => item.id === id)!.parentId = parentId);
		move("mi-lich-tu-hoc", "mi-lich-su");
		const lienHe = body.splice(body.findIndex((item) => item.id === "mi-lien-he"), 1)[0];
		body.unshift(lienHe);
		const saved = await editor.call("PUT", "menus/header/tree", { items: body });
		expect(saved.status).toBe(200);
		expect(saved.data.items[0]).toMatchObject({ id: "mi-lien-he", position: 1, depth: 0 });
		const nested = saved.data.items.find((item: { id: string }) => item.id === "mi-lich-tu-hoc");
		expect(nested).toMatchObject({ parentId: "mi-lich-su", depth: 2 });
		expect(saved.data.warnings[0]).toMatch(/chỉ hiển thị 2 cấp/);
		expect(w.raw.prepare("SELECT parent_id, position FROM menu_item WHERE id = 'mi-lich-tu-hoc'").get()).toEqual({ parent_id: "mi-lich-su", position: 1 });
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'menu.tree'").get()).toEqual({ n: 1 });
	});

	it("an unchanged save writes nothing", async () => {
		const { w, editor } = await setup();
		const body = (await all(editor)).map((item) => ({ id: item.id, parentId: item.parentId }));
		expect((await editor.call("PUT", "menus/header/tree", { items: body })).status).toBe(200);
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'menu.tree'").get()).toEqual({ n: 0 });
	});

	it("refuses a cycle, a missing parent, duplicates, and an item of another menu", async () => {
		const { editor } = await setup();
		const body = (await all(editor)).map((item) => ({ id: item.id, parentId: item.parentId }));
		const withParent = (id: string, parentId: string | null) => body.map((item) => (item.id === id ? { ...item, parentId } : item));
		expect((await editor.call("PUT", "menus/header/tree", { items: withParent("mi-gioi-thieu", "mi-lich-su") })).error.code).toBe("cycle");
		expect((await editor.call("PUT", "menus/header/tree", { items: withParent("mi-gioi-thieu", "mi-gioi-thieu") })).error.code).toBe("cycle");
		expect((await editor.call("PUT", "menus/header/tree", { items: withParent("mi-lien-he", "khong-co") })).status).toBe(400);
		expect((await editor.call("PUT", "menus/header/tree", { items: [...body, body[0]] })).status).toBe(400);
		const footer = await editor.call("POST", "menus/footer/items", { label: "F", linkType: "url", href: "/f" });
		expect((await editor.call("PUT", "menus/header/tree", { items: [...body, { id: footer.data.id, parentId: null }] })).status).toBe(409);
	});

	it("answers 409 when the list is not every live item (someone added or removed one meanwhile)", async () => {
		const { editor, admin } = await setup();
		const body = (await all(editor)).map((item) => ({ id: item.id, parentId: item.parentId }));
		await admin.call("POST", "menus/header/items", { label: "Mới", linkType: "url", href: "/moi" });
		const stale = await editor.call("PUT", "menus/header/tree", { items: body });
		expect(stale.status).toBe(409);
		expect(stale.error.code).toBe("conflict");
	});

	it("an Author cannot save a tree (403); an unknown menu is 404; a missing body is 400", async () => {
		const { editor, author } = await setup();
		expect((await author.call("PUT", "menus/header/tree", { items: [] })).status).toBe(403);
		expect((await editor.call("PUT", "menus/khac/tree", { items: [] })).status).toBe(404);
		expect((await editor.call("PUT", "menus/header/tree", {})).status).toBe(400);
	});
});

describe("trash registration", () => {
	it("registers category and menu_item with the trash", async () => {
		await setup();
		const { trashableOf } = await import("../../../src/admin/trash");
		expect(trashableOf("category")).toMatchObject({ table: "category", module: "categories", titleSql: "name" });
		expect(trashableOf("menu_item")).toMatchObject({ table: "menu_item", module: "menus", titleSql: "label" });
	});
});
