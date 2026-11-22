// The import (T23): the old admin's content, as the content layer already reads it, turned
// into the statements that fill the D1 tables of schema.ts. It reuses the adapters of
// src/libs/content (the same cleaning of titles, categories, pictures and text), so what D1
// holds is what the site shows today.
//
// Running it again gives the same rows: every table is written with an upsert on the old
// admin's id, rows that left the source are removed, and the tables the site fills itself
// (page_view, registration) and the admin's (user, audit_log, setting, notice, redirect) are
// never touched. It runs in Node (scripts/import.ts), not in the Worker.
//
// That default overwrites and prunes, so it must not run on a D1 the new admin writes to. For
// that there is `merge` (T42d a): every row is only inserted `on conflict do nothing`, nothing is
// updated, deleted or pruned, so a row that is already there (edited, trashed, made by the
// admin, or gone from the source) is left as it is, and a row new to the database is added.
//
// The children of a page (milestone), an album (album_item) and a statue (art_variation) are the
// exception to "a missing row is added": the admin saves them with DELETE ... WHERE parent = ?
// followed by the whole list, so a position that is missing may be one it deleted. In merge a child
// is inserted only under a parent the admin has never touched (see CHILDREN below).
import { createHash } from "node:crypto";
import { uniqueSlugs } from "../libs/content/slugs";
import { and, eq, getTableColumns, getTableName, notInArray, type SQL, sql } from "drizzle-orm";
import { type AnySQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
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
	const posts = postsFile ? uniqueSlugs(parsePosts(postsFile.data, { keepDuplicateSlugs: true }).posts) : [];
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
// In merge mode a piece is appended only to a row whose text has this many characters at each end
// (and the length) of what was written so far.
const GUARD_CHARS = 200;

const byteLength = (value: unknown) => Buffer.byteLength(JSON.stringify(value));

/**
 * `text` cut into pieces of at most `size` bytes of UTF-8, never inside a character. The bytes of
 * the piece so far are summed a character at a time (no character can join its neighbour into a
 * longer one, for a surrogate pair is one character to `for ... of`), so it costs one pass.
 */
function pieces(text: string, size: number): string[] {
	const out: string[] = [];
	let current = "";
	let bytes = 0;
	for (const char of text) {
		const width = Buffer.byteLength(char);
		if (bytes + width > size) {
			out.push(current);
			current = "";
			bytes = 0;
		}
		current += char;
		bytes += width;
	}
	out.push(current);
	return out;
}

/**
 * What decides whether the admin has touched a row of a parent table: the admin signs every row it
 * creates (`created_by`), saves one with `version = version + 1` and `updated_by`, and trashes one with
 * `deleted_at` (src/admin/content/service.ts, src/admin/special/statues.ts). The import writes none of
 * these, so a row of an import has version 1 and no signature.
 */
const untouched = (table: string) => `"${table}"."version" = 1 and "${table}"."updated_by" is null and "${table}"."created_by" is null and "${table}"."deleted_at" is null`;

/** Whose edits decide whether a child may be added: the rows of `table` whose `column` holds the parent's value. */
type Owner = { table: string; column: string };

/**
 * The tables whose rows are written as a list under a parent (the admin deletes the list and writes
 * it again), the key column that names the parent and the parent's owner rows.
 *
 * Why this and not "the parent was inserted by this very run": that cannot be told inside the SQL
 * of one statement. The statements of an import go to D1 as several batches (a .sql file or
 * batch-NNN.json files), one transaction each, so a test that looks at the previous statement
 * (changes()) or at a flag kept between statements (a temp table, PRAGMA defer_foreign_keys) breaks where
 * a batch ends. The condition here is a plain `where exists (...)` inside the one INSERT that writes the
 * children, so it holds whatever the batches are, in a local SQLite file and in D1 alike. It also lets
 * a run that was cut off between a parent and its children be finished by the next one.
 * An album has no signature columns of its own: the post, the article or the page that points at it
 * (and is written before its children, see the order of the upserts) stands for it.
 */
const CHILDREN: Record<string, { fk: string; owners: Owner[] }> = {
	milestone: { fk: "pageId", owners: [{ table: "page", column: "id" }] },
	art_variation: { fk: "statueId", owners: [{ table: "statue", column: "id" }] },
	album_item: {
		fk: "albumId",
		owners: [
			{ table: "post", column: "album_id" },
			{ table: "teaching_article", column: "album_id" },
			{ table: "page", column: "album_id" },
		],
	},
};

/**
 * The unique indexes a row of the import can run into (migration 0004): a row of the source that has
 * the value of a live row the database holds is turned away by `on conflict do nothing`, for that
 * covers every unique index and not only the id. `where` is the partial index's condition, `skipEmpty` the
 * column whose empty value is not indexed.
 */
const UNIQUE: Record<string, { columns: string[]; where: string; skipEmpty?: string }[]> = {
	post: [{ columns: ["section", "slug"], where: `"deleted_at" is null` }],
	page: [{ columns: ["slug"], where: `"deleted_at" is null` }],
	teaching_article: [{ columns: ["slug"], where: `"deleted_at" is null` }],
	area: [{ columns: ["slug"], where: `"deleted_at" is null` }],
	statue: [
		{ columns: ["slug"], where: `"deleted_at" is null` },
		{ columns: ["code"], where: `"deleted_at" is null and "code" <> ''`, skipEmpty: "code" },
	],
	category: [{ columns: ["kind", "section", "slug"], where: `"deleted_at" is null` }],
	calendar_event: [{ columns: ["slug"], where: `"deleted_at" is null` }],
};

/** What a row of a child table hangs from: the owner row that tells whether the admin has touched it. */
export type ParentRef = { table: string; column: string; /** The value of `column` that names the parent. */ value: unknown; /** The key of the owner row if this import writes it. */ id: unknown };

/** One unique index's values for each key of a `TableKeys` (null: the row is not in the index). */
export type UniqueKeys = { columns: string[]; where: string; values: (unknown[] | null)[] };

/** The keys of the rows the import writes to one table, to count which of them a database lacks. */
export type TableKeys = {
	table: string;
	/** SQL names of the key columns. */
	columns: string[];
	keys: unknown[][];
	/** Merge: the unique indexes a row can collide with (SQL names). */
	unique?: UniqueKeys[];
	/** Merge, a child table: per key, its parent. */
	parents?: ParentRef[];
	/** The single-column foreign keys of the table, with the value of each row (null: none). */
	refs?: { column: string; table: string; values: unknown[] }[];
};

/** How the import was cut into statements, for a report. */
export type StatementReport = { statements: number; largestBytes: number; oversizedRows: string[]; tables: TableKeys[] };

export type BuildOptions = {
	/**
	 * Only add: insert what is not in the database, never update, delete or prune (see the top of
	 * this file). Default false: the full import that overwrites and prunes.
	 */
	merge?: boolean;
};

const slugOf = (name: string) => bare(name).replace(/ /g, "-");

export function buildStatements(content: ImportContent, options: BuildOptions = {}): { statements: Statement[]; report: StatementReport } {
	const merge = options.merge === true;
	const statements: Statement[] = [];
	const plan: TableKeys[] = [];
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
	/** Per album id: the row (a post, an article, a page) that points at it. */
	const albumOwners = new Map<string, { table: string; id: string }>();
	function album(id: string, title: string, photos: GalleryImage[], owner: { table: string; id: string }): string | null {
		if (!photos.length) return null;
		albumRows.push({ id, title });
		albumOwners.set(id, owner);
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
			albumId: album(`post:${post.id}`, post.title, photos, { table: "post", id: post.id }),
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
			albumId: album(`teaching:${entry.id}`, entry.title, entry.gallery, { table: "teaching_article", id: entry.id }),
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
			albumId: album(`page:${topic.id}`, topic.title, topic.gallery, { table: "page", id: topic.id }),
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
	function upsert(table: AnySQLiteTable, rows: Row[], key: string[] = ["id"], parents?: ParentRef[]) {
		if (!rows.length) return;
		const columns = getTableColumns(table);
		const tableName = getTableName(table);
		const entry: TableKeys = { table: tableName, columns: key.map((name) => columns[name].name), keys: rows.map((row) => key.map((name) => row[name])) };
		if (parents) entry.parents = parents;
		const unique = UNIQUE[tableName];
		if (unique) {
			entry.unique = unique.map(({ columns: names, where, skipEmpty }) => ({
				columns: names.map((name) => columns[name].name),
				where,
				values: rows.map((row) => (skipEmpty && row[skipEmpty] === "" ? null : names.map((name) => row[name]))),
			}));
		}
		const refs = getTableConfig(table)
			.foreignKeys.map((foreign) => foreign.reference())
			.filter(({ columns: own }) => own.length === 1)
			.map(({ columns: own, foreignTable }) => {
				const name = Object.keys(columns).find((candidate) => columns[candidate] === own[0]) as string;
				return { column: own[0].name, table: getTableName(foreignTable), values: rows.map((row) => row[name] ?? null) };
			});
		if (refs.length) entry.refs = refs;
		plan.push(entry);
		// In merge, a child is only inserted under a parent the admin has not touched (see CHILDREN).
		const child = merge ? CHILDREN[tableName] : undefined;
		const keyNames = new Set(key);
		// In merge mode nothing is ever updated: a row that is there is kept whatever the source says.
		const set = merge
			? {}
			: Object.fromEntries(
					Object.entries(columns)
						.filter(([name]) => !keyNames.has(name) && name in rows[0])
						.map(([name, column]) => [name, sql.raw(`excluded."${column.name}"`)]),
				);
		const target = key.map((name) => columns[name]);
		let batch: Row[] = [];
		let bytes = 0;
		const flush = () => {
			if (!batch.length) return;
			if (child) {
				statements.push(childInsert(table, batch, child));
			} else {
				const insert = db.insert(table).values(batch as never);
				// A table of keys only (nothing to update) just ignores a row that is already there.
				statements.push((Object.keys(set).length ? insert.onConflictDoUpdate({ target: target as never, set }) : insert.onConflictDoNothing()).toSQL());
			}
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
					// SQLite's length() and substr() stop at a NUL character while JavaScript goes on, so the guard of a
					// piece (merge) and the sum of the pieces (both modes) would not agree: the text would be cut short
					// without a word. Better to refuse the import than to write a row that lost the end of its text.
					if (value.includes("\0")) {
						throw new Error(`${tableName} ${String(row[key[0]])}: văn bản "${field}" dài hơn một câu lệnh D1 nên phải cắt đoạn, nhưng chứa ký tự NUL (U+0000); hãy bỏ ký tự đó ở nguồn rồi nhập lại.`);
					}
					const [first, ...others] = pieces(value, PIECE_BYTES);
					row = { ...row, [field]: first };
					rest = others.map((piece) => ({ field, piece }));
					size = byteLength(row);
				}
				if (size > MAX_STATEMENT_BYTES) oversizedRows.push(`${tableName} ${String(row[key[0]])}: ${size} byte`);
			}
			if (batch.length && (bytes + size > MAX_STATEMENT_BYTES || batch.length >= 25 || rest.length)) flush();
			batch.push(row);
			bytes += size;
			if (rest.length) {
				flush();
				const done = [String(row[rest[0].field])];
				let length = [...done[0]].length;
				for (const { field, piece } of rest) {
					const where = eq(columns[key[0]], row[key[0]] as never);
					let guard: SQL | undefined = where;
					if (merge) {
						// The row may be there already: then the insert did nothing and its text is not ours to extend.
						// A piece is only appended to a row that holds what has been written so far, which is told by
						// its length (in characters, as SQLite counts), its first and its last characters. A row of an
						// earlier import holds the whole text, a row the admin edited another one: neither matches.
						const head = [...done[0]].slice(0, GUARD_CHARS).join("");
						const tail = [...done[done.length - 1]].slice(-GUARD_CHARS);
						guard = and(
							where,
							sql`length(${columns[field]}) = ${length}`,
							sql`substr(${columns[field]}, 1, ${[...head].length}) = ${head}`,
							sql`substr(${columns[field]}, ${length - tail.length + 1}) = ${tail.join("")}`,
						);
					}
					statements.push(db.update(table).set({ [field]: sql`${columns[field]} || ${piece}` } as never).where(guard).toSQL());
					done.push(piece);
					length += [...piece].length;
				}
			}
		}
		flush();
	}

	/** Removes the rows of `table` whose key is no longer in the source. */
	function prune(table: AnySQLiteTable, column: string, keep: unknown[]) {
		// Merge never deletes: a row the source dropped may be one the admin keeps.
		if (merge) return;
		const target = getTableColumns(table)[column];
		statements.push((keep.length ? db.delete(table).where(notInArray(target, keep as never[])) : db.delete(table)).toSQL());
	}

	// Children first: what points at a row goes before it, and comes back after it. (Merge keeps them
	// and only adds the ones it lacks.)
	if (!merge) for (const table of [schema.artVariation, schema.milestone, schema.albumItem]) statements.push(db.delete(table).toSQL());

	/** What each child row hangs from, to tell (merge) whether the admin has touched it. */
	const ownedBy = (table: string, column: string, field: string) => (row: Row): ParentRef => ({ table, column, value: row[field], id: row[field] });
	const albumItemParents = albumItemRows.map((row): ParentRef => {
		const owner = albumOwners.get(String(row.albumId)) as { table: string; id: string };
		return { table: owner.table, column: "album_id", value: row.albumId, id: owner.id };
	});

	// Parents before the rows that point at them.
	upsert(schema.media, [...mediaRows.values()]);
	upsert(schema.category, [...categoryRows.values()]);
	upsert(schema.album, albumRows);
	// An album's items are written once the post, article or page that owns the album is (merge looks at that row).
	if (!merge) upsert(schema.albumItem, albumItemRows, ["albumId", "position"], albumItemParents);
	upsert(schema.area, areaRows);
	upsert(schema.statueCluster, clusterRows);
	upsert(schema.statue, statueRows);
	upsert(schema.artVariation, artRows, ["id"], artRows.map(ownedBy("statue", "id", "statueId")));
	upsert(schema.post, postRows);
	upsert(schema.teachingArticle, teachingRows);
	upsert(schema.page, pageRows);
	if (merge) upsert(schema.albumItem, albumItemRows, ["albumId", "position"], albumItemParents);
	upsert(schema.milestone, milestoneRows, ["pageId", "position"], milestoneRows.map(ownedBy("page", "id", "pageId")));
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
	return { statements, report: { statements: statements.length, largestBytes, oversizedRows, tables: plan } };
}

