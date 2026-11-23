// Lập chỉ mục khi V3 thành trang chính: host công khai, robots.txt, sitemap, canonical, JSON-LD, địa chỉ mã cũ của bài.
// Mẫu từ tests/unit/seo.test.ts của www (E:\tlhp-av3). Phần đọc dùng kho nội dung giả, không cần D1.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { ContentRepository, Post, PostSummary, ScheduleEvent } from "@/lib/tlhp-content/types";
import { absoluteUrl, canonicalPath, canonicalUrl, mayIndex, MOVED_PATHS, originOf, PUBLIC_ORIGIN } from "@/lib/site-url";
import { isPublicHost } from "@/lib/v3-hosts";
import { legacyIdTarget } from "@/lib/v3-canonical";
import { articleJsonLd, breadcrumbJsonLd, eventJsonLd, eventJsonLdFor, jsonLdText, organizationJsonLd, placeJsonLd, postJsonLdFor } from "@/lib/v3-jsonld";
import { buildRobots, DISALLOW, extraFromSettings } from "@/lib/v3-robots";
import { eventMetadata, pageMetadata, postMetadata, postMetadataFor, programMetadata, statueMetadata } from "@/lib/v3-seo";
import { FIXED_PATHS, sitemapEntries } from "@/lib/v3-sitemap";

// ── Host ────────────────────────────────────────────────────────────────────

test("chỉ www và tên miền gốc được lập chỉ mục; mọi host khác (v3., thu., workers.dev, localhost) thì không", () => {
	for (const host of ["www.tunglamhoaphuc.com", "tunglamhoaphuc.com", "WWW.TUNGLAMHOAPHUC.COM", "www.tunglamhoaphuc.com:443", "www.tunglamhoaphuc.com."]) {
		assert.equal(isPublicHost(host), true, host);
		assert.equal(mayIndex(host), true, host);
	}
	for (const host of ["v3.tunglamhoaphuc.com", "thu.tunglamhoaphuc.com", "quantri.tunglamhoaphuc.com", "tlhp-v3.x.workers.dev", "localhost:3011", "127.0.0.1", "www.tunglamhoaphuc.com.evil.example", "", null, undefined]) {
		assert.equal(isPublicHost(host), false, String(host));
	}
});

test("originOf: host công khai và host khác theo https, host cục bộ theo http, trống thì về trang công khai", () => {
	assert.equal(originOf("www.tunglamhoaphuc.com"), "https://www.tunglamhoaphuc.com");
	assert.equal(originOf("v3.tunglamhoaphuc.com"), "https://v3.tunglamhoaphuc.com");
	assert.equal(originOf("localhost:3011"), "http://localhost:3011");
	assert.equal(originOf(null), PUBLIC_ORIGIN);
	assert.equal(PUBLIC_ORIGIN, "https://www.tunglamhoaphuc.com");
});

test("absoluteUrl mã hóa ký tự ngoài ASCII, giữ phần đã mã hóa và viết hoa nó để sitemap và canonical giống nhau", () => {
	assert.equal(absoluteUrl("/dong-chay-hoang-phap/a-b"), "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/a-b");
	assert.equal(absoluteUrl("/x/%F0%9F%AA%B7"), "https://www.tunglamhoaphuc.com/x/%F0%9F%AA%B7");
	assert.equal(absoluteUrl("/x/%f0%9f%aa%b7"), "https://www.tunglamhoaphuc.com/x/%F0%9F%AA%B7");
	assert.equal(absoluteUrl("/x/🪷"), "https://www.tunglamhoaphuc.com/x/%F0%9F%AA%B7");
});

