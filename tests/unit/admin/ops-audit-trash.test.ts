import { describe, expect, it } from "vitest";
import { registerTrashable } from "../../../src/admin/trash";
import { world } from "../helpers/adminWorld";
import { count, insertAudit, insertMedia, SEEDS } from "../helpers/ops";

// A kind with a partial unique index (page slugs among live pages), to see a restore refused.
registerTrashable({ type: "test_page", label: "Trang thử", table: "page", titleSql: "title", module: "pages", hasCreatedBy: true, purge: (ctx, _by, id) => [ctx.db.prepare("DELETE FROM revision WHERE entity_type = 'page' AND entity_id = ?").bind(id)] });

describe("activity log", () => {
	it("lists newest first, 50 to a page, with the total", async () => {
		const w = await world(SEEDS);
		for (let i = 0; i < 60; i++) insertAudit(w.raw, { at: `2026-03-01T00:${String(i).padStart(2, "0")}:00.000Z`, entityId: `n${i}` });
		const root = await w.as("root@example.test");
		const first = await root.call("GET", "audit");
		expect(first.status).toBe(200);
		expect(first.json.meta).toMatchObject({ page: 1, pageSize: 50 });
		expect(first.json.meta.total).toBeGreaterThanOrEqual(60);
		expect(first.data).toHaveLength(50);
		const times = first.data.map((row: { createdAt: string }) => row.createdAt);
		expect([...times].sort().reverse()).toEqual(times);
		const second = await root.call("GET", "audit?page=2");
		expect(second.data.length).toBe(first.json.meta.total - 50);
		// pageSize is not the caller's to raise
		expect((await root.call("GET", "audit?pageSize=500")).data).toHaveLength(50);
	});

	it("filters by person, action, kind, entity, address, time and a search word", async () => {
		const w = await world(SEEDS);
		insertAudit(w.raw, { userId: "admin", email: "admin@example.test", action: "post.update", entityType: "post", entityId: "p1", ip: "1.2.3.4", at: "2026-02-10T10:00:00.000Z" });
		insertAudit(w.raw, { userId: "editor", email: "editor@example.test", action: "media.upload", entityType: "media", entityId: "m1", ip: "5.6.7.8", at: "2026-02-11T10:00:00.000Z" });
		insertAudit(w.raw, { userId: "editor", email: "editor@example.test", action: "post.update", entityType: "post", entityId: "p2", ip: "5.6.7.8", at: "2026-02-12T18:30:00.000Z" });
		const root = await w.as("root@example.test");
		const ids = async (query: string) => (await root.call("GET", `audit?${query}`)).data.map((row: { entityId: string }) => row.entityId).sort();
		expect(await ids("userId=editor")).toEqual(["m1", "p2"]);
		expect(await ids("action=post.update")).toEqual(["p1", "p2"]);
		expect(await ids("entityType=media")).toEqual(["m1"]);
		expect(await ids("entityId=p2")).toEqual(["p2"]);
		expect(await ids("ip=1.2.3.4")).toEqual(["p1"]);
		expect(await ids("userId=editor&action=post.update")).toEqual(["p2"]);
		expect(await ids("q=admin@")).toContain("p1");
		expect(await ids("q=media.upl")).toEqual(["m1"]);
		// days are Vietnam days: 12 Feb 18:30 UTC is already 13 Feb there
		expect(await ids("entityType=post&from=2026-02-11&to=2026-02-12")).toEqual([]);
		expect(await ids("entityType=post&from=2026-02-13&to=2026-02-13")).toEqual(["p2"]);
		expect(await ids("entityType=post&from=2026-02-10&to=2026-02-10")).toEqual(["p1"]);
		const bad = await root.call("GET", "audit?from=hôm-qua");
		expect(bad.status).toBe(400);
		expect(bad.error.fields.from).toBeTruthy();
	});

	it("shows one entry with its data before and after, and names the person", async () => {
		const w = await world(SEEDS);
		insertAudit(w.raw, { userId: "admin", email: "admin@example.test", action: "post.update", entityType: "post", entityId: "p1", at: "2026-02-10T10:00:00.000Z", before: { title: "Cũ" }, after: { title: "Mới" } });
		const root = await w.as("root@example.test");
		const list = await root.call("GET", "audit?entityId=p1");
		expect(list.data[0]).toMatchObject({ userName: "Quản trị", userEmail: "admin@example.test" });
		const one = await root.call("GET", `audit/${list.data[0].id}`);
		expect(one.status).toBe(200);
		expect(one.data).toMatchObject({ before: { title: "Cũ" }, after: { title: "Mới" }, userAgent: "test" });
		expect((await root.call("GET", "audit/999999")).status).toBe(404);
		expect((await root.call("GET", "audit/abc")).status).toBe(404);
	});

	it("is for people with audit.view only, and has no way to change or delete an entry", async () => {
		const w = await world(SEEDS);
		insertAudit(w.raw, { at: "2026-02-10T10:00:00.000Z" });
		const editor = await w.as("editor@example.test");
		expect((await editor.call("GET", "audit")).status).toBe(403);
		expect((await editor.call("GET", "audit/1")).status).toBe(403);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("GET", "audit")).status).toBe(200);
		const id = (await admin.call("GET", "audit")).data[0].id;
		for (const method of ["PUT", "PATCH", "DELETE", "POST"]) expect((await admin.call(method, `audit/${id}`, {})).status, method).toBe(405);
		expect((await admin.call("DELETE", "audit", {})).status).toBe(405);
		// and the database itself refuses
		expect(() => w.raw.prepare("DELETE FROM audit_log").run()).toThrow(/append-only/);
		expect(() => w.raw.prepare("UPDATE audit_log SET action = 'x'").run()).toThrow(/append-only/);
	});
});

