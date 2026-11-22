// Một khu vực của Vũ Trụ Phật Giáo, đọc ở máy chủ từ D1 của www. Khu vực bị ẩn, đã xóa hay không có: 404
// (không còn khu vực đóng gói hay khu vực tự dựng từ slug để thay vào).
import { notFound } from 'next/navigation';
import { UNIVERSE_AREAS, type UniverseArea } from '@/data/universe-data';
import { liveArea } from '@/lib/v3-live';
import AreaDetailClient from './AreaDetailClient';

export const revalidate = 60;

export default async function UniverseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = await liveArea(slug);
  if (!area) notFound();
  // "Câu chuyện liên quan" của khu vực chưa có trong D1: giữ bản đóng gói, nhưng chỉ cho khu vực đang hiển thị (PART 2).
  const bundled = UNIVERSE_AREAS.find((a) => a.slug === area.slug);
  const detail: UniverseArea = {
    ...area,
    temple: area.temple === 'quynh-nhai-cam-lo-tu' ? 'quynh-nhai-cam-lo-tu' : 'tung-lam-hoa-phuc',
    mapPos: area.mapPos ?? { x: 50, y: 50 },
    statues: bundled?.statues ?? [],
    stories: bundled?.stories ?? [],
  };
  return <AreaDetailClient area={detail} />;
}
