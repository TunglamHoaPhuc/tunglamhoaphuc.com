// What the admin saves and the public reader must use (B6, B7, B13): the d1 source reads posts by section and slug, selects
// the saved SEO, share picture, pin, extra fields and related posts, and shows a scheduled post whose time has come.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStatements } from "../../../src/db/import";
import { applyMigrations, applyStatements, asD1, openDatabase } from "../../../src/db/nodeSqlite";
import { createD1Repository } from "@/libs/content/sources/d1";
import type { ContentRepository } from "@/libs/content/types";
import { content as smallContent, post as smallPost } from "../helpers/importContent";

function database(patch = {}) {
	const db = openDatabase();
	applyMigrations(db);
	applyStatements(db, buildStatements(smallContent(patch)).statements);
	return db;
}
const repoOf = (db: ReturnType<typeof database>): ContentRepository => createD1Repository(asD1(db));

describe("B6: posts are told apart by section and slug", () => {
	function twoSections() {
		const db = database({ posts: [smallPost("1", { slug: "chung" })] });
		db.exec(`insert into post (id, slug, title, section, category_id, published_date, status, content_html)
			values ('2', 'chung', 'Bài của Trí Tuệ', 'tri-tue-phat-phap', null, '2026-10-18', 'published', '<p>Trí Tuệ</p>')`);
		return db;
	}

	it("lists both posts that share a slug in different sections, and gives each by its section", async () => {
		const repo = repoOf(twoSections());
		expect((await repo.listPosts()).items.map((item) => item.id).sort()).toEqual(["1", "2"]);
		expect(await repo.getPostBySlug("chung", "dong-chay-hoang-phap")).toMatchObject({ id: "1", title: "Bài 1" });
		expect(await repo.getPostBySlug("chung", "tri-tue-phat-phap")).toMatchObject({ id: "2", title: "Bài của Trí Tuệ", contentHtml: "<p>Trí Tuệ</p>" });
		expect(await repo.getPostBySlug("chung", "vu-tru-phat-giao")).toBeNull();
	});

	it("still answers a slug alone with the first post that has it (the old behaviour for callers without a section)", async () => {
		const repo = repoOf(twoSections());
		expect(await repo.getPostBySlug("chung")).toMatchObject({ id: "1" });
		expect(await repo.getPostBySlug("khong-co")).toBeNull();
	});

	it("finds a percent-encoded slug by its decoded form within its section", async () => {
		const db = database({ posts: [smallPost("1", { slug: "%F0%9F%99%8F-cau-nguyen" })] });
		const repo = repoOf(db);
		expect(await repo.getPostBySlug("🙏-cau-nguyen", "dong-chay-hoang-phap")).toMatchObject({ id: "1" });
	});

	it("is what findSectionPost asks, so a section serves only its own post of that slug", async () => {
		const repo = repoOf(twoSections());
		vi.resetModules();
		vi.doMock("@/libs/content/repository", () => ({ getContentRepository: async () => repo }));
		const { findSectionPost } = await import("@/libs/sectionPosts");
		const { DONG_CHAY, TRI_TUE } = await import("@/config/sections");
		expect((await findSectionPost(DONG_CHAY, "chung"))?.id).toBe("1");
		expect((await findSectionPost(TRI_TUE, "chung"))?.id).toBe("2");
		vi.doUnmock("@/libs/content/repository");
	});
});

