import { describe, expect, it } from "vitest";
import { KINDS } from "@/admin/content/kinds";
import { mediaPath } from "@/admin/media/service";
import { parseSafe, safePictureSrc, sanitizeHtml, serialize } from "@/admin/content/html";

// Every picture lives on Cloudflare (R2, served at /anh-goc/): what an editor saves as a picture is a library item or an address under
// this site's own /anh-goc/ (or /brand/), never another host. What is already stored stays readable until its data is migrated.
const WP = "https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/08/a.jpg";
const B2 = "https://s2-cnv03.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/08-tu-an-book/bia.webp";

describe("safePictureSrc", () => {
	it("keeps the site's own paths and the public host written in front of them", () => {
		expect(safePictureSrc("/anh-goc/s2-cnv03/cms/m1/v1/sen.webp")).toBe("/anh-goc/s2-cnv03/cms/m1/v1/sen.webp");
		expect(safePictureSrc("/brand/logo.png")).toBe("/brand/logo.png");
		expect(safePictureSrc("https://www.tunglamhoaphuc.com/anh-goc/s2-cnv03/a/b.jpg")).toBe("/anh-goc/s2-cnv03/a/b.jpg");
		expect(safePictureSrc("https://tunglamhoaphuc.com/anh-goc/wordpress/2026/08/a.jpg?x=1")).toBe("/anh-goc/wordpress/2026/08/a.jpg");
		expect(safePictureSrc("https://quantri.tunglamhoaphuc.com/anh-goc/s2-cnv03/a.jpg")).toBe("/anh-goc/s2-cnv03/a.jpg");
	});

	it("maps the old WordPress and B2 addresses that /anh-goc/ reads with certainty", () => {
		expect(safePictureSrc(WP)).toBe("/anh-goc/wordpress/2026/08/a.jpg");
		expect(safePictureSrc(B2)).toBe("/anh-goc/s2-cnv03/tunglamhoaphuc2/08-tu-an-book/bia.webp");
	});

	it("rejects every other host, and anything that is not an address of ours", () => {
		for (const value of [
			"https://example.com/a.jpg",
			"http://i.ytimg.com/vi/abc/hqdefault.jpg",
			"//cdn.example.com/a.jpg",
			"https://www.tunglamhoaphuc.com.evil.example/anh-goc/a.jpg",
			"https://user:pw@www.tunglamhoaphuc.com/anh-goc/a.jpg",
			"https://www.tunglamhoaphuc.com/wp-content/uploads/a.jpg",
			"https://www.tunglamhoaphuc.com/other/a.jpg",
			"https://media.ex-cdn.com/a.jpg",
			"/anh-goc/../etc/a.jpg",
			"//evil.example/anh-goc/a.jpg",
			"/images/a.jpg",
			"data:image/png;base64,AAAA",
			"javascript:alert(1)",
			"/anh-goc/a b.jpg",
			"",
		]) {
			expect(safePictureSrc(value), value).toBeNull();
		}
	});
});

describe("a picture in a body", () => {
	const external = '<figure><img src="https://example.com/x.jpg" alt="x"></figure><p>chữ</p>';

	it("is still read from any https host (old bodies keep drawing)", () => {
		expect(sanitizeHtml(external)).toContain('<img src="https://example.com/x.jpg"');
		expect(serialize(parseSafe(external))).toContain("example.com");
	});

	it("is dropped from a new save, and the save reports it", () => {
		const changes: string[] = [];
		const out = serialize(parseSafe(external, { strictMedia: true, changes }));
		expect(out).not.toContain("example.com");
		expect(out).toContain("<p>chữ</p>");
		expect(changes).toContain("img");
	});

	it("keeps the library's pictures and the site's own paths in a new save", () => {
		const own = '<figure><img src="/anh-goc/s2-cnv03/cms/m1/v1/sen.webp" alt="Sen" data-media-id="m1"></figure><img src="https://www.tunglamhoaphuc.com/anh-goc/s2-cnv03/a.jpg" alt="">';
		const changes: string[] = [];
		const out = serialize(parseSafe(own, { strictMedia: true, changes }));
		expect(out).toContain('src="/anh-goc/s2-cnv03/cms/m1/v1/sen.webp"');
		expect(out).toContain('<img src="/anh-goc/s2-cnv03/a.jpg"');
		expect(changes).toEqual([]);
	});

	it("takes a library picture's current address whatever src the editor sent", () => {
		const out = sanitizeHtml('<img src="https://example.com/x.jpg" data-media-id="m1" alt="">', { strictMedia: true, mediaSrc: new Map([["m1", "/anh-goc/s2-cnv03/cms/m1/v2/sen.webp"]]) });
		expect(out).toContain('src="/anh-goc/s2-cnv03/cms/m1/v2/sen.webp"');
	});

	it("turns an old WordPress picture of the body into its /anh-goc/ path rather than losing it", () => {
		expect(sanitizeHtml(`<img src="${WP}" alt="">`, { strictMedia: true })).toContain('src="/anh-goc/wordpress/2026/08/a.jpg"');
	});
});

describe("the book cover of an article or page", () => {
	const book = (cover: string | null) => {
		const spec = KINDS.pages.fields.find((field) => field.key === "book");
		return (spec as unknown as { schema: { safeParse(value: unknown): { success: boolean; data?: { cover: string | null }; error?: { issues: { message: string }[] } } } }).schema.safeParse({ title: "T", author: "A", cover, description: "" });
	};

	it("takes a library address and saves it as the site's path", () => {
		expect(book("/anh-goc/s2-cnv03/cms/m1/v1/bia.webp").data?.cover).toBe("/anh-goc/s2-cnv03/cms/m1/v1/bia.webp");
		expect(book("https://www.tunglamhoaphuc.com/anh-goc/s2-cnv03/bia.webp").data?.cover).toBe("/anh-goc/s2-cnv03/bia.webp");
		expect(book(B2).data?.cover).toBe("/anh-goc/s2-cnv03/tunglamhoaphuc2/08-tu-an-book/bia.webp");
		expect(book(null).data?.cover).toBeNull();
		expect(book("").data?.cover).toBe("");
	});

	it("refuses another host with a Vietnamese message", () => {
		const result = book("https://example.com/bia.jpg");
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toMatch(/thư viện/);
	});
});

describe("mediaPath", () => {
	it("gives the admin the /anh-goc/ path of a picture that is still held by its old WordPress or B2 address", () => {
		expect(mediaPath("cms/m1/v1/a.webp", null)).toBe("/anh-goc/s2-cnv03/cms/m1/v1/a.webp");
		expect(mediaPath(null, WP)).toBe("/anh-goc/wordpress/2026/08/a.jpg");
		expect(mediaPath(null, B2)).toBe("/anh-goc/s2-cnv03/tunglamhoaphuc2/08-tu-an-book/bia.webp");
		expect(mediaPath(null, null)).toBe("");
		// a host that cannot be mapped is left as it is (the CSP shows nothing for it; the migration decides what to do with it)
		expect(mediaPath(null, "https://image.tienphong.vn/a.jpg")).toBe("https://image.tienphong.vn/a.jpg");
	});
});