test("canonical: tuyệt đối trên host công khai, không chuỗi truy vấn, không dấu / cuối, địa chỉ đã chuyển thì dùng địa chỉ mới", () => {
	assert.equal(canonicalUrl("/"), "https://www.tunglamhoaphuc.com/");
	assert.equal(canonicalUrl("/gioi-thieu/"), "https://www.tunglamhoaphuc.com/gioi-thieu");
	assert.equal(canonicalUrl("/dong-chay-hoang-phap?trang=2#x"), "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap");
	assert.equal(canonicalUrl("/tong-chi-tu-hoc/tong-phong-truyen-thua-truc-lam"), "https://www.tunglamhoaphuc.com/tong-chi-tu-hoc/tiep-buoc-thay-toi");
	assert.equal(canonicalPath("/gioi-thieu"), "/gioi-thieu");
	assert.ok(Object.keys(MOVED_PATHS).length >= 1);
});

// ── robots.txt ──────────────────────────────────────────────────────────────

test("robots.txt: host công khai cho quét, chặn tìm kiếm, ảnh, API, trang nội bộ và có Sitemap; host khác cấm hết", () => {
	const open = buildRobots("www.tunglamhoaphuc.com");
	assert.deepEqual(open.rules, { userAgent: "*", allow: "/", disallow: DISALLOW });
	assert.equal(open.sitemap, "https://www.tunglamhoaphuc.com/sitemap.xml");
	for (const path of ["/tim-kiem", "/cdn-cgi/", "/anh-goc/", "/api/", "/tra-cuu-bai-vi", "/kiem-tra-anh"]) assert.ok(DISALLOW.includes(path), path);
	for (const host of ["v3.tunglamhoaphuc.com", "thu.tunglamhoaphuc.com", "x.workers.dev", "localhost:3011", null]) {
		const closed = buildRobots(host);
		assert.deepEqual(closed.rules, { userAgent: "*", disallow: "/" }, String(host));
		assert.equal(closed.sitemap, undefined);
	}
	// tên miền gốc cũng là host công khai, và sitemap luôn là địa chỉ www
	assert.equal(buildRobots("tunglamhoaphuc.com").sitemap, "https://www.tunglamhoaphuc.com/sitemap.xml");
});

test("robots.txt: các dòng admin thêm ở SEO > robots.txt được nối vào; sai quy cách thì bỏ", () => {
	const extra = extraFromSettings({ "seo.defaults": { robotsExtra: "Disallow: /thu-nghiem\nAllow: /thu-nghiem/ok" } });
	assert.deepEqual(extra, { allow: ["/thu-nghiem/ok"], disallow: ["/thu-nghiem"] });
	const rules = buildRobots("www.tunglamhoaphuc.com", extra).rules as { allow: string[]; disallow: string[] };
	assert.deepEqual(rules.allow, ["/", "/thu-nghiem/ok"]);
	assert.deepEqual(rules.disallow, [...DISALLOW, "/thu-nghiem"]);
	for (const bad of [{ "seo.defaults": { robotsExtra: "Sitemap: https://evil.example/x" } }, { "seo.defaults": { robotsExtra: 5 } }, { "seo.defaults": null }, {}]) {
		assert.deepEqual(extraFromSettings(bad), { allow: [], disallow: [] });
	}
	// host không công khai: không đọc cài đặt cũng được, vẫn cấm hết
	assert.deepEqual(buildRobots("v3.tunglamhoaphuc.com", extra).rules, { userAgent: "*", disallow: "/" });
});

// ── sitemap.xml ─────────────────────────────────────────────────────────────

const category = { slug: "c", name: "C" };
const summary = (id: string, section: string, slug: string, publishedDate: string): PostSummary =>
	({ id, slug, title: `Bài ${id}`, subtitle: "", section, category, author: "", publishedDate, views: 0, thumbnail: null, banner: null, summary: "", galleryCount: 0, pinned: false }) as PostSummary;

