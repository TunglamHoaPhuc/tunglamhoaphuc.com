// The order the editors gave in the admin (category and Tông Chỉ group positions), the statue fields the admin saves
// (other angles, specs, SEO) and Lời Thầy dạy reach the public reader from D1, and the other sources answer with the empty defaults.
import { describe, expect, it } from "vitest";
import type { TongChiEntry } from "../../../src/libs/content/tongChi";
import { buildStatements } from "../../../src/db/import";
import { applyMigrations, applyStatements, asD1, openDatabase } from "../../../src/db/nodeSqlite";
import { repositoryFromFiles } from "@/libs/content/repository";
import { createD1Repository } from "@/libs/content/sources/d1";
import { createFileLoaders } from "@/libs/content/sources/files";
import { content as smallContent, post as smallPost, statue as smallStatue } from "../helpers/importContent";

function database(patch = {}) {
	const db = openDatabase();
	applyMigrations(db);
	applyStatements(db, buildStatements(smallContent(patch)).statements);
	return db;
}
const repoOf = (db: ReturnType<typeof database>) => createD1Repository(asD1(db));
const noFiles = () => createFileLoaders(async () => null);

const inCategory = (id: string, slug: string, name: string) => smallPost(id, { category: { slug, name } });

describe("category order: listCategories follows the editors' position", () => {
	// "dai" has the most posts, "nho" the fewest, "vua" in between: the old order was by count.
	const posts = () => [
		inCategory("1", "dai", "Dài"),
		inCategory("2", "dai", "Dài"),
		inCategory("3", "dai", "Dài"),
		inCategory("4", "vua", "Vừa"),
		inCategory("5", "vua", "Vừa"),
		inCategory("6", "nho", "Nhỏ"),
	];
	const place = (db: ReturnType<typeof database>, slug: string, position: number) => db.prepare("update category set position = ? where kind = 'post' and slug = ?").run(position, slug);

	it("gives each category its position and sorts by it, not by how many posts it has", async () => {
		const db = database({ posts: posts() });
		place(db, "dai", 30);
		place(db, "nho", 10);
		place(db, "vua", 20);
		const list = await repoOf(db).listCategories("dong-chay-hoang-phap");
		expect(list.map((item) => [item.slug, item.position, item.count])).toEqual([
			["nho", 10, 1],
			["vua", 20, 2],
			["dai", 30, 3],
		]);
	});

	it("follows a change of position made later in the admin (a new repository, as after the cache renews)", async () => {
		const db = database({ posts: posts() });
		place(db, "dai", 1);
		place(db, "vua", 2);
		place(db, "nho", 3);
		expect((await repoOf(db).listCategories("dong-chay-hoang-phap")).map((item) => item.slug)).toEqual(["dai", "vua", "nho"]);
		place(db, "nho", 0);
		expect((await repoOf(db).listCategories("dong-chay-hoang-phap")).map((item) => item.slug)).toEqual(["nho", "dai", "vua"]);
	});

	it("keeps the biggest first among categories with the same position, and keeps the sections apart", async () => {
		const db = database({ posts: posts() });
		db.exec("update category set position = 0");
		expect((await repoOf(db).listCategories("dong-chay-hoang-phap")).map((item) => item.slug)).toEqual(["dai", "vua", "nho"]);
		expect(await repoOf(db).listCategories("tri-tue-phat-phap")).toEqual([]);
	});

	it("leaves the posts' own category as it was (no position inside a post)", async () => {
		const db = database({ posts: posts() });
		db.exec("update category set position = 9");
		const [first] = (await repoOf(db).listPosts()).items;
		expect(Object.keys(first.category).sort()).toEqual(["name", "slug"]);
	});

	it("the files have no such order: the biggest first, and no position", async () => {
		const repo = repositoryFromFiles({ ...noFiles(), posts: async () => posts() });
		const list = await repo.listCategories("dong-chay-hoang-phap");
		expect(list.map((item) => item.slug)).toEqual(["dai", "vua", "nho"]);
		expect(list.every((item) => !("position" in item))).toBe(true);
	});
});

