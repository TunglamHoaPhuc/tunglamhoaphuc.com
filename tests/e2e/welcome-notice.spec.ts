import { expect, test } from "@playwright/test";

// The home page's welcome notice and its "Lời chào" block once shared the class `tlhp-welcome`:
// the notice's styles (a fixed full-screen layer at z-index 9999) then laid the whole Lời chào
// block over the page (live 22/11/2026). Each keeps its own class now.
const SEEN_KEY = "tlhp_welcome_notice_v1_0";

const layout = (el: Element) => {
	const box = el.getBoundingClientRect();
	return { position: getComputedStyle(el).position, top: Math.round(box.top + window.scrollY) };
};

test.describe("home page welcome", () => {
	test("Lời chào stays in the page flow, below the hero, when the notice was closed before", async ({ page }) => {
		await page.addInitScript((key) => window.localStorage.setItem(key, "seen"), SEEN_KEY);
		await page.goto("/");
		await page.waitForTimeout(1500);
		await expect(page.locator("dialog")).toHaveCount(0);
		const welcome = await page.locator("section.tlhp-welcome").evaluate(layout);
		expect(welcome.position).not.toBe("fixed");
		const hero = await page.locator(".tlhp-hero").evaluate((el) => Math.round(el.getBoundingClientRect().bottom + window.scrollY));
		expect(welcome.top).toBeGreaterThanOrEqual(hero);
	});

	test("on a first visit the notice opens in its own layer and Lời chào stays in the flow", async ({ page }) => {
		await page.goto("/");
		const notice = page.locator("dialog.tlhp-welcome-notice");
		await expect(notice).toBeVisible({ timeout: 5000 });
		expect((await notice.evaluate(layout)).position).toBe("fixed");
		expect((await page.locator("section.tlhp-welcome").evaluate(layout)).position).not.toBe("fixed");
		await notice.getByRole("button", { name: "Đóng thông báo" }).click();
		await expect(notice).toHaveCount(0);
	});
});
