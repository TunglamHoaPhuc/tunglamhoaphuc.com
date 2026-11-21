// The API's answers for categories, menus and icons, as the screens use them.
export type IconType = "none" | "library" | "svg" | "image";

export type IconValue = {
	iconType: IconType;
	iconName: string;
	iconSvg: string;
	iconMediaId: string | null;
	iconUrl: string;
	iconColor: string;
};

export const NO_ICON: IconValue = { iconType: "none", iconName: "", iconSvg: "", iconMediaId: null, iconUrl: "", iconColor: "" };

export type Counts = { posts: number; teachings: number; pages: number; events: number; statues: number; children: number };

export type CategoryRow = IconValue & {
	id: string;
	kind: string;
	section: string;
	slug: string;
	name: string;
	position: number;
	colorToken: string | null;
	parentId: string | null;
	depth: number;
	description: string;
	template: string;
	visible: boolean;
	seoTitle: string;
	seoDescription: string;
	ogMediaId: string | null;
	path: string;
	counts: Counts;
	used: number;
};

export type MenuItemRow = IconValue & {
	id: string;
	menuId: string;
	parentId: string | null;
	position: number;
	depth: number;
	label: string;
	linkType: "category" | "page" | "url";
	categoryId: string | null;
	href: string;
	openNewTab: boolean;
	visible: boolean;
};

export type MenuData = { id: string; name: string; items: MenuItemRow[]; shownLevels: number | null; warnings: string[] };

export type IconHit = { name: string; keywords: string; svg: string };

export const KIND_LABELS: Record<string, string> = {
	post: "Chuyên mục bài viết",
	"tong-chi": "Nhóm bài Tông chỉ tu học",
	about: "Nhóm trang Giới thiệu",
	event: "Loại sự kiện lịch tu học",
	assembly: "Hội chúng bảo tượng",
};

export const SECTION_LABELS: Record<string, string> = {
	"dong-chay-hoang-phap": "Dòng Chảy Hoằng Pháp",
	"tri-tue-phat-phap": "Trí Tuệ Phật Pháp",
	"vu-tru-phat-giao": "Vũ Trụ Phật Giáo",
};

export const TEMPLATE_LABELS: Record<string, string> = {
	"": "Mặc định theo loại",
	"tin-tuc": "Danh sách tin tức",
	"thu-vien-bao-tuong": "Thư viện bảo tượng",
	"trang-tinh": "Trang giới thiệu tĩnh",
	lich: "Lịch",
	"tong-chi": "Tông chỉ tu học",
};
