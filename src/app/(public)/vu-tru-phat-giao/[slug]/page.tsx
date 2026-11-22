// Một khu vực của Vũ Trụ Phật Giáo, đọc ở máy chủ từ D1 của www. Khu vực bị ẩn, đã xóa hay không có: 404
// (không còn khu vực đóng gói hay khu vực tự dựng từ slug để thay vào). Tượng của khu vực cũng từ D1: chỉ tượng đang hiển thị.
import { notFound } from 'next/navigation';
import { liveStatueRecords } from '@/lib/v3-statues';
import { liveArea, liveAreas } from '@/lib/v3-live';
import AreaDetailClient from './AreaDetailClient';

export const revalidate = 60;

export default async function UniverseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = await liveArea(slug);
  if (!area) notFound();
  const [areas, statues] = await Promise.all([liveAreas(), liveStatueRecords()]);
  // Chỉ gửi xuống trình duyệt tượng của khu vực này.
  const here = statues.filter((s) => s.areaSlug === area.slug);
  return (
    <AreaDetailClient
      area={area}
      statues={here.filter((s) => s.categoryType === 'TƯỢNG CHÍNH')}
      artItems={here.filter((s) => s.categoryType !== 'TƯỢNG CHÍNH')}
      areas={areas}
    />
  );
}
