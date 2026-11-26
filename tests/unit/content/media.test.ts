import { describe, expect, it } from "vitest";
import { albumImageAt as albumImageAtIn, b2Source, imageAt as imageAtIn, imageSrcSet as imageSrcSetIn, legacyPicturePath, mediaSource, mediaUrl, storedMediaAddress, topImagePriority } from "@/libs/content/media";

// These tests are about the /cdn-cgi/image pipeline; the variant delivery (the default since 23/11/2026) is covered by mediaVariants.test.ts.
const imageAt = (src: string, width: number) => imageAtIn(src, width, "cgi");
const imageSrcSet = (src: string, widths: readonly number[]) => imageSrcSetIn(src, widths, null, "cgi");
const albumImageAt = (src: string, width: number) => albumImageAtIn(src, width, "cgi");

// Pictures of the old site go through Cloudflare's image transformations on this zone. B2
// files come in through /anh-goc/ so the source is on the zone too (the zone accepts only
// its own sources) and onerror=redirect can fall back to the original past the free quota.
const OPTIONS = "width=640,quality=75,format=auto,onerror=redirect";
const B2_KEY = "tunglamhoaphuc2/03-dong-chay-hoang-phap/dai-le-su-kien/2-2-scaled.jpg";
const WP = "https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/45-1.jpg";

describe("imageAt", () => {
	it("sends B2 files of either bucket through /anh-goc/", () => {
		expect(imageAt(`https://s2-cnv03.s3.us-east-005.backblazeb2.com/${B2_KEY}`, 640)).toBe(`/cdn-cgi/image/${OPTIONS}/anh-goc/s2-cnv03/${B2_KEY}`);
		expect(imageAt("https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp", 1280)).toBe(
			"/cdn-cgi/image/width=1280,quality=75,format=auto,onerror=redirect/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp",
		);
	});

	it("sends WordPress uploads through /anh-goc/wordpress/ too, so the transformation reads them from R2", () => {
		expect(imageAt(WP, 640)).toBe(`/cdn-cgi/image/${OPTIONS}/anh-goc/wordpress/2026/09/45-1.jpg`);
	});

	it("transforms the /anh-goc/ addresses mediaUrl() gives", () => {
		expect(imageAt(mediaUrl(WP)!, 640)).toBe(`/cdn-cgi/image/${OPTIONS}/anh-goc/wordpress/2026/09/45-1.jpg`);
		expect(imageAt(`/anh-goc/s2-cnv03/${B2_KEY}`, 640)).toBe(`/cdn-cgi/image/${OPTIONS}/anh-goc/s2-cnv03/${B2_KEY}`);
	});

	it("keeps the site's own pictures and other hosts as they are", () => {
		expect(imageAt("/images/hero/toan-canh-chua-1920.webp", 640)).toBe("/images/hero/toan-canh-chua-1920.webp");
		const elsewhere = "https://img2.infonet.vn/w490/Uploaded/2026/a.jpg";
		expect(imageAt(elsewhere, 640)).toBe(elsewhere);
		expect(imageAt("https://static.xx.fbcdn.net/images/emoji.php/v9/t4c/1/16/1f64f.png", 640)).toBe(
			"https://static.xx.fbcdn.net/images/emoji.php/v9/t4c/1/16/1f64f.png",
		);
	});
});

describe("imageSrcSet", () => {
	it("lists a transformed picture at each width, and nothing for pictures that are not transformed", () => {
		expect(imageSrcSet(WP, [320, 640])).toBe(`${imageAt(WP, 320)} 320w, ${imageAt(WP, 640)} 640w`);
		expect(imageSrcSet("/images/hero/toan-canh-chua-1920.webp", [320, 640])).toBeUndefined();
		expect(imageSrcSet("https://img2.infonet.vn/a.jpg", [320, 640])).toBeUndefined();
	});
});

