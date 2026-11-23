// Backups: every table as one gzip JSON file, built a page at a time so a Worker never holds the database in memory.
// Left out on purpose: sessions, reset tokens, throttle counters, 2FA secrets and registrations, and from the rest every
// password hash and secret column (an account restored from a backup gets a new password through "forgot password").
// Restoring is a script, not an endpoint: scripts/restore-backup.ts (docs/van-hanh/sao-luu.md).
import { checkOwnPassword, type AuthContext, type Authed } from "../auth/service";
import { num, text, type AdminDb, type Row } from "../db";
import { ApiError } from "../http/errors";
import { audit, vietnamParts } from "./common";

/** The part of an R2 bucket the backups use. */
export type BackupBucket = {
	put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
	get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>;
	list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string; size: number; uploaded: Date }[]; truncated: boolean; cursor?: string }>;
	delete(keys: string | string[]): Promise<void>;
};

export const BACKUP_PREFIX = "backup/";
export const KEEP_BACKUPS = 30;
export const BACKUP_NAME = /^[0-9-]+\.json\.gz$/;
export const FORMAT = "tlhp-backup";

/** Tables never written to a backup. */
export const EXCLUDED_TABLES = ["session", "password_reset", "auth_throttle", "user_totp", "registration"] as const;
/** Columns never written, in any table. */
const SECRET_COLUMN = /^(password_hash|secret\w*|recovery\w*|\w*_secret|\w*_token|token_hash|refresh_hash|prev_refresh_hash)$/i;

const PAGE = 500;
/** Tables with big rows are read in smaller pages. */
const SMALL_PAGE: Record<string, number> = { revision: 20, post: 100, teaching_article: 100, page: 100, audit_log: 200 };
const SAFE_NAME = /^[A-Za-z0-9_]+$/;

type TableInfo = { name: string; columns: string[] };

/** The tables to save and their saved columns, read from the database itself so a new module's tables are included. */
async function plan(db: AdminDb): Promise<TableInfo[]> {
	const { results } = await db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
	const virtual = results.filter((row) => /^\s*CREATE\s+VIRTUAL\s+TABLE/i.test(text(row.sql))).map((row) => text(row.name));
	const tables: TableInfo[] = [];
	for (const row of results) {
		const name = text(row.name);
		if (!SAFE_NAME.test(name) || name.startsWith("_") || name.startsWith("sqlite_") || name === "d1_migrations") continue;
		// Search indexes (virtual tables and their shadow tables) are rebuilt from the content, not saved.
		if (virtual.some((v) => name === v || name.startsWith(`${v}_`))) continue;
		if ((EXCLUDED_TABLES as readonly string[]).includes(name)) continue;
		const info = await db.prepare(`PRAGMA table_info("${name}")`).all();
		const columns = info.results.map((column) => text(column.name)).filter((column) => SAFE_NAME.test(column) && !SECRET_COLUMN.test(column));
		if (columns.length) tables.push({ name, columns });
	}
	return tables;
}

/** A value as JSON can carry it. */
const plain = (value: unknown): unknown => (typeof value === "bigint" ? Number(value) : value instanceof Uint8Array || value instanceof ArrayBuffer ? null : value);

/** The saved mail settings keep their encrypted password out of the file too. */
function cleanRow(table: string, columns: string[], row: Row): unknown[] {
	const values = columns.map((column) => plain(row[column]));
	if (table === "setting") {
		const key = columns.indexOf("key");
		const value = columns.indexOf("value");
		if (key >= 0 && value >= 0 && values[key] === "mail.smtp" && typeof values[value] === "string") {
			try {
				const saved = JSON.parse(values[value] as string) as Record<string, unknown>;
				delete saved.passwordEnc;
				values[value] = JSON.stringify(saved);
			} catch {
				values[value] = "{}";
			}
		}
	}
	return values;
}

async function* pieces(db: AdminDb, now: Date): AsyncGenerator<string> {
	const tables = await plan(db);
	yield `{"format":"${FORMAT}","version":1,"createdAt":${JSON.stringify(now.toISOString())},"excluded":${JSON.stringify(EXCLUDED_TABLES)},"tables":{`;
	let firstTable = true;
	for (const table of tables) {
		yield `${firstTable ? "" : ","}${JSON.stringify(table.name)}:{"columns":${JSON.stringify(table.columns)},"rows":[`;
		firstTable = false;
		const select = `SELECT rowid AS __rowid, ${table.columns.map((column) => `"${column}"`).join(", ")} FROM "${table.name}" WHERE rowid > ? ORDER BY rowid LIMIT ?`;
		const size = Math.min(PAGE, SMALL_PAGE[table.name] ?? PAGE);
		let after = -1;
		let firstRow = true;
		for (;;) {
			const { results } = await db.prepare(select).bind(after, size).all();
			if (!results.length) break;
			let chunk = "";
			for (const row of results) {
				chunk += `${firstRow ? "" : ","}${JSON.stringify(cleanRow(table.name, table.columns, row))}`;
				firstRow = false;
			}
			yield chunk;
			after = num(results[results.length - 1].__rowid);
			if (results.length < size) break;
		}
		yield "]}";
	}
	yield "}}";
}

