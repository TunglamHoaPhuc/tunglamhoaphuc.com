import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KIND_UI } from "@/components/admin/content/types";
import { PREVIEW_SITE_MAY_DIFFER } from "@/components/admin/content/previewNote";
import { PUBLIC_SITE_URL, publicSiteUrl } from "@/config/site";
import { PUBLIC_ORIGIN } from "@/libs/seo";

describe("the address of the public site for the admin's links", () => {
	it("is one constant, the same the sitemap and the structured data use", () => {
		expect(PUBLIC_SITE_URL).toBe("https://www.tunglamhoaphuc.com");
		expect(PUBLIC_SITE_URL).toBe(PUBLIC_ORIGIN);
	});

	it("turns a public path into an absolute address, whatever way the path is written", () => {
		expect(publicSiteUrl("/gioi-thieu/dai-su")).toBe("https://www.tunglamhoaphuc.com/gioi-thieu/dai-su");
		expect(publicSiteUrl("tong-chi-tu-hoc/a")).toBe("https://www.tunglamhoaphuc.com/tong-chi-tu-hoc/a");
	});

	it("covers every kind of the editor: no 'Xem trên trang' link is left relative", () => {
		const item = { slug: "mot-bai", section: "dong-chay-hoang-phap" };
		const urls = Object.values(KIND_UI).map((ui) => publicSiteUrl(ui.publicPath(item)));
		expect(urls).toEqual([
			"https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/mot-bai",
			"https://www.tunglamhoaphuc.com/tong-chi-tu-hoc/mot-bai",
			"https://www.tunglamhoaphuc.com/gioi-thieu/mot-bai",
		]);
	});
});

// Every link of the admin that opens in a new tab goes to the public site, so it must be absolute: on quantri. a relative
// one would open this Worker's own, older public copy. The one other new tab is the draft preview, opened by script.
describe("links of the admin to the outside", () => {
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((name) => {
			const path = join(dir, name);
			return statSync(path).isDirectory() ? files(path) : /\.tsx$/.test(name) ? [path] : [];
		});

	it("never opens a relative public address in a new tab", () => {
		for (const file of [...files("src/components/admin"), ...files("src/app/quan-tri")]) {
			const source = readFileSync(file, "utf8");
			for (const tag of source.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) {
				expect(tag, file).toMatch(/href=\{publicHref\}|href="https:\/\//);
			}
			for (const tag of source.match(/<(?:a|Link)\b[^>]*href="\/(?!quan-tri)[^"]*"/g) ?? []) {
				throw new Error(`${file}: relative public link ${tag}`);
			}
		}
	});

	it("takes publicHref from publicSiteUrl", () => {
		const editor = readFileSync("src/components/admin/content/ContentEditor.tsx", "utf8");
		expect(editor).toMatch(/const publicHref = detail \? publicSiteUrl\(/);
	});
});

describe("the draft preview", () => {
	it("tells the editor in its bar that the final site may look different", () => {
		expect(PREVIEW_SITE_MAY_DIFFER).toMatch(/khác/);
		expect(PREVIEW_SITE_MAY_DIFFER.match(/\./g)).toHaveLength(1);
		const page = readFileSync("src/app/quan-tri/xem-truoc/[loai]/[id]/page.tsx", "utf8");
		expect(page).toContain("{note} {PREVIEW_SITE_MAY_DIFFER}");
	});
});
