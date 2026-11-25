// Địa chỉ cũ của chủ đề "su-ong-hoang-phap": chỉ giữ tiêu đề trang, phần còn lại đọc D1 theo slug như mọi chủ đề (AboutTopicPage).
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';
import { AboutTopicPage } from '../AboutTopicPage';

export const metadata: Metadata = pageMetadata({
  title: "Đôi Nét Về Đại Sư Thanh Lương - Đạo Trưởng Tông Phong Tổ Đình Hoằng Pháp | Tùng Lâm Hòa Phúc",
  description: "Đôi nét về Đại Sư Thanh Lương (Hòa thượng Thích Chân Tính), Đạo trưởng Tông phong Tổ đình Hoằng Pháp, người chấn hưng Tịnh Độ và truyền thông Phật giáo.",
  path: '/gioi-thieu/su-ong-hoang-phap',
});

export const revalidate = 60;

export default function SuOngHoangPhapPage() {
  return <AboutTopicPage slug="su-ong-hoang-phap" />;
}