function fakeRepo(over: Partial<Record<keyof ContentRepository, unknown>> = {}): ContentRepository {
	const posts = [
		...Array.from({ length: 70 }, (_, i) => summary(`d${i}`, "dong-chay-hoang-phap", `bai-d-${i}`, `2026-01-${String((i % 28) + 1).padStart(2, "0")}T08:00:00`)),
		...Array.from({ length: 3 }, (_, i) => summary(`t${i}`, "tri-tue-phat-phap", `bai-t-${i}`, "2025-05-05T00:00:00")),
	];
	const event = (slug: string, programId?: string) => ({ id: slug, slug, title: slug, subtitle: "", category, start: "2026-12-01", end: "2026-12-01", times: [], location: "", description: "", notes: "", image: null, video: null, ...(programId ? { programId } : {}) }) as ScheduleEvent;
	const repo = {
		async listPosts({ section, page = 1, pageSize = 12 }: { section?: string; page?: number; pageSize?: number } = {}) {
			const all = posts.filter((p) => p.section === section);
			const items = all.slice((page - 1) * pageSize, page * pageSize);
			return { items, total: all.length, page, pageSize, pageCount: Math.max(1, Math.ceil(all.length / pageSize)) };
		},
		async listAboutTopics() {
			return [{ slug: "su-phu-tru-tri" }, { slug: "van-hoa-ung-xu" }];
		},
		async listTongChi() {
			// D1 giữ slug cũ của bài này; sitemap phải ghi địa chỉ mới mà next.config.ts chuyển tới
			return [{ slug: "tam-quy" }, { slug: "tong-phong-truyen-thua-truc-lam" }];
		},
		async listAreas() {
			return [{ slug: "tu-an" }, { slug: "bao-tang" }];
		},
		async listStatues() {
			return [{ href: "/bao-tuong/vi-da_tp0069" }, { href: "/bao-tuong/quan-the-am_tp0001" }];
		},
		async getSchedule() {
			// một ngày của khóa lễ định kỳ (programId) không có trang riêng; khóa lễ thì có, theo tên
			return { events: [event("khoa-tu-1-ngay"), event("ngay-cua-khoa-le", "p1")], programs: [{ id: "p1", title: "CẦU QUỐC THÁI DÂN AN" }], themes: [], quotes: [] };
		},
		...over,
	};
	return repo as unknown as ContentRepository;
}

test("sitemap: trang cố định trước, rồi mọi bài của hai chuyên mục (nhiều trang), chủ đề, Tông Chỉ, khu vực, tượng, sự kiện, khóa lễ", async () => {
	const entries = await sitemapEntries(fakeRepo());
	const paths = entries.map((entry) => entry.path);
	assert.deepEqual(paths.slice(0, FIXED_PATHS.length), [...FIXED_PATHS]);
	assert.equal(paths.filter((p) => p.startsWith("/dong-chay-hoang-phap/bai-d-")).length, 70, "đủ 70 bài qua 2 trang 60");
	assert.equal(paths.filter((p) => p.startsWith("/tri-tue-phat-phap/bai-t-")).length, 3);
	for (const expected of ["/gioi-thieu/su-phu-tru-tri", "/tong-chi-tu-hoc/tam-quy", "/vu-tru-phat-giao/tu-an", "/vu-tru-phat-giao/bao-tang", "/bao-tuong/vi-da_tp0069", "/lich-tu-hoc/khoa-tu-1-ngay", "/lich-tu-hoc/cau-quoc-thai-dan-an"]) {
		assert.ok(paths.includes(expected), expected);
	}
	assert.ok(!paths.includes("/lich-tu-hoc/ngay-cua-khoa-le"), "ngày của khóa lễ định kỳ không có trang riêng");
	assert.equal(entries.find((e) => e.path === "/dong-chay-hoang-phap/bai-d-0")?.lastModified, "2026-01-01");
});

