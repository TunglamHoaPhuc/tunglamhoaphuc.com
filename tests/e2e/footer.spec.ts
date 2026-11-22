import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// T6: the site frame from the route group layouts, the footer, the closing block (Cta),
// the back-to-top button and the 404 page.
async function open(page: Page, path: string, width = 1440, height = 800) {
	await page.setViewportSize({ width, height });
	await page.goto(path);
	await page.waitForTimeout(1500);
}

const footer = (page: Page) => page.locator("footer.tlhp-footer");
const backToTop = (page: Page) => page.getByRole("button", { name: "Về đầu trang" }).and(page.locator("#tj-back-to-top"));
const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y);

test.describe("one site frame on every page", () => {
	for (const path of ["/", "/contact", "/blogs/1", "/styleguide", "/khong-co-trang-nay", "/blogs/9999"]) {
		test(`${path} has one header pair, one notice slot and one footer`, async ({ page }) => {
			await page.goto(path);
			await expect(page.locator("header.header-area")).toHaveCount(2);
			await expect(page.locator("#smooth-content")).toHaveCount(1);
			await expect(page.locator("footer")).toHaveCount(1);
			await expect(page.locator("main")).toHaveCount(1);
		});
	}

	test("the home page keeps the transparent header, inner pages the solid one", async ({ page }) => {
		await page.goto("/");
		await expect(page.locator("header.header-absolute")).toHaveClass(/header-2/);
		await page.goto("/contact");
		await expect(page.locator("header.header-absolute")).toHaveClass(/header-1/);
	});

	// The shell stays mounted between pages of a group, so Bexon's effects must restart.
	test("moving to another page starts at the top with smooth scrolling running again", async ({ page, isMobile }) => {
		test.skip(isMobile, "smooth scrolling is measured with the mouse wheel");
		await open(page, "/blogs");
		await page.mouse.wheel(0, 1200);
		await page.waitForTimeout(1500);
		// Focus and Enter: a click would chase the link while ScrollSmoother glides to it.
		const link = page.locator('main a[href^="/blogs/"]:not([tabindex="-1"])').first();
		const href = await link.getAttribute("href");
		await link.focus();
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(new RegExp(`${href}$`));
		await expect(page.locator("header.header-area")).toHaveCount(2);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);

		await page.waitForTimeout(1000);
		await page.mouse.wheel(0, 1200);
		await page.waitForTimeout(800);
		const transform = await page.locator("#smooth-content").evaluate((el) => getComputedStyle(el).transform);
		expect(transform).not.toBe("none");
	});
});

test.describe("footer", () => {
	test.use({ reducedMotion: "reduce" });

	for (const [width, columns] of [
		[375, 1],
		[768, 2],
		[1440, 4],
	]) {
		test(`shows ${columns} column(s) at ${width}px`, async ({ page }) => {
			await open(page, "/contact", width);
			const lefts = await footer(page)
				.locator(".footer-main-area .row > *")
				.evaluateAll((cols) => new Set(cols.map((col) => Math.round(col.getBoundingClientRect().left))).size);
			expect(lefts).toBe(columns);
		});
	}

	test("holds the four TLHP columns and the closing strip", async ({ page }) => {
		await open(page, "/");
		const titles = footer(page).locator("h2");
		await expect(titles).toHaveText(["Bổn tự", "Thời khóa tu học", "Liên hệ", "Bản đồ chùa"]);
		await expect(footer(page)).toContainText("Thôn Hòa Trúc – Xã Phú Cát – TP Hà Nội");
		await expect(footer(page).getByRole("link", { name: "Xem lịch tu học" })).toHaveAttribute("href", "/lich-tu-hoc");
		const maps = footer(page).getByRole("link", { name: /Mở Google Maps/ });
		await expect(maps).toHaveAttribute("href", /^https:[/][/](www[.]google[.]com[/]maps[/]|maps[.]app[.]goo[.]gl[/])/);
		await expect(maps).toHaveAttribute("target", "_blank");
		const end = footer(page).locator(".tlhp-footer-end");
		await expect(end).toContainText("© Phật lịch 2570 – 2026 Tùng Lâm Hòa Phúc");
		await expect(end).toContainText("Nơi để trở về – Chốn thiêng bình yên");
		await expect(footer(page)).not.toContainText(/Bexon|Enter email|Privacy/);
	});

	test("every phone number is a tel: link at least 48px tall", async ({ page }) => {
		await open(page, "/", 375);
		const phones = footer(page).locator('a[href^="tel:"]');
		await expect(phones).toHaveCount(7);
		for (const phone of await phones.all()) {
			await expect(phone).toHaveAttribute("href", /^tel:0\d{9}$/);
			expect((await phone.boundingBox())!.height).toBeGreaterThanOrEqual(48);
		}
	});

	test("the slogan line is decoration and stands still with reduced motion", async ({ page }) => {
		await open(page, "/");
		const track = footer(page).locator(".footer-marquee .tlhp-marquee-track");
		await expect(track).toHaveAttribute("aria-hidden", "true");
		await expect(track).toContainText("Chốn thiêng bình yên");
		const before = await track.evaluate((el) => getComputedStyle(el).transform);
		await page.waitForTimeout(1500);
		expect(await track.evaluate((el) => getComputedStyle(el).transform)).toBe(before);
		// Nothing moves, so there is nothing to pause.
		await expect(footer(page).locator(".tlhp-pause")).toBeHidden();
	});

	test("its own Về đầu trang link goes back up and takes focus to the logo", async ({ page }) => {
		await open(page, "/contact");
		await scrollTo(page, 100_000);
		await footer(page).getByRole("button", { name: "Về đầu trang" }).click();
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
		await expect(page.locator("header.header-absolute .logo")).toBeFocused();
	});
});

