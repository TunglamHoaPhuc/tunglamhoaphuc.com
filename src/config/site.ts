// Temple details and navigation shared by the header, mobile menu, footer and (later) the
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

/** An official page of the temple; `icon` is a Font Awesome class such as "fa-brands fa-facebook-f". */
export type SocialLink = { label: string; href: string; icon: string };

/** Static notice above the header (UX-02). Visitors can close it for the session. */
export type Announcement = {
	/** Change it with the text, so a new notice shows again to people who closed the old one. */
	id: string;
	text: string;
	link?: { label: string; href: string };
	/** Last day to show it, YYYY-MM-DD in Vietnam time. */
	expires?: string;
};

/** "0979345373" → "0979.345.373", the way the temple writes numbers. */
export function formatPhone(digits: string): string {
	return digits.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1.$2.$3");
}

export const site = {
	name: "Tùng Lâm Hòa Phúc",
	slogan: "Nơi để trở về – Chốn thiêng bình yên",
	address: "Thôn Hòa Trúc – Xã Phú Cát – TP Hà Nội",

	// Draft for the footer, to be confirmed by Ban Truyền Thông.
	intro: "Chốn tu học và lễ bái giữa đất trời Phú Cát, kính mời quý Phật tử gần xa về tham dự khóa tu, cộng tu và các đại lễ trong năm.",

	// Mộc Ấn seal from the temple's brand kit (bo-nhan-dien/01_Logo_Chinh_Thuc).
	logo: {
		src: "/brand/logo-moc-an.webp",
		width: 400,
		height: 297,
	},
	// The round seal (bo-nhan-dien/09-icon-minh-hoa) redrawn in ivory for dark grounds.
	sealLight: {
		src: "/brand/logo-tung-lam-hoa-phuc-tron-nga.webp",
		width: 320,
		height: 320,
	},

	// Change once a year, on Phật đản (the Buddhist year turns over then, not on 1 January).
	copyright: "© Phật lịch 2570 – 2026 Tùng Lâm Hòa Phúc",

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
	// Static map picture for the footer, made once the exact place is known (GD-06). A
	// picture instead of an embedded Google map, which is heavy and sets cookies.
	mapImage: null as { src: string; width: number; height: number } | null,

	// Official page links are still pending (GD-06); empty entries are not rendered.
	social: [] as SocialLink[],

	// No notice for now; T29 moves this into the admin. Example:
	// { id: "2026-12-vu-lan", text: "Khóa tu mùa đông mở đăng ký từ 01/12.", link: { label: "Xem lịch", href: "/lich-tu-hoc" }, expires: "2026-12-31" }
	announcement: null as Announcement | null,

	features: {
		// The header search button waits for the /tim-kiem page (T18); T5b finishes the popup.
		search: false,
	},

	// Points to the registration notes on the schedule page until /dang-ky exists (T39).
	register: { label: "Đăng ký khóa tu", href: "/lich-tu-hoc#khoa-tu" },

	// Frame 1 of the home hero. The picture is "toàn cảnh chùa" from the Vũ Trụ Phật Giáo
	// album (B2 04-vu-tru-phat-giao), resized into public/images/hero: 1920 and 1280 wide,
	// an upright crop for phones and a small square for the thumbnail row.
	hero: {
		title: "Nơi để trở về",
		accent: "trở về",
		subtitle: "Chốn thiêng bình yên",
		link: { label: "Tìm hiểu Bổn tự", href: "/gioi-thieu" },
		image: {
			src: "/images/hero/toan-canh-chua-1920.webp",
			srcSet: "/images/hero/toan-canh-chua-1280.webp 1280w, /images/hero/toan-canh-chua-1920.webp 1920w",
			portrait: "/images/hero/toan-canh-chua-doc-760.webp",
			thumb: "/images/hero/toan-canh-chua-nho.webp",
			position: "center 60%",
		},
	},

	// "CHỐN THIÊNG BÌNH YÊN – TÙNG LÂM HÒA PHÚC" on the temple's YouTube channel, the old home
	// page's background video; Lời chào opens it in the lightbox.
	introVideo: { id: "HE2MnR8Hl5c", title: "Chốn thiêng bình yên – Tùng Lâm Hòa Phúc" },

	// The six ways in under the home hero, as on the old site's home page.
	entrances: [
		{ label: "Giới thiệu", href: "/gioi-thieu", image: "/brand/logo-tung-lam-hoa-phuc-tron-nga.webp" },
		{ label: "Tông Chỉ Tu Học", href: "/tong-chi-tu-hoc", image: "/brand/icons/icon-tong-chi-tu-hoc.webp" },
		{ label: "Dòng Chảy Hoằng Pháp", href: "/dong-chay-hoang-phap", image: "/brand/icons/icon-dong-chay-hoang-phap.webp" },
		{ label: "Vũ Trụ Phật Giáo", href: "/vu-tru-phat-giao", image: "/brand/icons/icon-cac-khu-vuc-noi-bat.webp" },
		{ label: "Bảo Tượng Phật Giáo", href: "/bao-tuong-phat-giao", image: "/brand/icons/icon-cac-bao-tuong-noi-bat.webp" },
		{ label: "Trí Tuệ Phật Pháp", href: "/tri-tue-phat-phap", image: "/brand/icons/icon-tri-tue-phat-phap.webp" },
	] as NavLink[],

	nav: [
		{
			label: "Giới thiệu",
			href: "/gioi-thieu",
			children: [
				// Slugs of the Giới thiệu topics; Chư Tôn Đức is the group of the four teachers.
				{ label: "Lịch sử Bổn tự", href: "/gioi-thieu/lich-su-tung-lam-hoa-phuc", image: "/brand/icons/icon-dau-an-hoang-phap.webp" },
				{ label: "Chư Tôn Đức", href: "/gioi-thieu#nguoi-lien-quan", image: "/brand/icons/icon-quote-chu-de.webp" },
				{ label: "Thanh quy", href: "/gioi-thieu/van-hoa-ung-xu", image: "/brand/icons/icon-phap-am.webp" },
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
