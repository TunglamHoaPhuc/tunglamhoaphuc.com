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

	it("sends the security headers on every host, and no Content-Security-Policy", async () => {
		const rules = ((await nextConfig.headers?.()) ?? []) as Rule[];
		const everywhere = rules.filter((rule) => rule.source === "/:path*" && !rule.missing);
		const headers = Object.fromEntries(everywhere.flatMap((rule) => rule.headers).map(({ key, value }) => [key, value]));
		expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000");
		expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
		expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
		expect(headers["X-Content-Type-Options"]).toBe("nosniff");
		expect(headers["Content-Security-Policy"]).toBeUndefined();
	});

	it("never lets the admin be framed, keeps its referrer to itself and gives it a Content-Security-Policy that shuts other origins", async () => {
		const rules = ((await nextConfig.headers?.()) ?? []) as Rule[];
		// What a request gets: the matching rules in order, the last value of a header wins (as Next.js and vinext do).
		const headersFor = (path: string) => {
			const out: Record<string, string> = {};
			for (const rule of rules.filter((item) => !item.missing)) {
				const pattern = new RegExp(`^${rule.source.replace(/\/:path\*$/, "(/.*)?")}$`);
				if (pattern.test(path)) for (const { key, value } of rule.headers) out[key] = value;
			}
			return out;
		};
		for (const path of ["/quan-tri", "/quan-tri/dang-nhap", "/quan-tri/bai-viet/abc", "/api/quan-tri/v1/auth/me"]) {
			const headers = headersFor(path);
			expect(headers["X-Frame-Options"], path).toBe("DENY");
			expect(headers["Referrer-Policy"], path).toBe("same-origin");
			expect(headers["Strict-Transport-Security"], path).toBe("max-age=31536000");
			const csp = headers["Content-Security-Policy"];
			expect(csp, path).toBeDefined();
			for (const part of ["default-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) expect(csp, `${path}: ${part}`).toContain(part);
			// nothing but the site itself runs scripts or styles from a file; the only frames are YouTube's
			expect(csp, path).not.toMatch(/script-src[^;]*https?:/);
			// the editor plays a sound from any https address the editors paste
			expect(csp, path).toContain("media-src 'self' blob: https:");
			expect(csp, path).toMatch(/frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/www\.youtube\.com(;|$)/);
		}
		// the draft preview shows the public site's page, so it gets no policy of the admin's, but is never framed
		const preview = headersFor("/quan-tri/xem-truoc/bai-viet/abc");
		expect(preview["Content-Security-Policy"]).toBe("frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
		expect(preview["X-Frame-Options"]).toBe("DENY");
		for (const path of ["/", "/gioi-thieu", "/api/other", "/quan-tri-gia"]) {
			expect(headersFor(path)["X-Frame-Options"], path).toBe("SAMEORIGIN");
			expect(headersFor(path)["Referrer-Policy"], path).toBe("strict-origin-when-cross-origin");
			expect(headersFor(path)["Content-Security-Policy"], path).toBeUndefined();
		}
	});

	it("names the same public hosts as the code that hides internal pages", () => {
		for (const host of ["www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]) expect(isPublicHost(host)).toBe(true);
	});
});
