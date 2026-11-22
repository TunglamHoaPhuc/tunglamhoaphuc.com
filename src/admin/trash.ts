// The trash (docs/admin-architecture.md 5.1): nothing an editor deletes is removed at once; it gets `deleted_at` and
// leaves the lists and the public site. Each module that has trashable rows registers them here, and the trash
// screen (ops module) lists, restores and removes for good across all of them.
import type { AuthContext, Authed } from "./auth/service";
import type { AdminStmt } from "./db";

export type Trashable = {
	/** The kind as the API and the audit log name it: "post", "teaching_article", "page", "statue", … */
	type: string;
	/** Shown to people: "Bài viết", "Bảo tượng"… */
	label: string;
	table: string;
	/** An SQL expression for the row's title, over the table's own columns, e.g. "title" or "name". */
	titleSql: string;
	/**
	 * The module whose rights govern it, on top of `trash.*`: the trash screen lists a kind only to people who may
	 * `view` the module, restores with `update` and removes for good with `delete` (for "own" rights: rows are owned
	 * through `created_by`, or `uploaded_by` for media).
	 */
	module: string;
	/** A rule beyond the module's rights, run before a restore or removal (accounts and roles: never above one's own rights). */
	guard?: (ctx: AuthContext, by: Authed, id: string, action: "update" | "delete") => Promise<void>;
	/** Whether the table has `created_by` (so a person with "own" rights may restore their own). */
	hasCreatedBy: boolean;
	/** Statements that remove what hangs off a row (revisions, usage rows, child tables) before the row itself goes for good. */
	purge: (ctx: AuthContext, by: Authed, id: string) => AdminStmt[];
};

const registry = new Map<string, Trashable>();

export const registerTrashable = (item: Trashable) => void registry.set(item.type, item);
export const trashables = (): Trashable[] => [...registry.values()];
export const trashableOf = (type: string): Trashable | undefined => registry.get(type);

/** `deleted_at` / `deleted_by` for moving a row to the trash; add it to the batch that also writes the audit entry. */
export function trashStatement(ctx: AuthContext, by: Authed, table: string, id: string): AdminStmt {
	const now = ctx.now().toISOString();
	return ctx.db.prepare(`UPDATE ${table} SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`).bind(now, by.user.id, now, id);
}
