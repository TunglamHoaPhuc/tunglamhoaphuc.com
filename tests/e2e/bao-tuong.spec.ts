import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// T16: /bao-tuong-phat-giao (the statues, filtered on the server) and the statue pages at the
// old addresses /bao-tuong/{name}_{code}, rendered from data/snapshot/bao-tuong.json.
const PATH = "/bao-tuong-phat-giao";
const THICH_CA = "/bao-tuong/duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001";
const CHUYEN_PHAP_LUAN = "/bao-tuong/duc_phat_thich_ca_mau_ni_chuyen_phap_luan_tp0002";

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

const cardNames = (page: Page) => page.locator(".tlhp-statue-grid .tlhp-statue-card h3");

test.describe("Bảo Tượng Phật Giáo", () => {
	test.use({ reducedMotion: "reduce" });

	test("lists the 126 statues 24 to a page, each card leading to its page", async ({ page }) => {
		const response = await open(page, PATH);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle("Bảo Tượng Phật Giáo – Tùng Lâm Hòa Phúc");
		await expect(page.locator(".tlhp-list-status")).toHaveText("126 tôn tượng · trang 1/6");
		await expect(cardNames(page)).toHaveCount(24);
		await expect(cardNames(page).first().getByRole("link")).toHaveAttribute("href", THICH_CA);
		await expect(page.locator(".tj-pagination a, .tj-pagination [aria-current]")).not.toHaveCount(0);
		expect(await axe(page)).toEqual([]);
	});

	// The old page fetched all 109 pictures at once. The statue pictures are originals of up to
	// 1.5 MB: none is preloaded ahead of the page's own files (T41c).
	test("fetches only the pictures of the page it shows, none ahead of the page", async ({ page }) => {
		const fetched = new Set<string>();
		page.on("request", (request) => {
			if (request.resourceType() === "image") fetched.add(request.url());
		});
		await open(page, PATH);
		await page.waitForTimeout(1500);
		const shown = await page.locator(".tlhp-statue-card img").evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));
		page.removeAllListeners("request");
		await expect(page.locator('head link[rel="preload"][as="image"][href*="bao-tuong"]')).toHaveCount(0);
		await page.goto(`${PATH}?trang=6`);
		const later = await page.locator(".tlhp-statue-card img").evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).src));
		expect(later.length).toBeGreaterThan(0);
		expect(later.filter((src) => !shown.includes(src) && fetched.has(src))).toEqual([]);
	});

	test("filters by assembly, area and kind, and finds by name or code, all on the address", async ({ page }) => {
		await open(page, PATH);
		await page.getByLabel("Chúng hội").selectOption({ label: "Chư Phật Hải Hội" });
		await page.getByRole("button", { name: "Lọc" }).click();
		await expect(page).toHaveURL(`${PATH}?chung-hoi=chu_phat_hai_hoi`);
		await expect(page.locator(".tlhp-list-status")).toHaveText("28 tôn tượng phù hợp · trang 1/2");
		await expect(page.getByLabel("Chúng hội")).toHaveValue("chu_phat_hai_hoi");

		await open(page, `${PATH}?khu-vuc=tam-bao&loai=nghe-thuat`);
		await expect(page.locator(".tlhp-list-status")).toHaveText("11 tôn tượng phù hợp");

		await open(page, `${PATH}?q=quan+am`);
		await expect(page.locator(".tlhp-list-status")).toHaveText("10 tôn tượng phù hợp");
		for (const name of await cardNames(page).allTextContents()) expect(name).toContain("Quán Âm");

		await open(page, `${PATH}?q=tp0001`);
		await expect(cardNames(page)).toHaveText(["Đức Phật Thích Ca Mâu Ni"]);
		await page.getByRole("link", { name: "Bỏ lọc" }).click();
		await expect(page).toHaveURL(PATH);
		await expect(page.locator(".tlhp-list-status")).toHaveText("126 tôn tượng · trang 1/6");
		await expect(page.getByLabel("Tên hoặc mã tượng")).toHaveValue("");
	});

	test("says so when nothing matches, or the page is past the end, and leads back", async ({ page }) => {
		await open(page, `${PATH}?q=khong+co+tuong+nao`);
		await expect(page.locator(".tlhp-empty-title")).toHaveText("Không có tôn tượng phù hợp");
		await expect(page.locator(".tlhp-empty").getByRole("link", { name: "Bỏ lọc" })).toHaveAttribute("href", PATH);
		await expect(cardNames(page)).toHaveCount(0);
		expect(await axe(page)).toEqual([]);
		await open(page, `${PATH}?trang=9`);
		await expect(page.locator(".tlhp-empty-title")).toHaveText("Không có trang 9");
		await expect(page.getByRole("link", { name: "Về trang đầu" })).toHaveAttribute("href", PATH);
	});

	test("the filter form fits a phone screen", async ({ page }) => {
		await open(page, PATH, 375);
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
		for (const field of await page.locator(".tlhp-statue-filters input, .tlhp-statue-filters select, .tlhp-statue-filters button").all()) {
			expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test("keeps the old statue addresses; a wrong code is not found", async ({ request }) => {
		expect((await request.get(THICH_CA)).status()).toBe(200);
		expect((await request.get(THICH_CA.replace("tp0001", "tp9999"))).status()).toBe(404);
	});

	test("a statue page shows the statue, its facts, its story, its works of art and the statues beside it", async ({ page }) => {
		const response = await open(page, THICH_CA);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle("Đức Phật Thích Ca Mâu Ni – Vô Thượng Năng Nhân – Bảo Tượng Phật Giáo – Tùng Lâm Hòa Phúc");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đức Phật Thích Ca Mâu Ni");
		await expect(page.locator(".tlhp-anchor-tabs a")).toHaveText(["Tổng quan", "Câu chuyện", "Nghệ thuật Phật giáo", "Bảo tượng liên quan"]);
		const facts = page.locator(".tlhp-statue-facts");
		await expect(facts.locator("dt")).toHaveText(["Cụm tượng", "Chúng hội", "Tôn trí tại", "Mã tượng"]);
		await expect(facts.getByRole("link", { name: "Chư Phật Hải Hội" })).toHaveAttribute("href", `${PATH}?chung-hoi=chu_phat_hai_hoi`);
		await expect(facts.getByRole("link", { name: "Tam Bảo" })).toHaveAttribute("href", "/vu-tru-phat-giao/tam-bao");
		// Its quote only repeats the name: left out.
		await expect(page.locator(".tlhp-about-quote")).toHaveCount(0);
		await expect(page.locator("#noi-dung .tlhp-reading p").first()).toContainText("Dưới chân dãy Himalaya");
		await expect(page.locator("#nghe-thuat .tlhp-art-card")).toHaveCount(10);
		await expect(page.locator("#nghe-thuat .tlhp-art-card h3 a").first()).toHaveAttribute("href", CHUYEN_PHAP_LUAN);
		await expect(page.locator("#lien-quan .tlhp-statue-card")).toHaveCount(4);
		await expect(page.locator(`#lien-quan a[href="${THICH_CA}"]`)).toHaveCount(0);
		expect(await axe(page)).toEqual([]);
	});

	test("a work of art shows its teaching", async ({ page }) => {
		await open(page, CHUYEN_PHAP_LUAN);
		await expect(page.locator(".team-details__desig")).toHaveText("Nghệ thuật Phật giáo");
		await expect(page.locator(".tlhp-about-quote blockquote")).toContainText("Trung đạo là con đường");
		await expect(page.locator(".tlhp-about-quote figcaption")).toHaveText("— Vô Trí - Tâm Hòa");
		expect(await axe(page)).toEqual([]);
	});

	test("every link inside a statue page leads to a page that is there", async ({ page, request }) => {
		await open(page, THICH_CA);
		const hrefs = await page.locator("main a[href^='/']").evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!.split("#")[0]))]);
		expect(hrefs.length).toBeGreaterThan(10);
		for (const href of hrefs) expect((await request.get(href)).status(), href).toBeLessThan(400);
	});

	test("an area page's statues now lead to their pages", async ({ page }) => {
		await open(page, "/vu-tru-phat-giao/tam-bao");
		await expect(page.locator("#bao-tuong .tlhp-statue-card h3 a").first()).toHaveAttribute("href", THICH_CA);
	});
});

test.describe("Bảo Tượng Phật Giáo without JavaScript", () => {
	test.use({ javaScriptEnabled: false });

	test("the filter form still works: it is a plain GET form", async ({ page }) => {
		await page.goto(PATH);
		await page.getByLabel("Tên hoặc mã tượng").fill("Dược Sư");
		await page.getByRole("button", { name: "Lọc" }).click();
		await expect(page).toHaveURL(/\?q=D%C6%B0%E1%BB%A3c\+S%C6%B0/);
		await expect(page.locator(".tlhp-statue-card h3").first()).toContainText("Dược Sư");
	});
});
