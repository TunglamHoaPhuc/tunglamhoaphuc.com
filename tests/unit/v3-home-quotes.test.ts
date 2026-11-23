// "Lời Thầy dạy" trên trang chủ V3: chọn và xếp như www (home.quotes + bảng quote + câu kệ chủ đề tháng), và khối vẽ ra đúng.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { quoteLink, QuotesSection, shuffled } from "@/features/home/components/QuotesSection";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { loadHomeQuotes, MAX_QUOTES, safeSourceUrl, type HomeQuotes } from "@/lib/v3-home-quotes";
import { createFakeD1, type FakeD1 } from "../helpers/d1";

const NOV_15 = new Date("2026-11-15T05:00:00.000Z");

function seed(setting: unknown | undefined, mutate: (db: FakeD1) => void = () => {}) {
	const db = createFakeD1();
	if (setting !== undefined) db.insert("setting", { key: "home.quotes", value: typeof setting === "string" ? setting : JSON.stringify(setting) });
	db.insert("quote", { id: "q2", text: "Hai", author: "Thầy", position: 2, active: 1 });
	db.insert("quote", { id: "q1", text: "Một\nđoạn hai", author: "Thầy", source: "Kinh A", source_url: "https://a.vn/kinh", position: 1, active: 1 });
	db.insert("quote", { id: "q3", text: "Tắt", position: 3, active: 0 });
	db.insert("quote", { id: "q4", text: "Xóa", position: 4, active: 1, deleted_at: "2026-11-01T00:00:00.000Z" });
	db.insert("quote", { id: "q5", text: "   ", position: 5, active: 1 });
	db.insert("month_theme", { month: 3, title: "Tinh tấn", lines: JSON.stringify(["Câu <b>kệ</b> ba"]), author: "Thầy ba" });
	db.insert("month_theme", { month: 11, title: "Tri ân", lines: JSON.stringify(["Câu kệ &amp; mười một", "Dòng hai"]), author: "" });
	db.insert("month_theme", { month: 12, title: "Trống", lines: JSON.stringify([]), author: "" });
	db.insert("month_theme", { month: 1, title: "Khởi đầu", lines: JSON.stringify(["Câu kệ một"]), author: "Thầy một" });
	mutate(db);
	return db;
}

const load = (db: FakeD1, now = NOV_15) => loadHomeQuotes(createD1Repository(db), db, now);

test("source trich-dan: lời dạy đang bật, chưa xóa, theo thứ tự admin, bỏ lời trống", async () => {
	const got = await load(seed({ source: "trich-dan", mode: "thu-tu" }));
	assert.deepEqual(got, {
		kind: "trich-dan",
		mode: "thu-tu",
		eyebrow: "Lời dạy của Thầy",
		items: [
			{ id: "q1", text: "Một\nđoạn hai", author: "Thầy", source: "Kinh A", sourceUrl: "https://a.vn/kinh" },
			{ id: "q2", text: "Hai", author: "Thầy", source: "", sourceUrl: "" },
		],
	});
});

test("mode ngau-nhien được giữ nguyên cho trình duyệt xáo; máy chủ giữ thứ tự admin", async () => {
	const got = await load(seed({ source: "trich-dan", mode: "ngau-nhien" }));
	assert.equal(got?.mode, "ngau-nhien");
	assert.deepEqual(got?.items.map((item) => item.id), ["q1", "q2"]);
});

test("không có lời dạy nào đang bật: lùi về câu kệ chủ đề tháng", async () => {
	const got = await load(seed({ source: "trich-dan", mode: "ngau-nhien" }, (db) => db.exec("update quote set active = 0")));
	assert.equal(got?.kind, "chu-de-thang");
	assert.equal(got?.mode, "thu-tu");
});

test("source chu-de-thang, thiếu hay hỏng cài đặt: câu kệ từ tháng này, vòng lại đầu năm, bỏ tháng không có câu kệ", async () => {
	for (const setting of [{ source: "chu-de-thang", mode: "ngau-nhien" }, undefined, "{không phải json", { source: "lạ", mode: "thu-tu" }]) {
		const got = await load(seed(setting));
		assert.equal(got?.kind, "chu-de-thang");
		assert.equal(got?.eyebrow, "Chủ đề tháng 11");
		assert.deepEqual(got?.items.map((item) => item.id), ["chu-de-11", "chu-de-1", "chu-de-3"]);
	}
	const got = await load(seed(undefined));
	assert.deepEqual(got?.items[0], { id: "chu-de-11", text: "Câu kệ & mười một\nDòng hai", author: "", source: "Chủ đề tháng 11: Tri ân", sourceUrl: "" });
	assert.equal(got?.items[2].text, "Câu kệ ba", "bỏ thẻ <b>");
});

test("tháng tính theo giờ Việt Nam: 31/12 17:30 UTC đã là tháng 1", async () => {
	const got = await load(seed(undefined), new Date("2026-12-31T17:30:00.000Z"));
	assert.equal(got?.items[0].id, "chu-de-1");
});

test("không lời dạy, không câu kệ: null (không vẽ khối)", async () => {
	const db = seed({ source: "trich-dan", mode: "thu-tu" }, (d) => d.exec("delete from quote; delete from month_theme"));
	assert.equal(await load(db), null);
});

