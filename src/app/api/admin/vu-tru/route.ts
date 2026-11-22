// Read only (V3 on www's data): areas of Vũ Trụ Phật Giáo from www's D1.
import { NextResponse } from 'next/server';
import { allAreas, PUBLIC_CACHE } from '@/lib/v3-data';

export async function getAreas() {
  return allAreas();
}

export async function GET() {
  const areas = await allAreas();
  return NextResponse.json({ success: true, areas, count: areas.length }, { headers: PUBLIC_CACHE });
}
