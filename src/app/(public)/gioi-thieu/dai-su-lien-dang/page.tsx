// Địa chỉ cũ của chủ đề "dai-su-lien-dang": chỉ giữ tiêu đề trang, phần còn lại đọc D1 theo slug như mọi chủ đề (AboutTopicPage).
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';
import { AboutTopicPage } from '../AboutTopicPage';

export const metadata: Metadata = pageMetadata({
  title: "Đôi Nét Về Đại Sư Liên Đăng - Viện Chủ Viện Tịnh Luật Chùa Đại Từ Ân | Tùng Lâm Hòa Phúc",
  description: "Đại Sư Liên Đăng là bậc cao tăng Giới sư, Giám đốc Trung tâm Tư liệu Phật giáo Việt Nam, Viện chủ Viện Tịnh Luật chùa Đại Từ Ân.",
  path: '/gioi-thieu/dai-su-lien-dang',
});

export const revalidate = 60;

export default function DaiSuLienDangPage() {
  return <AboutTopicPage slug="dai-su-lien-dang" />;
}
