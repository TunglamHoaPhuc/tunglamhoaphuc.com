import DongChayHoangPhapClient from './DongChayHoangPhapClient';
import { dongChayPage } from '@/lib/dong-chay';

// Cache ở edge 5 phút. Trang chỉ dựng 12 bài mới nhất; các trang sau, danh mục và cách sắp xếp
// lấy qua /api/public/dong-chay (không đọc searchParams ở đây, vì đọc là mất cache).
export const revalidate = 300;

export default async function DongChayHoangPhapPage() {
  const first = await dongChayPage({ page: 1 });
  return <DongChayHoangPhapClient initial={first} />;
}
