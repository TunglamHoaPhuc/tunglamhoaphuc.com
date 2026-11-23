// Địa chỉ cũ của chủ đề "lich-su-tung-lam-hoa-phuc": chỉ giữ tiêu đề trang, phần còn lại đọc D1 theo slug như mọi chủ đề (AboutTopicPage).
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';
import { AboutTopicPage } from '../AboutTopicPage';

export const metadata: Metadata = pageMetadata({
  title: "Lịch Sử Tùng Lâm Hòa Phúc - Cổ Tự Trùng Tu & Hoằng Dương Chánh Pháp",
  description: "Tìm hiểu nguồn gốc hình thành, các giai đoạn trùng tu và phát triển của Tùng Lâm Hòa Phúc (Hà Nội).",
  path: '/gioi-thieu/lich-su-tung-lam-hoa-phuc',
});

export const revalidate = 60;

export default function LichSuTungLamHoaPhucPage() {
  return <AboutTopicPage slug="lich-su-tung-lam-hoa-phuc" />;
}
