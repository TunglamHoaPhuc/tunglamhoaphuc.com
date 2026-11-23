'use client';

import React, { useState, useEffect } from 'react';
import { SubNavbar } from '@/components/tong-chi-tu-hoc/SubNavbar';
import { SidebarNav } from '@/components/tong-chi-tu-hoc/SidebarNav';
import { HeroBanner } from '@/components/tong-chi-tu-hoc/HeroBanner';
import type { V3TongChi } from '@/lib/v3-data';

// Import các khối Tiếng Việt đã bóc tách
import { IllustrationVideo } from '@/components/tong-chi-tu-hoc/chi-tiet/IllustrationVideo';
import { FeaturedPosts } from '@/components/tong-chi-tu-hoc/chi-tiet/FeaturedPosts';
import { PhotoGallery } from '@/components/tong-chi-tu-hoc/chi-tiet/PhotoGallery';
import { DiscoverMore } from '@/components/tong-chi-tu-hoc/chi-tiet/DiscoverMore';
import { DetailModal } from '@/components/tong-chi-tu-hoc/chi-tiet/DetailModal';
import {
  BookCitationSection,
  SourceBookData,
} from '@/components/tong-chi-tu-hoc/chi-tiet/BookCitationSection';
import {
  InfographicArticleRenderer,
  toSectionId,
} from '@/components/tong-chi-tu-hoc/chi-tiet/InfographicArticleRenderer';
import { TaiNguyenLienQuanCompact } from '@/components/tong-chi-tu-hoc/chi-tiet/TaiNguyenLienQuanCompact';

interface DuLieuBaiVietChiTiet {
  id: number;
  title: string;
  subtitle?: string;
  shortDescription?: string;
  heroBanner?: string;
  bannerPosition?: string;
  poemContent?: string;
  author?: string;
  authorLink?: string;
  sourceBook?: SourceBookData | SourceBookData[];
  popups?: Array<{
    keyword: string;
    title: string;
    description: string;
    imageUrl?: string;
    linkUrl?: string;
  }>;
  videoBlock?: {
    title?: string;
    description?: string;
    videoUrl?: string;
  };
  featuredArticle?: {
    label?: string;
    title?: string;
    author?: string;
    bgImage?: string;
    bgPosition?: string;
    linkUrl?: string;
  };
  photoGallery?: Array<{
    imageUrl?: string;
    url?: string;
    title?: string;
    caption?: string;
    space3dLink?: string;
    khuVuc?: string;
    noiDung?: string;
  }>;
  relatedArticles?: Array<{
    category: string;
    title: string;
    url: string;
    link?: string;
  }>;
}

// Thẻ của khối "Tìm hiểu thêm": máy chủ tính từ các bài đang hiển thị ở D1.
export interface TongChiRelatedCard {
  category: string;
  title: string;
  url: string;
  link: string;
}

// Bản ghi của D1 → dữ liệu trang. Không có gì được bịa thêm: thiếu thì để trống và khối đó không hiện.
function toDetailData(article: V3TongChi, related: TongChiRelatedCard[]): DuLieuBaiVietChiTiet {
  const banner = article.bannerImage || undefined;
  return {
    id: Number(article.id) || 0,
    title: article.title,
    subtitle: article.subtitle,
    shortDescription: article.excerpt,
    heroBanner: banner,
    bannerPosition: article.bannerPosition,
    poemContent: article.contentHtml,
    author: article.author || undefined,
    authorLink: article.authorLink || undefined,
    sourceBook: article.sourceBook,
    popups: article.keywords.map((k) => ({
      keyword: k.keyword,
      title: k.title,
      description: k.description,
      imageUrl: banner,
      linkUrl: '',
    })),
    videoBlock: article.videoBlock,
    featuredArticle: article.featuredArticle,
    photoGallery: article.photoGallery,
    relatedArticles: related,
  };
}

