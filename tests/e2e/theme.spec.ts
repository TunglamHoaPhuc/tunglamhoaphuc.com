import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Every section shows at once with reduced motion, so colours and contrast can be read.
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.waitForTimeout(2000);
});

test("Bexon surfaces and text use the TLHP palette", async ({ page }) => {
	const colours = await page.evaluate(() => {
		const style = (selector: string, prop: "color" | "backgroundColor") => {
			const el = document.querySelector(selector);
			return el ? getComputedStyle(el)[prop] : `missing ${selector}`;
		};
		return {
			pageBackground: style("body", "backgroundColor"),
			bodyText: style("body", "color"),
			sectionTitle: style(".tj-pricing-section .sec-title", "color"),
			alternateSection: style(".tj-pricing-section", "backgroundColor"),
			primaryButton: style("header .header-button .tj-primary-btn", "backgroundColor"),
			darkSection: style(".tj-service-section", "backgroundColor"),
			footer: style("footer", "backgroundColor"),
		};
	});
	expect(colours).toEqual({
		pageBackground: "rgb(250, 250, 245)", // ngà #FAFAF5
		bodyText: "rgb(53, 48, 43)", // đá #35302B
		sectionTitle: "rgb(44, 28, 17)", // gỗ lim #2C1C11
		alternateSection: "rgb(244, 236, 221)", // kem #F4ECDD
		primaryButton: "rgb(131, 84, 20)", // mộc #835414
		darkSection: "rgb(26, 18, 11)", // đen mun #1A120B
		footer: "rgb(26, 18, 11)",
	});
});

test("headings use Noto Serif and text uses Be Vietnam Pro, with Vietnamese glyphs", async ({ page }) => {
	const fonts = await page.evaluate(async () => {
		const vietnamese = "Ẫ Ộ Ữ Ỹ ạ ằ ễ ợ";
		const coversVietnamese = async (font: string) => {
			const faces = await document.fonts.load(font, vietnamese);
			return faces.some((face) => /U\+1EA0/i.test(face.unicodeRange)) && document.fonts.check(font, vietnamese);
		};
		return {
			lang: document.documentElement.lang,
			body: getComputedStyle(document.body).fontFamily.split(",")[0].replaceAll('"', ""),
			heading: getComputedStyle(document.querySelector("h2")!).fontFamily.split(",")[0].replaceAll('"', ""),
			serifVietnamese: await coversVietnamese('600 32px "Noto Serif"'),
			sansVietnamese: await coversVietnamese('400 18px "Be Vietnam Pro"'),
		};
	});
	expect(fonts).toEqual({
		lang: "vi",
		body: "Be Vietnam Pro",
		heading: "Noto Serif",
		serifVietnamese: true,
		sansVietnamese: true,
	});
});

test("home page text meets WCAG AA contrast", async ({ page }) => {
	const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
	const failures = results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(" ")));
	expect(failures).toEqual([]);
});
