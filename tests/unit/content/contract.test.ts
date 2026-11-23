// T24: one contract for every source of content. The snapshot, B2 and D1 must answer every
// question a page can ask in the same way, so changing CONTENT_SOURCE never changes the site.
// The snapshot is the reference: the other two are made from the same files (B2 through a
// bucket that serves them, D1 through the import into a real SQLite database).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildStatements, loadContent } from "../../../src/db/import";
import { applyMigrations, applyStatements, asD1, openDatabase } from "../../../src/db/nodeSqlite";
import { repositoryFromFiles } from "@/libs/content/repository";
import { b2Config, createB2Reader } from "@/libs/content/sources/b2";
import { createD1Repository } from "@/libs/content/sources/d1";
import { createFileLoaders, type ReadFile } from "@/libs/content/sources/files";
import type { ContentRepository, PostSort } from "@/libs/content/types";
import { content as smallContent, post as smallPost } from "../helpers/importContent";

const FILES = ["posts", "post-albums", "schedule", "gioi-thieu", "tong-chi", "vu-tru", "bao-tuong", "danh-tang"];
const hasSnapshot = ["posts", "tong-chi", "gioi-thieu", "vu-tru", "bao-tuong", "danh-tang", "schedule"].every((name) => existsSync(`data/snapshot/${name}.json`));

const readFromDisk: ReadFile = async (name) => {
	const path = `data/snapshot/${name}.json`;
	return existsSync(path) ? { version: "snapshot", data: JSON.parse(readFileSync(path, "utf8")) } : null;
};

