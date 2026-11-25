// Một bài, một địa chỉ. Trang chi tiết bài còn mở được bằng mã cũ của bài ("17649" hay "post-17649", xem `livePost` ở
// src/lib/v3-live.ts), trong khi địa chỉ thật của bài là slug ("17649-2").
//
// Bằng chứng để chọn 301 chứ không phải 404 như www (đối chiếu 23/11/2026, docs/doi-chieu-url-www-v3.md D7):
//  - Cả 18 bài đó có slug dạng "<mã>-2" ngay trong dữ liệu WordPress đã nhập (data/snapshot/posts.json: id "post-17649", slug
//    "17649-2"), nên địa chỉ "/17649" CHƯA TỪNG là địa chỉ công khai của bài: Google không có gì để giữ lại, và www trả 404.
//  - Nhưng V3 vẫn trả 200 ở "/17649" (V3 có lúc liên kết bằng mã), nên một bài có hai địa chỉ cùng 200: trùng nội dung.
//  - 301 về địa chỉ bằng slug gộp hai địa chỉ làm một, giữ nguyên các liên kết nội bộ theo mã đã có, và không tốn gì. 404 sẽ làm
//    hỏng liên kết theo mã (nếu còn) mà không được gì thêm.
// Chỉ mã số thuần ("17649", "post-17649") mới chuyển; slug thường (kể cả slug có dấu hay biểu tượng) thì không đụng tới.

/** Mã cũ của một bài: số thuần, có hay không tiền tố "post-". */
const LEGACY_ID = /^(post-)?\d+$/i;
/** Slug an toàn để ghép vào địa chỉ mà không cần mã hóa. */
const PLAIN_SLUG = /^[a-z0-9-]+$/i;

/**
 * Địa chỉ chuẩn mà trang phải chuyển hướng (301) tới, hoặc `null` khi không phải chuyển.
 * `requested` là đoạn cuối của địa chỉ đang mở, `slug` là slug thật của bài tìm được, `sectionPath` là "/dong-chay-hoang-phap".
 */
export function legacyIdTarget(requested: string, slug: string, sectionPath: string): string | null {
	let key = requested;
	try {
		key = decodeURIComponent(requested);
	} catch {
		// giữ nguyên
	}
	if (!LEGACY_ID.test(key) || key === slug || !PLAIN_SLUG.test(slug)) return null;
	return `${sectionPath}/${slug}`;
}
