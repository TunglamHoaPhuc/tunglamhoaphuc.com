// Khung trang theo cài đặt của admin dùng chung (www): liên kết mạng xã hội, liên kết bản đồ, tên chùa của chân trang (`site.info`)
// và thông báo chào mừng (`site.announcement`). Hàm thuần: không cần D1. Luật ngày hết hạn là luật của www (src/libs/announcement.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildChrome } from "@/lib/v3-chrome";
import { infoFromSetting, noticeEndsAt, noticeFromSetting, noticeIsCurrent, safeHttpsUrl, socialFromInfo, socialNetwork } from "@/lib/v3-menu";

// ── mạng xã hội và liên kết bản đồ ──────────────────────────────────────────

test("mạng xã hội: giữ thứ tự và tên của admin, nhận ra mạng theo địa chỉ", () => {
	const social = socialFromInfo({
		social: [
			{ label: "Trang Facebook chùa", url: "https://www.facebook.com/tunglamhoaphuc" },
			{ label: "Nhóm Phật tử", url: "https://www.facebook.com/groups/phattu" },
			{ label: "Kênh YouTube", url: "https://youtu.be/abc" },
			{ label: "TikTok", url: "https://www.tiktok.com/@chua" },
			{ label: "Instagram", url: "https://instagram.com/chua" },
			{ label: "Zalo", url: "https://zalo.me/g/xyz" },
			{ label: "Trang web", url: "https://example.org" },
		],
	});
	assert.deepEqual(
		social.map((s) => [s.label, s.network]),
		[
			["Trang Facebook chùa", "facebook"],
			["Nhóm Phật tử", "facebook-group"],
			["Kênh YouTube", "youtube"],
			["TikTok", "tiktok"],
			["Instagram", "instagram"],
			["Zalo", "zalo"],
			["Trang web", "website"],
		],
	);
	assert.equal(social[0].url, "https://www.facebook.com/tunglamhoaphuc");
});

test("mạng xã hội: chỉ liên kết https an toàn; liên kết hoặc tên trống bị bỏ, không hiện nút trống", () => {
	const social = socialFromInfo({
		social: [
			{ label: "Tốt", url: "https://facebook.com/a" },
			{ label: "Không https", url: "http://facebook.com/a" },
			{ label: "Mã độc", url: "javascript:alert(1)" },
			{ label: "Dữ liệu", url: "data:text/html,x" },
			{ label: "Có khoảng trắng", url: "https://facebook.com/a b" },
			{ label: "Có dấu nháy", url: 'https://facebook.com/a"onmouseover="x' },
			{ label: "Có mật khẩu", url: "https://user:pw@facebook.com/a" },
			{ label: "Không địa chỉ", url: "" },
			{ label: "", url: "https://facebook.com/b" },
			{ label: "Quá dài ".repeat(10), url: "https://facebook.com/c" },
			{ label: "Thiếu liên kết" },
			"rác",
			null,
		],
	});
	assert.deepEqual(social.map((s) => s.label), ["Tốt"]);
});

test("mạng xã hội: không có khóa hoặc không phải mảng thì rỗng; nhiều hơn 12 thì chỉ lấy 12 như admin", () => {
	assert.deepEqual(socialFromInfo(undefined), []);
	assert.deepEqual(socialFromInfo({ social: "x" }), []);
	assert.deepEqual(socialFromInfo({}), []);
	const many = { social: Array.from({ length: 15 }, (_, i) => ({ label: `Mạng ${i}`, url: `https://example.org/${i}` })) };
	assert.equal(socialFromInfo(many).length, 12);
});

test("nhận ra mạng: tên miền con nhận, tên miền giả không bị nhầm", () => {
	assert.equal(socialNetwork("x", "https://m.facebook.com/a"), "facebook");
	assert.equal(socialNetwork("x", "https://facebook.com.evil.example/a"), "website");
	assert.equal(socialNetwork("x", "https://notfacebook.com/a"), "website");
	assert.equal(socialNetwork("Facebook", "không phải địa chỉ"), "facebook");
	assert.equal(socialNetwork("Kênh", "không phải địa chỉ"), "website");
});

