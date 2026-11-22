// Read only (V3 on www's data): one Giới thiệu topic from www's D1.
import { NextRequest, NextResponse } from 'next/server';
import { getTopics } from '../route';
import { PUBLIC_CACHE } from '@/lib/v3-data';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topic = (await getTopics()).find((t) => t.id === id || t.slug === id);
  if (!topic) return NextResponse.json({ success: false, error: 'Không tìm thấy chủ đề giới thiệu' }, { status: 404 });
  return NextResponse.json({ success: true, topic }, { headers: PUBLIC_CACHE });
}
