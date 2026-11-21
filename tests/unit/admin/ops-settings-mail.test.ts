import { describe, expect, it } from "vitest";
import { decryptSecret } from "../../../src/admin/crypto";
import { classify, createSmtpMailer, hostProblem, MailError, type SmtpConfig, type SmtpEnvelope } from "../../../src/admin/mail/smtp";
import { readPolicy } from "../../../src/admin/ops/settings";
import { world } from "../helpers/adminWorld";
import { count, SEEDS } from "../helpers/ops";

const KEY = Buffer.alloc(32, 3).toString("base64");
const SMTP = { host: "smtp.example.test", port: 587, username: "thu@example.test", password: "Mat-khau-thu-bi-mat-9", fromName: "Tùng Lâm Hòa Phúc", fromEmail: "thu@example.test" };
const SITE = {
	name: "Tùng Lâm Hòa Phúc",
	slogan: "Nơi để trở về",
	address: "Phú Cát, Hà Nội",
	phones: [{ role: "Thư ký", name: "Liên Vi", phone: "0961.533.271" }],
	openingHours: "6h – 18h",
	mapsUrl: "https://maps.google.com/?q=x",
	social: [{ label: "Facebook", url: "https://facebook.com/tunglamhoaphuc" }],
	announcement: { text: "Khóa tu mùa xuân", link: { label: "Xem", href: "/lich-tu-hoc" }, expires: "2027-03-01", active: true },
};

const allAudit = (w: Awaited<ReturnType<typeof world>>) => JSON.stringify(w.raw.prepare("SELECT * FROM audit_log").all());

describe("site info settings", () => {
	it("starts empty, saves the details and the notice, and logs it", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("GET", "settings/site-info")).data).toMatchObject({ name: "", phones: [], social: [], announcement: { active: false } });
		const saved = await admin.call("PUT", "settings/site-info", SITE);
		expect(saved.status).toBe(200);
		expect(saved.data.phones).toEqual([{ role: "Thư ký", name: "Liên Vi", phone: "0961533271" }]);
		expect(saved.data.announcement).toMatchObject({ text: "Khóa tu mùa xuân", active: true, expires: "2027-03-01" });
		expect(saved.data.announcement.id).toMatch(/^tb-/);
		const info = JSON.parse((w.raw.prepare("SELECT value FROM setting WHERE key = 'site.info'").get() as { value: string }).value);
		expect(info).toMatchObject({ name: "Tùng Lâm Hòa Phúc", mapsUrl: "https://maps.google.com/?q=x" });
		expect(info.announcement).toBeUndefined();
		expect(JSON.parse((w.raw.prepare("SELECT value FROM setting WHERE key = 'site.announcement'").get() as { value: string }).value)).toMatchObject({ text: "Khóa tu mùa xuân", link: { href: "/lich-tu-hoc" } });
		expect(count(w.raw, "audit_log", "action = 'settings.site_info_update' AND user_email = 'admin@example.test'")).toBe(1);
		// a new text is a new notice id, so people who closed the old one see it again
		const again = await admin.call("PUT", "settings/site-info", { ...SITE, announcement: { ...SITE.announcement, text: "Đại lễ" } });
		expect(again.data.announcement.id).not.toBe(saved.data.announcement.id);
	});

	it("refuses links that are not https, bad phone numbers and a missing name", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		const put = (patch: object) => admin.call("PUT", "settings/site-info", { ...SITE, ...patch });
		expect((await put({ name: "" })).error.fields.name).toBeTruthy();
		expect((await put({ mapsUrl: "javascript:alert(1)" })).error.fields.mapsUrl).toContain("https://");
		expect((await put({ social: [{ label: "Fb", url: "http://facebook.com/x" }] })).status).toBe(400);
		expect((await put({ phones: [{ role: "Thư ký", name: "A", phone: "abc" }] })).status).toBe(400);
		expect((await put({ announcement: { ...SITE.announcement, link: { label: "x", href: "//evil.test" } } })).status).toBe(400);
		expect((await put({ announcement: { ...SITE.announcement, expires: "mai" } })).status).toBe(400);
		expect((await put({ announcement: { ...SITE.announcement, text: "x".repeat(301) } })).status).toBe(400);
		expect(count(w.raw, "setting")).toBe(0);
	});

	it("is for Super Admin and Admin; an Editor and an Author have no settings rights", async () => {
		const w = await world(SEEDS);
		for (const who of ["editor", "author"]) {
			const client = await w.as(`${who}@example.test`);
			expect((await client.call("GET", "settings/site-info")).status).toBe(403);
			expect((await client.call("PUT", "settings/site-info", SITE)).status).toBe(403);
		}
		expect((await (await w.as("root@example.test")).call("PUT", "settings/site-info", SITE)).status).toBe(200);
		expect((await (await w.as("admin@example.test")).call("GET", "settings/nhom-la")).status).toBe(404);
	});
});

