// Địa chỉ của mọi chủ đề Giới thiệu, kể cả chủ đề mới tạo ở admin. Hỏi D1 theo slug; không có thì 404.
import type { Metadata } from 'next';
import { aboutMetadataFor } from '@/lib/v3-seo';
import { AboutTopicPage } from '../AboutTopicPage';

// Làm mới tối đa mỗi 30 giây (V3 không có chỗ nào để admin xóa cache; D1_RENEW_MS của bản đọc trong bộ nhớ là 15 giây, nên bài
// sửa hay gỡ ở /quan-tri của www hiện ở đây sau khoảng 30 giây, lâu nhất khoảng 45 giây).
export const revalidate = 30;

// Không tạo trang nào lúc build: khai báo này chỉ để vinext coi tuyến có tham số là "tạo tĩnh theo yêu cầu" (ISR), nhờ đó
// bộ nhớ đệm của Workers giữ bản trang theo `revalidate` thay vì dựng lại ở mỗi lượt xem (TTFB trang chi tiết ~1 s → ~0,3 s).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return aboutMetadataFor((await params).slug);
}

export default async function GioiThieuTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AboutTopicPage slug={decodeURIComponent(slug)} />;
}
