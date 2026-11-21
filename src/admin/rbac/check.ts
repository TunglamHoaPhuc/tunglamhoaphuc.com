import type { AdminDb } from "../db";
import { text } from "../db";
import { permissionKey, type Action, type Permissions, type Scope } from "./catalog";

export async function loadPermissions(db: AdminDb, roleId: string | null): Promise<Permissions> {
	if (!roleId) return new Map();
	const { results } = await db.prepare("SELECT module, action, scope FROM role_permission WHERE role_id = ?").bind(roleId).all();
	return new Map(results.map((row) => [permissionKey(text(row.module), text(row.action)), text(row.scope) === "own" ? "own" : "all"] as [string, Scope]));
}

/**
 * Whether the permissions allow `action` on `module`. With scope "own" the action is allowed only on what the
 * person created: pass `ownerId` (the creator of the row) and `userId`; without `ownerId` ("own" cannot be judged)
 * it is allowed only when `anyOwner` is true, which is how list and create endpoints ask.
 */
export function can(permissions: Permissions, module: string, action: Action, who?: { userId: string; ownerId?: string | null; anyOwner?: boolean }): boolean {
	const scope = permissions.get(permissionKey(module, action));
	if (!scope) return false;
	if (scope === "all") return true;
	if (!who) return false;
	if (who.ownerId != null) return who.ownerId === who.userId;
	return who.anyOwner === true;
}

/** True when everything `target` may do, `actor` may do too (and at least as widely). */
export function covers(actor: Permissions, target: Permissions): boolean {
	for (const [key, scope] of target) {
		const have = actor.get(key);
		if (!have) return false;
		if (have === "own" && scope === "all") return false;
	}
	return true;
}
