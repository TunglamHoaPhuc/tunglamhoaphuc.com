// Danh sách Bảo tượng: mọi tượng admin đã xuất bản đều có chỗ trên danh sách (tượng chính theo chúng hội, các tượng còn lại
// trong khối "Nghệ thuật Phật giáo"), tượng ẩn / nháp / hẹn giờ / đã xóa thì không; trang tượng liệt kê đủ các biến thể.
import assert from "node:assert/strict";
import { test } from "node:test";
import { artGallerySlots, filterStatueList, layoutStatues, NO_FILTER, UNPLACED_ASSEMBLY, type StatueFilterState } from "@/lib/statue-list";
import type { StatueRecord } from "@/lib/statue-types";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import { assembliesOf, liveStatuePage, liveStatueRecords, readStatueLinks } from "@/lib/v3-statues";
import { createFakeD1, type FakeD1 } from "../helpers/d1";
import { openReal, rows, SKIP_REAL } from "../helpers/real-db";

// ── Phần thuần: bộ lọc và bố cục ────────────────────────────────────────────────────────────────────────────────────

type Row = Pick<StatueRecord, "id" | "name" | "subtitle" | "areaName" | "group" | "clusterName" | "assemblyId" | "assembly" | "assemblyName" | "categoryType">;

function row(id: string, kind: "main" | "art", assemblyId: string, extra: Partial<Row> = {}): Row {
	return {
		id,
		name: `Tượng ${id}`,
		subtitle: "",
		areaName: "",
		group: "",
		clusterName: "",
		assemblyId,
		assembly: assemblyId,
		assemblyName: assemblyId,
		categoryType: kind === "main" ? "TƯỢNG CHÍNH" : "NTPG",
		...extra,
	};
}

const ASSEMBLIES = [
	{ id: "chu_phat_hai_hoi", name: "Chư Phật Hải Hội" },
	{ id: "thanh_tinh_dai_hai_chung", name: "Thanh Tịnh Đại Hải Chúng" },
];

const LIST: Row[] = [
	row("A1", "main", "chu_phat_hai_hoi", { areaName: "TAM BẢO" }),
	row("A2", "art", "chu_phat_hai_hoi", { areaName: "SÂN DI ĐÀ", name: "Chuyển Pháp Luân" }),
	row("B1", "main", "thanh_tinh_dai_hai_chung", { areaName: "TAM BẢO" }),
	row("B2", "art", "thanh_tinh_dai_hai_chung", { areaName: "TAM BẢO" }),
	row("B3", "art", "thanh_tinh_dai_hai_chung"),
	row("N1", "main", "", { name: "Tượng chưa có chúng hội" }),
	row("N2", "art", "", { name: "Nghệ thuật chưa có chúng hội" }),
];

const ids = (list: Row[]) => list.map((s) => s.id);
const filter = (change: Partial<StatueFilterState>): StatueFilterState => ({ ...NO_FILTER, ...change });

/** Mọi tượng hiện ra trong bố cục, theo thứ tự trang. */
function shown<T>(layout: ReturnType<typeof layoutStatues<Row & T>>) {
	return layout.flat ?? [...layout.groups.flatMap((g) => g.statues), ...layout.art];
}

test("không lọc: tượng chính vào các chúng hội, tượng còn lại vào khối Nghệ thuật Phật giáo, không tượng nào mất hay lặp", () => {
	const layout = layoutStatues(LIST, ASSEMBLIES, NO_FILTER);
	assert.equal(layout.flat, null);
	assert.deepEqual(layout.groups.map((g) => [g.name, ids(g.statues)]), [
		["Chư Phật Hải Hội", ["A1"]],
		["Thanh Tịnh Đại Hải Chúng", ["B1"]],
		[UNPLACED_ASSEMBLY.name, ["N1"]],
	]);
	assert.deepEqual(ids(layout.art), ["A2", "B2", "B3", "N2"]);
	assert.equal(layout.total, LIST.length);
	assert.deepEqual(ids(shown(layout)).sort(), ids(LIST).sort(), "mỗi tượng đúng một chỗ");
});

