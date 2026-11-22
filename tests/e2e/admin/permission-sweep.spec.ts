import { expect, request as playwrightRequest, test } from "@playwright/test";
import { AdminApi, localDb, makeAccount, PASSWORD, superAdminApi, unwrap } from "./helpers";
import { allowed, CUSTOM_GRANTS, EXPECTED, expand, PRINCIPALS, type Entry } from "../../unit/helpers/permissionTable";

// C: the permission matrix over HTTP, with REAL sessions (cookies + CSRF + Origin) against the running server and its local database.
//  1. every route of the router table x the four seeded roles + a role with only "own"-style rights: the status is compared with the table
//     the in-process matrix (tests/unit/admin/permission-matrix.test.ts) uses; the table is shared (tests/unit/helpers/permissionTable.ts);
//     the sweep must leave the content tables as they were;
//  2. nobody signed in, and a session that must still change its password;
//  3. IDOR across kinds: an Author against what an Editor made (post, picture, trash), an Admin against a Super Admin (sessions, edits),
//     roles above one's own rights;
//  4. a deleted account in the trash: nobody restores or removes one above their own rights;
//  5. a locked account and a changed role take effect on the very next request.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
test.setTimeout(600_000);

const stamp = Date.now().toString(36);
let base: string;
let root: AdminApi;
const people = new Map<string, { api: AdminApi; id: string; email: string; password: string }>();

const codeOf = (response: { json: unknown }) => (response.json as { error?: { code?: string } } | null)?.error?.code ?? "";

test.beforeAll(async ({ baseURL }) => {
	base = baseURL!;
	root = await superAdminApi(base);
	const seeded = unwrap<{ user: { id: string; email: string } }>(await root.call("GET", "auth/me")).user;
	people.set("super", { api: root, id: seeded.id, email: seeded.email, password: "" });
	for (const [label, roleId] of [["admin", "role-admin"], ["editor", "role-editor"], ["author", "role-author"]] as const) {
		const made = await makeAccount(root, base, roleId, `sweep-${label}`);
		people.set(label, { api: await AdminApi.signIn(base, made.email, made.password), id: made.id, email: made.email, password: made.password });
	}
	// A role from before the "own" scope was restricted (it holds `:own` on modules that cannot honour it): put in by hand, as the API now refuses it.
	const db = localDb();
	const roleId = `role-custom-${stamp}`;
	db.prepare("INSERT INTO role (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, '', 0, '2026', '2026')").run(roleId, `Vai giới hạn ${stamp}`);
	for (const [entry, scope] of expand(CUSTOM_GRANTS)) {
		const [module, action] = entry.split(".");
		db.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES (?, ?, ?, ?)").run(roleId, module, action, scope);
	}
	db.close();
	const custom = await makeAccount(root, base, roleId, "sweep-custom");
	people.set("custom", { api: await AdminApi.signIn(base, custom.email, custom.password), id: custom.id, email: custom.email, password: custom.password });
});
test.afterAll(async () => {
	for (const person of people.values()) await person.api.dispose();
});

const concrete = (path: string) => path.replace(/:[A-Za-z]+/g, "x-none");
const send = (api: { call: AdminApi["call"] }, entry: Entry) => api.call(entry.method, concrete(entry.path), entry.method === "GET" ? undefined : {});

/** Row counts of the content tables, to see that a sweep of empty requests wrote nothing. */
function contentCounts(): Record<string, number> {
	const db = localDb();
	const out: Record<string, number> = {};
	for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' ORDER BY name").all() as { name: string }[]) {
		// accounts, sessions and 2FA set-up are written by the sweep's own sign-ins and by `me/2fa/setup`, which any session may call
		if (/session|audit|rate|attempt|^user$|token|mfa|totp|backup|reset/i.test(name)) continue;
		out[name] = (db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number }).n;
	}
	db.close();
	return out;
}

test("every route x every role answers as the table says, and an empty sweep writes nothing", async () => {
	const before = contentCounts();
	const problems: string[] = [];
	for (const principal of PRINCIPALS) {
		const person = people.get(principal.id)!;
		for (const entry of EXPECTED) {
			if (entry.needs === "public" || entry.needs === "pending" || entry.key === "POST auth/logout") continue;
			// the sweep's own session must survive it: "sign out everywhere" is left to its own test
			if (entry.key === "DELETE me/sessions") continue;
			const result = await send(person.api, entry);
			const wants = allowed(principal, entry);
			if (wants) {
				// past the gate a handler may fail for its own reasons: the SMTP test of a server with no mail server set up answers 502 mail_failed
				const ownFailure = entry.key === "POST settings/smtp/test" && result.status === 502 && codeOf(result) === "mail_failed";
				if (result.status === 401 || result.status === 403 || (result.status >= 500 && result.status !== 503 && !ownFailure)) problems.push(`${principal.id} ${entry.key}: should pass the gate, got ${result.status} ${codeOf(result)}`);
			} else if (result.status !== 403 || !["forbidden", "forbidden_super"].includes(codeOf(result))) {
				problems.push(`${principal.id} ${entry.key}: should be 403 forbidden, got ${result.status} ${codeOf(result)}`);
			}
		}
	}
	expect(problems).toEqual([]);
	expect(contentCounts(), "the sweep sent empty requests: no content table may change").toEqual(before);
});

