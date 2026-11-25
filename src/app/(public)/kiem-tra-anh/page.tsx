// Bảng đối soát ảnh tượng pháp: công cụ nội bộ, chỉ có khi NODE_ENV là development; ở host công khai là 404.
// Đọc ở máy chủ từ D1 của www: chỉ tượng đang hiển thị.
import { notFound } from 'next/navigation';
import { isDevelopment } from '@/lib/dev-only';
import { liveStatueRecords } from '@/lib/v3-statues';
import KiemTraAnhClient from './KiemTraAnhClient';

export const revalidate = 60;

export default async function KiemTraAnhPage() {
  if (!isDevelopment()) notFound();
  return <KiemTraAnhClient statues={await liveStatueRecords()} />;
}
