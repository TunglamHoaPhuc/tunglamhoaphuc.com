// Kiểm thử trên DỮ LIỆU THẬT (TLHP_REAL_DB, xem tests/helpers/real-db.ts), phần 2: ĐÚNG TỪNG TRƯỜNG cho MỌI dòng.
// Mỗi dòng đã hiển thị của từng loại được đọc qua lớp đọc V3 (kho D1 + bộ đổi sang bản ghi của trang) và so với giá trị
// tính trực tiếp từ SQL: slug, tiêu đề, phụ đề, ngày, tóm tắt, thân bài, ảnh và vị trí ảnh, video, sách, tác giả, lượt xem...
// Sai khác gom theo trường (FieldReport) nên một lần chạy cho cả danh sách trường hỏng.
import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlToRendererText, needsRichHtml, richHtml } from "@/lib/article-html";
import { areaBodyHtml } from "@/lib/area-body";
import { sanitizeHtml } from "@/lib/tlhp-admin/content/html";
import { cleanBodyHtml } from "@/lib/tlhp-admin/special/html";
import { isUnsavedUpload, MEDIA_BASE, mediaUrl } from "@/lib/tlhp-content/media";
import { decodeEntities } from "@/lib/tlhp-content/normalize";
import { tongChiMarkdown } from "@/lib/tlhp-content/tongChiBody";
import { createD1Repository } from "@/lib/tlhp-content/sources/d1";
import type { ContentRepository } from "@/lib/tlhp-content/types";
import { toAboutRecord, toAreaRecord, toPostRecord, toScheduleData, toTongChiRecord } from "@/lib/v3-data";
import { liveStatuePage, readStatueLinks } from "@/lib/v3-statues";
import { copyOfReal, FieldReport, nowIso, openReal, rows, SKIP_REAL } from "../helpers/real-db";

type Row = Record<string, unknown>;

const IMAGE_LINE = /^!\[[^\]]*\]\((.+)\)$/;

/** Tiêu đề của khối giao diện do người dàn trang ghi trong `body` ("(KNOWLEDGE HUB)", "4 CARD"...): bộ đổi bỏ chúng có chủ ý, trang tự dựng khối đó. */
const DESIGNER_LABEL = /knowledge hu[bg]|\bcards?\b|infographic|popup|banner|thumbnail|bộ sưu tập ảnh tư liệu/i;

const LIVE = (alias: string) => `${alias}.deleted_at is null and (${alias}.status = 'published' or (${alias}.status = 'scheduled' and ${alias}.publish_at <= ?))`;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const json = <T>(v: unknown, fallback: T): T => {
	if (typeof v !== "string" || !v) return fallback;
	try {
		return JSON.parse(v) as T;
	} catch {
		return fallback;
	}
};
const pos = (v: unknown) => {
	const p = str(v).trim();
	return /^[a-z0-9.%\s-]{1,40}$/i.test(p) ? p : "center 50%";
};
/** Where a picture is, from the `media` row's key (B2/R2) or address, and where the editors centred it. */
const image = (key: unknown, url: unknown, position: unknown) => {
	if (typeof key === "string" && key) return { src: `${MEDIA_BASE}/${key}`, position: pos(position) };
	const src = typeof url === "string" && url ? mediaUrl(url) : null;
	return src ? { src, position: pos(position) } : null;
};
const src = (key: unknown, url: unknown) => image(key, url, null)?.src ?? null;
/** The way V3's records write an address (lib/v3-data.ts absUrl): own pictures stay, other site paths go to www. */
const abs = (s: string | null | undefined) => (!s ? "" : s.startsWith("/anh-goc/") ? s : s.startsWith("/") && !s.startsWith("//") ? `https://www.tunglamhoaphuc.com${s}` : s);

const words = (value: string) =>
	decodeEntities(value)
		.replace(/ /g, " ")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
const textOf = (html: string) => html.replace(/<\/?[a-z][^>]*>/gi, " ");

function open() {
	const { sqlite, d1 } = openReal();
	return { sqlite, d1, repo: createD1Repository(d1) as ContentRepository, now: nowIso() };
}

// ── Bài viết ────────────────────────────────────────────────────────────────

