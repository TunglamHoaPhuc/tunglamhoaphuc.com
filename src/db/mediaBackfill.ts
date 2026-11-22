// Finds the pictures that sit inside article text and records them in `media_usage`, so "unused" and the
// delete guard of the media library tell the truth about imported content. Node only (scripts/backfill-admin.ts).
// A picture's media id is the one the import made: the first 20 hex digits of the SHA-1 of its site address.
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { addressesIn } from "../admin/media/ids";
import { mediaUrl, storedMediaAddress } from "../libs/content/media";

/** The media ids of every picture address found in `text`: the id the import gave the address the picture was filed under (admin/media/ids.ts). */
export function mediaIdsIn(text: string): Set<string> {
	const ids = new Set<string>();
	for (const address of addressesIn(text)) {
		const filed = mediaUrl(address)?.startsWith("/anh-goc/") ? storedMediaAddress(address) : null;
		if (filed) ids.add(createHash("sha1").update(filed).digest("hex").slice(0, 20));
	}
	return ids;
}

/** Where text lives: table, id column, the text columns, and the field name recorded in `media_usage`. */
const TEXT_SOURCES: { table: string; columns: string[]; field: string }[] = [
	{ table: "post", columns: ["content_html", "intro", "summary"], field: "content" },
	{ table: "teaching_article", columns: ["body", "excerpt"], field: "content" },
	{ table: "page", columns: ["content_html", "overview"], field: "content" },
	{ table: "area", columns: ["content_html", "intro"], field: "content" },
	{ table: "statue", columns: ["body"], field: "content" },
	{ table: "calendar_event", columns: ["description", "notes"], field: "content" },
];

/** Adds a usage row for every picture in the texts that exists in `media`. Returns how many rows it added. */
export function backfillContentUsage(db: DatabaseSync): { found: number; added: number } {
	const known = new Set((db.prepare("SELECT id FROM media").all() as { id: string }[]).map((row) => row.id));
	const insert = db.prepare("INSERT OR IGNORE INTO media_usage (media_id, entity_type, entity_id, field) VALUES (?, ?, ?, ?)");
	let found = 0;
	let added = 0;
	db.exec("BEGIN");
	try {
		for (const source of TEXT_SOURCES) {
			const rows = db.prepare(`SELECT id, ${source.columns.join(" || ' ' || ")} AS body FROM ${source.table}`).all() as { id: string; body: string | null }[];
			for (const row of rows) {
				for (const id of mediaIdsIn(row.body ?? "")) {
					if (!known.has(id)) continue;
					found++;
					added += Number(insert.run(id, source.table, row.id, source.field).changes);
				}
			}
		}
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
	return { found, added };
}