describe("security policy", () => {
	it("is the Super Admin's alone, even for an Admin who holds settings rights", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("GET", "settings/security")).status).toBe(403);
		expect((await admin.call("PUT", "settings/security", { minPasswordLength: 12, sessionDays: 7, failedLogins: 5 })).status).toBe(403);
		expect((await admin.call("GET", "settings/smtp")).status).toBe(403);
		expect(count(w.raw, "setting")).toBe(0);
	});

	it("keeps the minimum password length at 10 or more, in the form and in code", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "settings/security")).data).toMatchObject({ minPasswordLength: 10, sessionDays: 30, failedLogins: 5, floor: 10 });
		const low = await root.call("PUT", "settings/security", { minPasswordLength: 9, sessionDays: 7, failedLogins: 5 });
		expect(low.status).toBe(400);
		expect(low.error.fields.minPasswordLength).toContain("10");
		for (const bad of [{ sessionDays: 0 }, { sessionDays: 31 }, { failedLogins: 2 }, { failedLogins: 21 }, { minPasswordLength: 10.5 }, { minPasswordLength: 65 }]) {
			expect((await root.call("PUT", "settings/security", { minPasswordLength: 12, sessionDays: 7, failedLogins: 5, ...bad })).status, JSON.stringify(bad)).toBe(400);
		}
		const ok = await root.call("PUT", "settings/security", { minPasswordLength: 14, sessionDays: 7, failedLogins: 4 });
		expect(ok.data).toMatchObject({ minPasswordLength: 14, sessionDays: 7, failedLogins: 4 });
		expect(count(w.raw, "audit_log", "action = 'settings.security_update'")).toBe(1);
		// a row someone put straight into the database below the floor is lifted to it when read
		w.raw.prepare("UPDATE setting SET value = '{\"minPasswordLength\":4}' WHERE key = 'security.policy'").run();
		expect(await readPolicy({ db: w.db })).toMatchObject({ minPasswordLength: 10, sessionDays: 30 });
	});
});

