import { expect, test, type Page } from "@playwright/test";
import { signInOnPage, superAdminApi, superAdminLogin, unwrap, type AdminApi } from "./helpers";

// The Word-style toolbar, pasting from Word, the local draft and bulk actions in the article list.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
test.setTimeout(240_000);

type Post = { id: string; version: number; status: string; contentHtml: string };
const STAMP = Date.now().toString(36);
const SECTION = "dong-chay-hoang-phap";

let admin: AdminApi;
test.beforeAll(async ({ baseURL }) => {
	admin = await superAdminApi(baseURL!);
});
test.afterAll(async () => {
	await admin.dispose();
});

async function makePost(title: string): Promise<Post> {
	const created = await admin.call("POST", "posts", { title, section: SECTION, summary: "Tóm tắt", contentHtml: "<p>Đầu bài.</p>" });
	expect(created.status).toBe(200);
	return unwrap<Post>(created);
}

async function openEditor(page: Page, path: string) {
	const login = superAdminLogin();
	await signInOnPage(page, login.email, login.password);
	await page.goto(path);
	await expect(page.locator(".ProseMirror")).toBeVisible({ timeout: 90_000 });
}

test("formatting from the toolbar is saved as the style the server keeps", async ({ page }) => {
	const post = await makePost(`Định dạng ${STAMP}`);
	await openEditor(page, `/quan-tri/bai-viet/${post.id}`);
	await page.locator(".ProseMirror").click();
	await page.keyboard.press("Control+a");
	await page.getByRole("button", { name: "Căn giữa" }).click();
	await page.getByLabel("Cỡ chữ").selectOption("24");
	await page.getByRole("button", { name: "Chỉ số trên" }).click();
	await page.keyboard.press("Control+s");
	await expect(page.getByText(/Đã lưu \(phiên bản/)).toBeVisible({ timeout: 30_000 });
	const html = unwrap<Post>(await admin.call("GET", `posts/${post.id}`)).contentHtml;
	expect(html).toContain("text-align: center");
	expect(html).toContain("font-size: 24px");
	expect(html).toContain("<sup>");
	expect(html).not.toMatch(/<script|onerror|position/);
});

test("pasting from Word keeps structure and drops Word's own markup", async ({ page }) => {
	const post = await makePost(`Dán Word ${STAMP}`);
	await openEditor(page, `/quan-tri/bai-viet/${post.id}`);
	await page.locator(".ProseMirror").click();
	await page.keyboard.press("Control+a");
	await page.evaluate(() => {
		const html =
			'<html><head><style>p.MsoNormal{mso-style-name:x}</style></head><body><!--StartFragment--><h2 class="MsoHeading" style="mso-bidi:1">Tựa Word</h2><p class="MsoNormal" style="font-family:Calibri;font-size:11pt;text-align:center"><span style="font-weight:700;mso-ansi:x">Đậm</span> và thường <o:p></o:p></p><!--EndFragment--></body></html>';
		const data = new DataTransfer();
		data.setData("text/html", html);
		data.setData("text/plain", "Tựa Word\nĐậm và thường");
		document.querySelector(".ProseMirror")!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
	});
	await page.keyboard.press("Control+s");
	await expect(page.getByText(/Đã lưu \(phiên bản/)).toBeVisible({ timeout: 30_000 });
	const html = unwrap<Post>(await admin.call("GET", `posts/${post.id}`)).contentHtml;
	expect(html).toContain("<h2>Tựa Word</h2>");
	expect(html).toContain("<strong>Đậm</strong>");
	expect(html).toContain("text-align: center");
	expect(html).not.toMatch(/Mso|mso-|Calibri|font-size: 11pt|class=/);
});

test("an unsaved body comes back from the local draft after a reload", async ({ page }) => {
	const post = await makePost(`Bản nháp ${STAMP}`);
	await openEditor(page, `/quan-tri/bai-viet/${post.id}`);
	await page.locator(".ProseMirror").click();
	await page.keyboard.press("Control+End");
	await page.keyboard.type(" Chưa lưu.");
	await page.waitForTimeout(3500);
	await page.goto(`/quan-tri/bai-viet/${post.id}`, { waitUntil: "load" });
	await page.reload();
	await expect(page.getByText("Có bản nháp chưa lưu trên máy này")).toBeVisible({ timeout: 90_000 });
	await page.getByRole("button", { name: "Khôi phục bản nháp" }).click();
	await expect(page.locator(".ProseMirror")).toContainText("Đầu bài. Chưa lưu.");
});

test("bulk publish and delete in the list", async ({ page }) => {
	const a = await makePost(`Hàng loạt A ${STAMP}`);
	const b = await makePost(`Hàng loạt B ${STAMP}`);
	const login = superAdminLogin();
	await signInOnPage(page, login.email, login.password);
	await page.goto("/quan-tri/bai-viet");
	await page.getByLabel("Tìm kiếm").fill(`Hàng loạt`);
	await expect(page.getByLabel(`Chọn Hàng loạt A ${STAMP}`)).toBeVisible({ timeout: 60_000 });
	await page.getByLabel(`Chọn Hàng loạt A ${STAMP}`).check();
	await page.getByLabel(`Chọn Hàng loạt B ${STAMP}`).check();
	await page.getByRole("button", { name: "Xuất bản các bài đã chọn" }).click();
	await expect(page.getByText(/Đã xuất bản \d+\/2 bài/)).toBeVisible({ timeout: 60_000 });
	expect(unwrap<Post>(await admin.call("GET", `posts/${a.id}`)).status).toBe("published");
	expect(unwrap<Post>(await admin.call("GET", `posts/${b.id}`)).status).toBe("published");
	await page.getByLabel(`Chọn Hàng loạt A ${STAMP}`).check();
	await page.getByRole("button", { name: "Xóa các bài đã chọn" }).click();
	await page.getByRole("group", { name: "Xác nhận xóa hàng loạt" }).getByRole("button", { name: "Xóa" }).click();
	await expect(page.getByText(/Đã chuyển vào thùng rác 1\/1 bài/)).toBeVisible({ timeout: 60_000 });
	expect((await admin.call("GET", `posts/${a.id}`)).status).toBe(404);
});
