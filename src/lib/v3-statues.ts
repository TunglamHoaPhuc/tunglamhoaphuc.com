// Bảo tượng (statues) for the V3 pages: exactly the statues www's D1 holds as live (published, not in the trash), and
// nothing else. A statue that is a draft, hidden, scheduled or deleted is not in any list and its page answers 404.
// There is no bundled copy to fall back on: if D1 cannot be read the error goes up to the page's error boundary.
//
// D1's statue is turned back into the record shape the V3 components were written for (lib/statue-types.ts). What D1 does
// not hold has no slot filled: no video, no angle pictures, no image rotation. The little "article" teaser keeps two
// values from a small file keyed by statue code (data/statue-article-extras.json) only while the editors left the
// "Ban biên tập" field empty.
//
// Every function takes what it reads as its last arguments so a test can hand it a fixture.
import articleExtras from "@/data/statue-article-extras.json";
import type { StatueRecord } from "@/lib/statue-types";
import { getContentRepository, lazy } from "@/lib/tlhp-content/repository";
import type { D1Like } from "@/lib/tlhp-content/sources/d1";
import type { ContentRepository, Statue, StatueSummary } from "@/lib/tlhp-content/types";
import { renewingAsync } from "@/lib/renew-async";
import { absUrl, type V3Area } from "@/lib/v3-data";
import { siteDb } from "@/lib/v3-db";
import { liveAreas } from "@/lib/v3-live";

// ── What D1 holds beyond the repository's statue (ids of areas, related statues, editorial board) ──────────────────

export type StatueLinks = {
	/** statue id → slug of the visible area it stands in, or `null` when its area is hidden or deleted. Only statues the admin gave an area. */
	area: Map<string, string | null>;
	/** statue id → ids of the statues the editors chose as related, in their order (live ones only). */
	related: Map<string, string[]>;
	/** statue id → "Ban biên tập" of its article. */
	board: Map<string, string>;
};

export const NO_LINKS: StatueLinks = { area: new Map(), related: new Map(), board: new Map() };

type Row = Record<string, unknown>;
const text = (value: unknown) => (typeof value === "string" ? value : "");

const LIVE = "s.deleted_at is null and s.status = 'published'";

/** One read of the three small tables the repository leaves out. */
export async function readStatueLinks(db: D1Like): Promise<StatueLinks> {
	const rows = (
		await db
			.prepare(
				`select s.id, s.area_id, s.editorial_board, a.slug as area_slug
				from statue s left join area a on a.id = s.area_id and a.visible = 1 and a.deleted_at is null
				where ${LIVE}`,
			)
			.all<Row>()
	).results;
	const related = (
		await db
			.prepare(
				`select r.statue_id, r.related_id from statue_related r
				join statue s on s.id = r.related_id and ${LIVE}
				order by r.statue_id, r.position, r.related_id`,
			)
			.all<Row>()
	).results;
	const links: StatueLinks = { area: new Map(), related: new Map(), board: new Map() };
	for (const row of rows) {
		const id = text(row.id);
		if (row.area_id) links.area.set(id, text(row.area_slug) || null);
		if (text(row.editorial_board).trim()) links.board.set(id, text(row.editorial_board).trim());
	}
	for (const row of related) {
		const id = text(row.statue_id);
		links.related.set(id, [...(links.related.get(id) ?? []), text(row.related_id)]);
	}
	return links;
}

// What is kept is the function the setup made, once it exists; never the pending promise of the setup (a request must not await a
// promise another request started: it can be cancelled as "hung").
const sharedLinks = lazy(async (): Promise<() => Promise<StatueLinks>> => {
	const db = await siteDb();
	if (!db) return () => Promise.resolve(NO_LINKS);
	// Not `renewing`: that would keep a failed read for the whole minute and fail every statue page (and the home page) meanwhile.
	return renewingAsync(() => readStatueLinks(db), 60_000, { name: "statueLinks" });
}, "statueLinks.setup");

/** The links for this server instance (a fresh read each minute); none when V3 is not reading from D1. Started on first use, not at import. */
export async function statueLinks(): Promise<StatueLinks> {
	return (await sharedLinks())();
}

// ── Mapping ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Which statues stand in which area when the admin gave the statue no area of its own: the Bảo Tượng file's area names
 * (www config/vuTru.ts). The slugs are the areas' slugs in D1.
 */
