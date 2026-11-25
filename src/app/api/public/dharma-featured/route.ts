import { NextResponse } from 'next/server';
import { loadDharmaFeatured } from '@/lib/v3-dharma';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Trực tiếp không cache trên edge

// Dấu ấn hoằng pháp: các bài được đọc nhiều nhất theo lượt xem thật trong D1. Cách dựng nằm ở lib/v3-dharma.ts,
// dùng chung với trang chủ (trang chủ dựng sẵn ở máy chủ nên lần hiện đầu đã có số lượt xem thật).
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await loadDharmaFeatured() });
  } catch (error: unknown) {
    // Chi tiết lỗi (có thể là câu SQL hay tên bảng của D1) chỉ vào nhật ký, không ra công khai.
    console.error('Error fetching dharma featured posts:', error);
    return NextResponse.json({ success: false, error: 'Không đọc được Dấu ấn hoằng pháp' }, { status: 500 });
  }
}