test("bài viết: mọi bài hiển thị (632) khớp D1 từng trường, cả bản danh sách lẫn bản đầy đủ và bản ghi V3", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo, now } = open();
	const truth = rows<Row>(
		sqlite,
		`select p.*, c.slug as cslug, c.name as cname, t.r2_key as tk, t.url as tu, b.r2_key as bk, b.url as bu, o.r2_key as ok, o.url as ou,
			p.legacy_views + coalesce((select sum(v.count) from page_view v where v.entity_type = 'post' and v.entity_id = p.id), 0) as views
		from post p left join category c on c.id = p.category_id left join media t on t.id = p.thumbnail_media_id
		left join media b on b.id = p.banner_media_id left join media o on o.id = p.og_media_id
		where ${LIVE("p")} order by p.rowid`,
		now,
	);
	assert.equal(truth.length, 632);
	const report = new FieldReport("bài viết");
	// Bản danh sách: qua listPosts, mọi trang.
	const listed = new Map<string, Awaited<ReturnType<ContentRepository["listPosts"]>>["items"][number]>();
	for (const section of new Set(truth.map((r) => str(r.section)))) {
		const first = await repo.listPosts({ section, pageSize: 60, page: 1 });
		for (let page = 1; page <= first.pageCount; page++) for (const item of (await repo.listPosts({ section, pageSize: 60, page })).items) listed.set(item.id, item);
	}
	for (const row of truth) {
		const id = str(row.id);
		const post = await repo.getPostBySlug(str(row.slug), str(row.section));
		report.row();
		if (!post) {
			report.eq("getPostBySlug", id, "bài", null);
			continue;
		}
		const thumbnail = image(row.tk, row.tu, row.thumbnail_position);
		const banner = image(row.bk, row.bu, row.banner_position);
		const summaryOfList = listed.get(id);
		for (const [name, v3] of [["", post], ["danh sách.", summaryOfList]] as const) {
			report.eq(`${name}slug`, id, row.slug, v3?.slug);
			report.eq(`${name}title`, id, row.title, v3?.title);
			report.eq(`${name}subtitle`, id, row.subtitle, v3?.subtitle);
			report.eq(`${name}section`, id, row.section, v3?.section);
			report.eq(`${name}author`, id, row.author, v3?.author);
			report.eq(`${name}publishedDate`, id, row.published_date, v3?.publishedDate);
			report.eq(`${name}summary`, id, row.summary, v3?.summary);
			report.eq(`${name}category`, id, { slug: str(row.cslug), name: str(row.cname) }, v3?.category);
			report.eq(`${name}views`, id, Number(row.views), v3?.views);
			report.eq(`${name}galleryCount`, id, Number(row.gallery_count), v3?.galleryCount);
			report.eq(`${name}pinned`, id, row.pinned === 1, v3?.pinned);
			report.eq(`${name}thumbnail`, id, thumbnail, v3?.thumbnail);
			report.eq(`${name}banner`, id, banner, v3?.banner);
		}
		report.eq("id", id, id, post.id);
		report.eq("intro", id, row.intro, post.intro);
		report.eq("contentHtml (byte)", id, row.content_html, post.contentHtml);
		report.eq("keywords", id, json(row.keywords, []), post.keywords);
		report.eq("videos", id, json(row.videos, []), post.videos);
		report.eq("seoTitle", id, row.seo_title ?? "", post.seoTitle);
		report.eq("seoDescription", id, row.seo_description ?? "", post.seoDescription);
		report.eq("ogImage", id, image(row.ok, row.ou, null), post.ogImage);
		// Album ảnh.
		const photos = row.album_id
			? rows<Row>(sqlite, "select ai.title, ai.caption, m.r2_key, m.url from album_item ai join media m on m.id = ai.media_id where ai.album_id = ? order by ai.position", row.album_id).map((p) => ({ src: src(p.r2_key, p.url) ?? "", title: str(p.title), caption: str(p.caption) }))
			: [];
		report.eq("gallery", id, photos, post.gallery);
		const related = rows<Row>(sqlite, `select r.target_id from post_related r join post p on p.id = r.target_id where r.post_id = ? and r.target_type = 'post' and ${LIVE("p")} order by r.position`, id, now).map((r) => str(r.target_id));
		report.eq("related", id, related, post.related.map((r) => r.id));

		// Bản ghi mà trang V3 đọc.
		const record = toPostRecord(post);
		report.eq("record.title", id, row.title, record.title);
		report.eq("record.subtitle", id, row.subtitle, record.subtitle);
		report.eq("record.mainCategory", id, row.section, record.mainCategory);
		report.eq("record.subCategory", id, str(row.cslug), record.subCategory);
		report.eq("record.categoryName", id, str(row.cname), record.categoryName);
		report.eq("record.author", id, row.author, record.author);
		report.eq("record.publishedDate", id, row.published_date, record.publishedDate);
		report.eq("record.viewsCount", id, Number(row.views), record.viewsCount);
		report.eq("record.summary", id, row.summary, record.summary);
		report.eq("record.contentHtml", id, row.content_html, record.contentHtml);
		report.eq("record.thumbnailUrl", id, abs((thumbnail ?? banner)?.src), record.thumbnailUrl);
		report.eq("record.bannerUrl", id, abs((banner ?? thumbnail)?.src), record.bannerUrl);
		report.eq("record.thumbnailPosition", id, thumbnail?.position ?? "center 50%", record.thumbnailPosition);
		report.eq("record.bannerPosition", id, banner?.position ?? "center 50%", record.bannerPosition);
		report.eq("record.videoBlock", id, json<{ url: string }[]>(row.videos, [])[0]?.url ?? null, record.videoBlock?.videoUrl ?? null);
		report.eq("record.photoGallery.length", id, photos.length, record.photoGallery.length);
		report.eq("record.keywords", id, json(row.keywords, []), record.keywords);
	}
	console.log(`  ${report.summary()}`);
	report.assertClean();
});

