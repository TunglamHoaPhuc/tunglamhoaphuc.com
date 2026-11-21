import { describe, expect, it } from "vitest";
import { fillSearchText } from "../../src/db/searchBackfill";
import { applyMigrations, openDatabase } from "../../src/db/nodeSqlite";

describe("search text of imported rows", () => {
	it("fills it without accents or tags, and leaves a row the admin already saved alone", () => {
		const db = openDatabase();
		applyMigrations(db);
		db.exec(`insert into post (id, slug, title, section, published_date, content_html) values ('1', 'a', 'Lễ Hằng Thuận', 'dong-chay-hoang-phap', '2026-01-01', '<p>Đại <b>Lễ</b> Phật Đản</p>')`);
		db.exec(`insert into post (id, slug, title, section, published_date, search_text) values ('2', 'b', 'Khác', 'dong-chay-hoang-phap', '2026-01-02', 'da luu')`);
		expect(fillSearchText(db)).toBe(1);
		const row = db.prepare("select search_text from post where id = '1'").get() as { search_text: string };
		expect(row.search_text).toContain("le hang thuan");
		expect(row.search_text).toContain("dai le phat dan");
		expect(row.search_text).not.toContain("<");
		expect((db.prepare("select search_text from post where id = '2'").get() as { search_text: string }).search_text).toBe("da luu");
	});
});
