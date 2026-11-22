// The activity log: who did what to what, when, from where, with the data before and after. Rows are
// only ever added: triggers in the database refuse to change or delete one (migration 0002).
import type { AdminDb, AdminStmt } from "../db";

export type AuditEntry = {
	userId: string | null;
	userEmail: string;
	action: string;
	entityType: string;
	entityId: string;
	before?: unknown;
	after?: unknown;
	ip: string;
	userAgent: string;
	requestId?: string;
};

/** Fields that never go into the log, wherever they appear. */
const SECRET = /pass(word)?|secret|token|hash|recovery|smtp_?pass/i;

/** The data with secrets blanked and long text cut down to its length, so the log stays small and holds no secret. */
export function scrub(value: unknown, depth = 0): unknown {
	if (value == null || typeof value !== "object") {
		if (typeof value === "string" && value.length > 500) return `[${value.length} ký tự]`;
		return value;
	}
	if (depth > 6) return "[…]";
	if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrub(item, depth + 1));
	return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, SECRET.test(key) ? "[đã ẩn]" : scrub(inner, depth + 1)]));
}

/**
 * The statement that records `entry`: put it in the same batch as the change it describes. With `when`, the row is written only if
 * that SQL condition holds at that point of the batch (a refused concurrent change leaves no entry saying it happened).
 */
export function auditStatement(db: AdminDb, entry: AuditEntry, now: Date, when?: { sql: string; args: unknown[] }): AdminStmt {
	const values = [
		entry.userId,
		entry.userEmail,
		entry.action,
		entry.entityType,
		entry.entityId,
		entry.before === undefined ? null : JSON.stringify(scrub(entry.before)),
		entry.after === undefined ? null : JSON.stringify(scrub(entry.after)),
		entry.ip,
		entry.userAgent.slice(0, 300),
		entry.requestId ?? "",
		now.toISOString(),
	];
	const columns = "user_id, user_email, action, entity_type, entity_id, data_before, data_after, ip, user_agent, request_id, created_at";
	const marks = values.map(() => "?").join(", ");
	if (when) return db.prepare(`INSERT INTO audit_log (${columns}) SELECT ${marks} WHERE ${when.sql}`).bind(...values, ...when.args);
	return db.prepare(`INSERT INTO audit_log (${columns}) VALUES (${marks})`).bind(...values);
}

export async function writeAudit(db: AdminDb, entry: AuditEntry, now: Date): Promise<void> {
	await auditStatement(db, entry, now).run();
}
