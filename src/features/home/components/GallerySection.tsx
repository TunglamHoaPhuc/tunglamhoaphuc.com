'use client';
import { fitImage } from '@/utils/image';
import { imageSrcSet } from '@/lib/tlhp-content/media';

import { FC, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight, MapPin, Landmark, Scroll, BookOpen, Sun, HandHeart } from "lucide-react";
import { SectionHeader } from "@/components/common/SectionHeader";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { SectionTransitionOverlay } from "@/components/common/SectionTransitionOverlay";

interface AreaItem {
  id: string;
  name: string;
  subtitle: string;
  imgUrl: string;
  targetUrl: string;
  iconName?: string;
  logoUrl?: string; // WordPress CMS logo URL
}

interface StatueItem {
  id: string;
  name: string;
  cluster: string;
  area: string;
  imgUrl: string;
  targetUrl: string;
  iconName?: string;
  logoUrl?: string;
  imgPosition?: string;
}

// Khu vực và tượng nổi bật do máy chủ chọn từ D1 (page.tsx, lib/v3-home.ts): cái nào ẩn hay đã xóa thì không có ở đây.
interface GallerySectionProps {
  areas: AreaItem[];
  statues: StatueItem[];
}

export const GallerySection: FC<GallerySectionProps> = ({ areas: FEATURED_AREAS, statues: FEATURED_STATUES }) => {
  const [areaIdx, setAreaIdx] = useState(0);
  const [statueIdx, setStatueIdx] = useState(0);

  const currentArea = FEATURED_AREAS[areaIdx];
  const prevAreaIdx = (areaIdx - 1 + FEATURED_AREAS.length) % FEATURED_AREAS.length;
  const nextAreaIdx = (areaIdx + 1) % FEATURED_AREAS.length;

  const prevArea = FEATURED_AREAS[prevAreaIdx];
  const nextArea = FEATURED_AREAS[nextAreaIdx];

  const currentStatue = FEATURED_STATUES[statueIdx];
  const prevStatueIdx = (statueIdx - 1 + FEATURED_STATUES.length) % FEATURED_STATUES.length;
  const nextStatueIdx = (statueIdx + 1) % FEATURED_STATUES.length;

  const prevStatue = FEATURED_STATUES[prevStatueIdx];
  const nextStatue = FEATURED_STATUES[nextStatueIdx];

  return (
    <div className="w-full space-y-10 md:space-y-24 py-12 md:py-16 bg-[#1A120B] relative">
      {/* ── Seamless Gradient Blur Overlay ── */}
      <SectionTransitionOverlay position="both" />

      {/* ══════════════════════════════════════════════════════
          1. SECTION CÁC KHU VỰC NỔI BẬT (Slider Tỉ Lệ Vàng Mở Rộng)
      ══════════════════════════════════════════════════════ */}
      {FEATURED_AREAS.length > 0 && (
      <section className="relative overflow-visible w-full pt-2">

        {/* ── 1. Header Section ── */}
        <SectionHeader
          title="CÁC KHU VỰC NỔI BẬT"
          subtitle="Sơ đồ kiến trúc & Không gian tâm linh Tùng Lâm Hòa Phúc"
          iconUrl="/images/icons/icon-cac-khu-vuc-noi-bat-160.webp"
        />

        {/* ── 2. Container Slider ── */}
        <div className="w-full overflow-hidden relative flex justify-center items-center py-6 sm:min-h-[460px]">

          {/* ✦ ẢNH CHỜ TRÁI (DẠT SÁT RÌA BÊN TRÁI MÀN HÌNH) ✦ */}
          <div
            onClick={() => setAreaIdx(prevAreaIdx)}
            className="hidden xl:block absolute -left-10 md:-left-8 top-1/2 -translate-y-1/2 w-16 md:w-20 h-[80%] rounded-r-2xl overflow-hidden opacity-30 grayscale brightness-50 hover:opacity-65 transition-all duration-300 cursor-pointer z-0 border-y border-r border-[#F2C14E]/30 shadow-2xl"
            title={`Xem khu vực: ${prevArea.name}`}
          >
            <img width={640} height={480} loading="lazy" decoding="async"
              src={fitImage(prevArea.imgUrl, 360)}
              alt={prevArea.name}
              className="w-full h-full object-cover object-left"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* ✦ SLIDE CHÍNH Ó GIỮA (TO HƠN, TỈ LỆ VÀNG 1.618 : 1) ✦ */}
          <div className="w-full sm:w-[88%] md:w-[84%] max-w-5xl sm:aspect-[1.618/1] relative z-10 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-[#F2C14E]/60 group mx-auto">
            <div className="relative aspect-[1.618/1] sm:contents">
            <img width={640} height={480} loading="lazy" decoding="async"
              src={fitImage(currentArea.imgUrl, 960)}
              srcSet={imageSrcSet(currentArea.imgUrl, [640, 960, 1280, 1920])}
              sizes="(min-width: 1280px) 1024px, (min-width: 768px) 84vw, (min-width: 640px) 88vw, 100vw"
              alt={currentArea.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1008]/95 via-black/20 to-transparent" />

            {/* Nút Mũi Tên Trái */}
            <button
              onClick={() => setAreaIdx(prevAreaIdx)}
              className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-40 w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#2A1D14]/90 text-[#F2C14E] border border-[#F2C14E]/70 flex items-center justify-center hover:scale-110 hover:bg-[#F2C14E] hover:text-black transition-all shadow-xl cursor-pointer"
              aria-label="Khu vực trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Nút Mũi Tên Phải */}
            <button
              onClick={() => setAreaIdx(nextAreaIdx)}
              className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-40 w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#2A1D14]/90 text-[#F2C14E] border border-[#F2C14E]/70 flex items-center justify-center hover:scale-110 hover:bg-[#F2C14E] hover:text-black transition-all shadow-xl cursor-pointer"
              aria-label="Khu vực sau"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            </div>
            {/* ✦ 3. THANH CHÚ THÍCH NỔI CÂN ĐỐI HOÀN HẢO 3 Ô ✦ */}
            <div className="relative sm:absolute sm:bottom-3 sm:left-3 sm:right-3 md:bottom-5 md:left-5 md:right-5 bg-[#1A1008] sm:bg-[#1A1008]/85 backdrop-blur-md border-0 border-t sm:border border-[#F2C14E]/40 rounded-none sm:rounded-xl flex-wrap sm:flex-nowrap gap-x-2 gap-y-2 p-2.5 md:p-3.5 flex items-center justify-between shadow-2xl z-30">

              {/* Ô 1: Logo Khu Vực (Căn chính giữa khoang bên trái) */}
              <div className="w-auto sm:w-28 md:w-36 flex items-center justify-center shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-[#2C1E11] border border-[#F2C14E]/50 flex items-center justify-center p-1.5 shadow-md">
                  <CategoryIcon
                    categoryName={currentArea.name}
                    iconName={currentArea.iconName}
                    iconUrl={currentArea.logoUrl}
                    className="w-6 h-6 md:w-7 md:h-7 text-[#F2C14E]"
                  />
                </div>
              </div>

              {/* Vạch Gradient Mềm Mại 1 */}
              <div className="hidden sm:block w-[1px] h-8 md:h-10 bg-gradient-to-b from-transparent via-[#F2C14E]/60 to-transparent shrink-0 mx-1" />

              {/* Ô 2: Nội dung Tên & Mô Tả (Căn chính giữa tâm tuyệt đối) */}
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2 md:px-4 min-w-0 overflow-visible">
                <h3
                  className="text-lg sm:text-2xl md:text-3xl font-normal uppercase tracking-wider text-[#F2C14E] leading-tight sm:leading-normal py-1 sm:py-1.5 w-full whitespace-normal sm:whitespace-nowrap overflow-visible"
                  style={{
                    fontFamily: "'UTM Niagara', 'Playfair Display', serif",
                    textShadow: "0 0 16px rgba(242,193,78,0.65), 0 0 32px rgba(242,193,78,0.35)",
                  }}
                >
                  {currentArea.name}
                </h3>
                <p
                  className="text-xs md:text-sm text-[#E2C89B]/90 truncate w-full mt-0.5"
                  style={{ fontFamily: "'UTM Avo', sans-serif" }}
                >
                  {currentArea.subtitle}
                </p>
              </div>

              {/* Vạch Gradient Mềm Mại 2 */}
              <div className="hidden sm:block w-[1px] h-8 md:h-10 bg-gradient-to-b from-transparent via-[#F2C14E]/60 to-transparent shrink-0 mx-1" />

              {/* Ô 3: Nút Khám Phá (Căn chính giữa khoang bên phải) */}
              <div className="w-auto sm:w-28 md:w-36 flex items-center justify-center shrink-0">
                <Link prefetch={false}
                  href={currentArea.targetUrl}
                  className="border border-[#F2C14E] text-[#F2C14E] hover:bg-[#F2C14E] hover:text-black transition-all px-3 md:px-4 min-h-11 md:min-h-0 py-1.5 md:py-2 text-xs md:text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 rounded-full shadow-md uppercase"
                  style={{ fontFamily: "'UTM Avo', sans-serif" }}
                >
                  <span>KHÁM PHÁ</span>
                  <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>

            </div>
          </div>

          {/* ✦ ẢNH CHỜ PHẢI (DẠT SÁT RÌA BÊN PHẢI MÀN HÌNH) ✦ */}
          <div
            onClick={() => setAreaIdx(nextAreaIdx)}
            className="hidden xl:block absolute -right-10 md:-right-8 top-1/2 -translate-y-1/2 w-16 md:w-20 h-[80%] rounded-l-2xl overflow-hidden opacity-30 grayscale brightness-50 hover:opacity-65 transition-all duration-500 cursor-pointer z-0 border-y border-l border-[#F2C14E]/30 shadow-2xl"
            title={`Xem khu vực: ${nextArea.name}`}
          >
            <img width={640} height={480} loading="lazy" decoding="async"
              src={fitImage(nextArea.imgUrl, 360)}
              alt={nextArea.name}
              className="w-full h-full object-cover object-right"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>

        </div>

        {/* Footer Link Xem Tất Cả */}
        <div className="text-center mt-6">
          <Link prefetch={false}
            href="/vu-tru-phat-giao"
            className="inline-flex items-center gap-2 min-h-11 text-xs uppercase font-bold text-[#F2C14E] tracking-widest hover:underline"
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
          >
            <span>XEM TẤT CẢ KHU VỰC (BẢN ĐỒ 2D) ➔</span>
          </Link>
        </div>
      </section>
      )}

      {/* ══════════════════════════════════════════════════════
          2. SECTION CÁC BẢO TƯỢNG NỔI BẬT (Slider Tỉ Lệ Vàng & Thanh Chú Thích 4 Khoang)
      ══════════════════════════════════════════════════════ */}
      {FEATURED_STATUES.length > 0 && (
      <section className="relative overflow-visible w-full pt-2">
        <SectionHeader
          title="CÁC BẢO TƯỢNG NỔI BẬT"
          iconUrl="/images/icons/icon-cac-bao-tuong-noi-bat-224.webp?v=2"
          iconClassName="h-16 sm:h-20 md:h-24 lg:h-28 w-auto max-w-[160px] object-contain drop-shadow-[0_0_20px_rgba(242,193,78,0.75)] transition-all duration-300 hover:scale-110"
        />

        <div className="w-full overflow-hidden relative flex justify-center items-center py-6 sm:min-h-[460px]">

          {/* ✦ ẢNH CHỜ TRÁI (DẠT SÁT RÌA BÊN TRÁI MÀN HÌNH) ✦ */}
          <div
            onClick={() => setStatueIdx(prevStatueIdx)}
            className="hidden xl:block absolute -left-10 md:-left-8 top-1/2 -translate-y-1/2 w-16 md:w-20 h-[80%] rounded-r-2xl overflow-hidden opacity-30 grayscale brightness-50 hover:opacity-65 transition-all duration-300 cursor-pointer z-0 border-y border-r border-[#F2C14E]/30 shadow-2xl"
            title={`Xem tượng: ${prevStatue.name}`}
          >
            <img width={640} height={480} loading="lazy" decoding="async"
              src={fitImage(prevStatue.imgUrl, 360)}
              alt={prevStatue.name}
              className="w-full h-full object-cover object-left"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* ✦ SLIDE CHÍNH Ó GIỮA (TỈ LỆ VÀNG 1.618 : 1) ✦ */}
          <div className="w-full sm:w-[88%] md:w-[84%] max-w-5xl sm:aspect-[1.618/1] relative z-10 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-[#F2C14E]/60 group mx-auto">
            <div className="relative aspect-[1.618/1] sm:contents">
            <img width={640} height={480} loading="lazy" decoding="async" src={fitImage(currentStatue.imgUrl, 960)} srcSet={imageSrcSet(currentStatue.imgUrl, [640, 960, 1280, 1920])} sizes="(min-width: 1280px) 1024px, (min-width: 768px) 84vw, (min-width: 640px) 88vw, 100vw" alt={currentStatue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: currentStatue.imgPosition || 'center center' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1008]/95 via-black/20 to-transparent" />

            <button
              onClick={() => setStatueIdx(prevStatueIdx)}
              className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-40 w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#2A1D14]/90 text-[#F2C14E] border border-[#F2C14E]/70 flex items-center justify-center hover:scale-110 hover:bg-[#F2C14E] hover:text-black transition-all shadow-xl cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={() => setStatueIdx(nextStatueIdx)}
              className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-40 w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#2A1D14]/90 text-[#F2C14E] border border-[#F2C14E]/70 flex items-center justify-center hover:scale-110 hover:bg-[#F2C14E] hover:text-black transition-all shadow-xl cursor-pointer"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            </div>
            {/* ✦ THANH CHÚ THÍCH BẢO TƯỢNG 4 KHOANG & ĐƯỜNG KẺ GRADIENT / TRANSPARENT ✦ */}
            <div className="relative sm:absolute sm:bottom-3 sm:left-3 sm:right-3 md:bottom-5 md:left-5 md:right-5 bg-[#1A1008] sm:bg-[#1A1008]/85 backdrop-blur-md border-0 border-t sm:border border-[#F2C14E]/40 rounded-none sm:rounded-xl flex-wrap sm:flex-nowrap gap-x-2 gap-y-2 px-4 py-3 md:py-4 flex items-center justify-between shadow-2xl z-30">
              
              {/* Khoang 1 (Logo - Bên trái): w-24 md:w-32 flex items-center justify-center shrink-0 */}
              <div className="w-auto sm:w-24 md:w-32 flex items-center justify-center shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-[#2C1E11] border border-[#F2C14E]/50 flex items-center justify-center p-1.5 shadow-md">
                  <CategoryIcon
                    categoryName={currentStatue.name}
                    iconName={currentStatue.iconName}
                    iconUrl={currentStatue.logoUrl}
                    className="w-6 h-6 md:w-7 md:h-7 text-[#F2C14E]"
                  />
                </div>
              </div>

              {/* Vạch đứng 1: Gradient mờ dần hai đầu (w-[1px] h-10 md:h-12 mx-2) */}
              <div className="hidden sm:block w-[1px] h-10 md:h-12 bg-gradient-to-b from-transparent via-[#F2C14E]/60 to-transparent shrink-0 mx-2" />

              {/* Khoang 2 (Tên Bảo Tượng - UTM Niagara): flex-1 px-2 md:px-4 text-center min-w-0 */}
              <div className="flex-1 px-2 md:px-4 flex flex-col items-center justify-center text-center min-w-0 overflow-visible">
                <h3
                  className="text-lg sm:text-2xl md:text-3xl font-normal uppercase tracking-wider text-[#F2C14E] leading-tight sm:leading-normal py-1 sm:py-1.5 w-full whitespace-normal sm:whitespace-nowrap overflow-visible"
                  style={{
                    fontFamily: "'UTM Niagara', 'Playfair Display', serif",
                    textShadow: "0 0 16px rgba(242,193,78,0.65), 0 0 32px rgba(242,193,78,0.35)",
                  }}
                >
                  {currentStatue.name}
                </h3>
              </div>

              {/* Vạch đứng 2: Gradient mờ dần hai đầu (w-[1px] h-10 md:h-12 mx-2) */}
              <div className="hidden sm:block w-[1px] h-10 md:h-12 bg-gradient-to-b from-transparent via-[#F2C14E]/60 to-transparent shrink-0 mx-2" />

              {/* Khoang 3 (Cụm Tượng & Khu Vực - 2 Tầng): flex-1 px-2 md:px-4 text-center shrink-0 min-w-0 */}
              <div className="flex-none sm:flex-1 w-full sm:w-auto order-last sm:order-none px-2 md:px-4 flex flex-col items-center justify-center text-center shrink-0 min-w-0 py-0.5">
                {/* Tầng trên: CỤM TƯỢNG */}
                <div className="text-xs text-[#E2C89B]/90 truncate w-full flex items-center justify-center gap-1" style={{ fontFamily: "'UTM Avo', sans-serif" }}>
                  <span className="text-[#F2C14E] font-bold">CỤM TƯỢNG:</span>
                  <span className="uppercase text-amber-100 font-semibold">{currentStatue.cluster || "SA-BÀ THẾ GIỚI"}</span>
                </div>

                {/* Vạch kẻ ngang phân cách mờ Transparent/Gradient */}
                <div className="h-[1px] w-full max-w-[200px] bg-gradient-to-r from-transparent via-[#F2C14E]/35 to-transparent my-1 mx-auto" />

                {/* Tầng dưới: KHU VỰC */}
                <div className="text-xs text-[#E2C89B]/90 truncate w-full flex items-center justify-center gap-1" style={{ fontFamily: "'UTM Avo', sans-serif" }}>
                  <span className="text-[#F2C14E] font-bold">KHU VỰC:</span>
                  <span className="uppercase text-amber-100 font-semibold">{currentStatue.area || "TAM BẢO"}</span>
                </div>
              </div>

              {/* Vạch đứng 3: Gradient mờ dần hai đầu (w-[1px] h-10 md:h-12 mx-2) */}
              <div className="hidden sm:block w-[1px] h-10 md:h-12 bg-gradient-to-b from-transparent via-[#F2C14E]/60 to-transparent shrink-0 mx-2" />

              {/* Khoang 4 (Nút Khám Phá - Bên phải): w-28 md:w-36 flex items-center justify-center shrink-0 */}
              <div className="w-auto sm:w-28 md:w-36 flex items-center justify-center shrink-0">
                <Link prefetch={false}
                  href={currentStatue.targetUrl}
                  className="border border-[#F2C14E] text-[#F2C14E] hover:bg-[#F2C14E] hover:text-black transition-all px-3 md:px-5 min-h-11 md:min-h-0 py-1.5 md:py-2 text-xs md:text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 rounded-full shadow-md uppercase"
                  style={{ fontFamily: "'UTM Avo', sans-serif" }}
                >
                  <span>KHÁM PHÁ</span>
                  <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>

            </div>
          </div>

          {/* ✦ ẢNH CHỜ PHẢI (DẠT SÁT RÌA BÊN PHẢI MÀN HÌNH) ✦ */}
          <div
            onClick={() => setStatueIdx(nextStatueIdx)}
            className="hidden xl:block absolute -right-10 md:-right-8 top-1/2 -translate-y-1/2 w-16 md:w-20 h-[80%] rounded-l-2xl overflow-hidden opacity-30 grayscale brightness-50 hover:opacity-65 transition-all duration-500 cursor-pointer z-0 border-y border-l border-[#F2C14E]/30 shadow-2xl"
            title={`Xem tượng: ${nextStatue.name}`}
          >
            <img width={640} height={480} loading="lazy" decoding="async"
              src={fitImage(nextStatue.imgUrl, 360)}
              alt={nextStatue.name}
              className="w-full h-full object-cover object-right"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>

        </div>

        <div className="text-center mt-6">
          <Link prefetch={false}
            href="/bao-tuong-phat-giao"
            className="inline-flex items-center gap-2 min-h-11 text-xs uppercase font-bold text-[#F2C14E] tracking-widest hover:underline"
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
          >
            <span>XEM TẤT CẢ BẢO TƯỢNG ➔</span>
          </Link>
        </div>
      </section>
      )}

    </div>
  );
};

export default GallerySection;