'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/public/layout/Header';
import Footer from '@/components/public/layout/Footer';
import type { V3Area } from '@/lib/v3-data';
import type { StatueItem } from '@/lib/statue-types';
import { TAM_BAO_VIDEOS } from '@/data/tam-bao-detail-data';
import { SubNavbar } from '@/components/tong-chi-tu-hoc/SubNavbar';
import { SidebarNav } from '@/components/tong-chi-tu-hoc/SidebarNav';
import { HeroBanner } from '@/components/tong-chi-tu-hoc/HeroBanner';
import { StatueCollectionGrid } from '@/features/universe/components/StatueCollectionGrid';
import { ArtisticStatueSection } from '@/features/universe/components/ArtisticStatueSection';
import { RelatedStoriesSection } from '@/features/universe/components/RelatedStoriesSection';
import { SpaceGallerySection } from '@/features/universe/components/SpaceGallerySection';
import { OtherAreasSection } from '@/features/universe/components/OtherAreasSection';
import { ThuVienGrid } from '@/features/universe/components/ThuVienGrid';
import { TuAnVangSinhSystem } from '@/features/universe/components/TuAnVangSinhSystem';
import { BaoThapGrid } from '@/features/universe/components/BaoThapGrid';
import { BaoTangGrid } from '@/features/universe/components/BaoTangGrid';
import { DaiNamQuocMauGrid } from '@/features/universe/components/DaiNamQuocMauGrid';
import { CongTamQuanSection } from '@/features/universe/components/CongTamQuanSection';
import { ChayDuongSection } from '@/features/universe/components/ChayDuongSection';
import { ThapBatLaHanGrid } from '@/features/universe/components/ThapBatLaHanGrid';
import { ThapDaiDeTuCards } from '@/features/universe/components/ThapDaiDeTuCards';
import { GiangDuongPhapThoai } from '@/features/universe/components/GiangDuongPhapThoai';
import { DanhTangMap } from '@/features/universe/components/DanhTangMap';
import { TuAnFlipbook } from '@/features/universe/components/TuAnFlipbook';
import { SmartSearchAIBar } from '@/components/public/SmartSearchAIBar';
import { areaBodyHtml } from '@/lib/area-body';

function matchesArea(itemAreaSlug: string, pageSlug: string, areaSlug: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const a1 = norm(itemAreaSlug);
  const a2 = norm(pageSlug);
  const a3 = norm(areaSlug);

  if (a1 === a2 || a1 === a3) return true;
  if ((a1.includes('mau') || a1.includes('dai_nam')) && (a2.includes('mau') || a2.includes('dai_nam') || a3.includes('mau') || a3.includes('dai_nam'))) return true;
  if ((a1.includes('vang_sinh') || a1.includes('tu_an')) && (a2.includes('vang_sinh') || a2.includes('tu_an') || a3.includes('vang_sinh') || a3.includes('tu_an'))) return true;
  if (a1.includes('bao_tang') && (a2.includes('bao_tang') || a3.includes('bao_tang'))) return true;
  if ((a1.includes('luan') || a1.includes('phong_sinh')) && (a2.includes('luan') || a2.includes('phong_sinh') || a3.includes('luan') || a3.includes('phong_sinh'))) return true;
  if (a1.includes('cong') && (a2.includes('cong') || a3.includes('cong'))) return true;
  return false;
}