test.describe("footer with motion", () => {
	// Bexon hid not-yet-revealed .wow boxes with visibility, which drops their links from
	// the Tab order until the visitor scrolls there.
	test("every footer link can take keyboard focus before it scrolls into view", async ({ page }) => {
		await open(page, "/");
		const unfocusable = await footer(page)
			.locator("a, button")
			.evaluateAll((els) =>
				els
					.filter((el) => {
						(el as HTMLElement).focus({ preventScroll: true });
						return document.activeElement !== el;
					})
					.map((el) => el.textContent?.trim() || el.outerHTML.slice(0, 60)),
			);
		expect(unfocusable).toEqual([]);
	});

	test("the slogan line runs when motion is allowed, and its button stops it", async ({ page, isMobile }) => {
		test.skip(isMobile, "one check is enough");
		await open(page, "/");
		const track = footer(page).locator(".footer-marquee .tlhp-marquee-track");
		const transform = () => track.evaluate((el) => getComputedStyle(el).transform);
		const before = await transform();
		await page.waitForTimeout(1500);
		expect(await transform()).not.toBe(before);

		const pause = footer(page).getByRole("button", { name: "Tạm dừng chữ chạy cuối trang" });
		await pause.focus();
		await page.keyboard.press("Enter");
		await expect(footer(page).getByRole("button", { name: "Chạy tiếp chữ chạy cuối trang" })).toBeFocused();
		// The animation runs off the main thread; its stop shows a frame later.
		await page.waitForTimeout(150);
		const stopped = await transform();
		await page.waitForTimeout(1000);
		expect(await transform()).toBe(stopped);
	});
});

test.describe("closing block", () => {
	test.use({ reducedMotion: "reduce" });

	test("ends inner pages with Xem lịch tu học, overlapping the footer", async ({ page }) => {
		await open(page, "/contact");
		const cta = page.locator("main > .tlhp-cta:last-child");
		await expect(cta.getByRole("heading", { name: "Về chùa tu học" })).toBeVisible();
		await expect(cta.getByRole("link", { name: "Xem lịch tu học" })).toHaveAttribute("href", "/lich-tu-hoc");
		const ctaBottom = (await cta.locator(".cta-area").boundingBox())!;
		const footerTop = (await footer(page).boundingBox())!.y;
		expect(ctaBottom.y + ctaBottom.height).toBeGreaterThan(footerTop);
		expect(await footer(page).evaluate((el) => getComputedStyle(el).paddingTop)).toBe("72px");
	});

	test("is not on the home page, whose footer then starts without the overlap room", async ({ page }) => {
		await open(page, "/");
		await expect(page.locator(".tlhp-cta")).toHaveCount(0);
		expect(await footer(page).evaluate((el) => getComputedStyle(el).paddingTop)).toBe("0px");
	});
});

test.describe("back-to-top button", () => {
	test.use({ reducedMotion: "reduce" });

	test("is a named button with a 48px target that steps aside at the footer", async ({ page }) => {
		await open(page, "/contact");
		await expect(backToTop(page)).toBeHidden();
		await scrollTo(page, 1500);
		await expect(backToTop(page)).toBeVisible();
		const box = (await backToTop(page).boundingBox())!;
		expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48);

		await scrollTo(page, 100_000);
		await expect(backToTop(page)).toBeHidden();
	});

	test("takes the visitor and keyboard focus back to the top", async ({ page }) => {
		await open(page, "/contact");
		await scrollTo(page, 1500);
		await backToTop(page).click();
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
		await expect(page.locator("header.header-absolute .logo")).toBeFocused();
	});

	// On a phone it would sit on the text column, so it only shows while scrolling back up.
	test("stays off the text while reading on a 375px screen", async ({ page }) => {
		await open(page, "/contact", 375, 812);
		await scrollTo(page, 1500);
		await page.waitForTimeout(300);
		await expect(backToTop(page)).toBeHidden();
		await scrollTo(page, 1200);
		await expect(backToTop(page)).toBeVisible();
		await scrollTo(page, 1800);
		await expect(backToTop(page)).toBeHidden();
	});
});

test.describe("404 page", () => {
	test.use({ reducedMotion: "reduce" });

	for (const path of ["/khong-co-trang-nay", "/a/b/c", "/blogs/9999"]) {
		test(`${path} answers HTTP 404`, async ({ request }) => {
			expect((await request.get(path)).status()).toBe(404);
		});
	}

	test("speaks in the temple's voice and leads back home", async ({ page }) => {
		const response = await page.goto("/khong-co-trang-nay");
		expect(response?.status()).toBe(404);
		await expect(page).toHaveTitle("Không tìm thấy trang – Tùng Lâm Hòa Phúc");
		await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Không tìm thấy trang");
		await expect(page.locator("main")).toContainText("Kính mời quý vị");
		await expect(page.locator("main").getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
		await expect(page.getByRole("navigation", { name: "Đường dẫn" })).toContainText("Trang chủ");
	});
});

test.describe("axe WCAG A/AA", () => {
	test.use({ reducedMotion: "reduce" });

	for (const path of ["/", "/khong-co-trang-nay"]) {
		test(`${path} passes`, async ({ page }) => {
			await open(page, path);
			const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
			const failures = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
			expect(failures).toEqual([]);
		});
	}
});
