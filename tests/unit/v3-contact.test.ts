// /lien-he: mọi thứ đọc từ `site.info` của admin (lib/v3-contact.ts), không viết cứng; trang dựng ở máy chủ, chạy khi không có JS.
// Cùng với kiểm tra tệp tĩnh V3 phải tự có (favicon, /brand, ảnh trang) và không trang V3 nào còn liên kết sang www.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { contactPageFrom, coordinatesOf, mapEmbedUrl, templeTitle } from "@/lib/v3-contact";
import ContactView from "../../src/app/(public)/lien-he/ContactView";

const INFO = {
	name: "Tùng Lâm Hòa Phúc",
	slogan: "Nơi để trở về",
	address: "Thôn Hòa Trúc – Xã Phú Cát – TP Hà Nội",
	openingHours: "Sáng 7:30 – 10:30 · Chiều 13:30 – 17:30",
	mapsUrl: "https://maps.app.goo.gl/PSTtcjcJsaXvLCp37",
	phones: [
		{ role: "Trưởng ban lãnh chúng", name: "Phật tử Bảo Trâm", phone: "0979.345.373" },
		{ role: "Thư ký", name: "Phật tử Liên Vi", phone: "0961533271" },
		{ role: "Thư ký", name: "Phật tử Liên Nghi", phone: "0984569134" },
		{ role: "", name: "Thiếu chức vụ", phone: "0912345678" },
	],
	social: [
		{ label: "Facebook chùa", url: "https://www.facebook.com/tlhp" },
		{ label: "Mã độc", url: "javascript:alert(1)" },
	],
};

test("dữ liệu trang: các trường của site.info, chỉ số điện thoại và liên kết hợp lệ, thứ tự của admin", () => {
	const data = contactPageFrom({ "site.info": INFO }, false);
	assert.equal(data.known, true);
	assert.equal(data.name, "Tùng Lâm Hòa Phúc");
	assert.equal(data.title, "Chùa Tùng Lâm Hòa Phúc");
	assert.equal(data.address, INFO.address);
	assert.equal(data.openingHours, INFO.openingHours);
	assert.equal(data.mapsUrl, INFO.mapsUrl);
	assert.deepEqual(data.phones.map((p) => [p.role, p.phone]), [["Trưởng ban lãnh chúng", "0979345373"], ["Thư ký", "0961533271"], ["Thư ký", "0984569134"]]);
	assert.deepEqual(data.social.map((s) => [s.label, s.network]), [["Facebook chùa", "facebook"]]);
	assert.match(data.mapEmbedUrl, /^https:\/\/www\.google\.com\/maps\?q=Th%C3%B4n.*&z=17&output=embed$/);
});

test("dữ liệu trang: chưa lưu site.info hoặc không đọc được D1 thì trạng thái trống, không có chữ viết sẵn", () => {
	for (const data of [contactPageFrom({}, false), contactPageFrom({ "site.info": INFO }, true), contactPageFrom({ "site.info": "rác" }, false)]) {
		assert.equal(data.known, false);
		assert.deepEqual([data.name, data.address, data.openingHours, data.mapsUrl, data.mapEmbedUrl, data.title], ["", "", "", "", "", ""]);
		assert.deepEqual(data.phones, []);
		assert.deepEqual(data.social, []);
	}
});

test("dữ liệu trang: admin để trống trường nào thì trường đó trống (không điền chữ khác vào)", () => {
	const data = contactPageFrom({ "site.info": { name: "X", address: "", openingHours: "", mapsUrl: "http://khong-https", phones: [], social: [] } }, false);
	assert.equal(data.known, true);
	assert.deepEqual([data.address, data.openingHours, data.mapsUrl, data.mapEmbedUrl], ["", "", "", ""]);
	assert.deepEqual(data.phones, []);
});

