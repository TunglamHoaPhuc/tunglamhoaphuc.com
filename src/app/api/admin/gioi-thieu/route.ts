// Read only (V3 on www's data): Giới thiệu topics from www's D1.
import { NextRequest, NextResponse } from 'next/server';
import { allAbout, PUBLIC_CACHE } from '@/lib/v3-data';

export interface MilestoneItem {
  year: string;
  title: string;
  description: string;
}

export interface GioiThieuRecord {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  groupCategory: 'lich-su-chua' | 'nguoi-lien-quan' | 'thanh-quy-van-hoa';
  groupCategoryName?: string;
  heroBanner: string;
  heroBannerPosition?: string;
  portraitImage?: string;
  portraitImagePosition?: string;
  overviewSummary: string;
  quoteTitle?: string;
  quoteContent?: string[];
  quoteAuthor?: string;
  milestones?: MilestoneItem[];
  content: string;
  mainContentHtml?: string;
  galleryImages?: Array<{ url: string; caption: string; position?: string }>;
  videoBlock?: { videoUrl: string; title: string; summary: string };
  sourceBook?: { bookTitle: string; author: string; coverImage?: string; description?: string };
  wpPostId?: string | number;
  status: 'published' | 'draft';
  orderIndex: number;
  wpModified?: string;
}
export async function getTopics(): Promise<GioiThieuRecord[]> {
  return (await allAbout()) as unknown as GioiThieuRecord[];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const group = searchParams.get('group');
  const search = searchParams.get('search')?.trim().toLowerCase();
  let topics = await getTopics();
  if (group && group !== 'all') topics = topics.filter((t) => t.groupCategory === group);
  if (search) topics = topics.filter((t) => t.title.toLowerCase().includes(search) || t.subtitle?.toLowerCase().includes(search) || t.overviewSummary?.toLowerCase().includes(search));
  return NextResponse.json({ success: true, total: topics.length, topics }, { headers: PUBLIC_CACHE });
}
