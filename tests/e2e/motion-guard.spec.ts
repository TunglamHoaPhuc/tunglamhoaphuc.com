import { expect, test, type Page } from "@playwright/test";

// Pages kept from the Bexon template. Every new route should be added here.
const PAGES = ["/", "/blogs", "/services", "/portfolios", "/team", "/contact", "/styleguide"];

type SliderElement = HTMLElement & { swiper?: { autoplay?: { running?: boolean } } };

async function settle(page: Page, path: string) {
	await page.goto(path);
	await page.waitForTimeout(2500);
}

test.describe("no popups or toasts", () => {
	for (const path of PAGES) {
		test(`${path} opens no dialog or toast on load`, async ({ page }) => {
			await settle(page, path);
			const floating = page.locator(
				'[role="dialog"]:visible, [role="alertdialog"]:visible, [aria-modal="true"]:visible, .swal2-container, .modal.show',
			);
			await expect(floating).toHaveCount(0);
		});
	}
});

test.describe("reduced motion turns every effect off", () => {
	test.use({ reducedMotion: "reduce" });

	for (const path of PAGES) {
		test(`${path} shows content at once and keeps sliders still`, async ({ page }) => {
			await settle(page, path);
			await page.mouse.wheel(0, 1500);
			await page.waitForTimeout(500);

			const state = await page.evaluate(() => {
				const smooth = document.querySelector<HTMLElement>("#smooth-content");
				const hiddenTitles = [...document.querySelectorAll(".title-anim, .text-anim, .hero-text-anim")].filter(
					(el) => getComputedStyle(el).opacity !== "1",
				).length;
				const hiddenWow = [...document.querySelectorAll<HTMLElement>(".wow")].filter(
					(el) => getComputedStyle(el).visibility === "hidden",
				).length;
				const runningSliders = [...document.querySelectorAll<SliderElement>(".swiper")].filter(
					(el) => el.swiper?.autoplay?.running,
				).length;
				return {
					smoothTransform: smooth ? getComputedStyle(smooth).transform : "none",
					hiddenTitles,
					hiddenWow,
					runningSliders,
				};
			});

			expect(state).toEqual({ smoothTransform: "none", hiddenTitles: 0, hiddenWow: 0, runningSliders: 0 });
		});
	}
});

test.describe("smooth scrolling keeps the page usable", () => {
	test.skip(({ isMobile }) => isMobile, "keyboard and find-in-page are desktop interactions");

	test("effects are on when motion is allowed", async ({ page }) => {
		await settle(page, "/");
		await page.mouse.wheel(0, 1500);
		await page.waitForTimeout(800);
		const transform = await page.locator("#smooth-content").evaluate((el) => getComputedStyle(el).transform);
		expect(transform).not.toBe("none");
	});

	test("keyboard scrolling moves the page", async ({ page }) => {
		await settle(page, "/");
		await page.locator("body").click({ position: { x: 5, y: 400 } });
		await page.keyboard.press("PageDown");
		await page.keyboard.press("PageDown");
		await page.waitForTimeout(800);
		expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
	});

	// Ctrl+F, Tab focus and anchor links all reveal a target the way scrollIntoView does:
	// by scrolling the smooth-scroll wrapper. The view must glide to the target and stay
	// in sync, so a wheel scroll afterwards continues from there instead of jumping back.
	// /styleguide has almost no other ScrollTriggers, which once hid a bug where the
	// content never moved.
	for (const [path, selector] of [
		["/", "footer a"],
		["/styleguide", ".tlhp-dark a"],
	]) {
		test(`revealing an off-screen element keeps scrolling in sync on ${path}`, async ({ page }) => {
			await settle(page, path);
			const target = page.locator(selector).last();
			await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
			// The browser shows the target at once by scrolling the wrapper; it only counts once
			// the page itself has scrolled there and the wrapper is back at 0.
			const revealed = () =>
				target.evaluate((el) => {
					const rect = el.getBoundingClientRect();
					const wrapper = document.querySelector("#smooth-wrapper")!;
					return rect.top >= 0 && rect.bottom <= window.innerHeight && wrapper.scrollTop === 0 && window.scrollY > 1000;
				});
			await expect.poll(revealed, { timeout: 4000 }).toBe(true);
			const revealedY = await page.evaluate(() => Math.round(window.scrollY));

			await page.mouse.wheel(0, -200);
			await page.waitForTimeout(1500);
			expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(revealedY - 600);
		});
	}

	// ScrollSmoother glides to a focused element itself (about 1.5 s with smooth: 1.5).
	test("keyboard focus reveals the focused link", async ({ page }) => {
		await settle(page, "/");
		const target = page.locator("footer a").last();
		await target.focus();
		await expect
			.poll(
				() =>
					target.evaluate((el) => {
						const rect = el.getBoundingClientRect();
						return rect.top >= 0 && rect.bottom <= window.innerHeight;
					}),
				{ timeout: 4000 },
			)
			.toBe(true);
	});

	test("back-to-top returns to the top", async ({ page }) => {
		await settle(page, "/");
		await page.mouse.wheel(0, 3000);
		await page.waitForTimeout(1200);
		await page.locator("#tj-back-to-top").click();
		await page.waitForTimeout(2500);
		expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
	});
});
