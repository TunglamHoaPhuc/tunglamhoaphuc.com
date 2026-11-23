// Cookies: host-only (`__Host-` needs Secure, Path=/ and no Domain), HttpOnly, and SameSite.
export const COOKIES = { access: "__Host-tlhp_at", refresh: "__Host-tlhp_rt" } as const;

export function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get("cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const index = part.indexOf("=");
		if (index > 0 && part.slice(0, index).trim() === name) {
			try {
				return decodeURIComponent(part.slice(index + 1).trim());
			} catch {
				return null; // a broken % escape is no valid cookie of ours
			}
		}
	}
	return null;
}

export function cookieHeader(name: string, value: string, opts: { maxAgeSeconds: number; sameSite: "Lax" | "Strict" }): string {
	return `${name}=${encodeURIComponent(value)}; Max-Age=${opts.maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=${opts.sameSite}`;
}

export const clearCookie = (name: string, sameSite: "Lax" | "Strict") => cookieHeader(name, "", { maxAgeSeconds: 0, sameSite });

/**
 * The caller's address as Cloudflare reports it; empty when there is none (local runs). `x-forwarded-for` is not read:
 * a client can write it, so trusting it would let anyone pick the key the sign-in throttle counts them under.
 */
export const clientIp = (request: Request) => request.headers.get("cf-connecting-ip")?.trim().slice(0, 64) ?? "";
