// Bảng đối soát ảnh tượng pháp, đọc ở máy chủ từ D1 của www: chỉ tượng đang hiển thị.
import { liveStatueRecords } from '@/lib/v3-statues';
import KiemTraAnhClient from './KiemTraAnhClient';

export const revalidate = 60;

export default async function KiemTraAnhPage() {
  return <KiemTraAnhClient statues={await liveStatueRecords()} />;
}