// Khu vực do máy chủ lấy từ D1 (page.tsx): khu vực bị ẩn hay xóa là 404, không còn khu vực dựng từ slug.
// `slug` là slug của D1 (địa chỉ cũ đã được đổi về slug này), nên các khối riêng của từng khu vực chọn theo nó.
// `statues` và `artItems`: tượng chính và tác phẩm nghệ thuật đang hiển thị (D1), mỗi khối tự lọc theo khu vực.
// `areas`: các khu vực đang hiển thị (D1), cho khối "Khám phá khu vực khác".
export default function AreaDetailClient({
  area,
  statues,
  artItems,
  areas,
}: {
  area: V3Area;
  statues: StatueItem[];
  artItems: StatueItem[];
  areas: V3Area[];
}) {
  const slug = area.slug;

  const [activeSection, setActiveSection] = useState('gioi-thieu');
  const [isScrolled, setIsScrolled] = useState(false);

  const isBaoTang = slug === 'bao-tang' || slug === 'bao-tang-phat-giao';
  const isBaoThap = slug === 'bao-thap' || slug === 'bao-thap-van-phat-xa-loi';
  const isThuVien = slug === 'thu-vien' || slug === 'tang-kinh-cac';
  const isTuAn = slug === 'tu-an' || slug === 'tu-an-duong' || slug === 'vang-sinh-duong';

  const navItems = [
    { id: 'gioi-thieu', label: 'GIỚI THIỆU' },
    ...(!isBaoThap
      ? [
          { id: 'bo-suu-tap-bao-tuong', label: 'BỘ SƯU TẬP BẢO TƯỢNG' },
          { id: 'nghe-thuat-phat-giao-khu-vuc', label: 'NGHỆ THUẬT PHẬT GIÁO' },
        ]
      : []),
    {
      id: 'cau-chuyen-lien-quan',
      label: isBaoTang
        ? 'TRIỂN LÃM SỐ'
        : isBaoThap
        ? 'SƠ ĐỒ BẢO THÁP'
        : isThuVien
        ? 'TỦ SÁCH KINH ĐIỂN'
        : isTuAn
        ? 'HƯƠNG LINH KÝ TỰ'
        : 'CÂU CHUYỆN LIÊN QUAN',
    },
    { id: 'khong-gian', label: 'KHÔNG GIAN' },
    { id: 'khu-vuc-khac', label: 'KHU VỰC KHÁC' },
    { id: 'hoi-dap-ai', label: 'HỎI ĐÁP AI' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);

      const sectionIds = navItems.map((n) => n.id);
      const scrollPos = window.scrollY + 200;

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(sectionIds[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(sectionIds[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
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
    <div className="w-full min-h-screen bg-[#2c1c11] text-[#e3d2c1] font-sans relative selection:bg-[#f2cc8f] selection:text-black overflow-x-hidden">
      {/* ── TOP STICKY SUBNAVBAR & SIDEBAR NAV ── */}
      <SubNavbar
        activeSection={activeSection}
        isScrolled={isScrolled}
        onScrollToSection={scrollToSection}
        pageTitle={area.name.toUpperCase()}
        navItems={navItems}
      />
      <SidebarNav
        activeSection={activeSection}
        isScrolled={isScrolled}
        onScrollToSection={scrollToSection}
        pageTitle={area.name.toUpperCase()}
        navItems={navItems}
      />

      <div className={`w-full transition-all duration-500 ${isScrolled ? 'pl-16 md:pl-24' : 'pl-4'} pr-4 md:pr-12`}>
        {/* ── HEROBANNER ── */}
        <HeroBanner
          id="herobanner"
          bannerUrl={area.imgUrl}
          bannerPosition={area.imgPosition}
          title={area.name.toUpperCase()}
          subtitle={area.subtitle.toUpperCase()}
        />

        <main className="w-full pt-6 pb-16 space-y-16">
          {/* SECTION 1 — GIỚI THIỆU */}
          <section id="gioi-thieu" className="max-w-4xl mx-auto px-4 scroll-mt-24 relative">
            <div
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className="
                text-base sm:text-lg md:text-xl text-[#ffde59]
                leading-relaxed md:leading-loose tracking-wide
                space-y-6 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]
                text-justify
                [&>p]:text-justify [&>p]:mb-6
                [&>p:not(:first-of-type)]:indent-6 md:[&>p:not(:first-of-type)]:indent-8
                [&>p:first-of-type::first-letter]:[font-family:'UTM_ClassizismAntiqua','UTM_ClassicAntiqua',serif]
                [&>p:first-of-type::first-letter]:text-6xl md:[&>p:first-of-type::first-letter]:text-7xl
                [&>p:first-of-type::first-letter]:font-bold [&>p:first-of-type::first-letter]:text-[#ffde59]
                [&>p:first-of-type::first-letter]:mr-3 [&>p:first-of-type::first-letter]:pb-1
                [&>p:first-of-type::first-letter]:border-b-2 [&>p:first-of-type::first-letter]:border-[#ffde59]
                [&>p:first-of-type::first-letter]:float-left [&>p:first-of-type::first-letter]:leading-none
              "
              dangerouslySetInnerHTML={{
                __html: areaBodyHtml({ intro: area.description, contentHtml: area.contentHtml }),
              }}
            />
          </section>

          {/* SECTION 2 — BỘ SƯU TẬP BẢO TƯỢNG (TƯỢNG CHÍNH) - ẨN Ở TRANG BẢO THÁP */}
          {slug !== 'bao-thap' && slug !== 'bao-thap-van-phat-xa-loi' && (
            <section id="bo-suu-tap-bao-tuong" className="w-full scroll-mt-24 pt-4">
              <StatueCollectionGrid
                statues={statues}
                areaTitle={area.name}
                areaSlug={area.slug || slug}
              />
            </section>
          )}

          {/* SECTION 2B — NGHỆ THUẬT PHẬT GIÁO - ẨN Ở TRANG BẢO THÁP */}
          {slug !== 'bao-thap' && slug !== 'bao-thap-van-phat-xa-loi' && (
            <section id="nghe-thuat-phat-giao-khu-vuc" className="w-full scroll-mt-24 pt-4">
              <ArtisticStatueSection
                areaTitle={area.name}
                areaSlug={area.slug || slug}
                items={artItems}
              />
            </section>
          )}

          {/* SECTION 3 — TÍNH NĂNG CHUYÊN BIỆT THEO KHU VỰC */}
          <section id="cau-chuyen-lien-quan" className="w-full scroll-mt-24">
            {slug === 'thu-vien' || slug === 'tang-kinh-cac' ? (
              <ThuVienGrid />
            ) : slug === 'tu-an' || slug === 'tu-an-duong' || slug === 'vang-sinh-duong' ? (
              <>
                <TuAnVangSinhSystem />
                <div className="max-w-6xl mx-auto px-2 sm:px-4 mt-16">
                  <div className="text-center mb-6">
                    <span className="text-xs text-[#F2C14E] font-bold uppercase tracking-widest" style={{ fontFamily: "'UTM Avo', sans-serif" }}>
                      ❖ TƯ LIỆU LỊCH SỬ TÙNG LÂM HÒA PHÚC ❖
                    </span>
                    <h2 className="text-3xl sm:text-4xl text-[#FFE5A3] font-normal uppercase mt-1" style={{ fontFamily: "'UTM Niagara', serif" }}>
                      KỶ YẾU QUÁ TRÌNH PHỤC DỰNG NHÀ TỨ ÂN
                    </h2>
                    <p className="text-xs text-[#c9b896] max-w-xl mx-auto mt-1" style={{ fontFamily: "'UTM Avo', sans-serif" }}>
                      Cuốn sách điện tử lật trang lưu giữ toàn bộ hình ảnh, bản vẽ và quá trình đại trùng tu Nhà Tứ Ân.
                    </p>
                  </div>
                  <TuAnFlipbook />
                </div>
              </>
            ) : slug === 'bao-thap-van-phat-xa-loi' || slug === 'bao-thap' ? (
              <BaoThapGrid />
            ) : slug === 'bao-tang' || slug === 'bao-tang-phat-giao' ? (
              <BaoTangGrid />
            ) : slug === 'dai-nam-quoc-mau' ? (
              <DaiNamQuocMauGrid />
            ) : slug === 'cong-tam-quan' ? (
              <CongTamQuanSection />
            ) : slug === 'trai-duong' || slug === 'chay-duong' ? (
              <ChayDuongSection />
            ) : slug === 'san-la-han' ? (
              <ThapBatLaHanGrid />
            ) : slug === 'ho-phong-sinh' ? (
              <ThapDaiDeTuCards />
            ) : slug === 'giang-duong' ? (
              <div className="max-w-4xl mx-auto px-4">
                <GiangDuongPhapThoai />
              </div>
            ) : slug === 'to-duong' ? (
              <DanhTangMap />
            ) : (
              <div className="max-w-4xl mx-auto px-4">
                <RelatedStoriesSection
                  areaTitle={area.name}
                  stories={
                    slug === 'tam-bao'
                      ? TAM_BAO_VIDEOS.map((v) => ({
                          id: v.id,
                          title: v.title,
                          subtitle: 'Tùng Lâm Hòa Phúc',
                          summary: v.summary,
                          thumbnailUrl: v.thumbnailUrl,
                          videoUrl: v.videoUrl,
                        }))
                      : undefined
                  }
                />
              </div>
            )}
          </section>

          {/* SECTION 4 — KHÔNG GIAN TAM BẢO / KHU VỰC */}
          <section id="khong-gian" className="max-w-5xl mx-auto px-4 scroll-mt-24">
            <SpaceGallerySection
              areaTitle={area.name}
              currentSlug={area.slug}
              showOtherAreas={false}
            />
          </section>

          {/* SECTION 5 — KHÁM PHÁ KHU VỰC KHÁC */}
          <section id="khu-vuc-khac" className="max-w-4xl mx-auto px-4 scroll-mt-24">
            <OtherAreasSection currentSlug={area.slug} areas={areas} />
          </section>

          {/* SECTION 6 — HỎI ĐÁP AI */}
          <section id="hoi-dap-ai" className="max-w-4xl mx-auto px-4 scroll-mt-24 mb-12">
            <SmartSearchAIBar contextTitle={`Không Gian Tâm Linh ${area.name}`} />
          </section>
        </main>
      </div>
    </div>
  );
}
