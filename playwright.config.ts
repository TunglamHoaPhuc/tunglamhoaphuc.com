import { defineConfig, devices } from "@playwright/test";

// BASE_URL points the suite at a deployed copy (e.g. https://v2.tunglamhoaphuc.com);
// otherwise it runs against the locally built Worker (`npm run build` first).
const baseURL = process.env.BASE_URL ?? "http://localhost:4173";

// The home page's welcome notice (a modal <dialog>) opens a second after the first visit and
// makes the page behind it inert. Every test starts as a visitor who has already closed it;
// tests/e2e/welcome-notice.spec.ts starts without this to check the notice itself.
const welcomeNoticeSeen = {
	cookies: [],
	origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "tlhp_welcome_notice_v1_0", value: "seen" }] }],
};

export default defineConfig({
	testDir: "tests/e2e",
	// The admin specs need a server with the admin on and a prepared local database (see tests/e2e/admin/helpers.ts), which CI does not have: set ADMIN_E2E=1 to run them.
	testIgnore: process.env.ADMIN_E2E ? [] : ["**/admin/**"],
	use: { baseURL, storageState: welcomeNoticeSeen },
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],
	webServer: process.env.BASE_URL
		? undefined
		: {
				command: "npm run preview -- --config vite.e2e.config.ts --port 4173 --strictPort",
				url: baseURL,
				reuseExistingServer: true,
				timeout: 120_000,
			},
});
