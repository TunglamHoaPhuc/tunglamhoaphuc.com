import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Every section shows at once with reduced motion, so colours and contrast can be read.
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.waitForTimeout(2000);
});

test("Bexon surfaces and text use the TLHP dark palette of the old site", async ({ page }) => {
	const colours = await page.evaluate(() => {
		const style = (selector: string, prop: "color" | "backgroundColor") => {
			const el = document.querySelector(selector);
			return el ? getComputedStyle(el)[prop] : `missing ${selector}`;
		};
		// A Bexon colour no home block uses since T10, read through a probe.
		const variable = (name: string) => {
			const probe = document.body.appendChild(document.createElement("div"));
			probe.style.backgroundColor = `var(${name})`;
			const value = getComputedStyle(probe).backgroundColor;
			probe.remove();
			return value;
		};
		return {
			pageBackground: style("body", "backgroundColor"),
			bodyText: style("body", "color"),
			sectionTitle: style(".tlhp-news .sec-title", "color"),
			alternateSection: variable("--tj-color-theme-bg"),
			primaryButton: style("header .header-button .tj-primary-btn", "backgroundColor"),
			darkSection: style(".tj-slider-item", "backgroundColor"),
			footer: style("footer", "backgroundColor"),
		};
	});
	expect(colours).toEqual({
		pageBackground: "rgb(26, 18, 11)", // đen mun #1A120B
		bodyText: "rgb(227, 210, 193)", // old site parchment #E3D2C1
		sectionTitle: "rgb(242, 193, 78)", // old site gold #F2C14E
		alternateSection: "rgb(44, 28, 17)", // gỗ lim #2C1C11
		primaryButton: "rgb(212, 163, 115)", // hoại sắc #D4A373
		darkSection: "rgb(26, 18, 11)", // đen mun #1A120B
		footer: "rgb(26, 18, 11)",
	});
});

test("titles use UTM Niagara, headings Noto Serif and text Be Vietnam Pro, with Vietnamese glyphs", async ({ page }) => {
	const fonts = await page.evaluate(async () => {
		const vietnamese = "Ẫ Ộ Ữ Ỹ ạ ằ ễ ợ";
		const coversVietnamese = async (font: string) => {
			const faces = await document.fonts.load(font, vietnamese);
			return faces.some((face) => /U\+1EA0/i.test(face.unicodeRange)) && document.fonts.check(font, vietnamese);
		};
		return {
			lang: document.documentElement.lang,
			body: getComputedStyle(document.body).fontFamily.split(",")[0].replaceAll('"', ""),
			title: getComputedStyle(document.querySelector(".tlhp-news .sec-title")!).fontFamily.split(",")[0].replaceAll('"', ""),
			titleLoaded: (await document.fonts.load('400 72px "UTM Niagara"', vietnamese)).length > 0,
			heading: getComputedStyle(document.querySelector("h3")!).fontFamily.split(",")[0].replaceAll('"', ""),
			serifVietnamese: await coversVietnamese('600 32px "Noto Serif"'),
			sansVietnamese: await coversVietnamese('400 18px "Be Vietnam Pro"'),
		};
	});
	expect(fonts).toEqual({
		lang: "vi",
		body: "Be Vietnam Pro",
		title: "UTM Niagara",
		titleLoaded: true,
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
