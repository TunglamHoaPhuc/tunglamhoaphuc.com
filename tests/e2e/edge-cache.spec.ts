import { expect, test, type APIRequestContext } from "@playwright/test";

// T41e: public pages come from Cloudflare's Workers Cache instead of being rendered on every
// view (TTFB 0.35–2.7 s and most of the Worker's CPU, on the Free plan's 10 ms a request). The
// cache lives on Cloudflare's edge, so these checks skip on the local build.
const CACHED = [
	"/",
	"/dong-chay-hoang-phap/cong-tu-phap-hoi-niem-phat-thang-7-nam-binh-ngo-2026-2",
	"/gioi-thieu/tieu-su-su-to",
	"/tong-chi-tu-hoc/niem-phat-phuong-phap-tro-hanh",
	"/vu-tru-phat-giao/tam-bao",
];

async function twice(request: APIRequestContext, path: string, headers: Record<string, string> = {}) {
	await request.get(path, { headers });
	const started = Date.now();
	const response = await request.get(path, { headers });
	return { response, ms: Date.now() - started, body: await response.text() };
}

test.describe("edge cache", () => {
	test.skip(({ baseURL }) => /localhost|127\.0\.0\.1/.test(baseURL ?? ""), "Workers Cache runs only on Cloudflare");
	test.skip(({ isMobile }) => isMobile, "headers do not depend on the screen");

	for (const path of CACHED) {
		test(`${path} is served from the cache the second time`, async ({ request }) => {
			const { response, body } = await twice(request, path);
			expect(response.status()).toBe(200);
			expect(response.headers()["content-type"]).toContain("text/html");
			expect(body).toContain("<html");
			expect(response.headers()["cf-cache-status"] ?? response.headers()["x-vinext-cache"] ?? "").toMatch(/HIT|STALE/i);
		});
	}

	test("the RSC payload of a page is cached apart from its HTML", async ({ request }) => {
		const path = CACHED[1];
		const html = await twice(request, path);
		const rsc = await twice(request, path, { RSC: "1" });
		expect(html.response.headers()["content-type"]).toContain("text/html");
		expect(rsc.response.headers()["content-type"]).not.toContain("text/html");
		expect(rsc.body).not.toContain("<html");
	});

	test("pages that are not public are never cached", async ({ request }) => {
		for (const path of ["/van-hanh/lam-moi", "/khong-co-trang-nay", "/anh-goc/another-bucket/a.jpg"]) {
			const { response } = await twice(request, path);
			expect(response.headers()["cf-cache-status"] ?? "", path).not.toMatch(/HIT/i);
		}
	});
});
