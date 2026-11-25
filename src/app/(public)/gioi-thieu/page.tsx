// Trang Giới thiệu: các chủ đề đang hiển thị ở D1 của www (chủ đề nháp, trong thùng rác thì không có thẻ; chủ đề mới
// tạo ở admin có thẻ và địa chỉ ngay). Không còn danh sách sáu chủ đề đóng gói.
import React from 'react';
import Link from 'next/link';
import { Scroll, Landmark, User, HeartHandshake, ArrowRight } from 'lucide-react';
import { liveAbout } from '@/lib/v3-live';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';
import { fitImage } from '@/utils/image';
import { imageSrcSet } from '@/lib/tlhp-content/media';

export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  title: "Giới thiệu",
  description: "Chốn già lam thanh tịnh – Nơi hội tụ truyền thống truyền thừa, tâm nguyện độ sanh và tinh hoa văn hóa Phật giáo Việt Nam.",
  path: '/gioi-thieu',
});

// Biểu tượng theo nhóm là phần thiết kế; nhóm lạ dùng biểu tượng chung.
const GROUP_ICON: Record<string, typeof Scroll> = {
  'lich-su-chua': Landmark,
  'nguoi-lien-quan': User,
  'thanh-quy-van-hoa': HeartHandshake,
};

export default async function GioiThieuOverviewPage() {
  const topics = (await liveAbout()).map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.subtitle || t.overviewSummary,
    href: `/gioi-thieu/${t.slug}`,
    icon: GROUP_ICON[t.groupCategory] ?? Scroll,
    image: t.heroBanner || t.portraitImage || '/images/hero/toan-canh-chua-1280.webp',
    tag: t.tag || t.groupCategoryName,
  }));
  return (
    <div className="min-h-screen bg-[#2A1D14] text-[#e3d2c1] selection:bg-[#F2C14E] selection:text-black flex flex-col justify-between">
      <main className="flex-1 pb-16">
        {/* ── HERO BANNER TOP ── */}
        <div className="relative w-full overflow-hidden bg-[#2A1D14] pt-28 pb-12">
          {/* Background image */}
          <img
            src="/images/hero/toan-canh-chua-1280.webp"
            alt=""
            aria-hidden="true"
            width={1280}
            height={720}
            fetchPriority="low"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[2px] pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2A1D14]/40 via-[#2A1D14]/80 to-[#2A1D14] pointer-events-none" />

          <div className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#3a2718] border border-[#f2cc8f]/40 flex items-center justify-center text-[#ffde59] mb-3 shadow-md">
              <span className="text-2xl">☸</span>
            </div>

            <div className="flex items-center justify-center w-full my-4 gap-4 md:gap-8">
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#F2C14E]/50 to-[#F2C14E]" />
              <h1
                style={{ fontFamily: "'UTM Niagara', sans-serif" }}
                className="text-4xl sm:text-5xl md:text-7xl font-normal text-[#ffde59] uppercase tracking-wider drop-shadow-[0_0_18px_rgba(242,193,78,0.7)] text-balance md:text-wrap md:whitespace-nowrap min-w-0 md:flex-shrink-0"
              >
                GIỚI THIỆU TÙNG LÂM HÒA PHÚC
              </h1>
              <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-[#F2C14E]/50 to-[#F2C14E]" />
            </div>

            <p
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className="text-sm md:text-base text-[#e3d2c1] tracking-wide font-normal max-w-2xl mx-auto px-4 leading-relaxed text-balance text-center"
            >
              Chốn già lam thanh tịnh – Nơi hội tụ truyền thống truyền thừa, tâm nguyện độ sanh và tinh hoa văn hóa Phật giáo Việt Nam.
            </p>
          </div>
        </div>

        {/* ── 6 TOPICS GRID ── */}
        <div className="max-w-[1280px] mx-auto px-4 md:px-10 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {topics.map((topic) => {
              const IconComp = topic.icon;
              return (
                <Link
                  key={topic.id}
                  href={topic.href}
                  prefetch={false}
                  className="group relative rounded-2xl overflow-hidden border border-[#F2C14E]/30 bg-[#25170E] hover:border-[#F2C14E] transition-all duration-300 shadow-xl flex flex-col hover:-translate-y-1.5 transform-gpu"
                >
                  {/* Thumbnail frame */}
                  <div className="relative w-full aspect-[16/10] overflow-hidden bg-[#1A120B]">
                    <img
                      src={fitImage(topic.image, 640)}
                      srcSet={imageSrcSet(topic.image, [360, 640, 960])}
                      sizes="(min-width: 1024px) 379px, (min-width: 768px) 45vw, 92vw"
                      alt={topic.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(to top, rgba(37,23,14,0.95) 0%, rgba(37,23,14,0.3) 60%, transparent 100%)',
                      }}
                    />

                    {/* Tag badge */}
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full border border-[#F2C14E]/60 bg-[#2C1C11]/90 text-[#F2C14E] text-xs font-bold tracking-wider uppercase backdrop-blur-xs flex items-center gap-1.5">
                      <IconComp className="w-3.5 h-3.5 text-[#F2C14E]" />
                      <span>{topic.tag}</span>
                    </div>
                  </div>

                  {/* Golden divider */}
                  <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#F2C14E]/40 to-transparent" />

                  {/* Body content */}
                  <div className="p-5 flex flex-col justify-between flex-1 bg-gradient-to-b from-[#25170E] to-[#1C130D]">
                    <div>
                      <h3
                        className="text-2xl md:text-3xl font-normal text-[#F2C14E] uppercase group-hover:text-white transition-colors duration-300 leading-tight mb-2"
                        style={{ fontFamily: "'UTM Niagara', serif" }}
                      >
                        {topic.title}
                      </h3>
                      <p
                        className="text-sm text-[#e3d2c1]/80 leading-relaxed line-clamp-3"
                        style={{ fontFamily: "'UTM Avo', sans-serif" }}
                      >
                        {topic.subtitle}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#F2C14E]/20 flex items-center justify-between text-sm sm:text-xs font-bold text-[#F2C14E] uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                      <span>XEM CHI TIẾT</span>
                      <ArrowRight className="w-4 h-4 text-[#F2C14E]" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
