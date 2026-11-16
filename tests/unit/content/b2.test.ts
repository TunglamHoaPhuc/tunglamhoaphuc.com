import { describe, expect, it, vi } from "vitest";
import { b2Config, type CacheLike, createB2Reader } from "@/libs/content/sources/b2";

const ENV = {
	B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
	B2_BUCKET: "bucket-cu",
	B2_PREFIX: "tunglamhoaphuc2/database",
	B2_KEY_ID: "0050000000000000000000001",
	B2_APPLICATION_KEY: "K005-bi-mat-khong-duoc-lo",
};

type Reply = { status: number; body?: string; etag?: string } | Error;

/** A bucket that answers from a list of replies, recording each request. */
function bucket(replies: Reply[]) {
	const requests: Request[] = [];
	const fetch = vi.fn(async (input: RequestInfo | URL) => {
		const request = input instanceof Request ? input : new Request(input);
		requests.push(request);
		const reply = replies.shift();
		if (!reply) throw new Error("no more replies");
		if (reply instanceof Error) throw reply;
		return new Response(reply.status === 304 ? null : (reply.body ?? null), { status: reply.status, headers: reply.etag ? { etag: reply.etag } : {} });
	});
	return { fetch, requests };
}

/** The Cache API of one Cloudflare location, shared by every Worker there. */
function memoryCache(): CacheLike {
	const store = new Map<string, Response>();
	return {
		async match(request) {
			return store.get(request.url)?.clone();
		},
		async put(request, response) {
			store.set(request.url, response.clone());
		},
	};
}

function clock(start = 1_000_000) {
	let time = start;
	return { now: () => time, pass: (ms: number) => (time += ms) };
}

describe("B2 source settings", () => {
	it("read the bucket, the folder and the key from the environment", () => {
		expect(b2Config(ENV)).toMatchObject({ endpoint: ENV.B2_ENDPOINT, region: "us-east-005", bucket: "bucket-cu", prefix: "tunglamhoaphuc2/database/" });
	});

	it("name what is missing, never the key", () => {
		expect(() => b2Config({ ...ENV, B2_BUCKET: "", B2_APPLICATION_KEY: undefined })).toThrow("B2_BUCKET, B2_APPLICATION_KEY");
		try {
			b2Config({ ...ENV, B2_BUCKET: "" });
		} catch (error) {
			expect(String(error)).not.toContain(ENV.B2_APPLICATION_KEY);
		}
	});
});

describe("B2 reader", () => {
	it("signs a GET for the file in the bucket's folder", async () => {
		const b = bucket([{ status: 200, body: "[1,2]", etag: '"e1"' }]);
		const read = createB2Reader(b2Config(ENV), { fetch: b.fetch });
		expect(await read("posts")).toEqual({ version: '"e1"', data: [1, 2] });
		const [request] = b.requests;
		expect(request.method).toBe("GET");
		expect(request.url).toBe("https://s3.us-east-005.backblazeb2.com/bucket-cu/tunglamhoaphuc2/database/posts.json");
		expect(request.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=0050000000000000000000001\/\d{8}\/us-east-005\/s3\/aws4_request/);
		expect(request.headers.get("authorization")).not.toContain(ENV.B2_APPLICATION_KEY);
	});

	it("asks again only after a minute, and downloads nothing when the file has not changed", async () => {
		const time = clock();
		const b = bucket([
			{ status: 200, body: "[1]", etag: '"e1"' },
			{ status: 304, etag: '"e1"' },
			{ status: 200, body: "[1,2,3]", etag: '"e2"' },
		]);
		const read = createB2Reader(b2Config(ENV), { fetch: b.fetch, now: time.now });
		const first = await read("posts");
		time.pass(30_000);
		expect(await read("posts")).toBe(first);
		expect(b.requests).toHaveLength(1);
		time.pass(31_000);
		expect(await read("posts")).toEqual({ version: '"e1"', data: [1] });
		expect(b.requests[1].headers.get("if-none-match")).toBe('"e1"');
		time.pass(61_000);
		expect(await read("posts")).toEqual({ version: '"e2"', data: [1, 2, 3] });
	});

	it("keeps the last good file when the new one is broken or the bucket fails, and says so", async () => {
		const time = clock();
		const log = { error: vi.fn() };
		const b = bucket([{ status: 200, body: "[1]", etag: '"e1"' }, { status: 200, body: '[1, "nửa', etag: '"e2"' }, { status: 503 }, new TypeError("network")]);
		const read = createB2Reader(b2Config(ENV), { fetch: b.fetch, now: time.now, log });
		await read("posts");
		for (let i = 0; i < 3; i++) {
			time.pass(61_000);
			expect(await read("posts")).toEqual({ version: '"e1"', data: [1] });
		}
		expect(log.error).toHaveBeenCalledTimes(3);
		expect(String(log.error.mock.calls[0][0])).toContain("posts.json");
	});

	it("fails when there is no good copy yet, and gives null for a file that is not there", async () => {
		const b = bucket([{ status: 500 }, { status: 404 }]);
		const read = createB2Reader(b2Config(ENV), { fetch: b.fetch, log: { error: vi.fn() } });
		await expect(read("posts")).rejects.toThrow("posts.json");
		expect(await read("post-albums")).toBeNull();
	});

	it("shares the file with the other Workers of the location through the Cache API", async () => {
		const time = clock();
		const cache = memoryCache();
		const b = bucket([
			{ status: 200, body: "[1]", etag: '"e1"' },
			{ status: 304, etag: '"e1"' },
		]);
		await createB2Reader(b2Config(ENV), { fetch: b.fetch, now: time.now, cache })("posts");
		// A Worker that starts a little later takes the cached copy without asking B2.
		time.pass(20_000);
		expect(await createB2Reader(b2Config(ENV), { fetch: b.fetch, now: time.now, cache })("posts")).toEqual({ version: '"e1"', data: [1] });
		expect(b.requests).toHaveLength(1);
		// Later still, one asks B2 whether the cached copy is still current.
		time.pass(60_000);
		expect(await createB2Reader(b2Config(ENV), { fetch: b.fetch, now: time.now, cache })("posts")).toEqual({ version: '"e1"', data: [1] });
		expect(b.requests[1].headers.get("if-none-match")).toBe('"e1"');
	});
});