test("thân bài viết: bộ lọc HTML không làm mất chữ nào, và đường dựng của trang (dòng hoặc HTML giàu) giữ đủ từ", { skip: SKIP_REAL }, () => {
	const { sqlite, now } = open();
	let nonEmpty = 0;
	let rich = 0;
	const textLost: string[] = [];
	const tagLost: string[] = [];
	const wordsLost: string[] = [];
	for (const table of ["post", "page"]) {
		for (const r of rows<Row>(sqlite, `select slug, content_html as h from ${table} t where ${LIVE("t")}`, now)) {
			const html = str(r.h);
			if (!html) continue;
			nonEmpty++;
			const clean = sanitizeHtml(html);
			const before = words(textOf(html));
			const after = words(textOf(clean));
			if (before.join(" ") !== after.join(" ")) textLost.push(`${table}/${r.slug}`);
			const tagSet = (h: string) => new Map([...h.matchAll(/<([a-z][a-z0-9]*)/gi)].reduce((m, x) => m.set(x[1].toLowerCase(), (m.get(x[1].toLowerCase()) ?? 0) + 1), new Map<string, number>()));
			const a = tagSet(html);
			const b = tagSet(clean);
			for (const [tag, n] of a) if ((b.get(tag) ?? 0) < n) tagLost.push(`${table}/${r.slug}<${tag}>`);
			// Đường dựng của trang bài: lines (kiểu cũ) hoặc HTML giàu (có bảng/video/âm thanh).
			const isRich = needsRichHtml(html);
			if (isRich) rich++;
			const shown = isRich ? textOf(richHtml(html)) : htmlToRendererText(html).replace(/\]\([^)]*\)/g, " ");
			const present = new Set(words(shown));
			const missing = before.filter((w) => !present.has(w));
			if (missing.length) wordsLost.push(`${table}/${r.slug}: ${missing.slice(0, 5).join(",")}`);
		}
	}
	console.log(`  thân bài có chữ: ${nonEmpty} (đường HTML giàu: ${rich})`);
	assert.ok(nonEmpty >= 600);
	assert.deepEqual(textLost, [], "chữ trước/sau bộ lọc");
	assert.deepEqual(tagLost, [], "thẻ bị bộ lọc bỏ");
	assert.deepEqual(wordsLost, [], "từ mất ở bước dựng của trang");
});

// ── Giới thiệu ──────────────────────────────────────────────────────────────

test("Giới thiệu: sáu trang khớp D1 từng trường (banner, chân dung, trích dẫn, cột mốc, thân bài, ảnh, sách)", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo, now } = open();
	const truth = rows<Row>(
		sqlite,
		`select p.*, c.slug as cslug, c.name as cname, b.r2_key as bk, b.url as bu, o.r2_key as ok, o.url as ou
		from page p left join category c on c.id = p.group_id left join media b on b.id = p.banner_media_id left join media o on o.id = p.portrait_media_id
		where ${LIVE("p")} order by p.position, p.id`,
		now,
	);
	assert.equal(truth.length, 6);
	const topics = await repo.listAboutTopics();
	const report = new FieldReport("giới thiệu");
	for (const [index, row] of truth.entries()) {
		const id = str(row.slug);
		const t = topics.find((x) => x.slug === row.slug);
		report.row();
		if (!t) {
			report.eq("topic", id, "có", null);
			continue;
		}
		const banner = image(row.bk, row.bu, row.banner_position);
		const portrait = image(row.ok, row.ou, row.portrait_position);
		const quote = json<{ title: string; lines: string[]; author: string } | null>(row.quote, null);
		const miles = rows<Row>(sqlite, "select label, title, description from milestone where page_id = ? order by position", row.id).map((m) => ({ label: str(m.label), title: str(m.title), description: str(m.description) }));
		const photos = rows<Row>(sqlite, "select ai.title, ai.caption, m.r2_key, m.url from album_item ai join media m on m.id = ai.media_id where ai.album_id = ? order by ai.position", `page:${row.id}`).map((p) => ({ src: src(p.r2_key, p.url) ?? "", title: str(p.title), caption: str(p.caption) }));
		const book = json<{ title: string; author: string; cover: string | null; description: string } | null>(row.book, null);
		report.eq("id", id, row.id, t.id);
		report.eq("title", id, row.title, t.title);
		report.eq("subtitle", id, row.subtitle, t.subtitle);
		report.eq("tag (kicker)", id, row.kicker, t.tag);
		report.eq("group", id, { slug: str(row.cslug), name: str(row.cname) }, t.group);
		report.eq("banner", id, banner, t.banner);
		report.eq("portrait", id, portrait, t.portrait);
		report.eq("overview", id, row.overview, t.overview);
		report.eq("quote", id, quote, t.quote);
		report.eq("milestones", id, miles, t.milestones);
		report.eq("contentHtml (byte)", id, row.content_html, t.contentHtml);
		report.eq("gallery", id, photos, t.gallery);
		report.eq("book", id, book, t.book);
		const record = toAboutRecord(t, index);
		report.eq("record.heroBanner", id, abs(banner?.src), record.heroBanner);
		report.eq("record.heroBannerPosition", id, banner?.position ?? "center 50%", record.heroBannerPosition);
		report.eq("record.portraitImage", id, abs(portrait?.src), record.portraitImage);
		report.eq("record.overviewSummary", id, row.overview, record.overviewSummary);
		report.eq("record.quoteTitle", id, quote?.title ?? "", record.quoteTitle);
		report.eq("record.quoteContent", id, quote?.lines ?? [], record.quoteContent);
		report.eq("record.quoteAuthor", id, quote?.author ?? "", record.quoteAuthor);
		report.eq("record.milestones", id, miles.map((m) => ({ year: m.label, title: m.title, description: m.description })), record.milestones);
		report.eq("record.mainContentHtml", id, row.content_html, record.mainContentHtml);
		report.eq("record.galleryImages.length", id, photos.length, record.galleryImages.length);
		report.eq("record.sourceBook.bookTitle", id, book?.title ?? null, record.sourceBook?.bookTitle ?? null);
	}
	console.log(`  ${report.summary()}`);
	report.assertClean();
});

