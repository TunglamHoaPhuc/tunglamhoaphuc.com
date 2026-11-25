// Logic thuần của slide poster ở cột trái "Lịch tu học" (CalendarSection): dựng danh sách trang, chỉ số trang, thử lại ảnh lỗi.
// Tách khỏi component để kiểm thử bằng node:test, không phụ thuộc React.

export interface QuoteItem {
  id: string;
  url: string;
  title?: string;
}

export type SlideItem = { type: 'theme' } | { type: 'quote'; quote: QuoteItem };

/** Khóa nhận diện một ảnh: bỏ tên miền, query, hash, hậu tố cỡ ảnh "@960" và đuôi tệp, không phân biệt hoa thường.
 *  Nhờ vậy `/a/b.png` có tên miền, `/a/b.webp` và `/a/b.webp@640` là cùng một ảnh. */
export function quoteImageKey(url: string | null | undefined): string {
  if (!url) return '';
  let s = url.trim();
  s = s.replace(/^https?:\/\/[^/]+/i, '');
  s = s.split('#')[0].split('?')[0];
  s = s.replace(/@\d+$/, '');
  s = s.replace(/\.(png|jpe?g|webp|avif|gif)$/i, '');
  return s.toLowerCase();
}

/** Tên ảnh bỏ thư mục và tiền tố "thang-NN-": hai tháng dùng cùng một câu (vd thang-08-ve-ben-thay và thang-11-ve-ben-thay) là cùng một
 *  bức ảnh (đã đối chiếu byte trên dữ liệu thật), nên chỉ lấy một trang. Rỗng nếu tên chỉ có tiền tố tháng. */
export function quoteImageSlug(url: string | null | undefined): string {
  const base = quoteImageKey(url).split('/').pop() ?? '';
  return base.replace(/^thang-[0-9]+-?/, '');
}

/** Dựng danh sách ảnh quote cho slide: bỏ mục không có ảnh, trùng id, trùng ảnh (cùng khóa hoặc cùng tên sau tiền tố tháng), ảnh đã báo lỗi; đưa ảnh của tháng đang xem lên đầu. */
export function buildQuoteList(
  gallery: ReadonlyArray<QuoteItem>,
  opts: { currentMonth: number; currentQuoteUrl?: string; failedKeys?: ReadonlySet<string> },
): QuoteItem[] {
  const failed = opts.failedKeys ?? new Set<string>();
  // Ảnh của tháng đang xem đứng đầu và được xét trước, để khi hai ảnh trùng thì giữ ảnh của tháng này.
  // Khớp theo ảnh của chủ đề tháng trước; không có thì theo id "quote-<tháng>".
  const valid = gallery.filter((q) => q && quoteImageKey(q.url) && !failed.has(quoteImageKey(q.url)));
  const curKey = quoteImageKey(opts.currentQuoteUrl);
  let cur = curKey ? valid.findIndex((q) => quoteImageKey(q.url) === curKey) : -1;
  if (cur < 0) cur = valid.findIndex((q) => q.id === `quote-${opts.currentMonth + 1}`);
  const ordered = cur > 0 ? [valid[cur], ...valid.slice(0, cur), ...valid.slice(cur + 1)] : valid;

  const seenId = new Set<string>();
  const seenKey = new Set<string>();
  const seenSlug = new Set<string>();
  const list: QuoteItem[] = [];
  for (const q of ordered) {
    const key = quoteImageKey(q.url);
    const slug = quoteImageSlug(q.url);
    if ((q.id && seenId.has(q.id)) || seenKey.has(key) || (slug && seenSlug.has(slug))) continue;
    if (q.id) seenId.add(q.id);
    seenKey.add(key);
    if (slug) seenSlug.add(slug);
    list.push(q);
  }
  return list;
}

/** Trang 0 là chủ đề tháng, các trang sau là ảnh quote. */
export function buildSlides(quotes: ReadonlyArray<QuoteItem>): SlideItem[] {
  return [{ type: 'theme' }, ...quotes.map((quote): SlideItem => ({ type: 'quote', quote }))];
}

/** Khóa React/điều hướng duy nhất của một trang. */
export function slideKey(slide: SlideItem): string {
  return slide.type === 'theme' ? 'theme' : `quote:${quoteImageKey(slide.quote.url)}`;
}

/** Đưa chỉ số về trong [0, total). total <= 0 cho 0. */
export function clampSlide(index: number, total: number): number {
  if (total <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), total - 1);
}

export function nextSlideIndex(index: number, total: number): number {
  if (total <= 1) return 0;
  return (clampSlide(index, total) + 1) % total;
}

export function prevSlideIndex(index: number, total: number): number {
  if (total <= 1) return 0;
  const i = clampSlide(index, total);
  return i > 0 ? i - 1 : total - 1;
}

/** Ảnh lỗi lần đầu: thử bản .webp cùng tên (D1 có thể còn ghi .png/.jpg trong khi tệp đã đổi sang .webp). Không có bản thay thì trả null. */
export function webpRetryUrl(url: string): string | null {
  if (!/\.(png|jpe?g)(\?.*)?$/i.test(url)) return null;
  return url.replace(/\.(png|jpe?g)(\?.*)?$/i, '.webp');
}

/** Vuốt ngang trên điện thoại: >0 là sang trang sau, <0 về trang trước, 0 là không tính (vuốt ngắn hoặc chủ yếu theo chiều dọc). */
export function swipeDirection(dx: number, dy: number, threshold = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}
