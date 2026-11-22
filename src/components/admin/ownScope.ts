// "Của mình" (own) permissions on the screen, as pure functions of what /auth/me lists ("media.update", "posts.delete:own"…).
// The server decides in the end (src/admin/rbac); this only keeps the screens from offering what it would refuse.
export type Scope = "all" | "own" | null;

/** The widest scope the person holds for `module.action`: every row, only their own, or none. */
export function scopeOf(permissions: readonly string[], module: string, action: string): Scope {
	if (permissions.includes(`${module}.${action}`)) return "all";
	if (permissions.includes(`${module}.${action}:own`)) return "own";
	return null;
}

/** May the person do `action` on a thing made by `ownerId`? With the scope "own", only when it is theirs (an unknown owner is nobody's). */
export function canOn(permissions: readonly string[], userId: string, module: string, action: string, ownerId: string | null | undefined): boolean {
	const scope = scopeOf(permissions, module, action);
	return scope === "all" || (scope === "own" && !!ownerId && ownerId === userId);
}

/** May the person hand out `module.action` at scope `wanted`? "Tất cả" only to someone who holds it in full; "của mình" to anyone who holds it at all (the server's `covers`). */
export function mayGrant(permissions: readonly string[], module: string, action: string, wanted: "all" | "own"): boolean {
	const held = scopeOf(permissions, module, action);
	return wanted === "all" ? held === "all" : held !== null;
}
