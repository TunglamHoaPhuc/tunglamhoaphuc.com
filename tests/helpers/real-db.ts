// Kiểm thử trên dữ liệu thật: một tệp SQLite đã migrate (0001-0005) và nhập từ data/snapshot đúng như www làm, KHÔNG nằm trong repo.
// Đặt biến môi trường TLHP_REAL_DB trỏ tới tệp đó thì các kiểm thử "v3-real-*" chạy; không đặt thì chúng bỏ qua (SKIP_REAL nói lý do).
//
// Dựng tệp (từ cây www, không sửa gì ở đó; lệnh đọc data/snapshot và migrations/ theo thư mục hiện hành):
//   mkdir work/data; copy <www>/data/snapshot -> work/data/snapshot; copy <www>/migrations -> work/migrations
//   cd work; node <www>/node_modules/tsx/dist/cli.mjs <www>/scripts/import.ts --from=snapshot --db=<tệp.sqlite> --migrate
// Kiểm thử đột biến (nháp, hẹn giờ, thùng rác...) làm việc trên BẢN SAO nằm cạnh tệp thật (thư mục copies/), xóa khi xong; tệp thật chỉ mở để đọc.
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { DatabaseSync } from "node:sqlite";
import type { D1Like } from "@/lib/tlhp-content/sources/d1";
import { d1Over } from "./d1";

export const REAL_DB = process.env.TLHP_REAL_DB;

/** Lý do bỏ qua, hoặc `false` khi có tệp thật: truyền thẳng vào `test(name, { skip: SKIP_REAL }, …)`. */
export const SKIP_REAL: string | false = REAL_DB && existsSync(REAL_DB) ? false : "TLHP_REAL_DB chưa đặt (hoặc tệp không có): bỏ qua kiểm thử trên dữ liệu thật; xem tests/helpers/real-db.ts";

/** The real file opened read-only, with the D1-shaped reader over it. */
export function openReal(): { sqlite: DatabaseSync; d1: D1Like } {
	if (!REAL_DB) throw new Error("TLHP_REAL_DB chưa đặt");
	const sqlite = new DatabaseSync(REAL_DB, { readOnly: true });
	return { sqlite, d1: d1Over(sqlite) };
}

export type Copy = { sqlite: DatabaseSync; d1: D1Like; close(): void };

let counter = 0;

/** A writable copy of the real file (for the tests that insert or update rows). `close()` deletes it. */
export function copyOfReal(): Copy {
	if (!REAL_DB) throw new Error("TLHP_REAL_DB chưa đặt");
	const dir = path.join(path.dirname(REAL_DB), "copies");
	mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `copy-${process.pid}-${++counter}.sqlite`);
	copyFileSync(REAL_DB, file);
	const sqlite = new DatabaseSync(file);
	return {
		sqlite,
		d1: d1Over(sqlite),
		close() {
			sqlite.close();
			rmSync(file, { force: true });
		},
	};
}

/** Rows of a query on the sqlite file, as plain objects. */
export function rows<T = Record<string, unknown>>(sqlite: DatabaseSync, sql: string, ...params: unknown[]): T[] {
	return sqlite.prepare(sql).all(...(params as never[])) as T[];
}

/** The time as www stores it (ISO, UTC, milliseconds): what a row's `publish_at` is compared with. */
export const nowIso = () => new Date().toISOString();

// ── Báo cáo sai khác theo trường ────────────────────────────────────────────────────────────────────────────────────
const brief = (value: unknown) => {
	const text = typeof value === "string" ? value : JSON.stringify(value);
	return (text ?? "undefined").length > 90 ? `${(text ?? "").slice(0, 90)}…` : text;
};

/**
 * Gom sai khác theo trường qua MỌI dòng, rồi báo một lần: `differs` (V3 khác D1) và `lost` (D1 có chữ/ảnh mà V3 để trống).
 * Một lần chạy cho biết cả danh sách trường hỏng cùng số dòng, thay vì dừng ở dòng đầu.
 */
export class FieldReport {
	readonly differs = new Map<string, { count: number; samples: string[] }>();
	readonly lost = new Map<string, { count: number; samples: string[] }>();
	rowsChecked = 0;
	/** Trường → số dòng mà D1 có giá trị (để biết một trường "bằng nhau" không phải vì cả hai đều trống). */
	readonly populated = new Map<string, number>();

	readonly kind: string;

	constructor(kind: string) {
		this.kind = kind;
	}

	row() {
		this.rowsChecked++;
	}

	private add(map: FieldReport["differs"], field: string, sample: string) {
		const entry = map.get(field) ?? { count: 0, samples: [] };
		entry.count++;
		if (entry.samples.length < 3) entry.samples.push(sample);
		map.set(field, entry);
	}

	/** `actual` (V3) phải bằng `expected` (D1) từng byte. */
	eq(field: string, id: string, expected: unknown, actual: unknown) {
		if (expected !== null && expected !== undefined && expected !== "" && !(Array.isArray(expected) && !expected.length)) this.populated.set(field, (this.populated.get(field) ?? 0) + 1);
		if (!isDeepStrictEqual(expected, actual)) this.add(this.differs, field, `${id}: D1=${brief(expected)} V3=${brief(actual)}`);
		const filled = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== "" && v !== false);
		if (filled(expected) && !filled(actual)) this.add(this.lost, field, `${id}: D1=${brief(expected)}`);
	}

	summary(): string {
		const fields = [...this.populated].map(([field, n]) => `${field}=${n}`).join(" ");
		return `${this.kind}: ${this.rowsChecked} dòng; trường có dữ liệu ở D1 (số dòng): ${fields}`;
	}

	assertClean() {
		const dump = (map: FieldReport["differs"]) => Object.fromEntries([...map].map(([field, { count, samples }]) => [field, { count, samples }]));
		assert.ok(this.rowsChecked > 0, `${this.kind}: không kiểm dòng nào`);
		assert.deepEqual({ differs: dump(this.differs), lost: dump(this.lost) }, { differs: {}, lost: {} }, `${this.kind}: V3 khác D1`);
	}
}
