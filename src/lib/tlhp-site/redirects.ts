// Copied from www (src/libs/redirects.ts) without changes except this note and the removal of the hit counter: V3 only reads D1,
// so it does not count a redirect's hits (www's admin shows them for the visits www serves).
// Redirects (301/302) from addresses the site no longer has. The rules live here, apart from the admin, so the
// admin's forms and the public 404 path judge an address the same way. Nothing here touches a request or a global.

/** Addresses that belong to the site itself or to the admin and never go through the table. */
export const RESERVED_PREFIXES = ["/quan-tri", "/api", "/anh-goc", "/cdn-cgi", "/admin", "/login", "/van-hanh", "/_next"] as const;

/** The only hosts a redirect may point to by full address: this site's own. */
export const OWN_HOSTS = ["tunglamhoaphuc.com", "www.tunglamhoaphuc.com"] as const;

const MAX_LENGTH = 300;
// eslint-disable-next-line no-control-regex
const CONTROL_OR_SPACE = /[\u0000- \u007f]/;

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

const isReserved = (path: string) => RESERVED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/** The address a missing page is asked for: one "/" at the start, no query or fragment, no trailing "/" (except the root). */
export function checkFrom(raw: string): Checked<string> {
	const input = raw.trim();
	if (!input) return { ok: false, message: "Nhập đường dẫn cũ." };
	if (input.length > MAX_LENGTH) return { ok: false, message: "Đường dẫn cũ quá dài." };
	if (!input.startsWith("/") || input.startsWith("//")) return { ok: false, message: "Đường dẫn cũ phải bắt đầu bằng một dấu /." };
	if (/[?#\\]/.test(input)) return { ok: false, message: "Đường dẫn cũ không được có dấu ?, # hoặc \\." };
	if (input.includes("//")) return { ok: false, message: "Đường dẫn cũ không được có hai dấu / liền nhau." };
	if (CONTROL_OR_SPACE.test(input)) return { ok: false, message: "Đường dẫn cũ không được có khoảng trắng." };
	const value = input.length > 1 ? input.replace(/\/+$/, "") : input;
	if (value === "/") return { ok: false, message: "Không chuyển hướng trang chủ." };
	if (isReserved(value.toLowerCase())) return { ok: false, message: "Đường dẫn này thuộc phần hệ thống của trang web nên không thể chuyển hướng." };
	return { ok: true, value };
}

/** Where a redirect leads: a path of this site, or an https address on one of its own hosts. Never another site (no open redirect). */
export function checkTo(raw: string): Checked<string> {
	const input = raw.trim();
	if (!input) return { ok: false, message: "Nhập đường dẫn mới." };
	if (input.length > 500) return { ok: false, message: "Đường dẫn mới quá dài." };
	if (input.includes("\\") || CONTROL_OR_SPACE.test(input)) return { ok: false, message: "Đường dẫn mới không được có khoảng trắng hoặc dấu \\." };
	if (input.startsWith("/")) {
		if (input.includes("//")) return { ok: false, message: "Đường dẫn mới không được có hai dấu / liền nhau." };
		return { ok: true, value: input };
	}
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		return { ok: false, message: "Đường dẫn mới phải bắt đầu bằng / hoặc là địa chỉ https của chính trang web này." };
	}
	const own = (OWN_HOSTS as readonly string[]).includes(url.hostname) && url.protocol === "https:" && !url.username && !url.password && !url.port;
	if (!own) return { ok: false, message: "Chỉ được chuyển tới trang của chính website (tunglamhoaphuc.com)." };
	if (input.slice(8).includes("//")) return { ok: false, message: "Đường dẫn mới không được có hai dấu / liền nhau." };
	return { ok: true, value: input };
}

/** The path part of a destination (its own origin, query and fragment removed), the way `from` is written. */
export function pathOf(to: string): string {
	let path = to;
	if (!to.startsWith("/")) {
		try {
			path = new URL(to).pathname;
		} catch {
			path = to;
		}
	}
	const clean = path.split(/[?#]/)[0] ?? path;
	return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

export const MAX_HOPS = 5;

/**
 * True when following `to` through the existing redirects (`next` answers each path's own destination, or null) comes back to
 * `from` within MAX_HOPS steps, or when `to` is `from` itself.
 */
export async function makesLoop(from: string, to: string, next: (path: string) => Promise<string | null>): Promise<boolean> {
	let path = pathOf(to);
	for (let hop = 0; hop <= MAX_HOPS; hop++) {
		if (path === from) return true;
		const further = await next(path);
		if (!further) return false;
		path = pathOf(further);
	}
	return false;
}

/** The part of a D1 database the public lookup uses. */
export type RedirectDb = {
	prepare(sql: string): { bind(...values: unknown[]): { all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run?(): Promise<unknown> } };
};

export type Found = { fromPath: string; to: string; code: 301 | 302 };

/** The spellings a visitor's address may have been stored under: as asked, decoded, encoded, with and without the final "/". */
export function candidates(path: string): string[] {
	const set = new Set<string>();
	const add = (value: string) => {
		const trimmed = value.length > 1 ? value.replace(/\/+$/, "") : value;
		if (trimmed.startsWith("/") && trimmed !== "/") set.add(trimmed);
	};
	add(path);
	try {
		add(decodeURI(path));
	} catch {
		// not valid percent-encoding: only the spelling as asked
	}
	try {
		add(encodeURI(path));
	} catch {
		// lone surrogate: skip
	}
	return [...set].slice(0, 4);
}

/** One indexed query: the active redirect for a missing address, or null. Reserved prefixes never reach the table. */
export async function findRedirect(db: RedirectDb, path: string): Promise<Found | null> {
	if (!path.startsWith("/") || path.length > MAX_LENGTH * 2 || isReserved(path.toLowerCase())) return null;
	const spellings = candidates(path);
	if (!spellings.length) return null;
	const { results } = await db
		.prepare(`SELECT from_path, to_path, code FROM redirect WHERE active = 1 AND from_path IN (${spellings.map(() => "?").join(", ")}) LIMIT 1`)
		.bind(...spellings)
		.all();
	const row = results[0];
	if (!row) return null;
	const to = typeof row.to_path === "string" ? row.to_path : "";
	// What is in the table was checked on the way in; check again, so a bad row can never send a visitor elsewhere.
	if (!checkTo(to).ok) return null;
	return { fromPath: String(row.from_path), to, code: Number(row.code) === 302 ? 302 : 301 };
}
