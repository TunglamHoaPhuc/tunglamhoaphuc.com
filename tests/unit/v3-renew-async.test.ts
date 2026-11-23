// Một lần đọc D1 hỏng không được bị giữ lại cả phút (nghi vấn gây 503/500 ngẫu nhiên khi nhiều yêu cầu cùng lúc).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renewingAsync } from "@/lib/renew-async";

const clock = () => {
	let t = 1_000_000;
	return { now: () => t, tick: (ms: number) => (t += ms) };
};

test("đọc một lần rồi giữ trong thời hạn, hết hạn thì đọc lại", async () => {
	const c = clock();
	let reads = 0;
	const get = renewingAsync(async () => ++reads, 60_000, { now: c.now });
	assert.equal(await get(), 1);
	assert.equal(await get(), 1);
	c.tick(59_999);
	assert.equal(await get(), 1);
	c.tick(2);
	assert.equal(await get(), 2);
	assert.equal(reads, 2);
});

test("các lời gọi cùng lúc dùng chung một lần đọc", async () => {
	let reads = 0;
	const get = renewingAsync(async () => {
		reads++;
		await new Promise((resolve) => setTimeout(resolve, 5));
		return "v";
	}, 60_000);
	assert.deepEqual(await Promise.all(Array.from({ length: 8 }, () => get())), Array(8).fill("v"));
	assert.equal(reads, 1);
});

test("lần đọc ĐẦU hỏng: lỗi đến người gọi, KHÔNG được giữ; lời gọi kế tiếp đọc lại và thành công (renewing cũ giữ lỗi cả phút)", async () => {
	const c = clock();
	let reads = 0;
	const get = renewingAsync(
		async () => {
			reads++;
			if (reads === 1) throw new Error("D1 DB is overloaded");
			return "ok";
		},
		60_000,
		{ now: c.now },
	);
	await assert.rejects(() => get(), /overloaded/);
	assert.equal(await get(), "ok", "ngay lời gọi sau đọc lại, không đợi hết thời hạn");
	assert.equal(reads, 2);
});

test("lần đọc lại hỏng khi đã có giá trị tốt: dùng giá trị cũ, thử lại sau retryMs, rồi lấy giá trị mới", async () => {
	const c = clock();
	let reads = 0;
	let healthy = true;
	const get = renewingAsync(
		async () => {
			reads++;
			if (!healthy) throw new Error("network connection lost");
			return `v${reads}`;
		},
		60_000,
		{ now: c.now, retryMs: 5_000 },
	);
	assert.equal(await get(), "v1");
	healthy = false;
	c.tick(60_000);
	assert.equal(await get(), "v1", "đọc hỏng nhưng còn giá trị cũ");
	assert.equal(await get(), "v1");
	assert.equal(reads, 2, "chưa thử lại trước retryMs");
	healthy = true;
	c.tick(5_000);
	assert.equal(await get(), "v3");
});

test("make ném đồng bộ cũng được coi là lần đọc hỏng", async () => {
	const get = renewingAsync((): Promise<number> => {
		throw new Error("ném ngay");
	}, 1000);
	await assert.rejects(() => get(), /ném ngay/);
});

test("các chỗ đọc D1 giữ theo phút (thông tin trang, liên kết bảo tượng) không dùng `renewing` giữ cả lỗi nữa", () => {
	for (const file of ["src/lib/v3-statues.ts", "src/lib/tlhp-site/siteData.ts"]) {
		const code = readFileSync(file, "utf8");
		assert.match(code, /renewingAsync\(/, file);
		assert.doesNotMatch(code, /[^A-Za-z]renewing\(/, file);
	}
});
