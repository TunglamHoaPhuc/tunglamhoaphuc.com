import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// T8: /dong-chay-hoang-phap/[slug], rendered on the server. Needs posts in the build
// (data/snapshot/, `npm run snapshot:fetch -- --albums`).
const PATH = "/dong-chay-hoang-phap";
// 30 photos in the list file; 170 photos only in post-albums.json; one YouTube link.
const ARTICLE = `${PATH}/phap-hoi-huyet-bon-trai`;
const BIG_ALBUM = `${PATH}/dem-van-nghe-hoa-phuc-got-talent-khoa-tu-tuoi-tre-chu-de-di-qua-kho-vui-cuoc-doi-2025`;
const WITH_VIDEO = `${PATH}/le-tuong-niem-lan-thu-33-ngay-to-su-khai-son-chua-hoang-phap-vien-tich-chua-hoa-phuc`;
// Stored percent-encoded (an emoji); the old site cannot open it.
const ENCODED = `${PATH}/%f0%9f%8c%bathu-moi-tham-du-khoa-tu-mot-ngay-an-lac-thang-5-%f0%9f%8c%ba-%f0%9f%93%a3%f0%9f%93%a3-thong-bao-lop-hoc-giao-ly-chua-hoa-phuc`;

async function open(page: Page, path = ARTICLE, width = 1440) {
	await page.setViewportSize({ width, height: 900 });
	const response = await page.goto(path);
	await page.waitForTimeout(1500);
	return response;
}

const frame = (page: Page) => page.locator(".tlhp-reading-frame");
const bodyText = (page: Page) => page.locator(".tlhp-reading p").first();
const fontSize = (page: Page) => bodyText(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

test.describe("article page", () => {
	test.use({ reducedMotion: "reduce" });

	test("sends the whole article in the first HTML", async ({ request }) => {
		const response = await request.get(ARTICLE);
		expect(response.status()).toBe(200);
		const html = await response.text();
		expect(html).toContain('<div class="tlhp-reading"><p>');
		expect(html).toContain("Pháp Hội Huyết Bồn Trai mở ra trước là nhằm cầu cho Phật Pháp xương minh");
		expect(html).not.toMatch(/Đang tải|không còn tồn tại/);
		expect(html.match(/class="tlhp-gallery-item"/g)).toHaveLength(30);
	});

	test("has its own title, breadcrumb and way back", async ({ page }) => {
		await open(page);
		await expect(page).toHaveTitle("Pháp hội Huyết Bồn Trai – Dòng Chảy Hoằng Pháp – Tùng Lâm Hòa Phúc");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pháp hội Huyết Bồn Trai");
		const crumbs = page.getByRole("navigation", { name: "Đường dẫn" });
		await expect(crumbs.getByRole("link", { name: "Dòng Chảy Hoằng Pháp" })).toHaveAttribute("href", PATH);
		await expect(crumbs.getByRole("link", { name: "Đại Lễ Sự Kiện" })).toHaveAttribute("href", `${PATH}?danh-muc=dai-le-su-kien`);
		await expect(page.getByRole("link", { name: "Quay lại Dòng Chảy Hoằng Pháp" })).toHaveAttribute("href", PATH);
		await expect(page.locator(".tlhp-article-meta")).toContainText("03/09/2026");
	});

	test("shows tabs only for the parts the post has", async ({ page }) => {
		await open(page);
		await expect(page.getByRole("navigation", { name: "Các phần của bài" }).getByRole("link")).toHaveText([
			"Tổng quan",
			"Nội dung chính",
			"Album ảnh",
			"Tìm hiểu thêm",
		]);
		await open(page, WITH_VIDEO);
		await expect(page.getByRole("navigation", { name: "Các phần của bài" }).getByRole("link", { name: "Video" })).toBeVisible();
		await expect(page.locator("#video .tlhp-video")).toHaveAttribute("href", /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
	});

	test("lists three other posts of the same category", async ({ page }) => {
		await open(page);
		const related = page.locator("#tim-hieu-them .tlhp-post-card");
		await expect(related).toHaveCount(3);
		await expect(related.locator(".tlhp-chip")).toHaveText(["Đại Lễ Sự Kiện", "Đại Lễ Sự Kiện", "Đại Lễ Sự Kiện"]);
		await expect(related.locator(`a[href="${ARTICLE}"]`)).toHaveCount(0);
	});

	test("opens a post whose address holds an encoded emoji", async ({ page }) => {
		const response = await open(page, ENCODED);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole("heading", { level: 1 })).toContainText("THƯ MỜI THAM DỰ");
	});

	// A slug that does not exist, and a Trí Tuệ Phật Pháp post (served under its own section, T17).
	for (const path of [`${PATH}/khong-co-bai-nay`, `${PATH}/tac-pham-di-qua-kho-vui-cuoc-doi`]) {
		test(`answers a real 404 for ${path}`, async ({ request }) => {
			expect((await request.get(path)).status()).toBe(404);
		});
	}

	test("passes axe WCAG A/AA, also on the Đêm thiền ground", async ({ page }) => {
		await open(page);
		const check = async () => {
			const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
			return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
		};
		expect(await check()).toEqual([]);
		await page.getByRole("button", { name: "Đêm thiền" }).click();
		await expect(frame(page)).toHaveAttribute("data-theme", "dark");
		expect(await check()).toEqual([]);
	});
});

test.describe("reading settings", () => {
	test.use({ reducedMotion: "reduce" });

	test("A− and A+ step through four sizes of the body text only", async ({ page }) => {
		await open(page);
		const metaSize = await page.locator(".tlhp-article-meta").evaluate((el) => getComputedStyle(el).fontSize);
		const normal = await fontSize(page);
		// The default size, also before anything was saved (no saved value must not read as size 0).
		expect(normal).toBeGreaterThanOrEqual(18);
		await expect(page.getByText("Cỡ chữ 100%")).toBeVisible();

		await page.getByRole("button", { name: "A+ phóng to chữ" }).click();
		await expect(page.getByText("Cỡ chữ 115%")).toBeVisible();
		await page.getByRole("button", { name: "A+ phóng to chữ" }).click();
		await expect(page.getByRole("button", { name: "A+ phóng to chữ" })).toBeDisabled();
		await expect.poll(() => fontSize(page)).toBeCloseTo(normal * 1.3, 0);

		for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "A− thu nhỏ chữ" }).click();
		await expect(page.getByRole("button", { name: "A− thu nhỏ chữ" })).toBeDisabled();
		await expect.poll(() => fontSize(page)).toBeCloseTo(normal * 0.9, 0);
		expect(await page.locator(".tlhp-article-meta").evaluate((el) => getComputedStyle(el).fontSize)).toBe(metaSize);
	});

	test("Giấy dó and Đêm thiền change the reading frame only, and stay after a reload", async ({ page }) => {
		await open(page);
		const pageBackground = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
		const before = await pageBackground();

		await page.getByRole("button", { name: "Giấy dó" }).click();
		await expect(frame(page)).toHaveAttribute("data-theme", "sepia");
		await expect(page.getByRole("button", { name: "Giấy dó" })).toHaveAttribute("aria-pressed", "true");
		await expect(frame(page)).toHaveCSS("background-color", "rgb(239, 230, 211)");

		await page.getByRole("button", { name: "Đêm thiền" }).click();
		await page.getByRole("button", { name: "A+ phóng to chữ" }).click();
		await expect(frame(page)).toHaveCSS("background-color", "rgb(26, 18, 11)");
		expect(await pageBackground()).toBe(before);
		expect(await page.evaluate(() => document.documentElement.hasAttribute("data-theme"))).toBe(false);

		await page.reload();
		await expect(frame(page)).toHaveAttribute("data-theme", "dark");
		await expect(page.getByRole("button", { name: "Đêm thiền" })).toHaveAttribute("aria-pressed", "true");
		await expect(page.getByText("Cỡ chữ 115%")).toBeVisible();

		await page.getByRole("button", { name: "Ngà" }).click();
		await expect(frame(page)).not.toHaveAttribute("data-theme", /.+/);
	});
});

