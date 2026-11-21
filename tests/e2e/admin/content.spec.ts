import { expect, test } from "@playwright/test";
import { AdminApi, makeAccount, signInOnPage, superAdminApi } from "./helpers";

// The editorial flow end to end: write, submit, approve, publish, see it on the public site, edit in the browser,
// go back to an older version, delete and restore, and find every step in the activity log.
// Needs the server to read its content from D1 (see docs: the dev server started with TLHP_CONTENT_SOURCE=d1 and the
// snapshot imported into the local D1), because that is how the public pages follow the admin.
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
test.setTimeout(300_000);

type Post = { id: string; slug: string; version: number; status: string };
const data = <T>(response: { json: unknown }) => (response.json as { data: T }).data;

async function publicHas(baseURL: string, path: string, text: string, want: boolean, tries = 20): Promise<boolean> {
	for (let i = 0; i < tries; i++) {
		const response = await fetch(`${baseURL}${path}?t=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
		const html = response.ok ? await response.text() : "";
		if (html.includes(text) === want) return true;
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}
	return false;
}

test("write, approve, publish, edit, restore, delete and restore again — and the log shows it all", async ({ page, baseURL }) => {
	const admin = await superAdminApi(baseURL!);
	const author = await makeAccount(admin, baseURL!, "role-author", "tacgia");
	const editor = await makeAccount(admin, baseURL!, "role-editor", "bientap");
	const authorApi = await AdminApi.signIn(baseURL!, author.email, author.password);
	const editorApi = await AdminApi.signIn(baseURL!, editor.email, editor.password);

	const stamp = Date.now().toString(36);
	const marker = `Nội dung kiểm thử ${stamp}`;
	const created = await authorApi.call("POST", "posts", { title: `Bài kiểm thử ${stamp}`, section: "dong-chay-hoang-phap", summary: "Tóm tắt kiểm thử", contentHtml: `<p>${marker}</p>` });
	expect(created.status).toBe(200);
	const post = data<Post>(created);
	expect(post.status).toBe("draft");
	const publicPath = `/dong-chay-hoang-phap/${post.slug}`;

	// a draft is not on the public site; an Author may send it for approval but not publish it
	expect((await fetch(`${baseURL}${publicPath}`)).status).toBe(404);
	expect((await authorApi.call("POST", `posts/${post.id}/submit`, {})).status).toBe(200);
	const forbidden = await authorApi.call("POST", `posts/${post.id}/publish`, {});
	expect(forbidden.status).toBe(403);

	// the Editor approves and publishes: the public page shows it
	expect((await editorApi.call("POST", `posts/${post.id}/publish`, {})).status).toBe(200);
	expect(await publicHas(baseURL!, publicPath, marker, true)).toBe(true);

	// a published post can no longer be changed by its Author alone
	const current = data<Post>(await editorApi.call("GET", `posts/${post.id}`));
	expect((await authorApi.call("PATCH", `posts/${post.id}`, { version: current.version, summary: "tác giả sửa" })).status).toBe(403);

	// the Editor edits it in the browser: type, Ctrl+S, and the version goes up
	await signInOnPage(page, editor.email, editor.password);
	await page.goto(`/quan-tri/bai-viet/${post.id}`);
	const body = page.locator(".ProseMirror");
	await expect(body).toBeVisible({ timeout: 90_000 });
	await body.click();
	await page.keyboard.press("Control+End");
	await page.keyboard.type(` Sửa lần hai ${stamp}.`);
	await page.keyboard.press("Control+s");
	await expect(page.getByText(/Đã lưu \(phiên bản \d+\)/)).toBeVisible();
	expect(await publicHas(baseURL!, publicPath, `Sửa lần hai ${stamp}`, true)).toBe(true);

	// someone saving with an old version number is told to reload, not allowed to overwrite
	const stale = await editorApi.call("PATCH", `posts/${post.id}`, { version: current.version, summary: "bản cũ" });
	expect(stale.status).toBe(409);

	// history has the versions; restoring an older one brings its text back as a new version
	const revisions = data<{ revisions?: { version: number }[] } | { version: number }[]>(await editorApi.call("GET", `posts/${post.id}/revisions`));
	const list = Array.isArray(revisions) ? revisions : (revisions.revisions ?? []);
	expect(list.length).toBeGreaterThanOrEqual(2);
	const oldest = Math.min(...list.map((item) => item.version));
	expect((await editorApi.call("POST", `posts/${post.id}/revisions/${oldest}/restore`, {})).status).toBe(200);
	expect(await publicHas(baseURL!, publicPath, `Sửa lần hai ${stamp}`, false)).toBe(true);
	expect(await publicHas(baseURL!, publicPath, marker, true)).toBe(true);

	// deleting moves it to the trash and off the public site; the trash lists it and restores it
	expect((await editorApi.call("DELETE", `posts/${post.id}`)).status).toBe(204);
	expect(await publicHas(baseURL!, publicPath, marker, false)).toBe(true);
	const trash = data<{ type: string; id: string }[]>(await editorApi.call("GET", "trash?type=post"));
	expect(trash.some((row) => row.id === post.id)).toBe(true);
	expect((await editorApi.call("POST", `trash/post/${post.id}/restore`, {})).status).toBe(200);

	// every step is in the activity log with who did it
	const log = (await admin.call("GET", `audit?entityId=${post.id}&page=1`)).json as { data: { action: string; userEmail: string }[] };
	const actions = log.data.map((row) => row.action);
	for (const wanted of ["post.create", "post.submit", "post.publish", "post.update", "post.delete"]) expect(actions, wanted).toContain(wanted);
	expect(log.data.some((row) => row.userEmail === author.email)).toBe(true);
	expect(log.data.some((row) => row.userEmail === editor.email)).toBe(true);

	await Promise.all([admin.dispose(), authorApi.dispose(), editorApi.dispose()]);
});
