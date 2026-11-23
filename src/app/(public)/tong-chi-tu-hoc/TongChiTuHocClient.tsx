'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SectionData } from '@/types/tong-chi-tu-hoc';
import { SubNavbar } from '@/components/tong-chi-tu-hoc/SubNavbar';
import { SidebarNav } from '@/components/tong-chi-tu-hoc/SidebarNav';
import { HeroBanner } from '@/components/tong-chi-tu-hoc/HeroBanner';
import { SectionCarousel } from '@/components/tong-chi-tu-hoc/SectionCarousel';
import { PageIntro } from '@/components/tong-chi-tu-hoc/PageIntro';
import { SmartSearchAIBar } from '@/components/public/SmartSearchAIBar';

// Các khối và lời mở đầu do máy chủ dựng từ D1 (page.tsx); trang không tự đi lấy gì thêm.
export default function TongChiTuHocClient({
  sections,
  navItems,
  introHtml,
}: {
  sections: SectionData[];
  navItems: { id: string; label: string }[];
  introHtml: string;
}) {
  const [activeSection, setActiveSection] = useState('tong-chi-tu-hoc');
  const [isScrolled, setIsScrolled] = useState(false);

  // 1. THROTTLED SCROLL & INTERSECTION OBSERVER
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 350);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    const sectionElements = navItems.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: '-130px 0px -50% 0px',
        threshold: 0,
      }
    );

    sectionElements.forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      sectionElements.forEach((el) => observer.unobserve(el));
    };
  }, [navItems]);

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 130;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#2c1c11] text-[#e3d2c1] font-sans relative selection:bg-[#f2cc8f] selection:text-black overflow-x-hidden">
      <SubNavbar
        activeSection={activeSection}
        isScrolled={isScrolled}
        onScrollToSection={scrollToSection}
        pageTitle="TÔNG CHỈ TU HỌC"
        navItems={navItems}
      />
      <SidebarNav
        activeSection={activeSection}
        isScrolled={isScrolled}
        onScrollToSection={scrollToSection}
        pageTitle="TÔNG CHỈ TU HỌC"
        navItems={navItems}
      />

      <div className="px-4 sm:px-8 md:pl-20 md:pr-10">
        {/* Banner chính */}
        <HeroBanner
          emblemUrl="/images/icons/icon-tong-chi-tu-hoc.webp"
          emblemAlt="Biểu tượng Tông Chỉ Tu Học"
        />

        {/* Khối mô tả trang đầy đủ không bị cắt */}
        <PageIntro description={introHtml} />

        <main className="max-w-6xl mx-auto space-y-16 py-8 relative">
          <div className="relative z-10 space-y-16">
            {sections.map((section) => (
              <SectionCarousel key={section.id} section={section} />
            ))}
          </div>

          <div className="pt-8">
            <SmartSearchAIBar contextTitle="Tông Chỉ Tu Học Tùng Lâm Hòa Phúc" />
          </div>
        </main>
      </div>
    </div>
  );
}
