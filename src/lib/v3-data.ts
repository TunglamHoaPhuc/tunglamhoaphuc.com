// V3 reads www's content (D1 when deployed, the snapshot locally) through www's own content layer
// (src/lib/tlhp-content, copied from the www repo), then turns it back into the record shapes the
// V3 pages were written for (the old admin's JSON: posts-database.json, tong-chi-data.json…).
// Read only: nothing here writes. Edit content in www's admin (/quan-tri); it shows here within a minute.
import scheduleBase from "@/data/schedule-database.json";
import { toSlug } from "@/lib/schedule-detail";
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { AboutTopic, Area, GalleryImage, MediaImage, Post, PostSummary, Schedule, TongChiArticle, TongChiSummary } from "@/lib/tlhp-content/types";

/** Pictures stay where www keeps them (R2 tlhp-media, B2); v3 reads them through its own /anh-goc route, bound to the same bucket. */
export const WWW_ORIGIN = "https://www.tunglamhoaphuc.com";

export function absUrl(src: string | null | undefined): string {
	if (!src) return "";
	if (src.startsWith("/anh-goc/")) return src;
	if (src.startsWith("/") && !src.startsWith("//")) return `${WWW_ORIGIN}${src}`;
	return src;
}

const pic = (image: MediaImage | null | undefined) => absUrl(image?.src);
const pos = (image: MediaImage | null | undefined) => image?.position || "center 50%";

function gallery(items: GalleryImage[]) {
	return items.map((g) => ({ title: g.title, imageUrl: absUrl(g.src), imagePosition: "center 50%", noiDung: g.caption }));
}

export const repo = () => getContentRepository();

// ── Posts ───────────────────────────────────────────────────────────────────

/** A post the editors chose as related (what the "Tìm hiểu thêm" cards need). */
export interface V3RelatedPost {
	id: string;
	slug: string;
	section: string;
	title: string;
	subtitle: string;
	categoryName: string;
	subCategory: string;
	thumbnailUrl: string;
	bannerUrl: string;
}

const toRelatedRecord = (p: PostSummary): V3RelatedPost => ({
	id: p.id,
	slug: p.slug,
	section: p.section,
	title: p.title,
	subtitle: p.subtitle,
	categoryName: p.category.name,
	subCategory: p.category.slug,
	thumbnailUrl: pic(p.thumbnail ?? p.banner),
	bannerUrl: pic(p.banner ?? p.thumbnail),
});

/** Where V3 opens a post of each section (the same two sections www links "Tìm hiểu thêm" to); a related post of another section is left out, as on www. */
const RELATED_PATHS: Record<string, string> = {
	"dong-chay-hoang-phap": "/dong-chay-hoang-phap",
	"tri-tue-phat-phap": "/tri-tue-phat-phap",
};

/** www shows at most three chosen posts under "Tìm hiểu thêm". */
export const CHOSEN_RELATED_LIMIT = 3;

/**
 * The cards of "Tìm hiểu thêm" built from the posts the editors chose (`post.related`, in their order), the same rule as
 * www: never the post itself, only posts V3 can open, at most three. Empty when none were chosen: the caller then guesses.
 */
export function chosenRelatedCards(current: { id: string; related?: V3RelatedPost[] }, fallbackImage: string, fallbackCategory: string) {
	return (current.related ?? [])
		.filter((r) => r.id !== current.id && r.section in RELATED_PATHS)
		.slice(0, CHOSEN_RELATED_LIMIT)
		.map((r) => ({
			category: r.subtitle || r.categoryName || fallbackCategory,
			title: r.title,
			url: r.thumbnailUrl || r.bannerUrl || fallbackImage,
			link: `${RELATED_PATHS[r.section]}/${r.slug}`,
		}));
}

export function toPostRecord(post: PostSummary | Post) {
	const full = "contentHtml" in post ? post : null;
	return {
		id: post.id,
		slug: post.slug,
		title: post.title,
		subtitle: post.subtitle,
		mainCategory: post.section,
		subCategory: post.category.slug,
		categoryName: post.category.name,
		author: post.author,
		publishedDate: post.publishedDate,
		status: "published" as const,
		viewsCount: post.views,
		thumbnailUrl: pic(post.thumbnail ?? post.banner),
		thumbnailPosition: pos(post.thumbnail),
		bannerUrl: pic(post.banner ?? post.thumbnail),
		bannerPosition: pos(post.banner),
		summary: post.summary,
		// Pinned by the editors: first in the lists ordered by date or title (as on www).
		pinned: post.pinned === true,
		// The lead text www shows under the title; empty when it only repeats the opening lines of the body.
		intro: full?.intro ?? "",
		// The posts the editors chose for "Tìm hiểu thêm", in their order (www's `post.related`).
		related: (full?.related ?? []).map(toRelatedRecord),
		content: "",
		contentHtml: full?.contentHtml ?? "",
		keywords: full ? full.keywords.map((k) => ({ ...k })) : [],
		// The video id of a Video Phật Pháp post (its video is already in `videoBlock`).
		youtubeId: full?.extra?.youtubeId || undefined,
		videoBlock: full?.videos[0] ? { videoUrl: full.videos[0].url, title: post.title, summary: "" } : undefined,
		// What the editors fill in for a category: the book of an "Ấn phẩm & Sách" post and the sound of a "Pháp Âm" post (as www shows them).
		sourceBook: full?.extra.book ? { bookTitle: full.extra.book.title, author: full.extra.book.author, coverImage: full.extra.book.cover ? absUrl(full.extra.book.cover) : "", description: "", linkUrl: full.extra.book.link ?? undefined } : undefined,
		audio: full?.extra.audio ? { src: absUrl(full.extra.audio.src), duration: full.extra.audio.duration } : undefined,
		photoGallery: full ? gallery(full.gallery) : [],
		galleryCount: post.galleryCount,
		previousEditions: [],
		upcomingEvents: [],
	};
}

