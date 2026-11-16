import { expect, test, type Page } from "@playwright/test";

// The search popup is on every page (T18); /styleguide also previews a sample notice, which
// real pages do not have yet.
async function open(page: Page, path: string, width = 1440) {
	await page.setViewportSize({ width, height: 800 });
	await page.goto(path);
	await page.waitForTimeout(1500);
}

const liveHeader = (page: Page) => page.locator("header.header-area:not([inert])");
const searchToggle = (page: Page) => liveHeader(page).getByRole("button", { name: "Tìm kiếm", exact: true });
const searchDialog = (page: Page) => liveHeader(page).locator('[role="dialog"][aria-label="Tìm kiếm"]');

// Under load the first click can land before React has hydrated the header, so retry.
async function openSearch(page: Page) {
	await expect(async () => {
		await searchToggle(page).click();
		await expect(searchDialog(page)).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 8000 });
}

test.describe("search popup", () => {
	for (const width of [1440, 768]) {
		test(`opens as a dialog, keeps focus inside and Esc returns focus (${width}px)`, async ({ page }) => {
			await open(page, "/styleguide", width);
			const toggle = searchToggle(page);
			const dialog = searchDialog(page);
			await openSearch(page);
			await expect(toggle).toHaveAttribute("aria-expanded", "true");
			await expect(dialog.getByRole("searchbox", { name: "Từ khóa tìm kiếm" })).toBeFocused();

			for (let i = 0; i < 6; i++) {
				await page.keyboard.press("Tab");
				expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
			}

			await page.keyboard.press("Escape");
			await expect(dialog).toBeHidden();
			await expect(toggle).toBeFocused();
			await expect(toggle).toHaveAttribute("aria-expanded", "false");
		});
	}

	test("the close button and a press outside close it too", async ({ page, isMobile }) => {
		// The header search button starts at 576px; phones search from the menu panel.
		await open(page, "/styleguide", isMobile ? 768 : 1440);
		const toggle = searchToggle(page);
		const dialog = searchDialog(page);

		await openSearch(page);
		await dialog.getByRole("button", { name: "Đóng tìm kiếm" }).click();
		await expect(dialog).toBeHidden();
		await expect(toggle).toBeFocused();

		await toggle.click();
		await expect(dialog).toBeVisible();
		await page.mouse.click(200, 700);
		await expect(dialog).toBeHidden();
	});

	test("sends GET /tim-kiem?q=", async ({ page }) => {
		await open(page, "/styleguide");
		await openSearch(page);
		await expect(searchDialog(page).getByRole("searchbox", { name: "Từ khóa tìm kiếm" })).toBeFocused();
		await page.keyboard.type("Vu Lan báo hiếu");
		await page.keyboard.press("Enter");
		await page.waitForURL(/\/tim-kiem\?/);
		expect(new URL(page.url()).searchParams.get("q")).toBe("Vu Lan báo hiếu");
	});

	test("on phones, search sits in the menu panel instead of the header", async ({ page }) => {
		await open(page, "/styleguide", 375);
		await expect(liveHeader(page).getByRole("button", { name: "Tìm kiếm", exact: true })).toBeHidden();
		await liveHeader(page).getByRole("button", { name: "Mở menu" }).click();
		const panel = page.locator('[role="dialog"][aria-label="Menu"]:not([inert])');
		const box = panel.getByRole("searchbox", { name: "Từ khóa tìm kiếm" });
		await expect(box).toBeVisible();
		await box.fill("Vu Lan");
		await box.press("Enter");
		await page.waitForURL(/\/tim-kiem\?/);
		expect(new URL(page.url()).searchParams.get("q")).toBe("Vu Lan");
	});

	// The search button adds one more item to the header; it must still fit on one row.
	for (const width of [375, 768, 1024, 1280, 1440]) {
		test(`with search on, the header stays on one row at ${width}px`, async ({ page, isMobile }) => {
			test.skip(isMobile && width > 412, "the phone project only covers phone widths");
			await open(page, "/styleguide", width);
			const spread = await liveHeader(page).evaluate((header) => {
				const items = [...header.querySelector(".header-wrapper")!.children].filter((el) => el.getClientRects().length);
				const centres = items.map((el) => el.getBoundingClientRect()).map((r) => r.top + r.height / 2);
				return Math.round(Math.max(...centres) - Math.min(...centres));
			});
			expect(spread).toBeLessThan(12);
		});
	}

	// The flag is on since /tim-kiem exists (T18): every page can search.
	for (const path of ["/", "/dong-chay-hoang-phap", "/lien-he"]) {
		test(`${path} searches through the header`, async ({ page, isMobile }) => {
			await open(page, path, isMobile ? 375 : 1440);
			await expect(page.locator('form[action="/tim-kiem"]').first()).toBeAttached();
			if (!isMobile) await expect(searchToggle(page)).toBeVisible();
		});
	}
});

test.describe("notice strip", () => {
	test("sits in the flow above the floating header", async ({ page, isMobile }) => {
		await open(page, "/styleguide", isMobile ? 375 : 1440);
		const bar = page.getByRole("complementary", { name: "Thông báo của nhà chùa" });
		await expect(bar).toBeVisible();
		const [barBox, headerBox] = [await bar.boundingBox(), await liveHeader(page).boundingBox()];
		expect(barBox!.y).toBeLessThanOrEqual(1);
		expect(barBox!.height).toBeGreaterThanOrEqual(48);
		expect(headerBox!.y).toBeGreaterThanOrEqual(barBox!.y + barBox!.height - 1);
		expect(await bar.evaluate((el) => getComputedStyle(el).position)).not.toMatch(/fixed|sticky/);
	});

	test("Đóng hides it for the rest of the session only", async ({ page, browser }) => {
		await open(page, "/styleguide");
		const bar = page.getByRole("complementary", { name: "Thông báo của nhà chùa" });
		await bar.getByRole("button", { name: "Đóng" }).click();
		await expect(bar).toBeHidden();
		await expect(liveHeader(page).locator(".logo")).toBeFocused();
		const headerTop = (await liveHeader(page).boundingBox())!.y;
		expect(headerTop).toBeLessThan(40);

		// Same tab, next page load: still closed, with no flash before the script runs.
		await page.reload();
		await page.waitForLoadState("domcontentloaded");
		await expect(bar).toBeHidden();

		// A new session shows it again.
		const fresh = await browser.newPage({ viewport: { width: 1440, height: 800 } });
		await fresh.goto(page.url());
		await expect(fresh.getByRole("complementary", { name: "Thông báo của nhà chùa" })).toBeVisible();
		await fresh.close();
	});

	test("does not move the sticky header", async ({ page }) => {
		await open(page, "/styleguide");
		await page.mouse.wheel(0, 1800);
		await page.waitForTimeout(1200);
		await page.mouse.wheel(0, -300);
		const sticky = page.locator("header.header-sticky");
		await expect(sticky).toHaveClass(/sticky/);
		// It slides in over 0.9 s, then rests at the very top.
		await expect.poll(async () => Math.round((await sticky.boundingBox())!.y), { timeout: 3000 }).toBe(0);
	});

	test("real pages show nothing while site.ts has no notice", async ({ page }) => {
		await open(page, "/");
		await expect(page.locator(".tlhp-announcement")).toHaveCount(0);
		const offset = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tlhp-announcement-offset"));
		expect(offset.trim() || "0px").toBe("0px");
	});
});
