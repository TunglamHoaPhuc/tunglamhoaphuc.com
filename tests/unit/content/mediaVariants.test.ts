import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { albumImageAt, hasVariants, IMAGE_DELIVERY, IMAGE_WIDTH, imageAt, imageSrcSet, parseVariantRequest, variantStep, variantUrl, VARIANT_WIDTHS } from "@/libs/content/media";
import { acceptedFormats, serveMedia, type MediaBucket, type MediaCache } from "@/libs/content/mediaRoute";

// 23/11/2026: ready-made AVIF/WebP variants in R2 ("<key>@<width>.<avif|webp>"), served by /anh-goc/<bucket>/<key>@<width>[.ext].
const B2_KEY = "tunglamhoaphuc2/03-dong-chay-hoang-phap/dai-le-su-kien/2-2-scaled.jpg";
const WP = "https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/45-1.jpg";
const AVIF_ACCEPT = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";
const WEBP_ACCEPT = "image/webp,image/apng,image/*,*/*;q=0.8";
const OLD_ACCEPT = "image/png,image/*;q=0.8,*/*;q=0.5";

describe("variantStep", () => {
	it("rounds up to the next standard width and sends anything past 1920 to max", () => {
		expect(variantStep(1)).toBe(160);
		expect(variantStep(160)).toBe(160);
		expect(variantStep(161)).toBe(360);
		expect(variantStep(500)).toBe(640);
		expect(variantStep(960)).toBe(960);
		expect(variantStep(1000)).toBe(1280);
		expect(variantStep(1920)).toBe(1920);
		expect(variantStep(1921)).toBe("max");
		expect(variantStep(99999)).toBe("max");
		expect(variantStep(Number.NaN)).toBe("max");
	});

	it("has the same widths as scripts/media-variants.mjs", () => {
		const script = readFileSync("scripts/media-variants.mjs", "utf8");
		const ladder = /const LADDER = \[([\d,\s]+)\]/.exec(script)?.[1].split(",").map((n) => Number(n.trim()));
		expect(ladder).toEqual([...VARIANT_WIDTHS]);
		expect(/const MAX_WIDTH = (\d+)/.exec(script)?.[1]).toBe("2560");
	});
});

describe("parseVariantRequest", () => {
	it("splits '<name>@<width>[.avif|.webp]' off the last part of the key", () => {
		expect(parseVariantRequest(["a", "b.jpg@640"])).toEqual({ base: ["a", "b.jpg"], step: 640, ext: null });
		expect(parseVariantRequest(["a", "b.jpg@640.webp"])).toEqual({ base: ["a", "b.jpg"], step: 640, ext: "webp" });
		expect(parseVariantRequest(["b.png@max.avif"])).toEqual({ base: ["b.png"], step: "max", ext: "avif" });
		expect(parseVariantRequest(["b.png@500"])).toEqual({ base: ["b.png"], step: 640, ext: null });
		expect(parseVariantRequest(["b.png@5000"])).toEqual({ base: ["b.png"], step: "max", ext: null });
		expect(parseVariantRequest(["a@b", "c.png@360"])).toEqual({ base: ["a@b", "c.png"], step: 360, ext: null });
	});

	it("leaves ordinary keys alone, also ones that have an @ in the name", () => {
		for (const key of [["a", "b.jpg"], ["logo@2x.png"], ["b.jpg@"], ["b.jpg@abc"], ["b.jpg@640.png"], ["@640"], []]) expect(parseVariantRequest(key), key.join("/")).toBeNull();
	});
});

