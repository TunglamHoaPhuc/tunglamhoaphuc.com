// What the Vũ Trụ Phật Giáo pages need beyond the admin's data. T36 moves these into the
// admin; until then Ban Biên Tập asks for changes here.

export const vuTru = {
	title: "Vũ Trụ Phật Giáo",
	path: "/vu-tru-phat-giao",
	// The old page's words.
	lead: "Sơ đồ không gian kiến trúc & hệ thống tự viện Tùng Lâm Hòa Phúc.",
	temple: "tung-lam-hoa-phuc",

	// The 2D drawing of the temple the old site's map uses (B2, 04-vu-tru-phat-giao), at the
	// address the area covers use for the same file, so it is fetched once.
	map: {
		src: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/04-vu-tru-phat-giao/canh-1.webp",
		width: 1920,
		height: 1087,
	},

	// The picture of each area, as the old site's list shows it: its own set of twelve in B2
	// (04-vu-tru-phat-giao/khu-vuc), by area slug. The admin's imgUrl is a stand-in for most areas
	// (the whole-temple view four times, a book cover for the library), so these come first.
	// Sân La Hán and Lầu Kinh Luân are not on the old list, but their pictures are in the folder.
	coverFolder: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/04-vu-tru-phat-giao/khu-vuc",
	covers: {
		"tam-bao": "tam-bao.webp",
		"to-duong": "to-duong.webp",
		"dai-nam-quoc-mau": "dai-nam-quoc-mau.webp",
		"bao-tang": "bao-tang.webp",
		"bao-thap-van-phat-xa-loi": "bao-thap.webp",
		"giang-duong": "giang-duong.webp",
		"tu-an": "tu-an.webp",
		"tang-kinh-cac": "tang-kinh-cac-v2.webp",
		"trai-duong": "trai-duong.webp",
		"san-di-da": "san-di-da.webp",
		"cong-tam-quan": "cong-tam-quan.webp",
		"lang-xa-tam-linh": "lang-xa-tam-linh.webp",
		"san-la-han": "san-la-han.webp",
		"ho-phong-sinh": "lau-kinh-luan.webp",
	} as Record<string, string>,

	// The pins, in the old map's order (a walk from Lầu Kinh Luân by the river to Sân La Hán),
	// at the old map's places, in % of the drawing. The admin's mapPos is out of date for nine
	// areas (their pins fall on the lawn or the car park); npm run snapshot:check lists them.
	// The old map's pin "Lâm Tỳ Ni" (65%, 52%) has no area in the data and is left out.
	pins: [
		{ slug: "ho-phong-sinh", x: 6, y: 46 },
		{ slug: "cong-tam-quan", x: 30, y: 52 },
		{ slug: "to-duong", x: 50, y: 42 },
		{ slug: "tam-bao", x: 50, y: 49 },
		{ slug: "dai-nam-quoc-mau", x: 53, y: 66 },
		{ slug: "bao-tang", x: 56, y: 76 },
		{ slug: "bao-thap-van-phat-xa-loi", x: 47, y: 15 },
		{ slug: "giang-duong", x: 71, y: 39 },
		{ slug: "tang-kinh-cac", x: 76, y: 23 },
		{ slug: "tu-an", x: 67, y: 27 },
		{ slug: "trai-duong", x: 64, y: 14 },
		{ slug: "san-di-da", x: 57, y: 33 },
		{ slug: "lang-xa-tam-linh", x: 42, y: 57 },
		{ slug: "san-la-han", x: 42, y: 79 },
	],

	// Which statues stand in each area: the Bảo Tượng file names areas its own way
	// ("nha_mau" for Đại Nam Quốc Mẫu, "lau_kinh_luan" for the area still slugged
	// ho-phong-sinh). Matched by the names the file gives them; "cong_thap" (Cổng Tháp) has no
	// area and is reported.
	statueAreas: {
		"tam-bao": ["tam_bao"],
		"to-duong": ["to_duong"],
		"dai-nam-quoc-mau": ["nha_mau"],
		"bao-tang": ["bao_tang"],
		"bao-thap-van-phat-xa-loi": ["bao_thap"],
		"giang-duong": ["giang_duong"],
		"tu-an": ["vang_sinh_duong", "tu_an"],
		"san-di-da": ["san_di_da"],
		"cong-tam-quan": ["san_di_lac", "san_lam_ty_ni", "lam_ti_ni"],
		"san-la-han": ["san_la_han"],
		"ho-phong-sinh": ["lau_kinh_luan"],
	} as Record<string, string[]>,
};
