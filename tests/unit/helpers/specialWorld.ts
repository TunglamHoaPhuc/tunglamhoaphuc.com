// Seeds for the special-content tests: event types, an assembly, areas, pictures and a post, on top of adminWorld.
import type { DatabaseSync } from "node:sqlite";
import { world, type Seed } from "./adminWorld";

export const SEEDS: Seed[] = [
	{ id: "root", email: "root@example.test", roleId: "role-super-admin" },
	{ id: "admin", email: "admin@example.test", roleId: "role-admin" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor" },
	{ id: "author", email: "author@example.test", roleId: "role-author" },
];

export function seedBasics(raw: DatabaseSync) {
	const category = raw.prepare("INSERT INTO category (id, kind, section, slug, name, position) VALUES (?, ?, '', ?, ?, ?)");
	category.run("event::cong-tu", "event", "cong-tu", "Cộng Tu", 1);
	category.run("event::khoa-le", "event", "khoa-le", "Khóa Lễ Truyền Thống", 2);
	category.run("assembly::chu-phat", "assembly", "chu-phat", "Chư Phật Hải Hội", 1);
	const media = raw.prepare("INSERT INTO media (id, r2_key, filename, mime, created_at) VALUES (?, ?, ?, 'image/png', '2026-01-01')");
	for (const n of [1, 2, 3, 4]) media.run(`media-${n}`, `cms/media-${n}/v1/a${n}.png`, `a${n}.png`);
	const area = raw.prepare("INSERT INTO area (id, slug, name, position) VALUES (?, ?, ?, ?)");
	area.run("tam-bao", "tam-bao", "Tam Bảo", 1);
	area.run("to-duong", "to-duong", "Tổ Đường", 2);
	area.run("giang-duong", "giang-duong", "Giảng Đường", 3);
	raw.prepare("INSERT INTO post (id, slug, title, section, published_date) VALUES ('post-1', 'bai-1', 'Bài một', 'dong-chay-hoang-phap', '2026-01-01')").run();
}

export async function specialWorld() {
	const w = await world(SEEDS);
	seedBasics(w.raw);
	return w;
}

/** The count of rows of a table that match `where` (a constant in the test). */
export const count = (raw: DatabaseSync, table: string, where = "1 = 1") => (raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get() as { n: number }).n;