test("tượng không có chúng hội không rơi vào mọi chúng hội (so khớp đúng mã, không so chuỗi con)", () => {
	const layout = layoutStatues(LIST, ASSEMBLIES, NO_FILTER);
	const inGroups = layout.groups.filter((g) => g.id !== UNPLACED_ASSEMBLY.id).flatMap((g) => ids(g.statues));
	assert.ok(!inGroups.includes("N1"));
	assert.equal(ids(shown(layout)).filter((id) => id === "N1").length, 1);
});

test("mọi tượng chính đang hiển thị đều tới được kể cả khi chưa có chúng hội, và chỉ khi xem tất cả chúng hội", () => {
	const all = layoutStatues(LIST, ASSEMBLIES, NO_FILTER);
	assert.ok(all.groups.some((g) => g.id === UNPLACED_ASSEMBLY.id));
	const one = layoutStatues(LIST, ASSEMBLIES, filter({ assembly: "chu_phat_hai_hoi" }));
	assert.deepEqual(one.groups.map((g) => g.id), ["chu_phat_hai_hoi"]);
	assert.deepEqual(ids(one.art), ["A2"], "khối Nghệ thuật Phật giáo cũng theo chúng hội được chọn");
});

test("lọc theo loại: tượng chính, hoặc Nghệ thuật Phật giáo", () => {
	const main = layoutStatues(LIST, ASSEMBLIES, filter({ kind: "main" }));
	assert.deepEqual(ids(main.art), []);
	assert.deepEqual(ids(shown(main)), ["A1", "B1", "N1"]);
	const art = layoutStatues(LIST, ASSEMBLIES, filter({ kind: "art" }));
	assert.deepEqual(art.groups, []);
	assert.deepEqual(ids(art.art), ["A2", "B2", "B3", "N2"]);
	assert.equal(art.total, 4);
});

test("tìm chữ hoặc lọc khu vực: một lưới phẳng có cả tượng chính lẫn nghệ thuật, tượng chính trước", () => {
	const byArea = layoutStatues(LIST, ASSEMBLIES, filter({ area: "TAM BẢO" }));
	assert.deepEqual(byArea.groups, []);
	assert.deepEqual(ids(byArea.flat ?? []), ["A1", "B1", "B2"]);
	const bySearch = layoutStatues(LIST, ASSEMBLIES, filter({ query: "chuyển pháp" }));
	assert.deepEqual(ids(bySearch.flat ?? []), ["A2"], "tìm thấy cả tượng Nghệ thuật Phật giáo, không chỉ tượng chính");
	assert.equal(bySearch.total, 1);
	const kindInFlat = layoutStatues(LIST, ASSEMBLIES, filter({ area: "TAM BẢO", kind: "art" }));
	assert.deepEqual(ids(kindInFlat.flat ?? []), ["B2"]);
});

test("chúng hội chỉ có tác phẩm nghệ thuật vẫn lọc được và hiện khối Nghệ thuật Phật giáo", () => {
	const list = [row("M", "main", "chu_phat_hai_hoi"), row("Z", "art", "chi_nghe_thuat")];
	const assemblies = assembliesOf(list as unknown as StatueRecord[]);
	assert.deepEqual(assemblies.map((a) => a.id).sort(), ["chi_nghe_thuat", "chu_phat_hai_hoi"]);
	const layout = layoutStatues(list, assemblies, filter({ assembly: "chi_nghe_thuat" }));
	assert.deepEqual(layout.groups, []);
	assert.deepEqual(ids(layout.art), ["Z"]);
});

test("không khớp gì: không có khối nào, tổng bằng 0", () => {
	const layout = layoutStatues(LIST, ASSEMBLIES, filter({ query: "không có tượng nào tên thế" }));
	assert.equal(layout.total, 0);
	assert.deepEqual(shown(layout), []);
	assert.deepEqual(filterStatueList(LIST, filter({ assembly: "khong_co" })), []);
});

