import { expect, test } from "@playwright/test";
import { signInOnPage, superAdminApi, superAdminLogin } from "./helpers";

// The admin's Content-Security-Policy (next.config.js): it is sent on every page, and no screen of the admin — the sign-in page, the
// lists, the rich editor, the picture library — runs into it. A violation here means the policy is too tight for something the admin
// really loads, which would show up for people as a screen that half works.
test.skip(({ isMobile }) => isMobile, "the admin flows are checked on the desktop project");
test.setTimeout(300_000);

const PAGES = ["/quan-tri", "/quan-tri/bai-viet", "/quan-tri/bai-viet/moi", "/quan-tri/tong-chi/moi", "/quan-tri/media", "/quan-tri/menu", "/quan-tri/trang-chu", "/quan-tri/lich-tu-hoc/moi", "/quan-tri/sao-luu", "/quan-tri/nhat-ky"];

test("the admin sends a Content-Security-Policy and nothing on its screens breaks it", async ({ page, baseURL }) => {
	await superAdminApi(baseURL!); // changes the seeded one-time password, as the other admin specs do
	const violations: string[] = [];
	await page.exposeFunction("tlhpViolation", (text: string) => violations.push(text));
	await page.addInitScript(() => {
		document.addEventListener("securitypolicyviolation", (event) => {
			(window as unknown as { tlhpViolation: (text: string) => void }).tlhpViolation(`${event.violatedDirective} blocked ${event.blockedURI} on ${location.pathname}`);
		});
	});
	page.on("console", (message) => {
		if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(`console: ${message.text()}`);
	});

	// the sign-in page is covered too
	const login = await page.goto("/quan-tri/dang-nhap");
	const policy = login?.headers()["content-security-policy"] ?? "";
	expect(policy, "the sign-in page carries the policy").toContain("default-src 'self'");
	expect(policy).toContain("connect-src 'self'");
	expect(policy).toContain("object-src 'none'");

	const account = superAdminLogin();
	await signInOnPage(page, account.email, account.password);
	for (const path of PAGES) {
		const response = await page.goto(path);
		expect(response?.status(), path).toBeLessThan(400);
		expect(response?.headers()["content-security-policy"], path).toContain("frame-ancestors 'none'");
		await page.waitForLoadState("networkidle");
	}
	// `vite dev` runs its modules through eval(); the built Worker has none, so only that one kind is let go here.
	const real = violations.filter((text) => !/blocked eval/.test(text) && !/unsafe-eval/.test(text));
	expect(real, "no screen of the admin is blocked by its own policy").toEqual([]);
});