describe("albumImageAt", () => {
	it("transforms only WordPress uploads: the B2 album pictures were already made small", () => {
		expect(albumImageAt(WP, 640)).toBe(`/cdn-cgi/image/${OPTIONS}/anh-goc/wordpress/2026/09/45-1.jpg`);
		expect(albumImageAt(mediaUrl(WP)!, 640)).toBe(`/cdn-cgi/image/${OPTIONS}/anh-goc/wordpress/2026/09/45-1.jpg`);
		const b2 = `/anh-goc/s2-cnv03/${B2_KEY}`;
		expect(albumImageAt(b2, 640)).toBe(b2);
	});
});

describe("b2Source", () => {
	it("reads only the two buckets of the old admin", () => {
		expect(b2Source("s2-cnv03", B2_KEY.split("/"))).toBe(`https://s2-cnv03.s3.us-east-005.backblazeb2.com/${B2_KEY}`);
		expect(b2Source("media-tunglamhoaphuc", ["a b", "ảnh.webp"])).toBe(
			"https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/a%20b/%E1%BA%A3nh.webp",
		);
		expect(b2Source("someone-else", ["a.jpg"])).toBeNull();
	});

	it("refuses keys that climb out or are empty", () => {
		for (const key of [[], [""], ["..", "a.jpg"], ["a", ".", "b.jpg"]]) expect(b2Source("s2-cnv03", key)).toBeNull();
	});
});

describe("topImagePriority", () => {
	it("lets only the site's own pictures go first: a transformed one falls back to the original past the quota", () => {
		expect(topImagePriority("/images/hero/toan-canh-chua-1920.webp")).toBe("high");
		expect(topImagePriority(imageAt(WP, 1280))).toBe("low");
		expect(topImagePriority("/anh-goc/s2-cnv03/a.jpg")).toBe("low");
		expect(topImagePriority("https://img2.infonet.vn/w490/a.jpg")).toBe("low");
	});
});

describe("mediaUrl", () => {
	it("never gives a browser a B2 or WordPress address for a picture", () => {
		expect(mediaUrl(`https://s2-cnv03.s3.us-east-005.backblazeb2.com/${B2_KEY}`)).toBe(`/anh-goc/s2-cnv03/${B2_KEY}`);
		expect(mediaUrl(`https://b1.congngheviet.com.vn/file/s2-cnv03/${B2_KEY}`)).toBe(`/anh-goc/s2-cnv03/${B2_KEY}`);
		expect(mediaUrl("https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/a/b.webp")).toBe("/anh-goc/media-tunglamhoaphuc/a/b.webp");
		expect(mediaUrl(WP)).toBe("/anh-goc/wordpress/2026/09/45-1.jpg");
		expect(mediaUrl("https://tunglamhoaphuc.com/wp-content/uploads/2026/09/45-1.jpg")).toBe("/anh-goc/wordpress/2026/09/45-1.jpg");
	});

	it("leaves files that are not pictures on their original address", () => {
		expect(mediaUrl("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/a.mp3")).toBe("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/a.mp3");
		expect(mediaUrl("https://s2-cnv03.s3.us-east-005.backblazeb2.com/a/b.pdf")).toBe("https://s2-cnv03.s3.us-east-005.backblazeb2.com/a/b.pdf");
	});
});

