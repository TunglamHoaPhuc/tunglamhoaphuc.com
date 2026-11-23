// Dựng, bằng CHÍNH mã admin của www, một tệp SQLite đã migrate rồi để admin ghi bài viết theo từng tình huống thật (tạo, xuất bản, tạm ẩn,
// hẹn giờ, thùng rác, khôi phục, đổi slug, đổi chuyên mục, trường riêng của Pháp Âm / Video / Ấn phẩm). Kiểm thử
// tests/unit/v3-www-admin-roundtrip.test.ts chạy tệp này rồi đọc kết quả bằng lớp đọc của V3.
//
// Vì sao tách ra một tiến trình riêng: mã admin của www là TypeScript dùng cú pháp mà `node --test` của V3 không nạp được (tham số khai báo
// trong constructor, đường dẫn `@/…` của www), còn công cụ của www (tsx, đọc tsconfig của www) nạp được đúng như vitest của www vẫn làm.
// Không import gì của V3 ở đây, không chạm Cloudflare nào: mọi thứ nằm trong bộ nhớ, rồi một tệp tạm do kiểm thử chỉ định.
//
// Dùng:  (cwd = thư mục gốc www, vì migration đọc từ ./migrations)
//   TSX_TSCONFIG_PATH=<www>/tsconfig.json node <www>/node_modules/tsx/dist/cli.mjs <tệp này> <www> <ra.sqlite> <ra.json>
// Tệp .json là "ý định" của admin: mỗi tình huống có id, slug, chuyên mục và điều admin muốn (hiện / không hiện), lấy từ
// chính phản hồi của admin, không phải từ V3.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [, , WWW, OUT_DB, OUT_JSON] = process.argv;
if (!WWW || !OUT_DB || !OUT_JSON) throw new Error("thiếu tham số: <www> <ra.sqlite> <ra.json>");
process.chdir(WWW);
const load = (rel) => import(pathToFileURL(`${WWW}/${rel}`).href);

const { contentWorld } = await load("tests/unit/helpers/contentWorld.ts");

const DC = "dong-chay-hoang-phap";
const TT = "tri-tue-phat-phap";
const CAT_DC = `post:${DC}:cong-tu`;
const CAT_AM = `post:${TT}:phap-am`;
const CAT_VIDEO = `post:${TT}:video`;
const CAT_SACH = `post:${TT}:an-pham-sach`;
const CAT_BV = `post:${TT}:bai-viet`;
const DAY = 86_400_000;

const w = await contentWorld();
const root = await w.as("root@example.test");

// Âm thanh phải có trong thư viện ảnh (media) thì admin mới nhận audioMediaId; chèn thẳng một dòng như thư viện sẽ ghi.
w.raw.prepare("INSERT INTO media (id, r2_key, filename, mime, alt, created_at, version) VALUES ('media-audio', 'cms/media-audio/v1/phap-am.mp3', 'phap-am.mp3', 'audio/mpeg', '', '2026', 1)").run();

