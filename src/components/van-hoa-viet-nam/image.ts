import { IMAGE_WIDTH, imageAt, imageSrcSet, mediaUrl } from '@/lib/tlhp-content/media';

// Ảnh của triển lãm nằm ở kho B2 `media-tunglamhoaphuc`; web này đọc qua /anh-goc/ và để Cloudflare
// co ảnh về đúng cỡ (imageAt), không bao giờ gửi ảnh gốc nặng cho trình duyệt.

export type VhImage = { src: string; srcSet?: string };

/** Địa chỉ ảnh qua kho của web và các cỡ srcset (mặc định 640 / 1280 / 1920). */
export function vhImage(url: string, widths: readonly number[] = [IMAGE_WIDTH.card, IMAGE_WIDTH.wide, IMAGE_WIDTH.full]): VhImage {
  const source = mediaUrl(url) ?? url;
  return { src: imageAt(source, widths[Math.min(1, widths.length - 1)]), srcSet: imageSrcSet(source, widths) };
}

/** Ảnh dùng cho thẻ xem trước khi chia sẻ (rộng 1200). */
export function vhShareImage(url: string): string {
  const source = mediaUrl(url) ?? url;
  return imageAt(source, 1200);
}

const px = (value: number) => Number(value.toFixed(4));

/**
 * Cỡ ảnh hiển thị (thuộc tính sizes) của một khung hình toàn màn hình, theo đúng bố cục trong
 * van-hoa-story.css: khung giữ nguyên tỷ lệ ảnh (không cắt), nên bề rộng thật là cái nhỏ hơn
 * của bề rộng chỗ chứa và (chiều cao chỗ chứa × tỷ lệ).
 */
export function stageSizes(width: number, height: number, layout: 'portrait' | 'landscape-full' | 'landscape-side'): string {
  const r = px(width / height);
  if (layout === 'portrait') {
    return `(min-width: 1024px) min(54vw, calc((100vh - 32px) * ${r})), min(100vw, calc((100vh - 150px) * ${r}))`;
  }
  if (layout === 'landscape-side') {
    return `(min-width: 1024px) min(54vw, calc((100vh - 32px) * ${r})), min(calc(100vw - 16px), calc(38vh * ${r}))`;
  }
  return `(min-width: 1024px) min(calc(100vw - 24px), calc((100vh - 24px) * ${r})), min(calc(100vw - 16px), calc(38vh * ${r}))`;
}

/** Cỡ hiển thị ảnh nền của thẻ mở chương. */
export function introSizes(width: number, height: number): string {
  const r = px(width / height);
  return `min(calc(100vw - 2rem), calc((100vh - 2rem) * ${r}))`;
}