describe("imageAt / fitting in both delivery modes", () => {
	const b2 = `https://s2-cnv03.s3.us-east-005.backblazeb2.com/${B2_KEY}`;

	it("'cgi' keeps today's /cdn-cgi/image/ address; the default is 'variants', for the pictures that have them", () => {
		const cgi = `/cdn-cgi/image/width=640,quality=75,format=auto,onerror=redirect/anh-goc/s2-cnv03/${B2_KEY}`;
		expect(imageAt(b2, 640, "cgi")).toBe(cgi);
		expect(IMAGE_DELIVERY).toBe("variants");
		expect(imageAt(b2, 640)).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@640`);
		// a picture outside the prefixes that have variants (old WordPress, small) goes as it is in 'variants' mode: no transformation quota
		const old = "/anh-goc/s2-cnv03/ngoai/2018/07/a-668x445.jpg";
		expect(hasVariants(old)).toBe(false);
		expect(imageAt(old, 640, "variants")).toBe(old);
		expect(imageSrcSet(old, [360, 640], null, "variants")).toBeUndefined();
		expect(albumImageAt(old, 640, "variants")).toBe(old);
		expect(hasVariants("/anh-goc/media-tunglamhoaphuc/x/a.webp")).toBe(true);
		expect(hasVariants("wordpress/2026/09/a.jpg")).toBe(true);
		expect(hasVariants("wordpress/2018/09/a.jpg")).toBe(false);
	});

	it("a picture uploaded in the admin (s2-cnv03/cms/) has the variants the browser made at upload, so it is delivered like the others", () => {
		const upload = "/anh-goc/s2-cnv03/cms/media-1/v1/le-hang-thuan.png";
		expect(hasVariants(upload)).toBe(true);
		expect(imageAt(upload, 640, "variants")).toBe(`${upload}@640`);
		expect(imageSrcSet(upload, [640, 960], null, "variants")).toContain(`${upload}@640 640w`);
		expect(albumImageAt(upload, 360, "variants")).toBe(`${upload}@360`);
		// an animated GIF has no variants, whatever its prefix
		expect(imageAt("/anh-goc/s2-cnv03/cms/media-2/v1/anim.gif", 640, "variants")).toBe("/anh-goc/s2-cnv03/cms/media-2/v1/anim.gif");
		// the 4,795 pictures of batch 2 (old WordPress uploads) have variants
		expect(hasVariants("s2-cnv03/tunglamhoaphuc-com/wp-content/uploads/2021/06/a-668x501.jpg")).toBe(true);
	});

	it("'variants' builds /anh-goc/<bucket>/<key>@<rounded width> (no extension: Accept decides)", () => {
		expect(imageAt(b2, 640, "variants")).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@640`);
		expect(imageAt(b2, 500, "variants")).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@640`);
		expect(imageAt(b2, IMAGE_WIDTH.icon, "variants")).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@160`);
		expect(imageAt(b2, IMAGE_WIDTH.mid, "variants")).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@960`);
		expect(imageAt(b2, IMAGE_WIDTH.full, "variants")).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@1920`);
		expect(imageAt(b2, 4000, "variants")).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@max`);
		expect(imageAt(WP, 360, "variants")).toBe("/anh-goc/wordpress/2026/09/45-1.jpg@360");
		expect(imageAt("/anh-goc/media-tunglamhoaphuc/x/a.webp", 1280, "variants")).toBe("/anh-goc/media-tunglamhoaphuc/x/a.webp@1280");
	});

	it("'variants' does not stack suffixes and leaves pictures without variants, the site's own files and other hosts alone", () => {
		expect(imageAt(`/anh-goc/s2-cnv03/${B2_KEY}@640`, 360, "variants")).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@360`);
		expect(imageAt(`/anh-goc/s2-cnv03/${B2_KEY}@640.webp`, 960, "variants")).toBe(`/anh-goc/s2-cnv03/${B2_KEY}@960`);
		expect(imageAt("/anh-goc/s2-cnv03/tunglamhoaphuc2/a.gif", 640, "variants")).toBe("/anh-goc/s2-cnv03/tunglamhoaphuc2/a.gif");
		expect(imageAt("/anh-goc/s2-cnv03/tunglamhoaphuc2/a.svg", 640, "variants")).toBe("/anh-goc/s2-cnv03/tunglamhoaphuc2/a.svg");
		expect(imageAt("/anh-goc/s2-cnv03/tunglamhoaphuc2/a.jpg?x=1", 640, "variants")).toBe("/anh-goc/s2-cnv03/tunglamhoaphuc2/a.jpg?x=1");
		expect(imageAt("/images/hero/toan-canh-chua-1920.webp", 640, "variants")).toBe("/images/hero/toan-canh-chua-1920.webp");
		expect(imageAt("https://img2.infonet.vn/a.jpg", 640, "variants")).toBe("https://img2.infonet.vn/a.jpg");
		expect(variantUrl("/images/a.jpg", 640)).toBe("/images/a.jpg");
	});

	it("keeps the old widths and adds icon 160 and mid 960", () => {
		expect(IMAGE_WIDTH).toEqual({ icon: 160, small: 360, card: 640, mid: 960, wide: 1280, full: 1920 });
	});

	it("albumImageAt: 'variants' covers B2 album pictures too, 'cgi' only WordPress as before", () => {
		const b2Picture = `/anh-goc/s2-cnv03/${B2_KEY}`;
		expect(albumImageAt(b2Picture, 640, "cgi")).toBe(b2Picture);
		expect(albumImageAt(b2Picture, 640, "variants")).toBe(`${b2Picture}@640`);
		expect(albumImageAt(WP, 640, "variants")).toBe("/anh-goc/wordpress/2026/09/45-1.jpg@640");
	});
});

