// Một thời khóa (sự kiện hoặc khóa lễ định kỳ) của Lịch tu học, đọc ở máy chủ từ D1 của www. Sự kiện nháp, trong
// thùng rác hay không có: 404. Trước đây slug lạ vẫn ra một trang dựng từ chữ của slug, và còn có cả các sự kiện
// tháng 8 đóng gói sẵn; nay không còn.
import type { Metadata } from 'next';
import JsonLd from '@/components/public/JsonLd';
import { allArticles } from '@/lib/dong-chay';
import { relatedForEvent } from '@/lib/schedule-detail';
import { eventJsonLdFor } from '@/lib/v3-jsonld';
import { liveScheduleDetail } from '@/lib/v3-live';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import { scheduleMetadataFor } from '@/lib/v3-seo';
import ScheduleDetailClient from './ScheduleDetailClient';

// Mỗi phút một lần (tương đương các lời gọi có ?t= ở các trang khác): sửa ở /quan-tri của www hiện ở đây sau khoảng một phút.
export const revalidate = 60;

// Tiêu đề, mô tả, canonical và ảnh của từng sự kiện hay khóa lễ (trước đây mọi trang lịch mang tiêu đề chung của site).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return scheduleMetadataFor((await params).slug);
}

export default async function ScheduleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await liveScheduleDetail(slug);
  if (!event) return notFoundOrMoved(`/lich-tu-hoc/${slug}`);
  return (
    <>
      <JsonLd data={await eventJsonLdFor(slug)} />
      <ScheduleDetailClient eventInfo={event} smartRelatedArticles={relatedForEvent(event, await allArticles())} />
    </>
  );
}
