import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Triển lãm số /van-hoa-viet-nam: ứng dụng toàn màn hình, nằm ngoài SiteShell. Các test này kiểm hành vi
// đã sửa so với bản ở web cũ (xem src/components/van-hoa-viet-nam).
// Ảnh đi qua /cdn-cgi/image/ (Cloudflare) nên chạy cục bộ không có; chặn đi cho nhanh, bố cục không phụ thuộc ảnh.

async function open(page: Page) {
	await page.route("**/cdn-cgi/image/**", (route) => route.abort());
	await page.goto("/van-hoa-viet-nam", { waitUntil: "load" });
	await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeVisible();
}

async function enter(page: Page) {
	await open(page);
	await page.getByRole("button", { name: "Tiếp tục" }).click();
	await expect(page.locator(".vh-intro")).toHaveCount(0, { timeout: 4000 });
}

const counter = (page: Page) => page.locator(".vh-nav-pill").getByText(/^\d+ \/ \d+$/);

test.describe("triển lãm Văn hóa Việt Nam", () => {
	test("thẻ mở chương không tự tắt, chỉ đóng khi người xem bấm Tiếp tục", async ({ page }) => {
		await open(page);
		await page.waitForTimeout(6000);
		await expect(page.locator(".vh-intro")).toBeVisible();
		await expect(page.locator(".vh-app")).toHaveAttribute("inert", "");
		await page.getByRole("button", { name: "Tiếp tục" }).click();
		await expect(page.locator(".vh-intro")).toHaveCount(0, { timeout: 4000 });
		await expect(page.locator(".vh-app")).not.toHaveAttribute("inert", "");
	});

	test("đổi khung rồi quay lại trong 240 ms vẫn thấy chữ", async ({ page }) => {
		await enter(page);
		await page.getByRole("button", { name: "Tiếp theo" }).click();
		await page.getByRole("button", { name: "Tiếp theo" }).click();
		await page.waitForTimeout(700);
		// Sang khung sau rồi quay lại ngay, trong cùng một nhịp.
		await page.evaluate(() => {
			const find = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLElement;
			find("Tiếp theo").click();
			setTimeout(() => find("Trước đó").click(), 60);
		});
		await page.waitForTimeout(900);
		const faded = await page.locator(".vh-text-region").evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "1").length);
		expect(faded).toBe(0);
	});

	test("cuộn vùng chữ dài không đổi khung", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 560 });
		await enter(page);
		const article = page.locator("article[data-vh-scrollable]");
		await expect.poll(() => article.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(20);
		const before = await counter(page).textContent();
		const box = (await article.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.wheel(0, 120);
		await page.waitForTimeout(400);
		expect(await article.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
		expect(await counter(page).textContent()).toBe(before);
	});

	test("Space trên nút Phần tiếp theo không bị chặn", async ({ page }) => {
		await enter(page);
		const dots = page.getByRole("navigation", { name: "Tiến trình" }).getByRole("button");
		await dots.last().click();
		const next = page.getByRole("button", { name: "Phần tiếp theo" });
		await expect(next).toBeVisible();
		await next.focus();
		await page.keyboard.press("Space");
		await expect(page.locator(".vh-intro")).toBeVisible();
		await expect(page.getByText("Phần 2 / 8")).toBeVisible();
	});

	test("đúng một h1 ở mọi trạng thái", async ({ page }) => {
		await open(page);
		await expect(page.locator("h1")).toHaveCount(1);
		await page.getByRole("button", { name: "Tiếp tục" }).click();
		await expect(page.locator(".vh-intro")).toHaveCount(0, { timeout: 4000 });
		await expect(page.locator("h1")).toHaveCount(1);
		await page.getByRole("button", { name: "Mục lục" }).click();
		await expect(page.locator("h1")).toHaveCount(1);
	});

	test("sau khi vào triển lãm, trong mục lục và hộp toàn văn: không lỗi axe nghiêm trọng", async ({ page }) => {
		await enter(page);
		const check = async () => {
			const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
			return results.violations
				.filter((v) => v.impact === "serious" || v.impact === "critical")
				.flatMap((v) => v.nodes.map((n) => v.id + ": " + n.target.join(" ")));
		};
		expect(await check()).toEqual([]);
		await page.getByRole("button", { name: "Mục lục" }).click();
		expect(await check()).toEqual([]);
		await page.keyboard.press("Escape");
		await page.evaluate(() => (document.querySelector('.vh-root dialog[aria-labelledby="vh-reader-title"]') as HTMLDialogElement).showModal());
		expect(await check()).toEqual([]);
	});

	for (const size of [
		{ width: 390, height: 844 },
		{ width: 1440, height: 900 },
	]) {
		test(`không chữ nào dưới 16px trong .vh-root (${size.width}x${size.height})`, async ({ page }) => {
			await page.setViewportSize(size);
			const small = () =>
				page.evaluate(() => {
					const bad: string[] = [];
					const walker = document.createTreeWalker(document.querySelector(".vh-root")!, NodeFilter.SHOW_TEXT);
					for (let node = walker.nextNode(); node; node = walker.nextNode()) {
						const text = node.textContent?.trim();
						const el = node.parentElement;
						if (!text || !el) continue;
						const style = getComputedStyle(el);
						if (style.visibility === "hidden" || style.display === "none") continue;
						const range = document.createRange();
						range.selectNodeContents(node);
						if (range.getClientRects().length === 0) continue;
						if (parseFloat(style.fontSize) < 15.99) bad.push(`${style.fontSize} ${text.slice(0, 40)}`);
					}
					return bad;
				});
			await open(page);
			expect(await small()).toEqual([]);
			await page.getByRole("button", { name: "Tiếp tục" }).click();
			await expect(page.locator(".vh-intro")).toHaveCount(0, { timeout: 4000 });
			expect(await small()).toEqual([]);
			// Mục lục và hộp "Đọc toàn văn".
			await page.getByRole("button", { name: "Mục lục" }).click();
			expect(await small()).toEqual([]);
			await page.keyboard.press("Escape");
			await page.evaluate(() => (document.querySelector('.vh-root dialog[aria-labelledby="vh-reader-title"]') as HTMLDialogElement).showModal());
			expect(await small()).toEqual([]);
		});
	}
});

test.describe("giảm chuyển động", () => {
	test.use({ reducedMotion: "reduce" });

	test("không còn animation hay transition nào, thẻ mở chương vẫn chờ người xem", async ({ page }) => {
		await open(page);
		await page.waitForTimeout(3000);
		await expect(page.locator(".vh-intro")).toBeVisible();
		await page.getByRole("button", { name: "Tiếp tục" }).click();
		// Đóng ngay, không mờ dần.
		await expect(page.locator(".vh-intro")).toHaveCount(0, { timeout: 500 });
		await page.getByRole("button", { name: "Tiếp theo" }).click();
		await page.getByRole("button", { name: "Tiếp theo" }).click();
		await page.waitForTimeout(150);
		const state = await page.evaluate(() => ({
			animations: document.getAnimations().map((a) => (a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName),
			hiddenText: [...document.querySelectorAll(".vh-text-region")].filter((el) => getComputedStyle(el).opacity !== "1").length,
			transitions: [...document.querySelectorAll(".vh-root *")].filter((el) => {
				const s = getComputedStyle(el);
				return s.transitionDuration.split(",").some((d) => parseFloat(d) > 0.001) || s.animationName !== "none";
			}).length,
		}));
		expect(state).toEqual({ animations: [], hiddenText: 0, transitions: 0 });
	});
});