test("nobody signed in gets 401 on every route that is not public", async () => {
	const anon = await playwrightRequest.newContext({ baseURL: base });
	const problems: string[] = [];
	for (const entry of EXPECTED) {
		if (entry.needs === "public") continue;
		const response = await anon.fetch(`/api/quan-tri/v1/${concrete(entry.path)}`, {
			method: entry.method,
			headers: { Origin: new URL(base).origin },
			data: entry.method === "GET" ? undefined : {},
			failOnStatusCode: false,
		});
		if (response.status() !== 401) problems.push(`${entry.key}: got ${response.status()}`);
	}
	await anon.dispose();
	expect(problems).toEqual([]);
});

test("a session that must change its password is refused everywhere but /auth/me, /me/password and the pending routes", async () => {
	const created = unwrap<{ user: { id: string }; temporaryPassword: string }>(await root.call("POST", "users", { email: `forced-${stamp}@localhost.test`, name: "Phải đổi mật khẩu", roleId: "role-editor" }));
	const forced = await AdminApi.signIn(base, `forced-${stamp}@localhost.test`, created.temporaryPassword);
	const problems: string[] = [];
	for (const entry of EXPECTED) {
		if (entry.needs === "public" || entry.key === "POST auth/logout") continue;
		const result = await send(forced, entry);
		if (entry.needs === "session-any" || entry.needs === "pending") {
			if (result.status === 401 || result.status === 403) problems.push(`${entry.key}: should be open, got ${result.status} ${codeOf(result)}`);
		} else if (result.status !== 403 || codeOf(result) !== "password_change_required") problems.push(`${entry.key}: should be 403 password_change_required, got ${result.status} ${codeOf(result)}`);
	}
	await forced.dispose();
	expect(problems).toEqual([]);
});

test("IDOR: an Author cannot touch what an Editor made (post, revisions, preview, picture, trash)", async () => {
	const editor = people.get("editor")!.api;
	const author = people.get("author")!.api;
	const post = unwrap<{ id: string; version: number }>(await editor.call("POST", "posts", { title: `Bài của biên tập ${stamp}`, section: "dong-chay-hoang-phap", summary: "s" }));
	const path = `posts/${post.id}`;
	// reading is allowed (posts.view is for all); every write is not
	expect((await author.call("GET", path)).status).toBe(200);
	expect((await author.call("GET", `${path}/revisions`)).status).toBe(200);
	const results = {
		patch: await author.call("PATCH", path, { version: post.version, title: "Bị sửa" }),
		submit: await author.call("POST", `${path}/submit`, { version: post.version }),
		restore: await author.call("POST", `${path}/revisions/1/restore`, { version: post.version }),
		preview: await author.call("POST", `${path}/preview-token`),
		related: await author.call("PUT", `${path}/related`, { items: [] }),
		publish: await author.call("POST", `${path}/publish`, { version: post.version }),
		remove: await author.call("DELETE", path),
	};
	for (const [name, result] of Object.entries(results)) expect([name, result.status, codeOf(result)], `author ${name}`).toEqual([name, 403, "forbidden"]);
	const still = unwrap<{ title: string; status: string; version: number }>(await editor.call("GET", path));
	expect(still).toMatchObject({ title: `Bài của biên tập ${stamp}`, status: "draft", version: post.version });

	// pictures: the Editor's is the Author's to look at only
	const theirs = await editor.upload(`bien-tap-${stamp}.png`);
	const mine = await author.upload(`tac-gia-${stamp}.png`);
	const png = { name: "x.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") };
	const pictureWrites = [
		await author.call("PATCH", `media/${theirs}`, { alt: "x" }),
		await author.call("DELETE", `media/${theirs}`),
		await author.multipart("PUT", `media/${theirs}/file`, { file: png }),
		await author.multipart("PUT", `media/${theirs}/crops/1x1`, { file: png, region: JSON.stringify({ x: 0, y: 0, width: 1, height: 1 }) }),
		await author.call("DELETE", `media/${theirs}/crops/1x1`),
	];
	for (const result of pictureWrites) expect([result.status, codeOf(result)]).toEqual([403, "forbidden"]);
	expect((await author.call("PATCH", `media/${mine}`, { alt: "của tôi" })).status).toBe(200);

	// trash: the Editor trashes the post; the Author neither sees it nor restores or removes it
	expect((await editor.call("DELETE", path)).status).toBe(204);
	const listed = unwrap<{ id: string }[]>(await author.call("GET", "trash?type=post"));
	expect(listed.map((row) => row.id), "the Author's trash lists only what the Author deleted").not.toContain(post.id);
	for (const result of [await author.call("POST", `trash/post/${post.id}/restore`), await author.call("DELETE", `trash/post/${post.id}`)]) expect([403, 404], `author trash of another's post: ${result.status}`).toContain(result.status);
	expect(unwrap<{ id: string }[]>(await root.call("GET", "trash?type=post")).map((row) => row.id)).toContain(post.id);
	// the Editor gets it back; "own" rights alone (the custom role) cannot do it for somebody else either
	expect((await people.get("custom")!.api.call("POST", `trash/post/${post.id}/restore`)).status).not.toBe(200);
	expect((await editor.call("POST", `trash/post/${post.id}/restore`)).status).toBe(200);
});