test("trang tượng: các tác phẩm hiện hết, mỗi tác phẩm đúng một lần (không lặp cho đủ 5 ô)", () => {
	for (let n = 0; n <= 14; n++) {
		const { bento, grid } = artGallerySlots(n);
		assert.deepEqual([...bento, ...grid], Array.from({ length: n }, (_, i) => i), `n = ${n}`);
		assert.ok(bento.length === 0 || bento.length === 5, `n = ${n}: bento là 5 ô hoặc không có`);
	}
	assert.deepEqual(artGallerySlots(10), { bento: [0, 1, 2, 3, 4], grid: [5, 6, 7, 8, 9] });
	assert.deepEqual(artGallerySlots(1), { bento: [], grid: [0] });
});

// ── Với D1 giả: những gì admin xuất bản / ẩn / xóa ──────────────────────────────────────────────────────────────────

function seed() {
	const db = createFakeD1();
	db.insert("media", { id: "m", r2_key: "statues/a.webp", url: null });
	db.insert("category", { id: "as1", slug: "chu_phat_hai_hoi", name: "Chư Phật Hải Hội", kind: "assembly" });
	db.insert("category", { id: "as2", slug: "thanh_tinh_dai_hai_chung", name: "Thanh Tịnh Đại Hải Chúng", kind: "assembly" });
	const statue = (r: Record<string, unknown>) => db.insert("statue", { is_main: 1, assembly_id: "as1", image_media_id: "m", status: "published", ...r });
	statue({ id: "TP0001", code: "TP0001", slug: "thich-ca_tp0001", name: "ĐỨC PHẬT THÍCH CA", position: 1 });
	statue({ id: "TP0002", code: "TP0002", slug: "chuyen-phap-luan_tp0002", name: "CHUYỂN PHÁP LUÂN", is_main: 0, position: 2 });
	statue({ id: "TP0003", code: "TP0003", slug: "kho-hanh_tp0003", name: "KHỔ HẠNH", is_main: 0, position: 3 });
	statue({ id: "TP0004", code: "TP0004", slug: "nghe-thuat-nhap_tp0004", name: "NGHỆ THUẬT NHÁP", is_main: 0, status: "draft", position: 4 });
	statue({ id: "TP0005", code: "TP0005", slug: "nghe-thuat-an_tp0005", name: "NGHỆ THUẬT ẨN", is_main: 0, status: "hidden", position: 5 });
	statue({ id: "TP0006", code: "TP0006", slug: "nghe-thuat-hen-gio_tp0006", name: "NGHỆ THUẬT HẸN GIỜ", is_main: 0, status: "scheduled", position: 6 });
	statue({ id: "TP0007", code: "TP0007", slug: "nghe-thuat-xoa_tp0007", name: "NGHỆ THUẬT ĐÃ XÓA", is_main: 0, deleted_at: "2026-01-01T00:00:00.000Z", position: 7 });
	statue({ id: "TP0008", code: "TP0008", slug: "khong-chung-hoi_tp0008", name: "TƯỢNG CHÍNH CHƯA CÓ CHÚNG HỘI", assembly_id: null, position: 8 });
	statue({ id: "TP0009", code: "TP0009", slug: "moi-xuat-ban_tp0009", name: "TÁC PHẨM MỚI XUẤT BẢN", is_main: 0, assembly_id: "as2", position: 9 });
	let n = 0;
	const variation = (target: string | null, title: string) =>
		db.insert("art_variation", { id: `v${n}`, statue_id: "TP0001", position: n++, variation_id: `x${n}`, art_statue_id: target, title, location: "Tam Bảo", meaning: title });
	variation("TP0002", "Chuyển Pháp Luân");
	variation("TP0003", "Khổ Hạnh");
	variation("TP0004", "Tác phẩm gắn với tượng nháp");
	variation("TP0007", "Tác phẩm gắn với tượng đã xóa");
	variation(null, "Tác phẩm không gắn tượng nào");
	return db;
}

const deps = async (db: FakeD1) => ({ repo: createD1Repository(db), links: await readStatueLinks(db) });