describe("Tông Chỉ group order: listTongChi comes group by group in the editors' order", () => {
	const entry = (id: string, group: string, name: string): TongChiEntry => ({
		id,
		slug: `bai-${id}`,
		title: `Bài ${id}`,
		name: `Bài ${id}`,
		subtitle: "",
		group: { slug: group, name },
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
		gallery: [],
		book: null,
		keywords: [],
		body: "Nội dung",
	});
	const entries = () => [entry("1", "g1", "Một"), entry("2", "g1", "Một"), entry("3", "g2", "Hai"), entry("4", "g3", "Ba")];
	const place = (db: ReturnType<typeof database>, slug: string, position: number) => db.prepare("update category set position = ? where kind = 'tong-chi' and slug = ?").run(position, slug);

	it("gives each article its group's position and puts the groups in that order, articles keeping theirs inside a group", async () => {
		const db = database({ tongChi: entries() });
		place(db, "g1", 30);
		place(db, "g2", 20);
		place(db, "g3", 10);
		const list = await repoOf(db).listTongChi();
		expect(list.map((item) => [item.slug, item.group.slug, item.groupPosition])).toEqual([
			["bai-4", "g3", 10],
			["bai-3", "g2", 20],
			["bai-1", "g1", 30],
			["bai-2", "g1", 30],
		]);
	});

	it("keeps a group together even when groups share a position, articles in the order the admin set", async () => {
		const db = database({ tongChi: entries() });
		db.exec("update category set position = 0 where kind = 'tong-chi'; update teaching_article set position = 9 where id = '1'; update teaching_article set position = 1 where id = '2'");
		const list = await repoOf(db).listTongChi();
		const runs = list.map((item) => item.group.slug).filter((slug, index, all) => slug !== all[index - 1]);
		expect(runs.sort()).toEqual(["g1", "g2", "g3"]);
		expect(list.filter((item) => item.group.slug === "g1").map((item) => item.slug)).toEqual(["bai-2", "bai-1"]);
	});

	it("an article's page carries the position too, and the files have none", async () => {
		const db = database({ tongChi: entries() });
		place(db, "g2", 7);
		expect(await repoOf(db).getTongChi("bai-3")).toMatchObject({ groupPosition: 7 });
		const files = repositoryFromFiles({ ...noFiles(), tongChi: async () => entries() });
		expect((await files.listTongChi()).every((item) => !("groupPosition" in item))).toBe(true);
	});
});

