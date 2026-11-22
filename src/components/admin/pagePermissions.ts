// The permission each admin page needs, in one table. The list pages take theirs from the menu (NAV), the pages that make
// something need `create`, the rest of a module's pages need `view`. The frame shows "Không có quyền truy cập" instead of a page the
// person may not open (so no request goes out that the server would answer with 403); the server stays the real gate.
// tests/unit/admin/page-permissions.test.ts scans src/app/quan-tri/(khung): a page directory missing here fails it.
import { NAV } from "./nav";

export type Need = readonly [module: string, action: string];

/** The permission the menu entry at `href` asks for. */
function menuNeed(href: string): Need {
	for (const group of NAV) for (const item of group.items) if (item.href === `/quan-tri/${href}` && item.needs) return item.needs;
	throw new Error(`pagePermissions: "${href}" is not in the menu with a permission`);
}
const viewOf = menuNeed;
const createOf = (href: string): Need => [menuNeed(href)[0], "create"];

/**
 * Page path under /quan-tri (without the leading slash; "" is the start page; `[id]` stands for any one segment) -> permission,
 * or null when everybody who is signed in may open it.
 */
export const PAGE_NEEDS: Readonly<Record<string, Need | null>> = {
	"": null,
	"ho-so": null,

	"bai-viet": viewOf("bai-viet"),
	"bai-viet/moi": createOf("bai-viet"),
	"bai-viet/[id]": viewOf("bai-viet"),
	"tong-chi": viewOf("tong-chi"),
	"tong-chi/moi": createOf("tong-chi"),
	"tong-chi/[id]": viewOf("tong-chi"),
	"gioi-thieu": viewOf("gioi-thieu"),
	"gioi-thieu/moi": createOf("gioi-thieu"),
	"gioi-thieu/[id]": viewOf("gioi-thieu"),
	media: viewOf("media"),

	"chuyen-muc": viewOf("chuyen-muc"),
	menu: viewOf("menu"),
	"trang-chu": viewOf("trang-chu"),

	"lich-tu-hoc": viewOf("lich-tu-hoc"),
	"lich-tu-hoc/moi": createOf("lich-tu-hoc"),
	"lich-tu-hoc/chu-de": viewOf("lich-tu-hoc"),
	"lich-tu-hoc/[id]": viewOf("lich-tu-hoc"),
	"bao-tuong": viewOf("bao-tuong"),
	"bao-tuong/moi": createOf("bao-tuong"),
	"bao-tuong/[id]": viewOf("bao-tuong"),
	"khu-vuc": viewOf("khu-vuc"),
	"khu-vuc/[id]": viewOf("khu-vuc"),
	"loi-thay-day": viewOf("loi-thay-day"),

	seo: viewOf("seo"),
	"chuyen-huong": viewOf("chuyen-huong"),
	"thung-rac": viewOf("thung-rac"),
	"nhat-ky": viewOf("nhat-ky"),
	"cau-hinh": viewOf("cau-hinh"),
	"sao-luu": viewOf("sao-luu"),

	"tai-khoan": viewOf("tai-khoan"),
	"tai-khoan/moi": createOf("tai-khoan"),
	"tai-khoan/[id]": viewOf("tai-khoan"),
	"vai-tro": viewOf("vai-tro"),
	"vai-tro/moi": createOf("vai-tro"),
	"vai-tro/[id]": viewOf("vai-tro"),
};

const patterns = Object.keys(PAGE_NEEDS).map((pattern) => ({ pattern, parts: pattern ? pattern.split("/") : [] }));

/** The segments of an address after /quan-tri ("/quan-tri/bai-viet/moi?x=1" -> ["bai-viet", "moi"]). */
function partsOf(pathname: string): string[] {
	const path = pathname.split(/[?#]/)[0].replace(/^\/quan-tri(?=\/|$)/, "");
	return path.split("/").filter(Boolean);
}

/**
 * What opening `pathname` needs: `{ known: true, need }` for a page of the table (`need` null when anyone may open it),
 * `{ known: false }` for an address that is no page (the router's own "not found" answers it).
 * A literal segment beats `[id]`, so /bai-viet/moi is the create page and not an article called "moi".
 */
export function pageNeedFor(pathname: string): { known: true; need: Need | null; pattern: string } | { known: false } {
	const parts = partsOf(pathname);
	let best: { pattern: string; literal: number } | null = null;
	for (const item of patterns) {
		if (item.parts.length !== parts.length) continue;
		let literal = 0;
		let ok = true;
		for (let index = 0; index < parts.length && ok; index++) {
			if (item.parts[index] === "[id]") continue;
			if (item.parts[index] === parts[index]) literal++;
			else ok = false;
		}
		if (ok && (!best || literal > best.literal)) best = { pattern: item.pattern, literal };
	}
	return best ? { known: true, need: PAGE_NEEDS[best.pattern], pattern: best.pattern } : { known: false };
}