// ── Tông chỉ ────────────────────────────────────────────────────────────────

test("Tông chỉ: 25 bài khớp D1 từng trường; thân bài (D1 chỉ có `body`, `content_html` còn trống) không mất từ nào", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo, now } = open();
	const truth = rows<Row>(
		sqlite,
		`select a.*, a.legacy_views + coalesce((select sum(v.count) from page_view v where v.entity_type = 'tong-chi' and v.entity_id = a.id), 0) as views,
			c.slug as cslug, c.name as cname, b.r2_key as bk, b.url as bu, o.r2_key as ok, o.url as ou
		from teaching_article a left join category c on c.id = a.group_id left join media b on b.id = a.banner_media_id left join media o on o.id = a.og_media_id
		where ${LIVE("a")} order by a.position, a.id`,
		now,
	);
	assert.equal(truth.length, 25);
	const report = new FieldReport("tông chỉ");
	const lostLines: string[] = [];
	const designerLabels: string[] = [];
	const targets = (await repo.listTongChi()).map((o) => ({ slug: o.slug, title: o.title, group: o.group.slug }));
	for (const [index, row] of truth.entries()) {
		const id = str(row.slug);
		const a = await repo.getTongChi(id);
		report.row();
		if (!a) {
			report.eq("getTongChi", id, "bài", null);
			continue;
		}
		const banner = image(row.bk, row.bu, row.banner_position);
		const photos = rows<Row>(sqlite, "select ai.title, ai.caption, m.r2_key, m.url from album_item ai join media m on m.id = ai.media_id where ai.album_id = ? order by ai.position", `teaching:${row.id}`).map((p) => ({ src: src(p.r2_key, p.url) ?? "", title: str(p.title), caption: str(p.caption) }));
		const video = json<{ id: string; url: string; title: string; description: string } | null>(row.video, null);
		const book = json<{ title: string; author: string; cover: string | null; description: string; href: string | null } | null>(row.book, null);
		const featured = json<{ label: string; title: string; author: string; href: string | null } | null>(row.featured, null);
		report.eq("id", id, row.id, a.id);
		report.eq("title", id, row.title, a.title);
		report.eq("name", id, str(row.name) || str(row.title), a.name);
		report.eq("subtitle", id, row.subtitle, a.subtitle);
		report.eq("group", id, { slug: str(row.cslug), name: str(row.cname) }, a.group);
		report.eq("banner", id, banner, a.banner);
		report.eq("excerpt", id, row.excerpt, a.excerpt);
		report.eq("author", id, row.author, a.author);
		report.eq("authorHref", id, typeof row.author_href === "string" ? row.author_href : null, a.authorHref);
		report.eq("publishedDate", id, row.published_date, a.publishedDate);
		report.eq("views", id, Number(row.views), a.views);
		report.eq("video", id, video, a.video);
		report.eq("featured", id, featured, a.featured);
		report.eq("gallery", id, photos, a.gallery);
		report.eq("book", id, book, a.book);
		report.eq("keywords", id, json(row.keywords, []), a.keywords);
		report.eq("seoTitle", id, row.seo_title ?? "", a.seoTitle);
		report.eq("seoDescription", id, row.seo_description ?? "", a.seoDescription);
		report.eq("ogImage", id, image(row.ok, row.ou, null), a.ogImage);
		// Thân bài: nếu admin đã lưu HTML thì đó là HTML đã lọc; nếu chưa (bản nhập) thì là `body` đổi sang HTML.
		const html = str(row.content_html).trim();
		if (html) report.eq("contentHtml (đã lọc)", id, sanitizeHtml(html), a.contentHtml);
		else {
			report.eq("contentHtml không rỗng khi body có chữ", id, str(row.body).trim().length > 0, a.contentHtml.trim().length > 0 || str(row.body).trim().length === 0);
			// Chữ nào của `body` không còn ở HTML thì phải nằm trong các dòng ghi chú cho người dàn trang mà bộ đổi cố ý bỏ (tongChiBody.ts).
			const { notes } = tongChiMarkdown(str(row.body), { title: str(row.title), slug: id, targets });
			const shown = new Set(words(textOf(a.contentHtml)));
			const noted = new Set(words(notes.join(" ")));
			const lines = str(row.body)
				.split("\n")
				// Ảnh chưa được tải lên (địa chỉ WordPress không có thư mục ngày, đều 404): bộ đổi bỏ ảnh và ghi chú, đúng thiết kế (media.ts isUnsavedUpload).
				.filter((line) => !isUnsavedUpload(IMAGE_LINE.exec(line.trim())?.[1]))
				.join("\n")
				.replace(/https?:\/\/\S+/g, " ")
				.split("\n")
				.map((line) => line.replace(/(?<=[\p{Ll}…])(?=\p{Lu})/gu, " "))
				.filter((line) => words(line).length >= 4);
			for (const line of lines) {
				const w = words(line);
				if (w.filter((x) => shown.has(x) || noted.has(x)).length / w.length >= 0.8) continue;
				if (DESIGNER_LABEL.test(line)) designerLabels.push(`${id}: ${line.trim()}`);
				else lostLines.push(`${id}: ${line.trim()}`);
			}
		}
		const record = toTongChiRecord(a, index);
		report.eq("record.title", id, row.title, record.title);
		report.eq("record.category", id, str(row.cslug), record.category);
		report.eq("record.categoryName", id, str(row.cname), record.categoryName);
		report.eq("record.bannerImage", id, abs(banner?.src), record.bannerImage);
		report.eq("record.bannerPosition", id, banner?.position ?? "center 50%", record.bannerPosition);
		report.eq("record.excerpt", id, row.excerpt, record.excerpt);
		report.eq("record.author", id, row.author, record.author);
		report.eq("record.publishedAt", id, row.published_date || undefined, record.publishedAt);
		report.eq("record.viewsCount", id, Number(row.views), record.viewsCount);
		report.eq("record.videoBlock", id, video?.url ?? null, record.videoBlock?.videoUrl ?? null);
		report.eq("record.sourceBook", id, book?.title ?? null, record.sourceBook?.bookTitle ?? null);
		report.eq("record.photoGallery.length", id, photos.length, record.photoGallery.length);
	}
	console.log(`  ${report.summary()}`);
	console.log(`  dòng tiêu đề kiểu ghi chú dàn trang bị bỏ có chủ ý: ${designerLabels.length}`);
	assert.deepEqual(lostLines, [], "dòng của `body` mất khỏi HTML trang tông chỉ mà không phải ghi chú dàn trang");
	report.assertClean();
});

