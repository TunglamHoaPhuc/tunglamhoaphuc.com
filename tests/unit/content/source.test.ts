import { afterEach, describe, expect, it, vi } from "vitest";

const ENV = {
	CONTENT_SOURCE: "b2",
	B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
	B2_BUCKET: "bucket-cu",
	B2_PREFIX: "database",
	B2_KEY_ID: "0050000000000000000000001",
	B2_APPLICATION_KEY: "K005-bi-mat",
};

const post = (id: number, title: string) => ({ id: `p${id}`, slug: `bai-${id}`, title, mainCategory: "dong-chay-hoang-phap", subCategory: "cong-tu", categoryName: "Cộng Tu", publishedDate: "2026-10-01", status: "published" });

/** A fresh copy of the repository module, so each test starts with no repository built. */
async function freshRepository() {
	vi.resetModules();
	return import("@/libs/content/repository");
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("content source", () => {
	it("renews a value once its time is up", async () => {
		const { renewing } = await freshRepository();
		let time = 0;
		let made = 0;
		const get = renewing(() => ++made, 60_000, () => time);
		expect([get(), get()]).toEqual([1, 1]);
		time = 60_000;
		expect(get()).toBe(2);
	});

	it("renews a value at once when the admin has written since, and not otherwise", async () => {
		const { renewing, bumpContentEpoch } = await freshRepository();
		let made = 0;
		const get = renewing(() => ++made, 60_000, () => 0);
		expect([get(), get()]).toEqual([1, 1]);
		bumpContentEpoch();
		expect([get(), get()]).toEqual([2, 2]);
	});

	it("with B2 chosen but not set up, names the missing settings", async () => {
		vi.stubEnv("CONTENT_SOURCE", "b2");
		for (const name of ["B2_ENDPOINT", "B2_BUCKET", "B2_KEY_ID", "B2_APPLICATION_KEY"]) vi.stubEnv(name, "");
		const { getContentRepository } = await freshRepository();
		await expect(getContentRepository()).rejects.toThrow("B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APPLICATION_KEY");
	});

	it("with D1 chosen but no DB binding, says what is missing", async () => {
		vi.stubEnv("CONTENT_SOURCE", "d1");
		const { getContentRepository } = await freshRepository();
		await expect(getContentRepository()).rejects.toThrow("binding DB");
	});

	it("from B2, a post edited in the old admin shows within a minute, an unchanged file is not downloaded again", async () => {
		for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-11-14T08:00:00Z"));
		let posts = { status: 200, etag: '"e1"', body: JSON.stringify([post(1, "Bài cũ")]) };
		const asked: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (request: Request) => {
				asked.push(`${new URL(request.url).pathname} ${request.headers.get("if-none-match") ?? ""}`.trim());
				if (!request.url.endsWith("/posts.json")) return new Response(null, { status: 404 });
				if (request.headers.get("if-none-match") === posts.etag) return new Response(null, { status: 304 });
				return new Response(posts.body, { status: posts.status, headers: { etag: posts.etag } });
			}),
		);
		const { getContentRepository } = await freshRepository();

		const first = await getContentRepository();
		expect((await first.listPosts()).items.map((item) => item.title)).toEqual(["Bài cũ"]);
		expect(await getContentRepository()).toBe(first);

		vi.setSystemTime(new Date("2026-11-14T08:01:01Z"));
		const second = await getContentRepository();
		expect(second).not.toBe(first);
		expect((await second.listPosts()).items.map((item) => item.title)).toEqual(["Bài cũ"]);
		expect(asked).toContain('/bucket-cu/database/posts.json "e1"');

		posts = { status: 200, etag: '"e2"', body: JSON.stringify([post(1, "Bài đã sửa")]) };
		vi.setSystemTime(new Date("2026-11-14T08:02:02Z"));
		expect((await (await getContentRepository()).listPosts()).items.map((item) => item.title)).toEqual(["Bài đã sửa"]);
	});
});
