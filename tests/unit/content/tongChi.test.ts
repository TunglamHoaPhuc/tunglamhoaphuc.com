import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderContent } from "@/libs/content/normalize";
import { parseTongChi, tongChiArticle } from "@/libs/content/tongChi";
import { type BodyTarget, tongChiMarkdown } from "@/libs/content/tongChiBody";

const TARGETS: BodyTarget[] = [
	{ slug: "niem-phat", title: "NIỆM PHẬT", group: "phuong-phap-hanh-tri" },
	{ slug: "tam-quy-ngu-gioi", title: "TAM QUY", group: "nen-tang-tu-hoc" },
	{ slug: "tam-quy", title: "TAM QUY", group: "nen-tang-tu-hoc" },
	{ slug: "bo-de-tam", title: "BỒ ĐỀ TÂM", group: "nen-tang-tu-hoc" },
	{ slug: "an-chay", title: "ĂN CHAY", group: "nep-song-thien-gia" },
];
const html = (content: string, title = "NIỆM PHẬT", slug = "niem-phat") => {
	const { markdown, notes } = tongChiMarkdown(content, { title, slug, targets: TARGETS });
	return { html: renderContent(markdown), notes };
};

describe("Tông Chỉ bodies written as the designer's brief", () => {
	it("drops the banner and the title it repeats, keeps the lead line", () => {
		const { html: out, notes } = html("BANNER, TIÊU ĐỀ, GIỚI THIỆU\nNIỆM PHẬT\nTrở về với câu Phật hiệu.");
		expect(out).toBe("<p>Trở về với câu Phật hiệu.</p>");
		expect(notes).toEqual(["BANNER, TIÊU ĐỀ, GIỚI THIỆU"]);
	});

	it("makes capitals a heading and a “quote” with its author a quote", () => {
		const { html: out } = html("NIỆM PHẬT LÀ NHỚ PHẬT\n“Phật về cây Giác trổ hoa\nSuối Từ Bi thấm, chan hòa muôn nơi.”\nVô Trí – Tâm Hòa\nNiệm Phật là thực tập nhớ Phật.");
		expect(out).toBe(
			"<h2>NIỆM PHẬT LÀ NHỚ PHẬT</h2>\n<blockquote><p>“Phật về cây Giác trổ hoa<br>Suối Từ Bi thấm, chan hòa muôn nơi.”<br>— Vô Trí – Tâm Hòa</p></blockquote>\n<p>Niệm Phật là thực tập nhớ Phật.</p>",
		);
	});

	it("drops the notes for the designer and lists the boxes they describe", () => {
		const { html: out, notes } = html(
			[
				"Infographic:",
				"Infographic tam giác",
				"NIỆM PHẬT",
				"(TUỆ)",
				"Quả Bồ-đề: trái chín của sự giác ngộ",
				"Làm 3 card.",
				"🪷 THÂN",
				"Dừng những hành động gây khổ đau.",
				"MỘT ẢNH LỚN, ĐẸP THẦY NGỒI THIỀN",
				"[Xem chi tiết]",
				"──────────",
				"Click.",
			].join("\n"),
		);
		expect(out).toBe(
			"<ul><li><strong>NIỆM PHẬT</strong> (TUỆ) — Quả Bồ-đề: trái chín của sự giác ngộ</li><li><strong>🪷 THÂN</strong> — Dừng những hành động gây khổ đau.</li></ul>",
		);
		expect(notes).toEqual(["Infographic:", "Infographic tam giác", "Làm 3 card.", "MỘT ẢNH LỚN, ĐẸP THẦY NGỒI THIỀN", "[Xem chi tiết]", "Click."]);
	});

	it("keeps the text of a popup and of a ritual, without the brackets", () => {
		const { html: out } = html("[POPUP: “Quy y Tam Bảo là quay về.”]\n[NGHI THỨC: Chí tâm đảnh lễ,\nNam mô Bổn Sư Thích Ca Mâu Ni Phật.]");
		expect(out).toBe("<blockquote><p>“Quy y Tam Bảo là quay về.”</p></blockquote>\n<p>Chí tâm đảnh lễ,<br>Nam mô Bổn Sư Thích Ca Mâu Ni Phật.</p>");
	});

	it("links “Tìm hiểu thêm về X” to X, or to its group when two articles share the name", () => {
		const { html: out, notes } = html("Tìm hiểu thêm về Bồ Đề tâm ->\nTìm hiểu thêm về Tam quy->\nTìm hiểu thêm về Niệm Phật ->\nKhám phá Nếp sống thiền gia ->");
		expect(out).toBe(
			[
				'<p><a href="/tong-chi-tu-hoc/bo-de-tam" rel="noopener noreferrer">Tìm hiểu thêm về Bồ Đề tâm →</a></p>',
				'<p><a href="/tong-chi-tu-hoc#nen-tang-tu-hoc" rel="noopener noreferrer">Tìm hiểu thêm về Tam quy →</a></p>',
				'<p><a href="/tong-chi-tu-hoc#nep-song-thien-gia" rel="noopener noreferrer">Khám phá Nếp sống thiền gia →</a></p>',
			].join("\n"),
		);
		// An article never links to itself.
		expect(notes).toEqual(["Tìm hiểu thêm về Niệm Phật ->"]);
	});

	it("cuts a section whose line breaks were lost back into headings, quotes and text", () => {
		const long = "Mỗi suy nghĩ, lời nói và hành động đều là một hạt giống gieo vào đời sống hằng ngày của mỗi người chúng ta. ".repeat(3);
		const { html: out } = html(`${long}THIỆN ĐEM ĐẾN HẠNH PHÚC “Đáp án cho cuộc đời của bạn chính là những gì bạn gieo trồng hôm nay.” Vô Trí - Tâm Hòa ↓ ${long}Knowledge Hub VIDEO: https://youtu.be/x`);
		expect(out.match(/<h2>|<blockquote>|(?<!<blockquote>)<p>/g)).toEqual(["<p>", "<h2>", "<blockquote>", "<p>"]);
		expect(out).toContain("— Vô Trí - Tâm Hòa");
		expect(out).not.toMatch(/Knowledge|youtu/);
	});
});

