import { describe, expect, it } from "vitest";
// @ts-expect-error a plain .mjs script, no types
import { checkDeployEnv } from "../../scripts/deploy-env.mjs";

type Result = { errors: string[]; warnings: string[]; adminBaseUrl: string | null };
const check = (env: Record<string, string>) => checkDeployEnv(env) as Result;

describe("npm run deploy:v2 environment", () => {
	it("accepts the admin on quantri.", () => {
		const out = check({ TLHP_ADMIN: "1", ADMIN_BASE_URL: "https://quantri.tunglamhoaphuc.com" });
		expect(out.errors).toEqual([]);
		expect(out.warnings).toEqual([]);
		expect(out.adminBaseUrl).toBe("https://quantri.tunglamhoaphuc.com");
	});

	it("stops a deploy of the admin that does not say where it answers", () => {
		for (const env of [{ TLHP_ADMIN: "1" }, { TLHP_ADMIN: "1", ADMIN_BASE_URL: "  " }]) expect(check(env).errors[0]).toMatch(/Thiếu ADMIN_BASE_URL/);
	});

	it.each(["http://quantri.tunglamhoaphuc.com", "https://localhost:3001", "http://localhost:3001", "https://quantri.tunglamhoaphuc.com/quan-tri", "https://quantri.tunglamhoaphuc.com/?a=1", "quantri.tunglamhoaphuc.com"])(
		"stops %s",
		(url) => expect(check({ TLHP_ADMIN: "1", ADMIN_BASE_URL: url }).errors.length).toBeGreaterThan(0),
	);

	it("lets a deploy through while www is still served by this Worker, with a warning", () => {
		const out = check({ TLHP_ADMIN: "1", ADMIN_BASE_URL: "https://www.tunglamhoaphuc.com" });
		expect(out.errors).toEqual([]);
		expect(out.warnings[0]).toMatch(/quantri/);
	});

	it("warns, and does not stop, a build without the admin", () => {
		const out = check({});
		expect(out.errors).toEqual([]);
		expect(out.warnings[0]).toMatch(/TLHP_ADMIN/);
	});
});
