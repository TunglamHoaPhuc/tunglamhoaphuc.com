// The activity log viewer. Read only: there is no function here (or route) that changes or deletes an entry, and the
// database refuses it anyway (triggers of migration 0002).
import type { AuthContext } from "../auth/service";
import { num, text, type Row } from "../db";
import { ApiError, notFound } from "../http/errors";
import { likeWord, type Page } from "../http/paging";

export const auditPageSize = 50;

export type AuditFilter = { userId?: string; action?: string; entityType?: string; entityId?: string; from?: string; to?: string; ip?: string; q?: string };

export type AuditRow = {
	id: number;
	userId: string | null;
	userEmail: string;
	userName: string;
	action: string;
	entityType: string;
	entityId: string;
	ip: string;
	createdAt: string;
};

export type AuditDetail = AuditRow & { userAgent: string; requestId: string; before: unknown; after: unknown };

/** A day typed as YYYY-MM-DD means Vietnam time; a full ISO time is taken as it is. */
function bound(value: string, name: string, endOfDay: boolean): string {
	const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
	const date = new Date(dayOnly ? `${value}T00:00:00+07:00` : value);
	if (Number.isNaN(date.getTime())) throw new ApiError(400, "invalid_input", "Ngày chưa đúng.", { [name]: "Ngày chưa đúng (dạng năm-tháng-ngày)." });
	// The end of a day is the start of the next one, so the range includes the whole last day.
	return new Date(date.getTime() + (dayOnly && endOfDay ? 24 * 3600_000 : 0)).toISOString();
}

const SELECT = `SELECT a.id, a.user_id, a.user_email, COALESCE(u.name, '') AS user_name, a.action, a.entity_type, a.entity_id, a.ip, a.created_at,
	a.user_agent, a.request_id, a.data_before, a.data_after FROM audit_log a LEFT JOIN user u ON u.id = a.user_id`;

function toRow(row: Row): AuditRow {
	return {
		id: num(row.id),
		userId: text(row.user_id) || null,
		userEmail: text(row.user_email),
		userName: text(row.user_name),
		action: text(row.action),
		entityType: text(row.entity_type),
		entityId: text(row.entity_id),
		ip: text(row.ip),
		createdAt: text(row.created_at),
	};
}

const parse = (value: unknown): unknown => {
	if (typeof value !== "string" || !value) return null;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

export async function listAudit(ctx: AuthContext, filter: AuditFilter, page: Page): Promise<{ rows: AuditRow[]; total: number }> {
	const where: string[] = [];
	const args: unknown[] = [];
	const equals = (column: string, value: string | undefined) => {
		if (!value) return;
		where.push(`${column} = ?`);
		args.push(value);
	};
	equals("a.user_id", filter.userId);
	equals("a.action", filter.action);
	equals("a.entity_type", filter.entityType);
	equals("a.entity_id", filter.entityId);
	equals("a.ip", filter.ip);
	if (filter.from) {
		where.push("a.created_at >= ?");
		args.push(bound(filter.from, "from", false));
	}
	if (filter.to) {
		where.push("a.created_at < ?");
		args.push(bound(filter.to, "to", true));
	}
	if (filter.q) {
		const word = likeWord(filter.q);
		where.push("(a.user_email LIKE ? ESCAPE '\\' OR a.action LIKE ? ESCAPE '\\' OR a.entity_type LIKE ? ESCAPE '\\' OR a.entity_id LIKE ? ESCAPE '\\')");
		args.push(word, word, word, word);
	}
	const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
	const total = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM audit_log a${clause}`).bind(...args).first();
	const { results } = await ctx.db.prepare(`${SELECT}${clause} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`).bind(...args, page.pageSize, page.offset).all();
	return { rows: results.map(toRow), total: num(total?.n) };
}

export async function getAudit(ctx: AuthContext, id: string): Promise<AuditDetail> {
	if (!/^\d{1,15}$/.test(id)) throw notFound("Dòng nhật ký");
	const row = await ctx.db.prepare(`${SELECT} WHERE a.id = ?`).bind(Number(id)).first();
	if (!row) throw notFound("Dòng nhật ký");
	return { ...toRow(row), userAgent: text(row.user_agent), requestId: text(row.request_id), before: parse(row.data_before), after: parse(row.data_after) };
}
