import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { buddhistYear } from "../../src/libs/lunar";

// T10, T12: the home page, rendered on the server from the content layer (data/snapshot/).
type SwiperElement = HTMLElement & {
	swiper?: { params: { autoplay: { delay: number } }; autoplay: { running: boolean; paused: boolean }; realIndex: number };
};

// What the schedule holds today, worked out here from schedule.json so the checks keep up
// with the calendar: the events not over yet (each title once) and the next to begin.
type RawEvent = { slug: string; title: string; solarDateStr: string; isMultiDay?: boolean; endDateStr?: string };
type RawTheme = { month: number; title: string; quoteLines: string[] };
const SCHEDULE = (JSON.parse(readFileSync("data/snapshot/schedule.json", "utf8")) as { data: { customEvents: RawEvent[]; monthThemes: Record<string, RawTheme> } }).data;
const iso = (dotted: string) => dotted.trim().split(".").reverse().join("-");
const TODAY = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const EVENTS = SCHEDULE.customEvents
	.map((event) => ({ ...event, title: event.title.replace(/\s+/g, " ").trim(), start: iso(event.solarDateStr), end: event.isMultiDay && event.endDateStr ? iso(event.endDateStr) : iso(event.solarDateStr) }))
	.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title, "vi"));
const UPCOMING = EVENTS.filter((event) => event.end >= TODAY)
	.filter((event, idx, list) => list.findIndex((other) => other.title.toLowerCase() === event.title.toLowerCase()) === idx)
	.slice(0, 3);
const NEXT = EVENTS.find((event) => event.start >= TODAY);
const daysLeft = (start: string) => Math.round((Date.parse(start) - Date.parse(TODAY)) / 86_400_000);
const countdown = (event: { start: string }) => {
	const days = daysLeft(event.start);
	return days < 0 ? "Đang diễn ra" : days === 0 ? "Diễn ra hôm nay" : `Còn ${days} ngày`;
};

// T13b: what Lời chào counts and who Chư Tôn Đức shows, from posts.json and gioi-thieu.json.
// A slug two posts share opens only the first, so it counts once.
type RawPost = { slug: string; status: string; mainCategory: string };
const POSTS = (JSON.parse(readFileSync("data/snapshot/posts.json", "utf8")) as { posts: RawPost[] }).posts.filter((post) => post.status === "published");
const postsIn = (section: string) => new Set(POSTS.filter((post) => post.mainCategory.trim() === section).map((post) => post.slug.trim())).size;
type RawTopic = { slug: string; status: string; groupCategory: string; orderIndex: number };
const TEACHERS = (JSON.parse(readFileSync("data/snapshot/gioi-thieu.json", "utf8")) as { topics: RawTopic[] }).topics
	.filter((topic) => topic.status === "published" && topic.groupCategory === "nguoi-lien-quan")
	.sort((a, b) => a.orderIndex - b.orderIndex);
const STATS = [
	["Bài viết Dòng Chảy Hoằng Pháp", postsIn("dong-chay-hoang-phap").toLocaleString("vi-VN")],
	["Bài giảng, pháp âm, ấn phẩm Trí Tuệ Phật Pháp", postsIn("tri-tue-phat-phap").toLocaleString("vi-VN")],
	["Phật lịch", String(buddhistYear(TODAY))],
];

const ENTRANCES = [
	["Giới thiệu", "/gioi-thieu"],
	["Tông Chỉ Tu Học", "/tong-chi-tu-hoc"],
	["Dòng Chảy Hoằng Pháp", "/dong-chay-hoang-phap"],
	["Vũ Trụ Phật Giáo", "/vu-tru-phat-giao"],
	["Bảo Tượng Phật Giáo", "/bao-tuong-phat-giao"],
	["Trí Tuệ Phật Pháp", "/tri-tue-phat-phap"],
];

async function open(page: Page, width = 1440, height = 900) {
	await page.setViewportSize({ width, height });
	await page.goto("/");
	await page.waitForTimeout(1500);
}

const hero = (page: Page) => page.locator(".tlhp-hero");
const entrances = (page: Page) => page.locator("#loi-vao");
const news = (page: Page) => page.locator(".tlhp-news");
const autoplayOf = (page: Page, selector: string) =>
	page.locator(selector).evaluate((el: SwiperElement) => ({ running: !!el.swiper?.autoplay.running, paused: !!el.swiper?.autoplay.paused }));
