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

/** Counts a hit; true while the key is within `limit` hits per window. */
export async function hit(db: AdminDb, key: string, now: Date, limit: number, windowMs: number): Promise<boolean> {
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
	const row = await db.prepare("SELECT count FROM auth_throttle WHERE key = ?").bind(key).first();
	return num(row?.count) <= limit;
}
