import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.js";
import { isPublicHost } from "../../src/libs/hosts";

type Rule = { source: string; missing?: { type: string; value?: string }[]; headers: { key: string; value: string }[] };

describe("next.config headers", () => {
	it("keeps every host but the public site out of search engines (T20)", async () => {
		const rules = ((await nextConfig.headers?.()) ?? []) as Rule[];
		const catchAll = rules.find((rule) => rule.source === "/:path*");
		expect(catchAll?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
		// "missing" the public host: the header goes to v2., quantri. and local hosts, not to www.
		const condition = catchAll?.missing?.find((item) => item.type === "host");
		expect(condition).toBeDefined();
		const publicHost = new RegExp(`^${condition!.value}$`);
		for (const host of ["www.tunglamhoaphuc.com", "tunglamhoaphuc.com", "www.tunglamhoaphuc.com:443"]) expect(publicHost.test(host)).toBe(true);
		for (const host of ["v2.tunglamhoaphuc.com", "quantri.tunglamhoaphuc.com", "localhost:4175", "www.tunglamhoaphuc.com.evil.example", "wwwxtunglamhoaphuc.com"]) {
			expect(publicHost.test(host)).toBe(false);
		}
	});

	it("names the same public hosts as the code that hides internal pages", () => {
		for (const host of ["www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]) expect(isPublicHost(host)).toBe(true);
	});
});
