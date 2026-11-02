// Temple details and navigation shared by the header, mobile menu and (later) footer and
// contact page. Change the menu or a phone number here only; T29 moves these values into
// the admin "Cấu hình" module.

export type NavLink = {
	label: string;
	href: string;
	/** Gold brand icon shown in the dropdown, from public/brand/icons. */
	image?: string;
};

export type NavItem = NavLink & {
	/** Items of a dropdown. The parent then becomes a button; `href` is its overview page. */
	children?: NavLink[];
};

export type Contact = { role: string; name: string; phone: string };

/** "0979345373" → "0979.345.373", the way the temple writes numbers. */
export function formatPhone(digits: string): string {
	return digits.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1.$2.$3");
}

export const site = {
	name: "Tùng Lâm Hòa Phúc",
	slogan: "Nơi để trở về – Chốn thiêng bình yên",
	address: "Thôn Hòa Trúc – Xã Phú Cát – TP Hà Nội",

	// Mộc Ấn seal from the temple's brand kit (bo-nhan-dien/01_Logo_Chinh_Thuc).
	logo: {
		src: "/brand/logo-moc-an.webp",
		width: 400,
		height: 297,
	},

	// Main number behind the header "Gọi điện" button: Trưởng ban lãnh chúng.
	phone: "0979345373",
	contacts: [
		{ role: "Trưởng ban lãnh chúng", name: "Phật tử Bảo Trâm", phone: "0979345373" },
		{ role: "Thư ký", name: "Phật tử Liên Vi", phone: "0961533271" },
		{ role: "Thư ký", name: "Phật tử Liên Nghi", phone: "0984569134" },
		{ role: "Hỗ trợ thông tin", name: "Phật tử Tịnh Hoàng", phone: "0919366751" },
		{ role: "Hỗ trợ thông tin", name: "Phật tử Liên Hương", phone: "0348198196" },
		{ role: "Hỗ trợ thông tin", name: "Tịnh Hòa Hưng", phone: "0329630394" },
		{ role: "Hỗ trợ thông tin", name: "Liên Phúc Huyền", phone: "0328812922" },
	] satisfies Contact[],
	openingHours: "Sáng 7:30 – 10:30 · Chiều 13:30 – 17:30 (ngày thường)",

	// Search link until the temple sends its own Google Maps place link (GD-06).
	mapsUrl: "https://www.google.com/maps/search/?api=1&query=Ch%C3%B9a+T%C3%B9ng+L%C3%A2m+H%C3%B2a+Ph%C3%BAc+H%C3%B2a+Tr%C3%BAc+Ph%C3%BA+C%C3%A1t+H%C3%A0+N%E1%BB%99i",

	// Official page links are still pending (GD-06); empty entries are not rendered.
	social: [] as NavLink[],

	features: {
		// The header search button waits for the /tim-kiem page (T18); T5b finishes the popup.
		search: false,
	},

	// Points to the registration notes on the schedule page until /dang-ky exists (T39).
	register: { label: "Đăng ký khóa tu", href: "/lich-tu-hoc#khoa-tu" },

	nav: [
		{
			label: "Giới thiệu",
			href: "/gioi-thieu",
			children: [
				{ label: "Lịch sử Bổn tự", href: "/gioi-thieu/lich-su-bon-tu", image: "/brand/icons/icon-dau-an-hoang-phap.webp" },
				{ label: "Chư Tôn Đức", href: "/gioi-thieu/chu-ton-duc", image: "/brand/icons/icon-quote-chu-de.webp" },
				{ label: "Thanh quy", href: "/gioi-thieu/thanh-quy", image: "/brand/icons/icon-phap-am.webp" },
				{ label: "Vũ Trụ Phật Giáo", href: "/vu-tru-phat-giao", image: "/brand/icons/icon-cac-khu-vuc-noi-bat.webp" },
				{ label: "Bảo Tượng Phật Giáo", href: "/bao-tuong-phat-giao", image: "/brand/icons/icon-cac-bao-tuong-noi-bat.webp" },
			],
		},
		{
			label: "Tin tức – Pháp thoại",
			href: "/dong-chay-hoang-phap",
			children: [
				{ label: "Dòng Chảy Hoằng Pháp", href: "/dong-chay-hoang-phap", image: "/brand/icons/icon-dong-chay-hoang-phap.webp" },
				{ label: "Tông Chỉ Tu Học", href: "/tong-chi-tu-hoc", image: "/brand/icons/icon-tong-chi-tu-hoc.webp" },
				{ label: "Trí Tuệ Phật Pháp", href: "/tri-tue-phat-phap", image: "/brand/icons/icon-tri-tue-phat-phap.webp" },
			],
		},
		{ label: "Lịch tu học", href: "/lich-tu-hoc" },
		{ label: "Đăng ký khóa tu", href: "/lich-tu-hoc#khoa-tu" },
		{ label: "Liên hệ", href: "/lien-he" },
	] as NavItem[],
};
