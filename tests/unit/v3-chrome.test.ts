// V7 (a, b): the header menu and the footer's contact lines come from what the admin saved in D1 (menus, `site.info`),
// where V3's header and footer have a slot for them; V3 keeps its own menu and lines only while D1 has none; a failed
// read shows an empty frame, never the built-in one.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { contactGroups, formatPhone } from "@/lib/contact-format";
import { readMenu, readSettings } from "@/lib/tlhp-site/siteData";
import { buildChrome } from "@/lib/v3-chrome";
import { contactsFromInfo, infoFromSetting, menuHref, menuToNav, V3_ROUTES } from "@/lib/v3-menu";
import { createFakeD1 } from "../helpers/d1";

function seed() {
	const db = createFakeD1();
	db.insert("menu", { id: "header", name: "Menu đầu trang" });
	const item = (row: Record<string, unknown>) => db.insert("menu_item", { menu_id: "header", ...row });
	item({ id: "i1", label: "Giới thiệu", href: "/gioi-thieu", position: 1 });
	item({ id: "i1a", parent_id: "i1", label: "Lịch sử", href: "/gioi-thieu/lich-su", position: 1, icon_type: "image", icon_url: "/brand/x.webp" });
	item({ id: "i1b", parent_id: "i1", label: "Ẩn", href: "/gioi-thieu/an", position: 2, visible: 0 });
	item({ id: "i1c", parent_id: "i1", label: "Thanh quy", href: "/gioi-thieu/van-hoa-ung-xu", position: 3, open_new_tab: 1 });
	item({ id: "i1c1", parent_id: "i1c", label: "Cấp ba", href: "/x", position: 1 });
	item({ id: "i2", label: "Lịch tu học", href: "/lich-tu-hoc", position: 3 });
	item({ id: "i3", label: "Liên hệ", href: "/lien-he", position: 4 });
	item({ id: "i4", label: "Đã xóa", href: "/da-xoa", position: 5, deleted_at: "2026-01-01T00:00:00.000Z" });
	item({ id: "i5", label: "Đặt trước", href: "https://www.tunglamhoaphuc.com/dang-ky", position: 2 });
	return db;
}

test("menu đầu trang: cây hai cấp theo thứ tự admin; mục ẩn và đã xóa không có; cấp ba bị bỏ", async () => {
	const nav = menuToNav((await readMenu(seed(), "header")) ?? []);
	assert.deepEqual(
		nav.map((n) => [n.label, n.children.map((c) => c.label)]),
		[
			["Giới thiệu", ["Lịch sử", "Thanh quy"]],
			["Đặt trước", []],
			["Lịch tu học", []],
			["Liên hệ", []],
		],
	);
	assert.equal(nav[0].children[1].newTab, true);
	assert.equal(nav[0].children[0].newTab, false);
});

test("địa chỉ: trang V3 có thì giữ, trang V3 không có thì dùng trang cùng địa chỉ ở www, https giữ nguyên", async () => {
	const nav = menuToNav((await readMenu(seed(), "header")) ?? []);
	assert.equal(nav.find((n) => n.label === "Lịch tu học")?.href, "/lich-tu-hoc");
	assert.equal(nav.find((n) => n.label === "Liên hệ")?.href, "https://www.tunglamhoaphuc.com/lien-he");
	assert.equal(nav.find((n) => n.label === "Đặt trước")?.href, "https://www.tunglamhoaphuc.com/dang-ky");
	assert.equal(menuHref("/gioi-thieu#nguoi-lien-quan"), "/gioi-thieu#nguoi-lien-quan");
	assert.equal(menuHref(""), "#");
	assert.equal(menuHref("javascript:alert(1)"), "#");
	assert.equal(menuHref("//evil.example/x"), "#");
	assert.equal(menuHref("/"), "/");
});

test("danh sách trang của V3 trong menu khớp các thư mục thật của src/app/(public)", () => {
	const dirs = readdirSync("src/app/(public)", { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
	assert.deepEqual([...V3_ROUTES].sort(), dirs.sort());
});

test("menu rỗng trong D1: null (đầu trang giữ menu có sẵn của V3)", async () => {
	const db = createFakeD1();
	db.insert("menu", { id: "header", name: "x" });
	assert.equal(await readMenu(db, "header"), null);
});

test("số điện thoại chân trang do admin lưu: chỉ dòng hợp lệ; chưa có thì null; admin để rỗng thì []", () => {
	const info = { phones: [{ role: "Trưởng ban", name: "Bảo Trâm", phone: "0979.345.373" }, { role: "", name: "Thiếu chức vụ", phone: "0912345678" }, { role: "Thư ký", name: "Sai số", phone: "12" }, "rác"] };
	assert.deepEqual(contactsFromInfo(info), [{ role: "Trưởng ban", name: "Bảo Trâm", phone: "0979345373" }]);
	assert.equal(contactsFromInfo(undefined), null);
	assert.equal(contactsFromInfo({ name: "Chùa" }), null);
	assert.deepEqual(contactsFromInfo({ phones: [] }), []);
});

test("giờ mở cửa, địa chỉ, khẩu hiệu: có khóa thì dùng (kể cả rỗng), không có khóa thì null", () => {
	assert.deepEqual(infoFromSetting({ openingHours: " 7h–11h ", address: "", name: "x" }), { name: "x", openingHours: "7h–11h", address: "", slogan: null, mapsUrl: "", social: [] });
	assert.equal(infoFromSetting(null), null);
});

test("cách ghi số và gom theo chức vụ", () => {
	assert.equal(formatPhone("0979345373"), "0979.345.373");
	assert.equal(formatPhone("+84979345373"), "+84979345373");
	const groups = contactGroups([{ role: "A", name: "1" }, { role: "B", name: "2" }, { role: "A", name: "3" }]);
	assert.deepEqual(groups.map((g) => [g.role, g.people.length]), [["A", 2], ["B", 1]]);
});

test("đọc setting: giá trị JSON, giá trị hỏng bị bỏ", async () => {
	const db = createFakeD1();
	db.insert("setting", { key: "site.info", value: JSON.stringify({ phones: [] }) });
	db.insert("setting", { key: "bad", value: "{không phải json" });
	assert.deepEqual(await readSettings(db), { "site.info": { phones: [] } });
});

test("đọc D1 lỗi: khung trang rỗng, không phải menu và số điện thoại có sẵn", () => {
	const frame = buildChrome({ areas: [], failed: true, nodes: null, settings: {} });
	assert.deepEqual(frame.nav, []);
	assert.deepEqual(frame.contacts, []);
	assert.deepEqual(frame.info, { name: null, openingHours: "", address: "", slogan: "", mapsUrl: "", social: [] });
	const fresh = buildChrome({ areas: [], failed: false, nodes: null, settings: {} });
	assert.equal(fresh.nav, null);
	assert.equal(fresh.contacts, null);
	assert.equal(fresh.info, null);
});

test("đầu trang và chân trang không còn số điện thoại hay menu viết cứng ngoài phần dự phòng có tên", () => {
	const header = readFileSync("src/components/public/layout/Header.tsx", "utf-8");
	assert.match(header, /useSiteChrome/);
	assert.doesNotMatch(header, /router\.push\('\/gioi-thieu'\)/);
	const footer = readFileSync("src/components/public/layout/Footer.tsx", "utf-8");
	assert.match(footer, /useSiteChrome/);
	assert.equal((footer.match(/href="tel:/g) ?? []).length, 0, "số gọi đi từ danh sách, không viết cứng từng thẻ");
	assert.match(footer, /BUILT_IN_CONTACTS/);
});
