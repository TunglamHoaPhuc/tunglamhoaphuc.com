// Đầu trang đơn giản cho các trang thông tin (Liên hệ, Tìm kiếm): nền núi chùa mờ, bánh xe pháp, tiêu đề chữ vàng. Thành phần
// máy chủ: không cần JS. Cùng ngôn ngữ thị giác với đầu trang Giới thiệu.
import type { ReactNode } from "react";

export default function PlainHero({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden bg-[#2A1D14] pt-28 pb-10">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-[2px] pointer-events-none"
        style={{ backgroundImage: "url('/images/hero/toan-canh-chua-1280.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#2A1D14]/40 via-[#2A1D14]/80 to-[#2A1D14] pointer-events-none" />
      <div className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-10 flex flex-col items-center justify-center text-center">
        <div aria-hidden="true" className="w-12 h-12 rounded-full bg-[#3a2718] border border-[#f2cc8f]/40 flex items-center justify-center text-[#ffde59] mb-3 shadow-md">
          <span className="text-2xl">☸</span>
        </div>
        <div className="flex items-center justify-center w-full my-3 gap-4 md:gap-8">
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#F2C14E]/50 to-[#F2C14E]" />
          <h1
            style={{ fontFamily: "'UTM Niagara', sans-serif" }}
            className="text-5xl sm:text-6xl md:text-7xl font-normal text-[#ffde59] uppercase tracking-wider drop-shadow-[0_0_18px_rgba(242,193,78,0.7)] flex-shrink-0"
          >
            {title}
          </h1>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-[#F2C14E]/50 to-[#F2C14E]" />
        </div>
        {children ? (
          <p
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="text-xs sm:text-sm md:text-base text-[#e3d2c1] tracking-wide max-w-2xl mx-auto px-4 leading-relaxed text-balance"
          >
            {children}
          </p>
        ) : null}
      </div>
    </div>
  );
}
