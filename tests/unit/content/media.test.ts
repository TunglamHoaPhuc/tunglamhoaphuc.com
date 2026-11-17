import { describe, expect, it } from "vitest";
import { albumImageAt, b2Source, imageAt, imageSrcSet, mediaSource, mediaUrl, topImagePriority } from "@/libs/content/media";

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
