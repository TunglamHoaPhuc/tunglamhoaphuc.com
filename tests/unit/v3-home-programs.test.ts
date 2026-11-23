// "Các Chương Trình Cộng Tu": các thẻ lấy từ khóa lễ thường kỳ của lịch tu học do admin sửa (featured_program), mỗi thẻ có
// địa chỉ trang khóa lễ mà V3 mở được; chưa có khóa lễ nào thì không thẻ (thành phần giữ các thẻ viết sẵn).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { liveScheduleDetail } from "@/lib/v3-live";
import { loadHomePrograms, programsFromSchedule } from "@/lib/v3-home-programs";
import { createFakeD1 } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	db.insert("media", { id: "m1", r2_key: "events/sam-hoi.webp", url: null });
	db.insert("featured_program", { id: "k1", title: "Đại Sám Hối", subtitle: "Khóa lễ định kỳ", summary: "Mùng 1 và Rằm âm lịch hằng tháng", time: "19h15", duration: "2 giờ", image_media_id: "m1", image_position: "center 20%", position: 1 });
	db.insert("featured_program", { id: "k2", title: "Sinh hoạt ngoại khóa", summary: "", time: "Chủ nhật đầu tháng", position: 2 });
	return createD1Repository(db);
}

test("thẻ lấy từ khóa lễ thường kỳ: tên, ngày âm lịch theo lời biên tập viên (không có thì giờ), ảnh và vị trí ảnh của admin", async () => {
	const cards = await loadHomePrograms(seed());
	assert.equal(cards.length, 2);
	assert.equal(cards[0].title, "Đại Sám Hối");
	assert.equal(cards[0].schedule, "Mùng 1 và Rằm âm lịch hằng tháng");
	assert.match(cards[0].imgUrl, /events\/sam-hoi\.webp$/);
	assert.equal(cards[0].imgPosition, "center 20%");
	assert.equal(cards[1].schedule, "Chủ nhật đầu tháng", "không có phần tóm tắt thì chữ giờ");
	assert.equal(cards[1].imgUrl, "", "admin chưa chọn ảnh thì không bịa ảnh");
});

test("địa chỉ thẻ mở được trang khóa lễ trong lịch tu học", async () => {
	const repo = seed();
	for (const card of await loadHomePrograms(repo)) {
		assert.match(card.href, /^\/lich-tu-hoc\//);
		const detail = await liveScheduleDetail(card.href.split("/").pop()!, repo);
		assert.ok(detail, `${card.href} phải mở được`);
	}
});

test("chưa có khóa lễ nào, hoặc khóa lễ không tên: không thẻ", async () => {
	assert.deepEqual(await loadHomePrograms(createD1Repository(createFakeD1())), []);
	assert.deepEqual(programsFromSchedule([{ id: "x", title: "  ", subtitle: "", summary: "", time: "", duration: "", location: "", image: null }]), []);
});

test("thành phần Chương Trình Cộng Tu nhận thẻ từ admin và chỉ khi không có mới dùng thẻ viết sẵn", () => {
	const text = readFileSync("src/features/home/components/ProgramsSection.tsx", "utf8");
	assert.match(text, /programs\?: HomeProgram\[\]/);
	assert.match(text, /programs && programs\.length > 0 \? fromAdmin\(programs\) : BUILT_IN/);
});
