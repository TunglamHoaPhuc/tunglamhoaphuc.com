// Accounts and roles, as the people who manage them see them (docs/admin-architecture.md 6.4, 7.2).
// The rules that sit outside the permission table are here, so no route can forget them:
// - nobody changes, locks, deletes or gives a role to anyone holding rights beyond their own;
// - only a Super Admin gives or takes the Super Admin role, and one always remains;
// - nobody locks, deletes or changes the role of their own account.
import { auditStatement, type AuditEntry } from "../audit/log";
import { hashPassword } from "../auth/password";
import type { AuthContext, Authed } from "../auth/service";
import { randomToken } from "../auth/tokens";
import { num, text, type AdminStmt, type Row } from "../db";
import { listSessions } from "../auth/service";
import { ApiError, forbidden, notFound } from "../http/errors";
import { likeWord, type Page } from "../http/paging";
import { newId } from "../ids";
import { isKnownPermission, isOwnable, SUPER_ADMIN_ROLE_ID, type Permissions, type Scope } from "../rbac/catalog";
import { can, covers, loadPermissions } from "../rbac/check";

const stamp = (ctx: AuthContext) => ctx.now().toISOString();
const audit = (ctx: AuthContext, by: Authed, entry: Pick<AuditEntry, "action" | "entityType" | "entityId" | "before" | "after">) =>
	auditStatement(ctx.db, { ...entry, userId: by.user.id, userEmail: by.user.email, ip: ctx.ip, userAgent: ctx.userAgent }, ctx.now());

export type UserRow = {
	id: string;
	email: string;
	name: string;
	roleId: string | null;
	roleName: string;
	locked: boolean;
	lockedReason: string;
	mfaEnabled: boolean;
	mustChangePassword: boolean;
	lastLoginAt: string | null;
	createdAt: string | null;
};

const USER_SELECT = `SELECT u.id, u.email, u.name, u.role_id, r.name AS role_name, u.locked_at, u.locked_reason, u.must_change_password, u.last_login_at, u.created_at,
	(SELECT 1 FROM user_totp t WHERE t.user_id = u.id AND t.enabled_at IS NOT NULL) AS mfa
	FROM user u LEFT JOIN role r ON r.id = u.role_id`;

const toUser = (row: Row): UserRow => ({
	id: text(row.id),
	email: text(row.email),
	name: text(row.name),
	roleId: text(row.role_id) || null,
	roleName: text(row.role_name),
	locked: !!row.locked_at,
	lockedReason: text(row.locked_reason),
	mfaEnabled: num(row.mfa) === 1,
	mustChangePassword: num(row.must_change_password) === 1,
	lastLoginAt: text(row.last_login_at) || null,
	createdAt: text(row.created_at) || null,
});

