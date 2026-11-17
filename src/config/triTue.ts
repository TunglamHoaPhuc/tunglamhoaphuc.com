// Trí Tuệ Phật Pháp beyond its posts: the old site's two reading rooms, each an app of its own
// at an address under the section. Here they get a page made on the server (what they are,
// their contents) that opens the app, which stays on the old site until it moves over
// before www does (T22). What the data lacks is written here: the contents and the book's
// publisher, read from the old apps on 13/11/2026.

import { sachDiQuaKhoVui } from "./sachDiQuaKhoVui";

export type ContentsEntry = { title: string; pages: string };

export const book = {
	path: "/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi",
	/** As the Giới thiệu topic of Thầy Thích Tâm Hòa names it, for its cover and description. */
	title: "Đi Qua Khổ Vui Cuộc Đời",
	volume: "Quyển 1",
	author: "Sa Môn Vô Trí (hiệu Thích Tâm Hòa)",
	publisher: "NXB Hồng Đức",
	printedPages: 217,
	/** The post that presents the book, which leads here. */
	postSlug: "tac-pham-di-qua-kho-vui-cuoc-doi",
	/** The whole text, on this page (T17b); the old site's reader had it at the same address. */
	readerUrl: "/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi#toan-van",
	contents: [
		{ title: "Trang Lót & Đi Cùng Tôi", pages: "1–8" },
		{ title: "Lời Giới Thiệu", pages: "9–10" },
		{ title: "Chương 1: Yêu Thương Bắt Đầu", pages: "11–48" },
		{ title: "Chương 2: Có Mặt Cho Nhau", pages: "49–94" },
		{ title: "Chương 3: Không Còn Sợ Hãi", pages: "95–149" },
		{ title: "Chương 4: Ruộng Tốt Cho Người", pages: "150–199" },
		{ title: "Đã Về Đã Tới & Lịch Sử Tùng Lâm", pages: "200–217" },
	] as ContentsEntry[],
};

export const tibetan = {
	path: "/tri-tue-phat-phap/hoc-tieng-tang",
	title: "Học Tiếng Tạng (Sara Book)",
	// The old page's words.
	lead: "Học nghiên cứu tiếng Tạng qua bộ giáo trình Sara Book — công cụ học thuật quan trọng dành cho những ai muốn thâm nhập kho tàng triết học Phật giáo Tây Tạng nguyên bản.",
	pages: 120,
	appUrl: "/tibetan-study/index.html",
	/** What the app offers, as its own screens name it. */
	features: [
		"Đọc giáo trình Sara Book, phóng to thu nhỏ từng trang",
		"Nghe giọng đọc tiếng Tạng cho từng chữ cái và từ vựng",
		"Khoanh một từ hay một câu trên trang để trợ lý AI dịch, giảng ngữ pháp và ý nghĩa Phật học",
		"Luyện phát âm: ghi âm giọng mình và xem độ chuẩn xác",
		"Ôn tập từ vựng bằng thẻ ghi nhớ (flashcard)",
	],
	/** The lessons of the book and their pages (sara_book_data.json). */
	contents: [
		{ title: "Lời Mở Đầu", pages: "1–2" },
		{ title: "Bài 1: 30 Phụ Âm Gốc (གསལ་བྱེད་སུམ་ཅུ)", pages: "3–5" },
		{ title: "Bài 2: 4 Nguyên Âm & Cách Đọc (དབྱངས་བཞི)", pages: "6" },
		{ title: "Bài 3: Bài Hát Chữ Cái (ཀ་གཞས)", pages: "7" },
		{ title: "Bài 4: Chữ Chèn Trên Mgo-can (མགོ་ཅན - Ra-mgo)", pages: "8" },
		{ title: "Bài 5: Chữ Chèn Trên La-mgo (ལ་མགོ་བཅུ)", pages: "9" },
		{ title: "Bài 6: Chữ Chèn Dưới 'Dogs-can (འདོགས་ཅན - Ya-btags)", pages: "10" },
		{ title: "Bài 7: Chữ Chèn Dưới Ra-btags & La-btags (ར་བཏགས་དང་ལ་བཏགས)", pages: "11" },
		{ title: "Bài 8: Chữ Chèn Dưới Wa-zur (ཝ་ཟུར་བཅུ་གསུམ)", pages: "12" },
		{ title: "Bài 9: Chữ Đảo Ngược Phạn Văn (ལོག་ཡིག)", pages: "13" },
		{ title: "Bài 10: Tiền Tự - Chèn Trước (སྔོན་འཇུག - ག ད བ མ འ)", pages: "14" },
		{ title: "Bài 11: Hậu Tự & Hậu Hậu Tự (རྗེས་འཇུག་དང་ཡང་འཇུག)", pages: "15" },
		{ title: "Bài 12: Đánh Vần Từ Ghép Phức Hợp", pages: "16–19" },
		{ title: "Bài 13: Đại Từ Nhân Xưng & Chào Hỏi Cơ Bản", pages: "20–24" },
		{ title: "Bài 14: Động Từ Tồn Tại (ཡིན / རེད / ཡོད / འདུག)", pages: "25–29" },
		{ title: "Bài 15: Sở Hữu Cách & Chỉ Định Từ", pages: "30–34" },
		{ title: "Bài 16: Số Từ & Đếm Tiền, Thời Gian", pages: "35–39" },
		{ title: "Bài 17: Hỏi Đường & Phương Hướng", pages: "40–49" },
		{ title: "Bài 18: Thì Quá Khứ (དུས་འདས་པ)", pages: "50–59" },
		{ title: "Bài 19: Cuộc Sống Tại Tu Viện & Trường Học", pages: "60–69" },
		{ title: "Bài 20: Đàm Thoại Mua Bán & Ẩm Thực Tạng", pages: "70–79" },
		{ title: "Bài 21: Mua Sắm Y Phục & Thuật Ngữ", pages: "80–89" },
		{ title: "Bài 22: Y Học & Sức Khỏe Truyền Thống Tạng (སྨན་རྩིས་ཁང་)", pages: "90–99" },
		{ title: "Bài 23: Gia Đình & Phong Tục Tây Tạng", pages: "100–109" },
		{ title: "Bài 24: Lễ Hội & Văn Hóa Phật Giáo Tây Tạng", pages: "110–120" },
	] as ContentsEntry[],
};

/** A piece of the book: a poem, an essay, the dedication or the printer's note. */
export type BookSection = { type: string; title: string; pageNumber: number; author?: string; content: string };
export type BookChapter = { title: string; pageRange: string; quote: string; quoteAuthor: string; intro?: string; sections: BookSection[] };

/**
 * The text of Quyển 1 as the old site's reader shows it ("Đọc Văn Bản"): seven parts, 29
 * pieces, taken from its code on 17/11/2026 (T17b). Not every one of the 217 printed pages:
 * the old reader leafed through page pictures for those, which no longer load there.
 */
export const bookText: { isbn: string; chapters: BookChapter[] } = sachDiQuaKhoVui;
