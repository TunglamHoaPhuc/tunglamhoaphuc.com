import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const MENU = ["Giới thiệu", "Tin tức – Pháp thoại", "Lịch tu học", "Đăng ký khóa tu", "Liên hệ"];

async function open(page: Page, width: number, path = "/") {
	await page.setViewportSize({ width, height: 800 });
	await page.goto(path);
	await page.waitForTimeout(1500);
}

// The header that is in view: Bexon renders two, and the other one is inert.
const liveHeader = (page: Page) => page.locator("header.header-area:not([inert])");

test.describe("desktop menu", () => {
	test.skip(({ isMobile }) => isMobile, "the horizontal menu starts at 1280px");

	test("shows the five agreed items from site.ts", async ({ page }) => {
		await open(page, 1440);
		const nav = liveHeader(page).getByRole("navigation", { name: "Menu chính" });
		await expect(nav.locator(":scope > ul > li > :is(a, button)")).toHaveText(MENU);
	});

	test("dropdowns open on click, not hover, and Esc returns focus", async ({ page }) => {
		await open(page, 1440);
		const header = liveHeader(page);
		const toggle = header.getByRole("button", { name: "Giới thiệu" });
		const panel = header.locator(`#${await toggle.getAttribute("aria-controls")}`);

		await toggle.hover();
		await page.waitForTimeout(600);
		await expect(panel).toBeHidden();

		await toggle.focus();
		await page.keyboard.press("Enter");
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await expect(panel).toBeVisible();
		await page.keyboard.press("Tab");
		await expect(panel.getByRole("link").first()).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await expect(toggle).toBeFocused();
		await expect(panel).toBeHidden();
	});

	test("a dropdown closes when focus or a click moves elsewhere", async ({ page }) => {
		await open(page, 1440);
		const header = liveHeader(page);
		const about = header.getByRole("button", { name: "Giới thiệu" });
		const news = header.getByRole("button", { name: "Tin tức – Pháp thoại" });

		await about.click();
		await expect(about).toHaveAttribute("aria-expanded", "true");
		await news.focus();
		await expect(about).toHaveAttribute("aria-expanded", "false");

		await news.click();
		await expect(news).toHaveAttribute("aria-expanded", "true");
		await page.mouse.click(700, 600);
		await expect(news).toHaveAttribute("aria-expanded", "false");
	});

	test("Tab reaches every menu item and header action", async ({ page }) => {
		await open(page, 1440);
		await page.locator("body").press("Tab");
		const reached: string[] = [];
		for (let i = 0; i < 12; i++) {
			reached.push(await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "").trim()));
			await page.keyboard.press("Tab");
		}
		for (const name of [...MENU, "Gọi điện 0979.345.373", "Chỉ đường đến chùa (mở Google Maps)"]) expect(reached).toContain(name);
	});

	// Bexon removed every focus outline; keyboard users must see where they are.
	test("a focused menu link shows a focus ring", async ({ page }) => {
		await open(page, 1440);
		await page.locator("body").press("Tab");
		for (let i = 0; i < 12; i++) {
			if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Lịch tu học") break;
			await page.keyboard.press("Tab");
		}
		const ring = await page.evaluate(() => {
			const style = getComputedStyle(document.activeElement!);
			return { text: document.activeElement!.textContent!.trim(), outline: style.outlineStyle, width: parseFloat(style.outlineWidth) };
		});
		expect(ring.text).toBe("Lịch tu học");
		expect(ring.outline).toBe("solid");
		expect(ring.width).toBeGreaterThanOrEqual(2);
	});
});

test.describe("one header at a time", () => {
	test("the sticky copy is inert until it slides in, then the floating header is", async ({ page, isMobile }) => {
		await open(page, isMobile ? 412 : 1440);
		await expect(liveHeader(page)).toHaveCount(1);
		await expect(liveHeader(page)).toHaveClass(/header-absolute/);

		await page.mouse.wheel(0, 1800);
		await page.waitForTimeout(1200);
		await page.mouse.wheel(0, -300);
		await expect(page.locator("header.header-sticky")).toHaveClass(/sticky/);
		await expect(liveHeader(page)).toHaveCount(1);
		await expect(liveHeader(page)).toHaveClass(/header-sticky/);
	});

	test("axe finds no duplicate landmarks and no header issues", async ({ page, isMobile }) => {
		await open(page, isMobile ? 412 : 1440);
		const landmarks = await new AxeBuilder({ page }).withRules(["landmark-unique", "landmark-no-duplicate-banner", "landmark-banner-is-top-level"]).analyze();
		expect(landmarks.violations.map((v) => v.id)).toEqual([]);
		const header = await new AxeBuilder({ page }).include("header.header-area:not([inert])").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		expect(header.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
	});
});

test.describe("mobile menu", () => {
	test("opens as a dialog, keeps focus inside, Esc closes and returns focus", async ({ page }) => {
		await open(page, 375);
		const toggle = liveHeader(page).getByRole("button", { name: "Mở menu" });
		await toggle.click();
		// Each of the two headers owns a panel; the closed one is inert.
		const dialog = page.locator('[role="dialog"][aria-label="Menu"]:not([inert])');
		await expect(dialog).toBeVisible();
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		// Focus moves into the panel by itself once it has slid in.
		await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

		for (let i = 0; i < 25; i++) {
			await page.keyboard.press("Tab");
			expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
		}

		const about = dialog.getByRole("button", { name: "Giới thiệu" });
		await about.click();
		await expect(about).toHaveAttribute("aria-expanded", "true");
		await expect(dialog.getByRole("link", { name: "Chư Tôn Đức" })).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(toggle).toBeFocused();
	});
});

// The old site cut menu labels at 1024px; check every width the plan names.
for (const width of [375, 768, 1024, 1280, 1440]) {
	test(`header fits on one row without overflow at ${width}px`, async ({ page, isMobile }) => {
		test.skip(isMobile && width > 412, "the phone project only covers phone widths");
		await open(page, width);
		const layout = await liveHeader(page).evaluate((header) => {
			const wrapper = header.querySelector(".header-wrapper")!;
			const items = [...wrapper.children].filter((el) => el.getClientRects().length);
			const centres = items.map((el) => {
				const r = el.getBoundingClientRect();
				return r.top + r.height / 2;
			});
			const clipped = [...header.querySelectorAll(".mainmenu > ul > li > :is(a, button), .tlhp-logo-name, .btn-text")]
				.filter((el) => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
				.map((el) => el.textContent);
			return {
				pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
				rowSpread: Math.round(Math.max(...centres) - Math.min(...centres)),
				clipped,
			};
		});
		expect(layout.pageOverflow).toBeLessThanOrEqual(0);
		expect(layout.rowSpread).toBeLessThan(12);
		expect(layout.clipped).toEqual([]);
	});
}
