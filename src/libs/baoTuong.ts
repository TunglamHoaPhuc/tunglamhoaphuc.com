// Bảo Tượng Phật Giáo for the pages: the list's query string (?q=&chung-hoi=&khu-vuc=&loai=&trang=),
// read and written in one place so links, the filter form and the page agree on it; the
// filters themselves; a statue's area; and the statues shown beside one.
import { vuTru } from "@/config/vuTru";
import { bare } from "@/libs/content/normalize";
import type { StatueSummary } from "@/libs/content/types";

export const STATUES_PATH = "/bao-tuong-phat-giao";
export const STATUE_PAGE_SIZE = 24;

/** The kinds of statue, by the value they take in the URL. */
export const KINDS = [
	{ param: "tuong-chinh", label: "Tượng chính", main: true },
	{ param: "nghe-thuat", label: "Nghệ thuật Phật giáo", main: false },
];

export type StatueQuery = {
	/** Words of the name, or a code such as TP0001. */
	q: string;
	/** An assembly's slug, or "" for all. */
	assembly: string;
	/** An area's slug, or "" for all. */
	area: string;
	/** One of KINDS[].param, or "" for all. */
	kind: string;
	/** 1-based. */
	page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export function readStatueQuery(params: SearchParams): StatueQuery {
	const page = Number.parseInt(first(params.trang), 10);
	return {
		q: first(params.q).slice(0, 80),
		assembly: first(params["chung-hoi"]),
		area: first(params["khu-vuc"]),
		kind: first(params.loai),
		page: Number.isFinite(page) && page > 1 ? page : 1,
	};
}

/** The list URL for a query, leaving out what is empty so the plain list stays at its bare path. */
export function statueListHref(query: StatueQuery): string {
	const params = new URLSearchParams();
	if (query.q) params.set("q", query.q);
	if (query.assembly) params.set("chung-hoi", query.assembly);
	if (query.area) params.set("khu-vuc", query.area);
	if (query.kind) params.set("loai", query.kind);
	if (query.page > 1) params.set("trang", String(query.page));
	const text = params.toString();
	return text ? `${STATUES_PATH}?${text}` : STATUES_PATH;
}

/** The area (its slug) a statue stands in, through the Bảo Tượng file's own area names. */
export function areaOfStatue(statue: Pick<StatueSummary, "areaCode">): string | null {
	for (const [slug, codes] of Object.entries(vuTru.statueAreas)) if (codes.includes(statue.areaCode)) return slug;
	return null;
}

/** The statues that match the query (all of them, unpaged), in the editors' order. */
export function filterStatues(statues: StatueSummary[], query: StatueQuery): StatueSummary[] {
	const words = bare(query.q);
	const code = query.q.toUpperCase();
	const kind = KINDS.find((item) => item.param === query.kind);
	return statues.filter(
		(statue) =>
			(!query.assembly || statue.assembly.slug === query.assembly) &&
			(!query.area || areaOfStatue(statue) === query.area) &&
			(!query.kind || (kind ? statue.main === kind.main : false)) &&
			(!words || bare(`${statue.name} ${statue.subtitle}`).includes(words) || (!!statue.code && statue.code.includes(code))),
	);
}

/** Main statues of the same group first, then of the same assembly; never the statue itself. */
export function relatedStatues(statue: StatueSummary, statues: StatueSummary[], count = 4): StatueSummary[] {
	const others = statues.filter((item) => item.main && item.id !== statue.id);
	// The editors wrote one group both "Thập Đại Đệ Tử" and "Thập đại đệ tử".
	const cluster = bare(statue.cluster);
	const sameCluster = others.filter((item) => cluster && bare(item.cluster) === cluster);
	const sameAssembly = others.filter((item) => item.assembly.slug === statue.assembly.slug && !sameCluster.includes(item));
	return [...sameCluster, ...sameAssembly].slice(0, count);
}
