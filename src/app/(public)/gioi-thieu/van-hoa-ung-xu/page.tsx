// Địa chỉ cũ của chủ đề "van-hoa-ung-xu": chỉ giữ tiêu đề trang, phần còn lại đọc D1 theo slug như mọi chủ đề (AboutTopicPage).
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';
import { AboutTopicPage } from '../AboutTopicPage';

export const metadata: Metadata = pageMetadata({
  title: "Văn Hóa Ứng Xử Thiền Môn - Thanh Quy Tùng Lâm Hòa Phúc",
  description: "Quy củ, oai nghi tế hạnh và nếp sống đạo đức dành cho Phật tử khi về viếng cảnh Tùng Lâm Hòa Phúc.",
  path: '/gioi-thieu/van-hoa-ung-xu',
});

export const revalidate = 60;

export default function VanHoaUngXuPage() {
  return <AboutTopicPage slug="van-hoa-ung-xu" />;
}
