// Một thời khóa (sự kiện hoặc khóa lễ định kỳ) của Lịch tu học, đọc ở máy chủ từ D1 của www. Sự kiện nháp, trong
// thùng rác hay không có: 404. Trước đây slug lạ vẫn ra một trang dựng từ chữ của slug, và còn có cả các sự kiện
// tháng 8 đóng gói sẵn; nay không còn.
import { allArticles } from '@/lib/dong-chay';
import { relatedForEvent } from '@/lib/schedule-detail';
import { liveScheduleDetail } from '@/lib/v3-live';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import ScheduleDetailClient from './ScheduleDetailClient';

// Mỗi phút một lần (tương đương các lời gọi có ?t= ở các trang khác): sửa ở /quan-tri của www hiện ở đây sau khoảng một phút.
export const revalidate = 60;

export default async function ScheduleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await liveScheduleDetail(slug);
  if (!event) return notFoundOrMoved(`/lich-tu-hoc/${slug}`);
  return <ScheduleDetailClient eventInfo={event} smartRelatedArticles={relatedForEvent(event, await allArticles())} />;
}
