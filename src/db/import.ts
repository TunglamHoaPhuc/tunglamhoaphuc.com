// The import (T23): the old admin's content, as the content layer already reads it, turned
// into the statements that fill the D1 tables of schema.ts. It reuses the adapters of
// src/libs/content (the same cleaning of titles, categories, pictures and text), so what D1
// holds is what the site shows today.
//
// Running it again gives the same rows: every table is written with an upsert on the old
// admin's id, rows that left the source are removed, and the tables the site fills itself
// (page_view, registration) and the admin's (user, audit_log, setting, notice, redirect) are
// never touched. It runs in Node (scripts/import.ts), not in the Worker.
import { createHash } from "node:crypto";
import { eq, getTableColumns, getTableName, notInArray, sql } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { vuTru } from "../config/vuTru";
import type { StatueEntry } from "../libs/content/baoTuong";
import { mediaKey, mediaUrl } from "../libs/content/media";
import { bare } from "../libs/content/normalize";
import { parsePosts } from "../libs/content/posts";
import { createFileLoaders, type ReadFile } from "../libs/content/sources/files";
import type { TongChiEntry } from "../libs/content/tongChi";
import type { AboutTopic, Area, GalleryImage, MediaImage, Monk, Post, Schedule } from "../libs/content/types";
import * as schema from "./schema";

/** Everything the import reads, already normalised by the content layer. */
export type ImportContent = {
	posts: Post[];
	/** post-albums.json: the albums the posts' lists leave empty, by post id. */
	albums: Map<string, GalleryImage[]>;
	schedule: Schedule;
	about: AboutTopic[];
	tongChi: TongChiEntry[];
	areas: Area[];
	statues: StatueEntry[];
	monks: Monk[];
};

export type ImportCounts = {
	posts: number;
	teachingArticles: number;
	pages: number;
	areas: number;
	statues: number;
	monks: number;
	events: number;
	programs: number;
	monthThemes: number;
};

export function countsOf(content: ImportContent): ImportCounts {
	return {
		posts: content.posts.length,
		teachingArticles: content.tongChi.length,
		pages: content.about.length,
		areas: content.areas.length,
		statues: content.statues.length,
		monks: content.monks.length,
		events: content.schedule.events.length,
		programs: content.schedule.programs.length,
		monthThemes: content.schedule.themes.length,
	};
}

/** Reads the old admin's files through any source (snapshot folder, B2) with the content layer's loaders. */
export async function loadContent(read: ReadFile, log: Pick<Console, "error"> = console): Promise<ImportContent> {
	const loaders = createFileLoaders(read, log);
	// Every post, also the one the site cannot reach because another has its slug: D1 holds all of them.
	const postsFile = await read("posts");
	const [albums, schedule, about, tongChi, areas, statues, monks] = await Promise.all([
		loaders.albums(),
		loaders.schedule(),
		loaders.about(),
		loaders.tongChi(),
		loaders.areas(),
		loaders.statues(),
		loaders.monks(),
	]);
	const posts = postsFile ? parsePosts(postsFile.data, { keepDuplicateSlugs: true }).posts : [];
	return { posts, albums, schedule, about, tongChi, areas, statues, monks };
}

/** One SQL statement with its values, as drizzle builds it. */
export type Statement = { sql: string; params: unknown[] };

type Row = Record<string, unknown>;

const DEFAULT_POSITION = "center 50%";

// D1 refuses a statement over 100 KB; stay under it so a file made here can always be run.
const MAX_STATEMENT_BYTES = 90_000;
// A row too big for one statement is written in pieces of about this size (one statement
// each: the first inserts the row, the others append to its longest text).
const PIECE_BYTES = 40_000;

const byteLength = (value: unknown) => Buffer.byteLength(JSON.stringify(value));

