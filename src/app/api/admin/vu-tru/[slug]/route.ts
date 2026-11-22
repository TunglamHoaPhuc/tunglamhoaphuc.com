// Read only (V3 on www's data): one area of Vũ Trụ Phật Giáo from www's D1.
import { NextRequest, NextResponse } from 'next/server';
import { allAreas, PUBLIC_CACHE } from '@/lib/v3-data';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const area = (await allAreas()).find((a) => a.slug.toLowerCase() === (slug || '').toLowerCase());
  if (!area) return NextResponse.json({ success: false, error: 'Không tìm thấy không gian' }, { status: 404 });
  return NextResponse.json({ success: true, area }, { headers: PUBLIC_CACHE });
}
