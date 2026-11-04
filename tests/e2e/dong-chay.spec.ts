import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// T7: /dong-chay-hoang-phap, filtered, sorted and paged on the server. Needs posts in the
// build (data/snapshot/posts.json, `npm run snapshot:fetch`).
const PATH = "/dong-chay-hoang-phap";

async function open(page: Page, query = "", width = 1440) {
	await page.setViewportSize({ width, height: 900 });
	const response = await page.goto(PATH + query);
	await page.waitForTimeout(1500);
	return response;
}

const cards = (page: Page) => page.locator(".tlhp-post-card");
const status = (page: Page) => page.locator(".tlhp-list-status");
const pills = (page: Page) => page.getByRole("navigation", { name: "Chuyên mục" });
const dates = (page: Page) => cards(page).locator("time").evaluateAll((els) => els.map((el) => el.getAttribute("datetime")!));

test.describe("list", () => {
	test.use({ reducedMotion: "reduce" });

	test("sends one page of 12 cards, not the whole section", async ({ page, request }) => {
		const response = await open(page);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dòng Chảy Hoằng Pháp");
		await expect(cards(page)).toHaveCount(12);
		await expect(status(page)).toHaveText(/^\d+ bài · trang 1\/\d+$/);

		const html = await (await request.get(PATH)).text();
		expect(html.match(/class="blog-item tlhp-post-card"/g)).toHaveLength(12);
		expect(html.length).toBeLessThan(300_000);
	});

	test("cards read chip, title, summary, then date, with a fixed 4:3 picture", async ({ page }) => {
		await open(page);
		const card = cards(page).first();
		const order = await card.locator(".blog-content > *").evaluateAll((els) => els.map((el) => el.className.split(" ")[0] || el.tagName));
		expect(order).toEqual(["tlhp-chip", "title", "desc", "tlhp-post-card-meta"]);
		await expect(card.getByRole("heading", { level: 3 }).getByRole("link")).toHaveAttribute("href", new RegExp(`^${PATH}/.+`));

		const pictures = await cards(page)
			.locator(".blog-thumb img")
			.evaluateAll((imgs) =>
				imgs.map((img) => {
					const box = img.getBoundingClientRect();
					return { loading: img.getAttribute("loading"), width: img.getAttribute("width"), ratio: box.width / box.height };
				}),
			);
		// All lazy since T41c: an editor's photo can be a 7–9 MB original, and a first-row card
		// that loads at once is preloaded by React ahead of the CSS.
		expect(pictures.every((p) => p.loading === "lazy")).toBe(true);
		for (const picture of pictures) {
			expect(picture.width).toBe("480");
			expect(picture.ratio).toBeCloseTo(4 / 3, 1);
		}
	});

	test("loads without layout shift", async ({ page }) => {
		await page.addInitScript(() => {
			(window as unknown as { cls: number }).cls = 0;
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
					if (!entry.hadRecentInput) (window as unknown as { cls: number }).cls += entry.value;
				}
			}).observe({ type: "layout-shift", buffered: true });
		});
		await open(page);
		await page.waitForTimeout(1000);
		expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBeLessThan(0.01);
	});

	test("the menu marks Dòng Chảy Hoằng Pháp as the current page", async ({ page, isMobile }) => {
		test.skip(isMobile, "the desktop menu holds the link");
		await open(page);
		const link = page.locator("header.header-area:not([inert])").locator(`a[href="${PATH}"][aria-current="page"]`);
		await expect(link).toHaveCount(1);
	});

	test("passes axe WCAG A/AA", async ({ page }) => {
		await open(page);
		const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
	});
});