test("tên: thêm 'Chùa' trừ khi đã có", () => {
	assert.equal(templeTitle("Tùng Lâm Hòa Phúc"), "Chùa Tùng Lâm Hòa Phúc");
	assert.equal(templeTitle("Chùa Hòa Phúc"), "Chùa Hòa Phúc");
	assert.equal(templeTitle("chùa Hòa Phúc"), "chùa Hòa Phúc");
	assert.equal(templeTitle("Chùahoa"), "Chùa Chùahoa");
	assert.equal(templeTitle("  "), "");
});

test("bản đồ: lấy tọa độ từ liên kết của admin nếu có, nếu không thì dùng địa chỉ; liên kết rút gọn không nhúng được", () => {
	assert.equal(coordinatesOf("https://www.google.com/maps/place/Chua/@20.9535019,105.5713597,17z/data=x"), "20.9535019,105.5713597");
	assert.equal(coordinatesOf("https://www.google.com/maps?q=20.95,105.57"), "20.95,105.57");
	assert.equal(coordinatesOf("https://www.google.com/maps/place/x/data=!3d20.9535!4d105.5713"), "20.9535,105.5713");
	assert.equal(coordinatesOf("https://maps.app.goo.gl/PSTtcjcJsaXvLCp37"), "");
	assert.equal(coordinatesOf("https://www.google.com/maps?q=95.1,105.57"), "");
	assert.equal(mapEmbedUrl("https://www.google.com/maps/@20.95,105.57,17z", "Địa chỉ"), "https://www.google.com/maps?q=20.95%2C105.57&z=17&output=embed");
	assert.equal(mapEmbedUrl("https://maps.app.goo.gl/x", "Thôn A & B"), "https://www.google.com/maps?q=Th%C3%B4n%20A%20%26%20B&z=17&output=embed");
	assert.equal(mapEmbedUrl("", "  "), "");
});

const render = (info: unknown, failed = false) => renderToStaticMarkup(createElement(ContactView, { data: contactPageFrom(info === null ? {} : { "site.info": info }, failed) }));

