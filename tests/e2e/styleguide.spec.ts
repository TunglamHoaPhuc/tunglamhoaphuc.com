import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const BEXON_TEAL = "30, 138, 138";

async function open(page: Page, path: string) {
	const response = await page.goto(path);
	expect(response?.status()).toBe(200);
	await page.waitForTimeout(2000);
}

test.describe("with reduced motion", () => {
	// Every section shows at once, so styles and contrast can be read.
	test.use({ reducedMotion: "reduce" });

	test("styleguide is kept out of search engines", async ({ page }) => {
		await open(page, "/styleguide");
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
	});

	for (const path of ["/", "/styleguide"]) {
		test(`${path} has no Bexon teal left`, async ({ page }) => {
			await open(page, path);
			const teal = await page.evaluate((teal) => {
				const props = ["color", "backgroundColor", "backgroundImage", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor", "boxShadow", "outlineColor", "fill", "stroke"] as const;
				const hits: string[] = [];
				for (const el of document.querySelectorAll("body *")) {
					for (const pseudo of [null, "::before", "::after"]) {
						const style = getComputedStyle(el, pseudo);
						for (const prop of props) {
							if (style[prop].includes(teal)) hits.push(`${el.tagName.toLowerCase()}.${el.classList[0] ?? ""}${pseudo ?? ""} ${prop}`);
						}
					}
				}
				return hits;
			}, BEXON_TEAL);
			expect(teal).toEqual([]);

			const svgs = await page.evaluate(() => [...new Set([...document.images].map((img) => img.src).filter((src) => src.endsWith(".svg")))]);
			for (const src of svgs) {
				const body = await (await page.request.get(src)).text();
				expect(body, src).not.toMatch(/#1e8a8a/i);
			}
		});
	}

	// Kept Bexon pages plus one detail page of each kind.
	for (const path of ["/", "/styleguide", "/blogs", "/blogs/1", "/services", "/services/1", "/portfolios", "/portfolios/1", "/team", "/team/1", "/contact"]) {
		test(`${path} headings leave room for Vietnamese marks`, async ({ page }) => {
			await open(page, path);
			const tight = await page.evaluate(() =>
				[...document.querySelectorAll("h1, h2, h3, h4, h5, h6, .sec-title")]
					.filter((el) => el.getClientRects().length)
					.map((el) => {
						const style = getComputedStyle(el);
						const size = parseFloat(style.fontSize);
						const lineHeight = style.lineHeight === "normal" ? Infinity : parseFloat(style.lineHeight) / size;
						const tracking = style.letterSpacing === "normal" ? 0 : parseFloat(style.letterSpacing) / size;
						return { text: el.textContent!.trim().slice(0, 40), lineHeight: +lineHeight.toFixed(3), tracking: +tracking.toFixed(4) };
					})
					.filter(({ lineHeight, tracking }) => lineHeight < 1.15 || tracking < -0.0101),
			);
			expect(tight).toEqual([]);
		});
	}

	test("buttons follow the TLHP button spec", async ({ page }) => {
		await open(page, "/styleguide");
		const buttons = await page.locator("main .tj-primary-btn").evaluateAll((els) =>
			els.map((el) => {
				const label = el.querySelector(".btn-text") as HTMLElement;
				const icon = el.querySelector(".btn-icon") as HTMLElement;
				return {
					text: label.textContent,
					height: el.getBoundingClientRect().height,
					textTransform: getComputedStyle(label).textTransform,
					iconHidden: icon.getAttribute("aria-hidden"),
					iconRound: getComputedStyle(icon).borderRadius,
				};
			}),
		);
		expect(buttons.length).toBeGreaterThan(3);
		for (const button of buttons) {
			expect(button.height, button.text!).toBeGreaterThanOrEqual(48);
			expect(button.textTransform).toBe("none");
			expect(button.iconHidden).toBe("true");
			expect(button.iconRound).toBe("50%");
		}

		const primary = page.locator("main > section:not(.tlhp-dark) .tj-primary-btn:not(.transparent-btn)").first();
		await expect(primary.locator(".btn-icon")).toHaveCSS("background-color", "rgb(212, 163, 115)"); // hoại sắc
		const darkPrimary = page.locator(".tlhp-dark .tj-primary-btn:not(.transparent-btn)").first();
		const darkColours = await darkPrimary.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el.querySelector(".btn-icon")!).backgroundColor]);
		expect(darkColours[0]).not.toBe(darkColours[1]);

		await primary.focus();
		const ring = await primary.evaluate((el) => ({ focusVisible: el.matches(":focus-visible"), shadow: getComputedStyle(el).boxShadow }));
		expect(ring.focusVisible).toBe(true);
		// Two rings: page background inside, mộc outside.
		expect(ring.shadow).toContain("rgb(250, 250, 245)");
		expect(ring.shadow).toContain("rgb(131, 84, 20)");
	});

	// Themes switch per block (plan decision 9): the page is light and holds one .tlhp-dark
	// section plus the dark footer, so one pass covers both. A whole-page data-theme is not
	// a supported mode.
	test("styleguide passes axe WCAG A/AA on the light page and the dark section", async ({ page }) => {
		await open(page, "/styleguide");
		await expect(page.locator("main .tlhp-dark")).toHaveCount(1);
		await expect(page.locator("footer.tlhp-dark")).toHaveCount(1);
		const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		const failures = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
		expect(failures).toEqual([]);
	});
});

test.describe("with motion", () => {
	test("split-text headings keep their name and whole Vietnamese letters", async ({ page }) => {
		await open(page, "/styleguide");
		const animated = page.locator(".title-anim, .text-anim, .hero-text-anim");
		await expect(animated.first()).toHaveAttribute("aria-label", /.+/);
		const headings = await animated.evaluateAll((els) =>
			els.map((el) => {
				const pieces = [...el.querySelectorAll("[aria-hidden] div, [aria-hidden] span")].filter((p) => !p.children.length);
				return {
					label: el.getAttribute("aria-label"),
					text: el.textContent!.replace(/\s+/g, " ").trim(),
					detachedMarks: pieces.filter((p) => /^\p{M}/u.test(p.textContent!)).length,
					lineClip: [...el.children].map((line) => getComputedStyle(line).overflow),
				};
			}),
		);
		expect(headings.length).toBe(3);
		for (const heading of headings) {
			expect(heading.label!.replace(/\s+/g, " ").trim()).toBe(heading.text);
			expect(heading.detachedMarks).toBe(0);
			expect(heading.lineClip.every((overflow) => overflow === "visible")).toBe(true);
		}
		await expect(page.getByRole("heading", { name: "Ấn định khóa tu Ộ Ữ Ỹ ạ ặ ợ." })).toHaveCount(1);
	});
});
