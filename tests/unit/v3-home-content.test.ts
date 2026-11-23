// Chữ và video đầu trang chủ lấy từ các khối home.* của admin; Dấu ấn hoằng pháp lấy lượt xem thật.
// Thiếu hoặc sai khối nào thì phần đó giữ chữ/video sẵn có của V3 (trang không bao giờ vỡ).
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_HERO, DEFAULT_HERO_VIDEO_ID, heroFromSettings } from "@/lib/v3-home-content";
import { buildDharmaFeatured, dharmaTilesFrom, formatDate } from "@/lib/v3-dharma";
import type { V3Post, V3TongChi } from "@/lib/v3-data";

const slide = (over: Record<string, unknown> = {}) => ({ id: "s1", enabled: true, title: "Nơi để trở về", subtitle: "Chốn thiêng bình yên", text: "", imageMediaId: null, portraitMediaId: null, imagePosition: "", ctaLabel: "", ctaHref: "", ...over });
const hero = (slides: unknown[]) => ({ slides, autoEvent: true, autoLatest: true });
const welcome = (over: Record<string, unknown> = {}) => ({ quote: "", author: "", paragraph: "", imageMediaId: null, videoUrl: "", linkLabel: "", linkHref: "", ...over });

// ── Khung đầu trang ──────────────────────────────────────────────────────────────────────────────────────────────

test("chưa có cài đặt nào (hoặc D1 không đọc được): giữ chữ và video có sẵn của V3", () => {
	assert.deepEqual(heroFromSettings({}), DEFAULT_HERO);
	assert.equal(DEFAULT_HERO.videoId, "HE2MnR8Hl5c");
	assert.equal(DEFAULT_HERO.cutIntro, true);
});

test("khung đầu tiên đang bật cho tiêu đề và dòng phụ (viết hoa, như V3 vẫn vẽ)", () => {
	const h = heroFromSettings({ "home.hero": hero([slide({ title: "Về nơi bình yên", subtitle: "Tùng Lâm Hòa Phúc" }), slide({ id: "s2", title: "Khung hai" })]) });
	assert.equal(h.title, "VỀ NƠI BÌNH YÊN");
	assert.equal(h.subtitle, "TÙNG LÂM HÒA PHÚC");
	assert.equal(h.videoId, DEFAULT_HERO_VIDEO_ID, "video không đổi khi admin chưa chọn video");
});

test("khung tắt hoặc sai bị bỏ qua: lấy khung hợp lệ đầu tiên đang bật", () => {
	const h = heroFromSettings({ "home.hero": hero([slide({ enabled: false, title: "Tắt" }), slide({ id: "s2", title: "" }), slide({ id: "s3", title: "Khung ba" })]) });
	assert.equal(h.title, "KHUNG BA");
});

test("không khung nào dùng được (đều tắt, đều sai, không phải mảng): giữ chữ có sẵn", () => {
	for (const raw of [hero([slide({ enabled: false })]), hero([]), hero([{ nonsense: true }]), { slides: "không phải mảng" }, null, 42, "x", []]) {
		const h = heroFromSettings({ "home.hero": raw });
		assert.equal(h.title, DEFAULT_HERO.title);
		assert.equal(h.subtitle, DEFAULT_HERO.subtitle);
	}
});

test("dòng phụ để trống là ý của admin: không vẽ dòng phụ (không lấy lại chữ có sẵn)", () => {
	const h = heroFromSettings({ "home.hero": hero([slide({ subtitle: "" })]) });
	assert.equal(h.subtitle, "");
	assert.equal(h.title, "NƠI ĐỂ TRỞ VỀ");
});

test("video lấy từ khối Lời chào: đủ kiểu địa chỉ YouTube, và video khác thì phát nguyên vẹn (không cắt đoạn)", () => {
	for (const videoUrl of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"]) {
		const h = heroFromSettings({ "home.welcome": welcome({ videoUrl }) });
		assert.equal(h.videoId, "dQw4w9WgXcQ", videoUrl);
		assert.equal(h.cutIntro, false, "đoạn dính người chỉ có ở video mặc định");
	}
});

test("admin chọn lại chính video mặc định: vẫn cắt đoạn dính người", () => {
	const h = heroFromSettings({ "home.welcome": welcome({ videoUrl: `https://youtu.be/${DEFAULT_HERO_VIDEO_ID}` }) });
	assert.equal(h.videoId, DEFAULT_HERO_VIDEO_ID);
	assert.equal(h.cutIntro, true);
});

test("địa chỉ video sai (không phải YouTube, http, javascript:, quá dài, sai kiểu): giữ video có sẵn", () => {
	for (const videoUrl of ["https://vimeo.com/123456", "http://www.youtube.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://evil.example/watch?v=dQw4w9WgXcQ", `https://youtu.be/${"a".repeat(400)}`, 123, null, {}]) {
		const h = heroFromSettings({ "home.welcome": welcome({ videoUrl }) });
		assert.equal(h.videoId, DEFAULT_HERO_VIDEO_ID, String(videoUrl));
		assert.equal(h.cutIntro, true);
	}
	assert.equal(heroFromSettings({ "home.welcome": "không phải đối tượng" }).videoId, DEFAULT_HERO_VIDEO_ID);
});

