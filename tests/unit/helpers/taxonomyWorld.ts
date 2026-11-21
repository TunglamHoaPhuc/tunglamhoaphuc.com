// A world for the taxonomy tests: accounts, a few categories as the importer makes them, and rows that use them.
import type { DatabaseSync } from "node:sqlite";
import { world, type Seed } from "./adminWorld";

export const SEEDS: Seed[] = [
	{ id: "root", email: "root@example.test", roleId: "role-super-admin" },
	{ id: "admin", email: "admin@example.test", roleId: "role-admin" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor" },
	{ id: "author", email: "author@example.test", roleId: "role-author" },
];

export async function taxonomyWorld() {
	const w = await world(SEEDS);
	const category = w.raw.prepare("INSERT INTO category (id, kind, section, slug, name, position) VALUES (?, ?, ?, ?, ?, ?)");
	category.run("post:dong-chay-hoang-phap:cong-tu", "post", "dong-chay-hoang-phap", "cong-tu", "Cộng Tu Định Kỳ", 0);
	category.run("post:dong-chay-hoang-phap:vu-lan", "post", "dong-chay-hoang-phap", "vu-lan", "Mùa Vu Lan", 1);
	category.run("post:tri-tue-phat-phap:cong-tu", "post", "tri-tue-phat-phap", "cong-tu", "Cộng tu (Trí tuệ)", 2);
	category.run("tong-chi::tu-hoc", "tong-chi", "", "tu-hoc", "Tu học", 3);
	category.run("event::khoa-tu", "event", "", "khoa-tu", "Khóa tu", 4);
	return w;
}

/** A post in a category, to make the category "in use". */
export function addPost(raw: DatabaseSync, id: string, categoryId: string, deleted = false) {
	raw
		.prepare("INSERT INTO post (id, slug, title, section, category_id, published_date, deleted_at) VALUES (?, ?, ?, 'dong-chay-hoang-phap', ?, '2026-01-01', ?)")
		.run(id, id, `Bài ${id}`, categoryId, deleted ? "2026-02-02" : null);
}
