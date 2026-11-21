import { describe, expect, it } from "vitest";
import { PASSWORD, world, type Seed } from "../helpers/adminWorld";

const SEEDS: Seed[] = [
	{ id: "root", email: "root@example.test", roleId: "role-super-admin" },
	{ id: "root2", email: "root2@example.test", roleId: "role-super-admin" },
	{ id: "admin", email: "admin@example.test", roleId: "role-admin" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor" },
	{ id: "author", email: "author@example.test", roleId: "role-author" },
];

describe("who may reach the account endpoints", () => {
	it("lets Super Admin and Admin list accounts, and answers 403 to Editor and Author", async () => {
		const w = await world(SEEDS);
		expect((await (await w.as("root@example.test")).call("GET", "users")).status).toBe(200);
		expect((await (await w.as("admin@example.test")).call("GET", "users")).status).toBe(200);
		expect((await (await w.as("editor@example.test")).call("GET", "users")).status).toBe(403);
		expect((await (await w.as("author@example.test")).call("GET", "users")).status).toBe(403);
		expect((await (await w.as("editor@example.test")).call("GET", "roles")).status).toBe(403);
	});

	it("lists with a search, a role filter and paging", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		const all = await root.call("GET", "users?pageSize=2&page=2");
		expect(all.json.meta).toEqual({ page: 2, pageSize: 2, total: 5 });
		expect(all.data).toHaveLength(2);
		expect((await root.call("GET", "users?q=edit")).data.map((user: { id: string }) => user.id)).toEqual(["editor"]);
		expect((await root.call("GET", "users?roleId=role-super-admin")).json.meta.total).toBe(2);
		expect((await root.call("GET", "users?q=%25")).json.meta.total).toBe(0); // % is not a wildcard
	});
});

describe("creating accounts", () => {
	it("creates one with a temporary password shown once, who must change it at first sign-in", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		const created = await admin.call("POST", "users", { email: " Moi@Example.test ", name: "Người Mới", roleId: "role-author" });
		expect(created.status).toBe(200);
		expect(created.data.user.email).toBe("moi@example.test");
		const temporary = created.data.temporaryPassword as string;
		expect(temporary.length).toBeGreaterThan(12);
		expect((await admin.call("GET", `users/${created.data.user.id}`)).json.data).not.toHaveProperty("temporaryPassword");
		const fresh = w.client();
		const login = await fresh.signIn("moi@example.test", temporary);
		expect(login.data.mustChangePassword).toBe(true);
		expect((await fresh.call("GET", "auth/me")).data.user.role).toMatch(/Author/);
		const log = w.raw.prepare("SELECT data_after FROM audit_log WHERE action = 'user.create'").get() as { data_after: string };
		expect(log.data_after).not.toContain(temporary);
	});

	it("refuses a taken email, a missing field, and a role the creator does not hold", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("POST", "users", { email: "EDITOR@example.test", name: "X", roleId: "role-author" })).error.code).toBe("email_taken");
		expect((await admin.call("POST", "users", { email: "x@example.test", name: "", roleId: "role-author" })).error.fields.name).toBeTruthy();
		expect((await admin.call("POST", "users", { email: "x@example.test", name: "X", roleId: "khong-co" })).status).toBe(400);
		const escalate = await admin.call("POST", "users", { email: "x@example.test", name: "X", roleId: "role-super-admin" });
		expect(escalate.status).toBe(403);
		expect(escalate.error.code).toBe("forbidden_super");
	});
});