test("không có D1 (db = null): chỉ có câu kệ, vì không đọc được cài đặt", async () => {
	const db = seed({ source: "trich-dan", mode: "thu-tu" });
	const got = await loadHomeQuotes(createD1Repository(db), null, NOV_15);
	assert.equal(got?.kind, "chu-de-thang");
});

test("đọc hỏng không ném lỗi ra trang chủ", async () => {
	const db = seed({ source: "trich-dan", mode: "thu-tu" }, (d) => d.exec("drop table quote; drop table month_theme"));
	const original = console.error;
	console.error = () => {};
	try {
		assert.equal(await load(db), null);
	} finally {
		console.error = original;
	}
});

test("nhiều nhất 200 lời dạy như www", async () => {
	const db = seed({ source: "trich-dan", mode: "thu-tu" });
	for (let i = 0; i < MAX_QUOTES + 5; i++) db.insert("quote", { id: `x${String(i).padStart(3, "0")}`, text: `Lời ${i}`, position: 100 + i, active: 1 });
	assert.equal((await load(db))?.items.length, MAX_QUOTES);
});

test("kết quả là object thuần, JSON được", async () => {
	const got = await load(seed({ source: "trich-dan", mode: "thu-tu" }));
	assert.deepEqual(JSON.parse(JSON.stringify(got)), got);
});

test("địa chỉ nguồn: chỉ https:// hoặc đường dẫn nội bộ", () => {
	for (const bad of ["javascript:alert(1)", "http://a.vn", "//evil.vn", "data:text/html,x", "https://", "https://a b.vn", "/a\\b", ""]) {
		assert.equal(safeSourceUrl(bad), "", bad);
		assert.equal(quoteLink(bad), null, bad);
	}
	assert.equal(safeSourceUrl(" https://a.vn/x "), "https://a.vn/x");
	assert.deepEqual(quoteLink("https://a.vn/x"), { href: "https://a.vn/x", external: true });
	assert.deepEqual(quoteLink("/gioi-thieu"), { href: "/gioi-thieu", external: false });
});

test("xáo trộn giữ đủ phần tử và nhận bộ ngẫu nhiên truyền vào", () => {
	const input = [1, 2, 3, 4, 5];
	const out = shuffled(input, () => 0);
	assert.deepEqual([...out].sort(), input);
	assert.deepEqual(input, [1, 2, 3, 4, 5], "không đổi mảng gốc");
	assert.deepEqual(shuffled(input, () => 0), [2, 3, 4, 5, 1]);
});

const sample: HomeQuotes = {
	kind: "trich-dan",
	mode: "thu-tu",
	eyebrow: "Lời dạy của Thầy",
	items: [
		{ id: "a", text: "Lời <b>một</b>\nĐoạn hai", author: "", source: "Kinh A", sourceUrl: "https://a.vn/kinh" },
		{ id: "b", text: "Lời hai", author: "Thầy", source: "Nguồn", sourceUrl: "javascript:alert(1)" },
		{ id: "c", text: "Lời ba", author: "Thầy", source: "", sourceUrl: "https://c.vn" },
	],
};
const html = (quotes: HomeQuotes | null) => renderToStaticMarkup(createElement(QuotesSection, { quotes }));

test("khối vẽ: tiêu đề, nút có tên tiếng Việt, lời đầu hiện, các lời sau ẩn khỏi trình đọc màn hình", () => {
	const out = html(sample);
	assert.match(out, /LỜI THẦY DẠY/);
	assert.match(out, /aria-label="Lời dạy trước"/);
	assert.match(out, /aria-label="Lời dạy kế tiếp"/);
	assert.match(out, /aria-label="Tạm dừng tự chuyển lời dạy"/);
	assert.match(out, /aria-label="Xem lời dạy 2\/3"/);
	assert.match(out, /aria-label="Lời dạy 1\/3"/);
	assert.equal(out.match(/inert=""/g)?.length, 2, "hai lời sau bị ẩn và inert");
	assert.equal(out.match(/aria-hidden="true"[^>]*inert=""|inert=""[^>]*aria-hidden="true"/g)?.length, 2);
	assert.match(out, /Tùng Lâm Hòa Phúc/, "thiếu tác giả thì ghi tên chùa như www");
});

test("khối vẽ: chữ được escape, liên kết nguồn chỉ khi địa chỉ an toàn", () => {
	const out = html(sample);
	assert.match(out, /Lời &lt;b&gt;một&lt;\/b&gt;/);
	assert.match(out, /<a href="https:\/\/a\.vn\/kinh" rel="noopener noreferrer"[^>]*>Kinh A<\/a>/);
	assert.doesNotMatch(out, /javascript:/);
	assert.match(out, />Nguồn</);
	assert.equal(out.match(/<a /g)?.length, 1, "lời không có tên nguồn thì không có liên kết");
});

test("một lời duy nhất: không có nút chuyển; null hoặc rỗng: không vẽ gì", () => {
	const one = html({ ...sample, items: [sample.items[0]] });
	assert.doesNotMatch(one, /Lời dạy kế tiếp/);
	assert.match(one, /Lời &lt;b/);
	assert.equal(html(null), "");
	assert.equal(html({ ...sample, items: [] }), "");
});
