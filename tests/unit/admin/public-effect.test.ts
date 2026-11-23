import { describe, expect, it } from "vitest";
import { affectsPublicSite } from "../../../src/admin/http/publicEffect";

describe("which admin writes drop the public pages' cache", () => {
	it("does for a write to anything a public page shows", () => {
		for (const [method, path] of [
			["POST", "posts/abc/publish"],
			["PATCH", "posts/abc"],
			["DELETE", "posts/abc"],
			["POST", "teachings/abc/publish"],
			["PUT", "home/hero"],
			["PUT", "menus/main"],
			["POST", "media/abc/replace"],
			["DELETE", "media/abc"],
			["PATCH", "media/abc"],
			["POST", "trash/post/abc/restore"],
			["PUT", "settings/site"],
			["POST", "redirects"],
		]) {
			expect(affectsPublicSite(method, path), `${method} ${path}`).toBe(true);
		}
	});

	it("does not for a read, nor for what the public never sees (sign-in, accounts, roles, backup, log)", () => {
		for (const [method, path] of [
			["GET", "posts"],
			["GET", "posts/abc"],
			["HEAD", "posts/abc"],
			["POST", "auth/login"],
			["PATCH", "me/password"],
			["POST", "users"],
			["PUT", "roles/abc"],
			["POST", "backup/run"],
			["GET", "audit"],
			["POST", "dashboard"],
			// a draft, a preview link and a copy show nothing on the site
			["POST", "posts"],
			["POST", "teachings"],
			["POST", "posts/abc/preview-token"],
			["POST", "pages/abc/duplicate"],
			// writes that show nothing on the site
			["POST", "media"],
			["POST", "media/folders"],
			["POST", "settings/smtp/test"],
			["POST", "icons/sanitize-svg"],
			["POST", ""],
		]) {
			expect(affectsPublicSite(method, path), `${method} ${path}`).toBe(false);
		}
	});
});
