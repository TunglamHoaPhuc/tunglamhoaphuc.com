// Small things the operations services share.
import { auditStatement, type AuditEntry } from "../audit/log";
import type { AuthContext, Authed } from "../auth/service";
import type { AdminStmt } from "../db";
import { ApiError, forbidden } from "../http/errors";
import { SUPER_ADMIN_ROLE_ID } from "../rbac/catalog";

export const audit = (ctx: AuthContext, by: Authed, entry: Pick<AuditEntry, "action" | "entityType" | "entityId" | "before" | "after">): AdminStmt =>
	auditStatement(ctx.db, { ...entry, userId: by.user.id, userEmail: by.user.email, ip: ctx.ip, userAgent: ctx.userAgent }, ctx.now());

export const stamp = (ctx: AuthContext) => ctx.now().toISOString();

/** Some settings (mail server, security policy) are for the Super Admin alone, whatever else the role holds. */
export function requireSuperAdmin(by: Authed): void {
	if (by.user.roleId !== SUPER_ADMIN_ROLE_ID) throw forbidden();
}

/** A 400 that names the form field at fault. */
export const invalid = (field: string, message: string) => new ApiError(400, "invalid_input", message, { [field]: message });

/** The database error of a UNIQUE index (node:sqlite and D1 word it alike). */
export const isUniqueError = (error: unknown) => /UNIQUE constraint/i.test(error instanceof Error ? error.message : String(error));
export const isForeignKeyError = (error: unknown) => /FOREIGN KEY constraint/i.test(error instanceof Error ? error.message : String(error));

/** Vietnam time (UTC+7) as { date: "YYYY-MM-DD", time: "HHMM" }. */
export function vietnamParts(now: Date): { date: string; time: string } {
	const local = new Date(now.getTime() + 7 * 3600_000).toISOString();
	return { date: local.slice(0, 10), time: `${local.slice(11, 13)}${local.slice(14, 16)}` };
}
