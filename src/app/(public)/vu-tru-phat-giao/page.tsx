// Danh sách và sơ đồ các khu vực của Vũ Trụ Phật Giáo, đọc ở máy chủ từ D1 của www: chỉ khu vực đang hiển thị, đúng thứ tự biên tập.
// Không đọc được D1 thì lỗi nổi lên trang lỗi, không có danh sách đóng gói thay vào.
import { mapSpotsOf } from '@/lib/v3-areas';
import { liveStatueRecords } from '@/lib/v3-statues';
import { liveAreas } from '@/lib/v3-live';
import VuTruPhatGiaoClient from './VuTruPhatGiaoClient';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';

export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  title: "Vũ Trụ Phật Giáo",
  description: "Sơ đồ không gian kiến trúc & hệ thống tự viện Tùng Lâm Hòa Phúc.",
  path: '/vu-tru-phat-giao',
});

export default async function VuTruPhatGiaoPage() {
  const [areas, statues] = await Promise.all([liveAreas(), liveStatueRecords()]);
  return <VuTruPhatGiaoClient areas={areas} spots={mapSpotsOf(areas, statues)} />;
}
