import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.js";

describe("next.config headers", () => {
	it("keeps every page out of search engines while the site is a preview", async () => {
		const rules = (await nextConfig.headers?.()) ?? [];
		const catchAll = rules.find((rule: { source: string }) => rule.source === "/:path*");
		expect(catchAll?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
	});
});