test("IDOR: an Admin cannot read or change a Super Admin; nobody grants a role above their own", async () => {
	const admin = people.get("admin")!.api;
	const editor = people.get("editor")!.api;
	const superId = people.get("super")!.id;
	const refused = async (label: string, work: Promise<{ status: number; json: unknown }>) => {
		const result = await work;
		expect([label, result.status], label).toEqual([label, 403]);
	};
	await refused("Admin reads the Super Admin's sessions", admin.call("GET", `users/${superId}/sessions`));
	await refused("Admin ends the Super Admin's sessions", admin.call("DELETE", `users/${superId}/sessions`));
	await refused("Admin renames the Super Admin", admin.call("PATCH", `users/${superId}`, { name: "Bị đổi tên" }));
	await refused("Admin locks the Super Admin", admin.call("POST", `users/${superId}/lock`, { reason: "x" }));
	await refused("Admin forces a password change on the Super Admin", admin.call("POST", `users/${superId}/force-password-change`));
	await refused("Admin resets the Super Admin's 2FA", admin.call("POST", `users/${superId}/reset-2fa`));
	await refused("Editor reads the Super Admin's sessions", editor.call("GET", `users/${superId}/sessions`));
	// the Super Admin's own sessions are readable by the Super Admin (the control)
	expect((await root.call("GET", `users/${superId}/sessions`)).status).toBe(200);

	// a role above one's own
	await refused("Admin makes an account a Super Admin", admin.call("POST", "users", { email: `up-${stamp}@localhost.test`, name: "Vượt quyền", roleId: "role-super-admin" }));
	const victim = unwrap<{ user: { id: string } }>(await root.call("POST", "users", { email: `victim-${stamp}@localhost.test`, name: "Nạn nhân", roleId: "role-author" }));
	await refused("Admin promotes an Author to Super Admin", admin.call("PATCH", `users/${victim.user.id}`, { roleId: "role-super-admin" }));
	await refused("Admin creates a role", admin.call("POST", "roles", { name: `Vai ${stamp}`, description: "", permissions: ["posts.view"] }));
	await refused("Editor creates an account", editor.call("POST", "users", { email: `ed-${stamp}@localhost.test`, name: "x", roleId: "role-author" }));
	// the Admin can make an account whose role holds no more than the Admin's own (the control), and the role list it may hand out is that
	const mayGrant = await admin.call("POST", "users", { email: `ok-${stamp}@localhost.test`, name: "Hợp lệ", roleId: "role-editor" });
	expect([200, 201]).toContain(mayGrant.status);
	// a custom role with `:own` on a module that cannot honour it is refused by the role editor
	const own = await root.call("POST", "roles", { name: `Own quá ${stamp}`, description: "", permissions: ["users.view:own"] });
	expect(own.status, "users.view:own is not a right the server can honour").toBe(400);
});