export type V3Post = ReturnType<typeof toPostRecord>;

/** Every post as a list record (no body), newest first. */
export async function allPostRecords(section?: string): Promise<V3Post[]> {
	const r = await repo();
	const page = await r.listPosts({ section, pageSize: 60, page: 1 });
	const items = [...page.items];
	for (let p = 2; p <= page.pageCount; p++) items.push(...(await r.listPosts({ section, pageSize: 60, page: p })).items);
	return items.map(toPostRecord);
}

export async function postRecord(slugOrId: string): Promise<V3Post | null> {
	const r = await repo();
	const bySlug = await r.getPostBySlug(slugOrId);
	if (bySlug) return toPostRecord(bySlug);
	// V3 sometimes links by id ("post-1060").
	const all = await allPostRecords();
	const hit = all.find((p) => p.id === slugOrId || p.id === `post-${slugOrId}`);
	if (!hit) return null;
	const post = await r.getPostBySlug(hit.slug);
	return post ? toPostRecord(post) : hit;
}

// ── Tông Chỉ Tu Học ─────────────────────────────────────────────────────────

export function toTongChiRecord(a: TongChiSummary | TongChiArticle, index = 0) {
	const full = "contentHtml" in a ? a : null;
	return {
		id: Number.isFinite(Number(a.id)) ? Number(a.id) : a.id,
		number: index + 1,
		slug: a.slug,
		title: a.title,
		subtitle: a.subtitle,
		category: a.group.slug,
		categoryName: a.group.name,
		bannerImage: pic(a.banner),
		bannerPosition: pos(a.banner),
		excerpt: a.excerpt,
		content: "",
		contentHtml: full?.contentHtml ?? "",
		author: full?.author ?? "",
		authorLink: full?.authorHref ?? undefined,
		// YYYY-MM-DD as D1 holds it: no invented time of day.
		publishedAt: full?.publishedDate || undefined,
		viewsCount: full?.views ?? 0,
		status: "published",
		// The pages read `description`; `summary` stays for the callers written against the old admin's file.
		videoBlock: full?.video ? { title: full.video.title, videoUrl: full.video.url, description: full.video.description, summary: full.video.description } : undefined,
		featuredArticle: full?.featured ? { label: full.featured.label, title: full.featured.title, author: full.featured.author, linkUrl: full.featured.href ?? undefined } : undefined,
		sourceBook: full?.book ? { bookTitle: full.book.title, author: full.book.author, coverImage: absUrl(full.book.cover), description: full.book.description, linkUrl: full.book.href ?? undefined } : undefined,
		photoGallery: full ? gallery(full.gallery) : [],
		keywords: full ? full.keywords.map((k) => ({ ...k })) : [],
	};
}

export type V3TongChi = ReturnType<typeof toTongChiRecord>;

export async function allTongChi() {
	const r = await repo();
	const list = await r.listTongChi();
	const full = await Promise.all(list.map((a) => r.getTongChi(a.slug)));
	return list.map((a, i) => toTongChiRecord(full[i] ?? a, i));
}

// ── Giới thiệu ──────────────────────────────────────────────────────────────

export function toAboutRecord(t: AboutTopic, index = 0) {
	return {
		id: t.id,
		slug: t.slug,
		title: t.title,
		subtitle: t.subtitle,
		tag: t.tag,
		groupCategory: t.group.slug,
		groupCategoryName: t.group.name,
		heroBanner: pic(t.banner),
		heroBannerPosition: pos(t.banner),
		portraitImage: pic(t.portrait),
		portraitImagePosition: pos(t.portrait),
		overviewSummary: t.overview,
		quoteTitle: t.quote?.title ?? "",
		quoteContent: t.quote?.lines ?? [],
		quoteAuthor: t.quote?.author ?? "",
		milestones: t.milestones.map((m) => ({ year: m.label, title: m.title, description: m.description })),
		content: "",
		mainContentHtml: t.contentHtml,
		galleryImages: t.gallery.map((g) => ({ url: absUrl(g.src), caption: g.caption || g.title, position: "center 50%" })),
		sourceBook: t.book ? { bookTitle: t.book.title, author: t.book.author, coverImage: absUrl(t.book.cover), description: t.book.description } : undefined,
		orderIndex: index,
		status: "published",
	};
}

