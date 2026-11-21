// Makes the four system roles and the first Super Admin. Run again, it adds what is missing and does
// not undo what the admins changed: a role that exists keeps its permissions (Super Admin excepted: its
// permissions are not editable, so they are brought back in line with the catalogue).
import { hashPassword, type PasswordParams } from "./auth/password";
import type { AdminDb, AdminStmt } from "./db";
import { newId } from "./ids";
import { SUPER_ADMIN_ROLE_ID, SYSTEM_ROLES } from "./rbac/catalog";

export async function seedRoles(db: AdminDb, now: Date): Promise<void> {
	const stamp = now.toISOString();
	for (const role of SYSTEM_ROLES) {
		const existing = await db.prepare("SELECT id FROM role WHERE id = ?").bind(role.id).first();
		const statements: AdminStmt[] = [];
		if (!existing) {
			statements.push(db.prepare("INSERT INTO role (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)").bind(role.id, role.name, role.description, stamp, stamp));
		}
		if (!existing || role.id === SUPER_ADMIN_ROLE_ID) {
			if (existing) statements.push(db.prepare("DELETE FROM role_permission WHERE role_id = ?").bind(role.id));
			for (const [key, scope] of role.grants) {
				const [module, action] = key.split(".");
				statements.push(db.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES (?, ?, ?, ?)").bind(role.id, module, action, scope));
			}
		}
		if (statements.length) await db.batch(statements);
	}
}

/** Creates the first Super Admin when no account has that role yet; returns its id, or null when one exists. */
export async function seedSuperAdmin(db: AdminDb, input: { email: string; password: string; name?: string }, now: Date, params?: PasswordParams): Promise<string | null> {
	const found = await db.prepare("SELECT id FROM user WHERE role_id = ? AND deleted_at IS NULL LIMIT 1").bind(SUPER_ADMIN_ROLE_ID).first();
	if (found) return null;
	const id = newId("user", now.getTime());
	const stamp = now.toISOString();
	await db
		.prepare(
			`INSERT INTO user (id, email, name, role, active, password_hash, password_changed_at, must_change_password, role_id, created_at, updated_at)
			 VALUES (?, ?, ?, 'super_admin', 1, ?, ?, 1, ?, ?, ?)`,
		)
		.bind(id, input.email.trim().toLowerCase(), input.name ?? "Quản trị viên", hashPassword(input.password, params), stamp, SUPER_ADMIN_ROLE_ID, stamp, stamp)
		.run();
	return id;
}
