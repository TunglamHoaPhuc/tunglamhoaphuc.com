import { expect, test, type Page } from "@playwright/test";
import { localDb, signInOnPage, superAdminApi, superAdminLogin, unwrap, type AdminApi } from "./helpers";

// The article editor in a real browser (tasks/admin-v3-spec.md B1, B2, B3, B4, B13, B15): what is typed while a save is on its way
// stays, an imported article with a very long slug keeps its address, a taken slug offers the free one, leaving with unsaved changes
// asks first, a live article cannot be scheduled, a teaching video can be changed and removed.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
test.setTimeout(240_000);

type Post = { id: string; slug: string; version: number; status: string; contentHtml: string; summary: string; video?: unknown };

const stamp = () => Date.now().toString(36);
const STAMP = stamp();
const SECTION = "dong-chay-hoang-phap";

let admin: AdminApi;
test.beforeAll(async ({ baseURL }) => {
	admin = await superAdminApi(baseURL!);
});
test.afterAll(async () => {
	await admin.dispose();
});

async function makePost(title: string, extra: Record<string, unknown> = {}): Promise<Post> {
	const created = await admin.call("POST", "posts", { title, section: SECTION, summary: "Tóm tắt ban đầu", contentHtml: "<p>Đầu bài.</p>", ...extra });
	expect(created.status, `create ${title}`).toBe(200);
	return unwrap<Post>(created);
}

async function openEditor(page: Page, path: string) {
	const login = superAdminLogin(); // the seeded one-time password was changed by superAdminApi
	await signInOnPage(page, login.email, login.password);
	await page.goto(path);
	await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 90_000 });
}

test("B2: what is typed while a save is on its way stays, with the caret and the editor itself", async ({ page }) => {
	const post = await makePost(`Gõ trong lúc lưu ${STAMP}`);
	let patches = 0;
	await page.route(`**/api/quan-tri/v1/posts/${post.id}`, async (route) => {
		if (route.request().method() === "PATCH") {
			patches++;
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
		await route.continue();
	});
	await openEditor(page, `/quan-tri/bai-viet/${post.id}`);
	const body = page.locator(".ProseMirror");
	// a mark on the editor's element: a rebuilt editor would be a new element without it
	await page.evaluate(() => void ((document.querySelector(".ProseMirror") as HTMLElement & { __kept?: boolean }).__kept = true));

	await body.click();
	await page.keyboard.press("Control+End");
	await page.keyboard.type(" Một.");
	await page.keyboard.press("Control+s");
	await expect.poll(() => patches).toBe(1);
	await page.keyboard.type(" Hai."); // typed while the PATCH is held back
	await expect(page.getByText("Đã lưu (phiên bản 2).")).toBeVisible({ timeout: 30_000 });

	await expect(body).toContainText("Đầu bài. Một. Hai.");
	await expect(body).toBeFocused();
	expect(await page.evaluate(() => (document.querySelector(".ProseMirror") as HTMLElement & { __kept?: boolean }).__kept)).toBe(true);
	// " Hai." was never sent, so the page still says there is something to save
	await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
	await page.keyboard.type(" Ba.");
	await page.keyboard.press("Control+s");
	await expect(page.getByText("Đã lưu (phiên bản 3).")).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText("Có thay đổi chưa lưu")).toHaveCount(0);
	expect(unwrap<Post>(await admin.call("GET", `posts/${post.id}`)).contentHtml).toContain("Đầu bài. Một. Hai. Ba.");

	// a plain field typed into during the next save is kept too
	const summary = page.getByLabel("Tóm tắt", { exact: true });
	await summary.fill("Tóm tắt mới");
	await page.keyboard.press("Control+s");
	await expect.poll(() => patches).toBe(3);
	await summary.pressSequentially(" và viết tiếp");
	await expect(page.getByText("Đã lưu (phiên bản 4).")).toBeVisible({ timeout: 30_000 });
	await expect(summary).toHaveValue("Tóm tắt mới và viết tiếp");
	await expect(page.getByText("Có thay đổi chưa lưu")).toBeVisible();
});