test("tượng admin xuất bản (kể cả Nghệ thuật Phật giáo) đều có trong danh sách; nháp, ẩn, hẹn giờ, đã xóa thì không", async () => {
	const records = await liveStatueRecords(await deps(seed()));
	const layout = layoutStatues(records, assembliesOf(records), NO_FILTER);
	const got = ids(shown(layout) as Row[]).sort();
	assert.deepEqual(got, ["TP0001", "TP0002", "TP0003", "TP0008", "TP0009"]);
	assert.equal(layout.total, 5);
	assert.deepEqual(layout.groups.map((g) => [g.id, ids(g.statues as Row[])]), [
		["chu_phat_hai_hoi", ["TP0001"]],
		[UNPLACED_ASSEMBLY.id, ["TP0008"]],
	]);
	assert.deepEqual(ids(layout.art as Row[]), ["TP0002", "TP0003", "TP0009"]);
});

test("mọi tượng trong danh sách mở được bằng địa chỉ của nó; tượng ngoài danh sách thì 404", async () => {
	const d = await deps(seed());
	const records = await liveStatueRecords(d);
	for (const s of records) assert.equal((await liveStatuePage(s.slug, d))?.statue.id, s.id, s.slug);
	for (const slug of ["nghe-thuat-nhap_tp0004", "nghe-thuat-an_tp0005", "nghe-thuat-hen-gio_tp0006", "nghe-thuat-xoa_tp0007"]) assert.equal(await liveStatuePage(slug, d), null, slug);
});

test("admin ẩn một tượng nghệ thuật: tượng đó biến khỏi danh sách; xuất bản lại thì hiện lại", async () => {
	const db = seed();
	db.exec("update statue set status = 'hidden' where id = 'TP0009'");
	let records = await liveStatueRecords(await deps(db));
	assert.ok(!records.some((s) => s.id === "TP0009"));
	assert.ok(!assembliesOf(records).some((a) => a.id === "thanh_tinh_dai_hai_chung"), "chúng hội chỉ còn tượng ẩn thì không còn trong bộ lọc");
	db.exec("update statue set status = 'published' where id = 'TP0009'");
	records = await liveStatueRecords(await deps(db));
	assert.ok(layoutStatues(records, assembliesOf(records), filter({ kind: "art" })).art.some((s) => s.id === "TP0009"));
});

test("trang tượng chính liệt kê đủ các biến thể theo thứ tự; chỉ biến thể gắn với tượng đang hiển thị mới có đường dẫn", async () => {
	const page = await liveStatuePage("thich-ca_tp0001", await deps(seed()));
	assert.ok(page);
	assert.deepEqual(page.artWorks.map((a) => a.title), [
		"Chuyển Pháp Luân",
		"Khổ Hạnh",
		"Tác phẩm gắn với tượng nháp",
		"Tác phẩm gắn với tượng đã xóa",
		"Tác phẩm không gắn tượng nào",
	]);
	assert.deepEqual(page.artWorks.map((a) => a.href), ["/bao-tuong/chuyen-phap-luan_tp0002", "/bao-tuong/kho-hanh_tp0003", undefined, undefined, undefined]);
});

// ── Với D1 thật (chỉ khi có TLHP_REAL_DB) ───────────────────────────────────────────────────────────────────────────

test("D1 thật: số tượng trên danh sách bằng số tượng đang hiển thị trong D1, mỗi tượng đúng một chỗ", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1 } = openReal();
	const truth = rows<{ id: string; is_main: number }>(sqlite, "select id, is_main from statue where deleted_at is null and status = 'published'");
	const records = await liveStatueRecords({ repo: createD1Repository(d1), links: await readStatueLinks(d1) });
	const layout = layoutStatues(records, assembliesOf(records), NO_FILTER);
	const placed = ids(shown(layout) as Row[]);
	assert.equal(layout.total, truth.length);
	assert.equal(placed.length, truth.length, "không thiếu");
	assert.equal(new Set(placed).size, truth.length, "không lặp");
	assert.deepEqual([...placed].sort(), truth.map((r) => r.id).sort());
	assert.equal(layout.art.length, truth.filter((r) => !r.is_main).length, "khối Nghệ thuật Phật giáo có đủ các tượng không phải tượng chính");
});