// ── Khu vực ─────────────────────────────────────────────────────────────────

test("khu vực: 14 khu khớp D1 từng trường; trang luôn có chữ thân (thân bài đã lưu, hoặc phần giới thiệu)", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo } = open();
	const truth = rows<Row>(sqlite, "select a.*, m.r2_key as ck, m.url as cu from area a left join media m on m.id = a.cover_media_id where a.visible = 1 and a.deleted_at is null order by a.position, a.id");
	assert.equal(truth.length, 14);
	const areas = await repo.listAreas();
	const report = new FieldReport("khu vực");
	for (const [index, row] of truth.entries()) {
		const id = str(row.slug);
		const a = areas.find((x) => x.slug === row.slug);
		report.row();
		if (!a) {
			report.eq("area", id, "có", null);
			continue;
		}
		const cover = image(row.ck, row.cu, row.cover_position);
		report.eq("id", id, row.id, a.id);
		report.eq("name", id, row.name, a.name);
		report.eq("subtitle", id, row.subtitle, a.subtitle);
		report.eq("temple", id, row.temple, a.temple);
		report.eq("cover", id, cover, a.cover);
		report.eq("mapPos", id, typeof row.map_x === "number" && typeof row.map_y === "number" ? { x: row.map_x, y: row.map_y } : null, a.mapPos);
		report.eq("intro", id, row.intro, a.intro);
		report.eq("contentHtml (byte)", id, row.content_html, a.contentHtml);
		const record = toAreaRecord(a, index);
		report.eq("record.imgUrl", id, abs(cover?.src), record.imgUrl);
		report.eq("record.imgPosition", id, cover?.position ?? "center 50%", record.imgPosition);
		report.eq("record.description (intro)", id, row.intro, record.description);
		report.eq("record.contentHtml", id, row.content_html, record.contentHtml);
		// Chữ thân bài của trang: cleanBodyHtml(content_html) nếu có, ngược lại phần giới thiệu.
		const body = areaBodyHtml(record);
		const expectedWords = str(row.content_html).trim() ? words(textOf(str(row.content_html))) : words(str(row.intro));
		report.eq("areaBodyHtml: đủ từ", id, expectedWords.join(" "), words(textOf(body)).join(" "));
	}
	console.log(`  ${report.summary()}`);
	report.assertClean();
});

