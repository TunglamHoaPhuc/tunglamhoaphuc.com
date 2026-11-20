import { describe, expect, it } from "vitest";
import { GET } from "@/app/cdn-cgi/image/[...rest]/route";
import { shapeAnalysis } from "@/libs/tibetan/api";

const ask = (path: string) => GET(new Request(`https://www.tunglamhoaphuc.com${path}`));

describe("/cdn-cgi/image fallback route", () => {
	it("sends a site path to the same site", async () => {
		const response = await ask("/cdn-cgi/image/width=640/images/hero/a.webp");
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://www.tunglamhoaphuc.com/images/hero/a.webp");
	});

	it("never leaves the site through a doubled slash", async () => {
		for (const path of ["/cdn-cgi/image/w=1//evil.example/x", "/cdn-cgi/image/w=1///evil.example/x"]) {
			const response = await ask(path);
			const location = response.headers.get("location");
			expect(location === null || new URL(location).origin === "https://www.tunglamhoaphuc.com").toBe(true);
		}
	});

	it("only follows the WordPress host for a full address", async () => {
		expect((await ask("/cdn-cgi/image/w=1/https://evil.example/x.jpg")).status).toBe(404);
		expect((await ask("/cdn-cgi/image/w=1/https://admin.tunglamhoaphuc.com/a.jpg")).status).toBe(302);
	});
});

describe("shapeAnalysis status", () => {
	it("is a fallback for an empty JSON answer, so it is not cached for a month", () => {
		expect(shapeAnalysis("བཀྲ", {}).status).toBe("fallback");
	});

	it("is a success when the model gave a translation", () => {
		expect(shapeAnalysis("བཀྲ", { full_translation: "may mắn" }).status).toBe("success");
	});
});
