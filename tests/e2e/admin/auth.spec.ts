import { expect, test } from "@playwright/test";
import { AdminApi, devVars, makeAccount, PASSWORD, signInOnPage, superAdminApi } from "./helpers";

// Phase 4 of the admin: roles, 403, sessions and the sign-in pages in a real browser.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
// The first page loads on a dev server compile on demand: give each test room.
test.setTimeout(150_000);

test("the sign-in page refuses a wrong password and sends a guest back to it", async ({ page }) => {
	await page.goto("/quan-tri");
	await page.waitForURL(/\/quan-tri\/dang-nhap/);
	await page.getByLabel("Email").fill("khong-co@localhost.test");
	await page.getByLabel("Mật khẩu").fill("sai-mat-khau-1");
	await page.getByRole("button", { name: "Đăng nhập" }).click();
	await expect(page.getByRole("alert")).toContainText("Email hoặc mật khẩu không đúng");
});

test("each role sees only its own menu, and the API answers 403 where it must", async ({ page, baseURL }) => {
	const admin = await superAdminApi(baseURL!);
	const editor = await makeAccount(admin, baseURL!, "role-editor", "editor");
	const author = await makeAccount(admin, baseURL!, "role-author", "author");

	await signInOnPage(page, editor.email, editor.password);
	const nav = page.getByRole("navigation");
	await expect(nav.getByRole("link", { name: "Thư viện Media" })).toBeVisible();
	await expect(nav.getByRole("link", { name: "Tài khoản" })).toHaveCount(0);
	await expect(nav.getByRole("link", { name: "Vai trò và quyền" })).toHaveCount(0);
	await page.getByRole("button", { name: "Đăng xuất" }).click();
	await page.waitForURL(/\/quan-tri\/dang-nhap/);

	const editorApi = await AdminApi.signIn(baseURL!, editor.email, editor.password);
	expect((await editorApi.call("GET", "users")).status).toBe(403);
	expect((await editorApi.call("GET", "roles")).status).toBe(403);
	expect((await editorApi.call("GET", "audit")).status).toBe(403);

	const authorApi = await AdminApi.signIn(baseURL!, author.email, author.password);
	expect((await authorApi.call("GET", "users")).status).toBe(403);
	expect((await authorApi.call("DELETE", "media/khong-co")).status).toBe(403);

	// someone who is not signed in gets 401 from the same API
	const anonymous = await (await import("@playwright/test")).request.newContext({ baseURL });
	expect((await anonymous.get("/api/quan-tri/v1/users", { failOnStatusCode: false })).status()).toBe(401);
	await Promise.all([admin.dispose(), editorApi.dispose(), authorApi.dispose(), anonymous.dispose()]);
});

test("a locked account loses its session at once and cannot sign in again until unlocked", async ({ page, baseURL }) => {
	const admin = await superAdminApi(baseURL!);
	const person = await makeAccount(admin, baseURL!, "role-editor", "locked");
	await signInOnPage(page, person.email, person.password);
	expect((await admin.call("POST", `users/${person.id}/lock`, { reason: "kiểm thử" })).status).toBe(200);
	await page.goto("/quan-tri/media");
	await page.waitForURL(/\/quan-tri\/dang-nhap/);
	await page.getByLabel("Email").fill(person.email);
	await page.getByLabel("Mật khẩu").fill(person.password);
	await page.getByRole("button", { name: "Đăng nhập" }).click();
	await expect(page.getByRole("alert")).toContainText("không đúng");
	expect((await admin.call("POST", `users/${person.id}/unlock`)).status).toBe(200);
	await signInOnPage(page, person.email, person.password);
	await admin.dispose();
});

test("changing the password in the profile ends the other sessions", async ({ page, baseURL }) => {
	const admin = await superAdminApi(baseURL!);
	const person = await makeAccount(admin, baseURL!, "role-editor", "pwchange");
	const other = await AdminApi.signIn(baseURL!, person.email, person.password);
	await signInOnPage(page, person.email, person.password);
	await page.goto("/quan-tri/ho-so");
	await page.getByLabel("Mật khẩu hiện tại").fill(person.password);
	await page.getByLabel("Mật khẩu mới", { exact: true }).fill(`${PASSWORD}-2`);
	await page.getByLabel("Nhập lại mật khẩu mới").fill(`${PASSWORD}-2`);
	await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
	await expect(page.getByText("Đã đổi mật khẩu")).toBeVisible();
	expect((await other.call("GET", "auth/me")).status).toBe(401);
	await expect(page.getByRole("heading", { name: "Hồ sơ và bảo mật" })).toBeVisible();
	await Promise.all([admin.dispose(), other.dispose()]);
	void devVars;
});
