import { describe, expect, it, vi } from "vitest";
import { serveMedia, type MediaBucket } from "@/libs/content/mediaRoute";

// /anh-goc/<bucket>/<key>: R2 first, B2 or WordPress only while R2 lacks the picture (T42c).
const png = () => new Response("png-bytes", { headers: { "Content-Type": "image/png" } });

function bucketWith(objects: Record<string, { type?: string; body?: string }>): MediaBucket {
	return {
		get: vi.fn(async (key: string) => {
			const found = objects[key];
			return found ? { body: new Response(found.body ?? "r2-bytes").body!, httpMetadata: found.type ? { contentType: found.type } : undefined } : null;
		}),
	};
}

describe("serveMedia", () => {
	it("serves a picture that is in R2 without asking the original", async () => {
		const bucket = bucketWith({ "s2-cnv03/a/b.jpg": { type: "image/jpeg" } });
		const origin = vi.fn(async () => png());
		const response = await serveMedia("s2-cnv03", ["a", "b.jpg"], bucket, origin);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("r2-bytes");
		expect(response.headers.get("Content-Type")).toBe("image/jpeg");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=604800");
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(origin).not.toHaveBeenCalled();
	});

	it("reads WordPress pictures under the wordpress/ prefix", async () => {
		const bucket = bucketWith({ "wordpress/2026/07/x.jpg": { type: "image/jpeg" } });
		const response = await serveMedia("wordpress", ["2026", "07", "x.jpg"], bucket, vi.fn());
		expect(response.status).toBe(200);
		expect(bucket.get).toHaveBeenCalledWith("wordpress/2026/07/x.jpg");
	});

	it("falls back to B2 when R2 lacks the picture", async () => {
		const bucket = bucketWith({});
		const origin = vi.fn(async () => png());
		const response = await serveMedia("s2-cnv03", ["a", "b.png"], bucket, origin);
		expect(origin).toHaveBeenCalledWith("https://s2-cnv03.s3.us-east-005.backblazeb2.com/a/b.png");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=604800");
	});

	it("falls back to WordPress, and when there is no R2 binding at all (dev)", async () => {
		const origin = vi.fn(async () => png());
		const response = await serveMedia("wordpress", ["2026", "07", "x.png"], undefined, origin);
		expect(origin).toHaveBeenCalledWith("https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/07/x.png");
		expect(response.status).toBe(200);
	});

	it("answers 404 when neither has it, or the original is not a picture", async () => {
		const missing = vi.fn(async () => new Response("no", { status: 404 }));
		expect((await serveMedia("s2-cnv03", ["a.jpg"], bucketWith({}), missing)).status).toBe(404);
		const html = vi.fn(async () => new Response("<html>", { headers: { "Content-Type": "text/html" } }));
		expect((await serveMedia("s2-cnv03", ["a.jpg"], bucketWith({}), html)).status).toBe(404);
	});

	it("does not serve an R2 object that is not a picture", async () => {
		const bucket = bucketWith({ "s2-cnv03/a.jpg": { type: "text/html" } });
		const origin = vi.fn(async () => new Response("no", { status: 404 }));
		expect((await serveMedia("s2-cnv03", ["a.jpg"], bucket, origin)).status).toBe(404);
	});

	it("falls back when R2 throws", async () => {
		const bucket: MediaBucket = { get: vi.fn(async () => Promise.reject(new Error("r2 down"))) };
		const response = await serveMedia("s2-cnv03", ["a.png"], bucket, async () => png());
		expect(response.status).toBe(200);
	});

	it("refuses strange keys and buckets without touching R2 or the original", async () => {
		const bucket = bucketWith({});
		const origin = vi.fn();
		for (const [name, key] of [
			["someone-else", ["a.jpg"]],
			["s2-cnv03", [".."]],
			["s2-cnv03", ["a", "..", "b.jpg"]],
			["s2-cnv03", []],
			["s2-cnv03", [""]],
			["wordpress", ["2019", "05", "1..jpg", ".."]],
			["s2-cnv03", ["a.pdf"]],
		] as const) {
			expect((await serveMedia(name, [...key], bucket, origin)).status, `${name}/${key.join("/")}`).toBe(404);
		}
		expect(bucket.get).not.toHaveBeenCalled();
		expect(origin).not.toHaveBeenCalled();
	});
});
