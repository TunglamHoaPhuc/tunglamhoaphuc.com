// Preview links (docs/admin-architecture.md 7.4): a signed token for one version of one article, valid 30 minutes,
// so a person without an account can see a draft. Nothing is stored: the token is the article's kind, id, version
// and expiry, with an HMAC (SHA-256, keyed by ADMIN_JWT_SECRET) over them.
import { timingSafeEqual } from "../auth/tokens";

export const PREVIEW_TTL_MS = 30 * 60 * 1000;

export type PreviewClaims = { kind: string; id: string; version: number; expires: number };

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (text: string) => {
	const padded = text.replace(/-/g, "+").replace(/_/g, "/");
	return new TextDecoder().decode(Uint8Array.from(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)), (char) => char.charCodeAt(0)));
};

async function mac(payload: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`preview:${payload}`))));
}

export async function signPreview(claims: Omit<PreviewClaims, "expires">, secret: string, now: Date): Promise<{ token: string; expiresAt: string }> {
	const expires = now.getTime() + PREVIEW_TTL_MS;
	const payload = b64url(enc.encode(JSON.stringify([claims.kind, claims.id, claims.version, expires])));
	return { token: `${payload}.${await mac(payload, secret)}`, expiresAt: new Date(expires).toISOString() };
}

/** The claims of a valid, unexpired token for this kind and id; null for anything else. */
export async function verifyPreview(token: string, kind: string, id: string, secret: string, now: Date): Promise<PreviewClaims | null> {
	if (!secret || typeof token !== "string" || token.length > 1000) return null;
	const [payload, signature, extra] = token.split(".");
	if (!payload || !signature || extra !== undefined) return null;
	if (!timingSafeEqual(signature, await mac(payload, secret))) return null;
	let parts: unknown;
	try {
		parts = JSON.parse(fromB64url(payload));
	} catch {
		return null;
	}
	if (!Array.isArray(parts) || parts.length !== 4) return null;
	const [k, i, version, expires] = parts as [unknown, unknown, unknown, unknown];
	if (k !== kind || i !== id || typeof version !== "number" || typeof expires !== "number") return null;
	if (expires <= now.getTime()) return null;
	return { kind, id, version, expires };
}
