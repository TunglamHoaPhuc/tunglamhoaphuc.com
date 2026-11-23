import { describe, expect, it } from "vitest";
import { safeBookLink } from "@/components/sections/posts/PostExtras";

describe("safeBookLink", () => {
	it("keeps the site's own addresses and web addresses, and marks the web ones as outside", () => {
		expect(safeBookLink("/tri-tue-phat-phap/sach")).toEqual({ href: "/tri-tue-phat-phap/sach", external: false });
		expect(safeBookLink(" https://example.test/mua ")).toEqual({ href: "https://example.test/mua", external: true });
		expect(safeBookLink("http://example.test/mua")?.external).toBe(true);
	});

	it("drops anything that could run code or leave the site by a trick", () => {
		for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "//evil.example/x", "mailto:a@b.c", "/\\evil.example", "/\t/evil.example", "/ok /x", "https://a.test/x y", "", "   ", null]) {
			expect(safeBookLink(bad), String(bad)).toBeNull();
		}
	});
});
