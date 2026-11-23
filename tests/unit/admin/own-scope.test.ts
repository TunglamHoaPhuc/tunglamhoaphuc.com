// G2-G5: what the screens offer follows the scope of the person's rights ("own" or "all") and the catalogue's OWNABLE set.
import { describe, expect, it } from "vitest";
import { isOwnable } from "@/admin/rbac/catalog";
import { normalizePermissions } from "@/components/admin/PermissionMatrix";
import { canOn, mayGrant, scopeOf } from "@/components/admin/ownScope";

const AUTHOR = ["media.view", "media.create", "media.update:own", "posts.update:own", "posts.delete:own", "posts.view", "trash.view:own"];
const EDITOR = ["media.view", "media.create", "media.update", "media.delete", "posts.update", "posts.publish"];

describe("scope of a right", () => {
	it("tells all, own and none apart", () => {
		expect(scopeOf(AUTHOR, "media", "update")).toBe("own");
		expect(scopeOf(AUTHOR, "media", "delete")).toBeNull();
		expect(scopeOf(EDITOR, "media", "update")).toBe("all");
		expect(scopeOf(["media.update:own", "media.update"], "media", "update")).toBe("all");
	});
});

describe("a picture of someone else (G2)", () => {
	it("with scope own only the person's own uploads can be changed or deleted", () => {
		expect(canOn(AUTHOR, "me", "media", "update", "me")).toBe(true);
		expect(canOn(AUTHOR, "me", "media", "update", "someone-else")).toBe(false);
		expect(canOn(AUTHOR, "me", "media", "update", null)).toBe(false);
		expect(canOn(AUTHOR, "me", "media", "delete", "me")).toBe(false);
	});
	it("with scope all every picture can", () => {
		expect(canOn(EDITOR, "me", "media", "update", "someone-else")).toBe(true);
		expect(canOn(EDITOR, "me", "media", "delete", null)).toBe(true);
	});
});

describe("role editor (G4)", () => {
	it("offers 'Của mình' only for the pairs the catalogue says handlers honour", () => {
		expect(isOwnable("posts", "update")).toBe(true);
		expect(isOwnable("media", "delete")).toBe(true);
		expect(isOwnable("trash", "view")).toBe(true);
		expect(isOwnable("posts", "view")).toBe(false);
		expect(isOwnable("users", "view")).toBe(false);
		expect(isOwnable("media", "create")).toBe(false);
	});
	it("a caller who holds only 'của mình' cannot hand out 'Tất cả'", () => {
		expect(mayGrant(AUTHOR, "posts", "update", "all")).toBe(false);
		expect(mayGrant(AUTHOR, "posts", "update", "own")).toBe(true);
		expect(mayGrant(AUTHOR, "posts", "publish", "own")).toBe(false);
		expect(mayGrant(EDITOR, "posts", "update", "all")).toBe(true);
		expect(mayGrant(EDITOR, "posts", "update", "own")).toBe(true);
	});
	it("an 'own' entry on a right without that scope is dropped, never promoted to 'all'", () => {
		expect(normalizePermissions(["users.view:own", "posts.update:own", "posts.view"])).toEqual(["posts.update:own", "posts.view"]);
		expect(normalizePermissions(["posts.update:own", "posts.update"])).toEqual(["posts.update"]);
		expect(normalizePermissions(["media.update:own", "media.update:own"])).toEqual(["media.update:own"]);
	});
});
