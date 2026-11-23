// Một bài Tông Chỉ Tu Học, đọc ở máy chủ từ D1 của www (qua src/lib/v3-live.ts). Bài nháp, hẹn giờ chưa tới,
// trong thùng rác hay không có: 404. Không còn lời gọi nào tới WordPress và không có bản đóng gói dự phòng.
import type { Metadata } from 'next';
import JsonLd from '@/components/public/JsonLd';
import { NavPanelProvider } from '@/components/tong-chi-tu-hoc/NavPanelData';
import { buildTongChiNavGroups } from '@/lib/tong-chi-sections';
import { breadcrumbJsonLd } from '@/lib/v3-jsonld';
import { liveTongChi, liveTongChiList, relatedTongChi } from '@/lib/v3-live';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import { tongChiMetadataFor } from '@/lib/v3-seo';
import TongChiDetailClient from './TongChiDetailClient';

// Làm mới tối đa mỗi 30 giây. V3 không có chỗ nào để admin xóa cache, còn bản đọc D1 trong bộ nhớ làm mới mỗi 15 giây
// (D1_RENEW_MS): bài sửa hay gỡ ở /quan-tri của www hiện ở đây sau khoảng 30 giây, chậm nhất khoảng 45 giây.
export const revalidate = 30;

// Không tạo trang nào lúc build: khai báo này chỉ để vinext coi tuyến có tham số là "tạo tĩnh theo yêu cầu" (ISR), nhờ đó
// bộ nhớ đệm của Workers giữ bản trang theo `revalidate` thay vì dựng lại ở mỗi lượt xem.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return tongChiMetadataFor((await params).slug);
}

export default async function TongChiDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await liveTongChi(slug);
  if (!article) return notFoundOrMoved(`/tong-chi-tu-hoc/${slug}`);
  const list = await liveTongChiList();
  const related = relatedTongChi(article, list);
  return (
    <NavPanelProvider data={{ tongChi: buildTongChiNavGroups(list) }}>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Tông Chỉ Tu Học', path: '/tong-chi-tu-hoc' }, { name: article.title, path: `/tong-chi-tu-hoc/${article.slug}` }])} />
      <TongChiDetailClient article={article} related={related} />
    </NavPanelProvider>
  );
}
