// Địa chỉ cũ của chủ đề "su-phu-tru-tri": chỉ giữ tiêu đề trang, phần còn lại đọc D1 theo slug như mọi chủ đề (AboutTopicPage).
import { AboutTopicPage } from '../AboutTopicPage';

export const metadata = {
  title: "Tiểu Sử Sa Môn Thích Tâm Hòa - Trụ Trì Chùa Hòa Phúc | Tùng Lâm Hòa Phúc",
  description: "Tiểu sử Thầy Thích Tâm Hòa, Trụ trì chùa Hòa Phúc, Quốc Oai, Hà Nội - Người kiến thiết đạo tràng tu học Tịnh Độ và nuôi dưỡng đời sống tâm linh cho giới trẻ.",
};

export const revalidate = 60;

export default function SuPhuTruTriPage() {
  return <AboutTopicPage slug="su-phu-tru-tri" />;
}
