// The albums of Giới thiệu pages ("page:<id>") and Tông Chỉ articles ("teaching:<id>") are read by a range on the album_item
// primary key, not by `like 'page:%'` (which scanned the 21 thousand rows of the posts' albums: 85 % of what D1 read).
// The range must give exactly what the LIKE gave, whatever else is in the table, and the plan must be a SEARCH of the index.
import { describe, expect, it } from "vitest";
import { buildStatements } from "../../../src/db/import";
import { applyMigrations, applyStatements, asD1, openDatabase } from "../../../src/db/nodeSqlite";
import type { TongChiEntry } from "../../../src/libs/content/tongChi";
import type { AboutTopic, GalleryImage, Post } from "../../../src/libs/content/types";
import { createD1Repository, type D1Like } from "@/libs/content/sources/d1";
import { B2, content, post } from "../helpers/importContent";

const photo = (name: string): GalleryImage => ({ src: `${B2}/g/${name}.webp`, title: `Ảnh ${name}`, caption: `Chú thích ${name}` });
const photos = (owner: string, count: number) => Array.from({ length: count }, (_, index) => photo(`${owner}-${index + 1}`));

const topic = (id: string, gallery: GalleryImage[]): AboutTopic => ({
	id,
	slug: id,
	title: `Trang ${id}`,
	subtitle: "",
	tag: "",
	group: { slug: "lich-su-chua", name: "Lịch Sử Chùa" },
	banner: null,
	portrait: null,
	overview: "",
	quote: null,
	milestones: [],
	contentHtml: "<p>Nội dung</p>",
	gallery,
	book: null,
});

const article = (id: string, gallery: GalleryImage[]): TongChiEntry => ({
	id,
	slug: `bai-${id}`,
	title: `Bài ${id}`,
	name: `Bài ${id}`,
	subtitle: "",
	group: { slug: "g1", name: "Một" },
	banner: null,
	excerpt: "",
	seoTitle: "",
	seoDescription: "",
	ogImage: null,
	author: "",
	authorHref: null,
	publishedDate: "2026-10-01",
	views: 0,
	video: null,
	featured: null,
	gallery,
	book: null,
	keywords: [],
	body: "Nội dung",
});

/** The last character there is: sorts after everything else in the range. */
const LAST = String.fromCharCode(0xffff);
const postWithAlbum = (id: string): Post => post(id, { gallery: photos(`post-${id}`, 4), galleryCount: 4 });

/** Owners whose ids share a prefix with each other ("a" and "a-b"), a post album, and pages and teachings with several pictures. */
function database() {
	const db = openDatabase();
	applyMigrations(db);
	applyStatements(
		db,
		buildStatements(
			content({
				posts: [postWithAlbum("1"), postWithAlbum("2"), postWithAlbum("page:3")],
				about: [topic("a", photos("a", 3)), topic("a-b", photos("ab", 2)), topic("z", photos("z", 1)), topic("none", [])],
				tongChi: [article("t", photos("t", 3)), article("t-2", photos("t2", 2))],
			}),
		).statements,
	);
	// Names that begin like an owner but are not one, and ids with LIKE's wildcards in them. None of them is a "page:" or "teaching:" album.
	const media = (db.prepare("select id from media order by id limit 1").get() as { id: string }).id;
	const decoy = (id: string, items = 2) => {
		db.prepare("insert into album (id, title) values (?, '')").run(id);
		for (let position = 0; position < items; position++) db.prepare("insert into album_item (album_id, position, media_id, title, caption) values (?, ?, ?, ?, '')").run(id, position, media, `${id}#${position}`);
	};
	for (const id of ["pages:x", "page", "pagex:1", "xpage:1", "post:page:1", "teachings:x", "teaching", "teachingx:1", "xteaching:1", "post:teaching:1", "pag:1", "tea:1", "page_:1", "p%:1", "post:100%"]) decoy(id);
	// Owned by a page or a teaching, with characters around the id that sort next to the range's edges.
	for (const id of ["page:", "page:%", "page::x", "page:_", "page:~", `page:${LAST}`, "teaching:", "teaching:Ünicode", "teaching:a b"]) decoy(id, 1);
	return db;
}

const OLD = "select ai.album_id, ai.title, ai.caption, m.r2_key, m.url from album_item ai join media m on m.id = ai.media_id where ai.album_id like ? order by ai.album_id, ai.position";
const NEW = "select ai.album_id, ai.title, ai.caption, m.r2_key, m.url from album_item ai join media m on m.id = ai.media_id where ai.album_id >= ? and ai.album_id < ? order by ai.album_id, ai.position";