describe("mediaSource", () => {
	it("names the R2 key and the original to fall back to", () => {
		expect(mediaSource("s2-cnv03", ["a", "b.jpg"])).toEqual({ r2Key: "s2-cnv03/a/b.jpg", origin: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/a/b.jpg" });
		expect(mediaSource("wordpress", ["2026", "09", "a b.jpg"])).toEqual({
			r2Key: "wordpress/2026/09/a b.jpg",
			origin: "https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/a%20b.jpg",
		});
	});

	it("refuses other buckets, odd keys and files that are not pictures", () => {
		expect(mediaSource("someone-else", ["a.jpg"])).toBeNull();
		expect(mediaSource("s2-cnv03", ["..", "a.jpg"])).toBeNull();
		expect(mediaSource("wordpress", ["2019", "05", "1..jpg", ".."])).toBeNull();
		expect(mediaSource("s2-cnv03", [])).toBeNull();
		expect(mediaSource("s2-cnv03", ["a.pdf"])).toBeNull();
	});
});

// Absolute addresses of the old hosts that /anh-goc/ reads with certainty come out as that path; the rest keep their address.
describe("legacy picture addresses", () => {
	it("maps the old WordPress host old. and this site's own host to /anh-goc/", () => {
		expect(mediaUrl("https://old.tunglamhoaphuc.com/wp-content/uploads/2018/07/K49A0733-568x379.jpg")).toBe("/anh-goc/wordpress/2018/07/K49A0733-568x379.jpg");
		expect(mediaUrl("https://www.tunglamhoaphuc.com/anh-goc/s2-cnv03/a/b.jpg")).toBe("/anh-goc/s2-cnv03/a/b.jpg");
		expect(mediaUrl("https://quantri.tunglamhoaphuc.com/anh-goc/wordpress/2026/08/a.jpg")).toBe("/anh-goc/wordpress/2026/08/a.jpg");
		expect(mediaUrl("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/45-1.jpg")).toBe("/anh-goc/wordpress/2026/09/45-1.jpg");
	});

	it("maps Backblaze's path-style and friendly addresses of either bucket", () => {
		expect(legacyPicturePath("https://f005.backblazeb2.com/file/media-tunglamhoaphuc/tunglamhoaphuc2/x/a.webp")).toBe("/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/x/a.webp");
		expect(mediaUrl("https://b1.congngheviet.com.vn/file/s2-cnv03/tunglamhoaphuc2/x/a.jpg")).toBe("/anh-goc/s2-cnv03/tunglamhoaphuc2/x/a.jpg");
		expect(mediaUrl("https://s3.us-east-005.backblazeb2.com/media-tunglamhoaphuc/tunglamhoaphuc2/x/a.jpg")).toBe("/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/x/a.jpg");
		expect(mediaUrl("https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/x/a.jpg")).toBe("/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/x/a.jpg");
	});

	it("does not guess: another bucket, a file that is not a picture, another host and strange keys keep what they were", () => {
		expect(legacyPicturePath("https://f005.backblazeb2.com/file/someone-else/a.jpg")).toBeNull();
		expect(legacyPicturePath("https://f005.backblazeb2.com/file/media-tunglamhoaphuc/a.mp3")).toBeNull();
		expect(legacyPicturePath("https://old.tunglamhoaphuc.com/wp-content/uploads/2026/08/a.mp3")).toBeNull();
		expect(legacyPicturePath("https://example.com/anh-goc/s2-cnv03/a.jpg")).toBeNull();
		expect(legacyPicturePath("https://s3.us-east-005.backblazeb2.com/media-tunglamhoaphuc/")).toBeNull();
		expect(legacyPicturePath("https://user:pw@www.tunglamhoaphuc.com/anh-goc/s2-cnv03/a.jpg")).toBeNull();
		expect(legacyPicturePath("/anh-goc/s2-cnv03/a.jpg")).toBeNull();
		expect(legacyPicturePath("")).toBeNull();
		expect(mediaUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
		expect(mediaUrl("https://old.tunglamhoaphuc.com/wp-content/uploads/2026/08/a.mp3")).toBe("https://old.tunglamhoaphuc.com/wp-content/uploads/2026/08/a.mp3");
	});

	it("leaves a media row's id alone: the stored address of these forms is the one the import used", () => {
		for (const address of ["https://old.tunglamhoaphuc.com/wp-content/uploads/2018/07/a.jpg", "https://f005.backblazeb2.com/file/media-tunglamhoaphuc/x/a.webp", "https://www.tunglamhoaphuc.com/anh-goc/s2-cnv03/a.jpg"]) {
			expect(storedMediaAddress(address), address).toBe(address);
		}
		// the forms that always mapped still do
		expect(storedMediaAddress("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/45-1.jpg")).toBe("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/45-1.jpg");
		expect(storedMediaAddress("https://b1.congngheviet.com.vn/file/s2-cnv03/x/a.jpg")).toBe("https://s2-cnv03.s3.us-east-005.backblazeb2.com/x/a.jpg");
	});
});
