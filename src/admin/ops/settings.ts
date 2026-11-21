// System settings by group: the temple's details, the security policy and the mail server. Everything is checked with zod,
// every write is audited (the audit scrubber also hides secrets), and the mail password never leaves the server.
import { z } from "zod";
import type { AuthContext, Authed } from "../auth/service";
import { decryptSecret, encryptSecret } from "../crypto";
import { text } from "../db";
import { notFound } from "../http/errors";
import { hostProblem, SMTP_KEY, type SmtpSettings } from "../mail/smtp";
import { audit, invalid, requireSuperAdmin } from "./common";
import { getSetting, putSettingStatement } from "./store";

export const GROUPS = ["site-info", "security", "smtp"] as const;
export type Group = (typeof GROUPS)[number];
export const isGroup = (value: string): value is Group => (GROUPS as readonly string[]).includes(value);

/** Groups only the Super Admin may read or write. */
const RESTRICTED: Group[] = ["security", "smtp"];

export function checkGroup(group: string, by: Authed): Group {
	if (!isGroup(group)) throw notFound("Nhóm cấu hình");
	if (RESTRICTED.includes(group)) requireSuperAdmin(by);
	return group;
}

// ------------------------------------------------------------------ site-info

const url = (what: string) =>
	z
		.string()
		.trim()
		.max(500, `${what} quá dài.`)
		.refine((value) => value === "" || /^https:\/\/[^\s<>"']+$/i.test(value), `${what} phải bắt đầu bằng https://`);

const phone = z
	.string()
	.trim()
	.transform((value) => value.replace(/[\s.\-()]/g, ""))
	.refine((value) => /^\+?\d{8,15}$/.test(value), "Số điện thoại chưa đúng (8 đến 15 chữ số).");

export const siteInfoSchema = z.object({
	name: z.string().trim().min(1, "Nhập tên chùa.").max(120),
	slogan: z.string().trim().max(200).default(""),
	address: z.string().trim().max(300).default(""),
	phones: z
		.array(z.object({ role: z.string().trim().min(1, "Nhập chức vụ.").max(80), name: z.string().trim().min(1, "Nhập họ tên.").max(80), phone }))
		.max(20, "Tối đa 20 số liên hệ.")
		.default([]),
	openingHours: z.string().trim().max(300).default(""),
	mapsUrl: url("Địa chỉ bản đồ").default(""),
	social: z
		.array(z.object({ label: z.string().trim().min(1, "Nhập tên mạng xã hội.").max(40), url: url("Liên kết").refine((value) => value !== "", "Nhập liên kết.") }))
		.max(12, "Tối đa 12 liên kết mạng xã hội.")
		.default([]),
	announcement: z
		.object({
			id: z.string().trim().max(60).optional(),
			text: z.string().trim().max(300, "Thông báo tối đa 300 ký tự.").default(""),
			link: z
				.object({
					label: z.string().trim().max(60).default(""),
					href: z
						.string()
						.trim()
						.max(500)
						.refine((value) => value === "" || /^\/(?!\/)[^\s\\]*$/.test(value) || /^https:\/\/[^\s<>"']+$/i.test(value), "Liên kết phải là đường dẫn trong trang (bắt đầu bằng /) hoặc địa chỉ https://"),
				})
				.nullable()
				.default(null),
			expires: z
				.string()
				.trim()
				.refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Ngày hết hạn có dạng năm-tháng-ngày.")
				.default(""),
			active: z.boolean().default(false),
		})
		.default({ text: "", link: null, expires: "", active: false }),
});
export type SiteInfoInput = z.infer<typeof siteInfoSchema>;

/** Changes with the notice, so people who closed the old one see the new one. */
function noticeId(announcement: SiteInfoInput["announcement"]): string {
	if (announcement.id) return announcement.id;
	let hash = 0;
	for (const char of `${announcement.text}|${announcement.link?.href ?? ""}`) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
	return `tb-${hash.toString(36)}`;
}

async function readSiteInfo(ctx: AuthContext): Promise<SiteInfoInput> {
	const info = (await getSetting<Partial<SiteInfoInput>>(ctx.db, "site.info")) ?? {};
	const notice = (await getSetting<Partial<SiteInfoInput["announcement"]>>(ctx.db, "site.announcement")) ?? {};
	return {
		name: text(info.name),
		slogan: text(info.slogan),
		address: text(info.address),
		phones: Array.isArray(info.phones) ? info.phones : [],
		openingHours: text(info.openingHours),
		mapsUrl: text(info.mapsUrl),
		social: Array.isArray(info.social) ? info.social : [],
		announcement: { id: text(notice.id), text: text(notice.text), link: notice.link ?? null, expires: text(notice.expires), active: notice.active === true },
	};
}

async function writeSiteInfo(ctx: AuthContext, by: Authed, input: SiteInfoInput): Promise<SiteInfoInput> {
	const { announcement, ...info } = input;
	const notice = { ...announcement, id: noticeId(announcement), link: announcement.link?.href ? announcement.link : null };
	const before = await readSiteInfo(ctx);
	await ctx.db.batch([
		putSettingStatement(ctx.db, "site.info", info),
		putSettingStatement(ctx.db, "site.announcement", notice),
		audit(ctx, by, { action: "settings.site_info_update", entityType: "setting", entityId: "site.info", before, after: { ...info, announcement: notice } }),
	]);
	return readSiteInfo(ctx);
}

// ------------------------------------------------------------------ security

/** Passwords shorter than this are never accepted, whatever the setting says. */
export const PASSWORD_FLOOR = 10;

export const securitySchema = z.object({
	minPasswordLength: z.number().int("Nhập số nguyên.").min(PASSWORD_FLOOR, `Độ dài mật khẩu tối thiểu không được dưới ${PASSWORD_FLOOR} ký tự.`).max(64, "Tối đa 64 ký tự."),
	sessionDays: z.number().int("Nhập số nguyên.").min(1, "Ít nhất 1 ngày.").max(30, "Tối đa 30 ngày."),
	failedLogins: z.number().int("Nhập số nguyên.").min(3, "Ít nhất 3 lần.").max(20, "Tối đa 20 lần."),
});
export type SecurityPolicy = z.infer<typeof securitySchema>;

export const DEFAULT_POLICY: SecurityPolicy = { minPasswordLength: PASSWORD_FLOOR, sessionDays: 30, failedLogins: 5 };
const POLICY_KEY = "security.policy";

/** The stored policy with defaults filled in and the floor applied, whatever the row holds. */
export async function readPolicy(ctx: Pick<AuthContext, "db">): Promise<SecurityPolicy> {
	const stored = (await getSetting<Partial<SecurityPolicy>>(ctx.db, POLICY_KEY)) ?? {};
	const number = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
	return {
		minPasswordLength: Math.max(PASSWORD_FLOOR, number(stored.minPasswordLength, DEFAULT_POLICY.minPasswordLength)),
		sessionDays: number(stored.sessionDays, DEFAULT_POLICY.sessionDays),
		failedLogins: number(stored.failedLogins, DEFAULT_POLICY.failedLogins),
	};
}

async function writePolicy(ctx: AuthContext, by: Authed, input: SecurityPolicy): Promise<SecurityPolicy> {
	const before = await readPolicy(ctx);
	await ctx.db.batch([putSettingStatement(ctx.db, POLICY_KEY, input), audit(ctx, by, { action: "settings.security_update", entityType: "setting", entityId: POLICY_KEY, before, after: input })]);
	return readPolicy(ctx);
}

// ------------------------------------------------------------------ smtp

const email = z
	.string()
	.trim()
	.max(200)
	.refine((value) => /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(value), "Email chưa đúng.");

export const smtpSchema = z.object({
	host: z.string().trim().min(1, "Nhập địa chỉ máy chủ thư.").max(253),
	port: z.union([z.literal(465), z.literal(587)], { error: "Cổng chỉ có thể là 465 hoặc 587." }),
	secure: z.boolean().optional(),
	username: z.string().trim().max(200).refine((value) => !/[\r\n]/.test(value), "Tài khoản chưa đúng.").default(""),
	/** Absent or empty: keep the stored one (unless the server, port or account changes). */
	password: z.string().max(200).optional(),
	fromName: z.string().trim().max(100).refine((value) => !/[\r\n"]/.test(value), "Tên người gửi không được có dấu nháy kép hoặc xuống dòng.").default(""),
	fromEmail: email,
});
export type SmtpInput = z.infer<typeof smtpSchema>;

export type SmtpView = { host: string; port: 465 | 587; secure: boolean; username: string; passwordSet: boolean; fromName: string; fromEmail: string; configured: boolean };

async function readSmtp(ctx: AuthContext): Promise<{ view: SmtpView; stored: Partial<SmtpSettings> | null }> {
	const stored = await getSetting<Partial<SmtpSettings>>(ctx.db, SMTP_KEY);
	const port = stored?.port === 465 ? 465 : 587;
	return {
		stored,
		view: {
			host: text(stored?.host),
			port,
			secure: port === 465,
			username: text(stored?.username),
			passwordSet: !!stored?.passwordEnc,
			fromName: text(stored?.fromName),
			fromEmail: text(stored?.fromEmail),
			configured: !!stored?.host && !!stored.fromEmail,
		},
	};
}

async function writeSmtp(ctx: AuthContext, by: Authed, input: SmtpInput): Promise<SmtpView> {
	const problem = hostProblem(input.host);
	if (problem) throw invalid("host", problem);
	const host = input.host.trim().toLowerCase().replace(/^\[|\]$/g, "");
	const { stored, view } = await readSmtp(ctx);
	const connectionChanged = !!stored && (host !== stored.host || input.port !== stored.port || input.username !== (stored.username ?? ""));
	let passwordEnc = stored?.passwordEnc ?? "";
	if (input.password) passwordEnc = await encryptSecret(input.password, ctx.env.ADMIN_ENC_KEY);
	else {
		// A new server, port or account must not inherit the old password, and an account cannot log in without one.
		if (connectionChanged) passwordEnc = "";
		if (input.username && !passwordEnc) throw invalid("password", connectionChanged ? "Nhập lại mật khẩu khi đổi máy chủ, cổng hoặc tài khoản." : "Nhập mật khẩu của tài khoản thư.");
	}
	const value: SmtpSettings = { host, port: input.port, secure: input.port === 465, username: input.username, passwordEnc, fromName: input.fromName, fromEmail: input.fromEmail };
	// What the log gets never has the password, in clear or sealed.
	const shown = (v: { host?: string; port?: number; username?: string; fromName?: string; fromEmail?: string }) => ({ host: v.host, port: v.port, username: v.username, fromName: v.fromName, fromEmail: v.fromEmail });
	await ctx.db.batch([
		putSettingStatement(ctx.db, SMTP_KEY, value),
		audit(ctx, by, { action: "settings.smtp_update", entityType: "setting", entityId: SMTP_KEY, before: shown(view), after: { ...shown(value), changedPassword: !!input.password } }),
	]);
	return (await readSmtp(ctx)).view;
}

/** Whether the stored password can still be decrypted (false after ADMIN_ENC_KEY changed). */
export async function smtpPasswordReadable(ctx: AuthContext): Promise<boolean> {
	const { stored } = await readSmtp(ctx);
	if (!stored?.passwordEnc) return true;
	try {
		await decryptSecret(stored.passwordEnc, ctx.env.ADMIN_ENC_KEY);
		return true;
	} catch {
		return false;
	}
}

// ------------------------------------------------------------------ the group endpoints

export async function readGroup(ctx: AuthContext, by: Authed, group: string): Promise<unknown> {
	const g = checkGroup(group, by);
	if (g === "site-info") return readSiteInfo(ctx);
	if (g === "security") return { ...(await readPolicy(ctx)), floor: PASSWORD_FLOOR };
	return readSmtp(ctx).then(async ({ view }) => ({ ...view, passwordReadable: await smtpPasswordReadable(ctx) }));
}

export async function writeGroup(ctx: AuthContext, by: Authed, group: string, body: <S extends z.ZodType>(schema: S) => Promise<z.infer<S>>): Promise<unknown> {
	const g = checkGroup(group, by);
	if (g === "site-info") return writeSiteInfo(ctx, by, await body(siteInfoSchema));
	if (g === "security") return { ...(await writePolicy(ctx, by, await body(securitySchema))), floor: PASSWORD_FLOOR };
	return writeSmtp(ctx, by, await body(smtpSchema));
}
