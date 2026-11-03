import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// T14: /tong-chi-tu-hoc and its 25 articles, rendered on the server from
// data/snapshot/tong-chi.json (npm run snapshot:fetch).
const PATH = "/tong-chi-tu-hoc";
type RawArticle = {
	slug: string;
	title: string;
	category: string;
	status: string;
	videoBlock?: { videoUrl?: string } | null;
	photoGallery?: unknown[];
	sourceBook?: { bookTitle?: string } | null;
	featuredArticle?: { title?: string } | null;
};
const ARTICLES = (JSON.parse(readFileSync("data/snapshot/tong-chi.json", "utf8")) as { data: RawArticle[] }).data.filter((article) => article.status === "published");
const GROUPS = [...new Set(ARTICLES.map((article) => article.category))];
const NIEM_PHAT = `${PATH}/niem-phat-phuong-phap-tro-hanh`;
// The designer's notes the old bodies hold between their lines.
const NOTES = /\b(card|click|popup|quote|typography|infographic|banner|knowledge hu[bg])\b|một ảnh|ngăn kéo|sơ đồ|chỗ này sẽ|\S_\S+_/iu;

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

test.describe("Tông Chỉ Tu Học", () => {
	test.use({ reducedMotion: "reduce" });

	test("Niệm Phật sends its whole text in the first HTML (the old site showed none of it)", async ({ request }) => {
		const response = await request.get(NIEM_PHAT);
		expect(response.status()).toBe(200);
		const html = (await response.text()).replaceAll("<!-- -->", "");
		expect(html).toContain("<title>Niệm Phật – Tông Chỉ Tu Học – Tùng Lâm Hòa Phúc</title>");
		expect(html).toContain("<h2>NIỆM PHẬT LÀ NHỚ PHẬT</h2>");
		expect(html).toContain("Niệm Phật là thực tập nhớ Phật, học Phật và sống theo hạnh Phật.");
		expect(html).toContain("— Vô Trí – Tâm Hòa");
		expect(html).not.toContain("Đang tải");
	});

	test("every article opens from the server, with no note for the designer in its text", async ({ request }) => {
		for (const article of ARTICLES) {
			const response = await request.get(`${PATH}/${article.slug}`);
			expect(response.status(), article.slug).toBe(200);
			const html = await response.text();
			const body = html.match(/<div class="tlhp-reading">([\s\S]*?)<\/div>/)?.[1] ?? "";
			expect(body.length, article.slug).toBeGreaterThan(100);
			expect(body.replace(/<[^>]+>/g, " "), article.slug).not.toMatch(NOTES);
		}
		expect((await request.get(`${PATH}/khong-co-bai-nay`)).status()).toBe(404);
	});

	test("lists the five groups, each with all its articles, and the heading's links lead to them", async ({ page }) => {
		await open(page, PATH);
		await expect(page).toHaveTitle("Tông Chỉ Tu Học – Tùng Lâm Hòa Phúc");
		const section = page.locator(".tlhp-tong-chi");
		await expect(section.locator(".service-wrapper-2 > li")).toHaveCount(GROUPS.length);
		expect(GROUPS).toHaveLength(5);
		for (const group of GROUPS) {
			const links = section.locator(`#${group} .list-items a`);
			const slugs = ARTICLES.filter((article) => article.category === group).map((article) => `${PATH}/${article.slug}`);
			await expect(links).toHaveCount(slugs.length);
			for (const [idx, href] of slugs.entries()) await expect(links.nth(idx)).toHaveAttribute("href", href);
		}
		const nav = section.getByRole("navigation", { name: "Các nhóm Tông Chỉ Tu Học" });
		await nav.getByRole("link", { name: "Lộ Trình Tu Học" }).click();
		await expect(page.locator("#lo-trinh-tu-hoc")).toBeFocused();
		expect(await axe(page)).toEqual([]);
	});

	test("an article shows its side blocks only when it has them", async ({ page }) => {
		await open(page, NIEM_PHAT);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Niệm Phật");
		const tabs = page.locator(".tlhp-anchor-tabs a");
		await expect(tabs).toHaveText(["Tổng quan", "Nội dung chính", "Video", "Album ảnh", "Nguồn tham khảo"]);
		await expect(page.locator("#video").getByRole("link", { name: /^Xem video: / })).toHaveAttribute("href", "https://www.youtube-nocookie.com/embed/MKt_sLwxmNU?rel=0");
		await expect(page.locator("#album-anh .tlhp-gallery a")).toHaveCount(1);
		await expect(page.locator("#nguon-tham-khao")).toContainText("Phương Pháp Hành Trì — Niệm Phật & Tịnh Độ");
		// The body's own links lead to pages that are there.
		const bodyLink = page.locator(".tlhp-reading a", { hasText: "Bồ Đề tâm" });
		await expect(bodyLink).toHaveAttribute("href", `${PATH}/bo-de-tam-coi-nguon-thien-phap`);
		await expect(page.locator(`aside a[aria-current="page"]`)).toHaveText("Niệm Phật");
		expect(await axe(page)).toEqual([]);

		const bare = ARTICLES.find((article) => !article.videoBlock?.videoUrl && !article.photoGallery?.length)!;
		await open(page, `${PATH}/${bare.slug}`);
		await expect(page.locator("#video, #album-anh")).toHaveCount(0);
		await expect(tabs).not.toContainText(["Video"]);
		const tabTargets = await tabs.evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).hash.slice(1)));
		for (const id of tabTargets) await expect(page.locator(`#${id}`), id).toHaveCount(1);
	});

	test("on a phone the cards stack without covering each other or the page's width", async ({ page }) => {
		await open(page, PATH, 375);
		const boxes = await page.locator(".tlhp-tong-chi .service-wrapper-2 > li").evaluateAll((items) =>
			items.map((item) => {
				const box = item.getBoundingClientRect();
				return { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY, right: box.right, transform: getComputedStyle(item.firstElementChild!).transform };
			}),
		);
		for (let idx = 1; idx < boxes.length; idx++) expect(boxes[idx].top).toBeGreaterThanOrEqual(boxes[idx - 1].bottom - 1);
		for (const box of boxes) {
			expect(box.right).toBeLessThanOrEqual(375);
			// Reduced motion: a plain list, nothing slid aside.
			expect(box.transform).toBe("none");
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
	});
});

test.describe("Tông Chỉ Tu Học with motion allowed", () => {
	test("the heading stays while the cards slide in, and on a phone nothing covers the cards", async ({ page, isMobile }) => {
		await open(page, PATH, isMobile ? 375 : 1440);
		const cards = page.locator(".tlhp-tong-chi .service-wrapper-2 > li");
		await cards.nth(1).scrollIntoViewIfNeeded();
		await page.mouse.wheel(0, 400);
		await page.waitForTimeout(1500);
		if (!isMobile) {
			// Pinned by ScrollTrigger: the heading is still at the top while the third card passes.
			await cards.nth(2).evaluate((el) => el.scrollIntoView({ block: "center" }));
			await page.waitForTimeout(1500);
			const top = await page.locator(".tlhp-tong-chi .slidebar-stickiy").evaluate((el) => el.getBoundingClientRect().top);
			expect(top).toBeGreaterThanOrEqual(0);
			expect(top).toBeLessThan(200);
		}
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(overflow).toBeLessThanOrEqual(0);
	});
});