test("sitemap: không trùng, ghi địa chỉ mới của bài Tông Chỉ đã chuyển, và không có trang nội bộ hay trang chuyển hướng", async () => {
	const paths = (await sitemapEntries(fakeRepo())).map((e) => e.path);
	assert.equal(new Set(paths).size, paths.length);
	assert.ok(paths.includes("/tong-chi-tu-hoc/tiep-buoc-thay-toi"));
	assert.ok(!paths.includes("/tong-chi-tu-hoc/tong-phong-truyen-thua-truc-lam"));
	for (const from of Object.keys(MOVED_PATHS)) assert.ok(!paths.includes(from), `${from} chuyển hướng, không được nằm trong sitemap`);
	for (const hidden of ["/lich-tu-hoc", "/kiem-tra-anh", "/tra-cuu-bai-vi", "/tim-kiem", "/bao-tuong", "/quan-tri", "/api/memorials"]) assert.ok(!paths.includes(hidden), hidden);
	// các trang tĩnh của www có mặt, kể cả /lien-he (trang do việc khác thêm)
	for (const fixed of ["/", "/gioi-thieu", "/tong-chi-tu-hoc", "/dong-chay-hoang-phap", "/vu-tru-phat-giao", "/bao-tuong-phat-giao", "/tri-tue-phat-phap", "/tri-tue-phat-phap/di-qua-kho-vui-cuoc-doi", "/tri-tue-phat-phap/hoc-tieng-tang", "/lien-he"]) {
		assert.ok(paths.includes(fixed), fixed);
	}
});

test("sitemap: mọi địa chỉ là https://www..., slug biểu tượng cảm xúc giống canonical từng ký tự", async () => {
	const repo = fakeRepo({
		listPosts: async () => ({ items: [summary("e1", "dong-chay-hoang-phap", "%f0%9f%8c%bathu-moi", "2024-01-01T00:00:00")], total: 1, page: 1, pageSize: 60, pageCount: 1 }),
	});
	const urls = (await sitemapEntries(repo)).map((e) => absoluteUrl(e.path));
	assert.ok(urls.every((url) => url.startsWith("https://www.tunglamhoaphuc.com/")));
	const emoji = urls.find((url) => url.includes("thu-moi"));
	assert.equal(emoji, "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/%F0%9F%8C%BAthu-moi");
	assert.equal(canonicalUrl("/dong-chay-hoang-phap/%f0%9f%8c%bathu-moi"), emoji);
});

test("sitemap.ts không đọc host (không headers()) và đặt revalidate để Workers Cache giữ", () => {
	const source = readFileSync("src/app/sitemap.ts", "utf8");
	assert.doesNotMatch(source, /headers\s*\(/);
	assert.match(source, /export const revalidate = 3600/);
	assert.match(source, /absoluteUrl\(/);
});

// ── Layout và trang: không quyết định lập chỉ mục, không đọc host ──────────────

function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const file = path.join(dir, name);
		if (statSync(file).isDirectory()) return sources(file);
		return /\.(tsx?|mjs)$/.test(name) && !/robots\.ts$/.test(file) ? [file] : [];
	});
}

