'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Calendar, Play, ArrowLeft, ChevronRight, Bell, Sparkles, Video, Images, BookOpen, Clock, Landmark, ArrowRight } from 'lucide-react';
import Header from '@/components/public/layout/Header';
import Footer from '@/components/public/layout/Footer';
import { SmartSearchAIBar } from '@/components/public/SmartSearchAIBar';
import { HeroBanner } from '@/components/tong-chi-tu-hoc/HeroBanner';
import { InfographicArticleRenderer } from '@/components/tong-chi-tu-hoc/chi-tiet/InfographicArticleRenderer';
import { BookCitationSection } from '@/components/tong-chi-tu-hoc/chi-tiet/BookCitationSection';
import { IllustrationVideo } from '@/components/tong-chi-tu-hoc/chi-tiet/IllustrationVideo';
import { PhotoGallery } from '@/components/tong-chi-tu-hoc/chi-tiet/PhotoGallery';
import { DiscoverMore } from '@/components/tong-chi-tu-hoc/chi-tiet/DiscoverMore';
import { DetailModal } from '@/components/tong-chi-tu-hoc/chi-tiet/DetailModal';

export interface WisdomRelatedCard {
  category: string;
  title: string;
  url: string;
  link: string;
}

// Bài do máy chủ lấy từ D1 (page.tsx). Lượt xem là số thật của D1; chưa ai đọc thì không hiện số.
export default function TriTueDetailClient({ item, relatedFormatted }: { item: any; relatedFormatted: WisdomRelatedCard[] }) {
  const [activeKeyword, setActiveKeyword] = useState<any>(null);

  return (
    <div className="min-h-screen bg-[#2C1C11] text-[#e3d2c1] selection:bg-[#F2C14E] selection:text-black">
      {/* ── 1. HERO BANNER & TIÊU ĐỀ TRANG ── */}
      <HeroBanner
        id="overview"
        bannerUrl={item.bannerUrl || item.thumbnailUrl}
        bannerPosition={item.bannerPosition || item.thumbnailPosition || 'center 25%'}
        title={item.title}
        subtitle={item.subtitle || 'KHO TÀNG TRÍ TUỆ PHẬT PHÁP'}
      />

      {/* ── 2. NỘI DUNG PHÁP BẢO & INFOGRAPHIC ARTICLE RENDERER ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-16">
        <div className="max-w-4xl mx-auto">
          {/* Back link */}
          <div className="mb-6">
            <Link
              href="/tri-tue-phat-phap"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-[#F2C14E] hover:text-[#FFE5A3] transition-colors"
              style={{ fontFamily: "'UTM Avo', sans-serif", fontWeight: 'bold' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay Lại Kho Tàng Trí Tuệ Phật Pháp</span>
            </Link>
          </div>

          <InfographicArticleRenderer
            rawContent={item.content || item.contentHtml || item.excerpt || ''}
            title={item.title}
            subtitle={item.subtitle}
            author={item.author}
            popups={item.keywords}
            onKeywordClick={(kwStr) => {
              const kws = item.keywords || [];
              const found = kws.find((k: any) => k.keyword.toLowerCase() === kwStr.toLowerCase());
              if (found) {
                setActiveKeyword(found);
              }
            }}
          />

          {/* Meta footer */}
          <div
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="border-t border-[#F2C14E]/20 pt-6 mt-12 flex flex-wrap items-center justify-between gap-4 text-xs md:text-sm text-[#D3C0AD]"
          >
            <div className="flex items-center gap-6">
              {(item.publishDate || item.publishedDate) && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#F2C14E]" />
                  <span>Ngày đăng: <strong className="text-[#F2C14E]">{item.publishDate || item.publishedDate}</strong></span>
                </span>
              )}

              {(item.viewsCount ?? 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-[#F2C14E]" />
                  <span>Lượt xem: <strong className="text-[#F2C14E]">{item.viewsCount}</strong></span>
                </span>
              )}
            </div>

            {item.author && (
              <div>
                <span>Tác giả / Diễn giảng: <strong className="text-[#F2C14E]">{item.author}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. BLOCK VIDEO PHÁP THOẠI / MINH HỌA ── */}
        {(item.videoBlock?.videoUrl || item.mediaUrl) && (
          <div className="w-full">
            <IllustrationVideo
              heroBanner={item.bannerUrl || item.thumbnailUrl}
              videoBlock={item.videoBlock || {
                videoUrl: item.mediaUrl,
                title: item.title,
                summary: item.excerpt || '',
                thumbnailUrl: item.thumbnailUrl,
              }}
            />
          </div>
        )}

        {/* ── 3b. PHÁP ÂM: trình phát âm thanh ── */}
        {item.audio?.src && (
          <figure className="w-full rounded-2xl border border-[#F2C14E]/30 bg-[#25170E]/60 p-5 sm:p-6">
            <figcaption className="mb-3 text-sm font-bold uppercase tracking-wider text-[#F2C14E]">
              Nghe Pháp Âm{item.audio.duration ? ` · ${item.audio.duration}` : ''}
            </figcaption>
            <audio controls preload="none" src={item.audio.src} className="block w-full" />
          </figure>
        )}

        {/* ── 4. BLOCK BỘ SƯU TẬP ẢNH TƯ LIỆU (PHOTO GALLERY) ── */}
        {item.photoGallery && item.photoGallery.length > 0 && (
          <div className="w-full">
            <PhotoGallery photoGallery={item.photoGallery} onSelectPhoto={() => {}} />
          </div>
        )}

        {/* ── 5. BLOCK TRÍCH DẪN NGUỒN SÁCH & ẤN PHẨM ── */}
        {item.sourceBook && (
          <BookCitationSection sourceBook={item.sourceBook} />
        )}

        {/* ── 6. BLOCK TÌM HIỂU THÊM ── */}
        <div className="w-full">
          <DiscoverMore relatedArticles={relatedFormatted} />
        </div>

        {/* Smart Search AI Bar */}
        <div className="my-10">
          <SmartSearchAIBar contextTitle={item.title} />
        </div>
      </main>

      {/* Detail Modal for Keyword Click */}
      <DetailModal
        activePhotoIndex={null}
        photoGallery={[]}
        onClosePhotoModal={() => {}}
        onPrevPhoto={() => {}}
        onNextPhoto={() => {}}
        onSelectPhotoIndex={() => {}}
        activeKeywordPopup={activeKeyword}
        onCloseKeywordPopup={() => setActiveKeyword(null)}
      />
    </div>
  );
}
