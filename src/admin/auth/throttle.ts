// Counters that slow guessing down, kept in `auth_throttle`. Two kinds:
// - failures with back-off (sign-in, 2FA): after `free` failures each next one has to wait longer;
// - hits against a limit (password-reset requests): `limit` per window, then refused.
// Each write is one statement, so two requests at once cannot both slip through a read-then-write gap.
import type { AdminDb } from "../db";
import { num, text } from "../db";

export type Backoff = { windowMs: number; free: number; baseMs: number; maxMs: number };

/** Sign-in: 5 free failures per (email, address) pair, then 1, 2, 4… minutes up to 15. */
export const LOGIN_BACKOFF: Backoff = { windowMs: 15 * 60_000, free: 5, baseMs: 60_000, maxMs: 15 * 60_000 };
/** Sign-in per address: 20 failures in 15 minutes, then 15 minutes of waiting. */
export const IP_BACKOFF: Backoff = { windowMs: 15 * 60_000, free: 20, baseMs: 15 * 60_000, maxMs: 15 * 60_000 };

/** Seconds to wait before the key may try again; 0 when it may. */
export async function waitSeconds(db: AdminDb, keys: string[], now: Date): Promise<number> {
	let wait = 0;
	for (const key of keys) {
		const row = await db.prepare("SELECT locked_until FROM auth_throttle WHERE key = ?").bind(key).first();
		const until = row ? text(row.locked_until) : "";
		if (until && until > now.toISOString()) wait = Math.max(wait, Math.ceil((Date.parse(until) - now.getTime()) / 1000));
	}
	return wait;
}

export async function recordFailure(db: AdminDb, key: string, now: Date, policy: Backoff): Promise<void> {
	const iso = now.toISOString();
	const windowEdge = new Date(now.getTime() - policy.windowMs).toISOString();
	await db
		.prepare(
			`INSERT INTO auth_throttle (key, window_start, count) VALUES (?, ?, 1)
			 ON CONFLICT(key) DO UPDATE SET
			   count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
			   window_start = CASE WHEN window_start <= ? THEN ? ELSE window_start END`,
		)
		.bind(key, iso, windowEdge, windowEdge, iso)
		.run();
	const row = await db.prepare("SELECT count FROM auth_throttle WHERE key = ?").bind(key).first();
	const over = num(row?.count) - policy.free;
	if (over >= 0) {
		const wait = Math.min(policy.baseMs * 2 ** over, policy.maxMs);
		await db.prepare("UPDATE auth_throttle SET locked_until = ? WHERE key = ?").bind(new Date(now.getTime() + wait).toISOString(), key).run();
	}
}

export async function clearFailures(db: AdminDb, key: string): Promise<void> {
	await db.prepare("DELETE FROM auth_throttle WHERE key = ?").bind(key).run();
}

/**
 * Counts a hit and says whether it is within `limit` hits per window; when it is not, `retryAfter` is the seconds until the
 * window ends. One upsert counts, so any number of requests at once are counted one by one.
 */
export async function reserve(db: AdminDb, key: string, now: Date, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfter: number }> {
	const iso = now.toISOString();
	const windowEdge = new Date(now.getTime() - windowMs).toISOString();
	await db
		.prepare(
			`INSERT INTO auth_throttle (key, window_start, count) VALUES (?, ?, 1)
			 ON CONFLICT(key) DO UPDATE SET
			   count = CASE WHEN window_start <= ? THEN 1 ELSE count + 1 END,
			   window_start = CASE WHEN window_start <= ? THEN ? ELSE window_start END`,
		)
		.bind(key, iso, windowEdge, windowEdge, iso)
		.run();
	const row = await db.prepare("SELECT count, window_start FROM auth_throttle WHERE key = ?").bind(key).first();
	if (num(row?.count) <= limit) return { ok: true, retryAfter: 0 };
	const end = Date.parse(text(row?.window_start)) + windowMs;
	return { ok: false, retryAfter: Math.max(1, Math.ceil((end - now.getTime()) / 1000)) };
}

/** Counts a hit; true while the key is within `limit` hits per window. */
export async function hit(db: AdminDb, key: string, now: Date, limit: number, windowMs: number): Promise<boolean> {
	return (await reserve(db, key, now, limit, windowMs)).ok;
}

/** Gives one counted hit back (a try that turned out right). */
export async function release(db: AdminDb, key: string): Promise<void> {
	await db.prepare("UPDATE auth_throttle SET count = MAX(count - 1, 0) WHERE key = ?").bind(key).run();
}

/** Sign-in per email, from any address: 50 failures in an hour, then 1, 2, 4… minutes up to 15 (slows a spread-out guess, never locks). */
export const EMAIL_BACKOFF: Backoff = { windowMs: 3600_000, free: 50, baseMs: 60_000, maxMs: 15 * 60_000 };
/** Wrong codes of the 2FA step, per account across all its sign-ins: 10 tries in 15 minutes. */
export const MFA_USER_LIMIT = { limit: 10, windowMs: 15 * 60_000 } as const;

/**
 * The address as a throttle key: an IPv6 address stands for a whole /64 (one subscriber holds billions of them, so the exact
 * string would be a fresh key for every try); an IPv4-mapped one is its IPv4; anything else is kept as it is.
 */
export function throttleIp(ip: string): string {
	const value = ip.trim().toLowerCase();
	if (!value.includes(":")) return value;
	let rest = value;
	const mapped = rest.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
	if (mapped) {
		const octets = mapped[2].split(".").map(Number);
		if (octets.some((octet) => octet > 255)) return value;
		if (mapped[1] === "::ffff:") return octets.join(".");
		rest = `${mapped[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
	}
	const halves = rest.split("::");
	if (halves.length > 2) return value;
	const head = halves[0] ? halves[0].split(":") : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
	if (halves.length === 1 ? head.length !== 8 : head.length + tail.length > 7) return value;
	const groups = halves.length === 1 ? head : [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail];
	if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return value;
	return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(":")}::/64`;
}
