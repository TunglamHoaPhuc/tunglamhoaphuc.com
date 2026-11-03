import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// T9: the lightbox (useLightbox over Bexon's GLightbox) for albums and videos.
const PATH = "/dong-chay-hoang-phap";
const ALBUM = `${PATH}/phap-hoi-huyet-bon-trai`; // 30 photos
const BIG_ALBUM = `${PATH}/dem-van-nghe-hoa-phuc-got-talent-khoa-tu-tuoi-tre-chu-de-di-qua-kho-vui-cuoc-doi-2025`; // 170
const WITH_VIDEO = `${PATH}/le-tuong-niem-lan-thu-33-ngay-to-su-khai-son-chua-hoang-phap-vien-tich-chua-hoa-phuc`;

const lightbox = (page: Page) => page.locator(".glightbox-container");
const photos = (page: Page) => page.locator("#album-anh .tlhp-gallery-item");

async function open(page: Page, path: string) {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(path);
	await page.waitForTimeout(1500);
}

// Opened from the keyboard, as a keyboard user would.
async function openFrom(page: Page, link: ReturnType<Page["locator"]>) {
	await expect(async () => {
		await link.focus();
		await page.keyboard.press("Enter");
		await expect(lightbox(page)).toBeVisible({ timeout: 1500 });
	}).toPass({ timeout: 8000 });
}

test.use({ reducedMotion: "reduce" });

test.describe("video", () => {
	test("nothing is asked of YouTube until play, then only youtube-nocookie.com", async ({ page }) => {
		const requests: string[] = [];
		page.on("request", (request) => requests.push(request.url()));
		await open(page, WITH_VIDEO);
		await page.mouse.wheel(0, 3000);
		await page.waitForTimeout(1000);
		expect(requests.filter((url) => /youtube|ytimg|googlevideo|plyr/.test(url))).toEqual([]);

		await openFrom(page, page.locator("#video .tlhp-video"));
		const frame = lightbox(page).locator("iframe");
		await expect(frame).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}/);
		await expect(frame).toHaveAttribute("title", "Video");
		// Only the embed itself; GLightbox's Plyr player would load youtube.com and cdn.plyr.io.
		const pageRequests = requests.filter((url) => /youtube\.com|plyr/.test(url) && !/youtube-nocookie\.com/.test(url));
		expect(pageRequests).toEqual([]);
	});
});

test.describe("album lightbox", () => {
	test("opens on the photo, counts, steps with arrows, and Esc hands focus back", async ({ page }) => {
		await open(page, ALBUM);
		const third = photos(page).nth(2);
		await openFrom(page, third);
		await expect(lightbox(page).locator(".tlhp-lightbox-count")).toHaveText("3/30");
		await expect(lightbox(page).getByRole("button", { name: "Đóng" })).toBeFocused();
		await expect(lightbox(page).locator(".gslide.current img")).toHaveAttribute("alt", /ảnh 3$/);

		await page.keyboard.press("ArrowRight");
		await expect(lightbox(page).locator(".tlhp-lightbox-count")).toHaveText("4/30");
		await page.keyboard.press("ArrowLeft");
		await expect(lightbox(page).locator(".tlhp-lightbox-count")).toHaveText("3/30");

		await page.keyboard.press("Escape");
		await expect(lightbox(page)).toHaveCount(0);
		await expect(third).toBeFocused();
	});

	test("keeps focus inside while open, with the page behind inert", async ({ page }) => {
		await open(page, ALBUM);
		await openFrom(page, photos(page).first());
		for (let i = 0; i < 6; i++) {
			await page.keyboard.press("Tab");
			expect(await page.evaluate(() => !!document.activeElement?.closest(".glightbox-container"))).toBe(true);
		}
		expect(await page.locator("#smooth-wrapper").getAttribute("inert")).toBe("");
		await page.keyboard.press("Escape");
		await expect(lightbox(page)).toHaveCount(0);
		expect(await page.locator("#smooth-wrapper").getAttribute("inert")).toBeNull();
	});

	test("passes axe WCAG A/AA while open, with Vietnamese button names", async ({ page }) => {
		await open(page, ALBUM);
		await openFrom(page, photos(page).first());
		await expect(lightbox(page).getByRole("button", { name: "Ảnh sau" })).toBeAttached();
		await expect(lightbox(page)).toHaveAttribute("aria-modal", "true");
		const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
	});

	test("a 170-photo album loads only the thumbnails it shows", async ({ page }) => {
		const loaded = new Set<string>();
		page.on("requestfinished", (request) => {
			if (request.resourceType() === "image") loaded.add(request.url());
		});
		await open(page, BIG_ALBUM);
		const sources = await photos(page).locator("img").evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));
		expect(sources).toHaveLength(170);
		const albumLoaded = () => sources.filter((src) => loaded.has(src)).length;
		// The 158 behind "Xem thêm" are not drawn, so not fetched; the 12 shown load lazily.
		expect(albumLoaded()).toBeLessThanOrEqual(12);

		await page.getByRole("button", { name: /Xem thêm 158 ảnh/ }).click();
		await page.waitForTimeout(1500);
		// Lazy: only those near the view load, never the whole album at once.
		expect(albumLoaded()).toBeLessThan(120);
	});
});
