// npm run import -- --from=snapshot --sql=data/import.sql
// npm run import -- --from=snapshot --db=path/to/database.sqlite
// npm run import -- --from=snapshot --merge --dry-run --db=path/to/database.sqlite
//
// T23: the old admin's content into the D1 tables (src/db/schema.ts). It can be run again and
// again; the same source gives the same rows. That is a full import: it overwrites every content
// column of a row that is there and removes the rows the source no longer has, so it is for an
// empty or a throwaway database. Once the new admin writes to the database, use --merge.
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
//   --merge           only add: insert the rows the database lacks (`on conflict do nothing`), never
//                     update, delete or prune; a row that is there is kept as it is (what the admin
//                     edited, trashed or made, and what the source dropped). Safe on a database the
//                     admin writes to. The children of a page (milestones), an album (photos) and a
//                     statue (works of art) are only added under a parent the admin has never touched
//                     (new in the source, or still as an import left it): the admin saves them as a
//                     whole list, so what it deleted must not come back
//   --force           the default mode (no --merge) with --db refuses a file that already holds the
//                     admin's data (a row in user or audit_log), for it overwrites and prunes; --force
//                     says that is what is wanted
//   --dry-run         read the source, count, build the statements and print a summary, write nothing
//                     (--sql, --batches and --db are not written; with --db the file is opened
//                     read-only to count what --merge would add, and must exist already)
//
// With neither --sql nor --db it only reads, counts and checks. Any other flag, or an argument that
// does not start with --, stops the script before it reads the source or opens a database.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildStatements, countsOf, inlineStatement, loadContent, type MergeConflict, mergeReport, type NewRows } from "../src/db/import";
import { applyMigrations, applyStatements, openDatabase } from "../src/db/nodeSqlite";
import { b2Config, createB2Reader } from "../src/libs/content/sources/b2";
import type { ReadFile } from "../src/libs/content/sources/files";

/** The flags that take a value (--db=file) and the ones that are only there or not (--merge). */
const VALUE_FLAGS = ["from", "sql", "db", "batches"];
const SWITCH_FLAGS = ["migrate", "allow-empty", "merge", "dry-run", "force"];

/** The flags as a map, or the ones the script does not know: a misspelt `--marge` must not run the default import. */
function parseFlags(argv: string[]): { args: Map<string, string>; wrong: string[] } {
	const args = new Map<string, string>();
	const wrong: string[] = [];
	for (const arg of argv) {
		const [name, ...rest] = arg.slice(2).split("=");
		const value = rest.join("=");
		const known = arg.startsWith("--") && ((VALUE_FLAGS.includes(name) && rest.length > 0 && value !== "") || (SWITCH_FLAGS.includes(name) && rest.length === 0));
		if (known) args.set(name, value);
		else wrong.push(arg);
	}
	return { args, wrong };
}

const parsed = parseFlags(process.argv.slice(2));
if (parsed.wrong.length) {
	console.error(
		[
			`Tham số không hợp lệ: ${parsed.wrong.join(", ")}`,
			`Các cờ đúng: ${VALUE_FLAGS.map((name) => `--${name}=<giá trị>`).join(", ")}, ${SWITCH_FLAGS.map((name) => `--${name}`).join(", ")}`,
			"Cờ có giá trị viết dạng --tên=giá-trị; cờ bật/tắt viết một mình, không có dấu =. Chưa đọc nguồn và chưa mở CSDL.",
		].join("\n"),
	);
	process.exit(1);
}
const args = parsed.args;

const source = args.get("from") || "snapshot";
const sqlOut = args.get("sql");
const dbPath = args.get("db");
const batchesDir = args.get("batches");
const merge = args.has("merge");
const dryRun = args.has("dry-run");
const force = args.has("force");
const BATCH_BYTES = 500_000;