export const STATUE_AREA_CODES: Record<string, string[]> = {
	"tam-bao": ["tam_bao"],
	"to-duong": ["to_duong"],
	"dai-nam-quoc-mau": ["nha_mau"],
	"bao-tang": ["bao_tang"],
	"bao-thap-van-phat-xa-loi": ["bao_thap"],
	"giang-duong": ["giang_duong"],
	"tu-an": ["vang_sinh_duong", "tu_an"],
	"san-di-da": ["san_di_da"],
	"cong-tam-quan": ["san_di_lac", "san_lam_ty_ni", "lam_ti_ni"],
	"san-la-han": ["san_la_han"],
	"ho-phong-sinh": ["lau_kinh_luan"],
};

/** The order the assemblies have always had on the list; one the admin adds goes after them. */
const ASSEMBLY_ORDER = ["chu_phat_hai_hoi", "thanh_tinh_dai_hai_chung", "thanh_van_la_han", "chu_lich_dai_to_su", "ho_phap_than_vuong", "chu_thanh_ho_quoc", "dai_thi_chu", "linh_vat_phat_giao"];

const norm = (value: string) => value.toLowerCase().replace(/[-_\s]/g, "");

export type StatueCtx = {
	/** The visible areas by slug. */
	areas: Map<string, V3Area>;
	links: StatueLinks;
};

/** The slug of the visible area a statue stands in, or "". */
export function areaSlugOf(statue: Pick<StatueSummary, "id" | "areaCode">, ctx: StatueCtx): string {
	if (ctx.links.area.has(statue.id)) return ctx.links.area.get(statue.id) ?? "";
	for (const [slug, codes] of Object.entries(STATUE_AREA_CODES)) if (codes.includes(statue.areaCode) && ctx.areas.has(slug)) return slug;
	return "";
}

const DEFAULT_POSITION = "center 50%";

/** A statue summary as the record V3's lists and area pages read. */
export function toStatueRecord(s: StatueSummary, ctx: StatueCtx, full?: Statue): StatueRecord {
	const areaSlug = areaSlugOf(s, ctx);
	const area = ctx.areas.get(areaSlug);
	const img = absUrl(s.image?.src);
	const board = ctx.links.board.get(s.id) ?? "";
	const extra = (articleExtras as Record<string, { author: string; bannerUrl: string }>)[s.code];
	const author = board || extra?.author || "";
	const record: StatueRecord = {
		code: s.code,
		assembly: s.assembly.name,
		group: s.cluster,
		title: s.name,
		categoryType: s.main ? "TƯỢNG CHÍNH" : "NTPG",
		characterGroup: s.slug,
		areaId: areaSlug,
		id: s.id,
		slug: s.slug,
		name: s.name,
		titleName: s.name,
		subtitle: s.subtitle,
		assemblyId: s.assembly.slug,
		assemblyName: s.assembly.name,
		clusterName: s.cluster,
		type: s.main ? "TƯỢNG CHÍNH" : "NTPG",
		hasSinglePage: true,
		clusterMembers: [],
		areaSlug,
		areaName: area?.name ?? "",
		areaImgUrl: area?.imgUrl || undefined,
		imgUrl: img,
		avatarUrl: img,
		// The pages centre pictures their own way; only a position the editors chose shows.
		imgPosition: s.image && s.image.position !== DEFAULT_POSITION ? s.image.position : undefined,
		quoteAuthor: "",
		summary: "",
		fullHistoryHtml: "",
	};
	if (!full) return record;
	record.quote = full.quote?.text || undefined;
	record.quoteAuthor = full.quote?.text ? full.quote.author : "";
	record.fullHistoryHtml = full.contentHtml;
	// The "Bài viết" teaser links to the statue's own page; its author is the editors' board (else the file's), its picture the file's.
	record.article = { title: s.name, author, bannerUrl: extra?.bannerUrl ?? "", url: `/bao-tuong/${s.slug}` };
	return record;
}

// ── Readers ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type StatueDeps = { repo?: ContentRepository; links?: StatueLinks };

async function context(deps: StatueDeps): Promise<{ r: ContentRepository; ctx: StatueCtx }> {
	const r = deps.repo ?? (await getContentRepository());
	const areas = new Map((await liveAreas(r)).map((a) => [a.slug, a]));
	return { r, ctx: { areas, links: deps.links ?? (await statueLinks()) } };
}

