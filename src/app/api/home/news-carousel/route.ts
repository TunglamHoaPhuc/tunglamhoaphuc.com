// Read only (V3 on www's data): the "Tin mới nhất" cards from www's D1, built by lib/v3-home-news.ts (the home page builds the same
// cards on the server). Only what is live there is read: a post the admin hid, left as a draft, scheduled for later or deleted is
// not a card, so no card leads to a page that answers 404.
import { NextResponse } from 'next/server';
import { loadHomeNews, type HomeNewsItem } from '@/lib/v3-home-news';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export type CarouselNewsItem = HomeNewsItem;

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
};

export async function GET() {
  try {
    const data = await loadHomeNews();
    return NextResponse.json({ success: true, data, total: data.length }, { headers: NO_STORE });
  } catch (error) {
    console.error('[API /api/home/news-carousel] Lỗi:', error);
    return NextResponse.json({ success: false, error: 'Không đọc được tin mới nhất' }, { status: 500, headers: NO_STORE });
  }
}
