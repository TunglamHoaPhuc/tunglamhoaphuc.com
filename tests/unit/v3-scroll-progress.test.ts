// Nút phần trăm cuộn trang: hàm thuần tính phần trăm, điều kiện hiện và phần bù tránh nút nổi khác.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bottomOffsetFor, scrollPercent, shouldShowScrollButton } from "@/lib/scroll-progress";

test("scrollPercent: 0 ở đầu, 100 ở cuối, làm tròn số nguyên", () => {
	assert.equal(scrollPercent(0, 3000, 1000), 0);
	assert.equal(scrollPercent(2000, 3000, 1000), 100);
	assert.equal(scrollPercent(280, 3000, 1000), 14);
});

test("scrollPercent: kẹp trong 0–100 và an toàn khi trang không cuộn được", () => {
	assert.equal(scrollPercent(-50, 3000, 1000), 0);
	assert.equal(scrollPercent(9999, 3000, 1000), 100);
	assert.equal(scrollPercent(100, 800, 1000), 0);
	assert.equal(scrollPercent(100, 1000, 1000), 0);
	assert.equal(scrollPercent(Number.NaN, 3000, 1000), 0);
});

test("shouldShowScrollButton: chỉ trang dài và đã cuộn quá một màn hình", () => {
	assert.equal(shouldShowScrollButton(0, 5000, 800), false);
	assert.equal(shouldShowScrollButton(800, 5000, 800), false);
	assert.equal(shouldShowScrollButton(801, 5000, 800), true);
	assert.equal(shouldShowScrollButton(900, 1200, 800), false);
	assert.equal(shouldShowScrollButton(900, 5000, 0), false);
});

test("bottomOffsetFor: không phần tử cố định thì 0, có thì đẩy nút lên trên mép trên của nó", () => {
	assert.equal(bottomOffsetFor([], 800, 20), 0);
	// phần tử cao 150px sát đáy: mép trên ở y=630 -> cần 800-630+12-20 = 162
	assert.equal(bottomOffsetFor([630], 800, 20), 162);
	assert.equal(bottomOffsetFor([630, 700], 800, 20), 162);
	assert.equal(bottomOffsetFor([790], 800, 20), 2);
	assert.equal(bottomOffsetFor([Number.NaN], 800, 20), 0);
});
