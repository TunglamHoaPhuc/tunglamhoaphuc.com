import React, { FC } from 'react';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';

/**
 * Ô tra cứu mã số bài vị ở trang khu vực: chỉ là biểu mẫu GET sang /tra-cuu-bai-vi. Việc tra chạy ở máy chủ và chỉ trả
 * vài chục bản ghi cho một từ khóa; trình duyệt không còn tải cả danh sách để lọc tại chỗ.
 */
export const TuAnVangSinhSystem: FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="rounded-2xl border border-[#F2C14E]/35 bg-gradient-to-br from-[#23150C] via-[#1B1009] to-[#140B05] p-5 sm:p-6 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2
              className="text-2xl sm:text-3xl font-normal text-[#FFE5A3] uppercase tracking-wide"
              style={{ fontFamily: "'UTM Niagara', serif" }}
            >
              TRA CỨU MÃ SỐ BÀI VỊ HƯƠNG LINH
            </h2>
            <p className="text-xs text-[#c9b896] mt-0.5" style={{ fontFamily: "'UTM Avo', sans-serif" }}>
              Nhà Tứ Ân &amp; Vãng Sinh Đường • Nhập họ tên, dòng họ, pháp danh hoặc tuổi.
            </p>
          </div>

          <Link
            href="/tra-cuu-bai-vi"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-11 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#F2C14E] text-[#1C1008] font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all shadow-md shrink-0 self-start sm:self-center"
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
          >
            <span>Mở trang tra cứu</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <form action="/tra-cuu-bai-vi" method="get" className="relative" role="search">
          <label htmlFor="tu-an-tra-cuu-q" className="sr-only">
            Tìm kiếm mã số bài vị hương linh
          </label>
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F2C14E]/75 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="tu-an-tra-cuu-q"
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            maxLength={80}
            placeholder="Gõ tên hương linh, họ tộc hoặc pháp danh rồi nhấn Enter..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#120A05] border border-[#F2C14E]/40 text-base sm:text-sm text-[#FFE5A3] placeholder-[#c9b896]/50 focus:outline-none focus:border-[#F2C14E] transition-colors"
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
          />
        </form>
      </div>
    </div>
  );
};