/** `text` cut into pieces of at most `size` bytes of UTF-8, never inside a character. */
function pieces(text: string, size: number): string[] {
	const out: string[] = [];
	let current = "";
	for (const char of text) {
		if (Buffer.byteLength(current) + Buffer.byteLength(char) > size) {
			out.push(current);
			current = "";
		}
		current += char;
	}
	out.push(current);
	return out;
}

/** How the import was cut into statements, for a report. */
export type StatementReport = { statements: number; largestBytes: number; oversizedRows: string[] };

const slugOf = (name: string) => bare(name).replace(/ /g, "-");

export function buildStatements(content: ImportContent): { statements: Statement[]; report: StatementReport } {
	const statements: Statement[] = [];
	// Only used to build queries (toSQL); nothing is ever sent to it.
	const db = drizzle(async () => ({ rows: [] }));
	const oversizedRows: string[] = [];

	// ------------------------------------------------------------ rows, table by table
	const mediaRows = new Map<string, Row>();
	/** The media row of a picture (made on first use), or `null` for no picture. */
	function mediaId(src: string | null | undefined): string | null {
		const url = mediaUrl(src);
		if (!url) return null;
		const id = createHash("sha1").update(url).digest("hex").slice(0, 20);
		if (!mediaRows.has(id)) {
			const key = mediaKey(url);
			const path = key ?? new URL(url, "https://x.invalid").pathname.replace(/^\//, "");
			const slash = path.lastIndexOf("/");
			mediaRows.set(id, {
				id,
				r2Key: key,
				url: key ? null : url,
				folder: slash < 0 ? "" : path.slice(0, slash),
				filename: decodeSafe(path.slice(slash + 1)),
			});
		}
		return id;
	}
	const picture = (image: MediaImage | null) => ({ id: mediaId(image?.src), position: image?.position ?? DEFAULT_POSITION });

	const categoryRows = new Map<string, Row>();
	function category(kind: string, section: string, slug: string, name: string): string | null {
		if (!slug.trim() && !name.trim()) return null;
		const id = `${kind}:${section}:${slug}`;
		if (!categoryRows.has(id)) categoryRows.set(id, { id, kind, section, slug, name, position: categoryRows.size });
		return id;
	}

	const albumRows: Row[] = [];
	const albumItemRows: Row[] = [];
	function album(id: string, title: string, photos: GalleryImage[]): string | null {
		if (!photos.length) return null;
		albumRows.push({ id, title });
		photos.forEach((photo, position) => {
			albumItemRows.push({ albumId: id, position, mediaId: mediaId(photo.src), title: photo.title, caption: photo.caption });
		});
		return id;
	}

	const postRows = content.posts.map((post): Row => {
		const photos = post.gallery.length ? post.gallery : (content.albums.get(post.id) ?? []);
		const thumbnail = picture(post.thumbnail);
		const banner = picture(post.banner);
		return {
			id: post.id,
			slug: post.slug,
			title: post.title,
			subtitle: post.subtitle,
			section: post.section,
			categoryId: category("post", post.section, post.category.slug, post.category.name),
			author: post.author,
			publishedDate: post.publishedDate,
			status: "published",
			legacyViews: post.views,
			thumbnailMediaId: thumbnail.id,
			thumbnailPosition: thumbnail.position,
			bannerMediaId: banner.id,
			bannerPosition: banner.position,
			summary: post.summary,
			intro: post.intro,
			contentHtml: post.contentHtml,
			keywords: post.keywords,
			videos: post.videos,
			albumId: album(`post:${post.id}`, post.title, photos),
			galleryCount: post.galleryCount,
		};
	});

	const teachingRows = content.tongChi.map((entry, position): Row => {
		const banner = picture(entry.banner);
		return {
			id: entry.id,
			slug: entry.slug,
			title: entry.title,
			name: entry.name,
			subtitle: entry.subtitle,
			groupId: category("tong-chi", "", entry.group.slug, entry.group.name),
			bannerMediaId: banner.id,
			bannerPosition: banner.position,
			excerpt: entry.excerpt,
			body: entry.body,
			author: entry.author,
			authorHref: entry.authorHref,
			publishedDate: entry.publishedDate,
			legacyViews: entry.views,
			video: entry.video,
			featured: entry.featured,
			book: entry.book,
			keywords: entry.keywords,
			albumId: album(`teaching:${entry.id}`, entry.title, entry.gallery),
			position,
			status: "published",
		};
	});

	const milestoneRows: Row[] = [];
	const pageRows = content.about.map((topic, position): Row => {
		const banner = picture(topic.banner);
		const portrait = picture(topic.portrait);
		topic.milestones.forEach((item, index) => milestoneRows.push({ pageId: topic.id, position: index, ...item }));
		return {
			id: topic.id,
			slug: topic.slug,
			title: topic.title,
			subtitle: topic.subtitle,
			kicker: topic.tag,
			groupId: category("about", "", topic.group.slug, topic.group.name),
			bannerMediaId: banner.id,
			bannerPosition: banner.position,
			portraitMediaId: portrait.id,
			portraitPosition: portrait.position,
			overview: topic.overview,
			quote: topic.quote,
			contentHtml: topic.contentHtml,
			book: topic.book,
			albumId: album(`page:${topic.id}`, topic.title, topic.gallery),
			position,
			status: "published",
		};
	});

	const areaRows = content.areas.map((area, position): Row => {
		const cover = picture(area.cover);
		return {
			id: area.id,
			slug: area.slug,
			name: area.name,
			subtitle: area.subtitle,
			temple: area.temple,
			coverMediaId: cover.id,
			coverPosition: cover.position,
			mapX: area.mapPos?.x ?? null,
			mapY: area.mapPos?.y ?? null,
			intro: area.intro,
			contentHtml: area.contentHtml,
			position,
		};
	});

	// The Bảo Tượng file names an area its own way ("nha_mau"); config/vuTru.ts says which area each code is.
	const areaIdByStatueCode = new Map<string, string>();
	for (const [areaSlug, codes] of Object.entries(vuTru.statueAreas)) {
		const area = content.areas.find((item) => item.slug === areaSlug);
		if (area) for (const code of codes) areaIdByStatueCode.set(code, area.id);
	}

	// A cluster is a name inside an assembly; it stands in the area most of its statues do.
	const clusters = new Map<string, { name: string; assembly: string | null; areas: Map<string, number> }>();
	const clusterIdOf = (statue: StatueEntry): string | null => {
		if (!statue.cluster) return null;
		const id = `cluster:${statue.assembly.slug}:${slugOf(statue.cluster)}`;
		const found = clusters.get(id) ?? { name: statue.cluster, assembly: category("assembly", "", statue.assembly.slug, statue.assembly.name), areas: new Map() };
		const areaId = areaIdByStatueCode.get(statue.areaCode);
		if (areaId) found.areas.set(areaId, (found.areas.get(areaId) ?? 0) + 1);
		clusters.set(id, found);
		return id;
	};

	const statueIds = new Set(content.statues.map((statue) => statue.id));
	const artRows: Row[] = [];
	const statueRows = content.statues.map((statue, position): Row => {
		const image = picture(statue.image);
		statue.art.forEach((variation, index) => {
			const art = picture(variation.image);
			artRows.push({
				id: `${statue.id}:${index}`,
				statueId: statue.id,
				position: index,
				variationId: variation.id,
				artStatueId: statueIds.has(variation.id) ? variation.id : null,
				title: variation.title,
				location: variation.location,
				meaning: variation.meaning,
				imageMediaId: art.id,
				imagePosition: art.position,
			});
		});
		return {
			id: statue.id,
			code: statue.code,
			slug: statue.slug,
			name: statue.name,
			subtitle: statue.subtitle,
			areaId: areaIdByStatueCode.get(statue.areaCode) ?? null,
			areaCode: statue.areaCode,
			clusterId: clusterIdOf(statue),
			assemblyId: category("assembly", "", statue.assembly.slug, statue.assembly.name),
			isMain: statue.main,
			imageMediaId: image.id,
			imagePosition: image.position,
			quoteText: statue.quote?.text ?? null,
			quoteAuthor: statue.quote?.author ?? null,
			body: statue.text,
			position,
		};
	});
	const clusterRows = [...clusters.entries()].map(([id, cluster]): Row => {
		const [areaId] = [...cluster.areas.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null];
		return { id, name: cluster.name, assemblyId: cluster.assembly, areaId };
	});

	const monkRows = content.monks.map((monk, position): Row => {
		const avatar = picture(monk.avatar ? { src: monk.avatar, position: DEFAULT_POSITION } : null);
		return {
			id: monk.id,
			name: monk.name,
			lifespan: monk.lifespan,
			region: monk.region,
			sangha: monk.sangha,
			sect: monk.sect,
			era: monk.era,
			subEra: monk.subEra,
			avatarMediaId: avatar.id,
			dharmaQuote: monk.dharmaQuote,
			bio: monk.bio,
			coordX: monk.coordinates?.x ?? null,
			coordY: monk.coordinates?.y ?? null,
			position,
		};
	});

	const eventRows = content.schedule.events.map((event, position): Row => {
		const image = picture(event.image);
		return {
			id: event.id,
			slug: event.slug,
			title: event.title,
			subtitle: event.subtitle,
			categoryId: category("event", "", event.category.slug, event.category.name),
			startDate: event.start,
			endDate: event.end,
			times: event.times,
			location: event.location,
			description: event.description,
			notes: event.notes,
			imageMediaId: image.id,
			imagePosition: image.position,
			video: event.video,
			position,
		};
	});
	const programRows = content.schedule.programs.map((program, position): Row => {
		const image = picture(program.image);
		return {
			id: program.id,
			title: program.title,
			subtitle: program.subtitle,
			summary: program.summary,
			time: program.time,
			duration: program.duration,
			location: program.location,
			imageMediaId: image.id,
			imagePosition: image.position,
			position,
		};
	});
	const themeRows = content.schedule.themes.map(
		(theme): Row => ({ month: theme.month, title: theme.title, posterMediaId: mediaId(theme.poster), lines: theme.lines, author: theme.author }),
	);
	const quoteRows = content.schedule.quotes.map((quote, position): Row => ({ id: quote.id, title: quote.title, mediaId: mediaId(quote.src), position }));

	// ------------------------------------------------------------ statements
	/** Rows written as upserts on `key`, a few to a statement and each statement under D1's size limit. */
	function upsert(table: AnySQLiteTable, rows: Row[], key: string[] = ["id"]) {
		if (!rows.length) return;
		const columns = getTableColumns(table);
		const keyNames = new Set(key);
		const set = Object.fromEntries(
			Object.entries(columns)
				.filter(([name]) => !keyNames.has(name) && name in rows[0])
				.map(([name, column]) => [name, sql.raw(`excluded."${column.name}"`)]),
		);
		const target = key.map((name) => columns[name]);
		let batch: Row[] = [];
		let bytes = 0;
		const flush = () => {
			if (!batch.length) return;
			const insert = db.insert(table).values(batch as never);
			// A table of keys only (nothing to update) just ignores a row that is already there.
			statements.push((Object.keys(set).length ? insert.onConflictDoUpdate({ target: target as never, set }) : insert.onConflictDoNothing()).toSQL());
			batch = [];
			bytes = 0;
		};
		for (const original of rows) {
			let row = original;
			let size = byteLength(row);
			let rest: { field: string; piece: string }[] = [];
			if (size > MAX_STATEMENT_BYTES) {
				// The longest text goes in pieces; the row itself keeps the first.
				const field = Object.keys(row).reduce((best, name) => (String(row[name]).length > String(row[best]).length && typeof row[name] === "string" ? name : best), key[0]);
				const value = row[field];
				if (typeof value === "string" && key.length === 1) {
					const [first, ...others] = pieces(value, PIECE_BYTES);
					row = { ...row, [field]: first };
					rest = others.map((piece) => ({ field, piece }));
					size = byteLength(row);
				}
				if (size > MAX_STATEMENT_BYTES) oversizedRows.push(`${getTableName(table)} ${String(row[key[0]])}: ${size} byte`);
			}
			if (batch.length && (bytes + size > MAX_STATEMENT_BYTES || batch.length >= 25 || rest.length)) flush();
			batch.push(row);
			bytes += size;
			if (rest.length) {
				flush();
				for (const { field, piece } of rest) {
					statements.push(db.update(table).set({ [field]: sql`${columns[field]} || ${piece}` } as never).where(eq(columns[key[0]], row[key[0]] as never)).toSQL());
				}
			}
		}
		flush();
	}

	/** Removes the rows of `table` whose key is no longer in the source. */
	function prune(table: AnySQLiteTable, column: string, keep: unknown[]) {
		const target = getTableColumns(table)[column];
		statements.push((keep.length ? db.delete(table).where(notInArray(target, keep as never[])) : db.delete(table)).toSQL());
	}

	// Children first: what points at a row goes before it, and comes back after it.
	for (const table of [schema.artVariation, schema.milestone, schema.albumItem]) statements.push(db.delete(table).toSQL());

	// Parents before the rows that point at them.
	upsert(schema.media, [...mediaRows.values()]);
	upsert(schema.category, [...categoryRows.values()]);
	upsert(schema.album, albumRows);
	upsert(schema.albumItem, albumItemRows, ["albumId", "position"]);
	upsert(schema.area, areaRows);
	upsert(schema.statueCluster, clusterRows);
	upsert(schema.statue, statueRows);
	upsert(schema.artVariation, artRows);
	upsert(schema.post, postRows);
	upsert(schema.teachingArticle, teachingRows);
	upsert(schema.page, pageRows);
	upsert(schema.milestone, milestoneRows, ["pageId", "position"]);
	upsert(schema.monk, monkRows);
	upsert(schema.calendarEvent, eventRows);
	upsert(schema.featuredProgram, programRows);
	upsert(schema.monthTheme, themeRows, ["month"]);
	upsert(schema.quoteImage, quoteRows);

	// What the source dropped goes last, the rows that point at others first.
	prune(schema.statue, "id", statueRows.map((row) => row.id));
	prune(schema.statueCluster, "id", clusterRows.map((row) => row.id));
	prune(schema.area, "id", areaRows.map((row) => row.id));
	prune(schema.post, "id", postRows.map((row) => row.id));
	prune(schema.teachingArticle, "id", teachingRows.map((row) => row.id));
	prune(schema.page, "id", pageRows.map((row) => row.id));
	prune(schema.monk, "id", monkRows.map((row) => row.id));
	prune(schema.calendarEvent, "id", eventRows.map((row) => row.id));
	prune(schema.featuredProgram, "id", programRows.map((row) => row.id));
	prune(schema.monthTheme, "month", themeRows.map((row) => row.month));
	prune(schema.quoteImage, "id", quoteRows.map((row) => row.id));
	prune(schema.album, "id", albumRows.map((row) => row.id));
	prune(schema.category, "id", [...categoryRows.keys()]);

	const largestBytes = Math.max(0, ...statements.map((statement) => Buffer.byteLength(inlineStatement(statement))));
	return { statements, report: { statements: statements.length, largestBytes, oversizedRows } };
}

function decodeSafe(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** The statement with its values written into it, for a .sql file run by `cf d1 execute`. */
export function inlineStatement({ sql: query, params }: Statement): string {
	let index = 0;
	const text = query.replace(/\?/g, () => literal(params[index++]));
	if (index !== params.length) throw new Error(`Câu lệnh có ${index} chỗ trống nhưng ${params.length} giá trị`);
	return `${text};`;
}

function literal(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
	if (typeof value === "boolean") return value ? "1" : "0";
	return `'${String(value).replace(/'/g, "''")}'`;
}
