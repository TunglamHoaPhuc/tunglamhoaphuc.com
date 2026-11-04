import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStatues, statueArticle, statueSummary } from "@/libs/content/baoTuong";
import { areaOfStatue, filterStatues, readStatueQuery, relatedStatues, statueListHref } from "@/libs/baoTuong";

const statue = (extra: Record<string, unknown>) => ({
	id: "TP0001",
	code: "TP0001",
	slug: "duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001",
	name: "ĐỨC PHẬT THÍCH CA MÂU NI",
	title: "ĐỨC PHẬT THÍCH CA MÂU NI",
	subtitle: "Vô Thượng Năng Nhân",
	categoryType: "TƯỢNG CHÍNH",
	areaSlug: "tam_bao",
	assemblyId: "chu_phat_hai_hoi",
	assemblyName: "Chư Phật Hải Hội",
	clusterName: "Hoa Nghiêm Tam Thánh",
	avatarUrl: "https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/a.webp",
	quote: "ĐỨC PHẬT THÍCH CA MÂU NI",
	quoteAuthor: "VÔ TRÍ - TÂM HÒA",
	articleContent: "",
	fullHistoryHtml: "<p>Dưới chân dãy Himalaya.</p>\n<p>Người đời gọi Ngài là bậc xuất thân dòng dõi Thái Dương.</p>",
	artVariations: [],
	...extra,
});

describe("Bảo Tượng file", () => {
	it("reads a statue's text, its assembly and group, and leaves out a quote that only repeats the name", () => {
		const { statues } = parseStatues({ success: true, statues: [statue({}), statue({ id: "TP0018", code: "TP0018", slug: "duc_phat_duoc_su_tp0018", quote: "Lời dạy về Dược Sư.", name: "ĐỨC PHẬT DƯỢC SƯ" })] });
		const [thichCa, duocSu] = statues;
		expect(statueSummary(thichCa)).toMatchObject({ name: "Đức Phật Thích Ca Mâu Ni", assembly: { slug: "chu_phat_hai_hoi", name: "Chư Phật Hải Hội" }, cluster: "Hoa Nghiêm Tam Thánh" });
		expect(thichCa.quote).toBeNull();
		expect(duocSu.quote).toEqual({ text: "Lời dạy về Dược Sư.", author: "Vô Trí - Tâm Hòa" });
		expect(statueArticle(thichCa).contentHtml).toBe("<p>Dưới chân dãy Himalaya.</p>\n<p>Người đời gọi Ngài là bậc xuất thân dòng dõi Thái Dương.</p>");
	});

	it("does not call a catch-all name a group: the section's own name or the works of art", () => {
		const { statues } = parseStatues([statue({ clusterName: "Bảo Tượng Phật Giáo" }), statue({ clusterName: "Nghệ Thuật Phật Giáo" }), statue({ clusterName: "Thập đại đệ tử" })]);
		expect(statues.map((item) => item.cluster)).toEqual(["", "", "Thập đại đệ tử"]);
	});

	it("never lets the editors' HTML through: only the paragraphs' text is kept", () => {
		const { statues } = parseStatues([statue({ fullHistoryHtml: '<p>Lành <script>alert(1)</script><a href="javascript:x" onclick="y">mạnh</a></p>' })]);
		expect(statueArticle(statues[0]).contentHtml).toBe("<p>Lành alert(1)mạnh</p>");
	});

	it("links a work of art to the statue it is, when that statue is in the file", () => {
		const { statues } = parseStatues([
			statue({ artVariations: [{ id: "TP0002", title: "Chuyển Pháp Luân", location: "Sân Di Đà", meaning: "Trung đạo.", imgUrl: "" }, { id: "TP9999", title: "Không có", location: "", meaning: "", imgUrl: "" }] }),
			statue({ id: "TP0002", code: "TP0002", slug: "duc_phat_chuyen_phap_luan_tp0002", categoryType: "NTPG" }),
		]);
		expect(statues[0].art.map((item) => [item.title, item.href])).toEqual([
			["Chuyển Pháp Luân", "/bao-tuong/duc_phat_chuyen_phap_luan_tp0002"],
			["Không có", null],
		]);
	});
});