export default function TongChiDetailClient({ article, related }: { article: V3TongChi; related: TongChiRelatedCard[] }) {
  const slug = article.slug;

  const isBoDeTam = slug === 'bo-de-tam-coi-nguon-thien-phap' || slug === 'bo-de-tam';

  const data = React.useMemo(() => toDetailData(article, related), [article, related]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);

  // 🪷 Tự động trích xuất các đề mục từ nội dung bài viết để tạo Menu điều hướng & Mục lục chuẩn xác 100%
  const navItems = React.useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];

    if (data?.poemContent) {
      const lines = data.poemContent.split('\n');
      for (const l of lines) {
        const line = l.trim();
        const strippedLine = line
          .replace(/^#{1,4}\s+/, '')
          .replace(/^\*\*|\*\*$/g, '')
          .replace(/<[^>]+>/g, '')
          .trim();
        const isMdHeading = /^#{1,4}\s+/.test(line);
        const isUpperHeading =
          (strippedLine.startsWith('BỒ ĐỀ TÂM') ||
            strippedLine.startsWith('SỐNG VỚI') ||
            strippedLine.startsWith('ĐỂ BỒ ĐỀ TÂM') ||
            strippedLine.startsWith('TAM QUY') ||
            strippedLine.startsWith('NGŨ GIỚI') ||
            (strippedLine === strippedLine.toUpperCase() &&
              !strippedLine.startsWith('>') &&
              !strippedLine.startsWith('!['))) &&
          strippedLine.length < 80 &&
          strippedLine.length > 3 &&
          !strippedLine.includes('“') &&
          !strippedLine.includes('”') &&
          !strippedLine.startsWith('📘') &&
          !strippedLine.startsWith('VIDEO:') &&
          !strippedLine.startsWith('Sa Môn') &&
          !strippedLine.startsWith('Vô Trí');

        if (isMdHeading || isUpperHeading) {
          const id = toSectionId(strippedLine);
          if (id && !items.some((it) => it.id === id)) {
            const label =
              strippedLine.length > 32 ? strippedLine.slice(0, 30) + '...' : strippedLine;
            items.push({ id, label });
          }
        }
      }
    }

    if (items.length === 0) {
      items.push({ id: 'bai-tho', label: 'Bài Thơ / Nội Dung' });
    }

    if (isBoDeTam) {
      // 🪷 Đối với trang Bồ Đề Tâm: Hợp nhất thành 1 khối duy nhất TÀI NGUYÊN LIÊN QUAN, bỏ phần Tìm Hiểu Thêm
      items.push({ id: 'tai-nguyen-lien-quan', label: 'Tài Nguyên Liên Quan' });
    } else {
      if (data?.sourceBook || data?.videoBlock?.videoUrl) {
        items.push({ id: 'tai-nguyen-lien-quan', label: 'Tài Nguyên Liên Quan' });
      }
      if (data?.featuredArticle?.title) {
        items.push({ id: 'bai-viet-noibat', label: 'Bài Viết Nổi Bật' });
      }
      if (data?.photoGallery && data.photoGallery.length > 1) {
        items.push({ id: 'bo-suu-tap-anh', label: 'Bộ Sưu Tập Ảnh' });
      }
      items.push({ id: 'tim-hieu-them', label: 'Bài Viết Liên Quan' });
    }

    return items;
  }, [data, isBoDeTam]);

  const [activeSection, setActiveSection] = useState('intro');

  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((it) => it.id === activeSection)) {
      setActiveSection(navItems[0].id);
    }
  }, [navItems, activeSection]);

  const sidebarTitle = isBoDeTam
    ? 'BỒ ĐỀ TÂM'
    : (data?.title || 'TÔNG CHỈ TU HỌC').length > 18
      ? (data?.title || 'TÔNG CHỈ TU HỌC').split('-')[0].trim()
      : data?.title || 'TÔNG CHỈ TU HỌC';

  const [activeKeywordPopup, setActiveKeywordPopup] = useState<{
    keyword: string;
    title: string;
    description: string;
    imageUrl?: string;
    linkUrl?: string;
  } | null>(null);

  const handlePrevPhoto = () => {
    if (activePhotoIndex !== null && data?.photoGallery) {
      setActivePhotoIndex(
        activePhotoIndex === 0 ? data.photoGallery.length - 1 : activePhotoIndex - 1
      );
    }
  };

  const handleNextPhoto = () => {
    if (activePhotoIndex !== null && data?.photoGallery) {
      setActivePhotoIndex(
        activePhotoIndex === data.photoGallery.length - 1 ? 0 : activePhotoIndex + 1
      );
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 300);

      // Quét tìm section đang active theo độ cuộn viewport
      const scrollPosition = window.scrollY + 200;
      let matchedId = navItems[0]?.id || '';

      for (let i = 0; i < navItems.length; i++) {
        const item = navItems[i];
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          if (scrollPosition >= top) {
            matchedId = item.id;
          }
        }
      }

      // Nếu người dùng cuộn đến gần cuối trang, kích hoạt mục cuối cùng
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        matchedId = navItems[navItems.length - 1]?.id || matchedId;
      }

      if (matchedId) {
        setActiveSection(matchedId);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [navItems]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 130;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#2c1c11] text-[#FFE5A3] font-sans relative selection:bg-[#f2cc8f] selection:text-black overflow-x-clip md:overflow-x-hidden">
      <SubNavbar
        activeSection={activeSection}
        isScrolled={isScrolled}
        onScrollToSection={scrollToSection}
        pageTitle={sidebarTitle}
        navItems={navItems}
      />
      <SidebarNav
        activeSection={activeSection}
        isScrolled={isScrolled}
        onScrollToSection={scrollToSection}
        pageTitle={sidebarTitle}
        navItems={navItems}
      />

      <div
        className={`w-full transition-all duration-500 ${isScrolled ? 'pl-4 md:pl-24' : 'pl-4'} pr-4 md:pr-12`}
      >
        <HeroBanner
          id="tong-chi-tu-hoc"
          bannerUrl={data?.heroBanner}
          bannerPosition={data?.bannerPosition}
          title={data?.title}
          subtitle={data?.subtitle}
        />

        <main className="max-w-5xl mx-auto pt-4 pb-16 space-y-16 w-full">
          {/* KHỐI BÀI THƠ / NỘI DUNG CHÍNH */}
          {/* KHỐI BÀI VIẾT / INFOGRAPHIC TRỰC QUAN / BÀI THƠ */}
          <section id="bai-tho" className="scroll-mt-24 relative pt-2">
            {data?.poemContent && (
              <InfographicArticleRenderer
                rawContent={data.poemContent}
                title={data.title}
                subtitle={data.subtitle}
                author={data.author}
                authorLink={data.authorLink}
                popups={data.popups}
                onKeywordClick={(kw) => {
                  const matchedPopup = data?.popups?.find((p) => {
                    const popupKeyword = (p.keyword || '')
                      .replace(/[.,;:]+$/, '')
                      .trim()
                      .toLowerCase();
                    const popupTitle = (p.title || '')
                      .replace(/[.,;:]+$/, '')
                      .trim()
                      .toLowerCase();
                    const cleanClickedText = kw
                      .replace(/[.,;:]+$/, '')
                      .trim()
                      .toLowerCase();

                    return (
                      popupKeyword === cleanClickedText ||
                      popupTitle === cleanClickedText ||
                      (popupKeyword && cleanClickedText.includes(popupKeyword)) ||
                      (cleanClickedText && popupKeyword.includes(cleanClickedText))
                    );
                  });

                  if (matchedPopup) {
                    setActiveKeywordPopup({
                      keyword: matchedPopup.keyword || kw,
                      title: matchedPopup.title || kw.toUpperCase(),
                      description: matchedPopup.description || 'Chưa có thông tin chú thích.',
                      imageUrl: matchedPopup.imageUrl || '',
                      linkUrl: matchedPopup.linkUrl || '#',
                    });
                  }
                }}
              />
            )}
          </section>

          {/* ── TÀI NGUYÊN LIÊN QUAN & NGUỒN THAM KHẢO ── */}
          {isBoDeTam ? (
            /* 🪷 Đối với bài Bồ Đề Tâm: Hiển thị khối Tài Nguyên Liên Quan nhỏ gọn (3 thẻ ngang), không trùng lặp */
            <TaiNguyenLienQuanCompact
              videoBlock={data?.videoBlock}
              sourceBook={data?.sourceBook}
              photoGallery={data?.photoGallery}
              heroBanner={data?.heroBanner}
              onSelectPhoto={(idx) => setActivePhotoIndex(idx)}
            />
          ) : (
            <>
              <div id="tai-nguyen-lien-quan" className="space-y-12">
                <BookCitationSection sourceBook={data?.sourceBook} />

                {data?.videoBlock?.videoUrl && (
                  <IllustrationVideo heroBanner={data?.heroBanner} videoBlock={data?.videoBlock} />
                )}

                {data?.featuredArticle?.title && (
                  <FeaturedPosts
                    heroBanner={data?.heroBanner}
                    featuredArticle={data?.featuredArticle}
                  />
                )}

                {data?.photoGallery && data.photoGallery.length > 1 && (
                  <PhotoGallery photoGallery={data?.photoGallery} />
                )}
              </div>

              <DiscoverMore relatedArticles={data?.relatedArticles} />
            </>
          )}
        </main>

        <DetailModal
          activePhotoIndex={null}
          photoGallery={[]}
          onClosePhotoModal={() => {}}
          onPrevPhoto={() => {}}
          onNextPhoto={() => {}}
          onSelectPhotoIndex={() => {}}
          activeKeywordPopup={activeKeywordPopup}
          onCloseKeywordPopup={() => setActiveKeywordPopup(null)}
        />
      </div>
    </div>
  );
}
