'use client';

import React, { FC, useId, useState } from 'react';
import { Calendar, ChevronRight, Search, Sparkles } from 'lucide-react';
import type { MemorialPublicRecord } from '@/lib/memorial-types';
import type { MemorialSearch } from '@/lib/memorial-db';
import { MemorialDetailDialog } from './MemorialDetailDialog';

interface MemorialSearchEngineProps {
  /** Kết quả tra do máy chủ dựng (trang đọc `?q=`); không có danh sách đầy đủ nào được gửi xuống trình duyệt. */
  search: MemorialSearch;
  category?: string;
}

const FONT = { fontFamily: "'UTM Avo', sans-serif" } as const;

export const MemorialSearchEngine: FC<MemorialSearchEngineProps> = ({ search, category = 'all' }) => {
  const inputId = useId();
  const [selectedRecord, setSelectedRecord] = useState<MemorialPublicRecord | null>(null);
  const query = search.state === 'idle' ? '' : search.query;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* ── KHUNG TÌM KIẾM TỐI GIẢN: biểu mẫu GET thường, chạy cả khi chưa nạp xong JavaScript ── */}
      <div className="rounded-2xl border border-[#F2C14E]/35 bg-[#1E120A]/95 p-4 sm:p-5 shadow-xl space-y-3.5">
        <form action="/tra-cuu-bai-vi" method="get" className="space-y-2" role="search">
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wide sm:tracking-wider text-[#F2C14E] leading-relaxed"
            style={FONT}
          >
            Tìm mã số bài vị (Tên hương linh, dòng họ, pháp danh hoặc tuổi)
          </label>
          {category !== 'all' && <input type="hidden" name="khu" value={category} />}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#F2C14E]/75 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id={inputId}
                name="q"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                maxLength={80}
                defaultValue={query}
                placeholder="Ví dụ: Nguyễn Văn..., Trần Tộc, Liên Vân..."
                className="w-full pl-11 pr-3 py-3 rounded-xl bg-[#130B06] border border-[#F2C14E]/45 text-base text-[#FFE5A3] placeholder-[#c9b896]/50 focus:outline-none focus:border-[#F2C14E] focus:ring-2 focus:ring-[#F2C14E]/25 transition-all"
                style={FONT}
              />
            </div>
            <button
              type="submit"
              className="px-4 sm:px-5 min-h-12 rounded-xl bg-gradient-to-r from-[#D4A017] to-[#F2C14E] text-[#1C130D] font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer"
              style={FONT}
            >
              Tra cứu
            </button>
          </div>
        </form>
      </div>

      {/* ── KHU VỰC KẾT QUẢ ── */}
      {search.state === 'idle' && (
        <Notice title="Nhập thông tin để tra cứu mã số bài vị">
          Quý Phật tử gõ tên hương linh (có dấu hoặc không dấu), tên dòng họ (với Tổ Tiên), pháp danh hoặc tuổi để tra nhanh{' '}
          <strong className="text-[#F2C14E]">Mã số bài vị</strong>.
        </Notice>
      )}

      {search.state === 'short' && (
        <Notice title="Từ khóa hơi ngắn">Mời quý vị gõ ít nhất 3 chữ (ví dụ họ và tên) để tra cứu.</Notice>
      )}

      {search.state === 'limited' && (
        <Notice title="Bạn tra hơi nhanh">Mời quý vị đợi một phút rồi tra lại.</Notice>
      )}

      {search.state === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-sm text-[#c9b896]" style={FONT}>
            <span>
              Tìm thấy <strong className="text-[#F2C14E] text-base">{search.total}</strong> bài vị phù hợp
              {search.total > search.records.length ? ` (hiện ${search.records.length} bài vị đầu, mời gõ cụ thể hơn)` : ''}
            </span>
          </div>

          {search.records.length === 0 ? (
            <Notice title="Không tìm thấy bài vị phù hợp">
              Quý vị vui lòng thử gõ ngắn gọn hơn (chỉ nhập Tên hoặc Họ), hoặc liên hệ Ban Tri Khách Tùng Lâm Hòa Phúc để được kiểm tra sổ gốc.
            </Notice>
          ) : (
            <div className="space-y-2.5">
              {search.records.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedRecord(item)}
                  className="w-full text-left group rounded-xl border border-[#F2C14E]/25 bg-[#1B1009] hover:border-[#F2C14E] hover:bg-[#24160D] px-3.5 py-3 sm:px-4 sm:py-3.5 transition-all flex items-center gap-3.5 sm:gap-4 cursor-pointer shadow-sm"
                >
                  {/* Ô MÃ SỐ BÀI VỊ NỔI BẬT */}
                  <div className="shrink-0 min-w-[74px] sm:min-w-[84px] rounded-lg bg-[#7A1B0E] border border-[#F2C14E]/75 px-2.5 py-2 text-center shadow-inner">
                    <span className="block text-xs uppercase tracking-wide text-[#FFE5A3]/85 leading-none mb-1" style={FONT}>
                      Mã số
                    </span>
                    <span className="block font-mono text-lg sm:text-xl font-bold text-[#FFE5A3] leading-none">
                      {item.code || '—'}
                    </span>
                  </div>

                  {/* Thông tin nhận diện cơ bản */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h3
                        className="text-base sm:text-lg font-bold text-[#FFE5A3] group-hover:text-[#F2C14E] transition-colors truncate"
                        style={FONT}
                      >
                        {item.name}
                      </h3>
                      {item.lineageType && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[#F2C14E]/15 text-[#F2C14E] border border-[#F2C14E]/30 font-semibold shrink-0">
                          {item.lineageType}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm sm:text-xs text-[#e3d2c1]/85" style={FONT}>
                      <span className="text-[#F2C14E]/95 font-medium">{item.category}</span>
                      {item.dharmaName && (
                        <span className="inline-flex items-center gap-1 text-[#FFE5A3]">
                          <Sparkles className="w-3 h-3 text-[#F2C14E]/80 shrink-0" />
                          PD: {item.dharmaName}
                        </span>
                      )}
                      {(item.deathDate || item.age) && (
                        <span className="inline-flex items-center gap-1 text-[#c9b896]">
                          <Calendar className="w-3 h-3 text-[#F2C14E]/70 shrink-0" />
                          {item.deathDate ? `Mất: ${item.deathDate}` : ''}
                          {item.age ? `${item.deathDate ? ' • ' : ''}${item.age} tuổi` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight
                    className="w-4 h-4 text-[#F2C14E]/50 group-hover:text-[#F2C14E] group-hover:translate-x-0.5 transition-all shrink-0"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Popup chi tiết (Native <dialog>) */}
      <MemorialDetailDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
};

const Notice: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-[#F2C14E]/20 bg-[#1A1009]/80 px-5 py-7 text-center space-y-2" style={FONT}>
    <p className="text-sm font-semibold text-[#FFE5A3]">{title}</p>
    <p className="text-sm sm:text-xs text-[#c9b896]/85 max-w-md mx-auto leading-relaxed">{children}</p>
  </div>
);
