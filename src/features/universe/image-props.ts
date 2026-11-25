// Ảnh của Bảo tượng và Vũ Trụ Phật Giáo giao đúng cỡ (tối ưu ảnh 23/11/2026, docs/toi-uu-anh-23-11-2026.md mục 4).
// Mọi thẻ <img> trong features/statues, features/universe và hai trang danh sách đi qua fitProps() hay fitImage():
// địa chỉ ảnh /anh-goc/ thành biến thể dựng sẵn ở bậc chuẩn (160/360/640/960/1280/1920), kèm srcSet khi khung đổi cỡ theo màn hình.
// Ảnh gốc chỉ còn ở lightbox/phóng to (bậc 1920 hay "@max") và ảnh tĩnh của site (/images, /brand).
import { imageSrcSet } from '@/lib/tlhp-content/media';
import { fitImage } from '@/utils/image';

export type FitOptions = {
  /** Bề rộng (px) của địa chỉ `src` mặc định: khung hiển thị x 2 (DPR tối đa 2), làm tròn lên bậc chuẩn. */
  width: number;
  /** Các bậc đưa vào srcSet; bỏ qua thì chỉ có `src` (ảnh nhỏ, kích thước cố định như avatar, icon). */
  widths?: readonly number[];
  /** Bề rộng khung theo màn hình, chỉ đi kèm srcSet. */
  sizes?: string;
};

/** Thuộc tính `src`, `srcSet`, `sizes` của một ảnh /anh-goc/. Ảnh không có biến thể (gif, svg, ảnh tĩnh) chỉ có `src` như cũ. */
export function fitProps(src: string | null | undefined, { width, widths, sizes }: FitOptions): { src: string; srcSet?: string; sizes?: string } {
  const url = fitImage(src, width);
  const srcSet = widths && src ? imageSrcSet(src, widths) : undefined;
  return srcSet ? { src: url, srcSet, sizes } : { src: url };
}

/**
 * Khi ảnh lỗi: thay bằng ảnh dự phòng. Gỡ cả srcSet, vì trình duyệt ưu tiên srcSet hơn src và nếu không gỡ thì ảnh dự phòng
 * không bao giờ hiện. Ảnh dự phòng không đổi lần nữa nếu nó cũng lỗi.
 */
export function swapOnError(fallback: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const img = e.currentTarget;
    if (img.dataset.fallback === '1') return;
    img.dataset.fallback = '1';
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.src = fallback;
  };
}

/** Biểu tượng tượng pháp và logo tròn của chùa: icon 14 đến 64 px ở nhiều chỗ, bậc 160 (bản gốc 82 KB, bậc 160 khoảng 3 KB). */
export const STATUE_ICON = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/09-icon-minh-hoa/bieu-tuong-tuong-phap.webp';
export const LOGO_ROUND = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/09-icon-minh-hoa/logo-tung-lam-hoa-phuc-tron.webp';
export const STATUE_ICON_SRC = fitImage(STATUE_ICON, 160);
export const LOGO_ROUND_SRC = fitImage(LOGO_ROUND, 160);

/** Các bậc cho thẻ trong lưới (khung 160 đến 400 px, DPR 2): 360 / 640 / 960. */
export const CARD_WIDTHS = [360, 640, 960] as const;
/** Ảnh trong cửa sổ chi tiết (khung khoảng 300 đến 400 px, không phóng to): 640 / 960. */
export const MODAL_FIT: FitOptions = { width: 960, widths: [640, 960], sizes: '(min-width: 768px) 360px, 90vw' };

/** Toàn cảnh chùa: ảnh nền mờ (opacity 12 đến 20%, có phủ gradient) của nhiều khối, rộng theo khung chứa tối đa 1280 px. */
export const TOAN_CANH = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/toan-canh-chua.webp';
export const TOAN_CANH_BACKDROP = fitProps(TOAN_CANH, { width: 1280, widths: [640, 960, 1280], sizes: '100vw' });
export const TOAN_CANH_SRC = fitImage(TOAN_CANH, 960);

/** Ô của lưới bento (4 cột ở màn hình rộng, 2 cột ở màn hình vừa): bậc ảnh theo số cột ô chiếm. */
export function bentoFit(span: string): FitOptions {
  if (span.includes('lg:col-span-4')) return { width: 1920, widths: [640, 960, 1280, 1920], sizes: '(min-width: 1024px) 1216px, calc(100vw - 32px)' };
  if (span.includes('sm:col-span-2')) return { width: 1280, widths: [640, 960, 1280], sizes: '(min-width: 1024px) 600px, calc(100vw - 32px)' };
  return { width: 960, widths: CARD_WIDTHS, sizes: '(min-width: 1024px) 290px, (min-width: 640px) 46vw, calc(100vw - 32px)' };
}
/** Biểu tượng tượng pháp ở tiêu đề khối (khung 56 đến 80 px, phóng 1,25 đến 1,35 lần): bậc 360. */
export const STATUE_ICON_LARGE_SRC = fitImage(STATUE_ICON, 360);