describe("the statue list", () => {
	const { statues: entries } = parseStatues([
		statue({}),
		statue({ id: "TP0018", code: "TP0018", slug: "duc_phat_duoc_su_tp0018", name: "ĐỨC PHẬT DƯỢC SƯ", clusterName: "Đông Phương Tam Thánh" }),
		statue({ id: "TP0039", code: "TP0039", slug: "nhat_quang_bo_tat_tp0039", name: "NHẬT QUANG BỒ TÁT", assemblyId: "thanh_tinh", assemblyName: "Thanh Tịnh Đại Hải Chúng", clusterName: "Đông Phương Tam Thánh" }),
		statue({ id: "TP0002", code: "TP0002", slug: "chuyen_phap_luan_tp0002", categoryType: "NTPG", areaSlug: "san_di_da", clusterName: "Nghệ Thuật Phật Giáo" }),
		statue({ id: "TP0051", code: "TP0051", slug: "la_han_tp0051", name: "THẬP BÁT LA HÁN", areaSlug: "cong_thap", assemblyId: "thanh_van", assemblyName: "Thanh Văn Thánh Chúng", clusterName: "Thập Bát La Hán" }),
	]);
	const statues = entries.map(statueSummary);
	const ids = (list: { id: string }[]) => list.map((item) => item.id);

	it("reads and writes its query on the URL, leaving out what is empty", () => {
		const query = readStatueQuery({ q: " phật ", "chung-hoi": "chu_phat_hai_hoi", "khu-vuc": "", loai: "tuong-chinh", trang: "2" });
		expect(query).toEqual({ q: "phật", assembly: "chu_phat_hai_hoi", area: "", kind: "tuong-chinh", page: 2 });
		expect(statueListHref(query)).toBe("/bao-tuong-phat-giao?q=ph%E1%BA%ADt&chung-hoi=chu_phat_hai_hoi&loai=tuong-chinh&trang=2");
		expect(statueListHref({ ...query, q: "", assembly: "", kind: "", page: 1 })).toBe("/bao-tuong-phat-giao");
		expect(readStatueQuery({ trang: "-3" }).page).toBe(1);
	});

	it("filters by assembly, area and kind, and finds by name without marks or by code", () => {
		const all = readStatueQuery({});
		expect(ids(filterStatues(statues, { ...all, assembly: "chu_phat_hai_hoi" }))).toEqual(["TP0001", "TP0018", "TP0002"]);
		expect(ids(filterStatues(statues, { ...all, area: "san-di-da" }))).toEqual(["TP0002"]);
		expect(ids(filterStatues(statues, { ...all, kind: "nghe-thuat" }))).toEqual(["TP0002"]);
		expect(ids(filterStatues(statues, { ...all, kind: "khong-co" }))).toEqual([]);
		expect(ids(filterStatues(statues, { ...all, q: "duoc su" }))).toEqual(["TP0018"]);
		expect(ids(filterStatues(statues, { ...all, q: "tp0039" }))).toEqual(["TP0039"]);
	});

	it("knows a statue's area through the file's own area names, none for the unclaimed ones", () => {
		expect(areaOfStatue(statues[0])).toBe("tam-bao");
		expect(areaOfStatue(statues[4])).toBeNull();
	});

	it("shows beside a statue the main statues of its group, then of its assembly", () => {
		expect(ids(relatedStatues(statues[1], statues))).toEqual(["TP0039", "TP0001"]);
		expect(ids(relatedStatues(statues[0], statues))).toEqual(["TP0018"]);
	});

	it("knows a group however its name is capitalised", () => {
		const disciples = parseStatues([
			statue({ id: "TP0060", code: "TP0060", slug: "a_tp0060", assemblyId: "x", clusterName: "Thập Đại Đệ Tử" }),
			statue({ id: "TP0061", code: "TP0061", slug: "b_tp0061", assemblyId: "y", clusterName: "Thập đại đệ tử" }),
		]).statues.map(statueSummary);
		expect(ids(relatedStatues(disciples[0], disciples))).toEqual(["TP0061"]);
	});

	it("keeps the 126 statues of the real data at their old addresses", () => {
		if (!existsSync("data/snapshot/bao-tuong.json")) return;
		const real = parseStatues(JSON.parse(readFileSync("data/snapshot/bao-tuong.json", "utf8"))).statues;
		expect(real).toHaveLength(126);
		expect(new Set(real.map((item) => item.slug)).size).toBe(126);
		const thichCa = real.find((item) => item.id === "TP0001")!;
		expect(thichCa.href).toBe("/bao-tuong/duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001");
		expect(statueArticle(thichCa).contentHtml).toMatch(/^<p>Dưới chân dãy Himalaya/);
		expect(thichCa.art.every((item) => item.href)).toBe(true);
	});
});