/** A B2 bucket that serves the snapshot's files, asked through the real reader (signing, ETag and all). */
function viaB2(): ContentRepository {
	const bodies = new Map(FILES.filter((name) => existsSync(`data/snapshot/${name}.json`)).map((name) => [`/${name}.json`, readFileSync(`data/snapshot/${name}.json`, "utf8")]));
	const reader = createB2Reader(
		b2Config({ B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com", B2_BUCKET: "bucket", B2_KEY_ID: "id", B2_APPLICATION_KEY: "key" }),
		{
			fetch: async (request) => {
				const body = bodies.get(new URL(request.url).pathname.replace("/bucket", ""));
				return body === undefined ? new Response(null, { status: 404 }) : new Response(body, { status: 200, headers: { etag: '"v1"' } });
			},
		},
	);
	return repositoryFromFiles(createFileLoaders(reader));
}

async function viaD1(): Promise<ContentRepository> {
	const db = openDatabase();
	applyMigrations(db);
	applyStatements(db, buildStatements(await loadContent(readFromDisk)).statements);
	return createD1Repository(asD1(db));
}

/**
 * D1 alone knows the order the editors gave categories and Tông Chỉ groups (`position`, `groupPosition`), and lists categories in it;
 * the files only have the order the old admin wrote them in. What must match is everything else.
 */
const withoutPlaces = <T extends object>(items: T[]): T[] =>
	items.map((item) => {
		const rest = { ...item } as T & { position?: number; groupPosition?: number };
		delete rest.position;
		delete rest.groupPosition;
		return rest;
	});
const bySlug = <T extends { slug: string }>(items: T[]) => [...items].sort((a, b) => a.slug.localeCompare(b.slug));

const SECTIONS = ["dong-chay-hoang-phap", "tri-tue-phat-phap", "vu-tru-phat-giao"];
const SORTS: PostSort[] = ["newest", "oldest", "az", "za", "views"];

async function everyPostSlug(repo: ContentRepository): Promise<string[]> {
	const slugs: string[] = [];
	for (let page = 1; ; page++) {
		const { items, pageCount } = await repo.listPosts({ page, pageSize: 60 });
		slugs.push(...items.map((item) => item.slug));
		if (page >= pageCount) return slugs;
	}
}

describe.skipIf(!hasSnapshot)("every source answers as the snapshot does", () => {
	let reference: ContentRepository;
	const others: [string, ContentRepository][] = [];

	it("is set up", async () => {
		reference = repositoryFromFiles(createFileLoaders(readFromDisk));
		others.push(["B2", viaB2()], ["D1", await viaD1()]);
		expect((await reference.listPosts()).total).toBeGreaterThan(600);
	}, 120_000);

	it("lists posts by section, category, sort and page", async () => {
		for (const [name, repo] of others) {
			for (const section of [undefined, ...SECTIONS, SECTIONS.slice(0, 2)]) {
				for (const sort of SORTS) {
					for (const page of [1, 2, 9999]) {
						const query = { section, sort, page };
						expect(await repo.listPosts(query), `${name} ${JSON.stringify(query)}`).toEqual(await reference.listPosts(query));
					}
				}
			}
			for (const section of SECTIONS) {
				const categories = await reference.listCategories(section);
				expect(bySlug(withoutPlaces(await repo.listCategories(section))), `${name} ${section}`).toEqual(bySlug(withoutPlaces(categories)));
				for (const { slug } of categories) expect(await repo.listPosts({ section, category: slug, pageSize: 60 }), `${name} ${slug}`).toEqual(await reference.listPosts({ section, category: slug, pageSize: 60 }));
			}
			expect(await repo.listPosts({ pageSize: 0 })).toEqual(await reference.listPosts({ pageSize: 0 }));
			expect(await repo.listPosts({ pageSize: 5000 })).toEqual(await reference.listPosts({ pageSize: 5000 }));
		}
	}, 120_000);

	it("gives every post whole, by its slug, and nothing for an unknown one", async () => {
		const slugs = await everyPostSlug(reference);
		expect(slugs.length).toBeGreaterThan(600);
		for (const [name, repo] of others) {
			expect(await everyPostSlug(repo), name).toEqual(slugs);
			for (const slug of slugs) expect(await repo.getPostBySlug(slug), `${name} ${slug}`).toEqual(await reference.getPostBySlug(slug));
			expect(await repo.getPostBySlug("khong-co-bai-nay")).toBeNull();
		}
		// A slug stored percent-encoded (emoji) is found by its decoded form.
		const encoded = slugs.find((slug) => slug.includes("%"));
		if (encoded) for (const [, repo] of others) expect(await repo.getPostBySlug(decodeURIComponent(encoded))).toEqual(await reference.getPostBySlug(encoded));
	}, 120_000);

	it("gives the schedule, Giới thiệu, Tông Chỉ, areas and statues", async () => {
		for (const [name, repo] of others) {
			expect(await repo.getSchedule(), `${name} schedule`).toEqual(await reference.getSchedule());
			expect(await repo.listAboutTopics(), `${name} about`).toEqual(await reference.listAboutTopics());
			expect(await repo.listAreas(), `${name} areas`).toEqual(await reference.listAreas());

			const articles = await reference.listTongChi();
			expect(withoutPlaces(await repo.listTongChi()), `${name} tong chi`).toEqual(withoutPlaces(articles));
			for (const { slug } of articles) expect(withoutPlaces([(await repo.getTongChi(slug))!]), `${name} ${slug}`).toEqual(withoutPlaces([(await reference.getTongChi(slug))!]));
			expect(await repo.getTongChi("khong-co")).toBeNull();

			const statues = await reference.listStatues();
			expect(await repo.listStatues(), `${name} statues`).toEqual(statues);
			for (const { slug } of statues) expect(await repo.getStatue(slug), `${name} ${slug}`).toEqual(await reference.getStatue(slug));
			expect(await repo.getStatue("khong-co")).toBeNull();
		}
	}, 120_000);
});

// What only D1 has to get right: it is written to after the import, by the site and the admin.
describe("the d1 source", () => {
	function database(patch = {}) {
		const db = openDatabase();
		applyMigrations(db);
		applyStatements(db, buildStatements(smallContent(patch)).statements);
		return db;
	}

	it("shows the old admin's count plus the views counted since", async () => {
		const db = database();
		db.exec("insert into page_view (entity_type, entity_id, date, count) values ('post', '1', '2026-11-17', 5), ('post', '1', '2026-11-18', 3), ('post', '2', '2026-11-18', 1), ('tong-chi', '1', '2026-11-18', 40)");
		const repo = createD1Repository(asD1(db));
		const { items } = await repo.listPosts({ sort: "oldest" });
		// Post 1 had 12, post 2 had 12; the 40 views of an article of the same number are not theirs.
		expect(Object.fromEntries(items.map((item) => [item.id, item.views]))).toEqual({ 1: 20, 2: 13 });
	});

	it("leaves out a post that is not published and an area the admin hid", async () => {
		const db = database();
		db.exec("update post set status = 'draft' where id = '2'");
		db.exec("update area set visible = 0");
		const repo = createD1Repository(asD1(db));
		expect((await repo.listPosts()).items.map((item) => item.id)).toEqual(["1"]);
		expect(await repo.getPostBySlug("bai-2")).toBeNull();
		expect(await repo.listAreas()).toEqual([]);
	});

	it("refuses a second live post with the same slug in a section, while a trashed one does not block a new one", () => {
		// Migration 0004: a slug is unique among posts that are not in the trash (the import renames the later one to -2, see slugs.ts).
		expect(() => database({ posts: [smallPost("1", { slug: "phap-hoi" }), smallPost("2", { slug: "phap-hoi" })] })).toThrow(/UNIQUE/);
		const db = database({ posts: [smallPost("1", { slug: "phap-hoi" })] });
		db.exec("update post set deleted_at = '2026-11-21' where id = '1'");
		db.exec("insert into post (id, slug, title, section, published_date) select '9', slug, 'Mới', section, published_date from post where id = '1'");
		expect(db.prepare("select count(*) as n from post where slug = 'phap-hoi'").get()).toEqual({ n: 2 });
	});

	it("sees a post an admin saved after the import", async () => {
		const db = database();
		const repo = createD1Repository(asD1(db));
		expect((await repo.getPostBySlug("bai-1"))?.title).toBe("Bài 1");
		db.exec("update post set title = 'Bài một, đã sửa', content_html = '<p>Mới</p>' where id = '1'");
		// A repository keeps what it read; the one made next (every minute, in the Worker) has the change.
		const next = createD1Repository(asD1(db));
		expect(await next.getPostBySlug("bai-1")).toMatchObject({ title: "Bài một, đã sửa", contentHtml: "<p>Mới</p>" });
	});
});
