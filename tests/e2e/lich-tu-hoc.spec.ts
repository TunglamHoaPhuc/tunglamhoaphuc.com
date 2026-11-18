import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// T11: /lich-tu-hoc, rendered on the server from data/snapshot/schedule.json
// (npm run snapshot:fetch). Months are given in the address so the checks do not move with
// the calendar; only "today" is worked out here.
const PATH = "/lich-tu-hoc";
const NOVEMBER = `${PATH}?thang=2026-11`;

type RawEvent = { slug: string; solarDateStr: string; isMultiDay?: boolean; endDateStr?: string };
const EVENTS = (JSON.parse(readFileSync("data/snapshot/schedule.json", "utf8")) as { data: { customEvents: RawEvent[] } }).data.customEvents;

const iso = (dotted: string) => dotted.trim().split(".").reverse().join("-");
const todayInVietnam = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

// The lunar day from ICU's Chinese calendar, an independent check of src/libs/lunar.ts
// (the two agree for 2026; see tests/unit/lunar.test.ts).
const chinese = new Intl.DateTimeFormat("en-u-ca-chinese", { timeZone: "UTC", day: "numeric", month: "numeric" });
function lunar(isoDate: string): string {
	const parts = chinese.formatToParts(new Date(`${isoDate}T00:00:00Z`));
	const month = parts.find((part) => part.type === "month")!.value;
	return `${parts.find((part) => part.type === "day")!.value}/${parseInt(month, 10)}${month.includes("bis") ? "N" : ""}`;
}
const solar = (isoDate: string) => isoDate.split("-").reverse().join("/");

async function open(page: Page, path = NOVEMBER, width = 1440) {
	await page.setViewportSize({ width, height: 900 });
	const response = await page.goto(path);
	await page.waitForTimeout(1500);
	return response;
}

const grid = (page: Page) => page.getByRole("table", { name: /Lịch tháng/ });
const cards = (page: Page) => page.locator(".tlhp-event-card");

