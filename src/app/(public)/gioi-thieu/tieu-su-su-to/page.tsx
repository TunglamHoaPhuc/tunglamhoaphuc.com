// Địa chỉ cũ của chủ đề "tieu-su-su-to": chỉ giữ tiêu đề trang, phần còn lại đọc D1 theo slug như mọi chủ đề (AboutTopicPage).
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';
import { AboutTopicPage } from '../AboutTopicPage';

export const metadata: Metadata = pageMetadata({
  title: "Tiểu Sử Hòa Thượng Ngộ Chân Tử - Sư Tổ Khai Sơn Tông Phong Hoằng Pháp | Tùng Lâm Hòa Phúc",
  description: "Tóm tắt tiểu sử Cố Lão Hòa Thượng Ngộ Chân Tử, Sư tổ khai sơn Tông phong Hoằng Pháp, cuộc đời tu tập và đạo nghiệp cứu khổ nhân sinh.",
  path: '/gioi-thieu/tieu-su-su-to',
});

export const revalidate = 60;

export default function TieuSuSuToPage() {
  return <AboutTopicPage slug="tieu-su-su-to" />;
}
