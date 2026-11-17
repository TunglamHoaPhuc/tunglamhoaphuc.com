import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { book, bookText, tibetan } from "../../src/config/triTue";

// T17: /tri-tue-phat-phap (the 158 posts in four categories, then the book and the Tibetan
// course), its posts, and the two reading rooms at their old addresses, rendered from
// data/snapshot/posts.json and gioi-thieu.json.
const PATH = "/tri-tue-phat-phap";
const ARTICLE = `${PATH}/tu-nhu-trong-cay`;
const PHAP_AM = `${PATH}/phap-am-chu-de-tu-tap-dung-cach-cong-tu-mot-ngay-an-lac`;
const BOOK_POST = `${PATH}/${book.postSlug}`;

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

test.describe("Trí Tuệ Phật Pháp", () => {
	test.use({ reducedMotion: "reduce" });

	test("lists the 158 posts in their four categories, 12 to a page", async ({ page }) => {
		const response = await open(page, PATH);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle("Trí Tuệ Phật Pháp – Tùng Lâm Hòa Phúc");
		await expect(page.locator(".tlhp-pills a")).toHaveText([/^Tất cả\s*158$/, /^Bài Viết\s*126$/, /^Pháp Âm\s*15$/, /^Video Phật Pháp\s*15$/, /^Ấn Phẩm & Sách\s*2$/]);
		await expect(page.locator(".tlhp-list-status")).toHaveText("158 bài · trang 1/14");
		const cards = page.locator(".tlhp-post-grid .tlhp-post-card");
		await expect(cards).toHaveCount(12);
		for (const href of await cards.locator("h3 a").evaluateAll((links) => links.map((link) => link.getAttribute("href")!))) {
			expect(href).toMatch(/^\/tri-tue-phat-phap\/[^/]+$/);
		}
		expect(await axe(page)).toEqual([]);
	});

	test("a category keeps to its posts, on the address", async ({ page }) => {
		await open(page, PATH);
		await page.locator(".tlhp-pills").getByRole("link", { name: /^Pháp Âm/ }).click();
		await expect(page).toHaveURL(`${PATH}?danh-muc=phap-am`);
		await expect(page.locator(".tlhp-list-status")).toHaveText("15 bài trong “Pháp Âm” · trang 1/2");
		await expect(page.locator(".tlhp-post-card .tlhp-chip").first()).toHaveText("Pháp Âm");
	});

	test("under the list, the book and the Tibetan course", async ({ page }) => {
		await open(page, PATH);
		const rooms = page.getByRole("region", { name: "Sách và giáo trình" });
		await expect(rooms.getByRole("link", { name: book.title })).toHaveAttribute("href", book.path);
		await expect(rooms.getByRole("link", { name: tibetan.title })).toHaveAttribute("href", tibetan.path);
	});

	test("a post opens under its section, and only there", async ({ page, request }) => {
		const response = await open(page, ARTICLE);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu như trồng cây");
		await expect(page.locator(".tlhp-back-link")).toHaveAttribute("href", PATH);
		await expect(page.locator(".tlhp-article-meta .tlhp-chip")).toHaveAttribute("href", `${PATH}?danh-muc=bai-viet`);
		await expect(page.locator("#noi-dung .tlhp-reading p").first()).toContainText("Tu tập là quá trình");
		expect(await axe(page)).toEqual([]);
		expect((await request.get(`${PATH}/khong-co-bai-nay`)).status()).toBe(404);
		// Each section serves its own posts.
		expect((await request.get(`/dong-chay-hoang-phap/tu-nhu-trong-cay`)).status()).toBe(404);
		expect((await request.get(`${PATH}/phap-hoi-huyet-bon-trai`)).status()).toBe(404);
	});

	// The data has no sound for Pháp Âm (the old pages play none either); nothing may start or
	// be fetched by itself.
	test("a Pháp Âm post plays nothing by itself and fetches no sound", async ({ page }) => {
		const media: string[] = [];
		page.on("request", (request) => {
			if (request.resourceType() === "media") media.push(request.url());
		});
		await open(page, PHAP_AM);
		await expect(page.locator(".tlhp-article-meta .tlhp-chip")).toHaveText("Pháp Âm");
		await expect(page.locator("audio[autoplay], video[autoplay], audio:not([preload='none'])")).toHaveCount(0);
		expect(media).toEqual([]);
	});

	test("the post that presents the book leads to it", async ({ page }) => {
		await open(page, BOOK_POST);
		await expect(page.locator("#tong-quan").getByRole("link", { name: /Đọc sách/ })).toHaveAttribute("href", book.path);
	});

	test("the book's page is made on the server: cover, author, contents, and the way to read it", async ({ page, request }) => {
		// React writes "<!-- -->" between the pieces of a text it puts together.
		const html = (await (await request.get(book.path)).text()).replaceAll("<!-- -->", "");
		expect(html).toContain("Mục lục Quyển 1");
		for (const entry of book.contents) expect(html).toContain(entry.title.replaceAll("&", "&amp;"));

		const response = await open(page, book.path);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle("Đi Qua Khổ Vui Cuộc Đời (Quyển 1) – Trí Tuệ Phật Pháp – Tùng Lâm Hòa Phúc");
		await expect(page.locator(".tlhp-book-cover")).toHaveAttribute("alt", "Bìa sách Đi Qua Khổ Vui Cuộc Đời");
		await expect(page.locator(".tlhp-book-cover")).toHaveAttribute("fetchpriority", "low");
		await expect(page.locator(".tlhp-statue-facts dd")).toHaveText([book.author, book.publisher, "217 trang"]);
		await expect(page.locator(".tlhp-contents li")).toHaveCount(7);
		const reader = page.getByRole("link", { name: /Đọc toàn văn/ });
		await expect(reader).toHaveAttribute("href", book.readerUrl);
		await expect(reader).not.toHaveAttribute("target", "_blank");
		await expect(page.getByRole("link", { name: "Bài giới thiệu sách" })).toHaveAttribute("href", BOOK_POST);
		expect(await axe(page)).toEqual([]);
	});

	test("the book's whole text is on its page, readable without JavaScript, and its contents lead to each part (T17b)", async ({ browser, request }) => {
		expect(book.readerUrl.startsWith(`${book.path}#`)).toBe(true);
		const html = (await (await request.get(book.path)).text()).replaceAll("<!-- -->", "");
		for (const section of bookText.chapters.flatMap((chapter) => chapter.sections)) expect(html).toContain(section.title.replaceAll("&", "&amp;").replaceAll('"', "&quot;"));

		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto(book.path);
		const text = page.locator("#toan-van");
		// No way back to the old site's reader: the canonical address names www, but no link leads there.
		await expect(page.locator('main a[href*="tunglamhoaphuc.com"]')).toHaveCount(0);
		await expect(text.getByRole("heading", { level: 2 })).toHaveText("Toàn văn Quyển 1");
		await expect(text.getByRole("heading", { level: 3 })).toHaveCount(7);
		await expect(text.getByRole("heading", { level: 4 })).toHaveCount(29);
		// A poem keeps its lines.
		expect(await text.locator(".tlhp-book-piece--poem p br").count()).toBeGreaterThan(100);
		await page.locator(".tlhp-contents a").nth(2).click();
		await expect(page).toHaveURL(new RegExp(`#phan-3$`));
		await expect(page.locator("#phan-3 h3")).toBeInViewport();
		await context.close();
	});

	test("an address with an anchor opens at that part, with the page's scrolling running (T17b)", async ({ page }) => {
		await open(page, `${book.path}#phan-3`);
		await expect(page.locator("#phan-3 h3")).toBeInViewport();
		await open(page, book.readerUrl);
		await expect(page.locator("#toan-van h2")).toBeInViewport();
	});

	test("the Tibetan course is made on the server, its Tibetan marked as such, with the way into the room", async ({ page, request }) => {
		const html = await (await request.get(tibetan.path)).text();
		expect(html).toContain("Mục lục giáo trình");
		expect(html).toContain("Bài 24: Lễ Hội &amp; Văn Hóa Phật Giáo Tây Tạng");

		const response = await open(page, tibetan.path);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(tibetan.title);
		await expect(page.locator(".tlhp-contents li")).toHaveCount(25);
		await expect(page.locator(".tlhp-contents li").nth(2).locator('[lang="bo"]')).toHaveText("དབྱངས་བཞི");
		const room = page.getByRole("link", { name: /Vào học ngay/ });
		await expect(room).toHaveAttribute("href", tibetan.appUrl);
		expect(tibetan.appUrl.startsWith("/tibetan-study/")).toBe(true);
		await expect(room).toHaveAttribute("target", "_blank");
		expect(await axe(page)).toEqual([]);
	});

	test("every link inside the list leads to a page that is there", async ({ page, request }) => {
		await open(page, PATH);
		const hrefs = await page.locator("main a[href^='/']").evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!.split("#")[0]))]);
		expect(hrefs.length).toBeGreaterThan(15);
		for (const href of hrefs) expect((await request.get(href)).status(), href).toBeLessThan(400);
	});

	test("the list and the reading rooms fit a phone screen", async ({ page }) => {
		for (const path of [PATH, book.path, tibetan.path]) {
			await open(page, path, 375);
			expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
		}
	});
});
