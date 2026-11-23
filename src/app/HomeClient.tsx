"use client";

import { FC, useEffect, useState } from "react";
import Header from "@/components/public/layout/Header";
import Footer from "@/components/public/layout/Footer";
import Hero from "@/features/home/components/Hero";
import NewsSection from "@/features/home/components/NewsSection";
import WelcomeSection from "@/features/home/components/WelcomeSection";
import QuotesSection from "@/features/home/components/QuotesSection";
import DharmaSection from "@/features/home/components/DharmaSection";
import CalendarSection from "@/features/home/components/CalendarSection";
import GallerySection from "@/features/home/components/GallerySection";
import type { HomeGalleryArea, HomeGalleryStatue } from "@/lib/v3-home";
import type { HomeHero } from "@/lib/v3-home-content";
import type { HomeNewsItem } from "@/lib/v3-home-news";
import type { HomeQuotes } from "@/lib/v3-home-quotes";
import type { HomeWelcome } from "@/lib/v3-home-welcome";
import type { PostItem } from "@/types/post";
import { VerticalAnchorNav } from "@/components/common/VerticalAnchorNav";
import { WelcomeNoticeModal } from "@/components/public/modals/WelcomeNoticeModal";

/** The anchors of the page; "Lời chào" and "Lời Thầy" are there only when the admin has content for them. */
const homeSections = (hasWelcome: boolean, hasQuotes: boolean) => [
  { id: "hero", label: "NƠI ĐỂ TRỞ VỀ" },
  ...(hasWelcome ? [{ id: "loi-chao", label: "LỜI CHÀO" }] : []),
  { id: "news", label: "TIN MỚI NHẤT" },
  { id: "dharma", label: "DẤU ẤN HOẰNG PHÁP" },
  ...(hasQuotes ? [{ id: "loi-thay", label: "LỜI THẦY DẠY" }] : []),
  { id: "calendar", label: "LỊCH TU HỌC" },
  { id: "gallery", label: "KHU VỰC & BẢO TƯỢNG" },
];

type HomeProps = {
  gallery: { areas: HomeGalleryArea[]; statues: HomeGalleryStatue[] };
  /** Chữ và video đầu trang do admin đặt (home.hero, home.welcome). */
  hero: HomeHero;
  /** Dấu ấn hoằng pháp: các bài đọc nhiều nhất theo lượt xem thật; `null` thì khối giữ bộ thẻ dự phòng. */
  dharma: PostItem[] | null;
  /** Lời chào, số liệu và Phật lịch (home.welcome, home.stats, home.buddhist_year); `null` thì không vẽ khối. */
  welcome: HomeWelcome | null;
  /** Lời Thầy dạy (home.quotes + bảng quote); `null` thì không vẽ khối. */
  quotes: HomeQuotes | null;
  /** Tin mới nhất đọc từ D1 ngay ở máy chủ; `null` thì khối tự hỏi API một lần. */
  news: HomeNewsItem[] | null;
};

const Home: FC<HomeProps> = ({ gallery, hero, dharma, welcome, quotes, news }) => {
  const [scrollY, setScrollY] = useState<number>(0);

  useEffect(() => {
    const onScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{ background: "#1A120B" }}
      className="min-h-screen overflow-x-hidden relative font-sans text-[#e3d2c1] selection:bg-[#F2C14E] selection:text-black"
    >
      {/* ── THANH NEO DỌC SANG BÊN PHẢI MÀN HÌNH ── */}
      <VerticalAnchorNav pageTitle="TRANG CHỦ" sections={homeSections(!!welcome, !!quotes?.items.length)} />

      {/* ── POPUP THÔNG BÁO LẦN ĐẦU MỞ WEB (V1.0.0) ── */}
      <WelcomeNoticeModal />

      <Header scrolled={scrollY > 64} />

      <main>
        {/* Section 0: Hero Video Banner */}
        <section id="hero">
          <Hero hero={hero} />
        </section>

        {/* Section 1b: Lời chào, số liệu và Phật lịch (admin: Trang chủ) */}
        <WelcomeSection welcome={welcome} />

        {/* Section 2: News */}
        <section id="news">
          <NewsSection items={news} />
        </section>

        {/* Section 3: Dharma */}
        <section id="dharma">
          <DharmaSection posts={dharma} />
        </section>

        {/* Section 3b: Lời Thầy dạy (admin: Lời Thầy + Trang chủ) */}
        {quotes?.items.length ? (
          <div id="loi-thay">
            <QuotesSection quotes={quotes} />
          </div>
        ) : null}

        {/* Section 4: Calendar */}
        <section id="calendar">
          <CalendarSection />
        </section>

        {/* Section 5: Featured Areas & Statues */}
        <section id="gallery">
          <GallerySection areas={gallery.areas} statues={gallery.statues} />
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;
