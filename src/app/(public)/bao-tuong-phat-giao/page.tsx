// Danh sách Bảo Tượng Phật Giáo, đọc ở máy chủ từ D1 của www: mọi tượng đang hiển thị, đúng thứ tự biên tập.
// Tượng chính vào các khối chúng hội, các tượng còn lại (Nghệ thuật Phật giáo) vào khối riêng sau đó; xem lib/statue-list.ts.
// Tượng nháp, ẩn, hẹn giờ hay đã xóa không có trong danh sách. Không đọc được D1 thì lỗi nổi lên trang lỗi.
import { assembliesOf, liveStatueRecords } from '@/lib/v3-statues';
import StatueListClient, { type StatueListItem } from './StatueListClient';
import type { StatueRecord } from '@/lib/statue-types';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';

export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  title: "Bảo Tượng Phật Giáo",
  description: "Hệ thống tượng pháp dát vàng, sơn son thếp vàng tôn thờ tại Tùng Lâm Hòa Phúc.",
  path: '/bao-tuong-phat-giao',
});

// Bản ghi đầy đủ có cả lịch sử và thành viên cụm (hàng trăm KB cho cả danh sách): trang danh sách chỉ nhận các trường nó dùng.
function toListItem(r: StatueRecord): StatueListItem {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    subtitle: r.subtitle,
    areaName: r.areaName,
    group: r.group,
    clusterName: r.clusterName,
    assemblyId: r.assemblyId,
    assembly: r.assembly,
    assemblyName: r.assemblyName,
    categoryType: r.categoryType,
    imgUrl: r.imgUrl,
    imgPosition: r.imgPosition,
    imgRotation: r.imgRotation,
  };
}

export default async function BaoTuongPhatGiaoPage() {
  const records = await liveStatueRecords();
  return <StatueListClient statues={records.map(toListItem)} assemblies={assembliesOf(records)} />;
}
