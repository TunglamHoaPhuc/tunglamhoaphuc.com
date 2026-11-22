// Second security pass, accounts: the last Super Admin under concurrency, peers acting on each other, deleted roles.
import { describe, expect, it } from "vitest";
import { world, type Seed } from "../helpers/adminWorld";
import { barrier, customAccount } from "../helpers/sec2";

const SEEDS: Seed[] = [
	{ id: "root", email: "root@example.test", roleId: "role-super-admin" },
	{ id: "root2", email: "root2@example.test", roleId: "role-super-admin" },
	{ id: "admin", email: "admin@example.test", roleId: "role-admin" },
	{ id: "admin2", email: "admin2@example.test", roleId: "role-admin" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor" },
	{ id: "author", email: "author@example.test", roleId: "role-author" },
];

const activeSuperAdmins = (raw: { prepare: (sql: string) => { get: () => unknown } }) =>
	(raw.prepare("SELECT COUNT(*) AS n FROM user WHERE role_id = 'role-super-admin' AND locked_at IS NULL AND deleted_at IS NULL").get() as { n: number }).n;
const auditCount = (raw: { prepare: (sql: string) => { get: (...args: string[]) => unknown } }, action: string) => (raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ?").get(action) as { n: number }).n;

describe("the last Super Admin survives two requests arriving together", () => {
	const crossings: [string, string, (a: { call: Function }, b: { call: Function }) => Promise<{ status: number; error?: { code: string } }>[], string][] = [
		["lock", "user.lock", (a, b) => [a.call("POST", "users/root2/lock", { reason: "x" }), b.call("POST", "users/root/lock", { reason: "x" })], "user.lock"],
		["delete", "user.delete", (a, b) => [a.call("DELETE", "users/root2"), b.call("DELETE", "users/root")], "user.delete"],
		["demote", "user.update", (a, b) => [a.call("PATCH", "users/root2", { roleId: "role-editor" }), b.call("PATCH", "users/root", { roleId: "role-editor" })], "user.update"],
	];
	for (const [label, , make, action] of crossings) {
		it(`cross ${label}: exactly one succeeds, the other gets 409, one active Super Admin remains, one audit row`, async () => {
			const w = await world(SEEDS);
			const a = await w.as("root@example.test");
			const b = await w.as("root2@example.test");
			const real = w.deps.env.DB;
			w.deps.env.DB = barrier(real);
			const [r1, r2] = await Promise.all(make(a, b));
			w.deps.env.DB = real;
			expect([r1, r2].filter((r) => r.status < 300)).toHaveLength(1);
			expect([r1, r2].filter((r) => r.status === 409)).toHaveLength(1);
			expect([r1, r2].find((r) => r.status === 409)?.error?.code).toBe("last_super_admin");
			expect(activeSuperAdmins(w.raw)).toBe(1);
			expect(auditCount(w.raw, action)).toBe(1);
		});
	}

	it("a refused cross lock does not end the loser's target sessions", async () => {
		const w = await world(SEEDS);
		const a = await w.as("root@example.test");
		const b = await w.as("root2@example.test");
		const real = w.deps.env.DB;
		w.deps.env.DB = barrier(real);
		await Promise.all([a.call("POST", "users/root2/lock", { reason: "x" }), b.call("POST", "users/root/lock", { reason: "x" })]);
		w.deps.env.DB = real;
		const live = w.raw.prepare("SELECT user_id, COUNT(*) AS n FROM session WHERE revoked_at IS NULL GROUP BY user_id").all() as { user_id: string; n: number }[];
		// the survivor's sessions are intact; only the locked account lost its sessions
		const locked = w.raw.prepare("SELECT id FROM user WHERE locked_at IS NOT NULL").get() as { id: string };
		expect(live.some((row) => row.user_id === locked.id)).toBe(false);
		expect(live.length).toBe(1);
	});
});
