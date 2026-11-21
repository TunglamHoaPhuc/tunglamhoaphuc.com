// Passwords: Argon2id (RFC 9106), stored as a PHC string with its own parameters, so they can be
// raised later and old hashes still verify. Pure JavaScript (@noble/hashes): the WebAssembly builds
// of other libraries compile code at run time, which Workers do not allow. About 0.2 s of CPU at
// these settings, which is why sign-in needs Workers Paid (docs/admin-architecture.md 2.1).
import { argon2id } from "@noble/hashes/argon2.js";

export type PasswordParams = { m: number; t: number; p: number };

/** OWASP's lowest recommended Argon2id setting: 19 MiB, 2 passes, 1 lane. */
export const PASSWORD_PARAMS: PasswordParams = { m: 19456, t: 2, p: 1 };
export const MIN_PASSWORD_LENGTH = 10;

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export function hashPassword(password: string, params: PasswordParams = PASSWORD_PARAMS): string {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = argon2id(password, salt, { ...params, dkLen: 32 });
	return `$argon2id$v=19$m=${params.m},t=${params.t},p=${params.p}$${encode(salt)}$${encode(hash)}`;
}

export function verifyPassword(password: string, phc: string): boolean {
	const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(phc);
	if (!match) return false;
	const [, m, t, p, salt, expected] = match;
	const want = decode(expected);
	const got = argon2id(password, decode(salt), { m: Number(m), t: Number(t), p: Number(p), dkLen: want.length });
	let diff = got.length ^ want.length;
	for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
	return diff === 0;
}

/** A hash to check against when the account does not exist, so the answer takes as long either way. */
let dummy: string | undefined;
export function dummyHash(): string {
	dummy ??= hashPassword("khong-co-tai-khoan-nay");
	return dummy;
}

const COMMON = new Set([
	"1234567890", "0123456789", "password12", "password123", "qwertyuiop", "1q2w3e4r5t", "iloveyou12", "admin12345",
	"matkhau123", "matkhau1234", "tunglamhoaphuc", "hoaphuc123", "0987654321", "abcdefghij", "123456789a",
]);

/** A message when the password is not acceptable, else null. */
export function passwordProblem(password: string, email = ""): string | null {
	if (password.length < MIN_PASSWORD_LENGTH) return `Mật khẩu cần có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
	if (password.length > 200) return "Mật khẩu quá dài.";
	const lower = password.toLowerCase();
	if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "Mật khẩu này quá phổ biến, hãy chọn mật khẩu khác.";
	const local = email.split("@")[0]?.toLowerCase();
	if (local && local.length >= 4 && lower.includes(local)) return "Mật khẩu không nên chứa tên đăng nhập.";
	return null;
}
