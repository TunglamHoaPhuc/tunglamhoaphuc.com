// A request must never await a promise another request started (a D1 read in flight): on Cloudflare that request can be cancelled as
// "hung" (the Worker's code had hung and would never generate a response), which showed as a 503 on about one cache miss in 200 under
// parallel load. What the Worker keeps between requests is the value that has ARRIVED. Two "requests" are simulated with reads whose
// end the test controls.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRepository, lazy } from "../../src/libs/content/repository";
import { createD1Repository, type D1Like } from "../../src/libs/content/sources/d1";
import { renewingAsync } from "../../src/libs/renew-async";
import { searchIndex } from "../../src/libs/searchIndex";

/** A read whose end the test decides. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((ok, fail) => {
		resolve = ok;
		reject = fail;
	});
	return { promise, resolve, reject };
}

/** A `load` that hands out one deferred read per call, so a test can finish each separately. */
function reads<T>() {
	const started: ReturnType<typeof deferred<T>>[] = [];
	return {
		started,
		load: () => {
			const read = deferred<T>();
			started.push(read);
			return read.promise;
		},
	};
}

afterEach(() => vi.restoreAllMocks());

describe("lazy: a value is shared only after it has arrived", () => {
	it("a second request that needs the value while the first one's read is pending makes its own read", async () => {
		const { started, load } = reads<string>();
		const get = lazy(load);
		const a = get(); // request A
		const b = get(); // request B, while A's read is still pending
		expect(started).toHaveLength(2);
		expect(a).not.toBe(b);
		started[1].resolve("from B");
		expect(await b).toBe("from B");
		started[0].resolve("from A");
		// the first value to arrive is the one kept for everybody; A still gets an answer
		expect(await a).toBe("from B");
		expect(await get()).toBe("from B");
		expect(started).toHaveLength(2);
	});

	it("once the value has arrived every later request reuses it without reading again", async () => {
		const { started, load } = reads<number>();
		const get = lazy(load);
		const first = get();
		started[0].resolve(7);
		expect(await first).toBe(7);
		expect(await Promise.all([get(), get(), get()])).toEqual([7, 7, 7]);
		expect(started).toHaveLength(1);
	});

	it("a failed read is not kept (the next request reads again) and the log says which read failed", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { started, load } = reads<string>();
		const get = lazy(load, "d1.summaries");
		const failing = get();
		started[0].reject(new Error("D1 DB is overloaded"));
		await expect(failing).rejects.toThrow("overloaded");
		expect(log).toHaveBeenCalledWith(expect.stringContaining("d1.summaries"), expect.any(Error));
		const again = get();
		started[1].resolve("ok");
		expect(await again).toBe("ok");
		expect(started).toHaveLength(2);
	});

	it("a failure in one request does not touch another request that is reading", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { started, load } = reads<string>();
		const get = lazy(load);
		const a = get();
		const b = get();
		started[0].reject(new Error("boom"));
		await expect(a).rejects.toThrow("boom");
		started[1].resolve("fine");
		expect(await b).toBe("fine");
	});
});

describe("renewingAsync: only an arrived value is kept, and it is not shared while pending", () => {
	const clock = () => {
		let t = 1_000_000;
		return { now: () => t, tick: (ms: number) => (t += ms) };
	};

	it("callers that arrive during a read each start their own; the newest read to start is kept", async () => {
		const c = clock();
		const { started, load } = reads<string>();
		const get = renewingAsync(load, 60_000, { now: c.now });
		const a = get();
		const b = get();
		expect(started).toHaveLength(2);
		started[1].resolve("newer");
		expect(await b).toBe("newer");
		started[0].resolve("older"); // a slower, earlier read must not replace the newer value
		expect(await a).toBe("older");
		expect(await get()).toBe("newer");
		expect(started).toHaveLength(2);
	});

	it("serves the arrived value until it expires, then reads again", async () => {
		const c = clock();
		let n = 0;
		const get = renewingAsync(async () => ++n, 60_000, { now: c.now });
		expect(await get()).toBe(1);
		c.tick(59_999);
		expect(await get()).toBe(1);
		c.tick(2);
		expect(await get()).toBe(2);
	});

	it("a failed first read is not kept and is logged with its name; a failed re-read serves the old value", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const c = clock();
		let healthy = false;
		let n = 0;
		const get = renewingAsync(
			async () => {
				n++;
				if (!healthy) throw new Error("network connection lost");
				return `v${n}`;
			},
			60_000,
			{ now: c.now, retryMs: 5_000, name: "siteData" },
		);
		await expect(get()).rejects.toThrow("network connection lost");
		expect(log).toHaveBeenCalledWith(expect.stringContaining("siteData"), expect.any(Error));
		healthy = true;
		expect(await get()).toBe("v2");
		healthy = false;
		c.tick(60_000);
		expect(await get()).toBe("v2");
	});
});

