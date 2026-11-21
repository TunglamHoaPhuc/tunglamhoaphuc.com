// Time-based one-time passwords (RFC 6238): 6 digits, 30 seconds, HMAC-SHA1, as every authenticator
// app expects.
const STEP_SECONDS = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let out = "";
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

export function base32Decode(text: string): Uint8Array<ArrayBuffer> {
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const char of text.replace(/=+$/, "").toUpperCase()) {
		const index = ALPHABET.indexOf(char);
		if (index < 0) throw new Error("not base32");
		value = (value << 5) | index;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Uint8Array.from(out);
}

export const generateTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)));

export async function totpCode(secret: string, step: number): Promise<string> {
	const counter = new Uint8Array(8);
	new DataView(counter.buffer).setBigUint64(0, BigInt(step));
	const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
	const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
	const offset = mac[19] & 15;
	const binary = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
	return String(binary % 1_000_000).padStart(6, "0");
}

export const stepAt = (nowMs: number) => Math.floor(nowMs / 1000 / STEP_SECONDS);

/** The step a code belongs to (this one, or one either side), or null. A step at or below `lastUsedStep` is refused: a code works once. */
export async function checkTotp(secret: string, code: string, nowMs: number, lastUsedStep = 0): Promise<number | null> {
	if (!/^\d{6}$/.test(code)) return null;
	const current = stepAt(nowMs);
	for (const step of [current, current - 1, current + 1]) {
		if (step > lastUsedStep && (await totpCode(secret, step)) === code) return step;
	}
	return null;
}

export const otpauthUri = (secret: string, email: string) =>
	`otpauth://totp/${encodeURIComponent(`Tùng Lâm Hòa Phúc:${email}`)}?secret=${secret}&issuer=${encodeURIComponent("Tùng Lâm Hòa Phúc")}&period=${STEP_SECONDS}&digits=6`;