// ── Bảo tượng ───────────────────────────────────────────────────────────────

test("tượng: 126 tượng khớp D1 từng trường (mã, tên, ảnh, hội chúng, trích dẫn, tác phẩm, thân bài), trang tượng đủ chữ", { skip: SKIP_REAL }, async () => {
	const { sqlite, d1, repo } = open();
	const truth = rows<Row>(
		sqlite,
		`select s.*, g.slug as gslug, g.name as gname, k.name as kname, m.r2_key as ik, m.url as iu from statue s left join category g on g.id = s.assembly_id
		left join statue_cluster k on k.id = s.cluster_id left join media m on m.id = s.image_media_id where s.deleted_at is null and s.status = 'published' order by s.position, s.id`,
	);
	assert.equal(truth.length, 126);
	const list = await repo.listStatues();
	const links = await readStatueLinks(d1);
	const report = new FieldReport("tượng");
	const lostWords: string[] = [];
	for (const row of truth) {
		const id = str(row.slug);
		const s = list.find((x) => x.slug === row.slug);
		report.row();
		if (!s) {
			report.eq("statue", id, "có", null);
			continue;
		}
		report.eq("id", id, row.id, s.id);
		report.eq("code", id, row.code, s.code);
		report.eq("name", id, row.name, s.name);
		report.eq("subtitle", id, row.subtitle, s.subtitle);
		report.eq("areaCode", id, row.area_code, s.areaCode);
		report.eq("main", id, row.is_main === 1, s.main);
		report.eq("image", id, image(row.ik, row.iu, row.image_position), s.image);
		report.eq("assembly", id, { slug: str(row.gslug), name: str(row.gname) }, s.assembly);
		report.eq("cluster", id, str(row.kname), s.cluster);
		report.eq("href", id, `/bao-tuong/${row.slug}`, s.href);
		const full = await repo.getStatue(id);
		if (!full) {
			report.eq("getStatue", id, "có", null);
			continue;
		}
		report.eq("quote", id, row.quote_text === null ? null : { text: str(row.quote_text), author: str(row.quote_author) }, full.quote);
		const art = rows<Row>(sqlite, "select v.*, m.r2_key as ik, m.url as iu, t.slug as art_slug from art_variation v left join media m on m.id = v.image_media_id left join statue t on t.id = v.art_statue_id where v.statue_id = ? order by v.position", row.id).map((v) => ({
			id: str(v.variation_id),
			title: str(v.title),
			location: str(v.location),
			meaning: str(v.meaning),
			image: image(v.ik, v.iu, v.image_position),
			href: v.art_slug ? `/bao-tuong/${str(v.art_slug)}` : null,
		}));
		report.eq("art (tác phẩm)", id, art, full.art);
		// Thân bài: HTML thì qua bộ lọc đặc biệt; văn bản thường thì được dựng thành đoạn: chữ không mất.
		const body = str(row.body);
		const shown = new Set(words(textOf(full.contentHtml)));
		const missing = words(textOf(body).replace(/[*#>_`[\]()!]/g, " ")).filter((w) => !shown.has(w));
		if (missing.length) lostWords.push(`${id}: ${missing.slice(0, 8).join(",")} (${missing.length})`);
		if (body.trimStart().startsWith("<")) report.eq("contentHtml (cleanBodyHtml)", id, cleanBodyHtml(body), full.contentHtml);
		else report.eq("contentHtml không rỗng khi body có chữ", id, body.trim().length > 0, full.contentHtml.trim().length > 0 || body.trim().length === 0);
		// Trang tượng V3 (liveStatuePage).
		const page = await liveStatuePage(id, { repo, links });
		report.eq("page.statue.name", id, row.name, page?.statue.name);
		report.eq("page.statue.fullHistoryHtml", id, full.contentHtml, page?.statue.fullHistoryHtml);
		report.eq("page.statue.quote", id, row.quote_text === null || str(row.quote_text) === "" ? undefined : str(row.quote_text), page?.statue.quote);
		report.eq("page.statue.imgUrl", id, abs(image(row.ik, row.iu, null)?.src), page?.statue.imgUrl);
		report.eq("page.artWorks.length", id, art.length, page?.artWorks.length);
	}
	console.log(`  ${report.summary()}`);
	assert.deepEqual(lostWords, [], "từ của thân bài tượng bị mất");
	report.assertClean();
});

// ── Lịch tu học ─────────────────────────────────────────────────────────────

test("lịch: 15 sự kiện, 3 khóa lễ, 12 chủ đề tháng, 12 ảnh Lời Thầy khớp D1 từng trường (kể cả khung giờ, video, ảnh)", { skip: SKIP_REAL }, async () => {
	const { sqlite, repo } = open();
	const schedule = await repo.getSchedule();
	const report = new FieldReport("lịch");
	const events = rows<Row>(
		sqlite,
		`select e.*, c.slug as cslug, c.name as cname, m.r2_key as ik, m.url as iu from calendar_event e left join category c on c.id = e.category_id left join media m on m.id = e.image_media_id
		where e.deleted_at is null and e.status = 'published' order by e.start_date, e.end_date, e.position, e.id`,
	);
	assert.equal(events.length, 15);
	const shaped = toScheduleData(schedule);
	const ddmmyyyy = (iso: string) => iso.split("-").reverse().join(".");
	for (const [index, row] of events.entries()) {
		const id = str(row.slug);
		const e = schedule.events[index];
		report.row();
		report.eq("slug", id, row.slug, e?.slug);
		report.eq("title", id, row.title, e?.title);
		report.eq("subtitle", id, row.subtitle, e?.subtitle);
		report.eq("category", id, { slug: str(row.cslug), name: str(row.cname) }, e?.category);
		report.eq("start", id, row.start_date, e?.start);
		report.eq("end", id, row.end_date, e?.end);
		report.eq("times", id, json(row.times, []), e?.times);
		report.eq("location", id, row.location, e?.location);
		report.eq("description", id, row.description, e?.description);
		report.eq("notes", id, row.notes, e?.notes);
		report.eq("image", id, image(row.ik, row.iu, row.image_position), e?.image);
		report.eq("video", id, json(row.video, null), e?.video);
		const custom = shaped.customEvents[index] as Row;
		report.eq("record.solarDateStr", id, ddmmyyyy(str(row.start_date)), custom.solarDateStr);
		report.eq("record.imgUrl", id, abs(image(row.ik, row.iu, null)?.src), custom.imgUrl);
		const slots = json<{ label: string; time: string }[]>(row.times, []);
		slots.forEach((t, i) => {
			report.eq(`record.timeSlot${i + 1}Time`, id, t.time, custom[`timeSlot${i + 1}Time`]);
			report.eq(`record.timeSlot${i + 1}Label`, id, t.label, custom[`timeSlot${i + 1}Label`]);
		});
		report.eq("record.videoUrl", id, json<{ url: string } | null>(row.video, null)?.url, custom.videoUrl);
	}
	for (const row of rows<Row>(sqlite, "select f.*, m.r2_key as ik, m.url as iu from featured_program f left join media m on m.id = f.image_media_id order by f.position, f.id")) {
		const id = str(row.id);
		const p = schedule.programs.find((x) => x.id === row.id);
		report.row();
		report.eq("program.title", id, row.title, p?.title);
		report.eq("program.subtitle", id, row.subtitle, p?.subtitle);
		report.eq("program.summary", id, row.summary, p?.summary);
		report.eq("program.time", id, row.time, p?.time);
		report.eq("program.duration", id, row.duration, p?.duration);
		report.eq("program.location", id, row.location, p?.location);
		report.eq("program.image", id, image(row.ik, row.iu, row.image_position), p?.image);
	}
	for (const row of rows<Row>(sqlite, "select t.*, m.r2_key as ik, m.url as iu from month_theme t left join media m on m.id = t.poster_media_id order by t.month")) {
		const id = `tháng ${row.month}`;
		const t = schedule.themes.find((x) => x.month === row.month);
		report.row();
		report.eq("theme.title", id, row.title, t?.title);
		report.eq("theme.poster", id, src(row.ik, row.iu), t?.poster);
		report.eq("theme.lines", id, json(row.lines, []), t?.lines);
		report.eq("theme.author", id, row.author, t?.author);
	}
	for (const row of rows<Row>(sqlite, "select q.id, q.title, m.r2_key as ik, m.url as iu from quote_image q join media m on m.id = q.media_id order by q.position, q.id")) {
		const q = schedule.quotes.find((x) => x.id === row.id);
		report.row();
		report.eq("quote.src", str(row.id), src(row.ik, row.iu), q?.src);
		report.eq("quote.title", str(row.id), row.title, q?.title);
	}
	console.log(`  ${report.summary()}`);
	report.assertClean();
});

// ── Dạng dữ liệu admin ghi (khác dạng bản nhập) ─────────────────────────────

test("bài do admin lưu: chữ giàu (bảng, video, âm thanh, chú thích), trường riêng, SEO, ảnh chia sẻ, ghim, liên quan, album hiện đúng như đã lưu", { skip: SKIP_REAL }, async () => {
	const c = copyOfReal();
	try {
		const posts = rows<Row>(c.sqlite, "select id, slug, section from post where section = 'tri-tue-phat-phap' order by rowid limit 4");
		const medias = rows<Row>(c.sqlite, "select id, r2_key, url from media where r2_key is not null order by id limit 4");
		const [audio, video, book, rich] = posts;
		// Thân bài đúng như admin lưu: đầu ra của bộ lọc (admin lọc trước khi ghi), nên V3 lọc lại phải không đổi gì.
		const stored = sanitizeHtml(
			'<h2>Mục</h2><p>Đoạn <strong>đậm</strong> và <a href="https://example.org/x" target="_blank">liên kết</a>.</p><table><tbody><tr><td>ô 1</td><td>ô 2</td></tr></tbody></table>' +
				'<figure><img src="/anh-goc/s2-cnv03/x.webp" alt="ảnh" data-media-id="m-1"><figcaption>chú thích</figcaption></figure><div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe></div>' +
				'<audio controls src="/anh-goc/s2-cnv03/a.mp3"></audio><blockquote class="kinh">Kinh văn</blockquote><hr><p>Tuổi &lt; 18 &amp; hơn</p>',
		);
		assert.ok(/<table>/.test(stored) && /<iframe/.test(stored) && /<audio/.test(stored) && /<figcaption>/.test(stored), "bộ lọc giữ bảng, video, âm thanh, chú thích");
		const update = (id: unknown, cols: Record<string, unknown>) => c.sqlite.prepare(`update post set ${Object.keys(cols).map((k) => `${k} = ?`).join(", ")} where id = ?`).run(...(Object.values(cols) as never[]), id as string);
		update(audio.id, { extra: JSON.stringify({ audioMediaId: medias[0].id, duration: "45:10" }), pinned: 1, thumbnail_position: "center 20%" });
		update(video.id, { extra: JSON.stringify({ youtubeId: "dQw4w9WgXcQ" }), seo_title: "Tiêu đề SEO", seo_description: "Mô tả SEO", og_media_id: medias[1].id });
		update(book.id, { extra: JSON.stringify({ book: { title: "Sách", author: "Tác giả", coverMediaId: medias[2].id, link: "https://example.org/sach" } }) });
		update(rich.id, {
			content_html: stored,
			keywords: JSON.stringify([{ keyword: "Từ", title: "Tiêu đề từ", description: "Mô tả từ" }]),
			videos: JSON.stringify([{ id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }]),
		});
		c.sqlite.prepare("insert into post_related (post_id, target_type, target_id, position) values (?, 'post', ?, 1), (?, 'post', ?, 0)").run(rich.id as string, audio.id as string, rich.id as string, video.id as string);
		const repo = createD1Repository(c.d1);
		const section = "tri-tue-phat-phap";
		const A = await repo.getPostBySlug(str(audio.slug), section);
		assert.deepEqual(A?.extra.audio, { src: `${MEDIA_BASE}/${str(medias[0].r2_key)}`, duration: "45:10" }, "âm thanh Pháp âm");
		assert.equal(A?.pinned, true);
		assert.equal(A?.thumbnail?.position, "center 20%");
		const V = await repo.getPostBySlug(str(video.slug), section);
		assert.equal(V?.extra.youtubeId, "dQw4w9WgXcQ");
		assert.deepEqual(V?.videos, [{ id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }], "video lấy từ trường riêng của chuyên mục");
		assert.equal(V?.seoTitle, "Tiêu đề SEO");
		assert.equal(V?.seoDescription, "Mô tả SEO");
		assert.equal(V?.ogImage?.src, `${MEDIA_BASE}/${str(medias[1].r2_key)}`);
		const B = await repo.getPostBySlug(str(book.slug), section);
		assert.deepEqual(B?.extra.book, { title: "Sách", author: "Tác giả", cover: `${MEDIA_BASE}/${str(medias[2].r2_key)}`, link: "https://example.org/sach" });
		const R = await repo.getPostBySlug(str(rich.slug), section);
		assert.equal(R?.contentHtml, stored, "thân bài giàu nguyên từng byte");
		assert.equal(sanitizeHtml(R!.contentHtml), stored, "lọc lại không đổi (admin đã lọc)");
		assert.ok(needsRichHtml(R!.contentHtml), "đường HTML giàu");
		assert.equal(richHtml(R!.contentHtml), stored, "trang hiện đúng HTML đã lưu");
		assert.deepEqual(R?.keywords, [{ keyword: "Từ", title: "Tiêu đề từ", description: "Mô tả từ" }]);
		assert.deepEqual(R?.videos.map((v) => v.id), ["dQw4w9WgXcQ"]);
		assert.deepEqual(R?.related.map((r) => r.id), [str(video.id), str(audio.id)], "bài liên quan theo thứ tự admin chọn");
		assert.equal(toPostRecord(R!).videoBlock?.videoUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
	} finally {
		c.close();
	}
});