/**
 * One INSERT for the rows of a child table that only writes them under a parent the admin has not
 * touched (see CHILDREN). It reads the rows from a VALUES list so that the parent test can look at each
 * row's own parent: `where exists (...)` has to be there for SQLite to read `on conflict` as the
 * upsert clause of an INSERT ... SELECT. Single line and plain bound values, as the other statements.
 */
function childInsert(table: AnySQLiteTable, batch: Row[], child: { fk: string; owners: Owner[] }): Statement {
	const columns = Object.entries(getTableColumns(table)).filter(([name]) => name in batch[0]);
	const names = columns.map(([name]) => name);
	const outer = `column${names.indexOf(child.fk) + 1}`;
	const parent = child.owners.map(({ table: owner, column }) => `exists (select 1 from "${owner}" where "${owner}"."${column}" = ${outer} and ${untouched(owner)})`).join(" or ");
	const rowSql = `(${columns.map(() => "?").join(", ")})`;
	return {
		sql: `insert into "${getTableName(table)}" (${columns.map(([, column]) => `"${column.name}"`).join(", ")}) select ${columns.map((_, index) => `column${index + 1}`).join(", ")} from (values ${batch.map(() => rowSql).join(", ")}) where ${parent} on conflict do nothing`,
		params: batch.flatMap((row) => names.map((name) => row[name] ?? null)),
	};
}

