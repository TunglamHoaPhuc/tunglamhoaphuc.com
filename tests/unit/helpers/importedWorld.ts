// An admin world holding the real data of the old site: data/snapshot imported the way the owner's D1 was (no sample rows of
// contentWorld). The snapshot is not in git (it is the old site's data), so the tests that use it skip without it.
import { existsSync, readFileSync } from "node:fs";
import { buildStatements, loadContent } from "../../../src/db/import";
import { applyStatements } from "../../../src/db/nodeSqlite";
import type { ReadFile } from "../../../src/libs/content/sources/files";
import { contentWorld } from "./contentWorld";

export const HAS_SNAPSHOT = ["posts", "tong-chi", "gioi-thieu"].every((name) => existsSync(`data/snapshot/${name}.json`));

const readFromDisk: ReadFile = async (name) => {
	const path = `data/snapshot/${name}.json`;
	return existsSync(path) ? { version: "snapshot", data: JSON.parse(readFileSync(path, "utf8")) } : null;
};

export async function importedWorld() {
	const w = await contentWorld();
	// the world's own sample rows would clash with the import: start from the import alone
	for (const table of ["milestone", "page", "teaching_article", "post", "album", "statue", "media"]) w.raw.exec(`DELETE FROM ${table}`);
	w.raw.exec("DELETE FROM category");
	applyStatements(w.raw, buildStatements(await loadContent(readFromDisk, { error: () => undefined })).statements);
	return w;
}
