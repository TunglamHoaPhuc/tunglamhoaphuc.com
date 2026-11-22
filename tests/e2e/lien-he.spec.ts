import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { site } from "../../src/config/site";

// T18: /lien-he from the site's own details (src/config/site.ts): no form until it has
// somewhere to send to; the temple's Google map is embedded (a lazy iframe).
const PATH = "/lien-he";

async function open(page: Page, width = 1440) {
	await page.setViewportSize({ width, height: 900 });
	const response = await page.goto(PATH);
	await page.waitForTimeout(1500);
	return response;
}

test.describe("Liên hệ", () => {
	test.use({ reducedMotion: "reduce" });

	test("says where the temple is, whom to call and when it is open", async ({ page }) => {
		const response = await open(page);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle("Liên hệ – Tùng Lâm Hòa Phúc");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Liên hệ");
		await expect(page.locator(".tlhp-contact-grid .contact-title")).toHaveText(["Địa chỉ", "Gọi điện", "Giờ mở cửa", "Khóa tu, cộng tu"]);
		await expect(page.locator(".tlhp-contact-grid")).toContainText(site.address);
		await expect(page.locator(".tlhp-contact-grid")).toContainText(site.openingHours);
		await expect(page.locator(".tlhp-contact-grid").getByRole("link", { name: "0979.345.373" })).toHaveAttribute("href", `tel:${site.phone}`);
		const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
	});

	test("lists every contact by role, each number a call link at least 48px high", async ({ page, isMobile }) => {
		await open(page, isMobile ? 375 : 1440);
		const book = page.locator(".tlhp-contact-book");
		await expect(book.locator(".tlhp-contact-role")).toHaveText(["Trưởng ban lãnh chúng", "Thư ký", "Hỗ trợ thông tin"]);
		await expect(book.locator('a[href^="tel:"]')).toHaveCount(site.contacts.length);
		for (const link of await page.locator('main a[href^="tel:"]').all()) {
			expect((await link.boundingBox())!.height, (await link.textContent()) ?? "").toBeGreaterThanOrEqual(48);
		}
	});

	test("embeds the temple's Google map in a titled lazy iframe; Google Maps opens in a new tab", async ({ page }) => {
		await open(page);
		const frame = page.locator(".tlhp-contact-map iframe");
		await expect(page.locator("iframe")).toHaveCount(1);
		await expect(frame).toHaveAttribute("title", "Bản đồ đường đến chùa Tùng Lâm Hòa Phúc");
		await expect(frame).toHaveAttribute("src", "https://www.google.com/maps?q=20.9535019,105.5713597&z=17&output=embed");
		await expect(frame).toHaveAttribute("loading", "lazy");
		const box = (await frame.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(320);
		expect(box.height).toBeLessThanOrEqual(450);
		const button = page.locator(".tlhp-contact-map").getByRole("link", { name: /Mở Google Maps/ });
		await expect(button).toHaveAttribute("href", "https://maps.app.goo.gl/PSTtcjcJsaXvLCp37");
		await expect(button).toHaveAttribute("target", "_blank");
	});

	test("fits a phone screen", async ({ page }) => {
		await open(page, 375);
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
	});
});
