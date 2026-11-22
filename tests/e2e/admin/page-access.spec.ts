import { expect, test, type Page } from "@playwright/test";
import { AdminApi, localDb, makeAccount, signInOnPage, superAdminApi, unwrap } from "./helpers";
import { NAV } from "../../../src/components/admin/nav";
import { PAGE_NEEDS } from "../../../src/components/admin/pagePermissions";

// G1-G5 in a real browser: each of the four seeded roles and a custom one opens EVERY page under src/app/quan-tri/(khung) by its
// address. A page the role may open shows content (and no red error block); one it may not shows "Không có quyền truy cập"; the
// menu lists exactly the pages the role may open. An Author sees no save/replace/crop/delete on a picture somebody else uploaded.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
test.setTimeout(900_000);

/**
 * Written by hand, independently of src/components/admin/pagePermissions.ts (a test below holds the two equal): the page, with `[id]` for
 * an address that names one thing, and the permission it takes to open it.
 */
const PAGES: [string, string | null][] = [
	["", null],
	["ho-so", null],
	["bai-viet", "posts.view"],
	["bai-viet/moi", "posts.create"],
	["bai-viet/[id]", "posts.view"],
	["tong-chi", "teachings.view"],
	["tong-chi/moi", "teachings.create"],
	["tong-chi/[id]", "teachings.view"],
	["gioi-thieu", "pages.view"],
	["gioi-thieu/moi", "pages.create"],
	["gioi-thieu/[id]", "pages.view"],
	["media", "media.view"],
	["chuyen-muc", "categories.view"],
	["menu", "menus.view"],
	["trang-chu", "home.view"],
	["lich-tu-hoc", "events.view"],
	["lich-tu-hoc/moi", "events.create"],
	["lich-tu-hoc/chu-de", "events.view"],
	["lich-tu-hoc/[id]", "events.view"],
	["bao-tuong", "statues.view"],
	["bao-tuong/moi", "statues.create"],
	["bao-tuong/[id]", "statues.view"],
	["khu-vuc", "areas.view"],
	["khu-vuc/[id]", "areas.view"],
	["loi-thay-day", "quotes.view"],
	["seo", "seo.view"],
	["chuyen-huong", "redirects.view"],
	["thung-rac", "trash.view"],
	["nhat-ky", "audit.view"],
	["cau-hinh", "settings.view"],
	["sao-luu", "backup.view"],
	["tai-khoan", "users.view"],
	["tai-khoan/moi", "users.create"],
	["tai-khoan/[id]", "users.view"],
	["vai-tro", "roles.view"],
	["vai-tro/moi", "roles.create"],
	["vai-tro/[id]", "roles.view"],
];

type Ids = Record<string, string>;
let admin: AdminApi;
let ids: Ids;
const ROLES = [
	{ label: "super", roleId: "role-super-admin" },
	{ label: "admin", roleId: "role-admin" },
	{ label: "editor", roleId: "role-editor" },
	{ label: "author", roleId: "role-author" },
	{ label: "custom", roleId: "" },
];
const accounts = new Map<string, { email: string; password: string; id: string; permissions: string[] }>();
const stamp = Date.now().toString(36);

test.beforeAll(async ({ baseURL }) => {
	admin = await superAdminApi(baseURL!);
	// one thing of each kind that has a page of its own, for the `[id]` addresses
	const post = unwrap<{ id: string }>(await admin.call("POST", "posts", { title: `Bài cho kiểm quyền ${stamp}`, section: "dong-chay-hoang-phap", summary: "s" }));
	const teaching = unwrap<{ id: string }>(await admin.call("POST", "teachings", { title: `Tông chỉ cho kiểm quyền ${stamp}` }));
	const page = unwrap<{ id: string }>(await admin.call("POST", "pages", { title: `Trang cho kiểm quyền ${stamp}` }));
	const event = unwrap<{ id: string }>(await admin.call("POST", "events", { title: `Sự kiện kiểm quyền ${stamp}`, startDate: "2026-12-12" }));
	const statue = unwrap<{ id: string }>(await admin.call("POST", "statues", { name: `Bảo tượng kiểm quyền ${stamp}` }));
	// areas only come from an import: one is put into the local database by hand
	const db = localDb();
	db.prepare("INSERT OR IGNORE INTO area (id, slug, name) VALUES (?, ?, ?)").run(`area-e2e-${stamp}`, `khu-e2e-${stamp}`, `Khu vực kiểm quyền ${stamp}`);
	db.close();
	const role = unwrap<{ id: string }>(
		await admin.call("POST", "roles", { name: `Vai riêng ${stamp}`, description: "e2e", permissions: ["dashboard.view", "posts.view", "posts.update:own", "media.view", "categories.view"] }),
	);
	ids = { "bai-viet": post.id, "tong-chi": teaching.id, "gioi-thieu": page.id, "lich-tu-hoc": event.id, "bao-tuong": statue.id, "khu-vuc": `area-e2e-${stamp}`, "tai-khoan": "", "vai-tro": "role-editor" };
	for (const item of ROLES) {
		const made = await makeAccount(admin, baseURL!, item.roleId || role.id, item.label);
		const mine = await AdminApi.signIn(baseURL!, made.email, made.password);
		const me = unwrap<{ permissions: string[] }>(await mine.call("GET", "auth/me"));
		await mine.dispose();
		accounts.set(item.label, { ...made, permissions: me.permissions });
		if (item.label === "super") ids["tai-khoan"] = made.id;
	}
});
test.afterAll(async () => {
	await admin.dispose();
});

