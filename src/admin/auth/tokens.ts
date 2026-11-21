import { jwtVerify, SignJWT } from "jose";

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A random token for a cookie or a mailed link: 32 bytes, URL-safe. */
export function randomToken(bytes = 32): string {
	return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/** What the database keeps of a token: its SHA-256. */
export async function sha256Hex(value: string): Promise<string> {
	return hex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

export const ACCESS_TTL_SECONDS = 15 * 60;

export async function signAccessToken(claims: { sub: string; sid: string }, secret: string, nowMs = Date.now()): Promise<string> {
	const iat = Math.floor(nowMs / 1000);
	return new SignJWT({ sid: claims.sid })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(claims.sub)
		.setIssuedAt(iat)
		.setExpirationTime(iat + ACCESS_TTL_SECONDS)
		.sign(enc.encode(secret));
}

/** The claims of a valid, unexpired access token, else null. */
export async function verifyAccessToken(token: string, secret: string, nowMs = Date.now()): Promise<{ sub: string; sid: string } | null> {
	try {
		const { payload } = await jwtVerify(token, enc.encode(secret), { algorithms: ["HS256"], currentDate: new Date(nowMs) });
		return typeof payload.sub === "string" && typeof payload.sid === "string" ? { sub: payload.sub, sid: payload.sid } : null;
	} catch {
		return null;
	}
}

/** The CSRF token of a session: an HMAC of its id, so nothing has to be stored. */
export async function csrfToken(sessionId: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`csrf:${sessionId}`))));
}

export function timingSafeEqual(a: string, b: string): boolean {
	const left = enc.encode(a);
	const right = enc.encode(b);
	let diff = left.length ^ right.length;
	for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
	return diff === 0;
}
