// Helpers for the second security pass: an account with a hand-made role, and the "two requests at once" barrier.
import { hashPassword } from "../../../src/admin/auth/password";
import { FAST, PASSWORD } from "./adminWorld";
import type { DatabaseSync } from "node:sqlite";

/** A role with exactly these permissions ("module.action" or "module.action:own") and one account holding it (email `<id>@example.test`). */
export function customAccount(raw: DatabaseSync, id: string, permissions: string[]): string {
	const roleId = `role-${id}`;
	raw.prepare("INSERT INTO role (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, '', 0, '2026', '2026')").run(roleId, `Vai trò ${id}`);
	for (const entry of permissions) {
		const own = entry.endsWith(":own");
		const [module, action] = (own ? entry.slice(0, -4) : entry).split(".");
		raw.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES (?, ?, ?, ?)").run(roleId, module, action, own ? "own" : "all");
	}
	raw.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at) VALUES (?, ?, ?, 'viewer', ?, ?, '2026')").run(id, `${id}@example.test`, id, roleId, hashPassword(PASSWORD, FAST));
	return `${id}@example.test`;
}

/**
 * Two requests arriving "at the same time" on D1: each runs its read-only checks before either one's write batch lands.
 * Modelled by holding every write batch at a barrier until two have arrived.
 */
export function barrier<T extends { batch: (statements: never[]) => Promise<unknown> }>(db: T): T {
	let arrived = 0;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	return new Proxy(db, {
		get(target, prop, receiver) {
			if (prop === "batch") {
				return async (statements: never[]) => {
					arrived++;
					if (arrived >= 2) release();
					await gate;
					return target.batch(statements);
				};
			}
			const value = Reflect.get(target, prop, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}
