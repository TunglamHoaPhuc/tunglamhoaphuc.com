import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { exportStream } from "../../../src/admin/ops/backup";
import { applyMigrations, openDatabase } from "../../../src/db/nodeSqlite";
import { parseBackupFile, restoreBackup } from "../../../scripts/restore-backup";
import { PASSWORD, world } from "../helpers/adminWorld";
import { count, fakeBucket, insertAudit, insertMedia, parseBackup, SEEDS } from "../helpers/ops";

type World = Awaited<ReturnType<typeof world>>;

/** Some content of every sort the backup must carry or leave out. */
function fill(w: World) {
	insertMedia(w.raw, { id: "m1", uploadedBy: "editor", title: "Lễ Hằng Thuận" });
	w.raw.prepare("INSERT INTO post (id, slug, title, section, published_date, content_html) VALUES ('p1', 'bai-1', 'Bài một – ạ', 'dong-chay-hoang-phap', '2026-01-01', '<p>Nội dung</p>')").run();
	w.raw.prepare("INSERT INTO redirect (from_path, to_path, code) VALUES ('/cu', '/moi', 301)").run();
	w.raw.prepare("INSERT INTO setting (key, value) VALUES ('site.info', '{\"name\":\"Tùng Lâm\"}')").run();
	w.raw.prepare("INSERT INTO user_totp (user_id, secret_enc, enabled_at) VALUES ('editor', 'v1.bi-mat.bi-mat', '2026')").run();
	w.raw.prepare("INSERT INTO password_reset (id, user_id, token_hash, created_at, expires_at) VALUES ('pr1', 'editor', 'tokenhash', 'a', 'b')").run();
	w.raw.prepare("INSERT INTO auth_throttle (key, window_start, count) VALUES ('login:x', 'a', 3)").run();
	w.raw.prepare("INSERT INTO calendar_event (id, slug, title, start_date, end_date) VALUES ('e1', 'khoa-tu', 'Khóa tu', '2099-01-01', '2099-01-03')").run();
	w.raw.prepare("INSERT INTO registration (code, event_id, full_name, phone, created_at) VALUES ('R1', 'e1', 'Nguyễn Văn A', '0900000000', '2026')").run();
}

