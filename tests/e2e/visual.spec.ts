import { expect, test } from "@playwright/test";

// Before–after screenshots for work that must not change how pages look (T41a: CSS cut down,
// fewer client components). On demand only, because the pages show live data and day counts:
//   VISUAL=1 npx playwright test visual --update-snapshots   (on the build before the change)
//   VISUAL=1 npx playwright test visual                      (on the build after)
// The screenshots stay out of git (see .gitignore).
const PAGES = [
	["home", "/"],
	["list", "/dong-chay-hoang-phap"],
	["article", "/dong-chay-hoang-phap/cong-tu-phap-hoi-niem-phat-thang-7-nam-binh-ngo-2026-2"],
	["calendar", "/lich-tu-hoc?thang=2026-11"],
	["about-topic", "/gioi-thieu/tieu-su-su-to"],
	["area", "/vu-tru-phat-giao/tam-bao"],
	["styleguide", "/styleguide"],
] as const;

test.describe("pages look the same", () => {
	test.skip(!process.env.VISUAL, "on demand: VISUAL=1");
	test.use({ reducedMotion: "reduce" });

	for (const [name, path] of PAGES) {
		test(name, async ({ page }) => {
			await page.goto(path, { waitUntil: "load" });
			await page.evaluate(() => document.fonts.ready);
			// Lazy pictures without a size are 0 px until they load: load those first. Sized ones
			// keep their box either way (and an album of 100 originals would not load in time).
			await page.evaluate(async () => {
				const images = [...document.images].filter((image) => !image.getAttribute("width"));
				for (const image of images) image.loading = "eager";
				await Promise.all(images.map((image) => image.complete || new Promise((done) => ((image.onload = image.onerror = done), setTimeout(done, 8000)))));
			});
			await page.waitForTimeout(1500);
			// Pictures are masked: lazy ones still arrive while the page is shot, and this checks
			// layout and styles, not the editors' photos.
			await expect(page).toHaveScreenshot(`${name}.png`, {
				fullPage: true,
				animations: "disabled",
				mask: [page.locator("img, iframe")],
				maxDiffPixelRatio: 0.002,
				timeout: 20_000,
			});
		});
	}
});
