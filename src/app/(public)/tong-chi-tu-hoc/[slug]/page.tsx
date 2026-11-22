// Một bài Tông Chỉ Tu Học, đọc ở máy chủ từ D1 của www (qua src/lib/v3-live.ts). Bài nháp, hẹn giờ chưa tới,
// trong thùng rác hay không có: 404. Không còn lời gọi nào tới WordPress và không có bản đóng gói dự phòng.
import { liveTongChi, liveTongChiList, relatedTongChi } from '@/lib/v3-live';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import TongChiDetailClient from './TongChiDetailClient';

// Làm mới tối đa mỗi phút: bài sửa hay gỡ ở /quan-tri của www hiện ở đây trong vòng khoảng một phút.
export const revalidate = 60;

export default async function TongChiDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await liveTongChi(slug);
  if (!article) return notFoundOrMoved(`/tong-chi-tu-hoc/${slug}`);
  const related = relatedTongChi(article, await liveTongChiList());
  return <TongChiDetailClient article={article} related={related} />;
}