describe("backup export", () => {
	it("needs the person's own password again, and slows down guessing", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		const wrong = await root.call("POST", "backup/export", { password: "sai-mat-khau-roi" });
		expect(wrong.status).toBe(400);
		expect(wrong.error.code).toBe("wrong_password");
		expect(wrong.error.fields.password).toBeTruthy();
		expect((await root.call("POST", "backup/export", {})).status).toBe(400);
		for (let i = 0; i < 4; i++) await root.call("POST", "backup/export", { password: "sai-mat-khau-roi" });
		// five wrong guesses: even the right password has to wait
		const locked = await root.call("POST", "backup/export", { password: PASSWORD });
		expect(locked.status).toBe(429);
		expect(count(w.raw, "audit_log", "action = 'backup.export'")).toBe(0);
	});

	it("is for the Super Admin: Admin, Editor and Author get 403 before their password is even looked at", async () => {
		const w = await world(SEEDS);
		for (const who of ["admin", "editor", "author"]) {
			const client = await w.as(`${who}@example.test`);
			expect((await client.call("POST", "backup/export", { password: PASSWORD })).status, who).toBe(403);
			expect((await client.call("POST", "backup/run", {})).status, who).toBe(403);
			expect((await client.call("GET", "backup")).status, who).toBe(403);
			expect((await client.call("POST", "backup/2026-01-01-0000.json.gz/download", { password: PASSWORD })).status, who).toBe(403);
			// the old plain link is gone: nobody downloads a stored file by address alone
			expect((await client.call("GET", "backup/2026-01-01-0000.json.gz/download")).status, who).toBeGreaterThanOrEqual(403);
		}
	});

	it("returns one gzip JSON file with every table but the secret ones, and no password hash anywhere", async () => {
		const w = await world(SEEDS);
		fill(w);
		const root = await w.as("root@example.test");
		const { dispatchRaw } = await rawExport(w, root);
		expect(dispatchRaw.status).toBe(200);
		expect(dispatchRaw.headers.get("content-type")).toBe("application/gzip");
		expect(dispatchRaw.headers.get("content-disposition")).toMatch(/^attachment; filename="tlhp-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json\.gz"$/);
		expect(dispatchRaw.headers.get("cache-control")).toBe("no-store");
		const bytes = new Uint8Array(await dispatchRaw.arrayBuffer());
		expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
		const file = parseBackup(bytes);
		expect(file).toMatchObject({ format: "tlhp-backup", version: 1 });
		for (const table of ["session", "password_reset", "auth_throttle", "user_totp", "registration"]) expect(file.tables[table], table).toBeUndefined();
		for (const table of ["user", "role", "role_permission", "post", "media", "redirect", "setting", "audit_log", "calendar_event", "revision", "menu_item"]) expect(file.tables[table], table).toBeDefined();
		// every saved table has all its rows, in all its saved columns
		for (const [name, table] of Object.entries(file.tables)) expect(table.rows.length, name).toBe(count(w.raw, name));
		expect(file.tables.user.columns).not.toContain("password_hash");
		const text = JSON.stringify(file);
		expect(text).not.toContain("$argon2id");
		expect(text).not.toContain("tokenhash");
		expect(text).not.toContain("bi-mat");
		expect(text).not.toContain("Nguyễn Văn A");
		// text survives as UTF-8
		const posts = file.tables.post;
		expect(posts.rows[0][posts.columns.indexOf("title")]).toBe("Bài một – ạ");
		expect(count(w.raw, "audit_log", "action = 'backup.export'")).toBe(1);
	});

	it("leaves the sealed mail password out of the saved settings", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		await root.call("PUT", "settings/smtp", { host: "smtp.example.test", port: 587, username: "a@b.test", password: "Mat-khau-thu-bi-mat-9", fromName: "X", fromEmail: "a@b.test" });
		const { dispatchRaw } = await rawExport(w, root);
		const file = parseBackup(new Uint8Array(await dispatchRaw.arrayBuffer()));
		const settings = file.tables.setting;
		const row = settings.rows.find((r) => r[settings.columns.indexOf("key")] === "mail.smtp")!;
		const value = JSON.parse(row[settings.columns.indexOf("value")] as string);
		expect(value.host).toBe("smtp.example.test");
		expect(value.passwordEnc).toBeUndefined();
		expect(JSON.stringify(file)).not.toContain("v1.");
	});

	it("reads big tables a page at a time, so no query asks for more than 500 rows", async () => {
		const w = await world(SEEDS);
		for (let i = 0; i < 1100; i++) insertAudit(w.raw, { at: `2026-05-01T00:00:${String(i % 60).padStart(2, "0")}.${String(i).padStart(3, "0")}Z`, entityId: `n${i}` });
		for (let i = 0; i < 1200; i++) w.raw.prepare("INSERT INTO setting (key, value) VALUES (?, '1')").run(`k${i}`);
		const limits: number[] = [];
		const spy = { prepare: (sql: string) => {
			const statement = w.db.prepare(sql);
			return { ...statement, bind: (...values: unknown[]) => { if (/ LIMIT \?/.test(sql)) limits.push(Number(values[values.length - 1])); return statement.bind(...values); } } as typeof statement;
		}, batch: w.db.batch };
		const stream = exportStream(spy as never, new Date("2026-06-01T00:00:00Z"));
		const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
		const file = parseBackup(bytes);
		expect(file.tables.audit_log.rows).toHaveLength(count(w.raw, "audit_log"));
		expect(file.tables.setting.rows).toHaveLength(1200);
		expect(Math.max(...limits)).toBeLessThanOrEqual(500);
		expect(limits.filter((n) => n === 500).length).toBeGreaterThanOrEqual(2);
		// each row once, in order, none lost at the page edges
		const ids = file.tables.audit_log.rows.map((r) => r[file.tables.audit_log.columns.indexOf("id")] as number);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toEqual([...ids].sort((a, b) => a - b));
	});
});

/** The raw Response of an export, for headers and bytes (the client helper reads text). */
async function rawExport(w: World, root: Awaited<ReturnType<World["as"]>>) {
	const { dispatch } = await import("../../../src/admin/http/api");
	const jar = [...root.jar].map(([name, value]) => `${name}=${value}`).join("; ");
	const me = await root.call("GET", "auth/me");
	const dispatchRaw = await dispatch(
		new Request("https://www.example.test/api/quan-tri/v1/backup/export", { method: "POST", headers: { origin: "https://www.example.test", cookie: jar, "content-type": "application/json", "x-tlhp-csrf": me.data.csrfToken }, body: JSON.stringify({ password: PASSWORD }) }),
		"backup/export",
		w.deps,
	);
	return { dispatchRaw };
}

