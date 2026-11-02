import { defineConfig, devices } from "@playwright/test";

// BASE_URL points the suite at a deployed copy (e.g. https://v2.tunglamhoaphuc.com);
// otherwise it runs against the locally built Worker (`npm run build` first).
const baseURL = process.env.BASE_URL ?? "http://localhost:4173";

export default defineConfig({
	testDir: "tests/e2e",
	use: { baseURL },
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 7"] } },
	],
	webServer: process.env.BASE_URL
		? undefined
		: {
				command: "npm run preview -- --port 4173 --strictPort",
				url: baseURL,
				reuseExistingServer: true,
				timeout: 120_000,
			},
});