test("trang dựng đủ: tiêu đề, địa chỉ, giờ, gọi điện, danh bạ theo chức vụ, bản đồ iframe nạp lười, nút chỉ đường, mạng xã hội", () => {
	const html = render(INFO);
	assert.match(html, /<h1[^>]*>Liên hệ<\/h1>/);
	for (const text of [INFO.address, INFO.openingHours, INFO.slogan, "Địa chỉ", "Gọi điện", "Giờ mở cửa", "Khóa tu, cộng tu", "Danh bạ", "Trưởng ban lãnh chúng", "Thư ký", "Facebook chùa", "Chùa Tùng Lâm Hòa Phúc"]) assert.ok(html.includes(text), text);
	assert.match(html, /href="tel:0979345373"[^>]*>0979\.345\.373</);
	assert.equal((html.match(/href="tel:/g) ?? []).length, 4, "một số ở thẻ Gọi điện và ba số ở danh bạ");
	assert.equal((html.match(/<iframe/g) ?? []).length, 1);
	const iframe = html.match(/<iframe[^>]*>/)?.[0] ?? "";
	assert.ok(iframe.includes('loading="lazy"') && iframe.includes('title="Bản đồ đường đến Chùa Tùng Lâm Hòa Phúc"'), iframe);
	assert.match(html, /href="https:\/\/maps\.app\.goo\.gl\/PSTtcjcJsaXvLCp37"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
	assert.match(html, /href="https:\/\/www\.facebook\.com\/tlhp"[^>]*target="_blank"/);
	assert.ok(html.includes('href="/lich-tu-hoc"'));
	assert.ok(!html.includes("javascript:"));
	assert.ok(!html.includes("<script"), "không cần JS");
	assert.ok(!html.includes("tunglamhoaphuc.com"), "không liên kết nào trỏ sang tên miền khác của site");
});

test("trang: trường nào admin chưa nhập thì thẻ và khối đó không có; chưa lưu site.info thì có dòng báo đang cập nhật", () => {
	const only = render({ name: "X", phones: [{ role: "Thư ký", name: "A", phone: "0961533271" }] });
	assert.doesNotMatch(only, /Giờ mở cửa|Chỉ đường|<iframe|Trang chính thức/);
	assert.match(only, /Gọi điện/);
	for (const html of [render(null), render(INFO, true)]) {
		assert.match(html, /Thông tin liên hệ đang được cập nhật/);
		assert.doesNotMatch(html, /Danh bạ|<iframe|tel:/);
		assert.match(html, /Khóa tu, cộng tu/);
	}
});

// ── tệp tĩnh và liên kết sang www ────────────────────────────────────────────

const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(path.join(dir, name)).isDirectory() ? walk(path.join(dir, name)) : [path.join(dir, name)]));

test("V3 tự có favicon, logo, biểu tượng và ảnh chia sẻ (không còn phụ thuộc www hay B2 cho chúng)", () => {
	for (const file of [
		"public/favicon.ico",
		"public/brand/logo-moc-an.webp",
		"public/brand/logo-moc-an-200.webp",
		"public/brand/logo-tung-lam-hoa-phuc-tron.webp",
		"public/brand/logo-tung-lam-hoa-phuc-tron-nga.webp",
		"public/brand/og-tung-lam-hoa-phuc.jpg",
		"public/brand/favicon/favicon-16x16.png",
		"public/brand/favicon/favicon-32x32.png",
		"public/brand/favicon/apple-touch-icon.png",
		"public/brand/favicon/icon-192x192.png",
		"public/brand/favicon/icon-512x512.png",
		"public/images/toan-canh-chua.jpg",
		"public/images/hero/toan-canh-chua-1920.webp",
		"public/images/hero/toan-canh-chua-1280.webp",
		"public/images/hero/toan-canh-chua-doc-760.webp",
		"public/images/hero/toan-canh-chua-nho.webp",
		"public/images/shape/pattern-2.webp",
		"public/images/shape/pattern-3.webp",
		"public/images/shape/shape-blur.svg",
		"public/images/shape/star.svg",
		"public/images/404/error.webp",
	]) {
		assert.ok(existsSync(file) && statSync(file).size > 100, file);
	}
	assert.equal(walk("public/brand/icons").filter((f) => f.endsWith(".webp")).length, 14, "14 biểu tượng /brand/icons như www");
	for (const f of walk("public/brand")) assert.ok(statSync(f).size < 160_000, `${f} quá nặng`);
});

test("đầu trang và chân trang dùng logo của chính V3 (/brand), không dùng kho B2", () => {
	for (const file of ["src/components/public/layout/Header.tsx", "src/components/public/layout/Footer.tsx"]) {
		const code = readFileSync(file, "utf8");
		assert.doesNotMatch(code, /backblazeb2/, file);
		for (const [, src] of code.matchAll(/["'](\/brand\/[^"']+)["']/g)) assert.ok(existsSync(path.join("public", src)), `${file} dùng ${src}`);
	}
});

test("manifest có biểu tượng của V3 và tệp thật", async () => {
	const manifest = (await import("../../src/app/manifest")).default();
	assert.equal(manifest.start_url, "/");
	assert.equal(manifest.lang, "vi");
	assert.ok(manifest.icons?.length);
	for (const icon of manifest.icons ?? []) assert.ok(existsSync(path.join("public", icon.src)), icon.src);
});

test("không trang hay thành phần V3 nào của khung trang, Liên hệ, Tìm kiếm còn liên kết sang https://www.tunglamhoaphuc.com", () => {
	const files = [
		"src/lib/v3-menu.ts",
		"src/lib/v3-contact.ts",
		"src/lib/v3-search.ts",
		"src/lib/v3-search-index.ts",
		"src/components/public/layout/Header.tsx",
		"src/components/public/layout/Footer.tsx",
		"src/components/public/PlainHero.tsx",
		...walk("src/app/(public)/lien-he"),
		...walk("src/app/(public)/tim-kiem"),
	];
	for (const file of files) {
		const code = readFileSync(file, "utf8")
			.split("\n")
			.filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
			.join("\n")
			.replace(/OWN_HOSTS = \[[^\]]*\]/, "");
		assert.doesNotMatch(code, /https?:\/\/(www\.)?tunglamhoaphuc\.com/, file);
	}
});