describe("the range over album_item gives what `album_id like 'owner:%'` gave", () => {
	for (const owner of ["page", "teaching", "post"]) {
		it(`${owner}: the same rows, in the same order, with the decoys left out`, () => {
			const db = database();
			const before = db.prepare(OLD).all(`${owner}:%`);
			const after = db.prepare(NEW).all(`${owner}:`, `${owner};`);
			expect(after.length).toBeGreaterThan(0);
			expect(after).toEqual(before);
			expect(after.every((row) => String((row as { album_id: string }).album_id).startsWith(`${owner}:`))).toBe(true);
		});
	}

	it("exactly the albums of the owner (with odd ids included) are in; every look-alike name is out", () => {
		const db = database();
		const ids = (rows: unknown[]) => [...new Set(rows.map((row) => (row as { album_id: string }).album_id))];
		const pages = ids(db.prepare(NEW).all("page:", "page;"));
		expect(pages).toEqual(["page:", "page:%", "page::x", "page:_", "page:a", "page:a-b", "page:z", "page:~", `page:${LAST}`]);
		expect(ids(db.prepare(NEW).all("teaching:", "teaching;"))).toEqual(["teaching:", "teaching:a b", "teaching:t", "teaching:t-2", "teaching:Ünicode"]);
	});
});

describe("the d1 source reads each page's and article's own pictures through it", () => {
	it("listAboutTopics: a page gets its album only, in order, even when another id starts like its own", async () => {
		const about = await createD1Repository(asD1(database())).listAboutTopics();
		const byId = new Map(about.map((item) => [item.id, item.gallery.map((image) => image.title)]));
		expect(byId.get("a")).toEqual(["Ảnh a-1", "Ảnh a-2", "Ảnh a-3"]);
		expect(byId.get("a-b")).toEqual(["Ảnh ab-1", "Ảnh ab-2"]);
		expect(byId.get("z")).toEqual(["Ảnh z-1"]);
		expect(byId.get("none")).toEqual([]);
	});

	it("listTongChi: the same for the articles, and a post's album never reaches a page or an article", async () => {
		const repo = createD1Repository(asD1(database()));
		const tongChi = await repo.listTongChi();
		expect(tongChi.map((item) => item.slug).sort()).toEqual(["bai-t", "bai-t-2"]);
		const one = await repo.getTongChi("bai-t");
		expect(one?.gallery.map((image) => image.title)).toEqual(["Ảnh t-1", "Ảnh t-2", "Ảnh t-3"]);
		const two = await repo.getTongChi("bai-t-2");
		expect(two?.gallery.map((image) => image.title)).toEqual(["Ảnh t2-1", "Ảnh t2-2"]);
		const posts = await repo.getPostBySlug("bai-1");
		expect(posts?.gallery.map((image) => image.title)).toEqual(["Ảnh post-1-1", "Ảnh post-1-2", "Ảnh post-1-3", "Ảnh post-1-4"]);
	});
});

describe("the query plan", () => {
	/** A database that records what the source runs and answers it on the real schema. */
	function recording() {
		const db = database();
		const inner = asD1(db);
		const seen: { sql: string; params: unknown[] }[] = [];
		const wrapped: D1Like = {
			prepare(sql) {
				let params: unknown[] = [];
				const statement = inner.prepare(sql);
				const spy = {
					bind(...values: unknown[]) {
						params = values;
						statement.bind(...values);
						return spy;
					},
					all: <T>() => {
						seen.push({ sql, params });
						return statement.all<T>();
					},
				};
				return spy;
			},
		};
		return { db, wrapped, seen };
	}

	it("searches the album_item index by range, for pages and for teachings, and never scans the table", async () => {
		const { db, wrapped, seen } = recording();
		const repo = createD1Repository(wrapped);
		await repo.listAboutTopics();
		await repo.listTongChi();
		const album = seen.filter((item) => /from album_item ai/.test(item.sql) && /album_id >= \?/.test(item.sql));
		expect(album.map((item) => item.params)).toEqual([
			["page:", "page;"],
			["teaching:", "teaching;"],
		]);
		expect(seen.some((item) => /album_id like/i.test(item.sql))).toBe(false);
		for (const { sql, params } of album) {
			const plan = (db.prepare(`explain query plan ${sql}`).all(...(params as never[])) as { detail: string }[]).map((row) => row.detail);
			expect(plan.some((line) => /^SEARCH ai USING (COVERING )?INDEX sqlite_autoindex_album_item_1 \(album_id>\? AND album_id<\?\)$/.test(line)), plan.join(" | ")).toBe(true);
			expect(plan.some((line) => /^SCAN ai/.test(line))).toBe(false);
		}
	});
});
