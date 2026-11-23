// Trang Trí Tuệ Phật Pháp: các bài đang hiển thị ở D1 của www (đọc ở máy chủ). Không còn danh sách đóng gói,
// không còn lời gọi WordPress; D1 không có bài thì trang trống.
import { WisdomArchiveSection } from '@/features/wisdom/components/WisdomArchiveSection';
import { fitImage, getImageUrl } from '@/utils/image';
import { livePosts } from '@/lib/v3-live';
import { toWisdomItem, TRI_TUE_SECTION } from '@/lib/wisdom';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/v3-seo';

export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  title: "Trí Tuệ Phật Pháp",
  description: "Tổng hợp bài viết, câu chuyện, pháp âm & video lưu thông pháp bảo của Tùng Lâm Hòa Phúc.",
  path: '/tri-tue-phat-phap',
});

export default async function TriTuePhatPhapPage() {
  const items = (await livePosts(TRI_TUE_SECTION)).map(toWisdomItem);
  // Ảnh nền của đầu trang: ảnh của bài mới nhất (không có bài thì không có ảnh nền).
  // Phủ rộng cả khung nhưng mờ (opacity 0,3, mặt nạ): bản 1280 là đủ, không xin ảnh gốc.
  const headerBgImage = fitImage(getImageUrl(items[0]?.thumbnailUrl || ''), 1280);

  return (
    <div className="min-h-screen bg-[#2A1D14] text-[#e3d2c1] selection:bg-[#F2C14E] selection:text-black">
      {/* ── HERO BANNER TOP VỚI GRADIENT WATERMARK TÔNG PHONG TRUYỀN THỪA ── */}
      <div className="relative w-full overflow-hidden bg-[#2A1D14] pt-24 pb-8 md:pt-28 md:pb-10">
        {/* Ảnh nền đằng sau mờ phủ gradient hòa quyện như Tông Phong Truyền Thừa */}
        {headerBgImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none mix-blend-luminosity [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
            style={{
              backgroundImage: `url('${headerBgImage}')`,
              backgroundPosition: 'center 25%',
            }}
          />
        )}
        {/* Hiệu ứng mờ mềm mại hòa vào nền nâu */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2A1D14]/40 via-[#2A1D14]/70 to-[#2A1D14] pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-10 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-[#3a2718] border border-[#f2cc8f]/40 flex items-center justify-center text-[#ffde59] mb-2 shadow-md">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="9" />
              <line x1="12" y1="15" x2="12" y2="22" />
              <line x1="2" y1="12" x2="9" y2="12" />
              <line x1="15" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="4.93" x2="9.88" y2="9.88" />
              <line x1="14.12" y1="14.12" x2="19.07" y2="19.07" />
              <line x1="4.93" y1="19.07" x2="9.88" y2="14.12" />
              <line x1="14.12" y1="9.88" x2="19.07" y2="4.93" />
            </svg>
          </div>

          {/* 1. KHUNG FLEXBOX CĂN ĐƯỜNG KẺ HAI BÊN ĐÂM TỪ TIM TIÊU ĐỀ */}
          <div className="flex items-center justify-center w-full my-3 gap-4 md:gap-8">
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#F2C14E]/50 to-[#F2C14E]" />
            <h1
              style={{ fontFamily: "'UTM Niagara', sans-serif" }}
              className="text-5xl sm:text-6xl md:text-7xl font-normal text-[#ffde59] uppercase tracking-wider drop-shadow-[0_0_18px_rgba(242,193,78,0.7)] whitespace-nowrap flex-shrink-0"
            >
              TRÍ TUỆ PHẬT PHÁP
            </h1>
            <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-[#F2C14E]/50 to-[#F2C14E]" />
          </div>

          {/* 2. Subtitle: UTM Avo, Sentence case, Text-balance */}
          <p
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="text-xs sm:text-sm md:text-base text-[#e3d2c1] tracking-wide font-normal max-w-2xl mx-auto px-4 leading-relaxed text-balance text-center"
          >
            Tổng hợp bài&nbsp;viết, câu&nbsp;chuyện, pháp&nbsp;âm &amp; video lưu&nbsp;thông pháp&nbsp;bảo của Tùng&nbsp;Lâm&nbsp;Hòa&nbsp;Phúc.
          </p>
        </div>
      </div>

      <main className="max-w-[1280px] mx-auto px-4 md:px-10 py-6">
        <WisdomArchiveSection items={items} />
      </main>
    </div>
  );
}