describe("B7: the saved fields of a post reach the public reader", () => {
	let db: ReturnType<typeof database>;
	beforeEach(() => {
		db = database({ posts: [smallPost("1"), smallPost("2", { slug: "bai-2", publishedDate: "2026-10-10" }), smallPost("3", { slug: "bai-3", publishedDate: "2026-10-01" })] });
		db.exec("insert into media (id, r2_key, filename, mime) values ('og1', 'cms/og1/v1/chia-se.webp', 'chia-se.webp', 'image/webp'), ('au1', 'cms/au1/v1/kinh.mp3', 'kinh.mp3', 'audio/mpeg'), ('cv1', 'cms/cv1/v1/bia.webp', 'bia.webp', 'image/webp')");
	});

	it("gives the SEO title and description and the share picture, empty when not set", async () => {
		db.exec("update post set seo_title = 'Tiêu đề SEO', seo_description = 'Mô tả SEO', og_media_id = 'og1' where id = '1'");
		const repo = repoOf(db);
		expect(await repo.getPostBySlug("bai-1")).toMatchObject({ seoTitle: "Tiêu đề SEO", seoDescription: "Mô tả SEO", ogImage: { src: "/anh-goc/s2-cnv03/cms/og1/v1/chia-se.webp", position: "center 50%" } });
		expect(await repo.getPostBySlug("bai-2")).toMatchObject({ seoTitle: "", seoDescription: "", ogImage: null });
	});

	it("puts pinned posts first in a list, in the order the list asks for, but not in a ranking by views", async () => {
		db.exec("update post set pinned = 1 where id = '3'");
		const repo = repoOf(db);
		expect((await repo.listPosts({ sort: "newest" })).items.map((item) => item.id)).toEqual(["3", "1", "2"]);
		expect((await repo.listPosts({ sort: "oldest" })).items.map((item) => item.id)).toEqual(["3", "2", "1"]);
		expect((await repo.listPosts({ sort: "az" })).items[0]).toMatchObject({ id: "3", pinned: true });
		db.exec("update post set legacy_views = 100 where id = '2'");
		expect((await repoOf(db).listPosts({ sort: "views" })).items[0].id).toBe("2");
		expect((await repo.listPosts({ sort: "newest" })).items.map((item) => item.pinned)).toEqual([true, false, false]);
	});

	it("gives the extra fields: a Pháp Âm sound and its length, a video id, a book", async () => {
		const sound = JSON.stringify({ audioMediaId: "au1", duration: "45:10" });
		const link = JSON.stringify({ audioUrl: "https://cdn.example/kinh.mp3" });
		const video = JSON.stringify({ youtubeId: "dQw4w9WgXcQ" });
		const book = JSON.stringify({ book: { title: "Kinh Hiền Ngu", author: "Dịch giả", coverMediaId: "cv1", link: "/tri-tue-phat-phap" } });
		db.prepare("update post set extra = ? where id = '1'").run(sound);
		db.prepare("update post set extra = ? where id = '2'").run(link);
		db.prepare("update post set extra = ? where id = '3'").run(video);
		const repo = repoOf(db);
		expect((await repo.getPostBySlug("bai-1"))?.extra).toEqual({ audio: { src: "/anh-goc/s2-cnv03/cms/au1/v1/kinh.mp3", duration: "45:10" }, youtubeId: null, book: null });
		expect((await repo.getPostBySlug("bai-2"))?.extra).toEqual({ audio: { src: "https://cdn.example/kinh.mp3", duration: "" }, youtubeId: null, book: null });
		expect((await repo.getPostBySlug("bai-3"))?.extra).toEqual({ audio: null, youtubeId: "dQw4w9WgXcQ", book: null });
		db.prepare("update post set extra = ? where id = '1'").run(book);
		expect((await repoOf(db).getPostBySlug("bai-1"))?.extra.book).toEqual({ title: "Kinh Hiền Ngu", author: "Dịch giả", cover: "/anh-goc/s2-cnv03/cms/cv1/v1/bia.webp", link: "/tri-tue-phat-phap" });
	});

	it("shows the video of a Video Phật Pháp post where the page shows videos, unless the post lists videos of its own", async () => {
		db.prepare("update post set extra = ? where id = '1'").run(JSON.stringify({ youtubeId: "dQw4w9WgXcQ" }));
		db.prepare("update post set extra = ?, videos = ? where id = '2'").run(JSON.stringify({ youtubeId: "dQw4w9WgXcQ" }), JSON.stringify([{ id: "MKt_sLwxmNU", url: "https://www.youtube.com/watch?v=MKt_sLwxmNU" }]));
		const repo = repoOf(db);
		expect((await repo.getPostBySlug("bai-1"))?.videos).toEqual([{ id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }]);
		expect((await repo.getPostBySlug("bai-2"))?.videos).toEqual([{ id: "MKt_sLwxmNU", url: "https://www.youtube.com/watch?v=MKt_sLwxmNU" }]);
	});

	it("gives the related posts in the editors' order, only those that are live, leaving statues to pages that can show them", async () => {
		db.exec("insert into statue (id, code, slug, name) values ('s1', 'TPX1', 'phat-x', 'Đức Phật X')");
		db.exec(`insert into post_related (post_id, target_type, target_id, position) values ('1', 'post', '3', 1), ('1', 'statue', 's1', 2), ('1', 'post', '2', 3)`);
		const repo = repoOf(db);
		expect((await repo.getPostBySlug("bai-1"))?.related.map((item) => item.id)).toEqual(["3", "2"]);
		db.exec("update post set status = 'draft' where id = '3'");
		expect((await repoOf(db).getPostBySlug("bai-1"))?.related.map((item) => item.id)).toEqual(["2"]);
		db.exec("update post set deleted_at = '2026-11-01' where id = '2'");
		expect((await repoOf(db).getPostBySlug("bai-1"))?.related).toEqual([]);
		expect((await repoOf(db).getPostBySlug("bai-3"))).toBeNull();
	});

	it("gives the summaries a related post needs for its card (section, category, picture)", async () => {
		db.exec("insert into post_related (post_id, target_type, target_id, position) values ('1', 'post', '2', 1)");
		const related = (await repoOf(db).getPostBySlug("bai-1"))?.related[0];
		expect(related).toMatchObject({ id: "2", slug: "bai-2", section: "dong-chay-hoang-phap", category: { slug: "cong-tu", name: "Cộng Tu" }, pinned: false });
		expect(related).not.toHaveProperty("contentHtml");
	});
});