const ok = (res, what) => {
	if (res.status >= 300) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.json)}`);
	return res;
};
const create = async (body) => ok(await root.call("POST", "posts", body), `tạo ${body.title}`).data;
const save = async (post, patch) => ok(await root.call("PATCH", `posts/${post.id}`, { version: post.version, ...patch }), `sửa ${post.id}`).data;
const act = async (post, action, body = {}) => ok(await root.call("POST", `posts/${post.id}/${action}`, body), `${action} ${post.id}`).data;

/** Điều admin muốn cho từng tình huống: `live` là trạng thái ai cũng thấy được trên trang công khai theo phản hồi của admin. */
const scenarios = {};
const note = (name, post, extra = {}) => {
	scenarios[name] = { id: post.id, slug: post.slug, section: post.section, title: post.title, status: post.status, ...extra };
};

// 1. Bài đã xuất bản, có đủ chữ và ảnh; sau đó sửa lần nữa (phiên bản 2 -> 3) để V3 phải thấy bản mới nhất.
{
	let p = await create({ title: "Lễ Vu Lan báo hiếu 2026", section: DC, categoryId: CAT_DC, subtitle: "Ngày rằm tháng bảy", author: "Ban truyền thông", summary: "Tóm tắt lễ Vu Lan", thumbnailMediaId: "media-a", bannerMediaId: "media-b", keywords: [{ keyword: "Vu Lan", title: "Vu Lan", description: "Lễ báo hiếu cha mẹ" }], contentHtml: "<p>Nội dung ban đầu</p>" });
	p = await act(p, "publish");
	p = await save(p, { title: "Lễ Vu Lan báo hiếu 2026 (đã sửa)", contentHtml: '<p onclick="x()">Nội dung <strong>mới</strong></p><script>alert(1)</script>' });
	note("published-edited", p, { live: true });
}

// 2. Bài ghim: phải đứng đầu danh sách dù ngày cũ hơn.
{
	let p = await create({ title: "Thông báo ghim", section: DC, categoryId: CAT_DC, pinned: true, publishedDate: "2020-01-01" });
	p = await act(p, "publish");
	note("pinned", p, { live: true });
}

// 3. Bản nháp: chưa ai thấy.
note("draft", await create({ title: "Bản nháp chưa đăng", section: DC, categoryId: CAT_DC }), { live: false });

// 4. Đã xuất bản rồi tạm ẩn.
{
	let p = await create({ title: "Bài đã tạm ẩn", section: DC, categoryId: CAT_DC });
	p = await act(p, "publish");
	p = await act(p, "hide");
	note("hidden", p, { live: false });
}

// 5. Hẹn giờ chưa tới.
{
	let p = await create({ title: "Bài hẹn giờ chưa tới", section: DC, categoryId: CAT_DC });
	p = await act(p, "publish", { publishAt: new Date(Date.now() + 3 * DAY).toISOString() });
	note("scheduled-future", p, { live: false });
}

// 6. Hẹn giờ ĐÃ tới: admin không cho hẹn vào quá khứ, nên đẩy đồng hồ bằng cách lùi publish_at (đúng như thời gian trôi qua).
{
	let p = await create({ title: "Bài hẹn giờ đã tới", section: DC, categoryId: CAT_DC });
	p = await act(p, "publish", { publishAt: new Date(Date.now() + 3 * DAY).toISOString() });
	w.raw.prepare("UPDATE post SET publish_at = ? WHERE id = ?").run(new Date(Date.now() - 60_000).toISOString(), p.id);
	note("scheduled-due", p, { live: true, adminStatusBeforeClock: p.status });
}

// 7. Vào thùng rác (đã xuất bản trước đó).
{
	let p = await create({ title: "Bài đã vào thùng rác", section: DC, categoryId: CAT_DC });
	p = await act(p, "publish");
	ok(await root.call("DELETE", `posts/${p.id}`), `xóa ${p.id}`);
	note("trashed", p, { live: false });
}

// 8. Vào thùng rác rồi khôi phục: hiện lại.
{
	let p = await create({ title: "Bài khôi phục từ thùng rác", section: DC, categoryId: CAT_DC });
	p = await act(p, "publish");
	ok(await root.call("DELETE", `posts/${p.id}`), `xóa ${p.id}`);
	ok(await root.call("POST", `trash/post/${p.id}/restore`, {}), `khôi phục ${p.id}`);
	note("restored", p, { live: true });
}

// 9. Tạm ẩn rồi xuất bản lại: hiện lại.
{
	let p = await create({ title: "Bài ẩn rồi đăng lại", section: DC, categoryId: CAT_DC });
	p = await act(p, "publish");
	p = await act(p, "hide");
	p = await act(p, "publish");
	note("republished", p, { live: true });
}

// 10. Đổi slug khi đang hiển thị: địa chỉ cũ phải chuyển về địa chỉ mới.
{
	let p = await create({ title: "Bài đổi đường dẫn", section: DC, categoryId: CAT_DC });
	p = await act(p, "publish");
	const oldSlug = p.slug;
	p = await save(p, { slug: "duong-dan-moi-cua-bai" });
	note("renamed", p, { live: true, oldSlug });
}

// 11. Đổi chuyên trang (và chuyên mục) khi đang hiển thị.
{
	let p = await create({ title: "Bài chuyển chuyên trang", section: DC, categoryId: CAT_DC });
	p = await act(p, "publish");
	const oldSection = p.section;
	p = await save(p, { section: TT, categoryId: CAT_BV });
	note("moved-section", p, { live: true, oldSection });
}

// 12. Trường riêng của từng chuyên mục: Pháp Âm (âm thanh), Video Phật Pháp (YouTube), Ấn phẩm & Sách (sách).
{
	let p = await create({ title: "Pháp âm buổi sáng", section: TT, categoryId: CAT_AM, extra: { audioMediaId: "media-audio", duration: "12:34" } });
	p = await act(p, "publish");
	note("phap-am", p, { live: true, expect: { audioKey: "cms/media-audio/v1/phap-am.mp3", duration: "12:34" } });

	p = await create({ title: "Video khai thị", section: TT, categoryId: CAT_VIDEO, extra: { youtubeId: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } });
	p = await act(p, "publish");
	note("video", p, { live: true, expect: { youtubeId: "dQw4w9WgXcQ" } });

	p = await create({ title: "Cuốn sách mới", section: TT, categoryId: CAT_SACH, extra: { book: { title: "Kinh Pháp Cú", author: "Thích Nhất Hạnh", coverMediaId: "media-b", link: "https://example.test/mua" } } });
	p = await act(p, "publish");
	note("an-pham-sach", p, { live: true, expect: { title: "Kinh Pháp Cú", author: "Thích Nhất Hạnh", coverKey: "cms/media-b/v1/chua.webp", link: "https://example.test/mua" } });
}

// Bài nhập từ web cũ (post-1060, do contentWorld dựng) vẫn đang hiển thị: V3 phải liệt kê nó cùng các bài trên.
scenarios["imported"] = { id: "post-1060", slug: "le-vu-lan", section: DC, title: "Lễ Vu Lan báo hiếu", live: true };

// Ghi ra: một bản SQLite sao chép nguyên vẹn (VACUUM INTO không đổi nội dung) và bản ý định của admin.
w.raw.exec(`VACUUM INTO '${OUT_DB.replace(/\\/g, "/").replace(/'/g, "''")}'`);
writeFileSync(OUT_JSON, JSON.stringify(scenarios, null, 2));
console.log(`đã dựng ${Object.keys(scenarios).length} tình huống`);