const readSnapshot: ReadFile = async (name) => {
	try {
		return { version: "snapshot", data: JSON.parse(readFileSync(`data/snapshot/${name}.json`, "utf8")) };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
};

/**
 * What --merge adds to the database: per table, the rows the source has and the ones that are added (the key
 * is not there, no live row has the same slug or code, and a child's parent is new or untouched by the admin),
 * then the rows turned away by a slug or code, which is a warning, and the ones that would break a foreign
 * key and so make the whole run fail.
 */
function printNewRows({ rows, conflicts }: { rows: NewRows[]; conflicts: MergeConflict[] }) {
	console.log("Dòng nguồn có và dòng sẽ thêm vào CSDL (--merge):");
	for (const { table, source, added } of rows) console.log(`  ${table.padEnd(18)}: ${source} trong nguồn, ${added} sẽ thêm`);
	console.log(`  Tổng: ${rows.reduce((sum, row) => sum + row.added, 0)} dòng sẽ thêm`);
	const turnedAway = conflicts.filter((conflict) => conflict.reason !== "foreign-key");
	const broken = conflicts.filter((conflict) => conflict.reason === "foreign-key");
	const list = (items: MergeConflict[]) => {
		for (const { detail } of items.slice(0, 30)) console.log(`    ${detail}`);
		if (items.length > 30) console.log(`    ... và ${items.length - 30} dòng nữa`);
	};
	if (turnedAway.length) {
		console.log(`Cảnh báo: ${turnedAway.length} dòng nguồn trùng đường dẫn (slug) hoặc mã với dòng đang có, sẽ bị bỏ qua:`);
		list(turnedAway);
	}
	if (broken.length) {
		console.log(`LỖI: ${broken.length} dòng sẽ thêm trỏ tới dòng bị bỏ qua ở trên; khóa ngoại sai nên cả lượt nhập sẽ bị hủy (không ghi gì). Đổi đường dẫn bên nguồn hoặc bên Admin trước.`);
		list(broken);
	}
}

/** The default mode overwrites and prunes: it must not run on a file that holds what the admin wrote, unless told (--force). */
function refuseAdminData(path: string) {
	if (merge || dryRun || force || !existsSync(path)) return;
	const db = new DatabaseSync(path, { readOnly: true });
	try {
		const holding = ["user", "audit_log"].filter((table) => {
			if (!db.prepare("select 1 as found from sqlite_master where type = 'table' and name = ?").get(table)) return false;
			return db.prepare(`select 1 as found from "${table}" limit 1`).get() !== undefined;
		});
		if (holding.length) {
			throw new Error(
				`CSDL ${path} đã có dữ liệu của Admin (bảng ${holding.join(", ")} có dòng). Chế độ mặc định ghi đè và xóa dòng nên không chạy trên CSDL này. Dùng --merge để chỉ thêm dòng mới, hoặc thêm --force nếu đúng là muốn ghi đè.`,
			);
		}
	} finally {
		db.close();
	}
}

async function main() {
	if (dbPath) refuseAdminData(dbPath);
	if (source !== "snapshot" && source !== "b2") throw new Error(`--from không hợp lệ: "${source}" (snapshot | b2)`);
	const read = source === "b2" ? createB2Reader(b2Config(process.env)) : readSnapshot;
	const content = await loadContent(read);
	const counts = countsOf(content);
	console.log(`Nguồn ${source}:`, counts);

	const empty = Object.entries(counts).filter(([, count]) => count === 0);
	if (empty.length && !args.has("allow-empty")) {
		throw new Error(`Không có dòng nào cho: ${empty.map(([name]) => name).join(", ")}. Nếu đúng như vậy, thêm --allow-empty.`);
	}

	const { statements, report } = buildStatements(content, { merge });
	console.log(`${report.statements} câu lệnh, câu dài nhất ${(report.largestBytes / 1024).toFixed(1)} KB${merge ? " (--merge: chỉ thêm dòng mới, không sửa, không xóa)" : ""}`);
	if (report.oversizedRows.length) {
		throw new Error(`Có dòng quá lớn cho một câu lệnh D1 (100 KB):\n  ${report.oversizedRows.join("\n  ")}`);
	}

	if (dryRun) {
		console.log("--dry-run: chỉ đọc và đếm, không ghi gì.");
		for (const [flag, value] of [["--sql", sqlOut], ["--batches", batchesDir]] as const) if (value) console.log(`  Bỏ qua ${flag}=${value}`);
		if (dbPath) {
			if (!existsSync(dbPath)) throw new Error(`--dry-run --db: không có tệp ${dbPath} (không tạo mới)`);
			const db = new DatabaseSync(dbPath, { readOnly: true });
			try {
				printNewRows(mergeReport(db, report.tables));
			} finally {
				db.close();
			}
		}
		return;
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
		if (merge) printNewRows(mergeReport(db, report.tables));
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