test.describe("schedule page", () => {
	test.use({ reducedMotion: "reduce" });

	test("sends the month, its lunar months and its events in the first HTML", async ({ request }) => {
		const response = await request.get(NOVEMBER);
		expect(response.status()).toBe(200);
		// React marks where one piece of text ends and the next begins.
		const html = (await response.text()).replaceAll("<!-- -->", "");
		expect(html).toContain("<title>Lịch tu học – Tùng Lâm Hòa Phúc</title>");
		expect(html).toContain("Tháng 11/2026");
		expect(html).toContain("tháng Chín – tháng Mười âm lịch năm Bính Ngọ · Phật lịch 2570");
		expect(html.match(/class="blog-item style-2 tlhp-event-card"/g)).toHaveLength(6);
	});

	test(`all ${EVENTS.length} events show their solar and lunar days`, async ({ page }) => {
		expect(EVENTS).toHaveLength(15);
		const months = [...new Set(EVENTS.map((event) => iso(event.solarDateStr).slice(0, 7)))];
		let seen = 0;
		for (const month of months) {
			await open(page, `${PATH}?thang=${month}`);
			for (const event of EVENTS.filter((item) => iso(item.solarDateStr).slice(0, 7) === month)) {
				const start = iso(event.solarDateStr);
				const end = event.isMultiDay && event.endDateStr ? iso(event.endDateStr) : start;
				const facts = page.locator(`#su-kien-${event.slug} .tlhp-event-facts dd`).first();
				await expect(facts).toContainText(start === end ? solar(start) : `${solar(start).slice(0, 5)} – ${solar(end)}`);
				await expect(facts).toContainText(`Âm lịch ${lunar(start)}${start === end ? " " : " – "}`);
				if (start !== end) await expect(facts).toContainText(`– ${lunar(end)} `);
				seen++;
			}
		}
		expect(seen).toBe(15);
	});

	test("the grid runs Monday to Sunday with lunar days, and marks today", async ({ page }) => {
		await open(page);
		await expect(grid(page).getByRole("columnheader")).toHaveText(["T2", "T3", "T4", "T5", "T6", "T7", "CN"]);
		const cell = (day: number) => grid(page).locator("td:not(.is-outside)").nth(day - 1);
		await expect(cell(9)).toContainText("âm lịch ngày 1 tháng Mười");
		await expect(cell(9).locator(".tlhp-day-lunar [aria-hidden]")).toHaveText("1/10");
		await expect(cell(23).locator(".tlhp-day-lunar [aria-hidden]")).toHaveText("Rằm");
		await expect(cell(1)).toHaveClass(/is-sunday/);

		await open(page, PATH);
		const today = grid(page).locator('td[aria-current="date"]');
		await expect(today).toHaveCount(1);
		await expect(today.locator(".tlhp-day-solar")).toContainText(String(Number(todayInVietnam().slice(8))));
	});

	// As on the old calendar: the regular ceremonies on their lunar days, in every month ahead.
	test("puts the regular ceremonies on their lunar days, this month and the months ahead", async ({ page }) => {
		await open(page);
		const cell = (day: number) => grid(page).locator("td:not(.is-outside)").nth(day - 1);
		const expected: [number, string, string][] = [
			[1, "TIỂU SÁM HỐI", "p2"],
			[8, "ĐẠI SÁM HỐI", "p1"],
			[9, "CẦU QUỐC THÁI DÂN AN", "p3"],
			[16, "TIỂU SÁM HỐI", "p2"],
			[22, "ĐẠI SÁM HỐI", "p1"],
			[23, "CẦU QUỐC THÁI DÂN AN", "p3"],
		];
		for (const [day, name] of expected) {
			await expect(cell(day).locator(".tlhp-day-event.is-khoa-le-truyen-thong img")).toHaveCount(1);
			await expect(cell(day)).toContainText(name);
		}
		// A day with only a ceremony leads to the ceremony's card further down.
		await expect(cell(1).getByRole("link")).toHaveAttribute("href", /#khoa-le-p2$/);
		await expect(page.locator("#khoa-le-p2")).toHaveCount(1);
		const types = page.getByRole("navigation", { name: "Loại sự kiện" });
		await expect(types.getByRole("link", { name: /Khóa Lễ Truyền Thống/ }).locator(".tlhp-pill-count")).toHaveText("6");

		await open(page, `${PATH}?thang=2027-06`);
		expect(await grid(page).locator(".tlhp-day-event.is-khoa-le-truyen-thong").count()).toBeGreaterThanOrEqual(5);
	});

	test("draws the old calendar's marks: red lunar badge, glowing today and long-event days", async ({ page }) => {
		await open(page);
		const cell = (day: number) => grid(page).locator("td:not(.is-outside)").nth(day - 1);
		await expect(cell(9).locator(".tlhp-day-lunar")).toHaveCSS("background-color", "rgb(220, 38, 38)");
		await expect(cell(12)).toHaveClass(/in-range/);
		await expect(cell(12).locator(".tlhp-day-solar")).toHaveCSS("color", "rgb(255, 222, 89)");
		await expect(cell(4)).not.toHaveClass(/in-range/);
	});

	test("a day opens its events in a dialog: keyboard in, Esc out, the way to the event's page", async ({ page }) => {
		await open(page);
		const day = grid(page).getByRole("link", { name: "Thứ Bảy, ngày 7 âm lịch ngày 29 tháng Chín: PHÁP HỘI NIỆM PHẬT" });
		await day.focus();
		await page.keyboard.press("Enter");
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole("heading", { level: 3 })).toHaveText("PHÁP HỘI NIỆM PHẬT");
		await expect(dialog).toContainText("Âm lịch 29/9 Bính Ngọ");
		await expect(dialog.getByRole("button", { name: "Đóng" })).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(day).toBeFocused();

		// A day with an event and a ceremony shows both; the event's page is one click away.
		await grid(page).locator('a.tlhp-day[data-date="2026-11-08"]').click();
		await expect(dialog.locator("article")).toHaveCount(2);
		await dialog.getByRole("link", { name: /Xem chi tiết PHÁP HỘI NIỆM PHẬT/ }).click();
		await expect(page).toHaveURL(/\/lich-tu-hoc\/phap-hoi-niem-phat-thang-9-binh-ngo-ngay-2$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("PHÁP HỘI NIỆM PHẬT");
	});

	test("every event and ceremony has its page at the old addresses, made on the server", async ({ page, request }) => {
		const html = (await (await request.get(`${PATH}/cau-quoc-thai-dan-an`)).text()).replaceAll("<!-- -->", "");
		expect(html).toContain("Thông tin thời khóa hành trì");
		expect(html).toContain("mùng 1 và ngày rằm âm lịch hằng tháng");
		expect((await request.get(`${PATH}/khong-co-su-kien-nay`)).status()).toBe(404);

		const response = await open(page, `${PATH}/phap-hoi-luong-hoang-sam-gieo-duyen-xuat-gia-2026`);
		expect(response?.status()).toBe(200);
		await expect(page.locator(".tlhp-event-info dt")).toHaveText(["Thời gian", "Khung giờ", "Địa điểm", "Đối tượng"]);
		await expect(page.locator(".tlhp-event-info")).toContainText("09/11 – 18/11/2026");
		await expect(page.getByRole("link", { name: /Trở về lịch tu học/ })).toHaveAttribute("href", /#su-kien-phap-hoi-luong-hoang-sam-gieo-duyen-xuat-gia-2026$/);

		await open(page, `${PATH}/dai-sam-hoi`);
		await expect(page.locator(".tlhp-event-days li")).toHaveCount(6);
		const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		expect(axe.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
	});

	test("filters by type and steps through months, announcing the change", async ({ page }) => {
		await open(page);
		const types = page.getByRole("navigation", { name: "Loại sự kiện" });
		await types.getByRole("link", { name: /Đại Lễ Sự Kiện/ }).click();
		// ?thang= is left out while November is this month.
		await expect(page).toHaveURL(/[?&]loai=dai-le-su-kien/);
		await expect(cards(page)).toHaveCount(2);
		await expect(types.getByRole("link", { name: /Đại Lễ Sự Kiện/ })).toHaveAttribute("aria-current", "page");
		await expect(page.getByRole("status")).toHaveText("Tháng 11/2026: 2 sự kiện loại Đại Lễ Sự Kiện");
		await expect(grid(page).locator("td.has-events")).toHaveCount(2);

		await page.getByRole("navigation", { name: "Chọn tháng" }).getByRole("link", { name: /Tháng 12\/2026/ }).click();
		await expect(page.getByRole("heading", { level: 2, name: "Tháng 12/2026", exact: true })).toBeVisible();
		await expect(page.getByRole("status")).toHaveText("Tháng 12/2026: chưa có sự kiện loại Đại Lễ Sự Kiện");
		await expect(page.locator(".tlhp-empty")).toContainText("Chưa có lịch Đại Lễ Sự Kiện trong tháng 12/2026");
	});

	test("an empty month points to the next one with events; odd values fall back", async ({ page }) => {
		await open(page, `${PATH}?thang=2026-09`);
		await expect(cards(page)).toHaveCount(0);
		await expect(page.locator(".tlhp-empty").getByRole("link", { name: "Xem tháng 10/2026" })).toHaveAttribute("href", `${PATH}?thang=2026-10`);

		const response = await open(page, `${PATH}?thang=2026-13&loai=khong-co`);
		expect(response?.status()).toBe(200);
		const month = todayInVietnam().slice(0, 7).split("-");
		await expect(page.getByRole("heading", { level: 2, name: `Tháng ${Number(month[1])}/${month[0]}`, exact: true })).toBeVisible();
		await expect(page.getByRole("navigation", { name: "Loại sự kiện" }).getByRole("link", { name: /Tất cả/ })).toHaveAttribute("aria-current", "page");
	});

	test("shows the month's theme with its verse", async ({ page }) => {
		await open(page);
		const theme = page.getByRole("complementary", { name: "Hoằng Pháp - Kiến An mãi nhớ Thầy" });
		await expect(theme).toContainText("Chủ đề tháng 11");
		await expect(theme.locator("blockquote p")).toHaveCount(8);
		await expect(theme.locator("blockquote b").first()).toHaveText("Hoằng Pháp - Kiến An");
		await expect(theme.locator("figcaption")).toHaveText("— Vô Trí - Tâm Hòa");
	});

	test("Đăng ký khóa tu in the header lands on how to sign up by phone", async ({ page }) => {
		await open(page, `${PATH}#khoa-tu`);
		const section = page.locator("#khoa-tu");
		await expect(section.getByRole("heading", { name: "Đăng ký khóa tu" })).toBeInViewport();
		await expect(section.getByRole("link", { name: "Gọi Phật tử Bảo Trâm: 0979.345.373" })).toHaveAttribute("href", "tel:0979345373");
		await expect(section.locator(".tlhp-register-contacts li")).toHaveCount(7);
		await expect(page.locator(".tlhp-programs h3")).toHaveText(["ĐẠI SÁM HỐI", "TIỂU SÁM HỐI", "CẦU QUỐC THÁI DÂN AN"]);
	});

	test("an event video opens youtube-nocookie in the lightbox", async ({ page }) => {
		await open(page);
		const video = page.locator("#su-kien-le-tien-thuong-phap-hoi-cung-duong-tang-bao-2026 .tlhp-event-video");
		await expect(video).toHaveAttribute("href", /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}/);
		await expect(async () => {
			await video.focus();
			await page.keyboard.press("Enter");
			await expect(page.locator(".glightbox-container iframe")).toHaveAttribute("src", /youtube-nocookie\.com/, { timeout: 1500 });
		}).toPass({ timeout: 8000 });
	});

	test("passes axe WCAG A/AA", async ({ page }) => {
		await open(page);
		const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`))).toEqual([]);
	});
});

test.describe("schedule page with smooth scrolling on", () => {
	test.skip(({ isMobile }) => isMobile, "smooth scrolling is checked with the mouse");

	// A day opens its dialog (no glide any more); closing it leaves the calendar where it was.
	test("a day opens its dialog in place, and the calendar stays put when it closes", async ({ page }) => {
		await open(page);
		const day = grid(page).getByRole("link", { name: /ngày 19 âm lịch/ });
		// Focus brings the day into view with ScrollSmoother's own glide; wait for it to settle.
		await day.focus();
		const top = () => day.evaluate((el) => Math.round(el.getBoundingClientRect().top));
		await expect.poll(async () => Math.abs((await top()) - (await top())), { timeout: 4000 }).toBe(0);
		await page.waitForTimeout(1500);
		const before = await top();
		await page.keyboard.press("Enter");
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(/LỄ TIÊN THƯỜNG/);
		await expect(page).toHaveURL(/\/lich-tu-hoc\?thang=2026-11$/);
		await page.waitForTimeout(800);
		await dialog.getByRole("button", { name: "Đóng" }).click();
		await expect(dialog).toBeHidden();
		await expect(day).toBeFocused();
		await page.waitForTimeout(800);
		expect(Math.abs((await top()) - before)).toBeLessThan(4);
	});
});

test.describe("loading without layout shift", () => {
	test.use({ reducedMotion: "reduce" });
	// On a loaded machine the text fonts too can swap in after the first paint and nudge a
	// button by a few pixels (font fallback metrics, T41a); that is not what this checks.
	test.describe.configure({ retries: 2 });

	// The icon fonts come after the page on the live site; the month buttons and the
	// breadcrumb must not grow when they do.
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