test("liên kết an toàn: https, không khoảng trắng, không thông tin đăng nhập, tối đa 500 ký tự", () => {
	assert.equal(safeHttpsUrl(" https://maps.app.goo.gl/PSTtcjcJsaXvLCp37 "), "https://maps.app.goo.gl/PSTtcjcJsaXvLCp37");
	assert.equal(safeHttpsUrl("http://maps.example/x"), "");
	assert.equal(safeHttpsUrl("//maps.example/x"), "");
	assert.equal(safeHttpsUrl("https://"), "");
	assert.equal(safeHttpsUrl(`https://example.org/${"a".repeat(500)}`), "");
	assert.equal(safeHttpsUrl(42), "");
});

test("thông tin trang: tên, bản đồ, mạng xã hội cùng với giờ mở cửa, địa chỉ, khẩu hiệu", () => {
	const info = infoFromSetting({ name: " Tùng Lâm Hòa Phúc ", mapsUrl: "https://maps.app.goo.gl/x", social: [{ label: "Facebook", url: "https://facebook.com/a" }], address: "Phú Cát", openingHours: "", slogan: "Về nguồn" });
	assert.equal(info?.name, "Tùng Lâm Hòa Phúc");
	assert.equal(info?.mapsUrl, "https://maps.app.goo.gl/x");
	assert.equal(info?.social.length, 1);
	assert.equal(info?.openingHours, "");
	const bare = infoFromSetting({ address: "x" });
	assert.equal(bare?.name, null);
	assert.equal(bare?.mapsUrl, "");
	assert.deepEqual(bare?.social, []);
	assert.equal(infoFromSetting({ mapsUrl: "javascript:alert(1)" })?.mapsUrl, "");
});

// ── thông báo ───────────────────────────────────────────────────────────────

const NOW = Date.parse("2026-11-23T10:00:00+07:00");
const NOTICE = { id: "tb-1", text: "Khóa tu mùa xuân", link: { label: "Xem lịch", href: "/lich-tu-hoc" }, expires: "2026-12-31", active: true };

test("thông báo: chưa lưu cài đặt thì giữ chữ có sẵn (absent)", () => {
	assert.deepEqual(noticeFromSetting(undefined, NOW), { state: "absent" });
	assert.deepEqual(noticeFromSetting(null, NOW), { state: "absent" });
	assert.deepEqual(noticeFromSetting("rác", NOW), { state: "absent" });
});

test("thông báo: đang bật, chữ của admin, liên kết trong trang đi tới trang V3 có", () => {
	const notice = noticeFromSetting(NOTICE, NOW);
	assert.equal(notice.state, "on");
	if (notice.state !== "on") return;
	assert.equal(notice.text, "Khóa tu mùa xuân");
	assert.equal(notice.id, "tb-1");
	assert.deepEqual(notice.link, { label: "Xem lịch", href: "/lich-tu-hoc", newTab: false });
	assert.equal(notice.endsAt, Date.parse("2026-12-31T23:59:59.999+07:00"));
});

test("thông báo: admin tắt, chữ trống hay chỉ khoảng trắng thì không hiện (off), không quay về chữ có sẵn", () => {
	assert.deepEqual(noticeFromSetting({ ...NOTICE, active: false }, NOW), { state: "off" });
	assert.deepEqual(noticeFromSetting({ ...NOTICE, active: undefined }, NOW), { state: "off" });
	assert.deepEqual(noticeFromSetting({ ...NOTICE, active: "true" }, NOW), { state: "off" });
	assert.deepEqual(noticeFromSetting({ ...NOTICE, text: "   " }, NOW), { state: "off" });
	assert.deepEqual(noticeFromSetting({ ...NOTICE, text: 5 }, NOW), { state: "off" });
	assert.deepEqual(noticeFromSetting({}, NOW), { state: "off" });
});

test("thông báo: hết hạn tính đến hết ngày cuối theo giờ Việt Nam (như www)", () => {
	const withEnd = { ...NOTICE, expires: "2026-12-31" };
	assert.equal(noticeFromSetting(withEnd, Date.parse("2026-12-31T23:30:00+07:00")).state, "on");
	assert.equal(noticeFromSetting(withEnd, Date.parse("2026-12-31T17:30:00Z")).state, "off");
	assert.equal(noticeFromSetting(withEnd, Date.parse("2027-01-01T00:00:00+07:00")).state, "off");
});

