import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryRepository } from "@/lib/tlhp-content/repository";
import { toTongChiRecord } from "@/lib/v3-data";

test("bộ chạy nạp được lớp đọc và v3-data", async () => {
	assert.equal(typeof createMemoryRepository, "function");
	assert.equal(typeof toTongChiRecord, "function");
});