describe("Tông Chỉ bodies in Markdown", () => {
	it("starts their ### headings at h2, keeps quotes with their author, drops pictures never uploaded", () => {
		const { html: out, notes } = html(
			"### Ý NGHĨA TAM QUY\n\n> Quy là quay về, y là nương tựa.\n\n*Vô Trí – Tâm Hòa*\n\n![](https://admin.tunglamhoaphuc.com/wp-content/uploads/niem-phat.jpg)\n\n![](https://admin.tunglamhoaphuc.com/wp-content/uploads/2026/09/image.png)\n\n[INFOGRAPHIC_TAM_BAO_TU_THAN]",
			"TAM QUY",
			"tam-quy",
		);
		expect(out).toBe(
			'<h2>Ý NGHĨA TAM QUY</h2>\n<blockquote><p>Quy là quay về, y là nương tựa.<br>— Vô Trí – Tâm Hòa</p></blockquote>\n<figure><img src="/anh-goc/wordpress/2026/09/image.png" alt="" loading="lazy" decoding="async"></figure>',
		);
		expect(notes).toEqual(["ảnh chưa có: https://admin.tunglamhoaphuc.com/wp-content/uploads/niem-phat.jpg", "[INFOGRAPHIC_TAM_BAO_TU_THAN]"]);
	});
});

