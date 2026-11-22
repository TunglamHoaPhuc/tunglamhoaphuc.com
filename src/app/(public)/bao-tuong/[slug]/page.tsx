// Một bảo tượng, đọc ở máy chủ từ D1 của www. Tượng đang nháp, ẩn, hẹn giờ hay đã xóa: 404 (không còn bản đóng gói để thay vào).
import { notFound } from 'next/navigation';
import { StatueDetailCoreLayout } from '@/features/statues/components/StatueDetailCoreLayout';
import { liveStatuePage } from '@/lib/v3-statues';

export const revalidate = 60;

export default async function SingleBaoTuongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await liveStatuePage(slug);
  if (!page) notFound();
  return <StatueDetailCoreLayout statue={page.statue} clusterMembers={page.clusterMembers} artisticWorks={page.artWorks} relatedStatues={page.related} />;
}
