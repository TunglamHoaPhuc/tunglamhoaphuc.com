import { expect, test, type Page } from "@playwright/test";

// Pages kept from the Bexon template, the 404 page and the TLHP pages. Every new route should be added here.
const PAGES = [
	"/",
	"/blogs",
	"/services",
	"/portfolios",
	"/team",
	"/contact",
	"/styleguide",
	"/khong-co-trang-nay",
	"/dong-chay-hoang-phap",
	"/dong-chay-hoang-phap/phap-hoi-huyet-bon-trai",
	"/lich-tu-hoc",
	"/gioi-thieu",
	"/gioi-thieu/tieu-su-su-to",
	"/tong-chi-tu-hoc",
	"/tong-chi-tu-hoc/niem-phat-phuong-phap-tro-hanh",
	"/vu-tru-phat-giao",
	"/vu-tru-phat-giao/tam-bao",
	"/bao-tuong-phat-giao",
	"/bao-tuong/duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001",
	"/tri-tue-phat-phap",
	"/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi",
	"/tri-tue-phat-phap/hoc-tieng-tang",
	"/lien-he",
	"/tim-kiem?q=niem+phat",
];

type SliderElement = HTMLElement & { swiper?: { autoplay?: { running?: boolean } } };

async function settle(page: Page, path: string) {
	await page.goto(path);
	await page.waitForTimeout(2500);
}

test.describe("no popups or toasts", () => {
	for (const path of PAGES) {
		test(`${path} opens no dialog or toast on load`, async ({ page }) => {
			await settle(page, path);
			const floating = page.locator(
				'[role="dialog"]:visible, [role="alertdialog"]:visible, [aria-modal="true"]:visible, .swal2-container, .modal.show',
			);
			await expect(floating).toHaveCount(0);
		});
	}
});