export async function listUsers(ctx: AuthContext, filter: { q?: string; roleId?: string; status?: string }, page: Page): Promise<{ rows: UserRow[]; total: number }> {
	const where = ["u.deleted_at IS NULL"];
	const args: unknown[] = [];
	if (filter.q) {
		where.push("(u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\')");
		args.push(likeWord(filter.q), likeWord(filter.q));
	}
	if (filter.roleId) {
		where.push("u.role_id = ?");
		args.push(filter.roleId);
	}
	if (filter.status === "locked") where.push("u.locked_at IS NOT NULL");
	if (filter.status === "active") where.push("u.locked_at IS NULL");
	const clause = where.join(" AND ");
	const total = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM user u WHERE ${clause}`).bind(...args).first();
	const { results } = await ctx.db.prepare(`${USER_SELECT} WHERE ${clause} ORDER BY u.created_at DESC, u.email LIMIT ? OFFSET ?`).bind(...args, page.pageSize, page.offset).all();
	return { rows: results.map(toUser), total: num(total?.n) };
}

async function findUser(ctx: AuthContext, id: string): Promise<UserRow> {
	const row = await ctx.db.prepare(`${USER_SELECT} WHERE u.id = ? AND u.deleted_at IS NULL`).bind(id).first();
	if (!row) throw notFound("Tài khoản");
	return toUser(row);
}
export const getUser = findUser;

async function superAdminsLeft(ctx: AuthContext, except: string): Promise<number> {
	const row = await ctx.db.prepare("SELECT COUNT(*) AS n FROM user WHERE role_id = ? AND deleted_at IS NULL AND locked_at IS NULL AND id != ?").bind(SUPER_ADMIN_ROLE_ID, except).first();
	return num(row?.n);
}

/** Throws unless `by` may act on `target`: not oneself, and nothing beyond their own rights. Exported for the trash, which acts on accounts too. */
export async function mayManage(ctx: AuthContext, by: Authed, target: Pick<UserRow, "id" | "roleId">, opts: { self?: "allow" | "refuse" } = {}): Promise<void> {
	if (target.id === by.user.id) {
		if (opts.self === "allow") return;
		throw new ApiError(403, "forbidden_self", "Bạn không thể làm điều này với chính tài khoản của mình.");
	}
	if (!covers(by.permissions, await loadPermissions(ctx.db, target.roleId))) throw new ApiError(403, "forbidden_higher", "Tài khoản này có quyền cao hơn quyền của bạn.");
}

async function mayAssign(ctx: AuthContext, by: Authed, roleId: string): Promise<void> {
	const role = await ctx.db.prepare("SELECT id FROM role WHERE id = ? AND deleted_at IS NULL").bind(roleId).first();
	if (!role) throw new ApiError(400, "invalid_input", "Vai trò không tồn tại.", { roleId: "Vai trò không tồn tại." });
	if (roleId === SUPER_ADMIN_ROLE_ID && by.user.roleId !== SUPER_ADMIN_ROLE_ID) throw new ApiError(403, "forbidden_super", "Chỉ Super Admin mới cấp vai trò Super Admin.");
	if (!covers(by.permissions, await loadPermissions(ctx.db, roleId))) throw new ApiError(403, "forbidden_higher", "Bạn không thể cấp vai trò có quyền vượt quá quyền của bạn.");
}

export async function createUser(ctx: AuthContext, by: Authed, input: { email: string; name: string; roleId: string }): Promise<{ user: UserRow; temporaryPassword: string }> {
	const email = input.email.trim().toLowerCase();
	await mayAssign(ctx, by, input.roleId);
	if (await ctx.db.prepare("SELECT 1 AS yes FROM user WHERE email = ?").bind(email).first()) throw new ApiError(409, "email_taken", "Email này đã có tài khoản.", { email: "Email này đã có tài khoản." });
	const temporaryPassword = `${randomToken(9)}-${randomToken(3)}`;
	const id = newId("user", ctx.now().getTime());
	const now = stamp(ctx);
	await ctx.db.batch([
		ctx.db
			.prepare(
				`INSERT INTO user (id, email, name, role, active, password_hash, password_changed_at, must_change_password, role_id, created_at, updated_at)
				 VALUES (?, ?, ?, 'viewer', 1, ?, ?, 1, ?, ?, ?)`,
			)
			.bind(id, email, input.name.trim(), hashPassword(temporaryPassword, ctx.passwordParams), now, input.roleId, now, now),
		audit(ctx, by, { action: "user.create", entityType: "user", entityId: id, after: { email, name: input.name.trim(), roleId: input.roleId } }),
	]);
	return { user: await findUser(ctx, id), temporaryPassword };
}

/** Changes name, email and role. Returns the old email when it changed (the route mails a notice there). */
export async function updateUser(ctx: AuthContext, by: Authed, id: string, input: { name?: string; email?: string; roleId?: string }): Promise<{ user: UserRow; oldEmail: string | null }> {
	const target = await findUser(ctx, id);
	const touchesAccess = input.email !== undefined || input.roleId !== undefined;
	await mayManage(ctx, by, target, { self: touchesAccess ? "refuse" : "allow" });
	if (target.id === by.user.id && !can(by.permissions, "users", "update")) throw forbidden();

	const set: string[] = [];
	const args: unknown[] = [];
	const statements: AdminStmt[] = [];
	const before: Record<string, unknown> = {};
	const after: Record<string, unknown> = {};
	let oldEmail: string | null = null;

	if (input.name !== undefined && input.name.trim() !== target.name) {
		set.push("name = ?");
		args.push(input.name.trim());
		before.name = target.name;
		after.name = input.name.trim();
	}
	if (input.email !== undefined) {
		const email = input.email.trim().toLowerCase();
		if (email !== target.email) {
			if (await ctx.db.prepare("SELECT 1 AS yes FROM user WHERE email = ? AND id != ?").bind(email, id).first()) throw new ApiError(409, "email_taken", "Email này đã có tài khoản.", { email: "Email này đã có tài khoản." });
			set.push("email = ?");
			args.push(email);
			before.email = target.email;
			after.email = email;
			oldEmail = target.email;
			statements.push(ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(stamp(ctx), id));
		}
	}
	if (input.roleId !== undefined && input.roleId !== target.roleId) {
		await mayAssign(ctx, by, input.roleId);
		if (target.roleId === SUPER_ADMIN_ROLE_ID) {
			if (by.user.roleId !== SUPER_ADMIN_ROLE_ID) throw new ApiError(403, "forbidden_super", "Chỉ Super Admin mới đổi vai trò của Super Admin.");
			if ((await superAdminsLeft(ctx, id)) < 1) throw new ApiError(409, "last_super_admin", "Phải còn ít nhất một Super Admin đang hoạt động.");
		}
		set.push("role_id = ?");
		args.push(input.roleId);
		before.roleId = target.roleId;
		after.roleId = input.roleId;
	}
	if (!set.length) return { user: target, oldEmail: null };

	set.push("updated_at = ?");
	args.push(stamp(ctx), id);
	await ctx.db.batch([ctx.db.prepare(`UPDATE user SET ${set.join(", ")} WHERE id = ?`).bind(...args), ...statements, audit(ctx, by, { action: "user.update", entityType: "user", entityId: id, before, after })]);
	return { user: await findUser(ctx, id), oldEmail };
}

export async function setLocked(ctx: AuthContext, by: Authed, id: string, locked: boolean, reason = ""): Promise<UserRow> {
	const target = await findUser(ctx, id);
	await mayManage(ctx, by, target);
	if (locked && target.roleId === SUPER_ADMIN_ROLE_ID && (await superAdminsLeft(ctx, id)) < 1) throw new ApiError(409, "last_super_admin", "Phải còn ít nhất một Super Admin đang hoạt động.");
	const now = stamp(ctx);
	await ctx.db.batch([
		locked
			? ctx.db.prepare("UPDATE user SET locked_at = ?, locked_reason = ?, updated_at = ? WHERE id = ?").bind(now, reason, now, id)
			: ctx.db.prepare("UPDATE user SET locked_at = NULL, locked_reason = NULL, failed_logins = 0, updated_at = ? WHERE id = ?").bind(now, id),
		...(locked ? [ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(now, id)] : []),
		audit(ctx, by, { action: locked ? "user.lock" : "user.unlock", entityType: "user", entityId: id, after: { reason } }),
	]);
	return findUser(ctx, id);
}

export async function forcePasswordChange(ctx: AuthContext, by: Authed, id: string): Promise<UserRow> {
	const target = await findUser(ctx, id);
	await mayManage(ctx, by, target);
	await ctx.db.batch([
		ctx.db.prepare("UPDATE user SET must_change_password = 1, updated_at = ? WHERE id = ?").bind(stamp(ctx), id),
		audit(ctx, by, { action: "user.force_password_change", entityType: "user", entityId: id }),
	]);
	return findUser(ctx, id);
}

export async function resetTwoFactor(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	if (by.user.roleId !== SUPER_ADMIN_ROLE_ID) throw new ApiError(403, "forbidden_super", "Chỉ Super Admin mới gỡ xác thực hai bước của người khác.");
	// Switching one's own 2FA off takes the password (docs 6.3): that is `me/2fa/disable`, not this.
	if (id === by.user.id) throw new ApiError(403, "forbidden_self", "Muốn tắt xác thực hai bước của chính mình, hãy dùng mục Bảo mật và nhập mật khẩu.");
	const target = await findUser(ctx, id);
	await ctx.db.batch([ctx.db.prepare("DELETE FROM user_totp WHERE user_id = ?").bind(id), audit(ctx, by, { action: "user.reset_2fa", entityType: "user", entityId: target.id })]);
}

/** Moves the account to the trash: it cannot sign in. Its email stays taken until the account is restored or removed for good. */
export async function deleteUser(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const target = await findUser(ctx, id);
	await mayManage(ctx, by, target);
	if (target.roleId === SUPER_ADMIN_ROLE_ID && (await superAdminsLeft(ctx, id)) < 1) throw new ApiError(409, "last_super_admin", "Phải còn ít nhất một Super Admin đang hoạt động.");
	const now = stamp(ctx);
	await ctx.db.batch([
		ctx.db.prepare("UPDATE user SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ?").bind(now, by.user.id, now, id),
		ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(now, id),
		audit(ctx, by, { action: "user.delete", entityType: "user", entityId: id, before: { email: target.email, name: target.name } }),
	]);
}

/** The live sessions (and their addresses) of an account: the same "not above your rights" rule as changing it; one's own are always visible. */
export async function sessionsOf(ctx: AuthContext, by: Authed, id: string) {
	const target = await findUser(ctx, id);
	await mayManage(ctx, by, target, { self: "allow" });
	return listSessions(ctx, id, by.user.id === id ? by.session.id : undefined);
}

export async function revokeUserSessions(ctx: AuthContext, by: Authed, id: string): Promise<number> {
	const target = await findUser(ctx, id);
	await mayManage(ctx, by, target, { self: "allow" });
	// Ending your own sessions keeps the one you are using.
	const result = await ctx.db.prepare("UPDATE session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id != ?").bind(stamp(ctx), id, by.user.id === id ? by.session.id : "").run();
	await audit(ctx, by, { action: "user.revoke_sessions", entityType: "user", entityId: id, after: { ended: result.meta.changes } }).run();
	return result.meta.changes;
}

// ------------------------------------------------------------------ roles

export type RoleRow = { id: string; name: string; description: string; isSystem: boolean; users: number; permissions?: string[] };

const permissionList = (permissions: Permissions) => [...permissions].map(([key, scope]) => (scope === "own" ? `${key}:own` : key)).sort();

export async function listRoles(ctx: AuthContext): Promise<RoleRow[]> {
	const { results } = await ctx.db
		.prepare("SELECT r.id, r.name, r.description, r.is_system, (SELECT COUNT(*) FROM user u WHERE u.role_id = r.id AND u.deleted_at IS NULL) AS users FROM role r WHERE r.deleted_at IS NULL ORDER BY r.is_system DESC, r.name")
		.all();
	return results.map((row) => ({ id: text(row.id), name: text(row.name), description: text(row.description), isSystem: num(row.is_system) === 1, users: num(row.users) }));
}

export async function getRole(ctx: AuthContext, id: string): Promise<RoleRow> {
	const role = (await listRoles(ctx)).find((item) => item.id === id);
	if (!role) throw notFound("Vai trò");
	return { ...role, permissions: permissionList(await loadPermissions(ctx.db, id)) };
}

/** `module.action` or `module.action:own`, checked against the catalogue. */
function parsePermissions(list: string[]): Map<string, Scope> {
	const out = new Map<string, Scope>();
	for (const entry of list) {
		const own = entry.endsWith(":own");
		const key = own ? entry.slice(0, -4) : entry;
		const [module, action] = key.split(".");
		if (!module || !action || !isKnownPermission(module, action)) throw new ApiError(400, "invalid_input", `Quyền "${entry}" không có trong danh mục.`, { permissions: `Quyền "${entry}" không có trong danh mục.` });
		if (own && !isOwnable(module, action)) throw new ApiError(400, "invalid_input", `Quyền "${entry}" không có phạm vi "của mình".`, { permissions: `Quyền “${entry}” không có phạm vi “của mình”: mục này không xét người tạo.` });
		out.set(key, own ? "own" : "all");
	}
	return out;
}

export async function createRole(ctx: AuthContext, by: Authed, input: { name: string; description: string; permissions: string[] }): Promise<RoleRow> {
	const wanted = parsePermissions(input.permissions);
	if (!covers(by.permissions, wanted)) throw new ApiError(403, "forbidden_higher", "Bạn không thể cấp quyền vượt quá quyền của bạn.");
	if (await ctx.db.prepare("SELECT 1 AS yes FROM role WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL").bind(input.name.trim()).first()) throw new ApiError(409, "name_taken", "Đã có vai trò tên này.", { name: "Đã có vai trò tên này." });
	const id = newId("role", ctx.now().getTime());
	const now = stamp(ctx);
	await ctx.db.batch([
		ctx.db.prepare("INSERT INTO role (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)").bind(id, input.name.trim(), input.description.trim(), now, now),
		...[...wanted].map(([key, scope]) => ctx.db.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES (?, ?, ?, ?)").bind(id, ...(key.split(".") as [string, string]), scope)),
		audit(ctx, by, { action: "role.create", entityType: "role", entityId: id, after: { name: input.name.trim(), permissions: permissionList(wanted) } }),
	]);
	return getRole(ctx, id);
}

export async function updateRole(ctx: AuthContext, by: Authed, id: string, input: { name?: string; description?: string; permissions?: string[] }): Promise<RoleRow> {
	const role = await getRole(ctx, id);
	if (id === SUPER_ADMIN_ROLE_ID) throw new ApiError(403, "forbidden_super", "Vai trò Super Admin không sửa được.");
	if (id === by.user.roleId) throw new ApiError(403, "forbidden_self", "Bạn không thể sửa vai trò của chính mình.");
	const current = await loadPermissions(ctx.db, id);
	if (!covers(by.permissions, current)) throw new ApiError(403, "forbidden_higher", "Vai trò này có quyền cao hơn quyền của bạn.");
	const statements: AdminStmt[] = [];
	const before: Record<string, unknown> = {};
	const after: Record<string, unknown> = {};
	const now = stamp(ctx);

	if (input.name !== undefined && input.name.trim() !== role.name) {
		if (role.isSystem) throw new ApiError(403, "system_role", "Không đổi tên vai trò mẫu.");
		if (await ctx.db.prepare("SELECT 1 AS yes FROM role WHERE name = ? COLLATE NOCASE AND id != ? AND deleted_at IS NULL").bind(input.name.trim(), id).first()) throw new ApiError(409, "name_taken", "Đã có vai trò tên này.", { name: "Đã có vai trò tên này." });
		statements.push(ctx.db.prepare("UPDATE role SET name = ?, updated_at = ? WHERE id = ?").bind(input.name.trim(), now, id));
		before.name = role.name;
		after.name = input.name.trim();
	}
	if (input.description !== undefined && input.description.trim() !== role.description) {
		statements.push(ctx.db.prepare("UPDATE role SET description = ?, updated_at = ? WHERE id = ?").bind(input.description.trim(), now, id));
		before.description = role.description;
		after.description = input.description.trim();
	}
	if (input.permissions !== undefined) {
		const wanted = parsePermissions(input.permissions);
		if (!covers(by.permissions, wanted)) throw new ApiError(403, "forbidden_higher", "Bạn không thể cấp quyền vượt quá quyền của bạn.");
		statements.push(ctx.db.prepare("DELETE FROM role_permission WHERE role_id = ?").bind(id));
		for (const [key, scope] of wanted) statements.push(ctx.db.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES (?, ?, ?, ?)").bind(id, ...(key.split(".") as [string, string]), scope));
		statements.push(ctx.db.prepare("UPDATE role SET updated_at = ? WHERE id = ?").bind(now, id));
		before.permissions = permissionList(current);
		after.permissions = permissionList(wanted);
		// People holding the role feel the change on their next request; their sessions keep running.
	}
	if (statements.length) await ctx.db.batch([...statements, audit(ctx, by, { action: "role.update", entityType: "role", entityId: id, before, after })]);
	return getRole(ctx, id);
}

export async function deleteRole(ctx: AuthContext, by: Authed, id: string): Promise<void> {
	const role = await getRole(ctx, id);
	if (role.isSystem) throw new ApiError(403, "system_role", "Không xóa được vai trò mẫu.");
	if (role.users > 0) throw new ApiError(409, "role_in_use", `Còn ${role.users} tài khoản đang dùng vai trò này. Hãy chuyển họ sang vai trò khác trước.`);
	if (!covers(by.permissions, await loadPermissions(ctx.db, id))) throw new ApiError(403, "forbidden_higher", "Vai trò này có quyền cao hơn quyền của bạn.");
	await ctx.db.batch([
		ctx.db.prepare("UPDATE role SET deleted_at = ? WHERE id = ?").bind(stamp(ctx), id),
		audit(ctx, by, { action: "role.delete", entityType: "role", entityId: id, before: { name: role.name } }),
	]);
}