export type V3About = ReturnType<typeof toAboutRecord>;

export async function allAbout(): Promise<V3About[]> {
	return (await (await repo()).listAboutTopics()).map(toAboutRecord);
}

// ── Vũ Trụ Phật Giáo ────────────────────────────────────────────────────────

/** The temples the admin knows (its `temple` field is a slug); an unknown slug is written out in capitals-and-spaces. */
const TEMPLE_NAMES: Record<string, string> = {
	"tung-lam-hoa-phuc": "Tùng Lâm Hòa Phúc",
	"quynh-nhai-cam-lo-tu": "Quỳnh Nhai Cam Lộ Tự",
};

export const templeName = (temple: string) =>
	TEMPLE_NAMES[temple] ?? temple.split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/**
 * An area as the V3 pages read it. `description` is the admin's plain-text intro; `contentHtml` the body the admin saved
 * (cleaned with special/html.ts there, and again where it is shown). D1 keeps no pin number: `pinNumber` is the area's place
 * among the visible areas in the editors' order. The temple's name comes from its slug.
 */
export function toAreaRecord(a: Area, index = 0) {
	return {
		id: a.id,
		pinNumber: index + 1,
		slug: a.slug,
		name: a.name,
		subtitle: a.subtitle,
		temple: a.temple,
		templeName: templeName(a.temple),
		imgUrl: pic(a.cover),
		imgPosition: pos(a.cover),
		mapPos: a.mapPos ?? undefined,
		description: a.intro,
		fullContent: "",
		contentHtml: a.contentHtml,
	};
}

export type V3Area = ReturnType<typeof toAreaRecord>;

export async function allAreas() {
	return (await (await repo()).listAreas()).map(toAreaRecord);
}

// ── Lịch tu học ─────────────────────────────────────────────────────────────

const ddmmyyyy = (iso: string) => {
	const [y, m, d] = iso.split("-");
	return `${d}.${m}.${y}`;
};

type BaseSchedule = typeof scheduleBase;

/** The schedule file's shape. Colours of the month themes are design, not data: kept from V3's bundled file. */
export function toScheduleData(s: Schedule) {
	const base = scheduleBase as unknown as BaseSchedule & { monthThemes: Record<string, Record<string, unknown>> };
	const monthThemes: Record<string, Record<string, unknown>> = { ...base.monthThemes };
	for (const t of s.themes) {
		// A month the admin has not filled in (no title, verse, author or picture) keeps V3's bundled theme; any content makes the admin's row the theme.
		if (!t.title && !t.lines.length && !t.author && !t.poster) continue;
		const key = Object.keys(monthThemes).find((k) => Number((monthThemes[k] as { month?: number }).month) === t.month) ?? String(t.month);
		monthThemes[key] = {
			...(monthThemes[key] ?? { month: t.month, primaryColor: "#8B3A1C", secondaryColor: "#F2C14E", themeBg: "#2A170F" }),
			month: t.month,
			title: t.title,
			bannerImg: absUrl(t.poster) || (monthThemes[key]?.bannerImg as string) || "",
			quoteLines: t.lines,
			author: t.author,
		};
	}
	return {
		featuredPrograms: s.programs.map((p) => ({
			id: p.id,
			slug: toSlug(p.title),
			title: p.title,
			subtitle: p.subtitle,
			time: p.time,
			duration: p.duration,
			location: p.location,
			schedule: p.time,
			summary: p.summary,
			imgUrl: pic(p.image),
			imgPositionY: positionY(p.image),
		})),
		monthThemes,
		customEvents: s.events
			.filter((e) => !e.programId)
			.map((e) => {
				const out: Record<string, unknown> = {
					id: e.id,
					slug: e.slug,
					solarDateStr: ddmmyyyy(e.start),
					title: e.title,
					subtitle: e.subtitle,
					category: e.category.name,
					location: e.location,
					description: e.description,
					notes: e.notes,
					imgUrl: pic(e.image),
					imgPositionY: positionY(e.image),
					videoUrl: e.video?.url,
				};
				if (e.end && e.end !== e.start) Object.assign(out, { isMultiDay: true, endDateStr: ddmmyyyy(e.end) });
				e.times.forEach((t, i) => Object.assign(out, { [`timeSlot${i + 1}Label`]: t.label, [`timeSlot${i + 1}Time`]: t.time }));
				return out;
			}),
		quoteGallery: s.quotes.map((q) => ({ id: q.id, url: absUrl(q.src), title: q.title })),
	};
}

function positionY(image: MediaImage | null | undefined): number | undefined {
	const m = image?.position.match(/(\d+(?:\.\d+)?)%\s*$/);
	return m ? Number(m[1]) : undefined;
}

export async function scheduleData() {
	return toScheduleData(await (await repo()).getSchedule());
}

/** Short shared cache: the pages refresh within a minute of an edit in www's admin. */
export const PUBLIC_CACHE = { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" };