test.describe("album", () => {
	test("shows 12 photos, Xem thêm reveals the rest and moves focus there", async ({ page }) => {
		await open(page, BIG_ALBUM);
		const photos = page.locator("#album-anh .tlhp-gallery-item");
		await expect(photos).toHaveCount(170);
		await expect(page.locator("#album-anh li:visible")).toHaveCount(12);
		await page.getByRole("button", { name: "Xem thêm 158 ảnh" }).click();
		await expect(page.locator("#album-anh li:visible")).toHaveCount(170);
		await expect(photos.nth(12)).toBeFocused();
	});

	test("a photo opens in the lightbox and Esc closes it", async ({ page }) => {
		await open(page);
		await page.locator("#album-anh .tlhp-gallery-item").first().click();
		const lightbox = page.locator(".glightbox-container");
		await expect(lightbox).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(lightbox).toHaveCount(0);
	});
});

test.describe("tabs with smooth scrolling on", () => {
	test.skip(({ isMobile }) => isMobile, "smooth scrolling is checked with the mouse");

	test("a tab glides to its section, focuses it and keeps the address", async ({ page }) => {
		await open(page);
		await page.getByRole("navigation", { name: "Các phần của bài" }).getByRole("link", { name: "Album ảnh" }).click();
		await expect(page).toHaveURL(new RegExp(`${ARTICLE}#album-anh$`));
		await expect(page.locator("#album-anh")).toBeFocused();
		const top = () => page.locator("#album-anh").evaluate((el) => Math.round(el.getBoundingClientRect().top));
		await expect.poll(top, { timeout: 4000 }).toBeGreaterThan(100);
		await expect.poll(top, { timeout: 4000 }).toBeLessThan(200);
	});
});
