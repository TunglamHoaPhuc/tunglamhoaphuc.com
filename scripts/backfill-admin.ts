// Records which pictures the article texts use (docs/admin-architecture.md 5.8), so the media library does not
// call them "unused". Runs on a SQLite file: the local D1 by default, or any file given with --db=<path>.
//   npm run backfill:admin
// For the real D1, export it to a file first, run this on the copy and review the added rows; nothing here talks
// to Cloudflare.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { backfillContentUsage } from "../src/db/mediaBackfill";
import { openDatabase } from "../src/db/nodeSqlite";

const STATE_DIR = ".cloudflare/state/v3/d1/miniflare-D1DatabaseObject";
const explicit = process.argv.find((arg) => arg.startsWith("--db="))?.slice(5);

function findFile(): string {
	if (explicit) return explicit;
	if (!existsSync(STATE_DIR)) throw new Error(`${STATE_DIR} does not exist; pass --db=<path>.`);
	const files = readdirSync(STATE_DIR).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
	if (files.length !== 1) throw new Error(`Expected one local D1 file, found ${files.length}; pass --db=<path>.`);
	return join(STATE_DIR, files[0]);
}

try {
	const db = openDatabase(findFile());
	const result = backfillContentUsage(db);
	console.log(`pictures found in texts: ${result.found}, usage rows added: ${result.added}`);
	db.close();
} catch (error) {
	console.error((error as Error).message);
	process.exit(1);
}
