// Source "d1" (T24): the content in the D1 tables of src/db/schema.ts, filled by the import
// (src/db/import.ts) and, later, by the new admin. It answers the same ContentRepository as the
// snapshot and B2 do, and the contract test (tests/unit/content/contract.test.ts) holds it to
// that: whatever a page asks, the three sources give the same content.
//
// Lists of posts come from a light query (no text, no albums), the way the other sources keep
// summaries apart from posts; a post is read in full when its page asks. The smaller kinds
// (schedule, Giới thiệu, Tông Chỉ, areas, statues) are read whole, once, as the files are.
import type { StatueEntry } from "../baoTuong";
import { MEDIA_BASE, mediaUrl } from "../media";
import { countCategories, createMemoryRepository, lazy, queryPosts, sectionSlugKey, slugKey } from "../repository";
import type { TongChiEntry } from "../tongChi";
import type { AboutTopic, Area, ContentRepository, GalleryImage, MediaImage, Post, PostExtra, PostSummary, Schedule, Video } from "../types";

/** The part of a D1 database (or of anything shaped like one) this source uses. */
export type D1Like = {
	prepare(sql: string): D1Statement;
};
export type D1Statement = {
	bind(...values: unknown[]): D1Statement;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
};

type Row = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) => (typeof value === "number" ? value : Number(value) || 0);
const json = <T>(value: unknown, fallback: T): T => {
	if (typeof value !== "string" || !value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
};

/**
 * Where a picture is: B2 files by their key on the media host, anything else by its address,
 * drawn the way the site draws it today (mediaUrl): the table keeps the address the file had when
 * it was imported, so a WordPress upload stored as https://admin… still comes out as /anh-goc/….
 */
function srcOf(key: unknown, url: unknown): string | null {
	if (typeof key === "string" && key) return `${MEDIA_BASE}/${key}`;
	return typeof url === "string" && url ? mediaUrl(url) : null;
}

/** A picture and where the editors centred it, from the columns a joined `media` row gives (`<prefix>_key`, `<prefix>_url`). */
function imageOf(row: Row, prefix: string, position: unknown): MediaImage | null {
	const src = srcOf(row[`${prefix}_key`], row[`${prefix}_url`]);
	return src ? { src, position: text(position) || "center 50%" } : null;
}

const category = (row: Row, prefix = "cat") => ({ slug: text(row[`${prefix}_slug`]), name: text(row[`${prefix}_name`]) });

/** The views a post, article or statue has had since the import, per page_view, added to the old admin's count. */
const viewsOf = (entityType: string) =>
	`left join (select entity_id, sum(count) as n from page_view where entity_type = '${entityType}' group by entity_id) v on v.entity_id = `;

/**
 * What the public site may show (docs/admin-architecture.md 5.4): not in the trash, and published, or scheduled with its time come.
 * Statues and events have no schedule: only "published" shows.
 */
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const live = (alias: string) => `${alias}.deleted_at is null and (${alias}.status = 'published' or (${alias}.status = 'scheduled' and ${alias}.publish_at <= ${NOW}))`;
const livePlain = (alias: string) => `${alias}.deleted_at is null and ${alias}.status = 'published'`;

const POST_SELECT = `
select p.id, p.slug, p.title, p.subtitle, p.section, p.author, p.published_date, p.summary, p.gallery_count, p.pinned,
  p.legacy_views + coalesce(v.n, 0) as views, p.thumbnail_position, p.banner_position,
  c.slug as cat_slug, c.name as cat_name,
  t.r2_key as thumb_key, t.url as thumb_url, b.r2_key as banner_key, b.url as banner_url
from post p
left join category c on c.id = p.category_id
left join media t on t.id = p.thumbnail_media_id
left join media b on b.id = p.banner_media_id
${viewsOf("post")}p.id`;
const POST_SUMMARY = `${POST_SELECT}
where ${live("p")}
order by p.rowid`;
/** The public posts a post's editors chose as related, in their order (a related statue is not a post). */
const POST_RELATED = `${POST_SELECT}
join post_related r on r.target_id = p.id and r.target_type = 'post'
where r.post_id = ? and ${live("p")}
order by r.position`;

const summaryOf = (row: Row): PostSummary => ({
	id: text(row.id),
	slug: text(row.slug),
	title: text(row.title),
	subtitle: text(row.subtitle),
	section: text(row.section),
	category: category(row),
	author: text(row.author),
	publishedDate: text(row.published_date),
	views: num(row.views),
	thumbnail: imageOf(row, "thumb", row.thumbnail_position),
	banner: imageOf(row, "banner", row.banner_position),
	summary: text(row.summary),
	galleryCount: num(row.gallery_count),
	pinned: row.pinned === 1 || row.pinned === true,
});

/** The albums of one kind of owner ("page", "teaching"): album id → pictures, in order. */
async function galleries(all: <T extends Row>(sql: string, ...params: unknown[]) => Promise<T[]>, prefix: string): Promise<Map<string, GalleryImage[]>> {
	const rows = await all(
		`select ai.album_id, ai.title, ai.caption, m.r2_key, m.url from album_item ai join media m on m.id = ai.media_id where ai.album_id like ? order by ai.album_id, ai.position`,
		`${prefix}:%`,
	);
	const byOwner = new Map<string, GalleryImage[]>();
	for (const row of rows) {
		const owner = text(row.album_id).slice(prefix.length + 1);
		const list = byOwner.get(owner) ?? [];
		list.push({ src: srcOf(row.r2_key, row.url) ?? "", title: text(row.title), caption: text(row.caption) });
		byOwner.set(owner, list);
	}
	return byOwner;
}

export function createD1Repository(db: D1Like): ContentRepository {
	async function all<T extends Row = Row>(sql: string, ...params: unknown[]): Promise<T[]> {
		return (await db.prepare(sql).bind(...params).all<T>()).results;
	}

	// Slugs are unique per section (the admin's index): the same slug in two sections is two posts, each at its own address.
	// Within a section the import keeps the first post of a slug and leaves out a later one (its address would open the
	// other post, as on the old site) until its slug is changed in the admin.
	const summaries = lazy(async (): Promise<PostSummary[]> => {
		const taken = new Set<string>();
		const posts: PostSummary[] = [];
		for (const row of await all(POST_SUMMARY)) {
			const key = sectionSlugKey(text(row.section), text(row.slug));
			if (taken.has(key)) continue;
			taken.add(key);
			posts.push(summaryOf(row));
		}
		return posts;
	});

	const index = lazy(async () => {
		const bySectionSlug = new Map<string, PostSummary>();
		const bySlug = new Map<string, PostSummary>();
		for (const post of await summaries()) {
			bySectionSlug.set(sectionSlugKey(post.section, post.slug), post);
			if (!bySlug.has(slugKey(post.slug))) bySlug.set(slugKey(post.slug), post);
		}
		return { bySectionSlug, bySlug };
	});

	/** The extra fields of a post's category, with the library pictures and sounds they point at as addresses. */
	async function extraOf(raw: unknown): Promise<PostExtra> {
		const extra = json<{ audioMediaId?: string; audioUrl?: string; duration?: string; youtubeId?: string; book?: { title?: string; author?: string; coverMediaId?: string; link?: string } }>(raw, {});
		const ids = [extra.audioMediaId, extra.book?.coverMediaId].filter((id): id is string => typeof id === "string" && !!id);
		const media = new Map<string, string | null>();
		if (ids.length) {
			for (const row of await all(`select id, r2_key, url from media where id in (${ids.map(() => "?").join(", ")})`, ...ids)) media.set(text(row.id), srcOf(row.r2_key, row.url));
		}
		const audioSrc = (extra.audioMediaId ? media.get(extra.audioMediaId) : null) ?? (extra.audioUrl ? mediaUrl(extra.audioUrl) : null);
		const book = extra.book && (extra.book.title || extra.book.author || extra.book.coverMediaId) ? extra.book : null;
		return {
			audio: audioSrc ? { src: audioSrc, duration: text(extra.duration) } : null,
			youtubeId: extra.youtubeId ? extra.youtubeId : null,
			book: book ? { title: text(book.title), author: text(book.author), cover: (book.coverMediaId ? media.get(book.coverMediaId) : null) ?? null, link: book.link ? book.link : null } : null,
		};
	}

	async function getPostBySlug(slug: string, section?: string): Promise<Post | null> {
		const { bySectionSlug, bySlug } = await index();
		const summary = section === undefined ? bySlug.get(slugKey(slug)) : bySectionSlug.get(sectionSlugKey(section, slug));
		if (!summary) return null;
		const [body] = await all(
			`select p.intro, p.content_html, p.keywords, p.videos, p.seo_title, p.seo_description, p.extra, o.r2_key as og_key, o.url as og_url
			from post p left join media o on o.id = p.og_media_id where p.id = ?`,
			summary.id,
		);
		const photos = await all(
			`select ai.title, ai.caption, m.r2_key, m.url from post p join album_item ai on ai.album_id = p.album_id join media m on m.id = ai.media_id where p.id = ? order by ai.position`,
			summary.id,
		);
		const related = (await all(POST_RELATED, summary.id)).map(summaryOf);
		const extra = await extraOf(body?.extra);
		const videos = json<Video[]>(body?.videos, []);
		return {
			...summary,
			intro: text(body?.intro),
			contentHtml: text(body?.content_html),
			keywords: json(body?.keywords, []),
			// A Video Phật Pháp post's video is shown where the page shows videos, unless the post lists some of its own.
			videos: !videos.length && extra.youtubeId ? [{ id: extra.youtubeId, url: `https://www.youtube.com/watch?v=${extra.youtubeId}` }] : videos,
			gallery: photos.map((row) => ({ src: srcOf(row.r2_key, row.url) ?? "", title: text(row.title), caption: text(row.caption) })),
			seoTitle: text(body?.seo_title),
			seoDescription: text(body?.seo_description),
			ogImage: body ? imageOf(body, "og", null) : null,
			extra,
			related,
		};
	}

	async function loadSchedule(): Promise<Schedule> {
		const events = await all(
			`select e.*, c.slug as cat_slug, c.name as cat_name, m.r2_key as img_key, m.url as img_url
			from calendar_event e left join category c on c.id = e.category_id left join media m on m.id = e.image_media_id
			where ${livePlain("e")}
			order by e.start_date, e.end_date, e.position, e.id`,
		);
		const programs = await all(`select f.*, m.r2_key as img_key, m.url as img_url from featured_program f left join media m on m.id = f.image_media_id order by f.position, f.id`);
		const themes = await all(`select t.*, m.r2_key as img_key, m.url as img_url from month_theme t left join media m on m.id = t.poster_media_id order by t.month`);
		const quotes = await all(`select q.id, q.title, m.r2_key, m.url from quote_image q join media m on m.id = q.media_id order by q.position, q.id`);
		return {
			events: events.map((row) => ({
				id: text(row.id),
				slug: text(row.slug),
				title: text(row.title),
				subtitle: text(row.subtitle),
				category: category(row),
				start: text(row.start_date),
				end: text(row.end_date),
				times: json(row.times, []),
				location: text(row.location),
				description: text(row.description),
				notes: text(row.notes),
				image: imageOf(row, "img", row.image_position),
				video: json(row.video, null),
			})),
			programs: programs.map((row) => ({
				id: text(row.id),
				title: text(row.title),
				subtitle: text(row.subtitle),
				summary: text(row.summary),
				time: text(row.time),
				duration: text(row.duration),
				location: text(row.location),
				image: imageOf(row, "img", row.image_position),
			})),
			themes: themes.map((row) => ({
				month: num(row.month),
				title: text(row.title),
				poster: srcOf(row.img_key, row.img_url),
				lines: json(row.lines, []),
				author: text(row.author),
			})),
			quotes: quotes.map((row) => ({ id: text(row.id), title: text(row.title), src: srcOf(row.r2_key, row.url) ?? "" })),
		};
	}

	async function loadAbout(): Promise<AboutTopic[]> {
		const pages = await all(
			`select p.*, c.slug as cat_slug, c.name as cat_name, b.r2_key as banner_key, b.url as banner_url, o.r2_key as portrait_key, o.url as portrait_url
			from page p left join category c on c.id = p.group_id left join media b on b.id = p.banner_media_id left join media o on o.id = p.portrait_media_id
			where ${live("p")} order by p.position, p.id`,
		);
		const milestones = await all("select page_id, label, title, description from milestone order by page_id, position");
		const photos = await galleries(all, "page");
		return pages.map((row) => ({
			id: text(row.id),
			slug: text(row.slug),
			title: text(row.title),
			subtitle: text(row.subtitle),
			tag: text(row.kicker),
			group: category(row),
			banner: imageOf(row, "banner", row.banner_position),
			portrait: imageOf(row, "portrait", row.portrait_position),
			overview: text(row.overview),
			quote: json(row.quote, null),
			milestones: milestones.filter((item) => item.page_id === row.id).map((item) => ({ label: text(item.label), title: text(item.title), description: text(item.description) })),
			contentHtml: text(row.content_html),
			gallery: photos.get(text(row.id)) ?? [],
			book: json(row.book, null),
		}));
	}

	async function loadTongChi(): Promise<TongChiEntry[]> {
		const rows = await all(
			`select a.*, a.legacy_views + coalesce(v.n, 0) as views, c.slug as cat_slug, c.name as cat_name, b.r2_key as banner_key, b.url as banner_url,
				o.r2_key as og_key, o.url as og_url
			from teaching_article a left join category c on c.id = a.group_id left join media b on b.id = a.banner_media_id left join media o on o.id = a.og_media_id
			${viewsOf("tong-chi")}a.id
			where ${live("a")} order by a.position, a.id`,
		);
		const photos = await galleries(all, "teaching");
		return rows.map((row) => ({
			id: text(row.id),
			slug: text(row.slug),
			title: text(row.title),
			name: text(row.name) || text(row.title),
			subtitle: text(row.subtitle),
			group: category(row),
			banner: imageOf(row, "banner", row.banner_position),
			excerpt: text(row.excerpt),
			author: text(row.author),
			authorHref: typeof row.author_href === "string" ? row.author_href : null,
			publishedDate: text(row.published_date),
			views: num(row.views),
			video: json(row.video, null),
			featured: json(row.featured, null),
			gallery: photos.get(text(row.id)) ?? [],
			book: json(row.book, null),
			keywords: json(row.keywords, []),
			seoTitle: text(row.seo_title),
			seoDescription: text(row.seo_description),
			ogImage: imageOf(row, "og", null),
			body: text(row.body),
			html: text(row.content_html),
		}));
	}

	async function loadAreas(): Promise<Area[]> {
		const rows = await all(`select a.*, m.r2_key as cover_key, m.url as cover_url from area a left join media m on m.id = a.cover_media_id where a.visible = 1 and a.deleted_at is null order by a.position, a.id`);
		return rows.map((row) => ({
			id: text(row.id),
			slug: text(row.slug),
			name: text(row.name),
			subtitle: text(row.subtitle),
			temple: text(row.temple),
			cover: imageOf(row, "cover", row.cover_position),
			mapPos: typeof row.map_x === "number" && typeof row.map_y === "number" ? { x: row.map_x, y: row.map_y } : null,
			intro: text(row.intro),
			contentHtml: text(row.content_html),
		}));
	}

	async function loadStatues(): Promise<StatueEntry[]> {
		const rows = await all(
			`select s.*, g.slug as cat_slug, g.name as cat_name, k.name as cluster_name, m.r2_key as img_key, m.url as img_url
			from statue s left join category g on g.id = s.assembly_id left join statue_cluster k on k.id = s.cluster_id left join media m on m.id = s.image_media_id
			where ${livePlain("s")}
			order by s.position, s.id`,
		);
		const variations = await all(
			`select v.*, m.r2_key as img_key, m.url as img_url, t.slug as art_slug
			from art_variation v left join media m on m.id = v.image_media_id left join statue t on t.id = v.art_statue_id
			order by v.statue_id, v.position`,
		);
		return rows.map((row) => {
			const slug = text(row.slug);
			return {
				id: text(row.id),
				code: text(row.code),
				slug,
				name: text(row.name),
				subtitle: text(row.subtitle),
				areaCode: text(row.area_code),
				main: row.is_main === 1,
				image: imageOf(row, "img", row.image_position),
				href: `/bao-tuong/${slug}`,
				assembly: category(row),
				cluster: text(row.cluster_name),
				quote: row.quote_text === null || row.quote_text === undefined ? null : { text: text(row.quote_text), author: text(row.quote_author) },
				art: variations
					.filter((item) => item.statue_id === row.id)
					.map((item) => ({
						id: text(item.variation_id),
						title: text(item.title),
						location: text(item.location),
						meaning: text(item.meaning),
						image: imageOf(item, "img", item.image_position),
						href: item.art_slug ? `/bao-tuong/${text(item.art_slug)}` : null,
					})),
				text: text(row.body),
			};
		});
	}

	// The smaller kinds go through the same code as the other sources; only posts are answered here.
	const rest = createMemoryRepository([], { loadSchedule, loadAbout, loadTongChi, loadAreas, loadStatues });
	return {
		...rest,
		async listPosts(query) {
			return queryPosts(await summaries(), query);
		},
		getPostBySlug,
		async listCategories(section) {
			return countCategories(await summaries(), section);
		},
	};
}
