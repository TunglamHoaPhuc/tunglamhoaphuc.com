// Fills `search_text` for rows the admin has not saved yet (the imported ones), so the admin's search finds them
// with or without accents. Node only (scripts/backfill-admin.ts); run it again after an import.
import type { DatabaseSync } from "node:sqlite";
import { searchTextOf } from "../admin/content/search";

const plain = (html: string | null) => (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const SOURCES: { table: string; columns: string[] }[] = [
	{ table: "post", columns: ["title", "subtitle", "summary", "content_html"] },
	{ table: "teaching_article", columns: ["title", "subtitle", "excerpt", "body"] },
	{ table: "page", columns: ["title", "subtitle", "overview", "content_html"] },
];

/** Sets `search_text` where it is empty. Returns how many rows were filled. */
export function fillSearchText(db: DatabaseSync): number {
	let filled = 0;
	db.exec("BEGIN");
	try {
		for (const { table, columns } of SOURCES) {
			const update = db.prepare(`UPDATE ${table} SET search_text = ? WHERE id = ?`);
			const rows = db.prepare(`SELECT id, ${columns.join(", ")} FROM ${table} WHERE search_text = ''`).all() as Record<string, string | null>[];
			for (const row of rows) {
				const text = searchTextOf(...columns.map((column) => plain(row[column])));
				if (text) filled += Number(update.run(text, String(row.id)).changes);
			}
		}
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
	return filled;
}
