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

/**
 * The only `module.action` pairs that may be given with scope "own", because the handlers behind them really compare
 * the row's owner (`created_by`, or `uploaded_by` for media) with the caller. A pair not listed here is all-or-nothing:
 * the role editor refuses `:own` on it, and a route lets "own" through the gate only when its spec says `own: true`.
 * Add a pair only together with the owner check in the handler (and a test in tests/unit/admin/permissions.test.ts).
 *
 * - posts, teachings, pages, events, statues, areas, quotes: update and delete (`mayChange` on the row).
 * - media: update and delete (`mayChange` on `uploaded_by`); folders have no owner and need scope all.
 * - trash: view (own rows only), update and delete (own rows, of kinds that have an owner).
 * `view:own` is deliberately absent for every content module: the lists, counts, options, revisions and previews of
 * posts, teachings and pages do not filter by owner, so "view own" would be a full "view".
 */
const OWNABLE_MODULES = ["posts", "teachings", "pages", "events", "statues", "areas", "quotes"] as const;
export const OWNABLE: ReadonlySet<string> = new Set([
	...OWNABLE_MODULES.flatMap((module) => [permissionKey(module, "update"), permissionKey(module, "delete")]),
	permissionKey("media", "update"),
	permissionKey("media", "delete"),
	permissionKey("trash", "view"),
	permissionKey("trash", "update"),
	permissionKey("trash", "delete"),
]);
export const isOwnable = (module: string, action: string) => OWNABLE.has(permissionKey(module, action));

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
