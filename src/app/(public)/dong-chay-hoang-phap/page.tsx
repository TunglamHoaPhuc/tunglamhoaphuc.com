import DongChayHoangPhapClient from './DongChayHoangPhapClient';
import { dongChayPage } from '@/lib/dong-chay';
import { liveDongChayCategories } from '@/lib/dong-chay-categories';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';

export const metadata: Metadata = pageMetadata({
  title: "Dòng Chảy Hoằng Pháp",
  description: "Tin hoạt động, khóa lễ, cộng tu và đại lễ tại Tùng Lâm Hòa Phúc.",
  path: '/dong-chay-hoang-phap',
});

// Cache ở edge 60 giây (trước là 5 phút: V3 không có chỗ nào để admin xóa cache, bài mới đăng phải hiện sớm). Trang chỉ dựng
// 12 bài mới nhất; các trang sau, danh mục và cách sắp xếp lấy qua /api/public/dong-chay (không đọc searchParams ở đây, vì
// đọc là mất cache). Danh sách đọc nhiều dòng hơn một bài lẻ nên giữ 60 giây, gấp bốn lần D1_RENEW_MS (15 giây).
export const revalidate = 60;

export default async function DongChayHoangPhapPage() {
  const [first, categories] = await Promise.all([dongChayPage({ page: 1 }), liveDongChayCategories()]);
  return <DongChayHoangPhapClient initial={first} categories={categories} />;
}
