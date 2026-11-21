// The real mailer: SMTP over a Workers socket (the `worker-mailer` package, which needs `cloudflare:sockets` and so can only
// run inside a Worker). The wire is behind `SmtpTransport`, so tests give it a fake. The settings are read from D1 on every
// send and the password is decrypted only for that send: nothing secret is kept between mails.
import { decryptSecret } from "../crypto";
import type { AdminDb } from "../db";
import { getSetting } from "../ops/store";
import type { Mailer, MailMessage } from "./send";

export const SMTP_KEY = "mail.smtp";

/** What is stored under `mail.smtp`: the password only in its encrypted form. */
export type SmtpSettings = {
	host: string;
	port: 465 | 587;
	secure: boolean;
	username: string;
	passwordEnc: string;
	fromName: string;
	fromEmail: string;
};

/** What the transport gets: the password in the clear, for this one send. */
export type SmtpConfig = Omit<SmtpSettings, "passwordEnc"> & { password: string };

export type SmtpEnvelope = { from: { name: string; email: string }; to: string; subject: string; text: string };
export type SmtpTransport = (config: SmtpConfig, envelope: SmtpEnvelope) => Promise<void>;

/** A failure with a message safe to show in the browser: never the server's own reply. */
export class MailError extends Error {
	constructor(
		readonly kind: "not_configured" | "connect" | "auth",
		message: string,
	) {
		super(message);
	}
}

export const MAIL_MESSAGES = {
	not_configured: "Chưa cấu hình máy chủ thư (SMTP).",
	connect: "Không kết nối được máy chủ thư.",
	auth: "Sai tài khoản hoặc mật khẩu thư.",
} as const;

const fail = (kind: keyof typeof MAIL_MESSAGES) => new MailError(kind, MAIL_MESSAGES[kind]);

// ------------------------------------------------------------------ which hosts may be used

function isPrivateV4(octets: number[]): boolean {
	const [a, b] = octets;
	return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function v4Octets(host: string): number[] | null {
	const parts = host.split(".");
	if (parts.length !== 4) return null;
	const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
	return octets.every((n) => n >= 0 && n <= 255) ? octets : null;
}

/** A message when `host` must not be used for mail, else null: no localhost, no internal names, no private/loopback/link-local addresses. */
export function hostProblem(rawHost: string): string | null {
	const host = rawHost.trim().toLowerCase().replace(/^\[|\]$/g, "");
	if (!host) return "Nhập địa chỉ máy chủ thư.";
	if (host.length > 253) return "Địa chỉ máy chủ thư quá dài.";
	const refuse = "Không dùng địa chỉ nội bộ làm máy chủ thư.";
	if (host.includes(":")) {
		// An IPv6 literal.
		if (!/^[0-9a-f:.]+$/.test(host)) return "Địa chỉ máy chủ thư chưa đúng.";
		if (host === "::" || host === "::1" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return refuse;
		const mapped = /^::ffff:(.+)$/.exec(host);
		if (mapped) {
			const octets = v4Octets(mapped[1]);
			return !octets || isPrivateV4(octets) ? refuse : null;
		}
		return null;
	}
	if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host) || host.includes("..")) return "Địa chỉ máy chủ thư chưa đúng.";
	if (host === "localhost" || /\.(localhost|local|internal|lan|home|corp)$/.test(host)) return refuse;
	const octets = v4Octets(host);
	if (octets) return isPrivateV4(octets) ? refuse : null;
	// Digits and dots only, or a hex/decimal number, are other spellings of an IPv4 address: refused outright.
	if (/^[0-9.]+$/.test(host) || /^0x[0-9a-f.x]+$/.test(host)) return refuse;
	if (!host.includes(".")) return refuse;
	return null;
}

export const SMTP_PORTS = [465, 587] as const;

// ------------------------------------------------------------------ the real wire

/** SMTP through worker-mailer: implicit TLS on 465, STARTTLS on 587. Loaded only when a mail is sent, inside a Worker. */
export const workerMailerTransport: SmtpTransport = async (config, envelope) => {
	const { WorkerMailer } = await import("worker-mailer");
	const mailer = await WorkerMailer.connect({
		host: config.host,
		port: config.port,
		secure: config.port === 465,
		startTls: config.port === 587,
		credentials: config.username ? { username: config.username, password: config.password } : undefined,
		authType: ["plain", "login"],
		socketTimeoutMs: 15_000,
		responseTimeoutMs: 15_000,
		logLevel: 4,
	});
	try {
		await mailer.send({ from: envelope.from.name ? { name: envelope.from.name, email: envelope.from.email } : envelope.from.email, to: envelope.to, subject: envelope.subject, text: envelope.text });
	} finally {
		await mailer.close().catch(() => undefined);
	}
};

/** Tells a wrong login from every other failure, without passing the server's words on. */
export function classify(error: unknown): MailError {
	if (error instanceof MailError) return error;
	const reason = error instanceof Error ? error.message : String(error);
	return /\b53[0-5]\b|auth|credential|username|password|login/i.test(reason) ? fail("auth") : fail("connect");
}

// ------------------------------------------------------------------ the mailer

/** The stored settings with the password decrypted, or null when SMTP has not been set up. */
export async function loadSmtp(db: AdminDb, encKey: string): Promise<SmtpConfig | null> {
	const stored = await getSetting<Partial<SmtpSettings>>(db, SMTP_KEY);
	if (!stored?.host || !stored.fromEmail || !stored.port) return null;
	let password = "";
	if (stored.passwordEnc) {
		try {
			password = await decryptSecret(stored.passwordEnc, encKey);
		} catch {
			// A password that cannot be decrypted (the key changed) is the same as none: the admin has to enter it again.
			return null;
		}
	}
	return {
		host: stored.host,
		port: stored.port === 465 ? 465 : 587,
		secure: stored.port === 465,
		username: stored.username ?? "",
		password,
		fromName: stored.fromName ?? "",
		fromEmail: stored.fromEmail,
	};
}

/** The mailer the admin uses. Throws a MailError when SMTP is not set up or the send fails; the caller decides what to show. */
export function createSmtpMailer(db: AdminDb, env: { ADMIN_ENC_KEY: string }, transport: SmtpTransport = workerMailerTransport): Mailer {
	return async (message: MailMessage) => {
		const config = await loadSmtp(db, env.ADMIN_ENC_KEY);
		if (!config) throw fail("not_configured");
		const problem = hostProblem(config.host);
		if (problem) throw fail("connect");
		if (!/^[^\s@<>",;]+@[^\s@<>",;]+$/.test(message.to)) throw new Error("recipient address is not valid");
		// A line break in a subject or an address would let a value smuggle in headers.
		const subject = message.subject.replace(/[\r\n]+/g, " ").slice(0, 150);
		try {
			await transport(config, { from: { name: config.fromName.replace(/[\r\n"]+/g, " "), email: config.fromEmail }, to: message.to, subject, text: message.text });
		} catch (error) {
			const failure = classify(error);
			// The kind, and the first words of the reason for whoever reads the Worker log; none of it goes to the browser.
			console.error("smtp send failed:", failure.kind, error instanceof Error ? error.message.slice(0, 160) : "");
			throw failure;
		}
	};
}