describe("statues: what the admin saves and was not read", () => {
	const withMedia = () => {
		const db = database({ statues: [smallStatue("1"), smallStatue("2")] });
		db.exec(
			`insert into media (id, r2_key, filename, mime) values ('m1', 'cms/m1/v1/a.webp', 'a.webp', 'image/webp'), ('m2', 'cms/m2/v1/b.webp', 'b.webp', 'image/webp'), ('m3', 'cms/m3/v1/c.webp', 'c.webp', 'image/webp')`,
		);
		return db;
	};

	it("gives the other angles in the admin's order, with label and where the editors centred each", async () => {
		const db = withMedia();
		db.exec(`insert into statue_image (statue_id, position, media_id, label, image_position) values
			('1', 1, 'm2', 'Bên trái', 'center 30%'), ('1', 0, 'm1', 'Chính diện', 'center 50%'), ('2', 0, 'm3', 'Chính diện', 'center 50%')`);
		const statue = await repoOf(db).getStatue("tuong-1_tp1");
		expect(statue?.images).toEqual([
			{ src: "/anh-goc/s2-cnv03/cms/m1/v1/a.webp", position: "center 50%", label: "Chính diện" },
			{ src: "/anh-goc/s2-cnv03/cms/m2/v1/b.webp", position: "center 30%", label: "Bên trái" },
		]);
		expect((await repoOf(db).getStatue("tuong-2_tp2"))?.images).toHaveLength(1);
	});

	it("leaves out an angle whose picture is in the trash", async () => {
		const db = withMedia();
		db.exec(`insert into statue_image (statue_id, position, media_id, label, image_position) values ('1', 0, 'm1', 'Chính diện', 'center 50%'), ('1', 1, 'm2', 'Bên trái', 'center 50%')`);
		db.exec("update media set deleted_at = '2026-11-01T00:00:00Z' where id = 'm1'");
		expect((await repoOf(db).getStatue("tuong-1_tp1"))?.images?.map((item) => item.label)).toEqual(["Bên trái"]);
	});

	it("gives the specs as a list in the saved order, and the SEO title and description", async () => {
		const db = withMedia();
		db.prepare("update statue set specs = ?, seo_title = 'Tiêu đề SEO', seo_description = 'Mô tả SEO' where id = '1'").run(JSON.stringify({ "Chất liệu": "Đồng", Cao: "3 m", Nặng: " 2 tấn " }));
		const statue = await repoOf(db).getStatue("tuong-1_tp1");
		expect(statue?.specs).toEqual([
			{ name: "Chất liệu", value: "Đồng" },
			{ name: "Cao", value: "3 m" },
			{ name: "Nặng", value: "2 tấn" },
		]);
		expect(statue).toMatchObject({ seoTitle: "Tiêu đề SEO", seoDescription: "Mô tả SEO" });
	});

	it("is empty, not missing, for a statue the editors gave nothing", async () => {
		const statue = await repoOf(withMedia()).getStatue("tuong-2_tp2");
		expect(statue).toMatchObject({ images: [], specs: [], seoTitle: "", seoDescription: "" });
	});

	it("does not change what a list gives, nor how the fields read before come out", async () => {
		const db = withMedia();
		db.exec("insert into statue_image (statue_id, position, media_id) values ('1', 0, 'm1')");
		const summaries = await repoOf(db).listStatues();
		for (const item of summaries) expect(Object.keys(item).sort()).toEqual(["areaCode", "assembly", "cluster", "code", "href", "id", "image", "main", "name", "slug", "subtitle"]);
		expect(await repoOf(db).getStatue("tuong-1_tp1")).toMatchObject({ id: "1", name: "Tượng 1", main: true, contentHtml: "<p>Lịch sử</p>", art: [] });
	});

	it("is empty from the files too", async () => {
		const read = async (name: string) => (name === "bao-tuong" ? { version: "1", data: [{ id: "1", code: "TP1", slug: "tuong-1_tp1", name: "Tượng 1" }] } : null);
		const repo = repositoryFromFiles(createFileLoaders(read));
		expect(await repo.getStatue("tuong-1_tp1")).toMatchObject({ images: [], specs: [], seoTitle: "", seoDescription: "" });
	});
});

describe("Lời Thầy dạy: listQuotes", () => {
	it("gives the sayings switched on, not in the trash, in the admin's order", async () => {
		const db = database();
		db.exec(`insert into quote (id, text, author, source, source_url, position, active, deleted_at) values
			('q3', 'Ba', '', '', '', 3, 1, null), ('q1', 'Một', 'Thầy', 'Kinh A', 'https://a.vn', 1, 1, null),
			('q2', 'Hai', '', '', '', 2, 0, null), ('q4', 'Bốn', '', '', '', 4, 1, '2026-11-01T00:00:00Z'), ('q0', '  ', '', '', '', 0, 1, null)`);
		expect(await repoOf(db).listQuotes()).toEqual([
			{ id: "q1", text: "Một", author: "Thầy", source: "Kinh A", sourceUrl: "https://a.vn" },
			{ id: "q3", text: "Ba", author: "", source: "", sourceUrl: "" },
		]);
	});

	it("is empty when the editors wrote none, and from the snapshot and B2 sources", async () => {
		expect(await repoOf(database()).listQuotes()).toEqual([]);
		expect(await repositoryFromFiles(noFiles()).listQuotes()).toEqual([]);
	});

	it("is read again by a new repository, so a saved change shows after the cache renews", async () => {
		const db = database();
		expect(await repoOf(db).listQuotes()).toEqual([]);
		db.exec("insert into quote (id, text, position, active) values ('q1', 'Mới', 1, 1)");
		expect((await repoOf(db).listQuotes()).map((item) => item.id)).toEqual(["q1"]);
	});
});
