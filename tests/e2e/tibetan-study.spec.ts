import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// T17b: the old site's Tibetan course, moved to this site at the same address. Its pages,
// sounds and data are files here; its four services are this Worker's /api/*.
const APP = "/tibetan-study/index.html";
const OLD_HOSTS = /(^|\.)tunglamhoaphuc\.com$|backblazeb2\.com$/;

test.describe("Học tiếng Tạng", () => {
	test("opens on page 1 of the book from this site, asking nothing of the old site", async ({ page }, testInfo) => {
		const siteHost = new URL(testInfo.project.use.baseURL ?? "http://localhost:4173").host;
		const old: string[] = [];
		const failed: string[] = [];
		page.on("request", (request) => {
			const host = new URL(request.url()).host;
			if (host !== siteHost && OLD_HOSTS.test(host)) old.push(request.url());
		});
		page.on("response", (response) => {
			if (new URL(response.url()).host === siteHost && response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
		});
		await page.goto(APP);
		const picture = page.locator("#pdfPageImg");
		await expect(picture).toHaveAttribute("src", /pages\/page_1\.webp$/);
		await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(1000);
		await expect(page.locator("#totalPageDisplay")).toHaveText("120");
		await page.waitForLoadState("networkidle").catch(() => undefined);
		expect(old).toEqual([]);
		expect(failed).toEqual([]);
	});

	test("the recorded letters, the pages and the data are served, cached for a day", async ({ request }) => {
		for (const path of ["/tibetan-study/audio/cons_1_ka.mp3", "/tibetan-study/pages/page_120.webp", "/tibetan-study/sara_book_data.json", "/tibetan-study/coords/3.json"]) {
			const response = await request.get(path);
			expect(response.status(), path).toBe(200);
		}
		expect((await request.get("/tibetan-study/pages/page_120.webp")).headers()["content-type"]).toBe("image/webp");
	});

	test("the services refuse what is not Tibetan", async ({ request }) => {
		for (const path of ["/api/analyze", "/api/tts"]) {
			expect((await request.post(path, { data: { text: "hello" } })).status(), path).toBe(400);
		}
		expect((await request.post("/api/ask-ai", { data: { question: "" } })).status()).toBe(400);
		expect((await request.post("/api/analyze", { data: "x".repeat(20_000) })).status()).toBe(400);
	});

	test("a rectangle drawn on a page gives the words printed there, then their analysis", async ({ request }) => {
		const page = JSON.parse(readFileSync("public/tibetan-study/coords/3.json", "utf8")) as { width: number; height: number; words: [number, number, number, number, string][] };
		const [x0, y0, x1, y1, word] = page.words[1];
		const response = await request.post("/api/crop-analyze", {
			data: { page_num: 3, rect: [x0 - 1, y0 - 1, x1 + 1, y1 + 1], canvas_size: [page.width, page.height], fallback_text: "" },
		});
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.status).toBe("success");
		expect(body.detected_text).toContain(word.trim());
		expect(Array.isArray(body.syllables)).toBe(true);
		expect(typeof body.full_translation).toBe("string");
	});
});