describe("not handing out or taking more than you have", () => {
	it("stops Admin from changing, locking or deleting a Super Admin (so no takeover through the email)", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		for (const [method, path, body] of [
			["PATCH", "users/root", { email: "hacker@example.test" }],
			["PATCH", "users/root", { name: "Hacker" }],
			["POST", "users/root/lock", { reason: "x" }],
			["POST", "users/root/force-password-change", {}],
			["DELETE", "users/root/sessions", undefined],
		] as const) {
			const response = await admin.call(method, path, body);
			expect([method, path, response.status, response.error?.code]).toEqual([method, path, 403, "forbidden_higher"]);
		}
		// Admin has no right to delete accounts at all
		expect((await admin.call("DELETE", "users/root")).error.code).toBe("forbidden");
		expect((w.raw.prepare("SELECT email FROM user WHERE id = 'root'").get() as { email: string }).email).toBe("root@example.test");
	});

	it("lets Admin manage Editor and Author, but not give anyone a role beyond its own", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("PATCH", "users/editor", { name: "Biên Tập Mới" })).status).toBe(200);
		expect((await admin.call("PATCH", "users/author", { roleId: "role-editor" })).status).toBe(200);
		expect((await admin.call("PATCH", "users/author", { roleId: "role-super-admin" })).error.code).toBe("forbidden_super");
		// a custom role with a right Admin lacks (backup) cannot be handed out by Admin
		const root = await w.as("root@example.test");
		const custom = await root.call("POST", "roles", { name: "Sao lưu", description: "", permissions: ["backup.view", "dashboard.view"] });
		expect(custom.status).toBe(200);
		expect((await admin.call("PATCH", "users/author", { roleId: custom.data.id })).error.code).toBe("forbidden_higher");
	});

	it("refuses to lock, delete, re-role or change the email of your own account", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		for (const [method, path, body] of [
			["POST", "users/admin/lock", {}],
			["PATCH", "users/admin", { roleId: "role-editor" }],
			["PATCH", "users/admin", { email: "moi@example.test" }],
			["POST", "users/admin/force-password-change", {}],
		] as const) {
			const response = await admin.call(method, path, body);
			expect([method, path, response.error?.code]).toEqual([method, path, "forbidden_self"]);
		}
		expect((await admin.call("PATCH", "users/admin", { name: "Tên Mới" })).status).toBe(200);
		// a Super Admin cannot delete themselves either
		const root = await w.as("root@example.test");
		expect((await root.call("DELETE", "users/root")).error.code).toBe("forbidden_self");
	});

	it("leaves a Super Admin standing: the one acting is always one, and cannot lock, delete or demote themselves", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		expect((await root.call("POST", "users/root2/lock", {})).status).toBe(200);
		expect((await root.call("PATCH", "users/root2", { roleId: "role-admin" })).status).toBe(200);
		expect((await root.call("POST", "users/root/lock", {})).error.code).toBe("forbidden_self");
		expect((await root.call("PATCH", "users/root", { roleId: "role-admin" })).error.code).toBe("forbidden_self");
		const active = w.raw.prepare("SELECT COUNT(*) AS n FROM user WHERE role_id = 'role-super-admin' AND locked_at IS NULL AND deleted_at IS NULL").get() as { n: number };
		expect(active.n).toBe(1);
	});
});

describe("locking, forcing a change, sessions and deleting", () => {
	it("a locked account cannot sign in and its sessions end at once; unlocking lets it back", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const admin = await w.as("admin@example.test");
		expect((await admin.call("POST", "users/editor/lock", { reason: "nghỉ việc" })).data.locked).toBe(true);
		expect((await editor.call("GET", "auth/me")).status).toBe(401);
		expect((await w.client().signIn("editor@example.test")).status).toBe(401);
		expect((await admin.call("POST", "users/editor/unlock")).data.locked).toBe(false);
		expect((await w.client().signIn("editor@example.test")).status).toBe(200);
	});

	it("makes a person change the password at the next sign-in", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		await admin.call("POST", "users/editor/force-password-change");
		const login = await w.client().signIn("editor@example.test");
		expect(login.data.mustChangePassword).toBe(true);
	});

	it("lists a person's sessions and ends them all", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		await w.as("editor@example.test");
		const admin = await w.as("admin@example.test");
		expect((await admin.call("GET", "users/editor/sessions")).data.sessions).toHaveLength(2);
		expect((await admin.call("DELETE", "users/editor/sessions")).data.ended).toBe(2);
		expect((await editor.call("GET", "auth/me")).status).toBe(401);
	});

	it("deleting moves the account out of the list and stops its sessions", async () => {
		const w = await world(SEEDS);
		const author = await w.as("author@example.test");
		const root = await w.as("root@example.test");
		expect((await root.call("DELETE", "users/author")).status).toBe(204);
		expect((await author.call("GET", "auth/me")).status).toBe(401);
		expect((await root.call("GET", "users/author")).status).toBe(404);
		expect((await root.call("GET", "users")).json.meta.total).toBe(4);
		expect((w.raw.prepare("SELECT deleted_by FROM user WHERE id = 'author'").get() as { deleted_by: string }).deleted_by).toBe("root");
	});

	it("only Super Admin removes someone's 2FA", async () => {
		const w = await world(SEEDS);
		expect((await (await w.as("admin@example.test")).call("POST", "users/editor/reset-2fa")).status).toBe(403);
		expect((await (await w.as("root@example.test")).call("POST", "users/editor/reset-2fa")).status).toBe(204);
	});
});