const may = (permissions: string[], need: string | null) => need === null || permissions.includes(need) || permissions.includes(`${need}:own`);
const concrete = (pattern: string) => {
	const parts = pattern.split("/");
	return parts.map((part) => (part === "[id]" ? encodeURIComponent(ids[parts[0]]) : part)).join("/");
};

/** The page is done loading when its main area has no "Đang tải" left (a dev server compiles each page the first time). */
async function settled(page: Page) {
	await expect(page.locator("main#noi-dung h1").first()).toBeVisible({ timeout: 120_000 });
	await expect(page.locator("main#noi-dung").getByText(/^Đang (tải|mở trình soạn thảo)/)).toHaveCount(0, { timeout: 60_000 });
}

test("the hand-written table of pages equals the one the app uses", () => {
	expect(Object.fromEntries(PAGES)).toEqual(Object.fromEntries(Object.entries(PAGE_NEEDS).map(([page, need]) => [page, need ? `${need[0]}.${need[1]}` : null])));
});

for (const { label } of ROLES) {
	test(`${label}: every page opens or says "Không có quyền truy cập", and the menu lists exactly the pages it may open`, async ({ page }) => {
		const account = accounts.get(label)!;
		await signInOnPage(page, account.email, account.password);
		const problems: string[] = [];

		for (const [pattern, need] of PAGES) {
			const path = `/quan-tri${pattern ? `/${concrete(pattern)}` : ""}`;
			await page.goto(path);
			await settled(page);
			// textContent, not innerText: the headings are set in capitals by the stylesheet
			const forbidden = ((await page.locator("main#noi-dung h1").first().textContent()) ?? "").trim() === "Không có quyền truy cập";
			const shouldOpen = may(account.permissions, need);
			if (shouldOpen && forbidden) problems.push(`${path}: should open for ${label}, shows "Không có quyền truy cập"`);
			if (!shouldOpen && !forbidden) problems.push(`${path}: should be refused for ${label}, but it opened`);
			// a red block is a request that failed: on a page the role may open nothing should have been asked that it may not
			const red = await page.locator("main#noi-dung .tq-alert--error").allInnerTexts();
			if (red.length) problems.push(`${path}: red error block: ${red.join(" | ").slice(0, 160)}`);
			if (forbidden) await expect(page.locator("main#noi-dung").getByText("Bạn không có quyền")).toBeVisible();
		}

		// the menu (read on the start page) lists a page exactly when the role may open it
		await page.goto("/quan-tri");
		await settled(page);
		for (const group of NAV)
			for (const item of group.items) {
				const need = item.needs ? `${item.needs[0]}.${item.needs[1]}` : null;
				const shown = await page.locator(`aside nav a[href="${item.href}"]`).count();
				if ((shown > 0) !== may(account.permissions, need)) problems.push(`menu "${item.label}": ${shown ? "shown" : "hidden"} for ${label} but the page is ${may(account.permissions, need) ? "open" : "refused"}`);
			}
		expect(problems).toEqual([]);
	});
}

test("an Author sees no save, replace, crop or delete on a picture somebody else uploaded", async ({ page, baseURL }) => {
	// the Editor uploads one (a tiny valid PNG); the Author uploads another
	const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
	const author = accounts.get("author")!;
	const editor = accounts.get("editor")!;
	const upload = async (who: { email: string; password: string }, name: string) => {
		const api = await AdminApi.signIn(baseURL!, who.email, who.password);
		const me = unwrap<{ csrfToken: string }>(await api.call("GET", "auth/me"));
		const response = await api.context.fetch("/api/quan-tri/v1/media", {
			method: "POST",
			headers: { Origin: new URL(baseURL!).origin, "X-TLHP-CSRF": me.csrfToken },
			multipart: { file: { name, mimeType: "image/png", buffer: Buffer.concat([png, Buffer.from(stamp + name)]) }, alt: name },
			failOnStatusCode: false,
		});
		const body = (await response.json()) as { data?: { id: string }; error?: { message: string } };
		await api.dispose();
		expect(response.status(), `upload ${name}: ${body.error?.message ?? ""}`).toBeLessThan(300);
		return body.data!.id;
	};
	const theirs = await upload(editor, `cua-bien-tap-${stamp}.png`);
	const mine = await upload(author, `cua-tac-gia-${stamp}.png`);

	await signInOnPage(page, author.email, author.password);
	await page.goto("/quan-tri/media");
	await settled(page);

	await page.getByRole("button", { name: new RegExp(`cua-bien-tap-${stamp}`) }).first().click();
	const detail = page.getByRole("region", { name: "Chi tiết ảnh" });
	await expect(detail).toBeVisible();
	await expect(detail.getByText(/Địa chỉ|Sao chép/).first()).toBeVisible();
	await expect(detail.getByRole("button", { name: /Lưu|Cắt|Xóa/ })).toHaveCount(0);
	await expect(detail.getByLabel("Thay ảnh")).toHaveCount(0);
	await expect(detail.getByRole("form", { name: "Thông tin ảnh" })).toHaveCount(0);

	await page.getByRole("button", { name: new RegExp(`cua-tac-gia-${stamp}`) }).first().click();
	await expect(detail.getByRole("form", { name: "Thông tin ảnh" })).toBeVisible();
	await expect(detail.getByRole("button", { name: "Lưu" })).toBeVisible();
	await expect(detail.getByLabel("Thay ảnh")).toBeVisible();
	// the server agrees with the page
	const api = await AdminApi.signIn(baseURL!, author.email, author.password);
	expect((await api.call("PATCH", `media/${theirs}`, { alt: "x" })).status).toBe(403);
	expect((await api.call("PATCH", `media/${mine}`, { alt: "x" })).status).toBe(200);
	await api.dispose();
});
