// G1: every admin page has a permission in one table (src/components/admin/pagePermissions.ts), the table matches the pages that
// exist, and it agrees with the menu and with the permission catalogue.
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { isKnownPermission } from "@/admin/rbac/catalog";
import { NAV } from "@/components/admin/nav";
import { PAGE_NEEDS, pageNeedFor } from "@/components/admin/pagePermissions";

const ROOT = join(process.cwd(), "src", "app", "quan-tri", "(khung)");

/** Page paths of the directory tree under (khung): "" for the start page, "bai-viet/[id]" for a dynamic one. */
function pagesOnDisk(dir = ROOT, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) pagesOnDisk(full, out);
		else if (name === "page.tsx") out.push(relative(ROOT, dir).split(sep).join("/"));
	}
	return out;
}

describe("page permissions (G1)", () => {
	it("has an entry for every page directory under (khung), and none for a page that does not exist", () => {
		const onDisk = pagesOnDisk().sort();
		expect(onDisk.length).toBeGreaterThan(30);
		expect(Object.keys(PAGE_NEEDS).sort()).toEqual(onDisk);
	});

	it("only names permissions that exist", () => {
		for (const [page, need] of Object.entries(PAGE_NEEDS)) if (need) expect(isKnownPermission(need[0], need[1]), `${page}: ${need.join(".")}`).toBe(true);
	});

	it("agrees with the menu: a link and its page ask for the same permission", () => {
		for (const group of NAV)
			for (const item of group.items) {
				const page = item.href.replace(/^\/quan-tri\/?/, "");
				const found = pageNeedFor(item.href);
				expect(found.known, item.href).toBe(true);
				expect(found.known ? found.need : "x", item.href).toEqual(item.needs ?? null);
				expect(page in PAGE_NEEDS, item.href).toBe(true);
			}
	});

	it("a page that makes something needs create, the others in its module need view", () => {
		for (const [page, need] of Object.entries(PAGE_NEEDS)) {
			if (page.endsWith("/moi")) expect(need?.[1], page).toBe("create");
			else if (need) expect(need[1], page).toBe("view");
		}
	});

	it("finds the page of an address, a literal segment beating [id]", () => {
		expect(pageNeedFor("/quan-tri/bai-viet/moi")).toMatchObject({ known: true, need: ["posts", "create"] });
		expect(pageNeedFor("/quan-tri/bai-viet/post-123")).toMatchObject({ known: true, need: ["posts", "view"] });
		expect(pageNeedFor("/quan-tri/bai-viet/post-123/")).toMatchObject({ known: true, need: ["posts", "view"] });
		expect(pageNeedFor("/quan-tri/lich-tu-hoc/chu-de")).toMatchObject({ known: true, need: ["events", "view"] });
		expect(pageNeedFor("/quan-tri/lich-tu-hoc/event-1?x=1")).toMatchObject({ known: true, need: ["events", "view"] });
		expect(pageNeedFor("/quan-tri/vai-tro/moi")).toMatchObject({ known: true, need: ["roles", "create"] });
		expect(pageNeedFor("/quan-tri/tai-khoan/moi")).toMatchObject({ known: true, need: ["users", "create"] });
		expect(pageNeedFor("/quan-tri/sao-luu")).toMatchObject({ known: true, need: ["backup", "view"] });
		expect(pageNeedFor("/quan-tri")).toMatchObject({ known: true, need: null });
		expect(pageNeedFor("/quan-tri/ho-so")).toMatchObject({ known: true, need: null });
		expect(pageNeedFor("/quan-tri/khong-co-trang-nay")).toEqual({ known: false });
		expect(pageNeedFor("/quan-tri/seo/a/b")).toEqual({ known: false });
	});
});
