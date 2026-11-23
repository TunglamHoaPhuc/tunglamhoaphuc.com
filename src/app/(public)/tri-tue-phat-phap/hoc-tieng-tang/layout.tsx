// Metadata của trang Học Tiếng Tạng. Trang (page.tsx) là thành phần chạy ở trình duyệt nên không xuất được metadata; layout này
// là thành phần máy chủ chỉ để mang tiêu đề, mô tả, canonical và ảnh chia sẻ, rồi trả nguyên nội dung.
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';

export const metadata: Metadata = pageMetadata({
  title: 'Học Tiếng Tạng (Sara Book)',
  description:
    'Học nghiên cứu tiếng Tạng qua bộ giáo trình Sara Book — công cụ học thuật quan trọng dành cho những ai muốn thâm nhập kho tàng triết học Phật giáo Tây Tạng nguyên bản.',
  path: '/tri-tue-phat-phap/hoc-tieng-tang',
});

export default function HocTiengTangLayout({ children }: { children: React.ReactNode }) {
  return children;
}