// With reduced motion nothing moves (no smooth scrolling, no slider or row running by itself,
// no animation that travels). The calm tier stays (17/11/2026): a block below the screen fades
// in when it comes into view, so what is on screen must be fully shown soon after it gets there.
test.describe("reduced motion keeps only what does not move", () => {
	test.use({ reducedMotion: "reduce" });

	for (const path of PAGES) {
		test(`${path} shows what is on screen and keeps sliders still`, async ({ page }) => {
			await settle(page, path);
			await page.mouse.wheel(0, 1500);
			// The fade of a block that has just come into view lasts 0.6 s.
			await page.waitForTimeout(1200);

			const state = await page.evaluate(() => {
				const smooth = document.querySelector<HTMLElement>("#smooth-content");
				const onScreen = (el: Element) => {
					const box = el.getBoundingClientRect();
					return box.height > 0 && box.bottom > 0 && box.top < window.innerHeight * 0.9;
				};
				const hiddenTitles = [...document.querySelectorAll(".title-anim, .text-anim, .hero-text-anim, .tlhp-fade")].filter(
					(el) => onScreen(el) && getComputedStyle(el).opacity !== "1",
				).length;
				const hiddenWow = [...document.querySelectorAll<HTMLElement>(".wow")].filter(
					(el) => getComputedStyle(el).visibility === "hidden",
				).length;
				const runningSliders = [...document.querySelectorAll<SliderElement>(".swiper")].filter(
					(el) => el.swiper?.autoplay?.running,
				).length;
				// Whatever is animated or in a transition may only change colour or opacity.
				const moving = document
					.getAnimations()
					.flatMap((animation) => {
						const name = (animation as CSSTransition).transitionProperty ?? (animation as CSSAnimation).animationName ?? "";
						return /transform|translate|scale|rotate|top|left|right|bottom|width|height|margin|inset/.test(name) ? [name] : [];
					});
				return {
					smoothTransform: smooth ? getComputedStyle(smooth).transform : "none",
					hiddenTitles,
					hiddenWow,
					runningSliders,
					moving,
				};
			});

			expect(state).toEqual({ smoothTransform: "none", hiddenTitles: 0, hiddenWow: 0, runningSliders: 0, moving: [] });
		});
	}

	test("a block below the screen fades in when it comes into view, and only fades", async ({ page }) => {
		await settle(page, "/");
		// The fade classes are there only after the page's script has run: nothing is hidden without it.
		const waiting = page.locator(".tlhp-fade:not(.is-in)");
		expect(await waiting.count()).toBeGreaterThan(3);
		// One block, held by itself: the locator above moves on to the next block once this one is in.
		const block = (await waiting.first().elementHandle())!;
		expect(await block.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
		expect(await block.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("opacity");
		await block.scrollIntoViewIfNeeded();
		await expect.poll(() => block.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
		// Afterwards it is left as it was made.
		await expect.poll(() => block.evaluate((el) => el.classList.contains("tlhp-fade"))).toBe(false);
	});

	test("without script nothing waits to fade in", async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
		const page = await context.newPage();
		await page.goto("/");
		await expect(page.locator(".tlhp-fade")).toHaveCount(0);
		await context.close();
	});

	// The hero slider delays its title, text and button by 1–1.4 s; finishing a transition
	// at once is not enough if it still waits to start.
	test("the hero slide text shows without waiting", async ({ page }) => {
		await page.goto("/");
		const button = page.locator(".tj-slider-item.swiper-slide-active .slider-btn");
		await button.waitFor({ state: "attached" });
		await expect(button).toBeVisible({ timeout: 300 });
	});
});

// WCAG 2.2.2: whatever moves by itself has no pause button; it stands still while the pointer
// is over it or keyboard focus is inside, and has arrows so visitors pick the frame themselves.
// The Bexon sample pages are left out until their tasks replace them.
test.describe("self-moving content holds and has arrows", () => {
	for (const path of ["/", "/dong-chay-hoang-phap", "/dong-chay-hoang-phap/phap-hoi-huyet-bon-trai", "/lich-tu-hoc", "/khong-co-trang-nay"]) {
		test(`${path} has no pause button and arrows (44px, named) by each slider and sliding row`, async ({ page }) => {
			await settle(page, path);
			expect(await page.locator(".tlhp-pause").count()).toBe(0);
			expect(await page.getByRole("button", { name: /Tạm dừng|Chạy tiếp/ }).count()).toBe(0);
			const problems = await page.evaluate(() => {
				const moving = [
					...[...document.querySelectorAll<SliderElement>(".swiper")].filter((el) => el.swiper?.autoplay?.running),
					...document.querySelectorAll<HTMLElement>(".tlhp-marquee-track"),
				];
				return moving.flatMap((el) => {
					const block = el.closest("section, .tlhp-quote-card, .tlhp-latest-wrap, .tlhp-feature, .tlhp-marquee");
					const arrows = [...(block?.querySelectorAll<HTMLElement>("button[class*='-prev'], button[class*='-next']") ?? [])].filter((b) => b.getClientRects().length);
					if (arrows.length < 2) return [`${el.className}: ${arrows.length} arrows`];
					return arrows.flatMap((b) => {
						const box = b.getBoundingClientRect();
						const name = b.getAttribute("aria-label") ?? b.textContent?.trim() ?? "";
						return [...(box.width < 44 || box.height < 44 ? [`${name}: ${box.width}x${box.height}`] : []), ...(name ? [] : ["unnamed arrow"])];
					});
				});
			});
			expect(problems).toEqual([]);
		});
	}
});

// With motion allowed, wow.js reveals the blocks below the screen as they come into view. They
// may only wait hidden once wow.js is running: on a slow phone the script arrives 4–6 s after the
// page, and until then the page must show its blocks, not blanks (18/11/2026).
test.describe("scroll reveals never leave blank blocks", () => {
	test.skip(({ isMobile }) => isMobile, "the blocks below the screen are the same; one size is enough");

	test("without script every block is visible", async ({ browser }) => {
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto("/gioi-thieu/tieu-su-su-to");
		const blank = await page.evaluate(
			() => [...document.querySelectorAll<HTMLElement>(".wow")].filter((el) => getComputedStyle(el).opacity !== "1").length,
		);
		expect(blank).toBe(0);
		await context.close();
	});

	test("a block is visible until the script has started, hidden once it waits for the scroll", async ({ page }) => {
		// Keep wow.js from loading: the page and its other script run, only the reveal is missing.
		// The build gives its chunk no telling name, so it is found by its `boxClass` option.
		await page.route(/\.js(\?|$)/, async (route) => {
			const response = await route.fetch();
			if ((await response.text()).includes("boxClass")) await route.abort();
			else await route.fulfill({ response });
		});
		await page.goto("/gioi-thieu/tieu-su-su-to");
		await page.waitForTimeout(2500);
		const withoutWow = await page.evaluate(
			() => [...document.querySelectorAll<HTMLElement>(".wow")].filter((el) => getComputedStyle(el).opacity !== "1").length,
		);
		expect(withoutWow).toBe(0);
	});

	test("with the script running, a block below the screen waits and then reveals", async ({ page }) => {
		await settle(page, "/gioi-thieu/tieu-su-su-to");
		const waiting = page.locator(".wow:not([style*='visibility: visible'])");
		expect(await waiting.count()).toBeGreaterThan(0);
		const block = (await waiting.first().elementHandle())!;
		expect(await block.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
		await block.scrollIntoViewIfNeeded();
		await expect.poll(() => block.evaluate((el) => getComputedStyle(el).opacity), { timeout: 8000 }).toBe("1");
	});
});

test.describe("smooth scrolling keeps the page usable", () => {
	test.skip(({ isMobile }) => isMobile, "keyboard and find-in-page are desktop interactions");

	test("effects are on when motion is allowed", async ({ page }) => {
		await settle(page, "/");
		await page.mouse.wheel(0, 1500);
		await page.waitForTimeout(800);
		const transform = await page.locator("#smooth-content").evaluate((el) => getComputedStyle(el).transform);
		expect(transform).not.toBe("none");
	});

	test("keyboard scrolling moves the page", async ({ page }) => {
		await settle(page, "/");
		await page.locator("body").click({ position: { x: 5, y: 400 } });
		await page.keyboard.press("PageDown");
		await page.keyboard.press("PageDown");
		await page.waitForTimeout(800);
		expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
	});

	// Ctrl+F, Tab focus and anchor links all reveal a target the way scrollIntoView does:
	// by scrolling the smooth-scroll wrapper. The view must glide to the target and stay
	// in sync, so a wheel scroll afterwards continues from there instead of jumping back.
	// /styleguide has almost no other ScrollTriggers, which once hid a bug where the
	// content never moved.
	for (const [path, selector] of [
		["/", "footer a"],
		["/styleguide", ".tlhp-dark a"],
	]) {
		test(`revealing an off-screen element keeps scrolling in sync on ${path}`, async ({ page }) => {
			await settle(page, path);
			const target = page.locator(selector).last();
			await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
			// The browser shows the target at once by scrolling the wrapper; it only counts once
			// the page itself has scrolled there and the wrapper is back at 0.
			const revealed = () =>
				target.evaluate((el) => {
					const rect = el.getBoundingClientRect();
					const wrapper = document.querySelector("#smooth-wrapper")!;
					return rect.top >= 0 && rect.bottom <= window.innerHeight && wrapper.scrollTop === 0 && window.scrollY > 1000;
				});
			await expect.poll(revealed, { timeout: 4000 }).toBe(true);
			const revealedY = await page.evaluate(() => Math.round(window.scrollY));

			await page.mouse.wheel(0, -200);
			await page.waitForTimeout(1500);
			expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(revealedY - 600);
		});
	}

	// ScrollSmoother glides to a focused element itself (about 1.5 s with smooth: 1.5).
	test("keyboard focus reveals the focused link", async ({ page }) => {
		await settle(page, "/");
		const target = page.locator("footer a").last();
		await target.focus();
		await expect
			.poll(
				() =>
					target.evaluate((el) => {
						const rect = el.getBoundingClientRect();
						return rect.top >= 0 && rect.bottom <= window.innerHeight;
					}),
				{ timeout: 4000 },
			)
			.toBe(true);
	});

	test("back-to-top returns to the top", async ({ page }) => {
		await settle(page, "/");
		// Short of the footer, where the button steps aside.
		await page.mouse.wheel(0, 1500);
		await page.waitForTimeout(1200);
		await page.locator("#tj-back-to-top").click();
		await page.waitForTimeout(2500);
		expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
	});
});