describe("backups kept in R2", () => {
	it("says so when there is no bucket, and answers an empty list", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "backup")).data).toEqual({ configured: false, backups: [] });
		const run = await root.call("POST", "backup/run", {});
		expect(run.status).toBe(503);
		expect(run.error.code).toBe("no_backup_bucket");
		expect((await root.call("POST", "backup/2026-01-01-0000.json.gz/download", { password: PASSWORD })).status).toBe(503);
	});

	it("writes backup/<date>-<time>.json.gz and keeps the newest 30", async () => {
		const w = await world(SEEDS);
		fill(w);
		const { bucket, objects } = fakeBucket();
		w.deps.backup = bucket;
		for (let i = 1; i <= 33; i++) objects.set(`backup/2025-01-${String(i).padStart(2, "0")}-0300.json.gz`, { bytes: new Uint8Array([1]), uploaded: new Date(Date.UTC(2025, 0, i)) });
		objects.set("backup/notes.txt", { bytes: new Uint8Array([1]), uploaded: new Date() });
		const root = await w.as("root@example.test");
		const run = await root.call("POST", "backup/run", {});
		expect(run.status).toBe(200);
		expect(run.data.name).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}\.json\.gz$/);
		expect(run.data.removed).toBe(4);
		const names = [...objects.keys()].filter((key) => /\.json\.gz$/.test(key));
		expect(names).toHaveLength(30);
		expect(names).toContain(`backup/${run.data.name}`);
		expect(names).not.toContain("backup/2025-01-01-0300.json.gz");
		expect(names).not.toContain("backup/2025-01-04-0300.json.gz");
		expect(names).toContain("backup/2025-01-05-0300.json.gz");
		expect(objects.has("backup/notes.txt")).toBe(true);
		// what was written is a real backup
		const stored = parseBackup(objects.get(`backup/${run.data.name}`)!.bytes);
		expect(stored.tables.post.rows).toHaveLength(1);
		expect(stored.tables.session).toBeUndefined();
		expect(count(w.raw, "audit_log", "action = 'backup.run' AND entity_id = ?".replace("?", `'${run.data.name}'`))).toBe(1);
	});

	it("lists the stored backups newest first and streams one for download", async () => {
		const w = await world(SEEDS);
		const { bucket, objects } = fakeBucket();
		w.deps.backup = bucket;
		const payload = gzipSync(Buffer.from('{"x":1}'));
		objects.set("backup/2026-02-01-0300.json.gz", { bytes: new Uint8Array(payload), uploaded: new Date("2026-02-01T03:00:00Z") });
		objects.set("backup/2026-02-02-0300.json.gz", { bytes: new Uint8Array([1, 2, 3]), uploaded: new Date("2026-02-02T03:00:00Z") });
		const root = await w.as("root@example.test");
		const list = await root.call("GET", "backup");
		expect(list.data.configured).toBe(true);
		expect(list.data.backups.map((b: { name: string }) => b.name)).toEqual(["2026-02-02-0300.json.gz", "2026-02-01-0300.json.gz"]);
		expect(list.data.backups[1]).toMatchObject({ size: payload.length, createdAt: "2026-02-01T03:00:00.000Z" });
		const { dispatch } = await import("../../../src/admin/http/api");
		const jar = [...root.jar].map(([name, value]) => `${name}=${value}`).join("; ");
		const me = await root.call("GET", "auth/me");
		const ask = (password: string) =>
			dispatch(
				new Request("https://www.example.test/api/quan-tri/v1/backup/2026-02-01-0300.json.gz/download", { method: "POST", headers: { origin: "https://www.example.test", cookie: jar, "content-type": "application/json", "x-tlhp-csrf": me.data.csrfToken }, body: JSON.stringify({ password }) }),
				"backup/2026-02-01-0300.json.gz/download",
				w.deps,
			);
		const wrong = await ask("sai-mat-khau-roi");
		expect(wrong.status).toBe(400);
		expect(count(w.raw, "audit_log", "action = 'backup.download'"), "a wrong password downloads and logs nothing").toBe(0);
		const response = await ask(PASSWORD);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-disposition")).toContain("tlhp-backup-2026-02-01-0300.json.gz");
		expect(Buffer.from(await response.arrayBuffer()).equals(payload)).toBe(true);
		expect(count(w.raw, "audit_log", "action = 'backup.download'")).toBe(1);
	});

	it("takes only plain backup names, and answers 404 for one that is not there", async () => {
		const w = await world(SEEDS);
		const { bucket, objects } = fakeBucket();
		w.deps.backup = bucket;
		objects.set("backup/secret.txt", { bytes: new Uint8Array([1]), uploaded: new Date() });
		const root = await w.as("root@example.test");
		for (const name of ["..%2Fsecret.txt", "secret.txt", "2026-02-01.json", "a.json.gz", "2026-02-01-0300.json.gz.txt", "%2E%2E%2Fbackup%2Fsecret.txt"]) {
			expect((await root.call("POST", `backup/${name}/download`, { password: PASSWORD })).status, name).toBe(404);
		}
		expect((await root.call("POST", "backup/2026-02-01-0300.json.gz/download", { password: PASSWORD })).status).toBe(404);
	});
});