const article = (extra: Record<string, unknown>) => ({
	id: 8,
	slug: "niem-phat",
	title: "NIỆM PHẬT",
	subtitle: "Lục tự cứu cánh",
	category: "phuong-phap-hanh-tri",
	categoryName: "PHƯƠNG PHÁP HÀNH TRÌ",
	bannerImage: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/01-trang-chu/Phap-hoi-niem-Phat.webp",
	bannerPosition: "center 37%",
	excerpt: "Niệm Phật là pháp môn thù thắng.",
	content: "NIỆM PHẬT LÀ NHỚ PHẬT\nNiệm Phật là thực tập nhớ Phật.",
	author: "Sa Môn Vô Trí (Thích Tâm Hòa)",
	authorLink: "/gioi-thieu/su-phu-tru-tri",
	publishedAt: "2026-08-23T09:50:00.000Z",
	status: "published",
	viewsCount: 43200,
	...extra,
});

describe("Tông Chỉ file", () => {
	it("reads the articles group by group, titles out of capitals", () => {
		const { entries } = parseTongChi({
			success: true,
			data: [
				article({}),
				article({ id: 1, slug: "doi-thay", title: "ĐỜI THẦY", category: "tong-phong-truyen-thua", categoryName: "TÔNG PHONG TRUYỀN THỪA" }),
				article({ id: 9, slug: "tung-kinh", title: "TỤNG KINH " }),
				article({ id: 10, slug: "nhap", status: "draft" }),
			],
		});
		expect(entries.map((entry) => [entry.slug, entry.title, entry.group.name])).toEqual([
			["niem-phat", "Niệm Phật", "Phương Pháp Hành Trì"],
			["tung-kinh", "Tụng Kinh", "Phương Pháp Hành Trì"],
			["doi-thay", "Đời Thầy", "Tông Phong Truyền Thừa"],
		]);
		expect(entries[0]).toMatchObject({ publishedDate: "2026-08-23", views: 43200, authorHref: "/gioi-thieu/su-phu-tru-tri", banner: { position: "center 37%" } });
	});

	it("names articles that share a title by their subtitle, and reports twins outside a group of that name", () => {
		const { entries, issues } = parseTongChi([
			article({ slug: "tam-quy-ngu-gioi", title: "TAM QUY", subtitle: "Đánh thức năng lực giác ngộ", category: "nen-tang-tu-hoc", categoryName: "NỀN TẢNG TU HỌC" }),
			article({ slug: "tam-quy", title: "TAM QUY", subtitle: "Quay về nương tựa", category: "nen-tang-tu-hoc", categoryName: "NỀN TẢNG TU HỌC" }),
			article({ slug: "lo-trinh-tre", title: "LỘ TRÌNH TU HỌC", subtitle: "Dành cho người trẻ", category: "lo-trinh-tu-hoc", categoryName: "LỘ TRÌNH TU HỌC" }),
			article({ slug: "lo-trinh-moi", title: "LỘ TRÌNH TU HỌC ", subtitle: "Dành cho người mới bắt đầu", category: "lo-trinh-tu-hoc", categoryName: "LỘ TRÌNH TU HỌC" }),
		]);
		expect(entries.map((entry) => entry.name)).toEqual([
			"Tam Quy: Đánh thức năng lực giác ngộ",
			"Tam Quy: Quay về nương tựa",
			"Lộ Trình Tu Học: Dành cho người trẻ",
			"Lộ Trình Tu Học: Dành cho người mới bắt đầu",
		]);
		expect(issues).toEqual([{ kind: "duplicate-title", id: "tam-quy-ngu-gioi", message: '2 bài tên "Tam Quy": tam-quy-ngu-gioi, tam-quy' }]);
	});

	it("keeps the side blocks that have something, links only to pages this site serves", () => {
		const { entries, issues } = parseTongChi([
			article({
				videoBlock: { title: "KHÓA LỄ NIỆM PHẬT", description: "Kinh hành niệm Phật.", videoUrl: "https://www.youtube.com/watch?v=MKt_sLwxmNU" },
				// Liên hệ has no page yet (T18); Trí Tuệ Phật Pháp has (T17).
				featuredArticle: { label: "PHƯƠNG PHÁP HÀNH TRÌ", title: "PHÁP MÔN NIỆM PHẬT", author: "Vô Trí", linkUrl: "/lien-he" },
				sourceBook: { bookTitle: "Niệm Phật & Tịnh Độ", author: "Vô Trí", coverImage: "https://admin.tunglamhoaphuc.com/wp-content/uploads/niem-phat.jpg", description: "", linkUrl: "/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi" },
				photoGallery: [{ title: "HÀNH GIẢ", imageUrl: "https://s2-cnv03.s3.us-east-005.backblazeb2.com/a.webp", khuVuc: "Đạo tràng", noiDung: "Đại chúng trì niệm." }],
				keywords: [{ keyword: "Niệm Phật", title: "Phương Pháp Niệm Phật", description: "Trì danh hiệu." }, { keyword: "Trống", title: "", description: "" }],
			}),
			article({ slug: "an-chay", title: "ĂN CHAY", videoBlock: { title: "", description: "", videoUrl: "" }, sourceBook: { bookTitle: " ", author: "", coverImage: "", description: "", linkUrl: "" } }),
		]);
		const [full, empty] = entries;
		expect(full.video).toEqual({ id: "MKt_sLwxmNU", url: "https://www.youtube.com/watch?v=MKt_sLwxmNU", title: "KHÓA LỄ NIỆM PHẬT", description: "Kinh hành niệm Phật." });
		expect(full.featured).toEqual({ label: "Phương Pháp Hành Trì", title: "Pháp Môn Niệm Phật", author: "Vô Trí", href: null });
		expect(full.book).toMatchObject({ title: "Niệm Phật & Tịnh Độ", cover: null, href: "/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi" });
		expect(full.gallery).toEqual([{ src: "/anh-goc/s2-cnv03/a.webp", title: "HÀNH GIẢ", caption: "Đạo tràng – Đại chúng trì niệm." }]);
		expect(full.keywords).toEqual([{ keyword: "Niệm Phật", title: "Phương Pháp Niệm Phật", description: "Trì danh hiệu." }]);
		expect([empty.video, empty.book, empty.featured, empty.gallery]).toEqual([null, null, null, []]);
		expect(issues).toEqual([{ kind: "unsaved-image", id: "niem-phat", message: "https://admin.tunglamhoaphuc.com/wp-content/uploads/niem-phat.jpg" }]);
	});

	it("turns the body into HTML only when asked, reporting what it dropped", () => {
		const { entries } = parseTongChi([article({ content: "BANNERNIỆM PHẬT\nNIỆM PHẬT LÀ NHỚ PHẬT\nNiệm Phật là thực tập nhớ Phật." })]);
		expect(entries[0]).not.toHaveProperty("contentHtml");
		const notes: string[] = [];
		expect(tongChiArticle(entries[0], entries, notes).contentHtml).toBe("<h2>NIỆM PHẬT LÀ NHỚ PHẬT</h2>\n<p>Niệm Phật là thực tập nhớ Phật.</p>");
		expect(notes).toEqual(["BANNERNIỆM PHẬT"]);
	});

	it("leaves no note for the designer in any real article", () => {
		const path = "data/snapshot/tong-chi.json";
		if (!existsSync(path)) return;
		const { entries } = parseTongChi(JSON.parse(readFileSync(path, "utf8")));
		expect(entries).toHaveLength(25);
		for (const entry of entries) {
			const text = tongChiArticle(entry, entries).contentHtml.replace(/<[^>]+>/g, " ");
			expect(text, entry.slug).not.toMatch(/\b(card|click|popup|quote|typography|infographic|banner|knowledge hu[bg])\b|một ảnh|ngăn kéo|sơ đồ|chỗ này sẽ|\S_\S+_/iu);
		}
		const niemPhat = tongChiArticle(entries.find((entry) => entry.slug === "niem-phat-phuong-phap-tro-hanh")!, entries).contentHtml;
		expect(niemPhat).toContain("<h2>NIỆM PHẬT LÀ NHỚ PHẬT</h2>");
		expect(niemPhat).toContain("— Vô Trí – Tâm Hòa");
	});
});