/** Every live statue as a list record (no text), in the editors' order. */
export async function liveStatueRecords(deps: StatueDeps = {}): Promise<StatueRecord[]> {
	const { r, ctx } = await context(deps);
	const list = await r.listStatues();
	const members = new Map<string, StatueSummary[]>();
	for (const s of list) if (s.main && s.cluster) members.set(norm(s.cluster), [...(members.get(norm(s.cluster)) ?? []), s]);
	return list.map((s) => {
		const record = toStatueRecord(s, ctx);
		record.clusterMembers = (members.get(norm(s.cluster)) ?? []).filter((m) => m.id !== s.id).map(memberOf);
		return record;
	});
}

const memberOf = (s: StatueSummary) => ({ name: s.name, slug: s.slug, imgUrl: absUrl(s.image?.src) });

/**
 * The assemblies the live statues belong to (main or not: an assembly only works of art stand in is still a filter on the
 * list), in the list's order.
 */
export function assembliesOf(records: StatueRecord[]): { id: string; name: string }[] {
	const found = new Map<string, string>();
	for (const s of records) if (s.assemblyId && !found.has(s.assemblyId)) found.set(s.assemblyId, s.assemblyName);
	const rank = (id: string) => {
		const at = ASSEMBLY_ORDER.indexOf(norm(id));
		const plain = ASSEMBLY_ORDER.findIndex((o) => norm(o) === norm(id));
		return at >= 0 ? at : plain >= 0 ? plain : ASSEMBLY_ORDER.length;
	};
	return [...found].map(([id, name]) => ({ id, name })).sort((a, b) => rank(a.id) - rank(b.id));
}

/** A variation of a statue. `href` is the page of the statue it shows, only when that statue is live (never an address that answers 404). */
export type StatueArtWork = { id: string; title: string; imgUrl: string; areaName: string; meaning: string; href?: string };

export type StatuePage = {
	statue: StatueRecord;
	clusterMembers: { name: string; slug: string; imgUrl: string }[];
	artWorks: StatueArtWork[];
	/** The statues shown at the foot of the page: the ones the editors chose, else those of the same assembly. */
	related: StatueRecord[];
};

/** The live statue this slug (or id, or code) names with everything its page shows, or `null`: a statue not live is not found. */
export async function liveStatuePage(slug: string, deps: StatueDeps = {}): Promise<StatuePage | null> {
	const { r, ctx } = await context(deps);
	let key = slug;
	try {
		key = decodeURIComponent(slug);
	} catch {
		// keep as asked
	}
	const list = await r.listStatues();
	const lower = key.toLowerCase();
	const hit = list.find((s) => s.slug === key) ?? list.find((s) => s.id.toLowerCase() === lower || (s.code && s.code.toLowerCase() === lower));
	const full = hit && (await r.getStatue(hit.slug));
	if (!hit || !full) return null;
	const statue = toStatueRecord(hit, ctx, full);
	const clusterMembers = hit.cluster ? list.filter((s) => s.main && s.id !== hit.id && norm(s.cluster) === norm(hit.cluster)).map(memberOf) : [];
	const liveHrefs = new Set(list.map((s) => `/bao-tuong/${s.slug}`));
	const artWorks = full.art.map((v, i) => {
		const work: StatueArtWork = {
			id: v.id || `art-${i}`,
			title: v.title || hit.name,
			imgUrl: absUrl(v.image?.src) || statue.imgUrl,
			areaName: v.location,
			meaning: v.meaning,
		};
		// The repository links a variation to its statue whatever that statue's status; only a live one has a page to go to.
		if (v.href && liveHrefs.has(v.href)) work.href = v.href;
		return work;
	});
	const chosen = (ctx.links.related.get(hit.id) ?? []).flatMap((id) => list.filter((s) => s.id === id));
	const sameAssembly = list.filter((s) => s.main && s.id !== hit.id && s.assembly.slug === hit.assembly.slug);
	const fallback = sameAssembly.length >= 2 ? sameAssembly : list.filter((s) => s.main && s.id !== hit.id);
	const related = (chosen.length ? chosen : fallback).slice(0, 2).map((s) => toStatueRecord(s, ctx));
	return { statue, clusterMembers, artWorks, related };
}
