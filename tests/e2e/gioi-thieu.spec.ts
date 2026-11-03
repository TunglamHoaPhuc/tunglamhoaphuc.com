import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// T13a: /gioi-thieu and its six topics, rendered on the server from
// data/snapshot/gioi-thieu.json (npm run snapshot:fetch).
const PATH = "/gioi-thieu";
type RawTopic = { slug: string; title: string; subtitle: string; groupCategory: string; groupCategoryName: string; milestones: unknown };
const TOPICS = (JSON.parse(readFileSync("data/snapshot/gioi-thieu.json", "utf8")) as { topics: RawTopic[] }).topics;
const milestonesOf = (topic: RawTopic) => (typeof topic.milestones === "string" ? JSON.parse(topic.milestones) : topic.milestones) as unknown[];

async function open(page: Page, path: string, width = 1440) {
	await page.setViewportSize({ width, height: 900 });
	const response = await page.goto(path);
	await page.waitForTimeout(1500);
	return response;
}

test.describe("Giới thiệu", () => {
	test.use({ reducedMotion: "reduce" });

	test("lists the six topics in their three groups", async ({ page }) => {
		const response = await open(page, PATH);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle("Giới thiệu – Tùng Lâm Hòa Phúc");
		const groups = [...new Map(TOPICS.map((topic) => [topic.groupCategory, topic.groupCategoryName])).entries()];
		expect(groups).toHaveLength(3);
		await expect(page.locator(".tlhp-about-group > h2")).toHaveText(groups.map(([, name]) => name));
		for (const [slug] of groups) await expect(page.locator(`#${slug} .tlhp-about-card`)).toHaveCount(TOPICS.filter((topic) => topic.groupCategory === slug).length);
		for (const topic of TOPICS) {
			await expect(page.getByRole("link", { name: topic.title, exact: true })).toHaveAttribute("href", `${PATH}/${topic.slug}`);
		}
	});

	test("each topic page comes from the server with its own title and description", async ({ request }) => {
		const seen = new Set<string>();
		for (const topic of TOPICS) {
			const response = await request.get(`${PATH}/${topic.slug}`);
			expect(response.status(), topic.slug).toBe(200);
			const html = (await response.text()).replaceAll("<!-- -->", "");
			const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
			const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
			expect(title, topic.slug).toMatch(/ – Giới thiệu – Tùng Lâm Hòa Phúc$/);
			expect(description.length, topic.slug).toBeGreaterThan(20);
			expect(seen.has(title) || seen.has(description), topic.slug).toBe(false);
			seen.add(title);
			seen.add(description);
			expect(html).toContain('class="tlhp-reading"');
		}
	});

	test("the timeline is an ordered list a screen reader reads in order", async ({ page }) => {
		const topic = TOPICS.find((item) => item.slug === "tieu-su-su-to") ?? TOPICS.find((item) => milestonesOf(item).length)!;
		await open(page, `${PATH}/${topic.slug}`);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(topic.title);
		const list = page.locator("#moc-nien-bieu ol.tlhp-milestones");
		await expect(list).toHaveCount(1);
		await expect(list.getByRole("listitem")).toHaveCount(milestonesOf(topic).length);
		// The drawn numbers are for the eye; the list itself counts for screen readers.
		const snapshot = await list.ariaSnapshot();
		expect(snapshot).toMatch(/^- list:/);
		expect(snapshot).not.toMatch(/0\d\./);
		const first = milestonesOf(topic)[0] as { year: string; title: string };
		await expect(list.getByRole("listitem").first()).toContainText(first.year);
		await expect(list.getByRole("listitem").first().getByRole("heading", { level: 3 })).toHaveText(first.title);
	});

	test("shows the teaching, the book and the reading frame for the abbot", async ({ page }) => {
		await open(page, `${PATH}/su-phu-tru-tri`);
		await expect(page.locator(".tlhp-about-quote blockquote p").first()).toContainText("Hạnh phúc thật sự");
		await expect(page.getByRole("complementary", { name: "Tác phẩm" })).toContainText("Đi Qua Khổ Vui Cuộc Đời");
		await expect(page.getByRole("button", { name: "A+ phóng to chữ" })).toBeVisible();
		await expect(page.locator("#cung-nhom .tlhp-about-card")).toHaveCount(3);
	});

	test("the menu's three ways in all land somewhere real", async ({ page, request }) => {
		for (const path of [`${PATH}/lich-su-tung-lam-hoa-phuc`, `${PATH}/van-hoa-ung-xu`]) expect((await request.get(path)).status(), path).toBe(200);
		await open(page, `${PATH}#nguoi-lien-quan`);
		await expect(page.locator("#nguoi-lien-quan")).toBeAttached();
		await expect(page.locator("#nguoi-lien-quan > h2")).toBeInViewport();
	});

	test("answers a real 404 for a topic that does not exist", async ({ request }) => {
		expect((await request.get(`${PATH}/khong-co-chu-de-nay`)).status()).toBe(404);
	});

	for (const path of [PATH, `${PATH}/tieu-su-su-to`]) {
		test(`${path} passes axe WCAG A/AA`, async ({ page }) => {
			await open(page, path);
			const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
			expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
		});
	}
});