describe("mail server settings", () => {
	it("keeps the password sealed, never returns it, and keeps it when an update leaves it out", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		const saved = await root.call("PUT", "settings/smtp", SMTP);
		expect(saved.status).toBe(200);
		expect(saved.data).toMatchObject({ host: "smtp.example.test", port: 587, secure: false, username: "thu@example.test", passwordSet: true, fromName: "Tùng Lâm Hòa Phúc", configured: true });
		expect(JSON.stringify(saved.json)).not.toContain(SMTP.password);
		const stored = JSON.parse((w.raw.prepare("SELECT value FROM setting WHERE key = 'mail.smtp'").get() as { value: string }).value);
		expect(stored.passwordEnc).toMatch(/^v1\./);
		expect(stored.passwordEnc).not.toContain(SMTP.password);
		expect(await decryptSecret(stored.passwordEnc, KEY)).toBe(SMTP.password);
		const read = await root.call("GET", "settings/smtp");
		expect(JSON.stringify(read.json)).not.toContain(SMTP.password);
		expect(JSON.stringify(read.json)).not.toContain("passwordEnc");
		expect(read.data.passwordSet).toBe(true);
		// the sender changes, the password stays
		const { password, ...withoutPassword } = SMTP;
		void password;
		const kept = await root.call("PUT", "settings/smtp", { ...withoutPassword, fromName: "Ban Truyền Thông" });
		expect(kept.status).toBe(200);
		const after = JSON.parse((w.raw.prepare("SELECT value FROM setting WHERE key = 'mail.smtp'").get() as { value: string }).value);
		expect(after.passwordEnc).toBe(stored.passwordEnc);
		expect(after.fromName).toBe("Ban Truyền Thông");
		expect((await root.call("PUT", "settings/smtp", { ...withoutPassword, password: "" })).status).toBe(200);
	});

	it("asks for the password again when the server, the port or the account changes", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		await root.call("PUT", "settings/smtp", SMTP);
		const { password, ...rest } = SMTP;
		void password;
		for (const change of [{ host: "smtp.khac.test" }, { port: 465 }, { username: "khac@example.test" }]) {
			const refused = await root.call("PUT", "settings/smtp", { ...rest, ...change });
			expect(refused.status, JSON.stringify(change)).toBe(400);
			expect(refused.error.fields.password).toContain("Nhập lại mật khẩu");
		}
		expect(JSON.parse((w.raw.prepare("SELECT value FROM setting WHERE key = 'mail.smtp'").get() as { value: string }).value).host).toBe("smtp.example.test");
		const moved = await root.call("PUT", "settings/smtp", { ...rest, host: "smtp.khac.test", password: "Mat-khau-moi-123" });
		expect(moved.status).toBe(200);
		expect(await decryptSecret(JSON.parse((w.raw.prepare("SELECT value FROM setting WHERE key = 'mail.smtp'").get() as { value: string }).value).passwordEnc, KEY)).toBe("Mat-khau-moi-123");
		// port 465 means TLS from the start
		expect((await root.call("PUT", "settings/smtp", { ...rest, host: "smtp.khac.test", port: 465, password: "Mat-khau-moi-123" })).data).toMatchObject({ port: 465, secure: true });
		// a first setup with an account needs its password
		const fresh = await world(SEEDS);
		const first = await (await fresh.as("root@example.test")).call("PUT", "settings/smtp", rest);
		expect(first.status).toBe(400);
		expect(first.error.fields.password).toBeTruthy();
	});

	it("refuses other ports, internal hosts and a bad sender", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		expect((await root.call("PUT", "settings/smtp", { ...SMTP, port: 25 })).error.fields.port).toContain("465");
		expect((await root.call("PUT", "settings/smtp", { ...SMTP, port: 2525 })).status).toBe(400);
		for (const host of ["localhost", "127.0.0.1", "10.0.0.5", "192.168.1.10", "169.254.169.254", "172.16.0.1", "[::1]", "fd00::1", "fe80::1", "mail.internal", "may-chu", "2130706433", "0x7f.0.0.1", "0.0.0.0"]) {
			const refused = await root.call("PUT", "settings/smtp", { ...SMTP, host });
			expect(refused.status, host).toBe(400);
			expect(refused.error.fields.host, host).toBeTruthy();
		}
		expect((await root.call("PUT", "settings/smtp", { ...SMTP, fromEmail: "khong-phai-email" })).error.fields.fromEmail).toBeTruthy();
		expect((await root.call("PUT", "settings/smtp", { ...SMTP, fromEmail: "a@b.test\r\nBcc: x@y.test" })).status).toBe(400);
		expect((await root.call("PUT", "settings/smtp", { ...SMTP, fromName: 'Tên"\r\nBcc: x' })).status).toBe(400);
		expect(count(w.raw, "setting", "key = 'mail.smtp'")).toBe(0);
	});

	it("puts no password, in clear or sealed, anywhere in the activity log", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		await root.call("PUT", "settings/smtp", SMTP);
		await root.call("PUT", "settings/smtp", { ...SMTP, password: "Mat-khau-moi-123", fromName: "Khác" });
		const sealed = JSON.parse((w.raw.prepare("SELECT value FROM setting WHERE key = 'mail.smtp'").get() as { value: string }).value).passwordEnc as string;
		const log = allAudit(w);
		expect(count(w.raw, "audit_log", "action = 'settings.smtp_update'")).toBe(2);
		for (const secret of [SMTP.password, "Mat-khau-moi-123", sealed, sealed.split(".")[2]]) expect(log).not.toContain(secret);
		expect(log).toContain("smtp.example.test");
	});

	it("sends a test mail to the person's own address and says plainly when it fails", async () => {
		const w = await world(SEEDS);
		const root = await w.as("root@example.test");
		const ok = await root.call("POST", "settings/smtp/test", {});
		expect(ok.status).toBe(200);
		expect(ok.data).toEqual({ ok: true, to: "root@example.test" });
		expect(w.mails).toHaveLength(1);
		expect(w.mails[0]).toMatchObject({ to: "root@example.test", subject: "Thư thử từ trang quản trị Tùng Lâm Hòa Phúc" });
		expect(count(w.raw, "audit_log", "action = 'settings.smtp_test'")).toBe(1);

		w.deps.mailer = async () => {
			throw new Error("535 5.7.8 Authentication failed for thu@example.test from 10.1.2.3: bad password hunter2");
		};
		const bad = await root.call("POST", "settings/smtp/test", {});
		expect(bad.status).toBe(502);
		expect(bad.error.code).toBe("mail_failed");
		expect(JSON.stringify(bad.json)).not.toMatch(/535|hunter2|10\.1\.2\.3/);
		w.deps.mailer = async () => {
			throw new MailError("auth", "Sai tài khoản hoặc mật khẩu thư.");
		};
		expect((await root.call("POST", "settings/smtp/test", {})).error.message).toBe("Sai tài khoản hoặc mật khẩu thư.");
	});

	it("limits test mails to five in ten minutes and is for the Super Admin alone", async () => {
		const w = await world(SEEDS);
		const admin = await w.as("admin@example.test");
		expect((await admin.call("POST", "settings/smtp/test", {})).status).toBe(403);
		const editor = await w.as("editor@example.test");
		expect((await editor.call("POST", "settings/smtp/test", {})).status).toBe(403);
		expect(w.mails).toHaveLength(0);
		const root = await w.as("root@example.test");
		for (let i = 0; i < 5; i++) expect((await root.call("POST", "settings/smtp/test", {})).status).toBe(200);
		expect((await root.call("POST", "settings/smtp/test", {})).status).toBe(429);
		expect(w.mails).toHaveLength(5);
	});
});

