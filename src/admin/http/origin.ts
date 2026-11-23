// Where a request may come from: the admin answers on one address only (ADMIN_BASE_URL). Pure functions, so the API
// dispatcher and the preview page (which is not behind the dispatcher) decide the same way, and tests need no server.

/** `https://host:port` of an http(s) address, or null for anything else (junk, "null", file:, data:). */
function originOf(value: string): string | null {
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
	} catch {
		return null;
	}
}

/** Whether `requestHost` (a Host header or `URL.host`) is the host of the admin's own address. A bad or missing base means no. */
export function isAdminHost(requestHost: string | null | undefined, baseUrl: string | undefined): boolean {
	if (!requestHost || !baseUrl) return false;
	const base = originOf(baseUrl);
	if (!base) return false;
	return requestHost.toLowerCase() === new URL(base).host;
}

/** Whether an `Origin` header names the admin's own address, scheme and port included. `Origin: null` and junk are no. */
export function isAdminOrigin(origin: string | null | undefined, baseUrl: string | undefined): boolean {
	if (!origin || !baseUrl) return false;
	const given = originOf(origin);
	return given !== null && given === originOf(baseUrl);
}
