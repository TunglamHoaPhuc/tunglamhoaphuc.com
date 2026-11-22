import { expect, test, type Page } from "@playwright/test";
import { waitHydrated } from "./helpers/hydrated";

// Every slider has its two arrows (44px, named, from the keyboard too) and no pause button; the
// sliding row's arrows move it on by one item; a slider holds under the pointer and while focus is
// inside, and goes on when focus leaves. The Bexon blocks (Hero2, Blogs2, Portfolios2, Testimonials2,
// Brands2) are on the home page.
type SwiperEl = HTMLElement & { swiper?: { realIndex: number; autoplay: { running: boolean } } };

async function open(page: Page, width: number) {
	await page.setViewportSize({ width, height: 900 });
	await page.goto("/");
	await waitHydrated(page);
	await page.waitForTimeout(1200);
}

const state = (page: Page, selector: string) =>
	page.locator(selector).first().evaluate((el: SwiperEl) => ({ index: el.swiper!.realIndex, running: el.swiper!.autoplay.running }));

for (const width of [1440, 375]) {
	test.describe(`slider arrows at ${width}px`, () => {
		test("no pause button anywhere, and every arrow is a named 44px button", async ({ page }) => {
			await open(page, width);
			await expect(page.locator(".tlhp-pause")).toHaveCount(0);
			await expect(page.getByRole("button", { name: /Tạm dừng|Chạy tiếp/ })).toHaveCount(0);
			const arrows = page.locator("button.tlhp-arrow, .tlhp-hero .hero-navigation button");
			expect(await arrows.count()).toBeGreaterThanOrEqual(8);
			for (const arrow of await arrows.all()) {
				const name = await arrow.getAttribute("aria-label");
				expect(name, await arrow.innerHTML()).toBeTruthy();
				const box = (await arrow.boundingBox())!;
				expect(box.width, name!).toBeGreaterThanOrEqual(44);
				expect(box.height, name!).toBeGreaterThanOrEqual(44);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
		});

		test("the arrows of Khu vực nổi bật move it, and the frames are all one size", async ({ page }) => {
			await open(page, width);
			const section = page.locator(".tlhp-area-slider");
			await section.scrollIntoViewIfNeeded();
			const sizes = await section.locator(".swiper-slide .project-item").evaluateAll((items) =>
				items.map((item) => `${Math.round(item.getBoundingClientRect().width)}x${Math.round(item.getBoundingClientRect().height)}`),
			);
			expect(new Set(sizes).size).toBe(1);
			const [w, h] = sizes[0].split("x").map(Number);
			expect(w).toBeLessThanOrEqual(620);
			expect(h).toBeLessThanOrEqual(550);
			// Focus on the arrow holds the autoplay, so the frames only move by the presses.
			await section.getByRole("button", { name: "Khu vực kế tiếp" }).focus();
			await expect.poll(async () => (await state(page, ".tlhp-area-slider .swiper")).running).toBe(false);
			await page.waitForTimeout(1800);
			const before = (await state(page, ".tlhp-area-slider .swiper")).index;
			await page.keyboard.press("Enter");
			await expect.poll(async () => (await state(page, ".tlhp-area-slider .swiper")).index).not.toBe(before);
			// A looped Swiper takes no new step while the last one (1.5 s) is still moving.
			await page.waitForTimeout(1800);
			await section.getByRole("button", { name: "Khu vực trước" }).focus();
			await page.keyboard.press("Enter");
			await expect.poll(async () => (await state(page, ".tlhp-area-slider .swiper")).index).toBe(before);
		});

		test("focus inside holds a slider, focus leaving lets it go on", async ({ page }) => {
			await open(page, width);
			const section = page.locator(".tlhp-verses");
			await section.scrollIntoViewIfNeeded();
			expect((await state(page, ".tlhp-verses .swiper")).running).toBe(true);
			await section.getByRole("button", { name: "Câu kệ kế tiếp" }).focus();
			await expect.poll(async () => (await state(page, ".tlhp-verses .swiper")).running).toBe(false);
			await page.evaluate(() => (document.activeElement as HTMLElement).blur());
			await expect.poll(async () => (await state(page, ".tlhp-verses .swiper")).running).toBe(true);
		});

		test("the arrows of the sliding row move it on by one item each way, and the pointer stops it", async ({ page }) => {
			await open(page, width);
			const row = page.locator(".tlhp-entrances .tlhp-marquee");
			await row.scrollIntoViewIfNeeded();
			const time = () => row.locator(".tlhp-marquee-track").evaluate((el) => Number(el.getAnimations()[0].currentTime));
			const turn = await row.locator(".tlhp-marquee-track").evaluate((el) => Number(el.getAnimations()[0].effect!.getComputedTiming().duration));
			const distance = (a: number, b: number) => ((b - a) % turn + turn) % turn;
			const apart = (a: number, b: number) => Math.min(distance(a, b), distance(b, a));
			// Held by the focus on the arrow, the row stands still, so the step is all that moves it.
			const next = row.getByRole("button", { name: "Cuộn dải chuyên mục sang phải" });
			await next.focus();
			await expect.poll(() => row.locator(".tlhp-marquee-track").evaluate((el) => el.getAnimations()[0].playState)).toBe("paused");
			const start = await time();
			await next.press("Enter");
			await page.waitForTimeout(700);
			const forward = distance(start, await time());
			expect(forward).toBeGreaterThan(turn * 0.005);
			expect(forward).toBeLessThan(turn * 0.5);
			await row.getByRole("button", { name: "Cuộn dải chuyên mục sang trái" }).press("Enter");
			await page.waitForTimeout(700);
			expect(apart(start, await time())).toBeLessThan(turn * 0.001);
		});
	});
}

test("the sliding row stops on the spot under the pointer and goes on after", async ({ page, isMobile }) => {
	test.skip(isMobile, "a pointer");
	await open(page, 1440);
	const row = page.locator(".tlhp-entrances .tlhp-marquee");
	await row.scrollIntoViewIfNeeded();
	const track = row.locator(".tlhp-marquee-track");
	await row.locator(".tlhp-marquee-view").hover();
	await expect.poll(() => track.evaluate((el) => el.getAnimations()[0].playState)).toBe("paused");
	await page.mouse.move(2, 2);
	await expect.poll(() => track.evaluate((el) => el.getAnimations()[0].playState)).toBe("running");
});
