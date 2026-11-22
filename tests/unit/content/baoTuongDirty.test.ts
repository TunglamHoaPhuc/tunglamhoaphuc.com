import { describe, expect, it } from "vitest";
import { parseStatues, statueArticle } from "@/libs/content/baoTuong";

const statue = (extra: Record<string, unknown>) => ({
	id: "TP0001",
	code: "TP0001",
	slug: "duc_phat_thich_ca_mau_ni_vo_thuong_nang_nhan_tp0001",
	name: "ĐỨC PHẬT THÍCH CA MÂU NI",
	title: "ĐỨC PHẬT THÍCH CA MÂU NI",
	categoryType: "TƯỢNG CHÍNH",
	articleContent: "Đoạn một.\n\nĐoạn hai.\n\n2",
	fullHistoryHtml: "",
	artVariations: [],
	...extra,
});

describe("lỗi dữ liệu Bảo Tượng nhìn thấy trên bản live (RV-11)", () => {
	it("bỏ đoạn cuối chỉ có một con số (số trang lẫn vào bài)", () => {
		const { statues } = parseStatues([statue({})]);
		expect(statueArticle(statues[0]).contentHtml).toBe("<p>Đoạn một.</p>\n<p>Đoạn hai.</p>");
	});

	it("giữ con số khi nó nằm giữa bài", () => {
		const { statues } = parseStatues([statue({ articleContent: "Đoạn một.\n\n2\n\nĐoạn hai." })]);
		expect(statueArticle(statues[0]).contentHtml).toContain("<p>2</p>");
	});

	it("đổi mã thô LAM_TI_NI ở nơi đặt tượng thành tên đọc được", () => {
		const { statues } = parseStatues([statue({ artVariations: [{ id: "TP0009", title: "Đản Sanh", location: "LAM_TI_NI", meaning: "", imgUrl: "" }] })]);
		expect(statues[0].art[0].location).toBe("Lâm Tỳ Ni");
	});
});