test("B1/B15c: an article with a 145-character slug keeps it when the field is tabbed through and something else is saved", async ({ page }) => {
	// 145 characters, different on every run (the local database keeps what earlier runs made)
	const LONG = `${(`${STAMP}-` + "dai-".repeat(40)).slice(0, 144)}d`;
	expect(LONG.length).toBe(145);
	const post = await makePost(`Slug rất dài ${STAMP}`);
	const db = localDb();
	db.prepare("UPDATE post SET slug = ? WHERE id = ?").run(LONG, post.id);
	db.close();

	const sent: string[] = [];
	page.on("request", (request) => {
		if (request.method() === "PATCH" && request.url().includes(`/posts/${post.id}`)) sent.push(request.postData() ?? "");
	});
	await openEditor(page, `/quan-tri/bai-viet/${post.id}`);
	const slug = page.locator("#content-slug");
	await expect(slug).toHaveValue(LONG);
	await slug.focus();
	await page.keyboard.press("Tab");
	await expect(slug).toHaveValue(LONG);
	await page.getByRole("button", { name: "Kiểm tra" }).click();
	await expect(page.getByText("Đường dẫn dùng được.")).toBeVisible();
	await expect(slug).toHaveValue(LONG);

	await page.getByLabel("Tóm tắt", { exact: true }).fill("Chỉ sửa tóm tắt");
	await page.getByRole("button", { name: "Lưu", exact: true }).click();
	await expect(page.getByText("Đã lưu (phiên bản 2).")).toBeVisible();
	await expect(slug).toHaveValue(LONG);
	expect(sent).toHaveLength(1);
	expect(JSON.parse(sent[0])).not.toHaveProperty("slug");
	const stored = unwrap<Post>(await admin.call("GET", `posts/${post.id}`));
	expect(stored.slug).toBe(LONG);
	expect(stored.summary).toBe("Chỉ sửa tóm tắt");
});

test("B15c: a taken slug says so and offers the free one", async ({ page }) => {
	const taken = `e2e-trung-${STAMP}`;
	await makePost(`Bài giữ đường dẫn ${STAMP}`, { slug: taken });
	const other = await makePost(`Bài muốn đường dẫn đó ${STAMP}`);
	await openEditor(page, `/quan-tri/bai-viet/${other.id}`);

	const slug = page.locator("#content-slug");
	await slug.fill(taken);
	await page.keyboard.press("Control+s");
	await expect(page.locator("#content-slug-note")).toContainText("Đường dẫn đã có người dùng");
	const use = page.getByRole("button", { name: "Dùng đường dẫn gợi ý" });
	await expect(use).toBeVisible();
	await use.click();
	await expect(slug).toHaveValue(`${taken}-2`);
	await expect(use).toHaveCount(0);
	await page.keyboard.press("Control+s");
	await expect(page.getByText(/Đã lưu \(phiên bản \d+\)/)).toBeVisible();
	expect(unwrap<Post>(await admin.call("GET", `posts/${other.id}`)).slug).toBe(`${taken}-2`);
});