describe("imageSrcSet", () => {
	const picture = `/anh-goc/s2-cnv03/${B2_KEY}`;

	it("'cgi' is the list it always was", () => {
		expect(imageSrcSet(picture, [360, 640], undefined, "cgi")).toBe(`${imageAt(picture, 360, "cgi")} 360w, ${imageAt(picture, 640, "cgi")} 640w`);
		expect(imageSrcSet(picture, [360, 640])).toBe(imageSrcSet(picture, [360, 640], null, "variants"));
		expect(imageSrcSet("/images/a.webp", [360, 640], null, "cgi")).toBeUndefined();
	});

	it("'variants' lists the standard widths with width descriptors", () => {
		expect(imageSrcSet(picture, [360, 640], undefined, "variants")).toBe(`${picture}@360 360w, ${picture}@640 640w`);
		expect(imageSrcSet(picture, [500, 640, 400], undefined, "variants")).toBe(`${picture}@640 640w`);
		expect(imageSrcSet(picture, [], undefined, "variants")).toBe(VARIANT_WIDTHS.map((w) => `${picture}@${w} ${w}w`).join(", "));
		expect(imageSrcSet(picture, [1280, 4000], undefined, "variants")).toBe(`${picture}@1280 1280w, ${picture}@max 2560w`);
	});

	it("'variants' stops at the picture's own width: @max stands for it", () => {
		expect(imageSrcSet(picture, [], 1000, "variants")).toBe(`${picture}@160 160w, ${picture}@360 360w, ${picture}@640 640w, ${picture}@960 960w, ${picture}@max 1000w`);
		expect(imageSrcSet(picture, [360, 640, 960], 668, "variants")).toBe(`${picture}@360 360w, ${picture}@640 640w, ${picture}@max 668w`);
		expect(imageSrcSet(picture, [], 4160, "variants")).toBe(VARIANT_WIDTHS.map((w) => `${picture}@${w} ${w}w`).join(", ") + `, ${picture}@max 2560w`);
		expect(imageSrcSet(picture, [360, 640], 300, "variants")).toBe(`${picture}@max 300w`);
	});

	it("'variants' gives nothing for pictures that come in one size", () => {
		expect(imageSrcSet("/images/a.webp", [360, 640], 900, "variants")).toBeUndefined();
		expect(imageSrcSet("/anh-goc/s2-cnv03/tunglamhoaphuc2/a.gif", [360, 640], 900, "variants")).toBeUndefined();
	});
});

describe("acceptedFormats", () => {
	it("takes AVIF first, WebP next, and neither from '*/*'", () => {
		expect(acceptedFormats(AVIF_ACCEPT)).toEqual(["avif", "webp"]);
		expect(acceptedFormats(WEBP_ACCEPT)).toEqual(["webp"]);
		expect(acceptedFormats(OLD_ACCEPT)).toEqual([]);
		expect(acceptedFormats("*/*")).toEqual([]);
		expect(acceptedFormats(null)).toEqual([]);
		expect(acceptedFormats("image/avif;q=0, image/webp")).toEqual(["webp"]);
		expect(acceptedFormats("IMAGE/AVIF ; q=0.9")).toEqual(["avif"]);
	});
});

// ---- the route ---------------------------------------------------------------------------------------------------------------------------

type Stored = { type?: string; body?: string };
function bucketWith(objects: Record<string, Stored | string>): MediaBucket & { get: ReturnType<typeof vi.fn> } {
	return {
		get: vi.fn(async (key: string) => {
			const found = objects[key];
			if (found === undefined) return null;
			const { type, body } = typeof found === "string" ? { type: "image/jpeg", body: found } : found;
			return { body: new Response(body ?? key).body!, httpMetadata: type ? { contentType: type } : undefined };
		}),
	};
}

function fakeCache() {
	const store = new Map<string, Response>();
	const cache: MediaCache & { store: Map<string, Response> } = {
		store,
		match: vi.fn(async (request: Request) => store.get(request.url)?.clone()),
		put: vi.fn(async (request: Request, response: Response) => void store.set(request.url, response)),
	};
	return cache;
}

