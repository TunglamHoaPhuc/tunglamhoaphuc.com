// Danh sách Bảo Tượng Phật Giáo, đọc ở máy chủ từ D1 của www: mọi tượng đang hiển thị, đúng thứ tự biên tập.
// Tượng chính vào các khối chúng hội, các tượng còn lại (Nghệ thuật Phật giáo) vào khối riêng sau đó; xem lib/statue-list.ts.
// Tượng nháp, ẩn, hẹn giờ hay đã xóa không có trong danh sách. Không đọc được D1 thì lỗi nổi lên trang lỗi.
import { assembliesOf, liveStatueRecords } from '@/lib/v3-statues';
import StatueListClient from './StatueListClient';

export const revalidate = 60;

export default async function BaoTuongPhatGiaoPage() {
  const records = await liveStatueRecords();
  return <StatueListClient statues={records} assemblies={assembliesOf(records)} />;
}
