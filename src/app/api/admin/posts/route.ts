// Read only (V3 on www's data): posts from www's D1 through src/lib/v3-data.ts.
import { NextRequest, NextResponse } from 'next/server';
import { allPostRecords, PUBLIC_CACHE } from '@/lib/v3-data';

export interface KeywordItem {
  keyword: string;
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  imagePosition?: string;
  linkUrl?: string;
}

export interface SourceBook {
  bookTitle: string;
  author: string;
  coverImage?: string;
  description?: string;
  linkUrl?: string;
}

export interface VideoBlock {
  videoUrl: string;
  title: string;
  summary: string;
  thumbnailUrl?: string;
}

export interface FeaturedArticle {
  label?: string;
  title?: string;
  author?: string;
  bgImage?: string;
  bgPosition?: string;
  linkUrl?: string;
}

export interface PhotoItem {
  title: string;
  imageUrl: string;
  imagePosition?: string;
  khuVuc?: string;
  noiDung?: string;
}

export interface RelatedEdition {
  title: string;
  period: string;
  slug: string;
  thumbnailUrl?: string;
}

export interface UpcomingEvent {
  title: string;
  timeString: string;
  location: string;
  description?: string;
  registrationLink?: string;
}


export interface PostRecord {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  mainCategory: string;
  subCategory?: string;
  categoryName?: string;
  author: string;
  authorLink?: string;
  publishedDate: string;
  status: 'published' | 'draft';
  viewsCount: number;
  thumbnailUrl: string;
  thumbnailPosition?: string;
  bannerUrl: string;
  bannerPosition?: string;
  summary: string;
  content: string;
  contentHtml?: string;
  keywords?: KeywordItem[];
  sourceBook?: SourceBook | SourceBook[];
  videoBlock?: VideoBlock;
  featuredArticle?: FeaturedArticle;
  photoGallery?: PhotoItem[];
  galleryCount?: number;
  previousEditions?: RelatedEdition[];
  upcomingEvents?: UpcomingEvent[];
  wpPostId?: string | number;
  wpModified?: string;
}

export const SPECIAL_GIOI_THIEU_WP_IDS = new Set<string>();
export const SPECIAL_TONG_CHI_WP_IDS = new Set<string>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search')?.trim().toLowerCase();
  let posts = await allPostRecords();
  if (category && category !== 'all') posts = posts.filter((p) => p.mainCategory === category || p.subCategory === category);
  if (search) posts = posts.filter((p) => p.title.toLowerCase().includes(search) || p.summary?.toLowerCase().includes(search));
  const out = posts.map((p) => ({ ...p, content: p.summary || '' }));
  return NextResponse.json({ success: true, total: out.length, posts: out }, { headers: PUBLIC_CACHE });
}