describe("trash: listing", () => {
	it("knows the kinds nobody else owns", async () => {
		const w = await world(SEEDS);
		// accounts and roles are listed only to people who may view them (an Editor may not: see permissions.test.ts)
		const editor = await w.as("root@example.test");
		const types = (await editor.call("GET", "trash/types")).data.types as { type: string; label: string }[];
		for (const type of ["media", "user", "role"]) expect(types.map((t) => t.type)).toContain(type);
		expect(types.find((t) => t.type === "media")?.label).toBe("Ảnh trong thư viện");
	});

	it("lists what is in the trash across kinds, newest first, with who removed it and paging", async () => {
		const w = await world(SEEDS);
		insertMedia(w.raw, { id: "m-old", deletedAt: "2026-04-01T00:00:00.000Z", deletedBy: "editor", title: "Ảnh cũ" });
		insertMedia(w.raw, { id: "m-new", deletedAt: "2026-04-03T00:00:00.000Z", deletedBy: "admin" });
		insertMedia(w.raw, { id: "m-live" });
		w.raw.prepare("UPDATE role SET deleted_at = '2026-04-02T00:00:00.000Z' WHERE id = 'role-editor'").run();
		// a role shows only to someone who may view roles (roles.view): a Super Admin here, not the Editor
		const editor = await w.as("root@example.test");
		const all = await editor.call("GET", "trash");
		expect(all.status).toBe(200);
		expect(all.data.map((row: { id: string }) => row.id)).toEqual(["m-new", "role-editor", "m-old"]);
		expect(all.json.meta.total).toBe(3);
		expect(all.data[0]).toMatchObject({ type: "media", typeLabel: "Ảnh trong thư viện", deletedByName: "Quản trị" });
		expect(all.data[2]).toMatchObject({ title: "Ảnh cũ", deletedByName: "Biên tập" });
		expect((await editor.call("GET", "trash?type=role")).data.map((row: { id: string }) => row.id)).toEqual(["role-editor"]);
		const paged = await editor.call("GET", "trash?pageSize=2&page=2");
		expect(paged.data.map((row: { id: string }) => row.id)).toEqual(["m-old"]);
		expect(paged.json.meta.total).toBe(3);
		const bad = await editor.call("GET", "trash?type=khong-co");
		expect(bad.status).toBe(400);
	});

	it("shows an Author with only own rights just the pictures they uploaded", async () => {
		const w = await world(SEEDS);
		insertMedia(w.raw, { id: "mine", uploadedBy: "author", deletedAt: "2026-04-01T00:00:00.000Z", deletedBy: "author" });
		insertMedia(w.raw, { id: "theirs", uploadedBy: "author2", deletedAt: "2026-04-02T00:00:00.000Z", deletedBy: "author2" });
		w.raw.prepare("UPDATE role SET deleted_at = '2026-04-02T00:00:00.000Z' WHERE id = 'role-editor'").run();
		const author = await w.as("author@example.test");
		const list = await author.call("GET", "trash");
		expect(list.data.map((row: { id: string }) => row.id)).toEqual(["mine"]);
		expect(list.json.meta.total).toBe(1);
		expect((await author.call("GET", "trash?type=role")).data).toEqual([]);
	});
});