const png = () => new Response("png-bytes", { headers: { "Content-Type": "image/png" } });
const noOrigin = vi.fn(async () => new Response("no", { status: 404 }));
const KEY = ["tunglamhoaphuc2", "a b", "b.jpg"];
const R2 = "s2-cnv03/tunglamhoaphuc2/a b/b.jpg";
const serve = (key: string[], bucket: MediaBucket | undefined, accept: string | null, extra: Parameters<typeof serveMedia>[4] = {}, origin = noOrigin) =>
	serveMedia("s2-cnv03", key, bucket, origin, { accept, ...extra });
const last = (name: string) => [...KEY.slice(0, -1), `${KEY[KEY.length - 1]}${name}`];

describe("serveMedia: variants", () => {
	it("serves the exact variant: AVIF when the browser takes it, with a year-long immutable cache and Vary: Accept", async () => {
		const bucket = bucketWith({ [`${R2}@640.avif`]: { type: "image/avif", body: "avif-640" }, [`${R2}@640.webp`]: { type: "image/webp", body: "webp-640" } });
		const response = await serve(last("@640"), bucket, AVIF_ACCEPT);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("avif-640");
		expect(response.headers.get("Content-Type")).toBe("image/avif");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
		expect(response.headers.get("Vary")).toBe("Accept");
		expect(response.headers.get("X-Image-Variant")).toBe("hit");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(bucket.get).toHaveBeenCalledTimes(1);
		expect(noOrigin).not.toHaveBeenCalled();
	});

	it("serves WebP to a browser that takes only WebP", async () => {
		const bucket = bucketWith({ [`${R2}@640.avif`]: { type: "image/avif" }, [`${R2}@640.webp`]: { type: "image/webp", body: "webp-640" } });
		const response = await serve(last("@640"), bucket, WEBP_ACCEPT);
		expect(await response.text()).toBe("webp-640");
		expect(response.headers.get("Content-Type")).toBe("image/webp");
		expect(response.headers.get("X-Image-Variant")).toBe("hit");
	});

	it("an explicit extension is honoured whatever Accept says, and then there is no Vary", async () => {
		const bucket = bucketWith({ [`${R2}@360.avif`]: { type: "image/avif", body: "avif-360" }, [`${R2}@360.webp`]: { type: "image/webp", body: "webp-360" } });
		const webp = await serve(last("@360.webp"), bucket, AVIF_ACCEPT);
		expect(await webp.text()).toBe("webp-360");
		expect(webp.headers.get("Vary")).toBeNull();
		const avif = await serve(last("@360.avif"), bucket, null);
		expect(await avif.text()).toBe("avif-360");
	});

	it("rounds a width that is not standard UP to the next one", async () => {
		const bucket = bucketWith({ [`${R2}@640.webp`]: { type: "image/webp", body: "webp-640" }, [`${R2}@360.webp`]: { type: "image/webp", body: "webp-360" } });
		expect(await (await serve(last("@500"), bucket, WEBP_ACCEPT)).text()).toBe("webp-640");
		expect(await (await serve(last("@361"), bucket, WEBP_ACCEPT)).text()).toBe("webp-640");
		expect(await (await serve(last("@1"), bucket, WEBP_ACCEPT)).text()).toBe("webp-360"); // 160 is missing: the next larger one stands in
		expect(bucket.get).toHaveBeenCalledWith(`${R2}@640.webp`);
		expect(bucket.get).not.toHaveBeenCalledWith(`${R2}@500.webp`);
	});

	it("falls back to the other format at the same width first", async () => {
		const bucket = bucketWith({ [`${R2}@640.webp`]: { type: "image/webp", body: "webp-640" }, [`${R2}@960.avif`]: { type: "image/avif", body: "avif-960" } });
		const response = await serve(last("@640"), bucket, AVIF_ACCEPT);
		expect(await response.text()).toBe("webp-640");
		expect(response.headers.get("X-Image-Variant")).toBe("fallback");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400, stale-while-revalidate=604800");
		expect(bucket.get.mock.calls.map((call) => call[0])).toEqual([`${R2}@640.avif`, `${R2}@640.webp`]);
	});

	it("then to the next larger width, ending at @max", async () => {
		const bucket = bucketWith({ [`${R2}@960.avif`]: { type: "image/avif", body: "avif-960" } });
		const wider = await serve(last("@640"), bucket, AVIF_ACCEPT);
		expect(await wider.text()).toBe("avif-960");
		expect(wider.headers.get("X-Image-Variant")).toBe("fallback");
		const maxOnly = bucketWith({ [`${R2}@max.avif`]: { type: "image/avif", body: "avif-max" } });
		const small = await serve(last("@360"), maxOnly, AVIF_ACCEPT);
		expect(await small.text()).toBe("avif-max");
		expect(maxOnly.get.mock.calls.map((call) => call[0])).toEqual([360, 640, 960, 1280, 1920].flatMap((step) => [`${R2}@${step}.avif`, `${R2}@${step}.webp`]).concat([`${R2}@max.avif`]));
	});

	it("a request for @max never goes to a smaller width", async () => {
		const bucket = bucketWith({ [`${R2}@1920.avif`]: { type: "image/avif" } });
		const response = await serve(last("@max"), bucket, AVIF_ACCEPT, {}, vi.fn(async () => png()));
		expect(response.headers.get("X-Image-Variant")).toBe("miss");
		expect(bucket.get).not.toHaveBeenCalledWith(`${R2}@1920.avif`);
	});

	it("serves the original from R2 when no variant exists (X-Image-Variant: miss, a short cache)", async () => {
		const bucket = bucketWith({ [R2]: { type: "image/jpeg", body: "original" } });
		const origin = vi.fn(async () => png());
		const response = await serve(last("@640"), bucket, AVIF_ACCEPT, {}, origin);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("original");
		expect(response.headers.get("Content-Type")).toBe("image/jpeg");
		expect(response.headers.get("X-Image-Variant")).toBe("miss");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600, stale-while-revalidate=86400");
		expect(response.headers.get("Vary")).toBe("Accept");
		expect(origin).not.toHaveBeenCalled();
	});

	it("a browser that takes neither format gets the original without any variant lookup", async () => {
		const bucket = bucketWith({ [`${R2}@640.webp`]: { type: "image/webp" }, [R2]: { type: "image/jpeg", body: "original" } });
		const response = await serve(last("@640"), bucket, OLD_ACCEPT);
		expect(await response.text()).toBe("original");
		expect(bucket.get.mock.calls.map((call) => call[0])).toEqual([R2]);
	});

	it("then to B2 / WordPress, with the media-fallback line, and 404 when nothing has it", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		try {
			const origin = vi.fn(async () => png());
			const response = await serve(["a", "b.png@640"], bucketWith({}), WEBP_ACCEPT, {}, origin);
			expect(origin).toHaveBeenCalledWith("https://s2-cnv03.s3.us-east-005.backblazeb2.com/a/b.png");
			expect(response.status).toBe(200);
			expect(response.headers.get("X-Image-Variant")).toBe("miss");
			expect(warn.mock.calls.map((call) => JSON.parse(String(call[0])))).toEqual([{ event: "media-fallback", reason: "r2-miss", key: "s2-cnv03/a/b.png", host: "s2-cnv03.s3.us-east-005.backblazeb2.com" }]);
			expect((await serve(["a", "b.png@640"], bucketWith({}), WEBP_ACCEPT, {}, noOrigin)).status).toBe(404);
			const wordpress = await serveMedia("wordpress", ["2026", "07", "x.png@360.webp"], undefined, origin, { accept: null });
			expect(origin).toHaveBeenLastCalledWith("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/07/x.png");
			expect(wordpress.status).toBe(200);
		} finally {
			warn.mockRestore();
		}
	});

	it("an R2 error on a variant moves on instead of failing", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const bucket: MediaBucket = {
				get: vi.fn(async (key: string) => {
					if (key.endsWith("@640.avif")) throw new Error("r2 down");
					return key.endsWith("@640.webp") ? { body: new Response("webp").body!, httpMetadata: { contentType: "image/webp" } } : null;
				}),
			};
			const response = await serve(last("@640"), bucket, AVIF_ACCEPT);
			expect(await response.text()).toBe("webp");
		} finally {
			error.mockRestore();
		}
	});

	it("types a variant by its extension when R2 holds no content type, and refuses what is not an image", async () => {
		const bucket = bucketWith({ [`${R2}@640.avif`]: { body: "avif-bytes", type: "" } });
		const response = await serve(last("@640.avif"), bucket, null);
		expect(response.headers.get("Content-Type")).toBe("image/avif");
	});

	it("refuses strange buckets and keys without touching R2", async () => {
		const bucket = bucketWith({});
		const origin = vi.fn();
		expect((await serveMedia("someone-else", ["a.jpg@640"], bucket, origin, { accept: AVIF_ACCEPT })).status).toBe(404);
		expect((await serve(["..", "a.jpg@640"], bucket, AVIF_ACCEPT, {}, origin)).status).toBe(404);
		expect((await serve(["a.pdf@640"], bucket, AVIF_ACCEPT, {}, origin)).status).toBe(404);
		expect((await serve(["@640"], bucket, AVIF_ACCEPT, {}, origin)).status).toBe(404);
		expect(bucket.get).not.toHaveBeenCalled();
		expect(origin).not.toHaveBeenCalled();
	});

	it("keeps answering ordinary keys exactly as before: no variant headers, month-long cache", async () => {
		const bucket = bucketWith({ [R2]: { type: "image/jpeg", body: "original" } });
		const response = await serve(KEY, bucket, AVIF_ACCEPT);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=2592000, stale-while-revalidate=604800");
		expect(response.headers.get("X-Image-Variant")).toBeNull();
		expect(response.headers.get("Vary")).toBeNull();
		expect(bucket.get.mock.calls.map((call) => call[0])).toEqual([R2]);
	});
});

