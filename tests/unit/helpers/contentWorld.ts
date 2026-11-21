// An admin world with what the content module needs: categories of each kind, library pictures, an album, a statue
// and one article of each kind as the old admin's import left them (no creator, published, version 1).
import { world, type Seed } from "./adminWorld";

export const CONTENT_SEEDS: Seed[] = [
	{ id: "root", email: "root@example.test", roleId: "role-super-admin", name: "Quản trị" },
	{ id: "editor", email: "editor@example.test", roleId: "role-editor", name: "Biên tập" },
	{ id: "author", email: "author@example.test", roleId: "role-author", name: "Cộng tác" },
	{ id: "author2", email: "author2@example.test", roleId: "role-author", name: "Cộng tác 2" },
	{ id: "viewer", email: "viewer@example.test", roleId: "role-viewer", name: "Chỉ xem" },
];

export async function contentWorld() {
	const w = await world([]);
	// A role that may only look at articles, for the 403 cases.
	w.raw.prepare("INSERT INTO role (id, name, description, is_system, created_at, updated_at) VALUES ('role-viewer', 'Chỉ xem', '', 0, '2026', '2026')").run();
	for (const module of ["posts", "teachings", "pages"]) w.raw.prepare("INSERT INTO role_permission (role_id, module, action, scope) VALUES ('role-viewer', ?, 'view', 'all')").run(module);
	const { hashPassword } = await import("../../../src/admin/auth/password");
	const { FAST, PASSWORD } = await import("./adminWorld");
	for (const seed of CONTENT_SEEDS) {
		w.raw
			.prepare("INSERT INTO user (id, email, name, role, role_id, password_hash, created_at) VALUES (?, ?, ?, 'viewer', ?, ?, '2026')")
			.run(seed.id, seed.email, seed.name ?? seed.id, seed.roleId, hashPassword(PASSWORD, FAST));
	}

	const category = w.raw.prepare("INSERT INTO category (id, kind, section, slug, name, position) VALUES (?, ?, ?, ?, ?, 0)");
	category.run("post:dong-chay-hoang-phap:cong-tu", "post", "dong-chay-hoang-phap", "cong-tu", "Cộng Tu");
	category.run("post:dong-chay-hoang-phap:dai-le-su-kien", "post", "dong-chay-hoang-phap", "dai-le-su-kien", "Đại Lễ Sự Kiện");
	category.run("post:tri-tue-phat-phap:phap-am", "post", "tri-tue-phat-phap", "phap-am", "Pháp Âm");
	category.run("post:tri-tue-phat-phap:video", "post", "tri-tue-phat-phap", "video", "Video Phật Pháp");
	category.run("post:tri-tue-phat-phap:an-pham-sach", "post", "tri-tue-phat-phap", "an-pham-sach", "Ấn Phẩm & Sách");
	category.run("post:tri-tue-phat-phap:bai-viet", "post", "tri-tue-phat-phap", "bai-viet", "Bài Viết");
	category.run("tong-chi::nen-tang", "tong-chi", "", "nen-tang", "Nền Tảng Tu Học");
	category.run("about::lich-su", "about", "", "lich-su", "Lịch Sử Chùa");

	const media = w.raw.prepare("INSERT INTO media (id, r2_key, filename, mime, alt, created_at, version, deleted_at) VALUES (?, ?, ?, 'image/webp', ?, '2026', ?, ?)");
	media.run("media-a", "cms/media-a/v2/sen.webp", "sen.webp", "Hoa sen", 2, null);
	media.run("media-b", "cms/media-b/v1/chua.webp", "chua.webp", "Chùa", 1, null);
	media.run("media-gone", "cms/media-gone/v1/x.webp", "x.webp", "", 1, "2026-01-01T00:00:00Z");
	w.raw.prepare("INSERT INTO album (id, title) VALUES ('album-1', 'Album lễ')").run();
	w.raw.prepare("INSERT INTO statue (id, code, slug, name) VALUES ('statue-1', 'TP0001', 'duc-phat', 'Đức Phật Bổn Sư')").run();

	// As imported: published, nobody as creator.
	w.raw
		.prepare(
			`INSERT INTO post (id, slug, title, section, category_id, author, published_date, status, legacy_views, content_html, album_id, gallery_count, search_text, summary)
			 VALUES ('post-1060', 'le-vu-lan', 'Lễ Vu Lan báo hiếu', 'dong-chay-hoang-phap', 'post:dong-chay-hoang-phap:cong-tu', 'Ban truyền thông', '2025-08-20', 'published', 512, '<p>Nội dung cũ</p>', 'album-1', 40, 'le vu lan bao hieu', 'Lễ lớn')`,
		)
		.run();
	w.raw
		.prepare(
			`INSERT INTO teaching_article (id, slug, title, name, group_id, body, status, position) VALUES ('tc-1', 'niem-phat', 'Niệm Phật', 'Niệm Phật', 'tong-chi::nen-tang', '## Niệm Phật là gì\n\nNhất tâm **niệm** Phật.', 'published', 1)`,
		)
		.run();
	w.raw.prepare("INSERT INTO page (id, slug, title, group_id, content_html, status, position) VALUES ('page-1', 'lich-su', 'Lịch sử Bổn tự', 'about::lich-su', '<p>Chùa xưa</p>', 'published', 1)").run();
	w.raw.prepare("INSERT INTO milestone (page_id, position, label, title, description) VALUES ('page-1', 1, '1990', 'Khởi dựng', 'Thầy về núi')").run();

	return w;
}

export type ContentWorld = Awaited<ReturnType<typeof contentWorld>>;
