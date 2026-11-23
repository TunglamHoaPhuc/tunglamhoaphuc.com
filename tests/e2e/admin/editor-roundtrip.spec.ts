import { expect, test, type Page } from "@playwright/test";
import { localDb, signInOnPage, superAdminLogin, superAdminApi, unwrap, type AdminApi } from "./helpers";

// A/B in a real browser, on the data of the old site: opening an imported article in the editor and leaving, or saving, must not
// change it; typing a character and deleting it again must change no text, link, picture or video; a stale second tab is told so.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
test.setTimeout(900_000);

const stamp = Date.now().toString(36);
let admin: AdminApi;
/** The old site's articles hold no table, video or sound, so one that does is made here: what the server stores for such a body (a bare YouTube iframe, a table, sound). */
let richId = "";

test.beforeAll(async ({ baseURL }) => {
	admin = await superAdminApi(baseURL!);
	const made = unwrap<{ id: string; version: number }>(await admin.call("POST", "posts", { title: `Bài giàu định dạng ${stamp}`, section: "dong-chay-hoang-phap", summary: "s" }));
	const html = [
		"<table><tbody><tr><th>Cột 1</th><th>Cột 2</th></tr><tr><td>Ô 1</td><td>Ô 2</td></tr></tbody></table>",
		"<ul><li>Mục một</li><li>Mục hai</li></ul>",
		'<p>Xem <a href="https://example.test/lien-ket">liên kết</a>.</p>',
		'<audio controls src="https://example.test/am-thanh.mp3"></audio>',
		'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
		"<blockquote><p>Trích dẫn</p></blockquote>",
	].join("");
	expect((await admin.call("PATCH", `posts/${made.id}`, { version: made.version, contentHtml: html })).status).toBe(200);
	richId = made.id;
});
test.afterAll(async () => {
	await admin.dispose();
});

async function settled(page: Page) {
	await expect(page.locator("main#noi-dung h1").first()).toBeVisible({ timeout: 120_000 });
	await expect(page.locator("main#noi-dung").getByText(/^Đang (tải|mở trình soạn thảo)/)).toHaveCount(0, { timeout: 60_000 });
	await expect(page.locator(".ProseMirror").first()).toBeVisible({ timeout: 60_000 });
}

type Row = Record<string, unknown>;
const rowOf = (table: string, id: string) => {
	const db = localDb();
	const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Row;
	db.close();
	return row;
};
/** Words, addresses of links and pictures: what a reader of the article would lose if the editor dropped it. */
const contentOf = (html: string) => ({
	text: html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
	addresses: [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]).sort(),
	kinds: ["table", "iframe", "audio", "video", "img", "ul", "ol", "blockquote", "h2", "h3", "figure"].filter((tag) => new RegExp(`<${tag}\\b`).test(html)),
});

test("opening imported articles in the editor and leaving writes nothing: no unsaved-changes notice, no save request, the row is untouched", async ({ page, baseURL }) => {
	const db = localDb();
	// real imported articles that carry what an editor is most likely to mangle: a table, an iframe, sound, a long slug, many links
	const pick = (where: string, n: number) => (db.prepare(`SELECT id FROM post WHERE deleted_at IS NULL AND ${where} LIMIT ?`).all(n) as { id: string }[]).map((row) => row.id);
	const posts = [
		...new Set([
			...pick("content_html LIKE '%<table%'", 2),
			...pick("content_html LIKE '%<iframe%'", 2),
			...pick("content_html LIKE '%<audio%' OR content_html LIKE '%.mp3%'", 2),
			...pick("length(slug) > 100", 2),
			...pick("length(content_html) > 20000", 2),
			...pick("content_html LIKE '%<blockquote%'", 1),
			...pick("1 = 1 ORDER BY published_date DESC", 2),
		]),
	];
	const teachings = (db.prepare("SELECT id FROM teaching_article ORDER BY position LIMIT 3").all() as { id: string }[]).map((row) => row.id);
	const pages = (db.prepare("SELECT id FROM page ORDER BY position LIMIT 2").all() as { id: string }[]).map((row) => row.id);
	db.close();
	posts.unshift(richId);
	expect(posts.length).toBeGreaterThanOrEqual(6);

	const login = superAdminLogin();
	await signInOnPage(page, login.email, login.password);
	const writes: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/api/quan-tri/") && request.method() !== "GET") writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
	});
	const items = [...posts.map((id) => ["posts", "bai-viet", id]), ...teachings.map((id) => ["teaching_article", "tong-chi", id]), ...pages.map((id) => ["page", "gioi-thieu", id])] as [string, string, string][];
	const before = new Map(items.map(([table, , id]) => [`${table}/${id}`, rowOf(table === "posts" ? "post" : table, id)]));
	const trouble: string[] = [];
	for (const [table, path, id] of items) {
		await page.goto(`/quan-tri/${path}/${encodeURIComponent(id)}`);
		await settled(page);
		await page.waitForTimeout(1500);
		if (await page.getByText("Có thay đổi chưa lưu").count()) trouble.push(`${path}/${id}: shows "Có thay đổi chưa lưu" right after opening`);
		await page.keyboard.press("Control+S");
		await page.waitForTimeout(300);
		// leaving: no question
		await page.goto("/quan-tri/thung-rac");
		if (!/thung-rac/.test(page.url())) trouble.push(`${path}/${id}: leaving was held back`);
		void table;
	}
	expect(writes, "no request that changes anything was sent").toEqual([]);
	expect(trouble).toEqual([]);
	for (const [table, , id] of items) {
		const sql = table === "posts" ? "post" : table;
		expect(rowOf(sql, id), `${sql}/${id} is untouched`).toEqual(before.get(`${table}/${id}`));
	}
	void baseURL;
});

