import { describe, expect, it } from "vitest";
import { albumImageAt, b2Source, imageAt, topImagePriority } from "@/libs/content/media";

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

	it("transforms WordPress uploads in place, the host being on the zone", () => {
		expect(imageAt(WP, 640)).toBe(`/cdn-cgi/image/${OPTIONS}/${WP}`);
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

describe("albumImageAt", () => {
	it("transforms only WordPress uploads: the B2 album pictures were already made small", () => {
		expect(albumImageAt(WP, 640)).toBe(`/cdn-cgi/image/${OPTIONS}/${WP}`);
		const b2 = `https://s2-cnv03.s3.us-east-005.backblazeb2.com/${B2_KEY}`;
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
		expect(topImagePriority("https://img2.infonet.vn/w490/a.jpg")).toBe("low");
	});
});