describe("trash: restore", () => {
	it("clears the trash marks, logs it, and the row is live again", async () => {
		const w = await world(SEEDS);
		insertMedia(w.raw, { id: "m1", deletedAt: "2026-04-01T00:00:00.000Z", deletedBy: "admin", title: "Lễ" });
		const editor = await w.as("editor@example.test");
		const done = await editor.call("POST", "trash/media/m1/restore", {});
		expect(done.status).toBe(200);
		expect(done.data).toMatchObject({ type: "media", id: "m1", title: "Lễ" });
		expect(w.raw.prepare("SELECT deleted_at, deleted_by FROM media WHERE id = 'm1'").get()).toEqual({ deleted_at: null, deleted_by: null });
		expect(w.raw.prepare("SELECT user_email, entity_type, entity_id FROM audit_log WHERE action = 'trash.restore'").get()).toEqual({ user_email: "editor@example.test", entity_type: "media", entity_id: "m1" });
		expect((await editor.call("GET", "trash")).data).toEqual([]);
	});

	it("restores a role, which has no deleted_by column", async () => {
		const w = await world(SEEDS);
		w.raw.prepare("UPDATE role SET deleted_at = '2026-04-02T00:00:00.000Z' WHERE id = 'role-author'").run();
		// roles.update is needed on top of trash.update, so a Super Admin does it (an Editor is refused: see permissions.test.ts)
		const editor = await w.as("root@example.test");
		expect((await editor.call("POST", "trash/role/role-author/restore", {})).status).toBe(200);
		expect(w.raw.prepare("SELECT deleted_at FROM role WHERE id = 'role-author'").get()).toEqual({ deleted_at: null });
	});

	it("answers 404 for unknown kinds and rows, 409 for a row that is not in the trash", async () => {
		const w = await world(SEEDS);
		insertMedia(w.raw, { id: "live" });
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", "trash/khong-co/x/restore", {})).status).toBe(404);
		expect((await editor.call("POST", "trash/media/khong-co/restore", {})).status).toBe(404);
		const live = await editor.call("POST", "trash/media/live/restore", {});
		expect(live.status).toBe(409);
		expect(live.error.code).toBe("not_in_trash");
	});

	it("refuses with 409 slug_taken when another live row has taken the address", async () => {
		const w = await world(SEEDS);
		w.raw.prepare("INSERT INTO page (id, slug, title, deleted_at, deleted_by) VALUES ('old', 'gioi-thieu', 'Cũ', '2026-04-01', 'admin')").run();
		w.raw.prepare("INSERT INTO page (id, slug, title) VALUES ('new', 'gioi-thieu', 'Mới')").run();
		const editor = await w.as("editor@example.test");
		const refused = await editor.call("POST", "trash/test_page/old/restore", {});
		expect(refused.status).toBe(409);
		expect(refused.error.code).toBe("slug_taken");
		expect(refused.error.message).toContain("đường dẫn");
		expect(w.raw.prepare("SELECT deleted_at FROM page WHERE id = 'old'").get()).toEqual({ deleted_at: "2026-04-01" });
		expect(count(w.raw, "audit_log", "action = 'trash.restore'")).toBe(0);
		// once the other one is renamed, it works
		w.raw.prepare("UPDATE page SET slug = 'gioi-thieu-2' WHERE id = 'new'").run();
		expect((await editor.call("POST", "trash/test_page/old/restore", {})).status).toBe(200);
	});

	it("lets an Author restore only their own pictures", async () => {
		const w = await world(SEEDS);
		insertMedia(w.raw, { id: "mine", uploadedBy: "author", deletedAt: "2026-04-01T00:00:00.000Z" });
		insertMedia(w.raw, { id: "theirs", uploadedBy: "author2", deletedAt: "2026-04-01T00:00:00.000Z" });
		const author = await w.as("author@example.test");
		// trash.update is not in the Author's role at all
		expect((await author.call("POST", "trash/media/mine/restore", {})).status).toBe(403);
		expect((await author.call("POST", "trash/media/theirs/restore", {})).status).toBe(403);
		// give them trash.update:own and the difference shows
		w.raw.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES ('role-author', 'trash', 'update', 'own')").run();
		const again = await w.as("author@example.test");
		expect((await again.call("POST", "trash/media/theirs/restore", {})).status).toBe(403);
		expect((await again.call("POST", "trash/media/mine/restore", {})).status).toBe(200);
		expect(w.raw.prepare("SELECT deleted_at FROM media WHERE id = 'theirs'").get()).toEqual({ deleted_at: "2026-04-01T00:00:00.000Z" });
	});
});

