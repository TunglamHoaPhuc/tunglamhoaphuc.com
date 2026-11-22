// Temple details and navigation shared by the header, mobile menu, footer and the contact
// page. Change the menu or a phone number here only; T29 moves these values into the admin
// "Cấu hình" module.

export type NavLink = {
	label: string;
	href: string;
	/** Gold brand icon shown in the dropdown, from public/brand/icons: only the icon drawn for that
	 * section (bo-nhan-dien/README says which is which). Without one the item gets a gold dot. */
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

/** Contacts grouped under their role, in the order the roles first appear. */
export function contactGroups(contacts: Contact[]): { role: string; people: Contact[] }[] {
	const groups: { role: string; people: Contact[] }[] = [];
	for (const contact of contacts) {
		const group = groups.find(({ role }) => role === contact.role);
		if (group) group.people.push(contact);
		else groups.push({ role: contact.role, people: [contact] });
	}
	return groups;
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
	// The evening repentance (sám hối) service, shown in the footer.
	repentance: { time: "19:00", days: "ngày 8, 14, 23 và 29 (hoặc 30) âm lịch" },

	// The Google Maps place link the project owner gave (GD-06): the place "Chùa Hòa Phúc",
	// 20.9535019, 105.5713597 (xóm Hòa Trúc, xã Phú Cát, Hà Nội).
	mapsUrl: "https://maps.app.goo.gl/PSTtcjcJsaXvLCp37",
	// Static map picture for the footer, if one is ever made.
	mapImage: null as { src: string; width: number; height: number } | null,
	// The embedded Google map on /lien-he (no API key). It is heavy and sets Google cookies;
	// the owner chose that trade-off over a static picture.
	mapEmbed: {
		src: "https://www.google.com/maps?q=20.9535019,105.5713597&z=17&output=embed",
		title: "Bản đồ đường đến chùa Tùng Lâm Hòa Phúc",
	},

	// Official page links are still pending (GD-06); empty entries are not rendered.
	social: [] as SocialLink[],

	// No notice for now; T29 moves this into the admin. Example:
	// { id: "2026-12-vu-lan", text: "Khóa tu mùa đông mở đăng ký từ 01/12.", link: { label: "Xem lịch", href: "/lich-tu-hoc" }, expires: "2026-12-31" }
	announcement: null as Announcement | null,

	features: {
		// The header search button and popup (T5b), sending to /tim-kiem (T18).
		search: true,
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
				{ label: "Lịch sử Bổn tự", href: "/gioi-thieu/lich-su-tung-lam-hoa-phuc", image: "/brand/logo-tung-lam-hoa-phuc-tron-nga.webp" },
				{ label: "Chư Tôn Đức", href: "/gioi-thieu#nguoi-lien-quan" },
				{ label: "Thanh quy", href: "/gioi-thieu/van-hoa-ung-xu" },
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
		// "Đăng ký khóa tu" is the gold button at the right of the header (`register` above),
		// so it is not repeated as a menu item (17/11/2026).
		{ label: "Lịch tu học", href: "/lich-tu-hoc" },
		{ label: "Liên hệ", href: "/lien-he" },
	] as NavItem[],
};
