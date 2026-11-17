// npm run import -- --from=snapshot --sql=data/import.sql
// npm run import -- --from=snapshot --db=path/to/database.sqlite
//
// T23: the old admin's content into the D1 tables (src/db/schema.ts). It can be run again and
// again; the same source gives the same rows.
//
//   --from=snapshot   the files in data/snapshot (default), or
//   --from=b2         the bucket the old admin writes (B2_ENDPOINT, B2_BUCKET, B2_KEY_ID,
//                     B2_APPLICATION_KEY, optional B2_PREFIX; read-only key)
//   --sql=<file>      write the statements to a .sql file, to run with `cf d1 execute`
//   --batches=<dir>   write the statements as numbered batch-NNN.json files (each a JSON array of
//                     { sql } under about 500 KB), for `cf d1 query <id> --batch @<file>`: the way into
//                     a real D1, whose API takes 100 bound values a statement, so the values are written
//                     into the SQL
//   --db=<file>       run them on a SQLite file; with --migrate, create the tables first (migrations/)
//   --migrate         with --db: apply migrations/ to the file before importing
//   --allow-empty     go on when a kind of content has no rows (by default that is taken for
//                     a failed read and nothing is written, so a bad fetch cannot empty the tables)
//
// With neither --sql nor --db it only reads, counts and checks.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildStatements, countsOf, inlineStatement, loadContent } from "../src/db/import";
import { applyMigrations, applyStatements, openDatabase } from "../src/db/nodeSqlite";
import { b2Config, createB2Reader } from "../src/libs/content/sources/b2";
import type { ReadFile } from "../src/libs/content/sources/files";

const args = new Map(
	process.argv.slice(2).map((arg) => {
		const [key, ...rest] = arg.replace(/^--/, "").split("=");
		return [key, rest.join("=")] as const;
	}),
);

const source = args.get("from") || "snapshot";
const sqlOut = args.get("sql");
const dbPath = args.get("db");
const batchesDir = args.get("batches");
const BATCH_BYTES = 500_000;

const readSnapshot: ReadFile = async (name) => {
	try {
		return { version: "snapshot", data: JSON.parse(readFileSync(`data/snapshot/${name}.json`, "utf8")) };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
};

async function main() {
	if (source !== "snapshot" && source !== "b2") throw new Error(`--from không hợp lệ: "${source}" (snapshot | b2)`);
	const read = source === "b2" ? createB2Reader(b2Config(process.env)) : readSnapshot;
	const content = await loadContent(read);
	const counts = countsOf(content);
	console.log(`Nguồn ${source}:`, counts);

	const empty = Object.entries(counts).filter(([, count]) => count === 0);
	if (empty.length && !args.has("allow-empty")) {
		throw new Error(`Không có dòng nào cho: ${empty.map(([name]) => name).join(", ")}. Nếu đúng như vậy, thêm --allow-empty.`);
	}

	const { statements, report } = buildStatements(content);
	console.log(`${report.statements} câu lệnh, câu dài nhất ${(report.largestBytes / 1024).toFixed(1)} KB`);
	if (report.oversizedRows.length) {
		throw new Error(`Có dòng quá lớn cho một câu lệnh D1 (100 KB):\n  ${report.oversizedRows.join("\n  ")}`);
	}

	if (sqlOut) {
		mkdirSync(dirname(sqlOut), { recursive: true });
		writeFileSync(sqlOut, `${statements.map(inlineStatement).join("\n")}\n`);
		console.log(`Đã ghi ${sqlOut}`);
	}
	if (batchesDir) {
		mkdirSync(batchesDir, { recursive: true });
		let batch: { sql: string }[] = [];
		let bytes = 0;
		let files = 0;
		const flush = () => {
			if (!batch.length) return;
			writeFileSync(`${batchesDir}/batch-${String(++files).padStart(3, "0")}.json`, JSON.stringify(batch));
			batch = [];
			bytes = 0;
		};
		for (const statement of statements) {
			const sql = inlineStatement(statement);
			if (batch.length && bytes + sql.length > BATCH_BYTES) flush();
			batch.push({ sql });
			bytes += sql.length;
		}
		flush();
		console.log(`Đã ghi ${files} lô vào ${batchesDir}`);
	}
	if (dbPath) {
		const db = openDatabase(dbPath);
		if (args.has("migrate")) console.log(`Bảng: ${applyMigrations(db).join(", ")}`);
		applyStatements(db, statements);
		const broken = db.prepare("PRAGMA foreign_key_check").all();
		if (broken.length) throw new Error(`${broken.length} khóa ngoại sai sau khi nhập`);
		db.close();
		console.log(`Đã nhập vào ${dbPath}`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