test("layout: không noindex cứng, metadataBase là host công khai, canonical './' mặc định, openGraph và icon mặc định", () => {
	const layout = readFileSync("src/app/layout.tsx", "utf8");
	assert.doesNotMatch(layout, /index:\s*false/);
	assert.doesNotMatch(layout, /v3\.tunglamhoaphuc/);
	assert.match(layout, /metadataBase:\s*new URL\(PUBLIC_ORIGIN\)/);
	assert.match(layout, /canonical:\s*"\.\/"/);
	assert.match(layout, /og-tung-lam-hoa-phuc\.jpg/);
	assert.match(layout, /twitter:\s*\{\s*card:\s*"summary_large_image"/);
	assert.match(layout, /manifest:\s*"\/manifest\.webmanifest"/);
});

test("không layout hay trang công khai nào đọc host bằng headers() (mất Workers Cache); chỉ robots.ts và trang động tra cứu bài vị", () => {
	// /tra-cuu-bai-vi đã là trang động (force-dynamic, đếm lượt tra theo IP) nên không có cache để mất.
	const dynamicByDesign = (file: string) => file.replace(/\\/g, "/").endsWith("(public)/tra-cuu-bai-vi/page.tsx");
	for (const file of sources("src/app")) {
		if (dynamicByDesign(file)) continue;
		const text = readFileSync(file, "utf8");
		assert.doesNotMatch(text, /from\s+['"]next\/headers['"]/, `${file} không được nhập next/headers`);
	}
	assert.match(readFileSync("src/app/robots.ts", "utf8"), /next\/headers/);
});

test("không còn địa chỉ v3.tunglamhoaphuc.com viết cứng trong mã chạy (ảnh chia sẻ, canonical, sitemap)", () => {
	for (const file of [...sources("src/lib"), ...sources("src/app")]) {
		const text = readFileSync(file, "utf8").split(/\r?\n/).filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join("\n");
		assert.doesNotMatch(text, /https:\/\/v3\.tunglamhoaphuc\.com/, file);
	}
});

// ── Metadata của trang ──────────────────────────────────────────────────────

const og = (m: ReturnType<typeof pageMetadata>) => m.openGraph as { url?: string; images?: string[]; title?: string; type?: string };
const canonical = (m: ReturnType<typeof pageMetadata>) => (m.alternates as { canonical?: string } | undefined)?.canonical;

test("trang danh sách: tiêu đề riêng, canonical tự trỏ, og:url, ảnh chia sẻ chung tuyệt đối, twitter", () => {
	const m = pageMetadata({ title: "Tông Chỉ Tu Học", description: "Mô tả", path: "/tong-chi-tu-hoc" });
	assert.equal(m.title, "Tông Chỉ Tu Học | Tùng Lâm Hòa Phúc");
	assert.equal(m.description, "Mô tả");
	assert.equal(canonical(m), "https://www.tunglamhoaphuc.com/tong-chi-tu-hoc");
	assert.equal(og(m).url, canonical(m));
	assert.equal(og(m).title, "Tông Chỉ Tu Học");
	assert.deepEqual(og(m).images, ["https://www.tunglamhoaphuc.com/brand/og-tung-lam-hoa-phuc.jpg"]);
	assert.equal((m.twitter as { card: string }).card, "summary_large_image");
	assert.equal("robots" in m, false, "trang công khai không đặt robots");
	assert.equal(pageMetadata({ title: "Trang nội bộ", path: "/x", noindex: true }).robots && (pageMetadata({ title: "Trang nội bộ", path: "/x", noindex: true }).robots as { index: boolean }).index, false);
});

test("trang chủ: tiêu đề như www và canonical là gốc của host công khai", () => {
	const m = pageMetadata({ title: "Tùng Lâm Hòa Phúc – Nơi để trở về – Chốn thiêng bình yên", path: "/" });
	assert.equal(m.title, "Tùng Lâm Hòa Phúc – Nơi để trở về – Chốn thiêng bình yên", "tiêu đề đã có tên chùa thì không thêm hậu tố");
	assert.equal(canonical(m), "https://www.tunglamhoaphuc.com/");
});

test("bài: canonical là địa chỉ bằng slug thật, kể cả khi mở bằng mã cũ; ảnh chia sẻ là ảnh www", async () => {
	const full = (slug: string, id: string): Post =>
		({ ...summary(id, "dong-chay-hoang-phap", slug, "2026-01-01"), summary: "Tóm tắt", banner: { src: "/anh-goc/tlhp-media/b.webp", position: "" }, intro: "", contentHtml: "", keywords: [], gallery: [], videos: [], seoTitle: "", seoDescription: "", ogImage: null, extra: {}, related: [] }) as unknown as Post;
	const target = full("17649-2", "post-17649");
	const repo = fakeRepo({
		getPostBySlug: async (slug: string) => (slug === "17649-2" ? target : null),
		listPosts: async () => ({ items: [summary("post-17649", "dong-chay-hoang-phap", "17649-2", "2026-01-01")], total: 1, page: 1, pageSize: 60, pageCount: 1 }),
	});
	for (const requested of ["17649-2", "17649", "post-17649"]) {
		const m = await postMetadataFor(requested, "dong-chay-hoang-phap", repo);
		assert.equal(canonical(m), "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/17649-2", requested);
		assert.equal(og(m).url, canonical(m));
		assert.deepEqual(og(m).images, ["https://www.tunglamhoaphuc.com/anh-goc/tlhp-media/b.webp"]);
		assert.equal(og(m).type, "article");
	}
	assert.deepEqual(await postMetadataFor("khong-co", "dong-chay-hoang-phap", repo), {});
	assert.equal(canonical(postMetadata(target)), undefined, "không truyền đường dẫn thì để layout đặt");
});

test("bảo tượng: dùng SEO title/description của tượng, không thì tên và phụ đề, nhóm, chúng hội; ảnh tượng; canonical là địa chỉ tượng", () => {
	const base = { name: "Vi Đà Hộ Pháp", subtitle: "Hộ pháp", cluster: "Chư Thiên", assembly: { slug: "a", name: "Chư Thiên Hộ Pháp" }, image: { src: "/anh-goc/tlhp-media/vi-da.webp", position: "" }, href: "/bao-tuong/vi-da_tp0069", contentHtml: "<p>Nội dung <b>chi tiết</b></p>" };
	const plain = statueMetadata(base);
	assert.equal(plain.title, "Vi Đà Hộ Pháp – Hộ pháp | Tùng Lâm Hòa Phúc");
	assert.equal(plain.description, "Hộ pháp · Chư Thiên · Chư Thiên Hộ Pháp");
	assert.equal(canonical(plain), "https://www.tunglamhoaphuc.com/bao-tuong/vi-da_tp0069");
	assert.deepEqual(og(plain).images, ["https://www.tunglamhoaphuc.com/anh-goc/tlhp-media/vi-da.webp"]);
	const seo = statueMetadata({ ...base, seoTitle: "Tượng Vi Đà", seoDescription: "Mô tả SEO của tượng" });
	assert.equal(seo.title, "Tượng Vi Đà | Tùng Lâm Hòa Phúc");
	assert.equal(seo.description, "Mô tả SEO của tượng");
	const bare = statueMetadata({ ...base, subtitle: "", cluster: "", assembly: { slug: "", name: "" }, image: null });
	assert.equal(bare.description, "Nội dung chi tiết", "không có thông tin phụ thì lùi về nội dung bài, đã bỏ thẻ");
	assert.deepEqual(og(bare).images, ["https://www.tunglamhoaphuc.com/brand/og-tung-lam-hoa-phuc.jpg"]);
});

test("lịch tu học: sự kiện và khóa lễ định kỳ có tiêu đề riêng và canonical theo địa chỉ chuẩn", () => {
	const category = { slug: "cong-tu", name: "Cộng Tu" };
	const event = { title: "Khóa tu một ngày", subtitle: "", slug: "khoa-tu-mot-ngay", description: "<p>Mô tả khóa tu</p>", category, start: "2026-12-06", end: "2026-12-06", image: null };
	const m = eventMetadata(event);
	assert.equal(m.title, "Khóa tu một ngày | Tùng Lâm Hòa Phúc");
	assert.equal(m.description, "Mô tả khóa tu");
	assert.equal(canonical(m), "https://www.tunglamhoaphuc.com/lich-tu-hoc/khoa-tu-mot-ngay");
	assert.equal(eventMetadata({ ...event, description: "" }).description, "Cộng Tu · 2026-12-06");
	const program = programMetadata({ title: "ĐẠI SÁM HỐI", subtitle: "Khóa lễ", summary: "", image: null }, "dai-sam-hoi");
	assert.equal(program.title, "ĐẠI SÁM HỐI | Tùng Lâm Hòa Phúc");
	assert.equal(program.description, "Khóa lễ");
	assert.equal(canonical(program), "https://www.tunglamhoaphuc.com/lich-tu-hoc/dai-sam-hoi");
});

// ── Mã cũ của bài ───────────────────────────────────────────────────────────

test("mã cũ của bài (17649, post-17649) chuyển về địa chỉ bằng slug; slug thường và slug trùng mã thì không", () => {
	assert.equal(legacyIdTarget("17649", "17649-2", "/dong-chay-hoang-phap"), "/dong-chay-hoang-phap/17649-2");
	assert.equal(legacyIdTarget("post-17649", "17649-2", "/dong-chay-hoang-phap"), "/dong-chay-hoang-phap/17649-2");
	assert.equal(legacyIdTarget("POST-4862", "4862-2", "/tri-tue-phat-phap"), "/tri-tue-phat-phap/4862-2");
	assert.equal(legacyIdTarget("17649-2", "17649-2", "/dong-chay-hoang-phap"), null, "đã là địa chỉ chuẩn");
	assert.equal(legacyIdTarget("17649", "17649", "/dong-chay-hoang-phap"), null, "một bài có slug đúng bằng mã thì không chuyển");
	assert.equal(legacyIdTarget("mot-bai-co-chu", "mot-bai-khac", "/dong-chay-hoang-phap"), null, "chỉ số thuần mới là mã cũ");
	assert.equal(legacyIdTarget("%F0%9F%8C%BA-x", "%f0%9f%8c%ba-x", "/dong-chay-hoang-phap"), null);
	assert.equal(legacyIdTarget("17649", "slug-có-dấu", "/dong-chay-hoang-phap"), null, "không ghép slug cần mã hóa vào Location");
});

test("hai trang bài đều gọi legacyIdTarget trước khi vẽ và chuyển bằng permanentRedirect", () => {
	for (const file of ["src/app/(public)/dong-chay-hoang-phap/[slug]/page.tsx", "src/app/(public)/tri-tue-phat-phap/[slug]/page.tsx"]) {
		const text = readFileSync(file, "utf8");
		assert.match(text, /legacyIdTarget\(/, file);
		assert.match(text, /permanentRedirect\(moved\)/, file);
	}
});

// ── JSON-LD ─────────────────────────────────────────────────────────────────

test("JSON-LD: ngôi chùa có số điện thoại quốc tế, địa chỉ, logo và ảnh trên host công khai", () => {
	const data = organizationJsonLd();
	assert.deepEqual(data["@type"], ["Organization", "BuddhistTemple"]);
	assert.equal(data.telephone, "+84979345373");
	assert.equal(data.address.addressCountry, "VN");
	assert.equal(data.url, "https://www.tunglamhoaphuc.com/");
	assert.equal(data.logo, "https://www.tunglamhoaphuc.com/brand/logo-moc-an.webp");
	assert.equal(data["@id"], "https://www.tunglamhoaphuc.com/#chua");
	assert.equal(placeJsonLd().url, "https://www.tunglamhoaphuc.com/lien-he");
	assert.equal(placeJsonLd()["@type"], "Place");
});

test("JSON-LD: bài là Article có địa chỉ riêng, ảnh tuyệt đối, tiêu đề ≤ 110 ký tự, tác giả hoặc tổ chức", () => {
	const post = { title: "x".repeat(300), summary: "Tóm tắt", author: "", publishedDate: "2026-01-02T08:00:00", banner: { src: "/anh-goc/tlhp-media/b.webp", position: "" }, thumbnail: null };
	const data = articleJsonLd(post, "/dong-chay-hoang-phap/bai-1");
	assert.equal(data["@type"], "Article");
	assert.equal(data.headline.length, 110);
	assert.equal(data.mainEntityOfPage, "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/bai-1");
	assert.deepEqual(data.image, ["https://www.tunglamhoaphuc.com/anh-goc/tlhp-media/b.webp"]);
	assert.equal(data.author["@type"], "Organization");
	assert.equal(articleJsonLd({ ...post, author: "Thầy A" }, "/x").author["@type"], "Person");
	assert.equal("image" in articleJsonLd({ ...post, banner: null }, "/x"), false);
});

test("JSON-LD: sự kiện là Event có ngày, nơi và đơn vị tổ chức", () => {
	const event = { id: "e1", slug: "khoa-tu", title: "Khóa tu", subtitle: "", category: { slug: "c", name: "C" }, start: "2026-11-08", end: "2026-11-09", times: [], location: "Chánh điện", description: "Mô tả", notes: "", image: null, video: null } satisfies ScheduleEvent;
	const data = eventJsonLd(event);
	assert.equal(data["@type"], "Event");
	assert.equal(data.startDate, "2026-11-08");
	assert.equal(data.endDate, "2026-11-09");
	assert.equal(data.location.name, "Chánh điện");
	assert.equal(data.organizer.url, "https://www.tunglamhoaphuc.com/");
});

test("JSON-LD: breadcrumb luôn bắt đầu từ trang chủ, đánh số từ 1, địa chỉ tuyệt đối, bỏ mục trống", () => {
	const data = breadcrumbJsonLd([{ name: "Dòng Chảy Hoằng Pháp", path: "/dong-chay-hoang-phap" }, { name: " ", path: "/x" }, { name: "Bài", path: "/dong-chay-hoang-phap/bai" }]);
	assert.equal(data["@type"], "BreadcrumbList");
	assert.deepEqual(
		data.itemListElement.map((i) => [i.position, i.name, i.item]),
		[
			[1, "Tùng Lâm Hòa Phúc", "https://www.tunglamhoaphuc.com/"],
			[2, "Dòng Chảy Hoằng Pháp", "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap"],
			[3, "Bài", "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/bai"],
		],
	);
});

test("JSON-LD: chữ có thẻ không đóng được <script>", () => {
	const text = jsonLdText({ a: "</script><script>alert(1)</script>" });
	assert.doesNotMatch(text, /<\/script>/);
	assert.equal(JSON.parse(text).a, "</script><script>alert(1)</script>");
});

test("JSON-LD theo trang: bài đọc từ kho (kể cả mở bằng mã cũ) cho Article + BreadcrumbList; sự kiện cho Event; không có thì rỗng", async () => {
	const post = { ...summary("post-1", "dong-chay-hoang-phap", "bai-mot", "2026-01-01"), author: "Thầy A", contentHtml: "" } as unknown as Post;
	const repo = fakeRepo({
		getPostBySlug: async (slug: string) => (slug === "bai-mot" ? post : null),
		listPosts: async () => ({ items: [summary("post-1", "dong-chay-hoang-phap", "bai-mot", "2026-01-01")], total: 1, page: 1, pageSize: 60, pageCount: 1 }),
	});
	for (const key of ["bai-mot", "post-1", "1"]) {
		const [article, crumbs] = (await postJsonLdFor(key, "dong-chay-hoang-phap", "Dòng Chảy Hoằng Pháp", "/dong-chay-hoang-phap", repo)) as [{ "@type": string; mainEntityOfPage: string }, { "@type": string }];
		assert.equal(article["@type"], "Article", key);
		assert.equal(article.mainEntityOfPage, "https://www.tunglamhoaphuc.com/dong-chay-hoang-phap/bai-mot", key);
		assert.equal(crumbs["@type"], "BreadcrumbList");
	}
	assert.deepEqual(await postJsonLdFor("khong-co", "dong-chay-hoang-phap", "x", "/x", repo), []);
	const [event] = (await eventJsonLdFor("khoa-tu-1-ngay", repo)) as [{ "@type": string }];
	assert.equal(event["@type"], "Event");
	assert.deepEqual(await eventJsonLdFor("ngay-cua-khoa-le", repo), [], "ngày của khóa lễ định kỳ không phải Event riêng");
	assert.deepEqual(await eventJsonLdFor("khong-co", repo), []);
});
