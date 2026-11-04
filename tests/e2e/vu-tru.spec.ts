import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { vuTru } from "../../src/config/vuTru";

// T15: /vu-tru-phat-giao (the 2D map and the areas) and the area pages, rendered on the
// server from data/snapshot/vu-tru.json and bao-tuong.json (npm run snapshot:fetch).
const PATH = vuTru.path;
const PINS = vuTru.pins;

async function open(page: Page, path: string, width = 1440) {
	await page.setViewportSize({ width, height: 900 });
	const response = await page.goto(path);
	await page.waitForTimeout(1500);
	return response;
}

const axe = async (page: Page) =>
	(await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.flatMap((v) =>
		v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`),
	);

test.describe("Vũ Trụ Phật Giáo", () => {
	test.use({ reducedMotion: "reduce" });

	// Links fetch /vu-tru-phat-giao ahead; a "high" drawing there was then preloaded (410 KB) on
	// every page with such a link, the menu's included, racing the page's own pictures.
	test("pages that only link here never fetch the map drawing", async ({ page }) => {
		const fetched: string[] = [];
		page.on("request", (request) => {
			if (request.url().includes("canh-1.webp")) fetched.push(request.url());
		});
		await open(page, "/gioi-thieu");
		await page.waitForTimeout(1500);
		expect(fetched).toEqual([]);
		await expect(page.locator('head link[rel="preload"][as="image"][fetchpriority="high"]')).toHaveCount(0);
	});

	test("puts a numbered pin on each of the 14 areas, a 48px link to its page", async ({ page }) => {
		const response = await open(page, PATH);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle("Vũ Trụ Phật Giáo – Tùng Lâm Hòa Phúc");
		const pins = page.getByRole("list", { name: "Các khu vực trên sơ đồ" }).getByRole("link");
		await expect(pins).toHaveCount(14);
		for (const [idx, pin] of PINS.entries()) {
			await expect(pins.nth(idx)).toHaveAttribute("href", `${PATH}/${pin.slug}`);
			const box = (await pins.nth(idx).boundingBox())!;
			expect(Math.min(box.width, box.height), pin.slug).toBeGreaterThanOrEqual(48);
		}
		await expect(pins.nth(3)).toHaveAccessibleName("4. Tam Bảo");
		expect(await axe(page)).toEqual([]);
	});

	for (const width of [375, 768, 1024, 1440]) {
		test(`each pin stays on its place in the drawing at ${width}px`, async ({ page, isMobile }) => {
			test.skip(isMobile && width > 412, "the phone project only covers phone widths");
			await open(page, PATH, width);
			const places = await page.locator(".tlhp-map").evaluate((map) => {
				const drawing = map.querySelector("img")!.getBoundingClientRect();
				return [...map.querySelectorAll<HTMLElement>(".tlhp-map-pin")].map((pin) => {
					const box = pin.getBoundingClientRect();
					return {
						x: ((box.left + box.width / 2 - drawing.left) / drawing.width) * 100,
						y: ((box.top + box.height / 2 - drawing.top) / drawing.height) * 100,
					};
				});
			});
			for (const [idx, pin] of PINS.entries()) {
				expect(Math.abs(places[idx].x - pin.x), `${pin.slug} x`).toBeLessThan(0.5);
				expect(Math.abs(places[idx].y - pin.y), `${pin.slug} y`).toBeLessThan(0.5);
			}
			// A narrow screen scrolls the drawing in its frame, never the page.
			expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
		});
	}

	test("the pins are reached with Tab in map order, show their name, and open the area", async ({ page, isMobile }) => {
		await open(page, PATH, isMobile ? 375 : 1440);
		const first = page.locator(".tlhp-map-pin").first();
		await first.focus();
		await expect(first.locator(".tlhp-map-pin-label")).toHaveCSS("opacity", "1");
		await page.keyboard.press("Tab");
		await expect(page.locator(".tlhp-map-pin").nth(1)).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(`${PATH}/${PINS[1].slug}`);
	});

	test("lists the same 14 areas, in map order, each page opening from the server", async ({ page, request }) => {
		await open(page, PATH);
		const cards = page.locator(".tlhp-area-grid .tlhp-area-card");
		await expect(cards).toHaveCount(14);
		for (const [idx, pin] of PINS.entries()) {
			await expect(cards.nth(idx).locator("h3 a")).toHaveAttribute("href", `${PATH}/${pin.slug}`);
			await expect(cards.nth(idx).locator(".tlhp-chip")).toHaveText(`Khu vực ${idx + 1}`);
			expect((await request.get(`${PATH}/${pin.slug}`)).status(), pin.slug).toBe(200);
		}
		expect((await request.get(`${PATH}/lam-ty-ni`)).status()).toBe(404);
	});

	test("Tam Bảo shows its text, its 20 main statues and its works of art, and where it is", async ({ page }) => {
		await open(page, `${PATH}/tam-bao`);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tam Bảo");
		await expect(page.locator(".tlhp-anchor-tabs a")).toHaveText(["Giới thiệu", "Bảo tượng", "Nghệ thuật Phật giáo", "Khu vực khác"]);
		await expect(page.locator("#gioi-thieu .tlhp-reading li").first()).toContainText("Tiền đường");
		await expect(page.locator("#bao-tuong .tlhp-statue-card")).toHaveCount(20);
		await expect(page.locator("#bao-tuong .tlhp-statue-card").first()).toContainText("Đức Phật Thích Ca Mâu Ni");
		await expect(page.locator("#nghe-thuat .tlhp-statue-card")).toHaveCount(11);
		// The small map marks the area itself, not a link.
		await expect(page.locator(".tlhp-area-where .tlhp-map-pin")).toHaveCount(1);
		await expect(page.locator(".tlhp-area-where .tlhp-map-pin-dot")).toHaveText("4");
		await expect(page.locator("#khu-vuc-khac .tlhp-area-card h3")).toHaveText(["Đại Nam Quốc Mẫu", "Bảo Tàng", "Bảo Tháp Vạn Phật Xá Lợi Hòa Bình"]);
		expect(await axe(page)).toEqual([]);
	});

	test("every link inside an area page leads to a page that is there", async ({ page, request }) => {
		await open(page, `${PATH}/tam-bao`);
		const hrefs = await page.locator("main a[href^='/']").evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!.split("#")[0]))]);
		expect(hrefs.length).toBeGreaterThan(5);
		for (const href of hrefs) expect((await request.get(href)).status(), href).toBeLessThan(400);
	});

	test("an area without statues shows no empty statue blocks", async ({ page }) => {
		await open(page, `${PATH}/tang-kinh-cac`);
		await expect(page.locator("#bao-tuong, #nghe-thuat")).toHaveCount(0);
		await expect(page.locator(".tlhp-anchor-tabs a")).toHaveText(["Giới thiệu", "Khu vực khác"]);
	});
});
