import { describe, expect, it } from "vitest";
import { matchRedirect, requestContextFromRequest } from "vinext/config/config-matchers";
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
		// the rules of quantri. itself (its own describe below) are not these
		const adminRules = rules.filter((rule) => rule !== bare && !rule.has![0].value!.startsWith("quantri"));
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

	describe("the admin host (quantri.) after the cut-over", () => {
		// What a request to `host` + `path` gets from the redirect rules, decided by vinext's own matcher.
		const redirectFor = async (host: string, path: string) => {
			const rules = (await nextConfig.redirects?.()) ?? [];
			const request = new Request(`https://${host}${path}`, { headers: { host } });
			return matchRedirect(new URL(request.url).pathname, rules as never, requestContextFromRequest(request));
		};
		const ADMIN = "quantri.tunglamhoaphuc.com";

		it("sends / to the admin (307)", async () => {
			expect(await redirectFor(ADMIN, "/")).toMatchObject({ destination: "/quan-tri", statusCode: 307 });
		});

		it.each(["/quan-tri", "/quan-tri/dang-nhap", "/quan-tri/xem-truoc/bai-viet/abc", "/api/quan-tri/v1/auth/me", "/anh-goc/tlhp-media/cms/a/v1/x.jpg", "/cdn-cgi/image/width=300/anh-goc/a/b.jpg", "/_next/static/chunks/a.js", "/_vinext/image", "/brand/logo-moc-an.webp", "/images/a.png", "/favicon.ico", "/manifest.webmanifest", "/robots.txt"])(
			"leaves %s to this Worker",
			async (path) => expect(await redirectFor(ADMIN, path)).toBeNull(),
		);

		it.each([
			["/gioi-thieu", "https://www.tunglamhoaphuc.com/gioi-thieu"],
			["/dong-chay-hoang-phap/mot-bai", "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/mot-bai"],
			["/tri-tue-phat-phap/hoc-tieng-tang", "https://www.tunglamhoaphuc.com/tri-tue-phat-phap/hoc-tieng-tang"],
			["/lien-he", "https://www.tunglamhoaphuc.com/lien-he"],
			["/tim-kiem", "https://www.tunglamhoaphuc.com/tim-kiem"],
			["/sitemap.xml", "https://www.tunglamhoaphuc.com/sitemap.xml"],
			// a name that only starts like an admin path is still a public page
			["/quan-tri-gia", "https://www.tunglamhoaphuc.com/quan-tri-gia"],
			["/api/analyze", "https://www.tunglamhoaphuc.com/api/analyze"],
			["/anh-goc-gia/x", "https://www.tunglamhoaphuc.com/anh-goc-gia/x"],
		])("sends the public page %s to the public site at the same path, for good (308)", async (path, destination) => {
			expect(await redirectFor(ADMIN, path)).toMatchObject({ destination, statusCode: 308 });
		});

		it.each(["localhost:3001", "localhost:3021", "127.0.0.1:3001", "v2.tunglamhoaphuc.com", "www.tunglamhoaphuc.com", "tlhp-web.example.workers.dev"])(
			"does nothing on %s (the end-to-end tests and the other hosts run as before)",
			async (host) => {
				for (const path of ["/", "/gioi-thieu", "/dong-chay-hoang-phap/a", "/quan-tri"]) {
					const hit = await redirectFor(host, path);
					// www and the bare domain have their own rules; none of them is the admin host's
					expect(hit?.destination ?? "", `${host}${path}`).not.toBe("/quan-tri");
					if (host !== "www.tunglamhoaphuc.com") expect(hit, `${host}${path}`).toBeNull();
				}
			},
		);
	});

	it("names the same public hosts as the code that hides internal pages", () => {
		for (const host of ["www.tunglamhoaphuc.com", "tunglamhoaphuc.com"]) expect(isPublicHost(host)).toBe(true);
	});
});
