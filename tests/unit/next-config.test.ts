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

	it("sends the old admin addresses of www to quantri., and only on the public host (T22)", async () => {
		const rules = ((await nextConfig.redirects?.()) ?? []) as { source: string; has?: { value?: string }[]; destination: string; permanent: boolean }[];
		const bare = rules.find((rule) => rule.source === "/:path*");
		expect(bare?.destination).toBe("https://www.tunglamhoaphuc.com/:path*");
		expect(bare?.permanent).toBe(true);
		expect(new RegExp(`^${bare!.has![0].value}$`).test("tunglamhoaphuc.com")).toBe(true);
		for (const host of ["www.tunglamhoaphuc.com", "v2.tunglamhoaphuc.com", "localhost:4175"]) expect(new RegExp(`^${bare!.has![0].value}$`).test(host), host).toBe(false);
		const adminRules = rules.filter((rule) => rule !== bare);
		const sources = adminRules.map((rule) => rule.source);
		for (const path of ["/admin", "/login", "/van-hanh"]) {
			expect(sources).toContain(path);
			expect(sources).toContain(`${path}/:rest*`);
		}
		for (const rule of adminRules) {
			expect(rule.destination.startsWith("https://quantri.tunglamhoaphuc.com/")).toBe(true);
			// Temporary: the new admin takes /admin back at the final switch (T27, T39).
			expect(rule.permanent).toBe(false);
			expect(new RegExp(`^${rule.has![0].value}$`).test("www.tunglamhoaphuc.com")).toBe(true);
			expect(new RegExp(`^${rule.has![0].value}$`).test("v2.tunglamhoaphuc.com")).toBe(false);
		}
	});

	it("names the same public hosts as the code that hides internal pages", () => {
		for (const host of ["www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]) expect(isPublicHost(host)).toBe(true);
	});
});
