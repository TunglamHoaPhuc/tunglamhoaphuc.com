// Loads a backup file (made by Sao lưu in the admin) into a SQLite file, from the operator's machine. Restoring is never done
// by the running site: see docs/van-hanh/sao-luu.md for the whole procedure.
//
//   npx tsx scripts/restore-backup.ts <backup.json.gz> <target.sqlite>
//
// The target must be a new file (or one with the migrations applied and no accounts or log): the script applies the migrations
// when the file has no tables, and refuses to load into a database that already holds accounts or log entries. Account passwords and 2FA are not in a backup:
// restored accounts have no password until it is set again (the admin's "Quên mật khẩu", or `npm run dev:db -- --seed` for a first Super Admin).
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import type { DatabaseSync } from "node:sqlite";
import { applyMigrations, openDatabase } from "../src/db/nodeSqlite";

export type BackupFile = { format: string; version: number; createdAt: string; tables: Record<string, { columns: string[]; rows: unknown[][] }> };

export type RestoreReport = { tables: Record<string, number>; warnings: string[] };

const SAFE_NAME = /^[A-Za-z0-9_]+$/;

export function parseBackupFile(bytes: Uint8Array): BackupFile {
	const data = JSON.parse(gunzipSync(bytes).toString("utf8")) as BackupFile;
	if (data.format !== "tlhp-backup" || data.version !== 1 || typeof data.tables !== "object") throw new Error("Đây không phải tệp sao lưu của Tùng Lâm Hòa Phúc (định dạng hoặc phiên bản khác).");
	return data;
}

const tableExists = (db: DatabaseSync, name: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

/** Puts the backup's rows into `db`, which has the schema and no data in these tables. All or nothing. */
export function restoreBackup(db: DatabaseSync, backup: BackupFile): RestoreReport {
	const report: RestoreReport = { tables: {}, warnings: [] };
	for (const table of ["user", "audit_log"]) {
		if (tableExists(db, table) && (db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n > 0) throw new Error(`Bảng ${table} ở CSDL đích đã có dữ liệu. Hãy khôi phục vào một tệp mới.`);
	}
	db.exec("PRAGMA foreign_keys = OFF");
	db.exec("BEGIN");
	try {
		for (const [table, saved] of Object.entries(backup.tables)) {
			if (!SAFE_NAME.test(table)) throw new Error(`Tên bảng không hợp lệ trong tệp sao lưu: ${table}`);
			if (!tableExists(db, table)) {
				report.warnings.push(`Bảng ${table} không có trong CSDL đích: bỏ qua.`);
				continue;
			}
			const present = new Set((db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((column) => column.name));
			const keep = saved.columns.map((name, index) => ({ name, index })).filter(({ name }) => SAFE_NAME.test(name) && present.has(name));
			for (const name of saved.columns) if (!present.has(name)) report.warnings.push(`Cột ${table}.${name} không có trong CSDL đích: bỏ qua.`);
			// What the migrations put in (the menus) gives way to the backup's rows.
			db.exec(`DELETE FROM "${table}"`);
			const insert = db.prepare(`INSERT INTO "${table}" (${keep.map((c) => `"${c.name}"`).join(", ")}) VALUES (${keep.map(() => "?").join(", ")})`);
			for (const row of saved.rows) insert.run(...(keep.map((c) => row[c.index] ?? null) as never[]));
			report.tables[table] = saved.rows.length;
		}
		const broken = db.prepare("PRAGMA foreign_key_check").all();
		if (broken.length) report.warnings.push(`${broken.length} dòng tham chiếu tới dòng không có trong bản sao lưu (kiểm tra lại các bảng liên quan).`);
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	} finally {
		db.exec("PRAGMA foreign_keys = ON");
	}
	return report;
}

function main() {
	const [file, target] = process.argv.slice(2);
	if (!file || !target) {
		console.error("Cách dùng: npx tsx scripts/restore-backup.ts <tep-sao-luu.json.gz> <csdl-dich.sqlite>");
		process.exit(2);
	}
	if (!existsSync(file)) {
		console.error(`Không thấy tệp ${file}`);
		process.exit(2);
	}
	const backup = parseBackupFile(readFileSync(file));
	const db = openDatabase(target);
	if (!tableExists(db, "user")) console.log(`Áp dụng ${applyMigrations(db).length} tệp migration vào ${target}…`);
	const report = restoreBackup(db, backup);
	db.close();
	console.log(`Bản sao lưu lập lúc ${backup.createdAt}. Đã khôi phục vào ${target}:`);
	for (const [table, rows] of Object.entries(report.tables)) console.log(`  ${table}: ${rows} dòng`);
	for (const warning of report.warnings) console.warn(`Lưu ý: ${warning}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
