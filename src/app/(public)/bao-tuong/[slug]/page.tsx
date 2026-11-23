// Một bảo tượng, đọc ở máy chủ từ D1 của www. Tượng đang nháp, ẩn, hẹn giờ hay đã xóa: 404 (không còn bản đóng gói để thay vào).
import type { Metadata } from 'next';
import JsonLd from '@/components/public/JsonLd';
import { StatueDetailCoreLayout } from '@/features/statues/components/StatueDetailCoreLayout';
import { breadcrumbJsonLd } from '@/lib/v3-jsonld';
import { notFoundOrMoved } from '@/lib/v3-redirect';
import { statueMetadataFor } from '@/lib/v3-seo';
import { liveStatuePage } from '@/lib/v3-statues';

export const revalidate = 60;

// Không tạo trang nào lúc build: khai báo này chỉ để vinext coi tuyến có tham số là "tạo tĩnh theo yêu cầu" (ISR), nhờ đó
// bộ nhớ đệm của Workers giữ bản trang theo `revalidate` thay vì dựng lại ở mỗi lượt xem.
export async function generateStaticParams() {
  return [];
}

// Tiêu đề, mô tả, canonical và ảnh chia sẻ của từng tượng (trước đây mọi tượng mang tiêu đề chung của site).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return statueMetadataFor((await params).slug);
}

export default async function SingleBaoTuongPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await liveStatuePage(slug);
  if (!page) return notFoundOrMoved(`/bao-tuong/${slug}`);
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Bảo Tượng Phật Giáo', path: '/bao-tuong-phat-giao' }, { name: page.statue.name, path: `/bao-tuong/${page.statue.slug}` }])} />
      <StatueDetailCoreLayout statue={page.statue} clusterMembers={page.clusterMembers} artisticWorks={page.artWorks} relatedStatues={page.related} />
    </>
  );
}
