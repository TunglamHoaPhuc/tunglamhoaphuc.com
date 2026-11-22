// The real export of the old admin (data/snapshot, not in git), imported as the owner's D1 was: opening an article in the editor and
// saving it as it is must change nothing (spec "Dữ liệu"), and the first real edit leaves exactly two revisions.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildStatements, loadContent } from "../../../src/db/import";
import { applyStatements } from "../../../src/db/nodeSqlite";
import { KINDS, type Kind } from "../../../src/admin/content/kinds";
import type { ReadFile } from "../../../src/libs/content/sources/files";
import { contentWorld } from "../helpers/contentWorld";

const has = ["posts", "tong-chi", "gioi-thieu"].every((name) => existsSync(`data/snapshot/${name}.json`));
const readFromDisk: ReadFile = async (name) => {
	const path = `data/snapshot/${name}.json`;
	return existsSync(path) ? { version: "snapshot", data: JSON.parse(readFileSync(path, "utf8")) } : null;
};

type Raw = Record<string, unknown>;
const KEYS = (kind: Kind) => [...kind.fields.map((spec) => spec.key), "slug", ...(kind.hasSection ? ["section"] : []), "categoryId", "contentHtml", "contentJson", ...(kind.hasExtra ? ["extra"] : []), ...(kind.hasMilestones ? ["milestones"] : [])];

async function importedWorld() {
	const w = await contentWorld();
	// the world's own sample rows would clash with the import: start from the import alone
	for (const table of ["milestone", "page", "teaching_article", "post", "album", "statue", "media"]) w.raw.exec(`DELETE FROM ${table}`);
	w.raw.exec("DELETE FROM category");
	applyStatements(w.raw, buildStatements(await loadContent(readFromDisk, { error: () => undefined })).statements);
	return w;
}

describe.skipIf(!has)("the real data", () => {
	it("makes exactly two versions at the first edit of one with a long slug, and restoring the first gives the import back", async () => {
		const w = await importedWorld();
		const root = await w.as("root@example.test");
		const long = w.raw.prepare("SELECT id, title, slug, content_html FROM post WHERE length(slug) > 100 LIMIT 1").get() as Raw;
		const saved = await root.call("PATCH", `posts/${long.id}`, { version: 1, title: `${long.title} (sửa)`, slug: long.slug });
		expect(saved.status, JSON.stringify(saved.json)).toBe(200);
		expect((await root.call("GET", `posts/${long.id}/revisions`)).data.map((item: Raw) => item.version)).toEqual([2, 1]);
		const restored = await root.call("POST", `posts/${long.id}/revisions/1/restore`, { version: 2 });
		expect(restored.status, JSON.stringify(restored.json)).toBe(200);
		expect(w.raw.prepare("SELECT title, slug, content_html FROM post WHERE id = ?").get(long.id as string)).toEqual({ title: long.title, slug: long.slug, content_html: long.content_html });
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM redirect").get()).toEqual({ n: 0 });
		const tong = w.raw.prepare("SELECT id, title, body FROM teaching_article LIMIT 1").get() as Raw;
		expect((await root.call("PATCH", `teachings/${tong.id}`, { version: 1, title: `${tong.title} (sửa)` })).status).toBe(200);
		expect((await root.call("GET", `teachings/${tong.id}/revisions`)).data.map((item: Raw) => item.version)).toEqual([2, 1]);
		expect((await root.call("PATCH", "pages/" + (w.raw.prepare("SELECT id FROM page LIMIT 1").get() as Raw).id, { version: 1, title: "Tên khác" })).status).toBe(200);
	}, 120_000);

	it("is left alone by opening and saving every post, Tông Chỉ article and Giới thiệu page as it is", async () => {
		const w = await importedWorld();
		const root = await w.as("root@example.test");

		const before = new Map<string, Raw>();
		for (const [table, kind] of [["post", KINDS.posts], ["teaching_article", KINDS.teachings], ["page", KINDS.pages]] as const) {
			for (const row of w.raw.prepare(`SELECT * FROM ${table}`).all() as Raw[]) before.set(`${kind.name}/${row.id}`, row);
		}
		expect([...before.keys()].filter((key) => key.startsWith("posts/")).length).toBeGreaterThan(600);

		const trouble: string[] = [];
		let longSlugs = 0;
		for (const [key, was] of before) {
			const [kindName, id] = key.split("/");
			const kind = KINDS[kindName as keyof typeof KINDS];
			if (String(was.slug).length > 80) longSlugs++;
			const detail = await root.call("GET", `${kind.name}/${id}`);
			if (detail.status !== 200) {
				trouble.push(`${key}: GET ${detail.status}`);
				continue;
			}
			const body: Raw = { version: detail.data.version };
			for (const name of KEYS(kind)) body[name] = detail.data[name];
			const saved = await root.call("PATCH", `${kind.name}/${id}`, body);
			if (saved.status !== 200) trouble.push(`${key}: PATCH ${saved.status} ${JSON.stringify(saved.json?.error?.fields ?? saved.json?.error?.message)}`);
			else if (saved.data.version !== detail.data.version) trouble.push(`${key}: version ${detail.data.version} -> ${saved.data.version} (${String((w.raw.prepare("SELECT summary FROM revision WHERE entity_id = ? ORDER BY version DESC LIMIT 1").get(id) as Raw)?.summary)})`);
		}
		expect(longSlugs).toBeGreaterThan(50);
		expect(trouble, trouble.slice(0, 15).join("\n")).toEqual([]);

		for (const [key, was] of before) {
			const [kindName, id] = key.split("/");
			const now = w.raw.prepare(`SELECT * FROM ${KINDS[kindName as keyof typeof KINDS].table} WHERE id = ?`).get(id) as Raw;
			for (const column of ["slug", "published_date", "version", "content_html", "body", "status"]) if (column in was) expect(now[column], `${key}.${column}`).toEqual(was[column]);
		}
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM revision").get()).toEqual({ n: 0 });
		expect(w.raw.prepare("SELECT COUNT(*) AS n FROM redirect").get()).toEqual({ n: 0 });
	}, 600_000);
});
