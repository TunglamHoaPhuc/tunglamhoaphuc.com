import { expect, test } from "@playwright/test";

// T41f: fonts and the start of the effects on the home page, the two largest costs found
// on 04/11 (PageSpeed on a phone: 44, TBT 1,380 ms). Before: 20 font preloads and 27 files
// (719 KB), the latin-ext faces of Google's CSS winning over the small Vietnamese ones for
// ă đ ơ ư; and every effect started in one task of 1.5–1.8 s on a phone with the CPU 4x slower.
test.describe("fonts", () => {
	test("the home page preloads only the upright text faces and loads at most 200 KB of fonts", async ({ page }) => {
		const files = new Map<string, number>();
		page.on("response", async (response) => {
			if (response.request().resourceType() !== "font") return;
			files.set(response.url(), (await response.body().catch(() => Buffer.alloc(0))).length);
		});
		await page.goto("/");
		// Be Vietnam Pro 400–700 and Noto Serif, each latin and vietnamese: 10 files, no italic.
		const preloads = page.locator('link[rel="preload"][as="font"]');
		await expect(preloads).toHaveCount(10);
		expect((await preloads.evaluateAll((links) => links.map((link) => link.getAttribute("href")!))).filter((href) => /italic/.test(href))).toEqual([]);
		await page.mouse.wheel(0, 20_000);
		await page.waitForTimeout(3000);
		const kb = [...files.values()].reduce((sum, size) => sum + size, 0) / 1024;
		expect(kb, [...files.keys()].join("\n")).toBeLessThanOrEqual(200);
		expect([...files.keys()].filter((url) => !/\.woff2(\?|$)/.test(url))).toEqual([]);
	});

	test("Vietnamese headings and text still use Noto Serif and Be Vietnam Pro", async ({ page }) => {
		await page.goto("/");
		await page.evaluate(() => document.fonts.ready);
		const ready = await page.evaluate(() =>
			["600 32px 'Noto Serif'", "400 16px 'Be Vietnam Pro'", "700 16px 'Be Vietnam Pro'"].map((font) => document.fonts.check(font, "Đường ơn ư ặ ữ")),
		);
		expect(ready).toEqual([true, true, true]);
	});
});

test.describe("the effects start in small steps", () => {
	test.skip(({ isMobile }) => !isMobile, "measured on the phone, with the CPU slowed like Lighthouse");

	test("no task on load lasts over 800 ms", async ({ page, context }) => {
		const cdp = await context.newCDPSession(page);
		await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
		await page.addInitScript(() => {
			const tasks: number[] = [];
			(window as unknown as { tasks: number[] }).tasks = tasks;
			new PerformanceObserver((list) => list.getEntries().forEach((entry) => tasks.push(Math.round(entry.duration)))).observe({ type: "longtask", buffered: true });
		});
		await page.goto("/", { waitUntil: "load" });
		await page.waitForTimeout(6000);
		const tasks = await page.evaluate(() => (window as unknown as { tasks: number[] }).tasks);
		expect(Math.max(0, ...tasks), tasks.join(", ")).toBeLessThan(800);
	});
});
