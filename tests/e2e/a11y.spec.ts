import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// T41b: axe (WCAG 2.1 A/AA) on every public page template, at both screen sizes, with the
// effects on as visitors get them. The specs of each page check its own details; this one
// is the list to add a new public route to. Admin routes join when the new admin exists.
const PAGES = [
	"/",
	"/dong-chay-hoang-phap",
	"/dong-chay-hoang-phap/phap-hoi-huyet-bon-trai",
	"/dong-chay-hoang-phap/cong-tu-phap-hoi-niem-phat-thang-7-nam-binh-ngo-2026-2",
	"/lich-tu-hoc",
	"/gioi-thieu",
	"/gioi-thieu/tieu-su-su-to",
	"/tong-chi-tu-hoc",
	"/tong-chi-tu-hoc/niem-phat-phuong-phap-tro-hanh",
	"/vu-tru-phat-giao",
	"/vu-tru-phat-giao/tam-bao",
	"/bao-tuong-phat-giao",
	"/bao-tuong/duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001",
	"/khong-co-trang-nay",
];

for (const path of PAGES) {
	test(`${path} has no serious or critical axe violation`, async ({ page }) => {
		await page.goto(path, { waitUntil: "load" });
		// Let the effects start and the headings on screen finish coming in.
		await page.waitForTimeout(2500);
		const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
		const failures = results.violations
			.filter((violation) => violation.impact === "serious" || violation.impact === "critical")
			.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")}`));
		expect(failures).toEqual([]);
	});
}