describe("the SMTP mailer", () => {
	async function setup(smtp: Partial<typeof SMTP> | null = SMTP) {
		const w = await world(SEEDS);
		if (smtp) await (await w.as("root@example.test")).call("PUT", "settings/smtp", { ...SMTP, ...smtp });
		const sent: { config: SmtpConfig; envelope: SmtpEnvelope }[] = [];
		const make = (fail?: Error) =>
			createSmtpMailer(w.db, { ADMIN_ENC_KEY: KEY }, async (config, envelope) => {
				if (fail) throw fail;
				sent.push({ config, envelope });
			});
		return { w, sent, make };
	}

	it("sends through the transport with the stored settings and the decrypted password, Vietnamese intact", async () => {
		const { sent, make } = await setup();
		await make()({ to: "nguoi@example.test", subject: "Đặt lại mật khẩu quản trị – Tùng Lâm Hòa Phúc", text: "Xin chào,\nĐây là liên kết: https://x.test/ạ\n" });
		expect(sent).toHaveLength(1);
		expect(sent[0].config).toMatchObject({ host: "smtp.example.test", port: 587, secure: false, username: "thu@example.test", password: SMTP.password });
		expect(sent[0].envelope).toEqual({ from: { name: "Tùng Lâm Hòa Phúc", email: "thu@example.test" }, to: "nguoi@example.test", subject: "Đặt lại mật khẩu quản trị – Tùng Lâm Hòa Phúc", text: "Xin chào,\nĐây là liên kết: https://x.test/ạ\n" });
	});

	it("throws a clear error when SMTP is not set up, and nothing is sent", async () => {
		const { sent, make } = await setup(null);
		await expect(make()({ to: "a@b.test", subject: "s", text: "t" })).rejects.toMatchObject({ kind: "not_configured", message: "Chưa cấu hình máy chủ thư (SMTP)." });
		expect(sent).toHaveLength(0);
	});

	it("reads the settings at each send, so a change takes effect at once", async () => {
		const { w, sent, make } = await setup();
		const mailer = make();
		await mailer({ to: "a@b.test", subject: "một", text: "t" });
		await (await w.as("root@example.test")).call("PUT", "settings/smtp", { ...SMTP, password: undefined, fromName: "Tên mới" });
		await mailer({ to: "a@b.test", subject: "hai", text: "t" });
		expect(sent.map((s) => s.envelope.from.name)).toEqual(["Tùng Lâm Hòa Phúc", "Tên mới"]);
	});

	it("keeps header injection out of subject and sender, and refuses a recipient that is not one address", async () => {
		const { sent, make } = await setup();
		await make()({ to: "a@b.test", subject: "Chào\r\nBcc: x@y.test", text: "t" });
		expect(sent[0].envelope.subject).toBe("Chào Bcc: x@y.test");
		for (const to of ["a@b.test, c@d.test", "a@b.test\r\nBcc: x@y.test", "khong-phai", ""]) await expect(make()({ to, subject: "s", text: "t" }), to).rejects.toThrow();
		expect(sent).toHaveLength(1);
	});

	it("gives a generic message for a wrong login and another for a connection that fails, never the server's words", async () => {
		const { make } = await setup();
		await expect(make(new Error("535 5.7.8 Username and Password not accepted for thu@example.test"))({ to: "a@b.test", subject: "s", text: "t" })).rejects.toMatchObject({ kind: "auth", message: "Sai tài khoản hoặc mật khẩu thư." });
		await expect(make(new Error("connect ECONNREFUSED 10.9.8.7:587"))({ to: "a@b.test", subject: "s", text: "t" })).rejects.toMatchObject({ kind: "connect", message: "Không kết nối được máy chủ thư." });
		expect(classify(new Error("Timeout while waiting for smtp server response"))).toMatchObject({ kind: "connect" });
	});

	it("refuses to connect to an internal host even if one got into the database", async () => {
		const { w, sent, make } = await setup();
		w.raw.prepare("UPDATE setting SET value = json_set(value, '$.host', '169.254.169.254') WHERE key = 'mail.smtp'").run();
		await expect(make()({ to: "a@b.test", subject: "s", text: "t" })).rejects.toMatchObject({ kind: "connect" });
		expect(sent).toHaveLength(0);
	});

	it("cannot use a password that no longer decrypts (key changed): treated as not set up", async () => {
		const { w, sent } = await setup();
		const mailer = createSmtpMailer(w.db, { ADMIN_ENC_KEY: Buffer.alloc(32, 9).toString("base64") }, async (config, envelope) => void sent.push({ config, envelope }));
		await expect(mailer({ to: "a@b.test", subject: "s", text: "t" })).rejects.toMatchObject({ kind: "not_configured" });
		const root = await w.as("root@example.test");
		expect((await root.call("GET", "settings/smtp")).data).toMatchObject({ passwordSet: true, passwordReadable: true });
	});

	it("tells which hosts are fine", () => {
		for (const host of ["smtp.gmail.com", "mail.tunglamhoaphuc.com", "203.0.113.10", "2606:4700::1111", "smtp-relay.example.co.uk"]) expect(hostProblem(host), host).toBeNull();
		for (const host of ["", "localhost", "LOCALHOST", "a.localhost", "127.0.0.1", "127.1.1.1", "10.1.1.1", "172.31.255.255", "192.168.0.1", "169.254.1.1", "0.0.0.0", "100.64.0.1", "224.0.0.1", "::1", "::", "fc00::1", "fe80::abcd", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "1.2.3", "300.1.1.1", "mail", "has space.test", "-bad.test", "a..b.test", "x".repeat(260)]) {
			expect(hostProblem(host), host).not.toBeNull();
		}
	});
});