test.describe("filters, order and pages on the URL", () => {
	test("a category pill filters the list, keeps focus, and Back undoes it", async ({ page }) => {
		await open(page);
		const before = await status(page).textContent();
		const pill = pills(page).getByRole("link", { name: /Đại Lễ Sự Kiện/ });
		await pill.focus();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(`${PATH}?danh-muc=dai-le-su-kien`);
		await expect(pill).toHaveAttribute("aria-current", "page");
		await expect(pill).toBeFocused();
		await expect(status(page)).toHaveText(/trong “Đại Lễ Sự Kiện”/);
		await expect(cards(page).locator(".tlhp-chip")).toHaveText(Array(await cards(page).count()).fill("Đại Lễ Sự Kiện"));

		await page.goBack();
		await expect(page).toHaveURL(PATH);
		await expect(status(page)).toHaveText(before!);
	});

	test("the order picker reorders the list in place", async ({ page }) => {
		await open(page, "?danh-muc=cong-tu");
		const select = page.getByLabel("Sắp xếp");
		await select.focus();
		await select.selectOption("cu-nhat");
		await expect(page).toHaveURL(`${PATH}?danh-muc=cong-tu&sap-xep=cu-nhat`);
		await expect(select).toBeFocused();
		const oldest = await dates(page);
		expect(oldest).toEqual([...oldest].sort());

		await page.getByLabel("Sắp xếp").selectOption("a-z");
		await expect(page).toHaveURL(/sap-xep=a-z/);
		const titles = await cards(page).locator("h3").allTextContents();
		expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base", numeric: true })));
	});

	test("the next page link loads page 2 and takes the view back to the top of the list", async ({ page }) => {
		await open(page, "?danh-muc=cong-tu");
		const firstOnPage1 = await cards(page).first().locator("h3").textContent();
		await page.getByRole("link", { name: "Trang sau" }).click();
		await expect(page).toHaveURL(`${PATH}?danh-muc=cong-tu&trang=2`);
		await expect(page.getByRole("navigation", { name: "Phân trang" }).getByRole("link", { name: "Trang 2" })).toHaveAttribute("aria-current", "page");
		await expect(cards(page).first().locator("h3")).not.toHaveText(firstOnPage1!);
		await expect(page.locator("#danh-sach-bai")).toBeFocused();
		// The filters land just under the room left for the sticky header (130px).
		const pillsTop = () => page.locator(".tlhp-pills").evaluate((el) => Math.round(el.getBoundingClientRect().top));
		await expect.poll(pillsTop, { timeout: 4000 }).toBeGreaterThan(100);
		await expect.poll(pillsTop, { timeout: 4000 }).toBeLessThan(220);
	});

	test("works without JavaScript: links filter and the form sorts", async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(PATH);
		await pills(page).getByRole("link", { name: /Cộng Tu Định Kỳ/ }).click();
		await expect(page).toHaveURL(`${PATH}?danh-muc=cong-tu`);
		await page.getByLabel("Sắp xếp").selectOption("z-a");
		await page.getByRole("button", { name: "Áp dụng" }).click();
		await expect(page).toHaveURL(`${PATH}?danh-muc=cong-tu&sap-xep=z-a`);
		await expect(page.locator(".tlhp-post-card")).toHaveCount(12);
		await context.close();
	});
});

test.describe("empty states lead back", () => {
	test.use({ reducedMotion: "reduce" });

	test("an unknown category", async ({ page }) => {
		await open(page, "?danh-muc=khong-co");
		await expect(page.locator(".tlhp-empty")).toContainText("Không có chuyên mục này");
		await expect(page.locator(".tlhp-empty").getByRole("link", { name: "Xem tất cả bài" })).toHaveAttribute("href", PATH);
		await expect(cards(page)).toHaveCount(0);
	});

	test("a page past the end", async ({ page }) => {
		await open(page, "?danh-muc=dai-le-su-kien&trang=99");
		await expect(page.locator(".tlhp-empty")).toContainText("Không có trang 99");
		await expect(page.locator(".tlhp-empty").getByRole("link", { name: "Về trang đầu" })).toHaveAttribute("href", `${PATH}?danh-muc=dai-le-su-kien`);
		await expect(page.getByRole("navigation", { name: "Phân trang" })).toHaveCount(0);
	});

	test("odd values fall back to the plain list", async ({ page }) => {
		await open(page, "?sap-xep=lung-tung&trang=abc");
		await expect(cards(page)).toHaveCount(12);
		await expect(status(page)).toHaveText(/trang 1\//);
	});
});
