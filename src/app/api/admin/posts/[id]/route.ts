// Read only (V3 on www's data): one live post from www's D1. No bundled copy: a post that is a draft, not yet
// due, in the trash or missing answers 404.
import { NextRequest, NextResponse } from 'next/server';
import { postRecord, PUBLIC_CACHE } from '@/lib/v3-data';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await postRecord(decodeURIComponent(id));
  if (post) return NextResponse.json({ success: true, post }, { headers: PUBLIC_CACHE });
  return NextResponse.json({ success: false, error: 'Không tìm thấy bài viết' }, { status: 404 });
}
