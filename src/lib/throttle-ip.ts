/**
 * The address as a throttle key: an IPv6 address stands for a whole /64 (one subscriber holds billions of them, so the exact
 * string would be a fresh key for every try); an IPv4-mapped one is its IPv4; anything else is kept as it is.
 * Copied from www (`src/admin/auth/throttle.ts`), which V3 does not carry.
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
