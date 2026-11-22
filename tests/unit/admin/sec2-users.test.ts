// Second security pass, accounts: the last Super Admin under concurrency, peers acting on each other, deleted roles.
import { describe, expect, it } from "vitest";
import { world, type Seed } from "../helpers/adminWorld";
import { barrier } from "../helpers/sec2";

const SEEDS: Seed[] = [
	{ id: "root", email: "root@example.test", roleId: "role-super-admin" },
	{ id: "root2", email: "root2@example.test", roleId: "role-super-admin" },
	{ id: "admin", email: "admin@example.test", roleId: "role-admin" },
	{ id: "admin2", email: "admin2@example.test", roleId: "role-admin" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor" },
	{ id: "author", email: "author@example.test", roleId: "role-author" },
];

type Client = { call: (method: string, path: string, body?: unknown) => Promise<{ status: number; error?: { code: string } }> };
const activeSuperAdmins = (raw: { prepare: (sql: string) => { get: () => unknown } }) =>
	(raw.prepare("SELECT COUNT(*) AS n FROM user WHERE role_id = 'role-super-admin' AND locked_at IS NULL AND deleted_at IS NULL").get() as { n: number }).n;
const auditCount = (raw: { prepare: (sql: string) => { get: (...args: string[]) => unknown } }, action: string) => (raw.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = ?").get(action) as { n: number }).n;

describe("the last Super Admin survives two requests arriving together", () => {
	const crossings: [string, string, (a: Client, b: Client) => Promise<{ status: number; error?: { code: string } }>[], string][] = [
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

describe("an account acts on another only with rights strictly greater than the target's", () => {
	it("stops an Admin from taking over another Admin (email, lock, force password change, sessions, role)", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		for (const [method, path, body] of [
			["PATCH", "users/admin2", { email: "takeover@example.test" }],
			["PATCH", "users/admin2", { name: "Đổi tên" }],
			["PATCH", "users/admin2", { roleId: "role-editor" }],
			["POST", "users/admin2/lock", { reason: "x" }],
			["POST", "users/admin2/unlock", {}],
			["POST", "users/admin2/force-password-change", {}],
			["GET", "users/admin2/sessions", undefined],
			["DELETE", "users/admin2/sessions", undefined],
		] as const) {
			const response = await admin.call(method, path, body);
			expect([method, path, response.status, response.error?.code]).toEqual([method, path, 403, "forbidden_higher"]);
		}
		expect((w.raw.prepare("SELECT email FROM user WHERE id = 'admin2'").get() as { email: string }).email).toBe("admin2@example.test");
	});

	it("still lets an Admin manage Editor and Author accounts, and edit their own profile", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("PATCH", "users/editor", { name: "Biên Tập Mới" })).status).toBe(200);
		expect((await admin.call("POST", "users/author/lock", { reason: "x" })).status).toBe(200);
		expect((await admin.call("POST", "users/author/unlock", {})).status).toBe(200);
		expect((await admin.call("POST", "users/editor/force-password-change", {})).status).toBe(200);
		expect((await admin.call("DELETE", "users/editor/sessions")).status).toBe(200);
		expect((await admin.call("PATCH", "users/admin", { name: "Admin Một" })).status).toBe(200);
		expect((await admin.call("GET", "users/admin/sessions")).status).toBe(200);
	});

	it("does not let an Admin give the Admin role (equal rights) to anyone, but lets a Super Admin", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("PATCH", "users/author", { roleId: "role-admin" })).error.code).toBe("forbidden_higher");
		expect((await admin.call("POST", "users", { email: "x@example.test", name: "X", roleId: "role-admin" })).error.code).toBe("forbidden_higher");
		expect((await admin.call("POST", "users", { email: "y@example.test", name: "Y", roleId: "role-editor" })).status).toBe(200);
		const root = await w.as("root@example.test");
		expect((await root.call("PATCH", "users/author", { roleId: "role-admin" })).status).toBe(200);
		expect((await root.call("POST", "users/admin2/lock", { reason: "x" })).status).toBe(200);
	});

	it("tells the screens the same: manageable and assignable follow the server's answer", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		const flag = async (who: typeof admin, id: string) => (await who.call("GET", `users/${id}`)).data.manageable;
		expect({ admin: await flag(admin, "admin"), admin2: await flag(admin, "admin2"), root: await flag(admin, "root"), editor: await flag(admin, "editor"), author: await flag(admin, "author") }).toEqual({ admin: false, admin2: false, root: false, editor: true, author: true });
		const roles = (await admin.call("GET", "roles")).data.roles as { id: string; assignable: boolean }[];
		const can = (id: string) => roles.find((role) => role.id === id)?.assignable;
		expect({ admin: can("role-admin"), editor: can("role-editor"), author: can("role-author"), root: can("role-super-admin") }).toEqual({ admin: false, editor: true, author: true, root: false });
		const root = await w.as("root@example.test");
		const rootRoles = (await root.call("GET", "roles")).data.roles as { assignable: boolean }[];
		expect(rootRoles.every((role) => role.assignable)).toBe(true);
		expect(await flag(root, "admin2")).toBe(true);
		expect(await flag(root, "root2")).toBe(true);
	});

	it("applies to the trash too: an Admin cannot restore a peer from the trash", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		expect((await root.call("DELETE", "users/admin2")).status).toBe(204);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("POST", "trash/user/admin2/restore", {})).status).toBe(403);
		expect((await root.call("POST", "trash/user/admin2/restore", {})).status).toBe(200);
	});
});