describe("B7: the page metadata uses the saved SEO and share picture", () => {
	const section = { slug: "dong-chay-hoang-phap", name: "Dòng Chảy Hoằng Pháp", path: "/dong-chay-hoang-phap" } as never;

	it("prefers the SEO title and description and the share picture, and falls back to the title, summary and banner", async () => {
		const { sectionPostMetadata } = await import("@/libs/sectionPosts");
		const { site } = await import("@/config/site");
		const plain = smallPost("1");
		expect(sectionPostMetadata(section, { ...plain, seoTitle: "", seoDescription: "", ogImage: null })).toMatchObject({
			title: `Bài 1 – Dòng Chảy Hoằng Pháp – ${site.name}`,
			description: "Tóm tắt",
			openGraph: { title: "Bài 1", description: "Tóm tắt", images: [plain.banner!.src] },
		});
		const seo = sectionPostMetadata(section, { ...plain, seoTitle: "Tiêu đề SEO", seoDescription: "Mô tả SEO", ogImage: { src: "/anh-goc/s2-cnv03/cms/og1/v1/chia-se.webp", position: "center 50%" } });
		expect(seo).toMatchObject({
			title: `Tiêu đề SEO – Dòng Chảy Hoằng Pháp – ${site.name}`,
			description: "Mô tả SEO",
			openGraph: { title: "Tiêu đề SEO", description: "Mô tả SEO", images: ["/anh-goc/s2-cnv03/cms/og1/v1/chia-se.webp"] },
		});
	});
});

describe("B7: the saved fields of a Tông Chỉ article reach the public reader", () => {
	it("gives the SEO title and description and the share picture of an article", async () => {
		const db = database();
		db.exec("insert into media (id, r2_key, filename, mime) values ('og1', 'cms/og1/v1/chia-se.webp', 'chia-se.webp', 'image/webp')");
		db.exec(`insert into teaching_article (id, slug, title, name, status, position, seo_title, seo_description, og_media_id)
			values ('t1', 'niem-phat', 'Niệm Phật', 'Niệm Phật', 'published', 1, 'SEO niệm Phật', 'Mô tả niệm Phật', 'og1'),
			       ('t2', 'tinh-do', 'Tịnh Độ', 'Tịnh Độ', 'published', 2, null, null, null)`);
		const repo = repoOf(db);
		expect(await repo.getTongChi("niem-phat")).toMatchObject({ seoTitle: "SEO niệm Phật", seoDescription: "Mô tả niệm Phật", ogImage: { src: "/anh-goc/s2-cnv03/cms/og1/v1/chia-se.webp" } });
		expect(await repo.getTongChi("tinh-do")).toMatchObject({ seoTitle: "", seoDescription: "", ogImage: null });
		expect((await repo.listTongChi())[0]).not.toHaveProperty("seoTitle");
	});
});

