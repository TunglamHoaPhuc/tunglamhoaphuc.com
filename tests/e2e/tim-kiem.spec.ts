import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// T18: /tim-kiem over every section, on the server; the header's search sends here.
const PATH = "/tim-kiem";

async function open(page: Page, path: string, width = 1440) {
	await page.setViewportSize({ width, height: 900 });
	const response = await page.goto(path);
	await page.waitForTimeout(1200);
	return response;
}

const status = (page: Page) => page.locator(".tlhp-list-status");
const firstTitles = (page: Page) => page.locator(".tlhp-search-title a").allTextContents();

test.describe("Tìm kiếm", () => {
	test.use({ reducedMotion: "reduce" });

	test("with no query, asks what to find and offers the sections; never indexed", async ({ page }) => {
		const response = await open(page, PATH);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle("Tìm kiếm – Tùng Lâm Hòa Phúc");
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
		await expect(page.locator(".tlhp-empty-title")).toHaveText("Quý vị muốn tìm điều gì?");
		await expect(page.getByRole("navigation", { name: "Gợi ý chuyên mục" }).getByRole("link")).toHaveCount(7);
	});

	test("finds the same with and without marks", async ({ page }) => {
		await open(page, `${PATH}?q=niem+phat`);
		const plainStatus = (await status(page).textContent()) ?? "";
		const plainTitles = await firstTitles(page);
		await open(page, `${PATH}?q=ni%E1%BB%87m+Ph%E1%BA%ADt`);
		const markedStatus = (await status(page).textContent()) ?? "";
		expect(await firstTitles(page)).toEqual(plainTitles);
		expect(plainStatus).toMatch(/^\d+ kết quả cho “niem phat”$/);
		expect(markedStatus).toMatch(/^\d+ kết quả cho “niệm Phật”$/);
		expect(plainStatus.split(" ")[0]).toBe(markedStatus.split(" ")[0]);
	});

	test("groups the results by section, a few each, with the way to all of them", async ({ page, request }) => {
		await open(page, `${PATH}?q=niem+phat`);
		const groups = page.locator(".tlhp-search-group");
		await expect(groups.first().locator(".tlhp-search-group-title")).toContainText("Dòng Chảy Hoằng Pháp");
		for (const group of await groups.all()) {
			expect(await group.locator(".tlhp-search-result").count()).toBeLessThanOrEqual(4);
			const href = await group.locator(".tlhp-search-title a").first().getAttribute("href");
			expect((await request.get(href!.split("#")[0])).status(), href!).toBeLessThan(400);
		}
		await groups.first().getByRole("link", { name: /^Xem cả \d+ kết quả trong Dòng Chảy Hoằng Pháp$/ }).click();
		await expect(page).toHaveURL(`${PATH}?q=niem+phat&muc=dong-chay-hoang-phap`);
		await expect(status(page)).toHaveText(/^\d+ kết quả cho “niem phat” trong Dòng Chảy Hoằng Pháp · trang 1\/\d+$/);
		await expect(page.locator(".tlhp-search-result")).toHaveCount(12);
		await expect(page.locator(".tlhp-pills a[aria-current='page']")).toContainText("Dòng Chảy Hoằng Pháp");
	});

	test("finds a statue by its code, and a page of the schedule", async ({ page }) => {
		await open(page, `${PATH}?q=tp0001`);
		await expect(page.locator(".tlhp-search-title a").first()).toHaveAttribute("href", "/bao-tuong/duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001");
		await open(page, `${PATH}?q=phap+hoi+niem+phat&muc=lich-tu-hoc`);
		await expect(page.locator(".tlhp-search-title a").first()).toHaveAttribute("href", /^\/lich-tu-hoc\?thang=\d{4}-\d{2}#su-kien-/);
	});

	test("says so when nothing is found, and offers the sections", async ({ page }) => {
		await open(page, `${PATH}?q=xyzqw+khong+co`);
		await expect(page.locator(".tlhp-empty-title")).toHaveText("Không tìm thấy kết quả cho “xyzqw khong co”");
		await expect(page.getByRole("navigation", { name: "Gợi ý chuyên mục" }).getByRole("link", { name: "Trí Tuệ Phật Pháp" })).toHaveAttribute("href", "/tri-tue-phat-phap");
		const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
	});

	test("the header's search leads to the results", async ({ page, isMobile }) => {
		test.skip(isMobile, "phones search from the menu panel (header-extras.spec.ts)");
		await open(page, "/");
		await page.locator("header.header-area:not([inert])").getByRole("button", { name: "Tìm kiếm", exact: true }).click();
		await page.getByRole("searchbox", { name: "Từ khóa tìm kiếm" }).fill("Vu Lan");
		await page.keyboard.press("Enter");
		await page.waitForURL(/\/tim-kiem\?q=Vu\+Lan/);
		await expect(status(page)).toHaveText(/^\d+ kết quả cho “Vu Lan”$/);
		const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
	});

	test("fits a phone screen", async ({ page }) => {
		await open(page, `${PATH}?q=quan+am`, 375);
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
	});
});

test.describe("Tìm kiếm without JavaScript", () => {
	test.use({ javaScriptEnabled: false });

	test("the form still works: it is a plain GET form", async ({ page }) => {
		await page.goto(PATH);
		await page.getByLabel("Từ khóa", { exact: true }).fill("Quan Âm");
		await page.locator(".tlhp-search-form").getByRole("button", { name: "Tìm" }).click();
		await expect(page).toHaveURL(/\/tim-kiem\?q=Quan\+%C3%82m/);
		await expect(page.locator(".tlhp-search-result").first()).toBeVisible();
	});
});