describe("restoring from a backup", () => {
	it("loads an export into a fresh database with the same rows (secrets excepted)", async () => {
		const w = await world(SEEDS);
		fill(w);
		insertAudit(w.raw, { userId: "editor", email: "editor@example.test", at: "2026-05-01T00:00:00.000Z", after: { title: "Tiêu đề" } });
		const bytes = new Uint8Array(await new Response(exportStream(w.db, new Date("2026-06-01T00:00:00Z"))).arrayBuffer());
		const backup = parseBackupFile(bytes);

		const fresh = openDatabase();
		applyMigrations(fresh);
		const report = restoreBackup(fresh, backup);
		for (const [table, rows] of Object.entries(report.tables)) {
			expect((fresh.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n, table).toBe(rows);
			expect(rows, table).toBe(count(w.raw, table));
		}
		expect(Object.keys(report.tables)).toContain("audit_log");
		expect(report.warnings).toEqual([]);
		// content came back as it was, accounts without their password
		expect(fresh.prepare("SELECT title, content_html FROM post WHERE id = 'p1'").get()).toEqual({ title: "Bài một – ạ", content_html: "<p>Nội dung</p>" });
		expect(fresh.prepare("SELECT to_path FROM redirect WHERE from_path = '/cu'").get()).toEqual({ to_path: "/moi" });
		expect(fresh.prepare("SELECT COUNT(*) AS n FROM user WHERE password_hash IS NOT NULL").get()).toEqual({ n: 0 });
		expect(fresh.prepare("SELECT COUNT(*) AS n FROM user").get()).toEqual({ n: SEEDS.length });
		expect(fresh.prepare("SELECT COUNT(*) AS n FROM session").get()).toEqual({ n: 0 });
		expect(fresh.prepare("SELECT COUNT(*) AS n FROM registration").get()).toEqual({ n: 0 });
		// the log is still append only after a restore, and new rows continue its numbering
		expect(() => fresh.prepare("DELETE FROM audit_log").run()).toThrow(/append-only/);
		const last = (w.raw.prepare("SELECT MAX(id) AS id FROM audit_log").get() as { id: number }).id;
		fresh.prepare("INSERT INTO audit_log (action, entity_type, entity_id, created_at) VALUES ('x', 'y', 'z', 'now')").run();
		expect((fresh.prepare("SELECT MAX(id) AS id FROM audit_log").get() as { id: number }).id).toBe(last + 1);
		fresh.close();
	});

	it("refuses to load over data that is already there, and changes nothing when it fails", async () => {
		const w = await world(SEEDS);
		const backup = parseBackupFile(new Uint8Array(await new Response(exportStream(w.db, new Date())).arrayBuffer()));
		const target = openDatabase();
		applyMigrations(target);
		target.prepare("INSERT INTO user (id, email, created_at) VALUES ('u', 'u@example.test', '2026')").run();
		expect(() => restoreBackup(target, backup)).toThrow(/đã có dữ liệu/);
		expect(target.prepare("SELECT COUNT(*) AS n FROM user").get()).toEqual({ n: 1 });
		expect(target.prepare("SELECT COUNT(*) AS n FROM menu").get()).toEqual({ n: 3 });
		expect(() => parseBackupFile(new Uint8Array(gzipSync(Buffer.from('{"format":"khac"}'))))).toThrow(/không phải tệp sao lưu/);
		target.close();
	});
});
