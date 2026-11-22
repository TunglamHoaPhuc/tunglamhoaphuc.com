// Server-side permission enforcement (tasks/admin-v3-spec.md, hạng mục `quyen`, defects Q1–Q9): each test names the defect it pins.
import { describe, expect, it } from "vitest";
import { dispatch } from "../../../src/admin/http/api";
import { hashPassword } from "../../../src/admin/auth/password";
import { contentWorld, CONTENT_SEEDS } from "../helpers/contentWorld";
import { BASE, FAST, PASSWORD, world, type Seed } from "../helpers/adminWorld";
import { count, insertMedia, SEEDS } from "../helpers/ops";

const SEEDS_PLUS: Seed[] = [...SEEDS, { id: "root2", email: "root2@example.test", roleId: "role-super-admin", name: "Gốc hai" }];

/** A role with exactly these permissions (`module.action` or `module.action:own`) and an account that holds it. */
function custom(w: Awaited<ReturnType<typeof world>>, id: string, permissions: string[]) {
	w.raw.prepare("INSERT INTO role (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, '', 0, '2026', '2026')").run(`role-${id}`, `Vai ${id}`);
	for (const entry of permissions) {
		const own = entry.endsWith(":own");
		const [module, action] = (own ? entry.slice(0, -4) : entry).split(".");
		w.raw.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES (?, ?, ?, ?)").run(`role-${id}`, module, action, own ? "own" : "all");
	}
	w.raw
		.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at) VALUES (?, ?, ?, 'viewer', ?, ?, '2026')")
		.run(id, `${id}@example.test`, id, `role-${id}`, hashPassword(PASSWORD, FAST));
	return `${id}@example.test`;
}

const trashUser = (w: Awaited<ReturnType<typeof world>>, id: string) => w.raw.prepare("UPDATE user SET deleted_at = '2026-04-01T00:00:00.000Z', deleted_by = 'root' WHERE id = ?").run(id);

