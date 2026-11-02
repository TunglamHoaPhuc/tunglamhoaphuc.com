import { expect, test } from "@playwright/test";

test("home page renders on the Worker and stays out of search engines", async ({ page }) => {
	const response = await page.goto("/");
	expect(response?.status()).toBe(200);
	expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
	await expect(page.locator("header").first()).toBeVisible();
	await expect(page.locator("h1").first()).toBeAttached();
});

test("unknown URLs return a real 404", async ({ request }) => {
	const response = await request.get("/khong-ton-tai-trang-nay");
	expect(response.status()).toBe(404);
});
