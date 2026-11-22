import { expect, test } from "@playwright/test";

// RV-11 (3): the footer names the evening repentance service and its lunar days.
test("the footer shows the repentance hour and days", async ({ page }) => {
	await page.goto("/");
	const footer = page.locator("footer.tlhp-footer");
	await expect(footer.getByText("Sám hối", { exact: true })).toBeVisible();
	await expect(footer).toContainText("19:00");
	await expect(footer).toContainText("ngày 8, 14, 23 và 29 (hoặc 30) âm lịch");
});