test("a deleted account in the trash: nobody restores or removes one above their own rights", async () => {
	const admin = people.get("admin")!.api;
	const editor = people.get("editor")!.api;
	const second = unwrap<{ user: { id: string } }>(await root.call("POST", "users", { email: `super2-${stamp}@localhost.test`, name: "Super thứ hai", roleId: "role-super-admin" }));
	const lowly = unwrap<{ user: { id: string } }>(await root.call("POST", "users", { email: `thap-${stamp}@localhost.test`, name: "Tài khoản thấp", roleId: "role-author" }));
	expect((await root.call("DELETE", `users/${second.user.id}`)).status).toBe(204);
	expect((await root.call("DELETE", `users/${lowly.user.id}`)).status).toBe(204);

	// the Editor has no say over accounts: the type is not even listed, and nothing works
	const types = unwrap<{ types: { type: string }[] }>(await editor.call("GET", "trash/types")).types.map((item) => item.type);
	expect(types).not.toContain("user");
	for (const result of [await editor.call("POST", `trash/user/${second.user.id}/restore`), await editor.call("POST", `trash/user/${lowly.user.id}/restore`), await editor.call("DELETE", `trash/user/${lowly.user.id}`)]) {
		expect(result.status, "Editor on a deleted account").toBe(403);
	}
	// the Admin may handle a deleted account of a lower role, never a Super Admin's, and cannot remove for good (no users.delete)
	expect((await admin.call("POST", `trash/user/${second.user.id}/restore`)).status, "Admin restoring a deleted Super Admin").toBe(403);
	expect((await admin.call("DELETE", `trash/user/${second.user.id}`)).status, "Admin purging a deleted Super Admin").toBe(403);
	expect((await admin.call("DELETE", `trash/user/${lowly.user.id}`)).status, "Admin purging (no users.delete)").toBe(403);
	expect((await admin.call("POST", `trash/user/${lowly.user.id}/restore`)).status, "Admin restoring a deleted Author (users.update, below its own rights)").toBe(200);
	// the account is really still in the trash / back, as the database says
	const db = localDb();
	const state = (id: string) => (db.prepare("SELECT deleted_at FROM user WHERE id = ?").get(id) as { deleted_at: string | null }).deleted_at;
	expect(state(second.user.id), "the Super Admin stays deleted").not.toBeNull();
	expect(state(lowly.user.id), "the Author is back").toBeNull();
	db.close();
	// the Super Admin may restore the Super Admin (the control)
	expect((await root.call("POST", `trash/user/${second.user.id}/restore`)).status).toBe(200);
});

test("a locked account and a changed role take effect on the very next request", async () => {
	const made = await makeAccount(root, base, "role-editor", "sweep-live");
	const live = await AdminApi.signIn(base, made.email, made.password);
	const post = unwrap<{ id: string; version: number }>(await live.call("POST", "posts", { title: `Bài sống ${stamp}`, section: "dong-chay-hoang-phap", summary: "s" }));
	expect((await live.call("GET", "dashboard")).status).toBe(200);
	// the role changes: the same session, the very next request
	expect((await root.call("PATCH", `users/${made.id}`, { roleId: "role-author" })).status).toBe(200);
	const published = await live.call("POST", `posts/${post.id}/publish`, { version: post.version });
	expect([published.status, codeOf(published)], "an Author cannot publish, right after the role changed").toEqual([403, "forbidden"]);
	expect((await live.call("GET", "dashboard")).status, "what the new role still holds still works").toBe(200);
	// and back: the Editor may publish again at once
	expect((await root.call("PATCH", `users/${made.id}`, { roleId: "role-editor" })).status).toBe(200);
	expect((await live.call("POST", `posts/${post.id}/publish`, { version: post.version })).status).toBe(200);
	// locked: the next request already fails, so does a new sign-in; unlocked: a new sign-in works
	expect((await root.call("POST", `users/${made.id}/lock`, { reason: "kiểm thử" })).status).toBe(200);
	const afterLock = await live.call("GET", "dashboard");
	expect(afterLock.status, "a locked account's open session").toBeGreaterThanOrEqual(401);
	expect(afterLock.status).toBeLessThan(500);
	expect(await AdminApi.trySignIn(base, made.email, PASSWORD), "a locked account cannot sign in").toBeNull();
	expect((await root.call("POST", `users/${made.id}/unlock`)).status).toBe(200);
	const back = await AdminApi.trySignIn(base, made.email, PASSWORD);
	expect(back, "after unlocking the account signs in again").not.toBeNull();
	await back?.dispose();
	await live.dispose();
	// a deleted account loses its session too
	const doomed = await makeAccount(root, base, "role-editor", "sweep-doomed");
	const doomedApi = await AdminApi.signIn(base, doomed.email, doomed.password);
	expect((await doomedApi.call("GET", "dashboard")).status).toBe(200);
	expect((await root.call("DELETE", `users/${doomed.id}`)).status).toBe(204);
	expect((await doomedApi.call("GET", "dashboard")).status).toBeGreaterThanOrEqual(401);
	await doomedApi.dispose();
});