test("chữ và video đọc độc lập: một khối sai không kéo khối kia về mặc định", () => {
	const h = heroFromSettings({ "home.hero": "hỏng", "home.welcome": welcome({ videoUrl: "https://youtu.be/dQw4w9WgXcQ" }) });
	assert.equal(h.title, DEFAULT_HERO.title);
	assert.equal(h.videoId, "dQw4w9WgXcQ");
	const g = heroFromSettings({ "home.hero": hero([slide({ title: "Khung riêng" })]), "home.welcome": 5 });
	assert.equal(g.title, "KHUNG RIÊNG");
	assert.equal(g.videoId, DEFAULT_HERO_VIDEO_ID);
});

// ── Dấu ấn hoằng pháp ────────────────────────────────────────────────────────────────────────────────────────────

const post = (id: string, section: string, views: number, over: Record<string, unknown> = {}) =>
	({ id, slug: `bai-${id}`, title: `Bài ${id}`, subtitle: "", mainCategory: section, subCategory: "chuyen-muc", categoryName: "Chuyên mục", publishedDate: "2026-11-03", viewsCount: views, thumbnailUrl: `/anh-goc/${id}.webp`, bannerUrl: "", thumbnailPosition: "center 40%", bannerPosition: "center 50%", summary: `Tóm tắt ${id}`, ...over }) as unknown as V3Post;
const article = (id: number, views: number) => ({ id, slug: `tc-${id}`, title: `Tông chỉ ${id}`, subtitle: "", categoryName: "Nền tảng", bannerImage: "", bannerPosition: "center 20%", excerpt: "", publishedAt: "2026-05-01", viewsCount: views }) as unknown as V3TongChi;

test("các thẻ xếp theo lượt xem thật, gộp cả ba nguồn, số lượt là số của D1 (không phải số cố định trong mã)", () => {
	const data = buildDharmaFeatured([post("a", "dong-chay-hoang-phap", 120), post("b", "tri-tue-phat-phap", 900), post("c", "dong-chay-hoang-phap", 5)], [article(1, 300), article(2, 0)]);
	assert.deepEqual(data.featured.map((p) => [p.id, p.viewsCount]), [["b", 900], ["tc-1", 300], ["a", 120], ["c", 5], ["tc-2", 0]]);
	assert.equal(data.dongChay[0].targetUrl, "/dong-chay-hoang-phap/bai-a");
	assert.equal(data.triTue[0].targetUrl, "/tri-tue-phat-phap/bai-b");
	assert.equal(data.tongChi[0].targetUrl, "/tong-chi-tu-hoc/tc-1");
	assert.equal(data.dongChay[0].publishedDate, "03/11/2026");
	for (const p of data.featured) assert.equal(typeof p.viewsCount, "number");
});

test("trang chủ lấy năm thẻ đầu; chưa có bài nào (hoặc D1 hỏng) thì null để khối giữ bộ thẻ dự phòng", () => {
	const many = Array.from({ length: 9 }, (_, i) => post(`p${i}`, "dong-chay-hoang-phap", 100 - i));
	const tiles = dharmaTilesFrom(buildDharmaFeatured(many, []));
	assert.deepEqual(tiles?.map((p) => p.id), ["p0", "p1", "p2", "p3", "p4"]);
	assert.equal(dharmaTilesFrom(buildDharmaFeatured([], [])), null);
	assert.equal(dharmaTilesFrom(null), null);
});

test("bài ở chuyên trang khác không lên Dấu ấn; bài trong danh sách đã xóa thì bỏ", () => {
	const data = buildDharmaFeatured([post("a", "dong-chay-hoang-phap", 10), post("x", "khac", 9999), post("d", "tri-tue-phat-phap", 500)], [], [{ id: "d" }]);
	assert.deepEqual(data.featured.map((p) => p.id), ["a"]);
});

test("thiếu ảnh thì dùng ảnh mặc định của chuyên trang; ngày ở dạng lạ giữ nguyên", () => {
	const data = buildDharmaFeatured([post("a", "dong-chay-hoang-phap", 1, { thumbnailUrl: "", bannerUrl: "" })], []);
	assert.match(data.dongChay[0].imageUrl, /^https:\/\/media-tunglamhoaphuc\./);
	assert.equal(formatDate("03/11/2026"), "03/11/2026");
	assert.equal(formatDate("2026/1/5 10:00"), "05/01/2026");
	assert.equal(formatDate("tuần trước"), "tuần trước");
	assert.equal(formatDate(undefined), "");
});

test("bài có chữ 'Pháp âm' dùng biểu tượng Pháp âm", () => {
	const data = buildDharmaFeatured([post("a", "tri-tue-phat-phap", 1, { categoryName: "Pháp Âm" }), post("b", "tri-tue-phat-phap", 2)], []);
	assert.equal(data.triTue.find((p) => p.id === "a")?.category1IconUrl, "/images/icons/icon-phap-am.webp");
	assert.equal(data.triTue.find((p) => p.id === "b")?.category1IconUrl, "/images/icons/icon-tri-tue-phat-phap.webp");
});