/** The part of a database `countNewRows` uses (a node:sqlite DatabaseSync has it). */
export type RowReader = { prepare(sql: string): { get(...params: never[]): unknown } };

export type NewRows = { table: string; source: number; added: number };

/** A row of the source that `merge` will not add, though the database lacks its key, or one that will make the whole run fail. */
export type MergeConflict = {
	table: string;
	key: unknown[];
	/** "unique": a live row has its slug or code; "duplicate": an earlier row of the source has it; "foreign-key": it points at a row that is turned away. */
	reason: "unique" | "duplicate" | "foreign-key";
	/** In words, to print. */
	detail: string;
};

const keyText = (key: unknown[]) => key.map(String).join("/");

/**
 * What `merge` would do to a database, by reading it only: per table how many rows the import
 * writes and how many of them it adds, and the rows it cannot add. A row is added when its key is not
 * there, no live row holds its unique slug or code (a partial unique index turns it away, silently),
 * and, for a child, its parent is new in this run or untouched by the admin. A row that points at
 * a row the unique index turns away would break its foreign key, and the whole run is refused: that
 * is listed too. Tables are read in the order of the import, so a child sees which parents are new.
 */
export function mergeReport(db: RowReader, tables: TableKeys[]): { rows: NewRows[]; conflicts: MergeConflict[] } {
	const conflicts: MergeConflict[] = [];
	const added = new Map<string, Set<string>>();
	const turnedAway = new Map<string, Set<unknown>>();
	const addedIndexes = new Map<string, Set<number>>();
	const touched = (table: string, column: string) => db.prepare(`select 1 as found from "${table}" where "${column}" = ? and ${untouched(table)} limit 1`);
	const rows = tables.map((entry) => {
		const { table, columns, keys } = entry;
		const found = db.prepare(`select 1 as found from "${table}" where ${columns.map((column) => `"${column}" = ?`).join(" and ")} limit 1`);
		const holders = (entry.unique ?? []).map((index) => ({
			index,
			read: db.prepare(`select "${columns[0]}" as holder from "${table}" where ${index.columns.map((column) => `"${column}" = ?`).join(" and ")} and ${index.where} limit 1`),
			seen: new Set<string>(),
		}));
		const parents = new Map<string, ReturnType<typeof touched>>();
		const mine = new Set<string>();
		const indexes = new Set<number>();
		let count = 0;
		keys.forEach((key, position) => {
			if (found.get(...(key as never[])) !== undefined) return;
			for (const { index, read, seen } of holders) {
				const values = index.values[position];
				if (!values) continue;
				const holder = read.get(...(values as never[])) as { holder: unknown } | undefined;
				const name = `${index.columns.join(", ")} = ${values.map(String).join(", ")}`;
				const reason = holder ? ("unique" as const) : seen.has(JSON.stringify(values)) ? ("duplicate" as const) : null;
				if (reason) {
					conflicts.push({
						table,
						key,
						reason,
						detail: holder ? `${table} ${keyText(key)}: trùng (${name}) với dòng ${String(holder.holder)} đang có, nên sẽ bị bỏ qua` : `${table} ${keyText(key)}: trùng (${name}) với một dòng nguồn đứng trước, nên sẽ bị bỏ qua`,
					});
					if (columns.length === 1) turnedAway.set(table, (turnedAway.get(table) ?? new Set()).add(key[0]));
					return;
				}
			}
			const parent = entry.parents?.[position];
			if (parent) {
				const owner = added.get(parent.table)?.has(JSON.stringify([parent.id])) ?? false;
				const lookup = `${parent.table}.${parent.column}`;
				if (!parents.has(lookup)) parents.set(lookup, touched(parent.table, parent.column));
				if (!owner && (parents.get(lookup) as ReturnType<typeof touched>).get(parent.value as never) === undefined) return;
			}
			for (const { index, seen } of holders) {
				const values = index.values[position];
				if (values) seen.add(JSON.stringify(values));
			}
			mine.add(JSON.stringify(key));
			indexes.add(position);
			count += 1;
		});
		added.set(table, mine);
		addedIndexes.set(table, indexes);
		return { table, source: keys.length, added: count };
	});
	// A row that is added but points at a row the unique index turns away breaks its foreign key.
	for (const { table, keys, refs } of tables) {
		for (const { column, table: target, values } of refs ?? []) {
			const away = turnedAway.get(target);
			if (!away) continue;
			for (const position of addedIndexes.get(table) ?? []) {
				const value = values[position];
				if (value !== null && away.has(value)) {
					conflicts.push({
						table,
						key: keys[position],
						reason: "foreign-key",
						detail: `${table} ${keyText(keys[position])}: cột ${column} trỏ tới ${target} ${String(value)}, dòng này bị chỉ mục unique chặn, nên khóa ngoại sai và cả lượt nhập sẽ bị hủy`,
					});
				}
			}
		}
	}
	return { rows, conflicts };
}

/** Per table: how many rows the import writes and how many of them the database lacks (what `merge` would add). Reads only. */
export function countNewRows(db: RowReader, tables: TableKeys[]): NewRows[] {
	return mergeReport(db, tables).rows;
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