test("thông báo: không có ngày hết hạn, hoặc ngày không đọc được, thì không bao giờ hết (như www)", () => {
	assert.equal(noticeEndsAt(""), null);
	assert.equal(noticeEndsAt(undefined), null);
	assert.equal(noticeEndsAt("31/12/2026"), null);
	assert.equal(noticeFromSetting({ ...NOTICE, expires: "" }, Date.parse("2099-01-01T00:00:00Z")).state, "on");
	assert.equal(noticeIsCurrent(null, Number.MAX_SAFE_INTEGER), true);
	assert.equal(noticeIsCurrent(1000, 1000), true);
	assert.equal(noticeIsCurrent(1000, 1001), false);
});

test("thông báo: liên kết chỉ nhận đường dẫn trong trang hoặc https; trang V3 chưa có thì sang www; liên kết ngoài mở tab mới", () => {
	const link = (href: string, label = "Xem") => {
		const n = noticeFromSetting({ ...NOTICE, link: { label, href } }, NOW);
		return n.state === "on" ? n.link : "off";
	};
	assert.deepEqual(link("/lien-he"), { label: "Xem", href: "https://www.tunglamhoaphuc.com/lien-he", newTab: false });
	assert.deepEqual(link("https://example.org/dang-ky"), { label: "Xem", href: "https://example.org/dang-ky", newTab: true });
	assert.deepEqual(link("/lich-tu-hoc", ""), { label: "Xem thêm", href: "/lich-tu-hoc", newTab: false });
	assert.equal(link("javascript:alert(1)"), null);
	assert.equal(link("//evil.example/x"), null);
	assert.equal(link("http://example.org"), null);
	assert.equal(link(""), null);
	const none = noticeFromSetting({ ...NOTICE, link: null }, NOW);
	assert.equal(none.state === "on" ? none.link : "off", null);
});

test("thông báo: mã đổi theo nội dung khi admin không lưu mã, để người đã đóng bản cũ thấy bản mới", () => {
	const idOf = (text: string) => {
		const n = noticeFromSetting({ text, active: true }, NOW);
		return n.state === "on" ? n.id : "";
	};
	assert.match(idOf("Một"), /^tb-/);
	assert.notEqual(idOf("Một"), idOf("Hai"));
	assert.equal(idOf("Một"), idOf("Một"));
});

// ── khung trang ─────────────────────────────────────────────────────────────

test("khung trang: đọc thông tin, mạng xã hội và thông báo từ cài đặt; chưa có thì null / absent", () => {
	const frame = buildChrome({ areas: [], failed: false, nodes: null, settings: { "site.info": { social: [{ label: "Facebook", url: "https://facebook.com/a" }] }, "site.announcement": NOTICE } }, NOW);
	assert.equal(frame.info?.social[0].network, "facebook");
	assert.equal(frame.notice.state, "on");
	const fresh = buildChrome({ areas: [], failed: false, nodes: null, settings: {} }, NOW);
	assert.equal(fresh.info, null);
	assert.deepEqual(fresh.notice, { state: "absent" });
});

test("khung trang: đọc D1 lỗi thì không mạng xã hội, không bản đồ, không thông báo (không đưa bản có sẵn vào)", () => {
	const frame = buildChrome({ areas: [], failed: true, nodes: null, settings: {} }, NOW);
	assert.deepEqual(frame.info, { name: null, openingHours: "", address: "", slogan: "", mapsUrl: "", social: [] });
	assert.deepEqual(frame.notice, { state: "off" });
});

// ── giao diện ───────────────────────────────────────────────────────────────

test("chân trang: mạng xã hội là thẻ liên kết thật (mở tab mới, rel an toàn, tên tiếng Việt), không còn nút trống viết cứng", () => {
	const footer = readFileSync("src/components/public/layout/Footer.tsx", "utf-8");
	assert.doesNotMatch(footer, /<button\s+key=\{label\}/);
	assert.doesNotMatch(footer, /QNCLT/);
	assert.match(footer, /href=\{url\}/);
	assert.match(footer, /target="_blank"/);
	assert.match(footer, /rel="noopener noreferrer"/);
	assert.match(footer, /mở trong tab mới/);
	assert.match(footer, /social\.length > 0/);
	assert.match(footer, /mapsUrl/);
});

test("hộp thông báo chào mừng đọc thông báo của admin, giữ chữ có sẵn chỉ khi chưa lưu", () => {
	const modal = readFileSync("src/components/public/modals/WelcomeNoticeModal.tsx", "utf-8");
	assert.match(modal, /useSiteChrome/);
	assert.match(modal, /notice\.state !== 'off'/);
	assert.match(modal, /noticeIsCurrent/);
	assert.match(modal, /tlhp_welcome_notice_v1_0/);
});
