'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Share2,
  Bookmark,
  Eye,
  Info,
  ChevronRight,
  Video,
  Camera,
  HeartHandshake,
} from 'lucide-react';
import Header from '@/components/public/layout/Header';
import Footer from '@/components/public/layout/Footer';
import { fitImage } from '@/utils/image';
import { imageSrcSet } from '@/lib/tlhp-content/media';
import { HeroBanner } from '@/components/tong-chi-tu-hoc/HeroBanner';
import type { HoangPhapArticle } from '@/data/dong-chay-hoang-phap-data';
import type { ScheduleDetail } from '@/lib/schedule-detail';

// Thời khóa và các bài gợi ý do máy chủ lấy từ D1 (page.tsx): không có thời khóa thì 404, không dựng trang từ slug.
export default function ScheduleDetailClient({ eventInfo, smartRelatedArticles }: { eventInfo: ScheduleDetail; smartRelatedArticles: HoangPhapArticle[] }) {
  const [copied, setCopied] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#140C07] text-[#EDE0D4] flex flex-col justify-between selection:bg-[#F2C14E] selection:text-black">
      <Header scrolled={isScrolled} />

      <main className="flex-1">
        {/* ── 1. Hero Banner Điện Ảnh Trang Nghiêm ── */}
        <HeroBanner
          title={eventInfo.title}
          subtitle={`THỜI KHÓA TU HỌC • TÙNG LÂM HÒA PHÚC`}
          bannerUrl={eventInfo.imgUrl}
          backLink="/#calendar"
          backText="Trở về Lịch Tu Học"
        />

        {/* ── 2. Nội Dung Chi Tiết Khóa Tu ── */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">

          {/* 2.1 Thanh Badge Danh Mục & Nút Tương Tác */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#F2C14E]/25">
            <div className="flex items-center gap-2.5">
              <span
                className={`text-xs sm:text-sm font-bold uppercase tracking-wider px-3.5 py-1 rounded-full border shadow-sm ${
                  eventInfo.category === 'Cộng Tu'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : eventInfo.category === 'Khóa Lễ Truyền Thống'
                    ? 'bg-red-950 text-rose-300 border-rose-500/60 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                    : 'bg-amber-950 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(242,193,78,0.3)]'
                }`}
              >
                {eventInfo.category === 'Cộng Tu' ? '🪷 CỘNG TU HỌC' : eventInfo.category === 'Khóa Lễ Truyền Thống' ? '📿 KHÓA LỄ TRUYỀN THỐNG' : '🌟 ĐẠI LỄ SỰ KIỆN'}
              </span>
              <span className="text-xs text-amber-200/70 hidden sm:inline">• Chốn Tùng Lâm Tịnh Độ</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="px-3.5 py-1.5 rounded-lg bg-[#2A170F] hover:bg-[#3D2210] border border-[#F2C14E]/40 text-[#FFE5A3] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copied ? 'Đã sao chép liên kết!' : 'Chia sẻ'}</span>
              </button>
              <Link
                href="/#calendar"
                className="px-3.5 py-1.5 rounded-lg bg-[#2A170F] hover:bg-[#3D2210] border border-[#F2C14E]/40 text-[#FFE5A3] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Bảng Lịch</span>
              </Link>
            </div>
          </div>

          {/* 2.2 Bảng Thẻ Thông Tin Thời Khóa (Tỉ Lệ Vàng, Viền Vàng Hoàng Kim) */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-[#2A170F]/95 via-[#1D0F08]/95 to-[#150A04]/98 border border-[#F2C14E]/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-md">
            <h2
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className="text-lg sm:text-xl font-bold text-[#FFDE59] uppercase tracking-wide mb-6 flex items-center gap-2.5"
            >
              <Sparkles className="w-5 h-5 text-[#F2C14E]" />
              <span>Thông Tin Thời Khóa Hành Trì</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Ô 1: Thời gian Lịch */}
              <div className="p-4 rounded-2xl bg-black/40 border border-[#F2C14E]/25 space-y-2">
                <div className="flex items-center gap-2 text-[#F2C14E]">
                  <CalendarIcon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Thời Gian</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-white leading-snug">
                  {eventInfo.solarDateStr}
                </p>
                {eventInfo.lunarDate && (
                  <p className="text-xs text-amber-200/80 font-medium">
                    {eventInfo.lunarDate}
                  </p>
                )}
              </div>

              {/* Ô 2: Khung Giờ (chỉ khi D1 có giờ) */}
              {eventInfo.timeSlot && (
              <div className="p-4 rounded-2xl bg-black/40 border border-[#F2C14E]/25 space-y-2">
                <div className="flex items-center gap-2 text-[#F2C14E]">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Khung Giờ</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-white leading-snug">
                  {eventInfo.timeSlot}
                </p>
                {eventInfo.timeSlot2 && (
                  <p className="text-xs text-amber-200/80 font-medium">
                    {eventInfo.timeSlot2}
                  </p>
                )}
              </div>
              )}

              {/* Ô 3: Địa Điểm (chỉ khi D1 có địa điểm) */}
              {eventInfo.location && (
              <div className="p-4 rounded-2xl bg-black/40 border border-[#F2C14E]/25 space-y-2">
                <div className="flex items-center gap-2 text-[#F2C14E]">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Địa Điểm</span>
                </div>
                <p className="text-sm font-bold text-white leading-snug">
                  {eventInfo.location}
                </p>
              </div>
              )}

              {/* Ô 4: Đối Tượng */}
              <div className="p-4 rounded-2xl bg-black/40 border border-[#F2C14E]/25 space-y-2">
                <div className="flex items-center gap-2 text-[#F2C14E]">
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Đối Tượng</span>
                </div>
                <p className="text-sm font-bold text-white leading-snug">
                  Đại Chúng Phật Tử
                </p>
                <p className="text-xs text-amber-200/80 font-medium">
                  Thiện nam tín nữ gần xa
                </p>
              </div>
            </div>
          </div>

          {/* 2.3 Thuyết Minh Nội Dung & Ý Nghĩa Khóa Lễ */}
          {eventInfo.description && (
          <div className="rounded-3xl p-6 sm:p-8 bg-[#1F1109]/90 border border-[#F2C14E]/30 space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xl">🪷</span>
              <h3
                style={{ fontFamily: "'UTM Avo', sans-serif" }}
                className="text-base sm:text-lg font-bold text-[#FFDE59] uppercase tracking-wide"
              >
                Ý Nghĩa & Mục Đích Hành Trì
              </h3>
            </div>

            <div className="space-y-4 text-sm sm:text-base leading-relaxed text-white/90">
              <p className="text-justify font-normal">
                {eventInfo.description}
              </p>
            </div>
          </div>
          )}

          {/* 2.4 Lưu Ý Dành Cho Phật Tử Tham Dự (Khung Nổi Bật) */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#2A1608] via-[#351C0C] to-[#2A1608] border-2 border-amber-500/50 shadow-[0_10px_30px_rgba(242,193,78,0.2)] space-y-4">
            <div className="flex items-center gap-3 text-amber-300">
              <Info className="w-5 h-5 shrink-0" />
              <h3
                style={{ fontFamily: "'UTM Avo', sans-serif" }}
                className="text-base sm:text-lg font-bold uppercase tracking-wider"
              >
                Lưu Ý Dành Cho Phật Tử Khi Tham Dự
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-amber-100/90 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Trang phục:</strong> Trang nghiêm, kín đáo. Khuyến khích mặc áo tràng lam hoặc áo tràng nâu Phật tử khi bước vào chánh điện.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Thời gian:</strong> Quý vị nên có mặt trước giờ khóa lễ từ 15 đến 30 phút để ổn định vị trí, chuẩn bị tâm thế thanh tịnh.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tác phong:</strong> Tắt hoặc chuyển điện thoại sang chế độ rung, giữ gìn thanh tịnh và tịnh khẩu nơi tôn nghiêm chốn thiền môn.
                </span>
              </div>
              {eventInfo.notes && (
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Lời dặn:</strong> {eventInfo.notes}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2.5 Video & Ảnh (nếu có) */}
          {eventInfo.videoUrl && (
            <div className="rounded-3xl p-6 bg-black/40 border border-[#F2C14E]/30 space-y-4">
              <div className="flex items-center gap-2 text-[#FFDE59]">
                <Video className="w-5 h-5" />
                <h3 className="font-bold text-base uppercase">Video Hướng Dẫn & Tư Liệu Khóa Tu</h3>
              </div>
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
                <iframe
                  src={eventInfo.videoUrl}
                  title="Video Khóa Tu"
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              3. THUẬT TOÁN GỢI Ý THÔNG MINH TỪ DÒNG CHẢY HOẰNG PHÁP
          ══════════════════════════════════════════════ */}
          {smartRelatedArticles.length > 0 && (
          <div className="pt-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-[#F2C14E]/30">
              <div>
                <div className="flex items-center gap-2 text-[#F2C14E] text-xs font-bold uppercase tracking-widest mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>KHO LƯU TRỮ HOẰNG PHÁP</span>
                </div>
                <h3
                  style={{ fontFamily: "'UTM Avo', sans-serif" }}
                  className="text-lg sm:text-2xl font-bold text-white uppercase tracking-wide"
                >
                  Ký Sự & Hình Ảnh Các Khóa Tu Tương Tự
                </h3>
                <p className="text-xs sm:text-sm text-amber-200/80 mt-1">
                  Được hệ thống tự động gợi ý thông minh từ các bài viết và phóng sự của Dòng Chảy Hoằng Pháp
                </p>
              </div>

              <Link
                href="/dong-chay-hoang-phap"
                className="text-xs font-bold text-[#FFDE59] hover:text-white flex items-center gap-1.5 transition-colors self-start sm:self-end"
              >
                <span>Xem tất cả bài viết</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Lưới Thẻ Bài Viết Gợi Ý */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {smartRelatedArticles.map((art) => (
                <div
                  key={art.id}
                  className="rounded-2xl bg-gradient-to-b from-[#2A170F]/90 to-[#180C06]/95 border border-[#F2C14E]/30 hover:border-[#F2C14E] p-3 space-y-3 shadow-lg transition-all hover:scale-[1.02] flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Ảnh Thumbnail */}
                    <div className="relative w-full h-36 rounded-xl overflow-hidden bg-black/40 border border-[#F2C14E]/20">
                      <img loading="lazy" decoding="async" width={640} height={480}
                        src={fitImage(art.thumbnailUrl || art.bannerUrl, 640)}
                        srcSet={imageSrcSet(art.thumbnailUrl || art.bannerUrl || '', [360, 640, 960])}
                        sizes="(min-width: 1024px) 270px, (min-width: 640px) 45vw, 92vw"
                        alt={art.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.removeAttribute('srcset');
                          (e.currentTarget as HTMLImageElement).src = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/04-vu-tru-phat-giao/bao-thap/bao-thap-banner.webp';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <span className="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/75 border border-[#F2C14E]/40 text-[#FFE5A3]">
                        {art.subCategory || 'KÝ SỰ KHÓA TU'}
                      </span>
                    </div>

                    {/* Tiêu Đề Bài Viết */}
                    <h4
                      style={{ fontFamily: "'UTM Avo', sans-serif" }}
                      className="text-xs sm:text-sm font-bold text-[#FFDE59] uppercase tracking-wide group-hover:text-white transition-colors line-clamp-2 leading-snug"
                    >
                      {art.title}
                    </h4>

                    {/* Tóm tắt */}
                    <p className="text-[11px] sm:text-xs text-[#FFE5A3]/80 line-clamp-2 leading-relaxed">
                      {art.summary}
                    </p>
                  </div>

                  {/* Nút Xem Ký Sự */}
                  <Link
                    href={`/dong-chay-hoang-phap/${art.slug}`}
                    className="w-full py-2 px-3 rounded-lg bg-[#3D2210] hover:bg-[#F2C14E] text-[#FFE5A3] hover:text-[#1A120B] border border-[#F2C14E]/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>Đọc Ký Sự</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              4. KHỐI CTA QUAY LẠI LỊCH TU HỌC & ĐĂNG KÝ
          ══════════════════════════════════════════════ */}
          <div className="rounded-3xl p-8 bg-gradient-to-r from-[#201007] via-[#2D1609] to-[#201007] border border-[#F2C14E]/40 text-center space-y-4 shadow-2xl">
            <div className="inline-flex p-3 rounded-full bg-[#F2C14E]/10 border border-[#F2C14E]/30 text-[#F2C14E]">
              <HeartHandshake className="w-8 h-8" />
            </div>

            <h3
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider"
            >
              Phát Tâm Tinh Tấn Hành Trì Chánh Pháp
            </h3>

            <p className="max-w-xl mx-auto text-xs sm:text-sm text-amber-200/90 leading-relaxed">
              Mọi thời khóa tu học tại Tùng Lâm Hòa Phúc đều rộng mở đón chào quý thiện nam tín nữ Phật tử gần xa về chùa kết duyên lành, nuôi dưỡng an lạc cho tự thân và gia đình.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/#calendar"
                className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#A3520A] via-[#C87515] to-[#A3520A] hover:from-[#B85D0B] hover:to-[#C87515] text-white font-bold text-xs sm:text-sm tracking-wide uppercase border border-[#F2C14E] shadow-[0_4px_15px_rgba(200,117,21,0.4)] transition-all hover:scale-105 cursor-pointer"
              >
                Quay Lại Lịch Tu Học
              </Link>
              <Link
                href="/dong-chay-hoang-phap"
                className="py-2.5 px-6 rounded-xl bg-black/60 hover:bg-[#3D2210] text-[#FFE5A3] font-bold text-xs sm:text-sm tracking-wide uppercase border border-[#F2C14E]/40 transition-all hover:scale-105 cursor-pointer"
              >
                Dòng Chảy Hoằng Pháp
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
