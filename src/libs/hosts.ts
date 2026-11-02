// Hosts that serve the public temple site. Internal pages such as /styleguide
// answer 404 here and stay reachable on preview hosts like v2.
const PUBLIC_HOSTS = new Set(["www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]);

export function isPublicHost(host: string | null | undefined): boolean {
	if (!host) return false;
	const name = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
	return PUBLIC_HOSTS.has(name);
}
