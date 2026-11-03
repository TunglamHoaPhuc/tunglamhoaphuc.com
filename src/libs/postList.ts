// The query string of the public post lists (?danh-muc=&sap-xep=&trang=), read and written
// in one place so links, the sort form and the page agree on it.
import type { PostSort } from "@/libs/content/types";

export const SORTS: { param: string; sort: PostSort; label: string }[] = [
	{ param: "moi-nhat", sort: "newest", label: "Mới nhất" },
	{ param: "cu-nhat", sort: "oldest", label: "Cũ nhất" },
	{ param: "a-z", sort: "az", label: "A → Z" },
	{ param: "z-a", sort: "za", label: "Z → A" },
];
export const DEFAULT_SORT = SORTS[0].param;

export type ListState = {
	/** Category slug, or "" for all. */
	category: string;
	/** One of SORTS[].param. */
	sort: string;
	/** 1-based. */
	page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
	return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Unknown sorts fall back to the default and odd pages to 1; categories are checked by the page. */
export function readListState(params: SearchParams): ListState {
	const sort = first(params["sap-xep"]);
	const page = Number.parseInt(first(params.trang), 10);
	return {
		category: first(params["danh-muc"]),
		sort: SORTS.some((option) => option.param === sort) ? sort : DEFAULT_SORT,
		page: Number.isFinite(page) && page > 1 ? page : 1,
	};
}

export function sortOf(state: ListState): PostSort {
	return SORTS.find((option) => option.param === state.sort)?.sort ?? "newest";
}

/** The list URL for a state, leaving out defaults so the plain list stays at its bare path. */
export function listHref(path: string, state: ListState): string {
	const query = new URLSearchParams();
	if (state.category) query.set("danh-muc", state.category);
	if (state.sort !== DEFAULT_SORT) query.set("sap-xep", state.sort);
	if (state.page > 1) query.set("trang", String(state.page));
	const text = query.toString();
	return text ? `${path}?${text}` : path;
}

/**
 * Page numbers to show: the first, the last, and the current one with a neighbour on each
 * side; `null` marks a gap. 1 … 4 5 6 … 40.
 */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
	const shown = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
	const sorted = [...shown].sort((a, b) => a - b);
	const out: (number | null)[] = [];
	sorted.forEach((n, i) => {
		if (i > 0) {
			const gap = n - sorted[i - 1];
			// A gap of one page is shown as that page rather than as "…".
			if (gap === 2) out.push(n - 1);
			else if (gap > 2) out.push(null);
		}
		out.push(n);
	});
	return out;
}
