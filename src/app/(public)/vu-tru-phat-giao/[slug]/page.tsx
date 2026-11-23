// Một khu vực của Vũ Trụ Phật Giáo, đọc ở máy chủ từ D1 của www. Khu vực bị ẩn, đã xóa hay không có: 404
// (không còn khu vực đóng gói hay khu vực tự dựng từ slug để thay vào). Tượng của khu vực cũng từ D1: chỉ tượng đang hiển thị.
import type { Metadata } from 'next';
import JsonLd from '@/components/public/JsonLd';
import { breadcrumbJsonLd } from '@/lib/v3-jsonld';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import { areaMetadataFor } from '@/lib/v3-seo';
import { liveStatueRecords } from '@/lib/v3-statues';
import { liveArea, liveAreas } from '@/lib/v3-live';
import AreaDetailClient from './AreaDetailClient';

// Làm mới tối đa mỗi 30 giây. V3 không có chỗ nào để admin xóa cache, còn bản đọc D1 trong bộ nhớ làm mới mỗi 15 giây
// (D1_RENEW_MS): bài sửa hay gỡ ở /quan-tri của www hiện ở đây sau khoảng 30 giây, chậm nhất khoảng 45 giây.
export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return areaMetadataFor((await params).slug);
}

export default async function UniverseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = await liveArea(slug);
  if (!area) return notFoundOrMoved(`/vu-tru-phat-giao/${slug}`);
  const [areas, statues] = await Promise.all([liveAreas(), liveStatueRecords()]);
  // Chỉ gửi xuống trình duyệt tượng của khu vực này.
  const here = statues.filter((s) => s.areaSlug === area.slug);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Vũ Trụ Phật Giáo', path: '/vu-tru-phat-giao' }, { name: area.name, path: `/vu-tru-phat-giao/${area.slug}` }])} />
      <AreaDetailClient
        area={area}
        statues={here.filter((s) => s.categoryType === 'TƯỢNG CHÍNH')}
        artItems={here.filter((s) => s.categoryType !== 'TƯỢNG CHÍNH')}
        areas={areas}
      />
    </>
  );
}