/** The backup as a gzip stream; the database is read only as the consumer pulls. */
export function exportStream(db: AdminDb, now: Date): ReadableStream<Uint8Array> {
	const iterator = pieces(db, now);
	const encoder = new TextEncoder();
	const source = new ReadableStream<Uint8Array>({
		async pull(controller) {
			const next = await iterator.next();
			if (next.done) controller.close();
			else controller.enqueue(encoder.encode(next.value));
		},
		cancel: () => void iterator.return(undefined),
	});
	return source.pipeThrough(new CompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>);
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
	const reader = stream.getReader();
	const parts: Uint8Array[] = [];
	let length = 0;
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		parts.push(value);
		length += value.length;
	}
	const out = new Uint8Array(length);
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
}

export const backupName = (now: Date) => {
	const { date, time } = vietnamParts(now);
	return `${date}-${time}.json.gz`;
};

// ------------------------------------------------------------------ the three actions

/** Checks the person's password again before a backup file leaves the server; wrong guesses slow down. */
export async function confirmPassword(ctx: AuthContext, by: Authed, password: string): Promise<void> {
	if (!(await checkOwnPassword(ctx, by.user.id, password))) throw new ApiError(400, "wrong_password", "Mật khẩu chưa đúng.", { password: "Mật khẩu chưa đúng." });
}

/** Records the download in the log, then returns the backup as a file to stream to the browser. */
export async function exportDownload(ctx: AuthContext, by: Authed): Promise<Response> {
	const now = ctx.now();
	const name = backupName(now);
	await audit(ctx, by, { action: "backup.export", entityType: "backup", entityId: name }).run();
	return new Response(exportStream(ctx.db, now), {
		status: 200,
		headers: {
			"Content-Type": "application/gzip",
			"Content-Disposition": `attachment; filename="tlhp-backup-${name}"`,
			"Cache-Control": "no-store",
			"X-Robots-Tag": "noindex",
		},
	});
}

export type StoredBackup = { name: string; size: number; createdAt: string };

async function listObjects(bucket: BackupBucket): Promise<StoredBackup[]> {
	const found: StoredBackup[] = [];
	let cursor: string | undefined;
	do {
		const page = await bucket.list({ prefix: BACKUP_PREFIX, cursor });
		for (const object of page.objects) {
			const name = object.key.slice(BACKUP_PREFIX.length);
			if (BACKUP_NAME.test(name)) found.push({ name, size: object.size, createdAt: object.uploaded.toISOString() });
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);
	return found.sort((a, b) => (a.name < b.name ? 1 : -1));
}

export const listBackups = listObjects;

/** Writes a backup to the bucket and keeps only the newest KEEP_BACKUPS. `by` is null when a schedule runs it. */
export async function runBackup(ctx: AuthContext, by: Authed | null, bucket: BackupBucket): Promise<StoredBackup & { removed: number }> {
	const now = ctx.now();
	const name = backupName(now);
	// R2 needs the length before it takes a body, so the compressed file (a fraction of the data) is gathered first.
	const bytes = await collect(exportStream(ctx.db, now));
	await bucket.put(`${BACKUP_PREFIX}${name}`, bytes, { httpMetadata: { contentType: "application/gzip" } });
	const all = await listObjects(bucket);
	const old = all.slice(KEEP_BACKUPS).map((backup) => `${BACKUP_PREFIX}${backup.name}`);
	if (old.length) await bucket.delete(old);
	const entry = { action: "backup.run", entityType: "backup", entityId: name, after: { size: bytes.length, removed: old.length } };
	if (by) await audit(ctx, by, entry).run();
	else await ctx.db.prepare("INSERT INTO audit_log (user_id, user_email, action, entity_type, entity_id, data_after, ip, user_agent, request_id, created_at) VALUES (NULL, 'lịch tự động', ?, ?, ?, ?, '', 'cron', '', ?)").bind(entry.action, entry.entityType, entry.entityId, JSON.stringify(entry.after), now.toISOString()).run();
	return { name, size: bytes.length, createdAt: now.toISOString(), removed: old.length };
}

export async function downloadStored(ctx: AuthContext, by: Authed, bucket: BackupBucket, name: string): Promise<Response> {
	if (!BACKUP_NAME.test(name)) throw new ApiError(404, "not_found", "Bản sao lưu không tồn tại.");
	const object = await bucket.get(`${BACKUP_PREFIX}${name}`);
	if (!object) throw new ApiError(404, "not_found", "Bản sao lưu không tồn tại.");
	await audit(ctx, by, { action: "backup.download", entityType: "backup", entityId: name }).run();
	return new Response(object.body, {
		status: 200,
		headers: { "Content-Type": "application/gzip", "Content-Length": String(object.size), "Content-Disposition": `attachment; filename="tlhp-backup-${name}"`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
	});
}