test("B15a: leaving with unsaved changes asks first, in the page, and answers Ở lại / Bỏ thay đổi", async ({ page }) => {
	const post = await makePost(`Rời trang ${STAMP}`);
	await openEditor(page, `/quan-tri/bai-viet/${post.id}`);
	const summary = page.getByLabel("Tóm tắt", { exact: true });
	const notice = page.getByRole("alert").filter({ hasText: "Còn thay đổi chưa lưu" });

	// nothing typed: the menu link goes at once
	await page.getByRole("link", { name: "Thư viện Media" }).click();
	await page.waitForURL(/\/quan-tri\/media$/);
	await page.goBack();
	await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 60_000 });

	await summary.fill("Chữ chưa lưu");
	await page.getByRole("link", { name: "Thư viện Media" }).click();
	await expect(notice).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/quan-tri/bai-viet/${post.id}$`));
	await expect(page.getByRole("button", { name: "Ở lại" })).toBeFocused();
	await page.getByRole("button", { name: "Ở lại" }).click();
	await expect(notice).toHaveCount(0);
	await expect(summary).toHaveValue("Chữ chưa lưu");

	// the back link in the page asks too, and "Bỏ thay đổi" leaves
	await page.getByRole("link", { name: /Bài viết/ }).filter({ hasText: "←" }).click();
	await expect(notice).toBeVisible();
	await page.getByRole("button", { name: "Bỏ thay đổi" }).click();
	await page.waitForURL(/\/quan-tri\/bai-viet$/);
	expect(unwrap<Post>(await admin.call("GET", `posts/${post.id}`)).summary).toBe("Tóm tắt ban đầu");
});

test("B13: a live article cannot be scheduled: a warning in the page and the button is off", async ({ page }) => {
	const post = await makePost(`Đang hiển thị ${STAMP}`);
	expect((await admin.call("POST", `posts/${post.id}/publish`, {})).status).toBe(200);
	await openEditor(page, `/quan-tri/bai-viet/${post.id}`);
	await expect(page.getByText("Bài đang hiển thị trên trang. Hẹn giờ sẽ gỡ bài")).toBeVisible();
	await expect(page.getByRole("button", { name: "Hẹn giờ", exact: true })).toBeDisabled();
	await expect(page.getByLabel(/Hẹn giờ đăng/)).toBeDisabled();
	// the server says no as well
	const refused = await admin.call("POST", `posts/${post.id}/publish`, { publishAt: new Date(Date.now() + 3_600_000).toISOString() });
	expect(refused.status).toBe(409);
	expect((refused.json as { error: { code: string } }).error.code).toBe("already_live");
});

test("B3/B4: a pasted YouTube address becomes the watch address; clearing it removes the video", async ({ page }) => {
	const created = await admin.call("POST", "teachings", { title: `Tông chỉ có video ${STAMP}` });
	expect(created.status).toBe(200);
	const id = unwrap<Post>(created).id;
	await openEditor(page, `/quan-tri/tong-chi/${id}`);
	const url = page.getByLabel("Địa chỉ video YouTube");

	await url.fill("https://www.youtube.com/embed/dQw4w9WgXcQ");
	await url.blur();
	await expect(url).toHaveValue("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
	await expect(page.getByText("Mã video: dQw4w9WgXcQ")).toBeVisible();
	await page.getByLabel("Tiêu đề video").fill("Một video");
	await page.getByRole("button", { name: "Lưu", exact: true }).click();
	await expect(page.getByText("Đã lưu (phiên bản 2).")).toBeVisible();
	expect(unwrap<{ video: { id: string; url: string } }>(await admin.call("GET", `teachings/${id}`)).video).toMatchObject({ id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });

	// another address: the old id must not win
	await url.fill("https://youtu.be/9bZkp7q19f0");
	await url.blur();
	await page.getByRole("button", { name: "Lưu", exact: true }).click();
	await expect(page.getByText("Đã lưu (phiên bản 3).")).toBeVisible();
	expect(unwrap<{ video: { id: string } }>(await admin.call("GET", `teachings/${id}`)).video.id).toBe("9bZkp7q19f0");

	// nothing recognised: the page says so before the server does
	await url.fill("https://vimeo.com/123");
	await expect(page.getByText("Không nhận ra địa chỉ video YouTube")).toBeVisible();

	// an empty address removes the video
	await url.fill("");
	await page.getByRole("button", { name: "Lưu", exact: true }).click();
	await expect(page.getByText("Đã lưu (phiên bản 4).")).toBeVisible();
	expect(unwrap<{ video: unknown }>(await admin.call("GET", `teachings/${id}`)).video).toBeNull();
});