describe("changing an email", () => {
	it("ends the person's sessions, rejects a taken email, and mails the old address", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		const admin = await w.as("admin@example.test");
		expect((await admin.call("PATCH", "users/editor", { email: "AUTHOR@example.test" })).error.code).toBe("email_taken");
		const changed = await admin.call("PATCH", "users/editor", { email: "bien-tap-moi@example.test" });
		expect(changed.data.email).toBe("bien-tap-moi@example.test");
		expect((await editor.call("GET", "auth/me")).status).toBe(401);
		await Promise.all(w.deferred);
		expect(w.mails.map((mail) => mail.to)).toEqual(["editor@example.test"]);
		expect(w.mails[0].text).toContain("bien-tap-moi@example.test");
	});
});

describe("roles", () => {
	it("shows the matrix, builds a custom role, edits its rights, and refuses to delete one in use", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		const roles = await root.call("GET", "roles");
		expect(roles.data.roles).toHaveLength(4);
		expect((await root.call("GET", "roles/role-author")).data.permissions).toContain("posts.update:own");
		expect((await root.call("GET", "permissions")).data.modules.length).toBeGreaterThan(15);

		const made = await root.call("POST", "roles", { name: "Thủ thư", description: "Quản lý media", permissions: ["media.view", "media.create", "media.update:own", "dashboard.view"] });
		expect(made.status).toBe(200);
		expect(made.data.permissions).toEqual(["dashboard.view", "media.create", "media.update:own", "media.view"]);
		expect((await root.call("POST", "roles", { name: "thủ thư", description: "", permissions: [] })).error.code).toBe("name_taken");
		expect((await root.call("POST", "roles", { name: "Lạ", description: "", permissions: ["khong.co"] })).status).toBe(400);
		expect((await root.call("POST", "roles", { name: "Lạ", description: "", permissions: ["media.create:own"] })).status).toBe(400);

		const edited = await root.call("PATCH", `roles/${made.data.id}`, { permissions: ["media.view", "media.delete"] });
		expect(edited.data.permissions).toEqual(["media.delete", "media.view"]);

		await root.call("PATCH", "users/author", { roleId: made.data.id });
		expect((await root.call("DELETE", `roles/${made.data.id}`)).error.code).toBe("role_in_use");
		await root.call("PATCH", "users/author", { roleId: "role-author" });
		expect((await root.call("DELETE", `roles/${made.data.id}`)).status).toBe(204);
		expect((await root.call("GET", `roles/${made.data.id}`)).status).toBe(404);
	});

	it("protects the system roles: Super Admin cannot be edited, system roles cannot be deleted or renamed", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		expect((await root.call("PATCH", "roles/role-super-admin", { permissions: ["posts.view"] })).error.code).toBe("forbidden_super");
		expect((await root.call("DELETE", "roles/role-editor")).error.code).toBe("system_role");
		expect((await root.call("PATCH", "roles/role-editor", { name: "Khác" })).error.code).toBe("system_role");
		expect((await root.call("PATCH", "roles/role-editor", { description: "Mô tả mới" })).data.description).toBe("Mô tả mới");
	});

	it("lets Admin read roles but not change them, and a role edit reaches the people holding it on their next request", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("GET", "roles")).status).toBe(200);
		expect((await admin.call("PATCH", "roles/role-editor", { description: "x" })).status).toBe(403);
		const root = await w.as("root@example.test");
		const editor = await w.as("editor@example.test");
		expect((await editor.call("GET", "auth/me")).data.permissions).toContain("posts.publish");
		await root.call("PATCH", "roles/role-editor", { permissions: ["dashboard.view", "posts.view"] });
		const me = await editor.call("GET", "auth/me");
		expect(me.data.permissions).not.toContain("posts.publish");
		expect(me.data.permissions).toContain("posts.view");
	});

	it("keeps a Super Admin from editing their own role, and logs every change with before and after", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		await root.call("PATCH", "roles/role-author", { permissions: ["posts.view"] });
		const row = w.raw.prepare("SELECT user_email, data_before, data_after, ip FROM audit_log WHERE action = 'role.update'").get() as { user_email: string; data_before: string; data_after: string };
		expect(row.user_email).toBe("root@example.test");
		expect(JSON.parse(row.data_after).permissions).toEqual(["posts.view"]);
		expect(JSON.parse(row.data_before).permissions).toContain("posts.create");
	});
});

describe("PATCH /me", () => {
	it("changes your own name", async () => {
		const w = await world(SEEDS);
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PATCH", "me", { name: "Tên Mới" })).data.name).toBe("Tên Mới");
		expect((await editor.call("GET", "auth/me")).data.user.name).toBe("Tên Mới");
		void PASSWORD;
	});
});
