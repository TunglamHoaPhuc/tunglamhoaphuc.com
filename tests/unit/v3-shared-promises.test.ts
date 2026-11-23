// Một yêu cầu không bao giờ được đợi lời hứa (lần đọc D1 đang chạy) do yêu cầu khác khởi tạo: trên Cloudflare yêu cầu đó có thể bị hủy
// với "the Worker's code had hung and would never generate a response", hiện ra là 503 ở khoảng 0,5% lượt hụt bộ nhớ đệm khi nhiều yêu
// cầu song song. Giữa các yêu cầu chỉ giữ giá trị ĐÃ VỀ. Hai "yêu cầu" được mô phỏng bằng các lần đọc mà bài kiểm thử tự quyết lúc kết thúc.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createMemoryRepository, lazy } from "@/lib/tlhp-content/repository";
import { createD1Repository, type D1Like } from "@/lib/tlhp-content/sources/d1";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((ok, fail) => {
		resolve = ok;
		reject = fail;
	});
	return { promise, resolve, reject };
}

/** Một `load` mỗi lần gọi phát ra một lần đọc riêng, để bài kiểm thử kết thúc từng lần. */
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

/** Chặn console.error trong lúc chạy `work`, trả các lần ghi log. */
async function quiet(work: () => Promise<void>): Promise<unknown[][]> {
	const logged: unknown[][] = [];
	const original = console.error;
	console.error = (...args: unknown[]) => void logged.push(args);
	try {
		await work();
	} finally {
		console.error = original;
	}
	return logged;
}

test("lazy: yêu cầu thứ hai đến khi lần đọc của yêu cầu thứ nhất còn chạy thì tự đọc; giá trị về trước được giữ cho mọi người", async () => {
	const { started, load } = reads<string>();
	const get = lazy(load);
	const a = get();
	const b = get();
	assert.equal(started.length, 2, "không đợi lời hứa của yêu cầu khác");
	assert.notEqual(a, b);
	started[1].resolve("từ B");
	assert.equal(await b, "từ B");
	started[0].resolve("từ A");
	assert.equal(await a, "từ B");
	assert.equal(await get(), "từ B");
	assert.equal(started.length, 2);
});

test("lazy: đã về thì mọi yêu cầu sau dùng lại, không đọc lại", async () => {
	const { started, load } = reads<number>();
	const get = lazy(load);
	const first = get();
	started[0].resolve(7);
	assert.equal(await first, 7);
	assert.deepEqual(await Promise.all([get(), get(), get()]), [7, 7, 7]);
	assert.equal(started.length, 1);
});

test("lazy: lần đọc hỏng không được giữ (yêu cầu sau đọc lại) và log nói rõ đọc cái gì; lỗi của yêu cầu này không chạm yêu cầu kia", async () => {
	const { started, load } = reads<string>();
	const get = lazy(load, "d1.summaries");
	const logged = await quiet(async () => {
		const a = get();
		const b = get();
		started[0].reject(new Error("D1 DB is overloaded"));
		await assert.rejects(a, /overloaded/);
		started[1].resolve("ổn");
		assert.equal(await b, "ổn");
	});
	assert.ok(logged.some((args) => String(args[0]).includes("d1.summaries")), JSON.stringify(logged.map(String)));
	assert.equal(await get(), "ổn", "giá trị đã về của yêu cầu B được giữ");
});

test("lazy: lần đọc đầu hỏng thì lần gọi sau đọc lại", async () => {
	const { started, load } = reads<string>();
	const get = lazy(load, "a");
	await quiet(async () => {
		const failing = get();
		started[0].reject(new Error("boom"));
		await assert.rejects(failing, /boom/);
	});
	const again = get();
	started[1].resolve("ok");
	assert.equal(await again, "ok");
	assert.equal(started.length, 2);
});

test("kho trong bộ nhớ: hai yêu cầu trên kho còn lạnh mỗi bên đọc bài viết; các yêu cầu sau dùng lại", async () => {
	const { started, load } = reads<never[]>();
	const repo = createMemoryRepository(load);
	const a = repo.listPosts();
	const b = repo.listPosts();
	assert.equal(started.length, 2);
	started[0].resolve([]);
	started[1].resolve([]);
	await Promise.all([a, b]);
	await repo.listPosts();
	await repo.listCategories("tri-tue-phat-phap");
	assert.equal(started.length, 2);
});

/** Một D1 mà các lần đọc kết thúc khi bài kiểm thử cho phép; `asked` liệt kê các câu lệnh theo thứ tự gửi. */
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

test("kho D1: yêu cầu không đợi lần đọc danh sách bài do yêu cầu khác bắt đầu (kể cả khi lần đọc kia không bao giờ về)", async () => {
	const { db, asked } = pendingD1();
	const repo = createD1Repository(db); // một kho dùng chung cho mọi yêu cầu của Worker trong 15 giây
	const a = repo.listPosts({ section: "tri-tue-phat-phap" });
	const b = repo.listPosts({ section: "tri-tue-phat-phap" });
	assert.equal(asked.length, 2);
	asked[1].read.resolve({ results: [] });
	assert.equal((await b).total, 0, "B có câu trả lời dù lần đọc của A chưa về");
	asked[0].read.resolve({ results: [] });
	assert.equal((await a).total, 0);
	await repo.listPosts({ section: "tri-tue-phat-phap" });
	assert.equal(asked.length, 2, "đã về thì dùng lại, không đọc thêm");
});

test("kho D1: lần đọc hỏng ghi log kèm tên nguồn và câu lệnh, không được giữ, yêu cầu sau đọc lại", async () => {
	const { db, asked } = pendingD1();
	const repo = createD1Repository(db);
	const logged = await quiet(async () => {
		const failing = repo.listPosts();
		asked[0].read.reject(new Error("D1 DB is overloaded"));
		await assert.rejects(failing, /overloaded/);
	});
	assert.ok(logged.some((args) => String(args[0]).includes("d1.summaries")), "tên nguồn");
	assert.ok(logged.some((args) => String(args[0]).includes("select p.id, p.slug")), "câu lệnh");
	const again = repo.listPosts();
	assert.equal(asked.length, 2);
	asked[1].read.resolve({ results: [] });
	assert.equal((await again).total, 0);
});

// ── Rào chắn: không được thêm lại bộ nhớ chung giữ lời hứa ──────────────────────────────────────────────────────────

const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const full = path.join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});

test("không còn biến cấp mô-đun nào giữ lời hứa (let x: Promise<…>, WeakMap<…, Promise<…>>, pending ??=) trong src/lib", () => {
	const offenders: string[] = [];
	for (const file of walk("src/lib").filter((f) => /\.tsx?$/.test(f))) {
		const code = readFileSync(file, "utf8");
		if (/^let\s+\w+\s*:\s*Promise</m.test(code) || /WeakMap<[^>]*Promise</.test(code) || /^\s*(pending|inflight|sharedLinks)\s*\?\?=/m.test(code)) offenders.push(file);
	}
	assert.deepEqual(offenders, [], "giữ giá trị đã về, không giữ lời hứa");
});
