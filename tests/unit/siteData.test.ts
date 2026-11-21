import { describe, expect, it } from "vitest";
import { applyMigrations, asD1, openDatabase } from "../../src/db/nodeSqlite";
import { readMenu, readSettings } from "../../src/libs/siteData";

function database() {
	const db = openDatabase();
	applyMigrations(db);
	return db;
}

describe("the menus the admin edits", () => {
	it("starts as the header menu the site has always shown, two levels deep, in order", async () => {
		const tree = await readMenu(asD1(database()), "header");
		expect(tree?.map((node) => node.label)).toEqual(["Giới thiệu", "Tin tức – Pháp thoại", "Lịch tu học", "Liên hệ"]);
		expect(tree?.[0].children.map((node) => node.label)).toEqual(["Lịch sử Bổn tự", "Chư Tôn Đức", "Thanh quy", "Vũ Trụ Phật Giáo", "Bảo Tượng Phật Giáo"]);
		expect(tree?.[0].children[0].icon).toMatchObject({ type: "image", url: "/brand/logo-tung-lam-hoa-phuc-tron-nga.webp" });
		expect(tree?.[0].children[1].icon.type).toBe("none");
		expect(tree?.[2].children).toEqual([]);
	});

	it("leaves out hidden and trashed items, and says null for a menu with nothing in it", async () => {
		const db = database();
		db.exec("update menu_item set visible = 0 where id = 'mi-thanh-quy'; update menu_item set deleted_at = '2026-11-21' where id = 'mi-lien-he'");
		const tree = await readMenu(asD1(db), "header");
		expect(tree?.map((node) => node.label)).not.toContain("Liên hệ");
		expect(tree?.[0].children.map((node) => node.label)).not.toContain("Thanh quy");
		expect(await readMenu(asD1(db), "footer")).toBeNull();
	});
});

describe("settings", () => {
	it("reads every row as key to value and skips one that is not JSON", async () => {
		const db = database();
		db.exec(`insert into setting (key, value) values ('site.info', '{"phone":"0979"}'), ('home.stats', '[1,2]'), ('bad', 'not json')`);
		expect(await readSettings(asD1(db))).toEqual({ "site.info": { phone: "0979" }, "home.stats": [1, 2] });
	});
});