describe("B13: a scheduled post whose time has come is public", () => {
	it("lists and opens it once its time has passed, and not before", async () => {
		const db = database({ posts: [smallPost("1"), smallPost("2", { slug: "bai-2" }), smallPost("3", { slug: "bai-3" })] });
		db.exec("update post set status = 'scheduled', publish_at = '2020-01-01T00:00:00.000Z' where id = '2'");
		db.exec("update post set status = 'scheduled', publish_at = '2999-01-01T00:00:00.000Z' where id = '3'");
		const repo = repoOf(db);
		expect((await repo.listPosts()).items.map((item) => item.id).sort()).toEqual(["1", "2"]);
		expect(await repo.getPostBySlug("bai-2")).toMatchObject({ id: "2" });
		expect(await repo.getPostBySlug("bai-3")).toBeNull();
	});
});

describe("B7: the Tông Chỉ page metadata uses the saved SEO and share picture", () => {
	it("prefers the SEO title and description and the share picture, and falls back to the name, excerpt and banner", async () => {
		const { tongChiArticleMetadata } = await import("@/libs/tongChiGroups");
		const { site } = await import("@/config/site");
		const base = { id: "t", slug: "niem-phat", title: "Niệm Phật", name: "Niệm Phật", subtitle: "Phụ", group: { slug: "g", name: "G" }, banner: { src: "/anh-goc/s2-cnv03/b.webp", position: "center 50%" }, excerpt: "Trích", seoTitle: "", seoDescription: "", ogImage: null } as never;
		expect(tongChiArticleMetadata(base)).toMatchObject({ title: `Niệm Phật – Tông Chỉ Tu Học – ${site.name}`, description: "Trích", openGraph: { title: "Niệm Phật", images: ["/anh-goc/s2-cnv03/b.webp"] } });
		const seo = tongChiArticleMetadata({ ...(base as object), seoTitle: "SEO", seoDescription: "Mô tả", ogImage: { src: "/anh-goc/s2-cnv03/og.webp", position: "center 50%" } } as never);
		expect(seo).toMatchObject({ title: `SEO – Tông Chỉ Tu Học – ${site.name}`, description: "Mô tả", openGraph: { title: "SEO", description: "Mô tả", images: ["/anh-goc/s2-cnv03/og.webp"] } });
	});
});

describe("a picture position the old admin wrote with an address in front", () => {
	it("is read as the position it names (the six old Tông Chỉ banners), by the d1 source and by the file parser", async () => {
		const db = database();
		db.exec("insert into media (id, r2_key, filename, mime) values ('b1', 'cms/b1/v1/b.webp', 'b.webp', 'image/webp')");
		db.exec(`insert into teaching_article (id, slug, title, name, status, position, banner_media_id, banner_position)
			values ('t1', 'niem-phat', 'Niệm Phật', 'Niệm Phật', 'published', 1, 'b1', 'https://admin.tunglamhoaphuc.com/center 44%'),
			       ('t2', 'tinh-do', 'Tịnh Độ', 'Tịnh Độ', 'published', 2, 'b1', 'center 17%'),
			       ('t3', 'thien', 'Thiền', 'Thiền', 'published', 3, 'b1', 'khong hop le <script>')`);
		const repo = repoOf(db);
		expect((await repo.getTongChi("niem-phat"))?.banner?.position).toBe("center 44%");
		expect((await repo.getTongChi("tinh-do"))?.banner?.position).toBe("center 17%");
		expect((await repo.getTongChi("thien"))?.banner?.position).toBe("center 50%");
		const { parseTongChi } = await import("@/libs/content/tongChi");
		const parsed = parseTongChi([{ id: 1, slug: "a", title: "A", bannerImage: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/a.webp", bannerPosition: "https://admin.tunglamhoaphuc.com/center 6%", category: "g", categoryName: "G" }]);
		expect(parsed.entries[0].banner?.position).toBe("center 6%");
	});
});