const transformOf = (page: Page, selector: string) => page.locator(selector).evaluate((el) => getComputedStyle(el).transform);

test.describe("home page content", () => {
	test.use({ reducedMotion: "reduce" });

	test("sends its blocks in the decided order, with real posts, in the first HTML", async ({ request }) => {
		const response = await request.get("/");
		expect(response.status()).toBe(200);
		const html = await response.text();
		expect(html).toContain("<title>Tùng Lâm Hòa Phúc – Nơi để trở về – Chốn thiêng bình yên</title>");
		expect(html).toContain("Pháp sự mới nhất · 17/10/2026");
		expect(html).toContain('href="/dong-chay-hoang-phap/le-hang-thuan-tai-tung-lam-hoa-phuc"');
		const order = [
			'class="tj-slider-section tlhp-hero"',
			'id="loi-vao"',
			'class="tj-blog-section-2',
			'aria-labelledby="loi-chao"',
			'id="loi-thay-day"',
			'aria-labelledby="chu-ton-duc"',
		].map((marker) => html.indexOf(marker));
		expect(order.every((at) => at > 0)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
		// Bexon's sample blocks wait for their tasks (T14, T15); its texts are gone.
		expect(html).not.toMatch(/Leading Future|Our Pricing|Hear from Our|Get to Know Us|happy customer|People Behind|Meet Our Team/);
	});

	test("has one h1 and names every block", async ({ page }) => {
		await open(page);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tùng Lâm Hòa Phúc – Nơi để trở về, chốn thiêng bình yên");
		await expect(hero(page)).toHaveAttribute("aria-label", "Trình chiếu đầu trang");
		await expect(page.getByRole("heading", { level: 2, name: "Khám phá 6 chuyên mục của Bổn tự" })).toBeVisible();
		await expect(page.getByRole("heading", { level: 2, name: "Tin tức hoằng pháp." })).toBeVisible();
	});

	test("the hero opens on Nơi để trở về, then the next retreat with its days left, then the latest ceremony", async ({ page }) => {
		await open(page);
		const slides = hero(page).locator(".hero-slider .tj-slider-item");
		await expect(slides).toHaveCount(NEXT ? 3 : 2);
		await expect(slides.nth(0).locator(".slider-title")).toHaveText("Nơi để trở vềChốn thiêng bình yên");
		await expect(slides.nth(0).getByRole("link", { name: "Tìm hiểu Bổn tự" })).toHaveAttribute("href", "/gioi-thieu");
		if (NEXT) {
			// Counted on Vietnam's calendar on the server.
			await expect(slides.nth(1).locator(".tlhp-hero-overline")).toHaveText(`Khóa tu sắp tới · ${countdown(NEXT)}`);
			await expect(slides.nth(1).locator(".slider-title")).toHaveText(NEXT.title);
			await expect(slides.nth(1).locator("a.tj-primary-btn")).toHaveText("Xem lịch khóa tu");
			await expect(slides.nth(1).locator("a.tj-primary-btn")).toHaveAttribute("href", new RegExp(`^/lich-tu-hoc(\\?thang=${NEXT.start.slice(0, 7)})?#su-kien-${NEXT.slug}$`));
		}
		const latest = slides.last();
		await expect(latest.locator(".tlhp-hero-overline")).toHaveText("Pháp sự mới nhất · 17/10/2026");
		await expect(latest.locator(".slider-title")).toHaveText("Lễ Hằng Thuận tại Tùng lâm Hòa Phúc");
		await expect(latest.locator("a.tj-primary-btn")).toHaveAttribute("href", "/dong-chay-hoang-phap/le-hang-thuan-tai-tung-lam-hoa-phuc");
		await expect(hero(page).locator(".hero-thumb")).toHaveAttribute("aria-hidden", "true");
		await hero(page).getByRole("button", { name: "Khung sau" }).click();
		await expect(slides.nth(1)).toHaveClass(/swiper-slide-active/);
	});

	test("Khóa tu sắp tới lists the next events with their days left, or is not there", async ({ page }) => {
		await open(page);
		const block = page.locator(".tlhp-upcoming");
		if (!UPCOMING.length) {
			await expect(block).toHaveCount(0);
			return;
		}
		await expect(block.getByRole("heading", { level: 2, name: "Khóa tu sắp tới." })).toBeVisible();
		const cards = block.locator(".tlhp-upcoming-card");
		await expect(cards.locator("h3")).toHaveText(UPCOMING.map((event) => event.title));
		await expect(cards.locator(".tlhp-upcoming-countdown")).toHaveText(UPCOMING.map(countdown));
		await expect(cards.first()).toHaveClass(/active/);
		for (const [idx, event] of UPCOMING.entries()) {
			await expect(cards.nth(idx).locator(".price-number")).toHaveText(`${event.start.slice(8)}/${event.start.slice(5, 7)}`);
			const more = cards.nth(idx).locator(".pricing-btn a");
			await expect(more).toHaveAttribute("href", new RegExp(`#su-kien-${event.slug}$`));
			// Three links say "Xem chi tiết"; each also names its event for screen readers.
			await expect(more).toHaveAccessibleName(new RegExp(`^Xem chi tiết\\s*:\\s*${event.title}$`));
		}
		// Nothing left of Bexon's price plans.
		await expect(block).not.toContainText(/gói|plan|\$|₫|VNĐ|tháng\s*\/|per month/i);
		await expect(block.getByRole("link", { name: "Xem lịch tu học" })).toHaveAttribute("href", "/lich-tu-hoc");
	});

	test("Lời Thầy dạy opens on this month's verse, in the scripture style", async ({ page }) => {
		await open(page);
		const month = Number(TODAY.slice(5, 7));
		const themes = Object.values(SCHEDULE.monthThemes).filter((theme) => theme.quoteLines.length);
		const first = [...themes.filter((theme) => theme.month >= month), ...themes.filter((theme) => theme.month < month)][0];
		const block = page.locator(".tlhp-verses");
		await expect(block.getByRole("heading", { level: 2, name: "Lời Thầy dạy." })).toBeVisible();
		await expect(block.locator(".swiper-slide")).toHaveCount(themes.length);
		const active = block.locator(".swiper-slide-active");
		await expect(active.locator(".designation")).toHaveText(`Chủ đề tháng ${first.month}${first.title.trim() ? `: ${first.title.trim()}` : ""}`);
		await expect(active.locator(".tlhp-verse-text p")).toHaveCount(first.quoteLines.length);
		expect(await active.locator(".tlhp-verse-text p").first().evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Noto Serif/);
	});

	test("lists the six ways in, each once for keyboards and screen readers", async ({ page }) => {
		await open(page);
		const links = entrances(page).locator(".tlhp-marquee-list:not([aria-hidden]) a");
		await expect(links).toHaveText(ENTRANCES.map(([label]) => label));
		for (const [index, [, href]] of ENTRANCES.entries()) await expect(links.nth(index)).toHaveAttribute("href", href);
		const copy = entrances(page).locator('.tlhp-marquee-list[aria-hidden="true"]');
		await expect(copy).toHaveAttribute("inert", "");
		await expect(entrances(page).getByRole("link")).toHaveCount(6);
	});

	test("with reduced motion the ways in lie still and all show on a phone", async ({ page }) => {
		await open(page, 375, 812);
		const links = entrances(page).locator(".tlhp-marquee-list:not([aria-hidden]) a");
		for (const box of await links.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
			expect(box.left).toBeGreaterThanOrEqual(0);
			expect(box.right).toBeLessThanOrEqual(375);
		}
		await expect(entrances(page).locator(".tlhp-pause")).toBeHidden();
		expect(await transformOf(page, "#loi-vao .tlhp-marquee-track")).toBe("none");
	});

	test("Tin mới nhất shows the newest posts and Dấu ấn hoằng pháp the most read others", async ({ page }) => {
		await open(page);
		const tabs = news(page).getByRole("tab");
		await expect(tabs).toHaveText(["Tin mới nhất", "Dấu ấn hoằng pháp"]);
		await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
		const panel = news(page).getByRole("tabpanel");
		await expect(panel).toHaveAttribute("aria-labelledby", "tab-tin-moi-nhat");

		// Slides in their own order (the loop moves them around in the page).
		const cards = () =>
			panel.locator(".swiper-slide").evaluateAll((slides) =>
				slides
					.map((slide) => ({
						index: Number(slide.getAttribute("data-swiper-slide-index")),
						title: slide.querySelector("h3")!.textContent!,
						date: slide.querySelector("time")!.getAttribute("datetime")!,
						views: Number(slide.querySelector(".tlhp-post-card-meta span")?.textContent?.replace(/\D/g, "") ?? 0),
					}))
					.sort((a, b) => a.index - b.index),
			);
		const latest = await cards();
		expect(latest).toHaveLength(6);
		expect(latest[0].title).toBe("Lễ Hằng Thuận tại Tùng lâm Hòa Phúc");
		expect(latest.map((card) => card.date)).toEqual(latest.map((card) => card.date).sort().reverse());

		// Arrow keys move along the tabs and select (WAI tabs pattern).
		await tabs.first().focus();
		await page.keyboard.press("ArrowRight");
		await expect(tabs.nth(1)).toBeFocused();
		await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
		await expect(panel).toHaveAttribute("aria-labelledby", "tab-dau-an-hoang-phap");
		const popular = await cards();
		expect(popular.length).toBeGreaterThan(0);
		expect(popular.map((card) => card.views)).toEqual(popular.map((card) => card.views).sort((a, b) => b - a));
		expect(popular.filter((card) => latest.some((other) => other.title === card.title))).toEqual([]);
		await expect(news(page).getByRole("link", { name: "Xem tất cả bài viết" })).toHaveAttribute("href", "/dong-chay-hoang-phap");
	});

	test("Lời chào sends its real figures in the first HTML, read as numbers", async ({ request }) => {
		const html = await (await request.get("/")).text();
		for (const [label, value] of STATS) {
			expect(html).toContain(`<span class="count-text">${label}</span>`);
			expect(html).toContain(`<span class="visually-hidden">${value}</span>`);
		}
	});

	test("Lời chào shows the figures still under reduced motion, and opens the temple's video", async ({ page }) => {
		await open(page);
		const block = page.locator(".tlhp-welcome");
		await expect(block.getByText("Lời chào", { exact: true })).toBeVisible();
		await expect(block.getByRole("heading", { level: 2 })).not.toBeEmpty();
		await expect(block.getByRole("link", { name: "Tìm hiểu Bổn tự" })).toHaveAttribute("href", /^\/gioi-thieu\/[a-z0-9-]+$/);
		await expect(block.locator(".countup-item")).toHaveCount(STATS.length);
		for (const [idx, [label, value]] of STATS.entries()) {
			const item = block.locator(".countup-item").nth(idx);
			await item.scrollIntoViewIfNeeded();
			await expect(item.locator(".count-text")).toHaveText(label);
			// No odometer under reduced motion: the number stands as it came.
			await expect(item.locator(".odometer")).toHaveText(value);
			await expect(item.locator(".odometer-digit")).toHaveCount(0);
		}
		const video = block.getByRole("link", { name: "Xem video: Chốn thiêng bình yên – Tùng Lâm Hòa Phúc" });
		await expect(video).toHaveAttribute("href", "https://www.youtube-nocookie.com/embed/HE2MnR8Hl5c?rel=0");
	});

	test("Chư Tôn Đức shows the four teachers, each card leading to their page", async ({ page, request }) => {
		await open(page);
		const block = page.locator(".tlhp-teachers");
		await expect(block.getByRole("heading", { level: 2, name: "Chư Tôn Đức." })).toBeVisible();
		const links = block.locator(".team-content a");
		await expect(links).toHaveCount(TEACHERS.length);
		expect(TEACHERS.length).toBe(4);
		for (const [idx, topic] of TEACHERS.entries()) {
			await expect(links.nth(idx)).toHaveAttribute("href", `/gioi-thieu/${topic.slug}`);
			expect((await request.get(`/gioi-thieu/${topic.slug}`)).status(), topic.slug).toBe(200);
		}
		await expect(block.getByRole("link", { name: "Xem thêm về Bổn tự" })).toHaveAttribute("href", "/gioi-thieu");
	});

	test("passes axe WCAG A/AA on both tabs", async ({ page }) => {
		await open(page);
		const check = async () => {
			const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
			return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
		};
		expect(await check()).toEqual([]);
		await news(page).getByRole("tab", { name: "Dấu ấn hoằng pháp" }).click();
		expect(await check()).toEqual([]);
	});
});

test.describe("home hero picture", () => {
	test.use({ reducedMotion: "reduce" });

	test("the first frame is fetched first, in the size of the screen", async ({ page, isMobile }) => {
		const fetched: string[] = [];
		page.on("request", (request) => {
			if (/toan-canh-chua-(?!nho)/.test(request.url())) fetched.push(new URL(request.url()).pathname);
		});
		await open(page, isMobile ? 412 : 1440, isMobile ? 839 : 900);
		// Asked for from <head>, and only the one size this screen shows.
		await expect(page.locator('head link[rel="preload"][as="image"][fetchpriority="high"]')).toHaveCount(2);
		expect([...new Set(fetched)]).toEqual([isMobile ? "/images/hero/toan-canh-chua-doc-760.webp" : "/images/hero/toan-canh-chua-1920.webp"]);
		const first = hero(page).locator(".tj-slider-item").first().locator("img");
		await expect(first).toHaveAttribute("fetchpriority", "high");
		await expect(first).toHaveAttribute("loading", "eager");
		await expect(hero(page).locator(".tj-slider-item").nth(1).locator("img")).toHaveAttribute("loading", "lazy");
		const source = await first.evaluate((img: HTMLImageElement) => img.currentSrc);
		// An upright phone gets the narrow crop; a wide screen the 1920px picture.
		expect(source).toMatch(isMobile ? /toan-canh-chua-doc-760\.webp$/ : /toan-canh-chua-1920\.webp$/);
	});

	test("keeps at least 55% đen mun over the picture", async ({ page }) => {
		for (const width of [1440, 390]) {
			await open(page, width, 844);
			const alphas = await hero(page)
				.locator(".tj-slider-item")
				.first()
				.evaluate((el) => {
					const gradient = getComputedStyle(el, "::after").backgroundImage;
					return [...gradient.matchAll(/(?:rgba?\([^)]*?,\s*|color\(srgb [^/]+\/\s*)([\d.]+)\)/g)].map((match) => Number(match[1]));
				});
			expect(alphas.length).toBeGreaterThanOrEqual(3);
			expect(Math.min(...alphas)).toBeGreaterThanOrEqual(0.55);
		}
	});

});

test.describe("home sliders with motion allowed", () => {
	test("Lời chào counts up to the real figures when scrolled to", async ({ page }) => {
		await open(page);
		const block = page.locator(".tlhp-welcome");
		// Once the script runs, the figures drop to 0 and wait out of view.
		await expect(block.locator(".odometer-digit").first()).toBeAttached();
		await block.locator(".countup-item").last().scrollIntoViewIfNeeded();
		// The digits the odometer settles on (each digit also holds a hidden "8" for its width).
		const shown = (idx: number) =>
			block
				.locator(".countup-item")
				.nth(idx)
				.locator(".odometer")
				.evaluate((el) => (el.classList.contains("odometer-animating") ? "" : [...el.querySelectorAll(".odometer-value, .odometer-formatting-mark")].map((part) => part.textContent).join("")));
		for (const [idx, [, value]] of STATS.entries()) {
			await expect.poll(() => shown(idx), { timeout: 8000 }).toBe(value);
		}
	});

	test("every self-moving slider waits 7 seconds a frame", async ({ page }) => {
		await open(page);
		for (const selector of [".tlhp-hero .hero-slider", ".tlhp-news .blog-slider", ".tlhp-verses .testimonial-slider-2"]) {
			const delay = await page.locator(selector).evaluate((el: SwiperElement) => el.swiper!.params.autoplay.delay);
			expect(delay, selector).toBeGreaterThanOrEqual(7000);
			expect((await autoplayOf(page, selector)).running, selector).toBe(true);
		}
	});

	test("the hero pause button stops and restarts it from the keyboard", async ({ page }) => {
		await open(page);
		const pause = hero(page).getByRole("button", { name: "Tạm dừng trình chiếu đầu trang" });
		await expect(pause).toBeVisible();
		await pause.focus();
		await page.keyboard.press("Enter");
		const play = hero(page).getByRole("button", { name: "Chạy tiếp trình chiếu đầu trang" });
		await expect(play).toBeFocused();
		expect((await autoplayOf(page, ".hero-slider")).running).toBe(false);
		await page.keyboard.press("Enter");
		await expect(pause).toBeFocused();
		expect((await autoplayOf(page, ".hero-slider")).running).toBe(true);
	});

	test("focus moving into a slider stops it, the pointer over it holds it", async ({ page, isMobile }) => {
		await open(page);
		if (!isMobile) {
			await hero(page).locator(".slider-content").first().hover();
			await expect.poll(async () => (await autoplayOf(page, ".hero-slider")).paused).toBe(true);
			await page.mouse.move(5, 895);
			await expect.poll(async () => (await autoplayOf(page, ".hero-slider")).paused).toBe(false);
		}
		await hero(page).getByRole("link", { name: "Tìm hiểu Bổn tự" }).focus();
		await expect.poll(async () => (await autoplayOf(page, ".hero-slider")).running).toBe(false);
		await expect(hero(page).getByRole("button", { name: "Chạy tiếp trình chiếu đầu trang" })).toBeVisible();

		await news(page).getByRole("tab", { name: "Tin mới nhất" }).focus();
		await expect.poll(async () => (await autoplayOf(page, ".tlhp-news .blog-slider")).running).toBe(false);
	});

	test("the news slider keeps a stopped state when the tab changes", async ({ page }) => {
		await open(page);
		const pause = news(page).getByRole("button", { name: "Tạm dừng danh sách bài" });
		await pause.scrollIntoViewIfNeeded();
		await pause.click();
		await news(page).getByRole("tab", { name: "Dấu ấn hoằng pháp" }).click();
		await expect(news(page).getByRole("button", { name: "Chạy tiếp danh sách bài" })).toBeVisible();
		expect((await autoplayOf(page, ".tlhp-news .blog-slider")).running).toBe(false);
	});

	test("the ways in slide, and stop under the pointer, on focus and with their button", async ({ page, isMobile }) => {
		await open(page);
		await entrances(page).scrollIntoViewIfNeeded();
		// Smooth scrolling glides on for a moment; the pointer must land on a still page.
		await page.waitForTimeout(2000);
		const track = "#loi-vao .tlhp-marquee-track";
		const moves = async () => {
			// The animation runs off the main thread; its stop shows a frame later.
			await page.waitForTimeout(150);
			const before = await transformOf(page, track);
			await page.waitForTimeout(600);
			return (await transformOf(page, track)) !== before;
		};
		expect(await moves()).toBe(true);

		if (!isMobile) {
			await entrances(page).locator(".tlhp-marquee-view").hover();
			expect(await moves()).toBe(false);
			await page.mouse.move(5, 5);
			expect(await moves()).toBe(true);
		}

		await entrances(page).getByRole("link", { name: "Vũ Trụ Phật Giáo" }).focus();
		expect(await moves()).toBe(false);
		await entrances(page).getByRole("button", { name: "Tạm dừng dải chuyên mục" }).focus();
		expect(await moves()).toBe(true);
		await page.keyboard.press("Enter");
		await expect(entrances(page).getByRole("button", { name: "Chạy tiếp dải chuyên mục" })).toBeFocused();
		expect(await moves()).toBe(false);
	});
});

test.describe("loading without layout shift", () => {
	test.use({ reducedMotion: "reduce" });
	// On a loaded machine the text fonts too can swap in after the first paint and nudge a
	// button by a few pixels (font fallback metrics, T41a); that is not what this checks.
	test.describe.configure({ retries: 2 });

	// On the live site the icon fonts arrive after the page (they are not preloaded); held
	// back here, they once grew the hero's arrows from 22 to 28px.
	test("nothing shifts while the page loads, even when the icon fonts come late", async ({ page }) => {
		await page.route(/bexon-icons|\/fa-[a-z-]+\./, async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.continue();
		});
		await page.addInitScript(() => {
			(window as unknown as { cls: number }).cls = 0;
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
					if (!entry.hadRecentInput) (window as unknown as { cls: number }).cls += entry.value;
				}
			}).observe({ type: "layout-shift", buffered: true });
		});
		await open(page);
		await page.waitForTimeout(2500);
		expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBe(0);
	});
});
