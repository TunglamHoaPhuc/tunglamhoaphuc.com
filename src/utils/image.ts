import { IMAGE_DELIVERY, imageAt, mediaUrl, type ImageDelivery } from '@/lib/tlhp-content/media';

// Mọi ảnh của site nằm trên Cloudflare: tệp tĩnh trong public/ (/images, /brand) và ảnh trong R2 qua /anh-goc/<bucket>/<khóa>.
// Không còn địa chỉ B2 hay WordPress nào ở đây (kiểm kê ảnh 23/11/2026).
const WORDPRESS_BASE = '/anh-goc/wordpress';
export const PLACEHOLDER_IMAGE = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp';

/**
 * Chuẩn hóa đường dẫn hình ảnh cho toàn bộ hệ thống, luôn ra một địa chỉ trên chính site này:
 * 1. Rỗng/null/undefined -> trả về `fallbackUrl` (hoặc chuỗi rỗng).
 * 2. data:, blob: -> giữ nguyên.
 * 3. Địa chỉ B2 hay WordPress cũ (http/https) -> /anh-goc/<bucket>/<khóa> (mediaUrl); host lạ khác giữ nguyên.
 * 4. /anh-goc/..., /cdn-cgi/image/... và mọi đường dẫn bắt đầu bằng "/" -> giữ nguyên (ảnh tĩnh của site, hoặc ảnh R2).
 * 5. Tên tệp rời ("tung-kinh.jpg") -> /anh-goc/wordpress/<tên> (kho WordPress cũ đã chép vào R2).
 * 6. Đường dẫn cũ /images/tong-chi/<tệp> -> /anh-goc/wordpress/<tệp>.
 */
export function getImageUrl(path?: string | null, fallbackUrl: string = ''): string {
  if (!path || typeof path !== 'string') {
    return fallbackUrl || '';
  }

  const trimmed = path.trim();
  if (!trimmed) {
    return fallbackUrl || '';
  }

  // Tự động chuẩn hóa các đường dẫn cũ chứa /images/tong-chi/ về kho upload WordPress (nay ở R2)
  if (trimmed.includes('/images/tong-chi/')) {
    const filename = trimmed.split('/').pop() || '';
    if (filename) {
      return `${WORDPRESS_BASE}/${filename}`;
    }
  }

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Ảnh qua /anh-goc/ hay đã thu nhỏ (/cdn-cgi/image/) nằm trên chính site này
  if (trimmed.startsWith('/anh-goc/') || trimmed.startsWith('/cdn-cgi/image/')) {
    return trimmed;
  }

  // Địa chỉ tuyệt đối: B2 và WordPress của web cũ đổi sang /anh-goc/, host khác giữ nguyên (nâng lên https)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return mediaUrl(trimmed) ?? trimmed;
  }

  // Đường dẫn của chính site (/images/..., /brand/...)
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Tên tệp rời (ví dụ: "tung-kinh.jpg", "1.jpg"): tải lên WordPress cũ, nay ở R2
  if (!trimmed.includes('/')) {
    return `${WORDPRESS_BASE}/${trimmed}`;
  }

  return `/${trimmed}`;
}

/**
 * Trước đây đoán bản gốc độ phân giải cao của ảnh WordPress bằng cách bỏ hậu tố kích thước (-512x341). R2 chỉ giữ đúng những tệp
 * mà trang nhắc tới, không giữ "bản gốc đoán", nên không còn đoán: trả về đúng địa chỉ đã chuẩn hóa.
 */
export function getHighResImageUrl(url?: string | null, fallbackUrl: string = ''): string {
  return getImageUrl(url, fallbackUrl) || fallbackUrl || '';
}

/**
 * Ảnh thu nhỏ theo bề rộng (width) qua image transformations của Cloudflare trên zone này (AVIF/WebP, chất lượng 75),
 * nguồn là ảnh /anh-goc/ của chính site. Ảnh tĩnh của site giữ nguyên. `_quality` giữ lại cho nơi gọi cũ; chất lượng cố định 75.
 */
export function getOptimizedNextImageUrl(
  url?: string | null,
  width: number = 1080,
  _quality: number = 75
): string {
  const highRes = getHighResImageUrl(url);
  if (!highRes) return '';
  return fitImage(highRes, width);
}

const WWW_ANH_GOC = 'https://www.tunglamhoaphuc.com/anh-goc/';

/**
 * Ảnh thu nhỏ theo bề rộng hiển thị. Cách giao theo công tắc IMAGE_DELIVERY của media.ts:
 *  - 'cgi' (mặc định): image transformations của Cloudflare trên zone này (AVIF/WebP, chất lượng 75), /cdn-cgi/image/width=…/anh-goc/…;
 *  - 'variants': biến thể dựng sẵn trong R2, /anh-goc/<bucket>/<khóa>@<bậc chiều rộng> (route chọn AVIF/WebP theo Accept).
 * Ảnh gốc trên B2 / WordPress / kho R2 của www đi qua /anh-goc/ của v3. Ảnh khác (đường dẫn tĩnh /images, host lạ) giữ nguyên.
 * `delivery` chỉ để kiểm thử hai chế độ; nơi gọi không truyền.
 */
export function fitImage(url: string | null | undefined, width: number, delivery: ImageDelivery = IMAGE_DELIVERY): string {
  if (!url) return '';
  let src = url.trim();
  if (src.startsWith(WWW_ANH_GOC)) src = src.slice('https://www.tunglamhoaphuc.com'.length);
  if (!src.startsWith('/anh-goc/')) {
    if (src.startsWith('/')) return src;
    const local = mediaUrl(src);
    if (!local || !local.startsWith('/anh-goc/')) return src;
    src = local;
  }
  return imageAt(src, width, delivery);
}
