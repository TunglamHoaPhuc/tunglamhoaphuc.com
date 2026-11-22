import { expect, test } from "@playwright/test";
import { pngBuffer, signInOnPage, superAdminApi, superAdminLogin } from "./helpers";

test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
// The first page loads on a dev server compile on demand: give each test room.
test.setTimeout(150_000);

type Item = { id: string; url: string; version: number; width: number; height: number; usageCount: number };

test("upload a picture, replace it in place, cut it, and see the new picture where the old one was", async ({ page, baseURL }) => {
	const api = await superAdminApi(baseURL!);
	const login = superAdminLogin(); // the seeded one-time password was changed by superAdminApi
	await signInOnPage(page, login.email, login.password);
	await page.goto("/quan-tri/media");

	// 1. upload through the page (the browser turns it into WebP)
	const name = `e2e-${Date.now().toString(36)}`;
	// A colour of its own each run: the library refuses a picture it already holds, and a run that stopped half-way
	// leaves its pictures behind.
	const tint = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
	const first = await pngBuffer(page, 1280, 720, tint());
	await page.locator('input[type="file"]').first().setInputFiles({ name: `${name}.png`, mimeType: "image/png", buffer: first });
	await expect(page.getByText(`${name}.png`).first()).toBeVisible();
	// uploads go through the browser-side compression and R2: slow on a busy dev server
	await expect(page.getByText("xong").first()).toBeVisible({ timeout: 30_000 });

	const find = async () => {
		const list = (await api.call("GET", `media?q=${name}`)).json as { data: Item[] };
		expect(list.data).toHaveLength(1);
		return list.data[0];
	};
	const before = await find();
	expect(before.version).toBe(1);
	expect(before.url).toContain(`/cms/${before.id}/v1/`);
	const served = await page.request.get(before.url);
	expect(served.status()).toBe(200);
	expect(served.headers()["content-type"]).toMatch(/^image\//);

	// 2. open it, replace the file
	await page.getByRole("button", { name: new RegExp(name) }).first().click();
	await expect(page.getByRole("heading", { name: "Chi tiết ảnh" })).toBeVisible();
	const second = await pngBuffer(page, 800, 800, tint());
	await page.getByLabel("Thay ảnh", { exact: true }).setInputFiles({ name: `${name}-moi.png`, mimeType: "image/png", buffer: second });
	await expect(page.getByText("Đã thay ảnh")).toBeVisible({ timeout: 30_000 });

	const after = await find();
	expect(after.id).toBe(before.id);
	expect(after.version).toBe(2);
	expect([after.width, after.height]).toEqual([800, 800]);
	expect(after.url).not.toBe(before.url);
	expect((await page.request.get(after.url)).status()).toBe(200);
	// the old address is gone, so no cache can show the old picture
	expect((await page.request.get(before.url)).status()).toBe(404);

	// 3. cut it for the square frame
	await page.getByRole("button", { name: "Cắt", exact: true }).last().click();
	await page.getByRole("button", { name: "Lưu bản cắt" }).click();
	await expect(page.getByText("Đã cắt").first()).toBeVisible();
	const detail = (await api.call("GET", `media/${after.id}`)).json as { data: { crops: { ratio: string; url: string }[] } };
	expect(detail.data.crops.map((crop) => crop.ratio)).toEqual(["1:1"]);
	expect((await page.request.get(detail.data.crops[0].url)).status()).toBe(200);

	// 4. an unused picture can be deleted; the page asks first
	await page.getByRole("button", { name: "Xóa ảnh" }).click();
	await page.getByRole("button", { name: /^Xóa$|Xác nhận xóa|Đồng ý xóa/ }).first().click();
	await expect.poll(async () => ((await api.call("GET", `media?q=${name}`)).json as { data: Item[] }).data.length).toBe(0);
	await api.dispose();
});
