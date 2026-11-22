// Read only (V3 on www's data): one post from www's D1, else V3's bundled Hoằng Pháp articles.
import { NextRequest, NextResponse } from 'next/server';
import { HOANG_PHAP_ARTICLES } from '@/data/dong-chay-hoang-phap-data';
import { postRecord, PUBLIC_CACHE } from '@/lib/v3-data';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = decodeURIComponent(id);
  const post = await postRecord(key);
  if (post) return NextResponse.json({ success: true, post }, { headers: PUBLIC_CACHE });

  const hp = HOANG_PHAP_ARTICLES.find((a) => a.id === key || a.slug === key);
  if (hp) {
    return NextResponse.json(
      {
        success: true,
        post: {
          id: hp.id,
          slug: hp.slug,
          title: hp.title,
          subtitle: hp.subtitle,
          mainCategory: 'dong-chay-hoang-phap',
          subCategory: hp.category,
          categoryName: hp.subCategory,
          author: hp.author,
          publishedDate: hp.date,
          status: 'published',
          viewsCount: hp.views || 0,
          thumbnailUrl: hp.thumbnailUrl,
          bannerUrl: hp.bannerUrl,
          summary: hp.summary,
          content: hp.contentHtml,
          contentHtml: hp.contentHtml,
          keywords: [],
          photoGallery: [],
        },
      },
      { headers: PUBLIC_CACHE }
    );
  }
  return NextResponse.json({ success: false, error: 'Không tìm thấy bài viết' }, { status: 404 });
}
