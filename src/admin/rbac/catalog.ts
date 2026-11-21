// What can be permitted (module x action) and the four roles the seed makes. The catalogue lives in
// code, not in a table: a new module is new code, so the list travels with it. The `role_permission`
// table only says which role may do which.
export const ACTIONS = ["view", "create", "update", "delete", "publish"] as const;
export type Action = (typeof ACTIONS)[number];

export const MODULES = {
	dashboard: "Tổng quan",
	posts: "Bài viết",
	teachings: "Bài Tông chỉ tu học",
	pages: "Trang Giới thiệu",
	categories: "Chuyên mục",
	menus: "Menu và icon",
	media: "Thư viện Media",
	home: "Trang chủ",
	events: "Lịch tu học và sự kiện",
	statues: "Bảo tượng",
	areas: "Khu vực (Vũ trụ Phật giáo)",
	quotes: "Lời Thầy dạy",
	seo: "SEO",
	redirects: "Chuyển hướng 301",
	settings: "Cấu hình hệ thống",
	users: "Tài khoản",
	roles: "Vai trò và quyền",
	audit: "Nhật ký hoạt động",
	trash: "Thùng rác",
	backup: "Sao lưu",
} as const;
export type ModuleKey = keyof typeof MODULES;

export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

export type Scope = "all" | "own";
/** `module.action` -> scope. */
export type Permissions = ReadonlyMap<string, Scope>;

export const permissionKey = (module: string, action: string) => `${module}.${action}`;

export function isKnownPermission(module: string, action: string): boolean {
	return module in MODULES && (ACTIONS as readonly string[]).includes(action);
}

type Grant = Partial<Record<ModuleKey, (Action | `${Action}:own`)[]>>;

const ALL: Action[] = [...ACTIONS];
const CONTENT: ModuleKey[] = ["posts", "teachings", "pages"];
const SPECIAL: ModuleKey[] = ["events", "statues", "areas"];

function grant(entries: Grant): Map<string, Scope> {
	const out = new Map<string, Scope>();
	for (const [module, actions] of Object.entries(entries)) {
		for (const entry of actions ?? []) {
			const own = entry.endsWith(":own");
			out.set(permissionKey(module, own ? entry.slice(0, -4) : entry), own ? "own" : "all");
		}
	}
	return out;
}

const everything = (): Grant => Object.fromEntries(MODULE_KEYS.map((module) => [module, ALL])) as Grant;
const only = (modules: ModuleKey[], actions: Grant[ModuleKey]): Grant => Object.fromEntries(modules.map((module) => [module, actions])) as Grant;

export type SystemRole = { id: string; name: string; description: string; grants: Map<string, Scope> };

export const SYSTEM_ROLES: SystemRole[] = [
	{
		id: "role-super-admin",
		name: "Super Admin",
		description: "Toàn quyền, kể cả tài khoản, vai trò và sao lưu.",
		grants: grant({ ...everything(), audit: ["view"] }),
	},
	{
		id: "role-admin",
		name: "Admin",
		description: "Quản trị nội dung và tài khoản; không đụng vào sao lưu và vai trò.",
		grants: grant({
			...only(CONTENT, ALL),
			...only(SPECIAL, ALL),
			categories: ALL,
			menus: ALL,
			media: ALL,
			home: ALL,
			quotes: ALL,
			seo: ALL,
			redirects: ALL,
			trash: ALL,
			dashboard: ["view"],
			settings: ["view", "update"],
			users: ["view", "create", "update"],
			roles: ["view"],
			audit: ["view"],
		}),
	},
	{
		id: "role-editor",
		name: "Editor (Biên tập viên)",
		description: "Biên tập và duyệt bài, quản lý media, lịch, bảo tượng.",
		grants: grant({
			...only(CONTENT, ALL),
			...only(SPECIAL, ALL),
			categories: ["view", "create", "update"],
			menus: ["view", "create", "update"],
			media: ["view", "create", "update", "delete"],
			home: ["view", "update", "publish"],
			quotes: ["view", "update", "publish"],
			seo: ["view", "update"],
			redirects: ["view", "update"],
			trash: ["view", "update"],
			dashboard: ["view"],
		}),
	},
	{
		id: "role-author",
		name: "Author (Cộng tác viên)",
		description: "Viết bài của mình và gửi duyệt; không tự xuất bản.",
		grants: grant({
			...only(CONTENT, ["view", "create", "update:own", "delete:own"]),
			categories: ["view"],
			menus: ["view"],
			media: ["view", "create", "update:own"],
			home: ["view"],
			quotes: ["view"],
			...only(SPECIAL, ["view"]),
			trash: ["view:own"],
			dashboard: ["view"],
		}),
	},
];

export const SUPER_ADMIN_ROLE_ID = "role-super-admin";