describe("the repositories: the posts are shared only once read", () => {
	it("memory repository: two requests on a cold repository each read the posts; later ones reuse them", async () => {
		const { started, load } = reads<never[]>();
		const repo = createMemoryRepository(load);
		const a = repo.listPosts();
		const b = repo.listPosts();
		expect(started).toHaveLength(2);
		started[0].resolve([]);
		started[1].resolve([]);
		await Promise.all([a, b]);
		await repo.listPosts();
		await repo.listCategories("tri-tue-phat-phap");
		expect(started).toHaveLength(2);
	});

	/** A D1 whose reads end when the test says so; `asked` lists the statements in the order they were sent. */
	function pendingD1() {
		const asked: { sql: string; read: ReturnType<typeof deferred<{ results: unknown[] }>> }[] = [];
		const db: D1Like = {
			prepare(sql) {
				const statement = {
					bind: () => statement,
					all: () => {
						const read = deferred<{ results: unknown[] }>();
						asked.push({ sql, read });
						return read.promise as never;
					},
				};
				return statement;
			},
		};
		return { db, asked };
	}

	it("D1 repository: a request does not await the summaries read another request started", async () => {
		const { db, asked } = pendingD1();
		const repo = createD1Repository(db); // one repository, shared by every request of the Worker for 15 s
		const a = repo.listPosts({ section: "tri-tue-phat-phap" }); // request A starts the read
		const b = repo.listPosts({ section: "tri-tue-phat-phap" }); // request B arrives while it is pending
		expect(asked).toHaveLength(2);
		// B's read finishes while A's never does (as when A's context is gone): B must still get its answer
		asked[1].read.resolve({ results: [] });
		expect((await b).total).toBe(0);
		// A's read ends later: nothing breaks, and the value kept is reused with no new read
		asked[0].read.resolve({ results: [] });
		expect((await a).total).toBe(0);
		await repo.listPosts({ section: "tri-tue-phat-phap" });
		expect(asked).toHaveLength(2);
	});

	it("D1 repository: a read that fails is logged with the statement, is not kept, and the next request reads again", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { db, asked } = pendingD1();
		const repo = createD1Repository(db);
		const failing = repo.listPosts();
		asked[0].read.reject(new Error("D1 DB is overloaded"));
		await expect(failing).rejects.toThrow("overloaded");
		expect(log.mock.calls.some(([message]) => String(message).includes("d1.summaries"))).toBe(true);
		expect(log.mock.calls.some(([message]) => String(message).includes("select p.id, p.slug"))).toBe(true);
		const again = repo.listPosts();
		expect(asked).toHaveLength(2);
		asked[1].read.resolve({ results: [] });
		expect((await again).total).toBe(0);
	});
});

describe("the search index is kept only when finished", () => {
	it("two searches on a cold repository each build the index; afterwards it is reused", async () => {
		const { started, load } = reads<never[]>();
		const repo = createMemoryRepository(load);
		const a = searchIndex(repo);
		const b = searchIndex(repo);
		await vi.waitFor(() => expect(started.length).toBeGreaterThanOrEqual(2));
		const builds = started.length;
		for (const read of started) read.resolve([]);
		const [first, second] = await Promise.all([a, b]);
		expect(second).toBe(first); // one index kept for both
		const more = started.length;
		expect(more).toBe(builds);
		expect(await searchIndex(repo)).toBe(first);
		expect(started).toHaveLength(more);
	});
});
