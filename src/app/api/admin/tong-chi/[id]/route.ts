// Read only (V3 on www's data): one Tông Chỉ article from www's D1.
import { NextResponse } from 'next/server';
import { allTongChi, PUBLIC_CACHE } from '@/lib/v3-data';

const ALIASES: Record<string, string[]> = {
  'tiep-buoc-thay-toi': ['tong-phong-truyen-thua-truc-lam'],
  'tong-phong-truyen-thua-truc-lam': ['tiep-buoc-thay-toi'],
  'tam-quy-ngu-gioi-nen-tang-nguoi-phat-tu': ['tam-quy'],
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = decodeURIComponent(id);
  const wanted = [key, ...(ALIASES[key] ?? [])];
  const article = (await allTongChi()).find((a) => wanted.includes(String(a.id)) || wanted.includes(a.slug));
  if (!article) return NextResponse.json({ success: false, error: 'Không tìm thấy bài viết' }, { status: 404 });
  return NextResponse.json({ success: true, data: article }, { headers: PUBLIC_CACHE });
}
