import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// T41c: the pictures a page asks for first must be small. Until T41d makes small copies of
// the old site's photos, a camera original (6048 px, 7–9 MB) asked for at high priority
// keeps the whole page waiting: the article below had an LCP of 47.9 s on a phone (04/11).
const PAGES = [
	"/",
	"/dong-chay-hoang-phap",
	"/dong-chay-hoang-phap/cong-tu-phap-hoi-niem-phat-thang-7-nam-binh-ngo-2026-2",
	"/lich-tu-hoc",
	"/gioi-thieu",
	"/gioi-thieu/tieu-su-su-to",
	"/tong-chi-tu-hoc",
	"/tong-chi-tu-hoc/niem-phat-phuong-phap-tro-hanh",
	"/vu-tru-phat-giao",
	"/vu-tru-phat-giao/tam-bao",
];

const MAX_FIRST_IMAGE = 500 * 1024;
const MAX_PATTERN = 50 * 1024;
const ONE_DAY = 86_400;

async function byteSize(request: APIRequestContext, url: string): Promise<number> {
	const head = await request.head(url);
	const length = Number(head.headers()["content-length"]);
	if (head.ok() && length > 0) return length;
	return (await (await request.get(url)).body()).length;
}

/** Every picture the page preloads or marks fetchpriority="high", as absolute URLs. */
async function firstImages(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const urls = new Set<string>();
		const add = (value: string | null) => value && urls.add(new URL(value, location.href).href);
		const candidates = (srcset: string | null) => (srcset ?? "").split(",").map((part) => part.trim().split(/\s+/)[0]);
		for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')) {
			add(link.getAttribute("href"));
			candidates(link.getAttribute("imagesrcset")).forEach(add);
		}
		for (const img of document.querySelectorAll<HTMLImageElement>('img[fetchpriority="high" i]')) {
			add(img.getAttribute("src"));
			candidates(img.getAttribute("srcset")).forEach(add);
		}
		return [...urls];
	});
}

test.describe("pictures asked for first stay small", () => {
	for (const path of PAGES) {
		test(`${path} preloads no picture over 500 KB`, async ({ page, request }) => {
			await page.goto(path);
			const heavy: string[] = [];
			for (const url of await firstImages(page)) {
				const size = await byteSize(request, url);
				if (size > MAX_FIRST_IMAGE) heavy.push(`${url} (${Math.round(size / 1024)} KB)`);
			}
			expect(heavy).toEqual([]);
		});
	}
});

test("the background patterns are small pictures, not SVGs wrapping a PNG", async ({ page, request }) => {
	await page.goto("/");
	const patterns = await page.locator('img[src*="/images/shape/pattern-"]').evaluateAll((imgs) =>
		imgs.map((img) => (img as HTMLImageElement).src),
	);
	expect(patterns.length).toBeGreaterThan(0);
	for (const url of new Set(patterns)) {
		expect(url).not.toMatch(/\.svg$/);
		expect(await byteSize(request, url)).toBeLessThanOrEqual(MAX_PATTERN);
	}
});

test("site pictures stay in the browser cache for at least a day", async ({ request }) => {
	for (const path of ["/images/hero/toan-canh-chua-1920.webp", "/brand/logo-moc-an.webp"]) {
		const response = await request.get(path);
		expect(response.ok()).toBe(true);
		const maxAge = Number(/max-age=(\d+)/.exec(response.headers()["cache-control"] ?? "")?.[1] ?? 0);
		expect(maxAge, `${path}: ${response.headers()["cache-control"]}`).toBeGreaterThanOrEqual(ONE_DAY);
	}
});