test("typing a character and deleting it again, then saving, keeps every word, link, picture and video of an imported article", async ({ page }) => {
	const db = localDb();
	const wanted = [richId, ...(db.prepare("SELECT id FROM post WHERE deleted_at IS NULL AND (content_html LIKE '%<table%' OR content_html LIKE '%<iframe%' OR content_html LIKE '%<audio%' OR content_html LIKE '%.mp3%') ORDER BY published_date DESC LIMIT 5").all() as { id: string }[]).map((row) => row.id)];
	const plain = (db.prepare("SELECT id FROM post WHERE deleted_at IS NULL AND content_html LIKE '%<a %' AND content_html NOT LIKE '%<table%' LIMIT 3").all() as { id: string }[]).map((row) => row.id);
	db.close();
	const login = superAdminLogin();
	await signInOnPage(page, login.email, login.password);
	const report: string[] = [];
	for (const id of [...wanted, ...plain]) {
		const original = String(rowOf("post", id).content_html);
		await page.goto(`/quan-tri/bai-viet/${encodeURIComponent(id)}`);
		await settled(page);
		const editor = page.locator(".ProseMirror").first();
		await editor.click();
		await page.keyboard.press("Control+End");
		await page.keyboard.type("x");
		await page.keyboard.press("Backspace");
		await page.keyboard.press("Control+S");
		await page.waitForTimeout(1500);
		const stored = String(rowOf("post", id).content_html);
		const was = contentOf(original);
		const now = contentOf(stored);
		if (was.text !== now.text) report.push(`${id}: the TEXT changed (${was.text.length} -> ${now.text.length} characters)`);
		const lostAddresses = was.addresses.filter((address) => !now.addresses.includes(address));
		if (lostAddresses.length) report.push(`${id}: lost addresses ${lostAddresses.slice(0, 3).join(" ")}`);
		const lostKinds = was.kinds.filter((tag) => !now.kinds.includes(tag));
		if (lostKinds.length) report.push(`${id}: lost <${lostKinds.join(">, <")}>`);
	}
	expect(report, "what the editor round trip lost").toEqual([]);
});

test("two tabs: the second save is refused with a notice, offers the newest version, and loads it", async ({ browser, baseURL }) => {
	const post = unwrap<{ id: string; version: number }>(await admin.call("POST", "posts", { title: `Bài hai tab ${stamp}`, section: "dong-chay-hoang-phap", summary: "s" }));
	const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [{ origin: new URL(baseURL!).origin, localStorage: [{ name: "tlhp_welcome_notice_v1_0", value: "seen" }] }] } });
	const first = await context.newPage();
	const login = superAdminLogin();
	await signInOnPage(first, login.email, login.password);
	const second = await context.newPage();
	for (const tab of [first, second]) {
		await tab.goto(`/quan-tri/bai-viet/${encodeURIComponent(post.id)}`);
		await settled(tab);
	}
	await first.getByLabel("Tiêu đề", { exact: true }).fill(`Bản của tab một ${stamp}`);
	await first.getByRole("button", { name: "Lưu", exact: true }).click();
	await expect(first.getByText(/Đã lưu \(phiên bản 2\)/)).toBeVisible();
	await second.getByLabel("Tiêu đề", { exact: true }).fill(`Bản của tab hai ${stamp}`);
	await second.getByRole("button", { name: "Lưu", exact: true }).click();
	await expect(second.getByText(/Bài vừa được người khác lưu/)).toBeVisible();
	// what is on the server is the first tab's save
	expect(unwrap<{ title: string; version: number }>(await admin.call("GET", `posts/${post.id}`))).toMatchObject({ title: `Bản của tab một ${stamp}`, version: 2 });
	// leaving the second tab's typed text behind is a question first (a stale tab holds work), then the newest version is loaded
	await second.getByRole("button", { name: "Tải bản mới nhất" }).click();
	const confirm = second.getByRole("button", { name: /Bỏ thay đổi/ });
	if (await confirm.count()) await confirm.click();
	await expect(second.getByLabel("Tiêu đề", { exact: true })).toHaveValue(`Bản của tab một ${stamp}`);
	await expect(second.getByText(/Bài vừa được người khác lưu/)).toHaveCount(0);
	// and the second tab can save on top of it
	await second.getByLabel("Tiêu đề", { exact: true }).fill(`Bản của tab hai ${stamp}`);
	await second.getByRole("button", { name: "Lưu", exact: true }).click();
	await expect(second.getByText(/Đã lưu \(phiên bản 3\)/)).toBeVisible();
	await context.close();
});
