import { expect, test, type Page } from "@playwright/test";

// The one switch for everything that moves by itself (WCAG 2.2.2): the sliders and sliding rows
// carry no button of their own, the page carries a single toggle that stops them all, keeps the
// choice for the next visit, and is not drawn when the visitor asked for reduced motion.
type SwiperEl = HTMLElement & { swiper?: { autoplay: { running: boolean } } };

const toggle = (page: Page) => page.getByRole("button", { name: "Dừng chuyển động của trang" });

async function open(page: Page, path: string) {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(path);
	// React has attached once the toggle knows its state.
	await expect(toggle(page)).toHaveAttribute("aria-pressed", /true|false/);
	await page.waitForFunction(() => Object.keys(document.querySelector(".tlhp-motion-toggle")!).some((key) => key.startsWith("__reactProps")), undefined, { timeout: 20_000 });
	await page.waitForTimeout(1200);
}

const running = (page: Page) => page.locator(".swiper").evaluateAll((els) => els.filter((el) => (el as SwiperEl).swiper?.autoplay).map((el) => (el as SwiperEl).swiper!.autoplay.running));
const marqueeState = (page: Page) => page.locator(".tlhp-marquee-track").first().evaluate((el) => getComputedStyle(el).animationPlayState);

test.describe("the page's switch for movement", () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			try {
				window.localStorage.removeItem("tlhp-motion-hold");
			} catch {
				// Storage blocked: the switch still works for the page.
			}
		});
	});

	test("there is one toggle, a named 44px button, and no pause button of any slider", async ({ page }) => {
		await open(page, "/");
		await expect(toggle(page)).toHaveCount(1);
		await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
		const box = (await toggle(page).boundingBox())!;
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
		await expect(page.locator(".tlhp-pause")).toHaveCount(0);
	});

	test("pressing it stops every slider and sliding row, pressing again starts them", async ({ page }) => {
		await open(page, "/");
		expect((await running(page)).some(Boolean), "some slider runs by itself").toBe(true);
		expect(await marqueeState(page)).toBe("running");

		await toggle(page).click();
		await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
		await expect(page.locator("html")).toHaveAttribute("data-motion-hold", "");
		await expect.poll(async () => (await running(page)).some(Boolean)).toBe(false);
		expect(await marqueeState(page)).toBe("paused");

		await toggle(page).click();
		await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
		await expect.poll(async () => (await running(page)).some(Boolean)).toBe(true);
		expect(await marqueeState(page)).toBe("running");
	});

	test("the choice is kept: a page opened later stays still", async ({ page }) => {
		await open(page, "/");
		await toggle(page).click();
		await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
		// The init script of beforeEach clears the choice on every load, so set it back first.
		await page.addInitScript(() => window.localStorage.setItem("tlhp-motion-hold", "1"));
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
		await expect.poll(async () => (await running(page)).some(Boolean)).toBe(false);
		expect(await marqueeState(page)).toBe("paused");
	});

	test("a hand on a slider's arrow does not hold it for good: only the switch and keyboard focus do", async ({ page }) => {
		await open(page, "/");
		await page.locator("button.tlhp-arrow").first().click();
		await page.mouse.move(5, 5);
		await expect.poll(async () => (await running(page)).some(Boolean), { timeout: 5000 }).toBe(true);
	});

	test("with reduced motion nothing moves and the switch is not drawn", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto("/");
		await expect(page.locator(".tlhp-motion-toggle")).toBeHidden();
	});
});