describe("serveMedia: edge cache", () => {
	it("keeps a 200 answer (after the response, through waitUntil) and answers the next request from the cache alone", async () => {
		const bucket = bucketWith({ [`${R2}@640.avif`]: { type: "image/avif", body: "avif-640" } });
		const cache = fakeCache();
		const pending: Promise<unknown>[] = [];
		const options = { cache, waitUntil: (work: Promise<unknown>) => void pending.push(work), siteOrigin: "https://www.example.test" };
		const first = await serve(last("@640"), bucket, AVIF_ACCEPT, options);
		expect(await first.text()).toBe("avif-640");
		await Promise.all(pending);
		expect(cache.put).toHaveBeenCalledTimes(1);
		const [key] = [...cache.store.keys()];
		expect(key).toBe("https://www.example.test/anh-goc/s2-cnv03/tunglamhoaphuc2/a%20b/b.jpg@640?f=avif+webp");

		bucket.get.mockClear();
		const second = await serve(last("@640"), bucket, AVIF_ACCEPT, options);
		expect(await second.text()).toBe("avif-640");
		expect(second.headers.get("X-Image-Variant")).toBe("hit");
		expect(second.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
		expect(bucket.get).not.toHaveBeenCalled();
	});

	it("keeps AVIF and WebP answers of the same address apart, and a request of any width in at most a handful of keys", async () => {
		const bucket = bucketWith({ [`${R2}@640.avif`]: { type: "image/avif", body: "avif" }, [`${R2}@640.webp`]: { type: "image/webp", body: "webp" } });
		const cache = fakeCache();
		const options = { cache, waitUntil: (work: Promise<unknown>) => void work };
		expect(await (await serve(last("@640"), bucket, AVIF_ACCEPT, options)).text()).toBe("avif");
		expect(await (await serve(last("@640"), bucket, WEBP_ACCEPT, options)).text()).toBe("webp");
		for (const width of [401, 500, 639, 640]) await serve(last(`@${width}`), bucket, WEBP_ACCEPT, options);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(cache.store.size).toBe(2);
	});

	it("keeps ordinary originals too, but not a 404 and not when the cache breaks", async () => {
		const bucket = bucketWith({ [R2]: { type: "image/jpeg", body: "original" } });
		const cache = fakeCache();
		const pending: Promise<unknown>[] = [];
		const options = { cache, waitUntil: (work: Promise<unknown>) => void pending.push(work) };
		await serve(KEY, bucket, null, options);
		await Promise.all(pending);
		expect(cache.store.size).toBe(1);
		await serve(["x", "gone.jpg"], bucketWith({}), null, options);
		await serve(["x", "gone.jpg@640"], bucketWith({}), WEBP_ACCEPT, options);
		await Promise.all(pending);
		expect(cache.store.size).toBe(1);

		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const broken: MediaCache = { match: async () => Promise.reject(new Error("cache down")), put: async () => Promise.reject(new Error("cache down")) };
			const response = await serve(KEY, bucket, null, { cache: broken, waitUntil: (work) => void pending.push(work) });
			expect(await response.text()).toBe("original");
			await Promise.all(pending);
		} finally {
			error.mockRestore();
		}
	});
});
