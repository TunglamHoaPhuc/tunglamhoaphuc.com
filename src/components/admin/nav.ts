// The admin menu, and the permission each entry needs. src/components/admin/pagePermissions.ts builds the permission of every
// page from it, so a link in the menu and the page behind it can never disagree.
export type NavItem = { href: string; label: string; needs?: [string, string] };

// Only what exists is listed; each module adds its links here when it lands.
export const NAV: { group?: string; items: NavItem[] }[] = [
	{ items: [{ href: "/quan-tri", label: "Tổng quan" }] },
	{
		group: "Nội dung",
		items: [
			{ href: "/quan-tri/bai-viet", label: "Bài viết", needs: ["posts", "view"] },
			{ href: "/quan-tri/tong-chi", label: "Bài Tông chỉ tu học", needs: ["teachings", "view"] },
			{ href: "/quan-tri/gioi-thieu", label: "Trang Giới thiệu", needs: ["pages", "view"] },
			{ href: "/quan-tri/media", label: "Thư viện Media", needs: ["media", "view"] },
		],
	},
	{
		group: "Cấu trúc trang",
		items: [
			{ href: "/quan-tri/chuyen-muc", label: "Chuyên mục", needs: ["categories", "view"] },
			{ href: "/quan-tri/menu", label: "Menu và icon", needs: ["menus", "view"] },
			{ href: "/quan-tri/trang-chu", label: "Trang chủ", needs: ["home", "view"] },
		],
	},
	{
		group: "Tu học và bảo tượng",
		items: [
			{ href: "/quan-tri/lich-tu-hoc", label: "Lịch tu học và sự kiện", needs: ["events", "view"] },
			{ href: "/quan-tri/bao-tuong", label: "Bảo tượng", needs: ["statues", "view"] },
			{ href: "/quan-tri/khu-vuc", label: "Khu vực", needs: ["areas", "view"] },
			{ href: "/quan-tri/loi-thay-day", label: "Lời Thầy dạy", needs: ["quotes", "view"] },
		],
	},
	{
		group: "Vận hành",
		items: [
			{ href: "/quan-tri/seo", label: "SEO", needs: ["seo", "view"] },
			{ href: "/quan-tri/chuyen-huong", label: "Chuyển hướng 301", needs: ["redirects", "view"] },
			{ href: "/quan-tri/thung-rac", label: "Thùng rác", needs: ["trash", "view"] },
			{ href: "/quan-tri/nhat-ky", label: "Nhật ký hoạt động", needs: ["audit", "view"] },
			{ href: "/quan-tri/cau-hinh", label: "Cấu hình hệ thống", needs: ["settings", "view"] },
			{ href: "/quan-tri/sao-luu", label: "Sao lưu", needs: ["backup", "view"] },
		],
	},
	{
		group: "Hệ thống",
		items: [
			{ href: "/quan-tri/tai-khoan", label: "Tài khoản", needs: ["users", "view"] },
			{ href: "/quan-tri/vai-tro", label: "Vai trò và quyền", needs: ["roles", "view"] },
		],
	},
	{ group: "Của tôi", items: [{ href: "/quan-tri/ho-so", label: "Hồ sơ và bảo mật" }] },
];