describe("Q1: the trash obeys the module of what is inside", () => {
	it("hides the kinds the person may not view and refuses to restore them", async () => {
		const w = await world(SEEDS_PLUS);
		trashUser(w, "root2");
		w.raw.prepare("UPDATE role SET deleted_at = '2026-04-02T00:00:00.000Z' WHERE id = 'role-author'").run();
		insertMedia(w.raw, { id: "m1", deletedAt: "2026-04-03T00:00:00.000Z" });
		const editor = await w.as("editor@example.test");
		const list = await editor.call("GET", "trash");
		expect(list.data.map((row: { type: string }) => row.type)).toEqual(["media"]);
		expect(list.json.meta.total).toBe(1);
		expect((await editor.call("GET", "trash?type=user")).data).toEqual([]);
		const types = (await editor.call("GET", "trash/types")).data.types as { type: string }[];
		expect(types.map((t) => t.type)).not.toContain("user");
		expect(types.map((t) => t.type)).not.toContain("role");
		// the editor holds trash.update, but not users.update / roles.update
		expect((await editor.call("POST", "trash/user/root2/restore", {})).status).toBe(403);
		expect((await editor.call("POST", "trash/role/role-author/restore", {})).status).toBe(403);
		expect(w.raw.prepare("SELECT deleted_at FROM user WHERE id = 'root2'").get()).toEqual({ deleted_at: "2026-04-01T00:00:00.000Z" });
	});

	it("never lets an Admin bring back an account with more rights than theirs, nor remove an account for good", async () => {
		const w = await world(SEEDS_PLUS);
		trashUser(w, "root2");
		trashUser(w, "author2");
		const admin = await w.as("admin@example.test");
		const refused = await admin.call("POST", "trash/user/root2/restore", {});
		expect(refused.status).toBe(403);
		expect(refused.error.code).toBe("forbidden_higher");
		expect(w.raw.prepare("SELECT deleted_at FROM user WHERE id = 'root2'").get()).not.toEqual({ deleted_at: null });
		// an account within their rights is theirs to restore (users.update) ...
		expect((await admin.call("POST", "trash/user/author2/restore", {})).status).toBe(200);
		// ... but removing for good needs users.delete, which an Admin has not
		trashUser(w, "author2");
		expect((await admin.call("DELETE", "trash/user/author2")).status).toBe(403);
		expect(count(w.raw, "user", "id = 'author2'")).toBe(1);
		const root = await w.as("root@example.test");
		expect((await root.call("POST", "trash/user/root2/restore", {})).status).toBe(200);
		expect((await root.call("DELETE", "trash/user/author2")).status).toBe(204);
	});

	it("applies the 'cannot exceed your own rights' rule to roles, and needs roles.update / roles.delete", async () => {
		const w = await world(SEEDS_PLUS);
		w.raw.prepare("UPDATE role SET deleted_at = '2026-04-02T00:00:00.000Z' WHERE id = 'role-author'").run();
		const admin = await w.as("admin@example.test");
		expect((await admin.call("POST", "trash/role/role-author/restore", {})).status).toBe(403);
		// a role the person holds fewer rights than: update is there, but covers() is not
		const mid = custom(w, "mid", ["trash.view", "trash.update", "trash.delete", "roles.view", "roles.update", "roles.delete"]);
		w.raw.prepare("UPDATE role SET deleted_at = '2026-04-03T00:00:00.000Z' WHERE id = 'role-editor'").run();
		const client = await w.as(mid);
		const refused = await client.call("POST", "trash/role/role-editor/restore", {});
		expect(refused.status).toBe(403);
		expect(refused.error.code).toBe("forbidden_higher");
		expect((await client.call("DELETE", "trash/role/role-editor")).status).toBe(403);
		const root = await w.as("root@example.test");
		expect((await root.call("POST", "trash/role/role-author/restore", {})).status).toBe(200);
	});

	it("needs <module>.update to restore and <module>.delete to remove, whatever trash.* says", async () => {
		const w = await world(SEEDS_PLUS);
		w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date, deleted_at, deleted_by) VALUES ('p1', 's', 'Bài', 'dong-chay-hoang-phap', '2026-01-01', '2026-04-01', 'admin')").run();
		insertMedia(w.raw, { id: "m1", deletedAt: "2026-04-01T00:00:00.000Z" });
		const email = custom(w, "bin", ["trash.view", "trash.update", "trash.delete"]);
		const bin = await w.as(email);
		// nothing to see: no <module>.view
		expect((await bin.call("GET", "trash")).data).toEqual([]);
		expect((await bin.call("POST", "trash/post/p1/restore", {})).status).toBe(403);
		expect((await bin.call("POST", "trash/media/m1/restore", {})).status).toBe(403);
		expect((await bin.call("DELETE", "trash/post/p1")).status).toBe(403);
		expect((await bin.call("DELETE", "trash/media/m1")).status).toBe(403);
		expect(count(w.raw, "post", "id = 'p1'")).toBe(1);
		// view + update on posts: may restore, still may not remove
		const some = custom(w, "some", ["trash.view", "trash.update", "trash.delete", "posts.view", "posts.update"]);
		const client = await w.as(some);
		expect((await client.call("GET", "trash")).data.map((row: { id: string }) => row.id)).toEqual(["p1"]);
		expect((await client.call("DELETE", "trash/post/p1")).status).toBe(403);
		expect((await client.call("POST", "trash/post/p1/restore", {})).status).toBe(200);
	});

	it("keeps the 'own' rule: an Author restores only their own post, and needs posts.update for it", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const mine = (await author.call("POST", "posts", { title: "Của tôi", section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu" })).data;
		expect((await author.call("DELETE", `posts/${mine.id}`)).status).toBe(204);
		const other = await w.as("author2@example.test");
		const theirs = (await other.call("POST", "posts", { title: "Của người", section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu" })).data;
		expect((await other.call("DELETE", `posts/${theirs.id}`)).status).toBe(204);
		w.raw.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES ('role-author', 'trash', 'update', 'own')").run();
		const again = await w.as("author@example.test");
		expect((await again.call("GET", "trash")).data.map((row: { id: string }) => row.id)).toEqual([mine.id]);
		expect((await again.call("POST", `trash/post/${theirs.id}/restore`, {})).status).toBe(403);
		expect((await again.call("POST", `trash/post/${mine.id}/restore`, {})).status).toBe(200);
	});
});

describe("Q2: the 'own' scope exists only where a handler checks the owner", () => {
	it("refuses :own on everything but the pairs that enforce it", async () => {
		const w = await world(SEEDS_PLUS);
		const root = await w.as("root@example.test");
		const make = (permissions: string[], name = `Vai ${Math.random()}`) => root.call("POST", "roles", { name, description: "", permissions });
		for (const bad of ["users.view:own", "users.update:own", "backup.view:own", "roles.delete:own", "settings.update:own", "categories.update:own", "menus.delete:own", "home.update:own", "seo.update:own", "audit.view:own", "posts.view:own", "media.view:own", "posts.publish:own"]) {
			const made = await make([bad]);
			expect(made.status, bad).toBe(400);
		}
		for (const good of ["posts.update:own", "posts.delete:own", "teachings.update:own", "pages.delete:own", "events.update:own", "statues.delete:own", "areas.update:own", "quotes.delete:own", "media.update:own", "media.delete:own", "trash.view:own", "trash.update:own", "trash.delete:own"]) {
			const made = await make([good]);
			expect(made.status, good + JSON.stringify(made.json)).toBe(200);
		}
	});

	it("makes a stored role with a limited scope on a module that cannot honour it a no-go, not a full right", async () => {
		const w = await world(SEEDS_PLUS);
		const email = custom(w, "legacy", ["users.view:own", "backup.view:own", "posts.view:own", "settings.view:own", "dashboard.view"]);
		const client = await w.as(email);
		expect((await client.call("GET", "users")).status).toBe(403);
		expect((await client.call("GET", "users/root")).status).toBe(403);
		expect((await client.call("GET", "backup")).status).toBe(403);
		expect((await client.call("GET", "settings/general")).status).toBe(403);
		expect((await client.call("GET", "posts")).status).toBe(403);
		// the dashboard no longer reads users, either
		const board = await client.call("GET", "dashboard");
		expect(board.status).toBe(200);
		expect(board.data.users).toBeUndefined();
	});

	it("lets a route that has no owner to check (reorder, featured, programs) through only with scope all", async () => {
		const w = await world(SEEDS_PLUS);
		const email = custom(w, "own-all", ["quotes.update:own", "areas.update:own", "events.update:own"]);
		const client = await w.as(email);
		expect((await client.call("POST", "quotes/reorder", { ids: [] })).status).toBe(403);
		expect((await client.call("PUT", "areas/featured", { ids: [] })).status).toBe(403);
		expect((await client.call("PATCH", "events/programs/x", {})).status).toBe(403);
		expect((await client.call("PUT", "events/themes/1", {})).status).toBe(403);
	});

	it("still lets an Author act on their own rows through the gate", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const mine = (await author.call("POST", "posts", { title: "Của tôi", section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu" })).data;
		expect((await author.call("PATCH", `posts/${mine.id}`, { version: 1, title: "Đã sửa" })).status).toBe(200);
		expect((await author.call("PATCH", "posts/post-1060", { version: 1, title: "Của người khác" })).status).toBe(403);
		expect((await author.call("POST", `posts/${mine.id}/submit`, {})).status).toBe(200);
	});
});

describe("Q3: another person's sessions follow the 'not above your rights' rule", () => {
	it("refuses an Admin looking at a Super Admin's sessions", async () => {
		const w = await world(SEEDS_PLUS);
		const admin = await w.as("admin@example.test");
		const refused = await admin.call("GET", "users/root/sessions");
		expect(refused.status).toBe(403);
		expect(refused.error.code).toBe("forbidden_higher");
		expect((await admin.call("GET", "users/author2/sessions")).status).toBe(200);
		expect((await admin.call("GET", "users/admin/sessions")).status).toBe(200);
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "users/admin/sessions")).status).toBe(200);
	});
});

describe("Q4: media folders have no owner, so 'own' is not enough", () => {
	it("refuses create, rename and delete of folders to someone who may change only their own pictures", async () => {
		const w = await world(SEEDS_PLUS);
		w.raw.prepare("INSERT INTO media_folder (id, name, slug, position) VALUES ('f1', 'Lễ', 'le', 0)").run();
		const author = await w.as("author@example.test");
		expect((await author.call("PATCH", "media/folders/f1", { name: "Đổi tên" })).status).toBe(403);
		expect((await author.call("DELETE", "media/folders/f1")).status).toBe(403);
		expect((await author.call("POST", "media/folders", { name: "Mới" })).status).toBe(403);
		expect(w.raw.prepare("SELECT name FROM media_folder WHERE id = 'f1'").get()).toEqual({ name: "Lễ" });
		// a role with media.update:own and media.create / media.delete in full still has no say over folders
		const email = custom(w, "lib", ["media.view", "media.create", "media.delete", "media.update:own"]);
		const lib = await w.as(email);
		expect((await lib.call("POST", "media/folders", { name: "Mới" })).status).toBe(403);
		expect((await lib.call("DELETE", "media/folders/f1")).status).toBe(403);
		const editor = await w.as("editor@example.test");
		expect((await editor.call("PATCH", "media/folders/f1", { name: "Đổi tên" })).status).toBe(204);
		expect((await editor.call("POST", "media/folders", { name: "Mới" })).status).toBe(200);
	});
});

describe("Q5: removing a live article takes the same right as editing one", () => {
	it("stops an Author trashing their own post once it is live, and says so in canDelete", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const mine = (await author.call("POST", "posts", { title: "Của tôi", section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu" })).data;
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", `posts/${mine.id}/publish`, {})).status).toBe(200);
		const detail = await author.call("GET", `posts/${mine.id}`);
		expect(detail.data.canDelete).toBe(false);
		const refused = await author.call("DELETE", `posts/${mine.id}`);
		expect(refused.status).toBe(403);
		expect(refused.error.code).toBe("needs_publisher");
		expect(w.raw.prepare("SELECT deleted_at FROM post WHERE id = ?").get(mine.id)).toEqual({ deleted_at: null });
		const list = await author.call("GET", "posts");
		expect(list.data.find((row: { id: string }) => row.id === mine.id).canDelete).toBe(false);
		// someone who may publish still can
		expect((await editor.call("DELETE", `posts/${mine.id}`)).status).toBe(204);
	});

	it("lets an Author trash their own draft", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const mine = (await author.call("POST", "posts", { title: "Nháp", section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu" })).data;
		expect(mine.canDelete).toBe(true);
		expect((await author.call("DELETE", `posts/${mine.id}`)).status).toBe(204);
	});
});

describe("Q6: a preview link is for someone who may edit the article", () => {
	it("refuses a link to another person's article, and logs who made one", async () => {
		const w = await contentWorld();
		const author = await w.as("author@example.test");
		const mine = (await author.call("POST", "posts", { title: "Của tôi", section: "dong-chay-hoang-phap", categoryId: "post:dong-chay-hoang-phap:cong-tu" })).data;
		const other = await w.as("author2@example.test");
		expect((await other.call("POST", `posts/${mine.id}/preview-token`, {})).status).toBe(403);
		expect((await author.call("POST", "posts/post-1060/preview-token", {})).status).toBe(403);
		expect((await author.call("POST", `posts/${mine.id}/preview-token`, {})).status).toBe(200);
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", `posts/${mine.id}/preview-token`, {})).status).toBe(200);
	});
});

describe("Q7: a session that must change its password can do nothing but that", () => {
	it("blocks sessions, 2FA and the profile until the password is changed", async () => {
		const w = await world(SEEDS_PLUS);
		w.raw.prepare("UPDATE user SET must_change_password = 1 WHERE id = 'editor'").run();
		const editor = await w.as("editor@example.test");
		const blocked: [string, string, unknown?][] = [
			["GET", "me/sessions"],
			["DELETE", "me/sessions"],
			["DELETE", "me/sessions/abc"],
			["POST", "me/2fa/setup", {}],
			["POST", "me/2fa/enable", { code: "123456" }],
			["POST", "me/2fa/disable", { password: PASSWORD }],
			["PATCH", "me", { name: "Tên khác" }],
		];
		for (const [method, path, body] of blocked) {
			const result = await editor.call(method, path, body);
			expect(result.status, `${method} ${path}`).toBe(403);
			expect(result.error.code, `${method} ${path}`).toBe("password_change_required");
		}
		expect(w.raw.prepare("SELECT name FROM user WHERE id = 'editor'").get()).toEqual({ name: "Biên tập" });
		// what the person needs to get out of that state still works
		expect((await editor.call("GET", "auth/me")).status).toBe(200);
		const changed = await editor.call("POST", "me/password", { current: PASSWORD, next: "Mot-mat-khau-moi-456" });
		expect(changed.status).toBe(204);
	});
});

describe("Q8: nobody switches their own 2FA off without the password", () => {
	it("refuses reset-2fa on oneself", async () => {
		const w = await world(SEEDS_PLUS);
		const root = await w.as("root@example.test");
		w.raw.prepare("INSERT INTO user_totp (user_id, secret_enc, enabled_at) VALUES ('root', 'x', '2026-01-01')").run(); // turned on after sign-in, so the session is not asked for a code
		const refused = await root.call("POST", "users/root/reset-2fa", {});
		expect(refused.status).toBe(403);
		expect(refused.error.code).toBe("forbidden_self");
		expect(count(w.raw, "user_totp", "user_id = 'root'")).toBe(1);
		// another Super Admin may still do it for them
		const other = await w.as("root2@example.test");
		expect((await other.call("POST", "users/root/reset-2fa", {})).status).toBe(204);
		expect(count(w.raw, "user_totp", "user_id = 'root'")).toBe(0);
	});
});

describe("Q9: a broken Origin or path is a refusal, never a 500", () => {
	async function send(w: Awaited<ReturnType<typeof world>>, method: string, path: string, headers: Record<string, string>) {
		return dispatch(new Request(`${BASE}/api/quan-tri/v1/${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: method === "GET" ? undefined : "{}" }), path.split("?")[0], w.deps);
	}

	it("answers 403 bad_origin for Origin: null, junk, and another scheme or port", async () => {
		const w = await world(SEEDS_PLUS);
		const host = new URL(BASE).host;
		for (const origin of ["null", "not a url", `http://${host}`, `https://${host}:8443`, "https://evil.example", ""]) {
			const response = await send(w, "POST", "auth/login", origin === "" ? {} : { origin });
			expect(response.status, `Origin: ${origin}`).toBe(403);
			expect((await response.json()).error.code).toBe("bad_origin");
		}
		const fine = await send(w, "POST", "auth/login", { origin: BASE });
		expect(fine.status).not.toBe(403);
	});

	it("answers 404 for a malformed percent escape in the path", async () => {
		const w = await world(SEEDS_PLUS);
		for (const path of ["users/%E0%A4%A", "users/%", "media/folders/%zz"]) {
			const response = await send(w, "GET", path, {});
			expect(response.status, path).toBe(404);
			expect((await response.json()).error.code).toBe("not_found");
		}
	});
});

void CONTENT_SEEDS;

describe("data the account screens need to hide what the server would refuse (G4/G5)", () => {
	it("says on an account whether the caller may manage it", async () => {
		const w = await world(SEEDS_PLUS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("GET", "users/root")).data.manageable).toBe(false); // holds rights beyond the Admin's
		expect((await admin.call("GET", "users/author")).data.manageable).toBe(true);
		expect((await admin.call("GET", "users/admin")).data.manageable).toBe(false); // oneself: never locked, deleted or re-roled
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "users/admin")).data.manageable).toBe(true);
		expect((await root.call("GET", "users/root2")).data.manageable).toBe(true);
	});

	it("says on each role whether the caller may give it", async () => {
		const w = await world(SEEDS_PLUS);
		const admin = await w.as("admin@example.test");
		const roles = (await admin.call("GET", "roles")).data.roles as { id: string; assignable: boolean }[];
		const flag = (id: string) => roles.find((role) => role.id === id)?.assignable;
		expect(flag("role-super-admin")).toBe(false);
		expect(flag("role-admin")).toBe(false); // equal rights are not handed out (second audit: strictly greater only)
		expect(flag("role-editor")).toBe(true);
		expect(flag("role-author")).toBe(true);
		const root = await w.as("root@example.test");
		const all = (await root.call("GET", "roles")).data.roles as { assignable: boolean }[];
		expect(all.every((role) => role.assignable)).toBe(true);
	});
});
