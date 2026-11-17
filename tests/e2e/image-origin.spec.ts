import { expect, test } from "@playwright/test";

// T42c: pictures of the old admin come from this site (/anh-goc/, read from R2), so the
// browser never asks B2, WordPress or the old www for a picture. Once those are switched off
// (Checkpoint J) the public pages must keep working.
const PAGES = [
	"/",
	"/dong-chay-hoang-phap",
	"/dong-chay-hoang-phap/cong-tu-phap-hoi-niem-phat-thang-7-nam-binh-ngo-2026-2",
	"/lich-tu-hoc",
	"/bao-tuong-phat-giao",
	"/bao-tuong/na_la_dien_kim_cang_tuong_co_tp0077",
	"/gioi-thieu",
	"/tong-chi-tu-hoc",
	"/vu-tru-phat-giao",
];

const OLD_HOSTS = /(^|\.)(backblazeb2\.com|congngheviet\.com\.vn)$|^(www\.|admin\.)?tunglamhoaphuc\.com$/;
const OLD_ADDRESS = /backblazeb2\.com|congngheviet\.com\.vn|admin\.tunglamhoaphuc\.com\/wp-content|tunglamhoaphuc\.com\/wp-content/;

test.describe("no picture comes from B2, WordPress or the old www", () => {
	for (const path of PAGES) {
		test(`${path}`, async ({ page }, testInfo) => {
			const siteHost = new URL(testInfo.project.use.baseURL ?? "http://localhost:4173").host;
			const asked: string[] = [];
			page.on("request", (request) => {
				const host = new URL(request.url()).host;
				if (host !== siteHost && OLD_HOSTS.test(host) && request.resourceType() === "image") asked.push(request.url());
			});
			await page.goto(path, { waitUntil: "load" });
			// Scroll down so lazy pictures are asked for too.
			await page.evaluate(async () => {
				for (let y = 0; y < document.body.scrollHeight; y += 600) {
					window.scrollTo(0, y);
					await new Promise((resolve) => setTimeout(resolve, 60));
				}
			});
			await page.waitForLoadState("networkidle").catch(() => undefined);
			expect(asked, "requests for pictures to an old host").toEqual([]);

			const addresses = await page.evaluate(() => {
				const found: string[] = [];
				for (const img of document.querySelectorAll("img, source")) {
					found.push(img.getAttribute("src") ?? "", img.getAttribute("srcset") ?? "");
				}
				for (const link of document.querySelectorAll('link[rel="preload"][as="image"]')) found.push(link.getAttribute("href") ?? "", link.getAttribute("imagesrcset") ?? "");
				for (const meta of document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')) found.push(meta.getAttribute("content") ?? "");
				return found.filter(Boolean);
			});
			expect(addresses.filter((address) => OLD_ADDRESS.test(address)), "picture addresses in the page").toEqual([]);
		});
	}
});
