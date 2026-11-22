// Read only (V3 on www's data): Tông Chỉ Tu Học from www's D1.
import { NextResponse } from 'next/server';
import { allTongChi, PUBLIC_CACHE } from '@/lib/v3-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search')?.toLowerCase();
  let articles = await allTongChi();
  if (category && category !== 'all') articles = articles.filter((a) => a.category === category);
  if (search) articles = articles.filter((a) => a.title?.toLowerCase().includes(search) || a.subtitle?.toLowerCase().includes(search) || a.excerpt?.toLowerCase().includes(search));
  return NextResponse.json({ success: true, data: articles }, { headers: PUBLIC_CACHE });
}
