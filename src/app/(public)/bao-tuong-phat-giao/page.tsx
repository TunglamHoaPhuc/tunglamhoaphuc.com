// Danh sách Bảo Tượng Phật Giáo, đọc ở máy chủ từ D1 của www: chỉ tượng chính đang hiển thị, đúng thứ tự biên tập.
// Không đọc được D1 thì lỗi nổi lên trang lỗi, không có danh sách đóng gói để thay vào.
import { assembliesOf, liveStatueRecords } from '@/lib/v3-statues';
import StatueListClient from './StatueListClient';

export const revalidate = 60;

export default async function BaoTuongPhatGiaoPage() {
  const records = await liveStatueRecords();
  const statues = records.filter((s) => s.categoryType === 'TƯỢNG CHÍNH');
  return <StatueListClient statues={statues} assemblies={assembliesOf(records)} />;
}
