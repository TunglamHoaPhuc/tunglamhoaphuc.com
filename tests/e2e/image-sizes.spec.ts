import { expect, test, type APIRequestContext } from "@playwright/test";

// Pictures of the old site through Cloudflare's image transformations on this zone (after
// T41c, in place of T41d's copies on R2). The transformations run only on Cloudflare's edge,
// so those checks skip on the local build; /anh-goc/ is checked everywhere.
const ARTICLE = "/dong-chay-hoang-phap/cong-tu-phap-hoi-niem-phat-thang-7-nam-binh-ngo-2026-2";
const B2_KEY = "tunglamhoaphuc2/03-dong-chay-hoang-phap/dai-le-su-kien/2-2-scaled.jpg";

async function picture(request: APIRequestContext, url: string) {
	const response = await request.get(url, { headers: { Accept: "image/avif,image/webp,*/*" } });
	return { ok: response.ok(), type: response.headers()["content-type"] ?? "", kb: (await response.body()).length / 1024 };
}

test.describe("transformed pictures", () => {
	test.skip(({ baseURL }) => /localhost|127\.0\.0\.1/.test(baseURL ?? ""), "image transformations run only on Cloudflare");

	test("the article banner, a 7.9 MB original, comes at 1280 px in under 300 KB", async ({ page, request }) => {
		await page.goto(ARTICLE);
		const src = await page.locator(".tlhp-article-banner img").getAttribute("src");
		expect(src).toMatch(/^\/cdn-cgi\/image\/width=1280,.*onerror=redirect\/https:\/\/admin\.tunglamhoaphuc\.com\//);
		// Not asked for first: past the monthly quota it would be the 7.9 MB original again.
		await expect(page.locator(".tlhp-article-banner img")).toHaveAttribute("fetchpriority", "low");
		const result = await picture(request, src!);
		expect(result.ok).toBe(true);
		expect(result.type).toMatch(/^image\/(avif|webp)$/);
		expect(result.kb).toBeLessThan(300);
	});

	test("list cards come at 640 px, B2 ones through /anh-goc/, each under 80 KB", async ({ page, request }) => {
		await page.goto("/dong-chay-hoang-phap");
		const sources = await page.locator(".tlhp-post-card .blog-thumb img").evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src")!));
		expect(sources.length).toBeGreaterThan(0);
		expect(sources.every((src) => src.startsWith("/cdn-cgi/image/width=640,"))).toBe(true);
		expect(sources.some((src) => src.includes("/anh-goc/"))).toBe(true);
		for (const src of sources.slice(0, 6)) {
			const result = await picture(request, src);
			expect(result.ok, src).toBe(true);
			expect(result.kb, src).toBeLessThan(80);
		}
	});

	test("an album transforms the WordPress originals and leaves the small B2 pictures", async ({ page }) => {
		await page.goto(ARTICLE);
		const items = await page.locator("#album-anh .tlhp-gallery-item").evaluateAll((links) =>
			links.map((link) => ({ href: link.getAttribute("href")!, src: link.querySelector("img")!.getAttribute("src")! })),
		);
		expect(items.length).toBeGreaterThan(0);
		for (const { href, src } of items) {
			if (src.includes("admin.tunglamhoaphuc.com")) {
				expect(src).toMatch(/^\/cdn-cgi\/image\/width=640,/);
				expect(href).toMatch(/^\/cdn-cgi\/image\/width=1920,/);
			} else {
				expect(src).not.toContain("/cdn-cgi/");
			}
		}
	});
});

test("every card picture of the list shows, here or on Cloudflare", async ({ page }) => {
	await page.goto("/dong-chay-hoang-phap");
	const pictures = page.locator(".tlhp-post-card .blog-thumb img");
	await pictures.first().scrollIntoViewIfNeeded();
	for (const img of (await pictures.all()).slice(0, 6)) {
		await img.scrollIntoViewIfNeeded();
		await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
	}
});

test.describe("/anh-goc/", () => {
	test("serves the old admin's B2 pictures, cached for a month", async ({ request }) => {
		const response = await request.get(`/anh-goc/s2-cnv03/${B2_KEY}`);
		expect(response.status()).toBe(200);
		expect(response.headers()["content-type"]).toMatch(/^image\//);
		expect(response.headers()["cache-control"]).toContain("max-age=2592000");
	});

	test("reads no other bucket and nothing that is not a picture", async ({ request }) => {
		expect((await request.get(`/anh-goc/another-bucket/${B2_KEY}`)).status()).toBe(404);
		expect((await request.get("/anh-goc/s2-cnv03/khong-co-tep-nay.jpg")).status()).toBe(404);
	});
});
