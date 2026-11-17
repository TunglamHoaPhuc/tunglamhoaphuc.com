import { expect, test } from "@playwright/test";

// The few checks to run first on any copy of the site, including the public one after the
// switch (T22): BASE_URL=https://www.tunglamhoaphuc.com npm run test:e2e -- smoke
const BASE = process.env.BASE_URL ?? "";
const ON_PUBLIC_SITE = /^https?:\/\/(www\.)?tunglamhoaphuc\.com(\/|$)/.test(BASE);
const LOCAL = !BASE || /localhost|127\.0\.0\.1/.test(BASE);

test("home page renders on the Worker, and indexing follows the host", async ({ page }) => {
	const response = await page.goto("/");
	expect(response?.status()).toBe(200);
	// The public site may be indexed; every other copy (v2., local) stays out.
	const robotsHeader = response?.headers()["x-robots-tag"];
	if (ON_PUBLIC_SITE) expect(robotsHeader).toBeUndefined();
	else expect(robotsHeader).toBe("noindex, nofollow");
	await expect(page.locator("header").first()).toBeVisible();
	await expect(page.locator("h1").first()).toBeAttached();
});

test("unknown URLs return a real 404", async ({ request }) => {
	const response = await request.get("/khong-ton-tai-trang-nay");
	expect(response.status()).toBe(404);
});

test("the main pages answer 200", async ({ request }) => {
	for (const path of ["/gioi-thieu", "/tong-chi-tu-hoc", "/dong-chay-hoang-phap", "/vu-tru-phat-giao", "/bao-tuong-phat-giao", "/tri-tue-phat-phap", "/lich-tu-hoc", "/lien-he", "/sitemap.xml", "/robots.txt"]) {
		expect((await request.get(path)).status(), path).toBe(200);
	}
});

test("on the public site, the old admin addresses lead to quantri.", async ({ request }) => {
	test.skip(!ON_PUBLIC_SITE && !LOCAL, "only the public site, or a local build asked as the public host");
	const headers = ON_PUBLIC_SITE ? undefined : { host: "www.tunglamhoaphuc.com" };
	for (const path of ["/admin", "/admin/posts", "/login", "/van-hanh/lam-moi"]) {
		const response = await request.get(path, { headers, maxRedirects: 0 });
		expect(response.status(), path).toBe(307);
		expect(response.headers().location, path).toBe(`https://quantri.tunglamhoaphuc.com${path}`);
	}
});
