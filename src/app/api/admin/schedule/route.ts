// Read only (V3 on www's data): the schedule from www's D1.
import { NextResponse } from 'next/server';
import { PUBLIC_CACHE, scheduleData } from '@/lib/v3-data';

export interface CustomScheduleEvent {
  id: string;
  slug?: string;
  solarDateStr: string; // "DD.MM.YYYY"
  title: string;
  subtitle?: string;
  category: 'Cộng Tu' | 'Đại Lễ Sự Kiện' | 'Khóa Lễ Truyền Thống' | string;
  timeSlot1Label?: string;
  timeSlot1Time?: string;
  location: string;
  description: string;
  notes?: string;
  imgUrl?: string;
  imgPositionY?: number; // Tọa độ căn chỉnh trục dọc (0% - 100%)
  videoUrl?: string;
  gallery?: string[];
  contentHtml?: string;
}

export interface QuoteGalleryItem {
  id: string;
  url: string;
  title?: string;
}

export interface ScheduleDatabaseData {
  featuredPrograms: Array<{
    id: string;
    slug?: string;
    title: string;
    subtitle?: string;
    time?: string;
    duration?: string;
    location?: string;
    schedule: string;
    summary: string;
    imgUrl: string;
    imgPositionY?: number;
  }>;
  monthThemes: Record<string, {
    month: number;
    bannerImg: string;
    title: string;
    quoteLines: string[];
    author: string;
    primaryColor: string;
    secondaryColor: string;
    themeBg: string;
    quoteImg?: string;
    quoteTitle?: string;
  }>;
  customEvents: Array<CustomScheduleEvent>;
  quoteGallery?: Array<QuoteGalleryItem>;
}

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await scheduleData() }, { headers: PUBLIC_CACHE });
  } catch (error) {
    // Chi tiết lỗi (có thể là câu SQL hay tên bảng của D1) chỉ vào nhật ký, không ra công khai.
    console.error('[API /api/admin/schedule] Lỗi:', error);
    return NextResponse.json({ success: false, error: 'Không đọc được lịch tu học' }, { status: 500 });
  }
}
