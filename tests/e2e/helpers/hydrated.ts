import type { Page } from "@playwright/test";

/**
 * Waits until React has attached to the page (the header's menu button carries its props).
 * On the dev server the modules load one by one and hydration can come 1–4 s after `load`;
 * a fixed wait then clicks before the handlers exist and the click does a plain page load.
 */
export async function waitHydrated(page: Page, timeout = 20_000): Promise<void> {
	await page.waitForFunction(
		() => {
			const button = document.querySelector("button.tlhp-menu-toggle, button.menu_bar");
			return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
		},
		undefined,
		{ timeout },
	);
}