describe("a deleted role grants nothing and cannot be left behind by a trashed account", () => {
	async function roleWithUser() {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		const role = await root.call("POST", "roles", { name: "Tạm", description: "", permissions: ["posts.view", "posts.create"] });
		const id = role.data.id as string;
		const email = customAccountOnRole(w.raw, "u1", id);
		return { w, root, id, email };
	}
	function customAccountOnRole(raw: import("node:sqlite").DatabaseSync, userId: string, roleId: string) {
		raw.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at) SELECT ?, ?, ?, 'viewer', ?, password_hash, '2026' FROM user WHERE id = 'root'").run(userId, `${userId}@example.test`, userId, roleId);
		return `${userId}@example.test`;
	}

	it("refuses to delete a role a trashed account still points to", async () => {
		const { root, id } = await roleWithUser();
		expect((await root.call("DELETE", "users/u1")).status).toBe(204);
		const refused = await root.call("DELETE", `roles/${id}`);
		expect(refused.status).toBe(409);
		expect(refused.error.code).toBe("role_in_use");
		expect(refused.error.message).toMatch(/thùng rác/);
	});

	it("gives no permission through a role that is deleted (legacy rows too)", async () => {
		const { w, id, email } = await roleWithUser();
		const user = await w.as(email);
		expect((await user.call("GET", "posts")).status).toBe(200);
		w.raw.prepare("UPDATE role SET deleted_at = '2026-11-22' WHERE id = ?").run(id);
		expect((await user.call("GET", "posts")).status).toBe(403);
		const me = await user.call("GET", "auth/me");
		expect(me.data.permissions).toEqual([]);
	});

	it("will not restore an account whose role was deleted", async () => {
		const { w, root, id } = await roleWithUser();
		expect((await root.call("DELETE", "users/u1")).status).toBe(204);
		w.raw.prepare("UPDATE role SET deleted_at = '2026-11-22' WHERE id = ?").run(id); // as an older version allowed
		const refused = await root.call("POST", "trash/user/u1/restore", {});
		expect(refused.status).toBe(409);
		expect(refused.error.code).toBe("role_deleted");
		expect((w.raw.prepare("SELECT deleted_at FROM user WHERE id = 'u1'").get() as { deleted_at: string | null }).deleted_at).not.toBeNull();
	});

	it("still restores an account with a live role, and a role still needs rights not above the restorer's", async () => {
		const { w, root } = await roleWithUser();
		expect((await root.call("DELETE", "users/u1")).status).toBe(204);
		expect((await root.call("POST", "trash/user/u1/restore", {})).status).toBe(200);
		const admin = await w.as("admin@example.test");
		const high = await root.call("POST", "roles", { name: "Cao", description: "", permissions: ["backup.view", "dashboard.view"] });
		expect((await root.call("DELETE", `roles/${high.data.id}`)).status).toBe(204);
		expect((await admin.call("POST", `trash/role/${high.data.id}/restore`, {})).status).toBe(403);
		expect((await root.call("POST", `trash/role/${high.data.id}/restore`, {})).status).toBe(200);
	});
});