describe("trash: removing for good", () => {
	it("deletes the row, what hangs off it, and the library's files, and logs it", async () => {
		const w = await world(SEEDS);
		insertMedia(w.raw, { id: "m1", deletedAt: "2026-04-01T00:00:00.000Z", deletedBy: "admin", title: "Lễ" });
		w.raw.prepare("INSERT INTO media_usage (media_id, entity_type, entity_id, field) VALUES ('m1', 'post', 'gone', 'thumbnail')").run();
		w.raw.prepare("INSERT INTO media_crop (media_id, ratio, x, y, width, height, r2_key) VALUES ('m1', '16:9', 0, 0, 100, 56, 'cms/m1/v1/crop.png')").run();
		w.files.set("cms/m1/v1/m1.png", { type: "image/png", bytes: new Uint8Array(3) });
		w.files.set("cms/m1/v1/crop.png", { type: "image/png", bytes: new Uint8Array(3) });
		w.files.set("cms/other/v1/other.png", { type: "image/png", bytes: new Uint8Array(3) });
		const admin = await w.as("admin@example.test");
		const done = await admin.call("DELETE", "trash/media/m1");
		expect(done.status).toBe(204);
		expect(count(w.raw, "media", "id = 'm1'")).toBe(0);
		expect(count(w.raw, "media_usage", "media_id = 'm1'")).toBe(0);
		expect(count(w.raw, "media_crop", "media_id = 'm1'")).toBe(0);
		expect([...w.files.keys()]).toEqual(["cms/other/v1/other.png"]);
		expect(w.raw.prepare("SELECT entity_id, data_before FROM audit_log WHERE action = 'trash.purge'").get()).toMatchObject({ entity_id: "m1" });
	});

	it("is for people with trash.delete (an Editor has not), and never touches a row still in use", async () => {
		const w = await world(SEEDS);
		insertMedia(w.raw, { id: "m1", deletedAt: "2026-04-01T00:00:00.000Z" });
		const editor = await w.as("editor@example.test");
		expect((await editor.call("DELETE", "trash/media/m1")).status).toBe(403);
		expect(count(w.raw, "media", "id = 'm1'")).toBe(1);
		// a post still points at the picture: refused, everything stays
		w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date, thumbnail_media_id) VALUES ('p1', 's', 'Bài', 'dong-chay-hoang-phap', '2026-01-01', 'm1')").run();
		w.raw.prepare("INSERT INTO media_usage (media_id, entity_type, entity_id, field) VALUES ('m1', 'post', 'p1', 'thumbnail')").run();
		w.files.set("cms/m1/v1/m1.png", { type: "image/png", bytes: new Uint8Array(3) });
		const admin = await w.as("admin@example.test");
		const refused = await admin.call("DELETE", "trash/media/m1");
		expect(refused.status).toBe(409);
		expect(refused.error.code).toBe("in_use");
		expect(count(w.raw, "media", "id = 'm1'")).toBe(1);
		expect(count(w.raw, "media_usage", "media_id = 'm1'")).toBe(1);
		expect(w.files.has("cms/m1/v1/m1.png")).toBe(true);
	});

	it("keeps an account that the log still names, with its sessions, all in one piece", async () => {
		const w = await world(SEEDS);
		// removing an account for good needs users.delete, which only a Super Admin has
		const admin = await w.as("root@example.test");
		w.raw.prepare("UPDATE user SET deleted_at = '2026-04-01T00:00:00.000Z', deleted_by = 'admin' WHERE id = 'author2'").run();
		insertAudit(w.raw, { userId: "author2", email: "author2@example.test", at: "2026-03-01T00:00:00.000Z" });
		w.raw.prepare("INSERT INTO session (id, user_id, created_at, last_used_at, expires_at) VALUES ('s1', 'author2', 'a', 'a', '2099')").run();
		const refused = await admin.call("DELETE", "trash/user/author2");
		expect(refused.status).toBe(409);
		expect(count(w.raw, "user", "id = 'author2'")).toBe(1);
		expect(count(w.raw, "session", "user_id = 'author2'")).toBe(1);
	});

	it("removes a role nobody uses, and refuses a row that is not in the trash", async () => {
		const w = await world(SEEDS);
		w.raw.prepare("INSERT INTO role (id, name, is_system, deleted_at) VALUES ('r-x', 'Tạm', 0, '2026-04-01')").run();
		w.raw.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES ('r-x', 'posts', 'view', 'all')").run();
		// roles.delete is a Super Admin's alone
		const admin = await w.as("root@example.test");
		expect((await admin.call("DELETE", "trash/role/r-x")).status).toBe(204);
		expect(count(w.raw, "role", "id = 'r-x'")).toBe(0);
		expect(count(w.raw, "role_permission", "role_id = 'r-x'")).toBe(0);
		const live = await admin.call("DELETE", "trash/role/role-editor");
		expect(live.status).toBe(409);
		expect(live.error.code).toBe("not_in_trash");
		expect((await admin.call("DELETE", "trash/role/khong-co")).status).toBe(404);
		expect((await admin.call("DELETE", "trash/khong-co/x")).status).toBe(404);
	});
});
