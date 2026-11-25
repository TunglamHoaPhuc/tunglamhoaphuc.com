'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, CheckCircle2, BookOpen, Compass } from 'lucide-react';
import { useSiteChrome } from '@/components/public/SiteChrome';
import { defaultTongChiGroup } from '@/lib/tong-chi-sections';
import { useNavPanelData } from './NavPanelData';

interface NavDropdownPanelProps {
  pageTitle?: string;
  activeSection?: string;
  onClose: () => void;
}

export function NavDropdownPanel({ pageTitle = '', activeSection = '', onClose }: NavDropdownPanelProps) {
  const pathname = usePathname() || '';
  // Khu vực đang hiển thị ở D1 (bố cục gốc đọc một lần); khu vực ẩn hay đã xóa không có trong bảng này.
  const { areas: visibleAreas } = useSiteChrome();
  // Bài Tông Chỉ và Dòng chảy đang hiển thị ở D1 (máy chủ đọc ở trang, đưa xuống qua NavPanelProvider).
  const { tongChi: tongChiGroups, dongChay } = useNavPanelData();

  // 1. Nhận diện phân hệ hiện tại
  const isUniverse = pathname.includes('/vu-tru-phat-giao');
  const isHoangPhap = pathname.includes('/dong-chay-hoang-phap');

  // 2. State chọn danh mục cho Tông Chỉ Tu Học
  const normalizedTitle = pageTitle.toLowerCase().trim();

  // Nhóm mở sẵn cho Tông Chỉ: nhóm của bài đang đọc, rồi nhóm của phần đang cuộn ở trang Tông Chỉ, rồi nhóm đầu tiên.
  const defaultCategory = useMemo(
    () => defaultTongChiGroup(tongChiGroups, { pathname, pageTitle, activeSection }),
    [tongChiGroups, pathname, pageTitle, activeSection],
  );

  const [selectedCat, setSelectedCat] = useState<string>(defaultCategory);

  // ── TRƯỜNG HỢP 1: VŨ TRỤ PHẬT GIÁO ──────────────────────────────────────────
  if (isUniverse) {
    return (
      <div className="w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-[#1C120A]/98 border-2 border-[#F2C14E] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_30px_rgba(242,193,78,0.3)] sm:backdrop-blur-xl p-3 z-[100] text-left">
        {/* Dropdown Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2C14E]/30 px-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#F2C14E]" />
            <span
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className="text-xs sm:text-[11px] font-bold text-[#F2C14E] uppercase tracking-wider"
            >
              KHU VỰC VŨ TRỤ PHẬT GIÁO
            </span>
          </div>
          <span
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="px-2 py-0.5 rounded-full bg-[#3A2718] border border-[#F2C14E]/40 text-xs sm:text-[10px] font-bold text-[#ffde59]"
          >
            {visibleAreas.length} khu vực
          </span>
        </div>

        {/* Danh sách các khu vực */}
        <div className="space-y-1.5 max-h-[min(20rem,55svh)] overflow-y-auto overscroll-contain custom-scrollbar pr-1">
          {visibleAreas.map((area, idx) => {
            const href = `/vu-tru-phat-giao/${area.slug}`;
            const isCurrent =
              pathname === href ||
              pathname.endsWith(`/${area.slug}`) ||
              area.name.toLowerCase().trim() === normalizedTitle;

            return (
              <Link
                prefetch={false}
                key={area.id || area.slug}
                href={href}
                onClick={onClose}
                className={`group flex items-center justify-between gap-2.5 p-2.5 min-h-11 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-[#3A2718] border-[#F2C14E] shadow-[0_0_15px_rgba(242,193,78,0.25)]'
                    : 'bg-[#25170E]/70 hover:bg-[#352012] border-[#F2C14E]/20 hover:border-[#F2C14E]/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs sm:text-[10px] font-bold shrink-0 border ${
                      isCurrent
                        ? 'bg-[#F2C14E] text-[#1C120A] border-[#F2C14E]'
                        : 'bg-[#1C120A] text-[#FFE5A3] border-[#F2C14E]/40 group-hover:border-[#F2C14E]'
                    }`}
                  >
                    #{area.pinNumber || idx + 1}
                  </div>

                  <div className="min-w-0">
                    <h4
                      style={{ fontFamily: "'UTM Avo', sans-serif" }}
                      className={`text-[13px] uppercase font-bold tracking-wider leading-snug truncate transition-colors ${
                        isCurrent ? 'text-[#ffde59]' : 'text-[#FFE5A3] group-hover:text-[#ffde59]'
                      }`}
                    >
                      {area.name}
                    </h4>
                    {area.subtitle && (
                      <p
                        style={{ fontFamily: "'UTM Avo', sans-serif" }}
                        className="text-xs sm:text-[10px] text-[#c9b896]/80 italic truncate mt-0.5"
                      >
                        {area.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {isCurrent ? (
                  <span
                    style={{ fontFamily: "'UTM Avo', sans-serif" }}
                    className="px-1.5 py-0.5 rounded bg-[#F2C14E] text-[#1C120A] text-xs sm:text-[9px] font-bold uppercase shrink-0 flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>Đang xem</span>
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#F2C14E]/60 group-hover:text-[#F2C14E] group-hover:translate-x-0.5 transition-all shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // ── TRƯỜNG HỢP 2: DÒNG CHẢY HOẰNG PHÁP ──────────────────────────────────────
  if (isHoangPhap) {
    return (
      <div className="w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-[#1C120A]/98 border-2 border-[#F2C14E] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_30px_rgba(242,193,78,0.3)] sm:backdrop-blur-xl p-3 z-[100] text-left">
        {/* Dropdown Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2C14E]/30 px-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#F2C14E]" />
            <span
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className="text-xs sm:text-[11px] font-bold text-[#F2C14E] uppercase tracking-wider"
            >
              DÒNG CHẢY HOẰNG PHÁP
            </span>
          </div>
          <span
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="px-2 py-0.5 rounded-full bg-[#3A2718] border border-[#F2C14E]/40 text-xs sm:text-[10px] font-bold text-[#ffde59]"
          >
            {dongChay.total} bài
          </span>
        </div>

        {/* Danh sách các bài hoằng pháp */}
        <div className="space-y-1.5 max-h-[min(20rem,55svh)] overflow-y-auto overscroll-contain custom-scrollbar pr-1">
          {dongChay.items.map((art, idx) => {
            const href = `/dong-chay-hoang-phap/${art.slug}`;
            const isCurrent =
              pathname === href ||
              pathname.endsWith(`/${art.slug}`) ||
              art.title.toLowerCase().trim() === normalizedTitle;

            return (
              <Link
                prefetch={false}
                key={art.id || art.slug}
                href={href}
                onClick={onClose}
                className={`group flex items-center justify-between gap-2.5 p-2.5 min-h-11 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-[#3A2718] border-[#F2C14E] shadow-[0_0_15px_rgba(242,193,78,0.25)]'
                    : 'bg-[#25170E]/70 hover:bg-[#352012] border-[#F2C14E]/20 hover:border-[#F2C14E]/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs sm:text-[10px] font-bold shrink-0 border ${
                      isCurrent
                        ? 'bg-[#F2C14E] text-[#1C120A] border-[#F2C14E]'
                        : 'bg-[#1C120A] text-[#FFE5A3] border-[#F2C14E]/40 group-hover:border-[#F2C14E]'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div className="min-w-0">
                    <h4
                      style={{ fontFamily: "'UTM Avo', sans-serif" }}
                      className={`text-[13px] uppercase font-bold tracking-wider leading-snug truncate transition-colors ${
                        isCurrent ? 'text-[#ffde59]' : 'text-[#FFE5A3] group-hover:text-[#ffde59]'
                      }`}
                    >
                      {art.title}
                    </h4>
                    {art.subtitle && (
                      <p
                        style={{ fontFamily: "'UTM Avo', sans-serif" }}
                        className="text-xs sm:text-[10px] text-[#c9b896]/80 italic truncate mt-0.5"
                      >
                        {art.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {isCurrent ? (
                  <span
                    style={{ fontFamily: "'UTM Avo', sans-serif" }}
                    className="px-1.5 py-0.5 rounded bg-[#F2C14E] text-[#1C120A] text-xs sm:text-[9px] font-bold uppercase shrink-0 flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>Đang xem</span>
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#F2C14E]/60 group-hover:text-[#F2C14E] group-hover:translate-x-0.5 transition-all shrink-0" />
                )}
              </Link>
            );
          })}

          {dongChay.items.length === 0 && (
            <p style={{ fontFamily: "'UTM Avo', sans-serif" }} className="px-2 py-3 text-xs sm:text-[11px] text-[#c9b896]/80 italic">
              Chưa có bài nào đang hiển thị.
            </p>
          )}

          {/* Bảng chỉ liệt kê bài mới nhất; danh sách đầy đủ ở trang Dòng chảy hoằng pháp. */}
          {dongChay.total > dongChay.items.length && (
            <Link
              prefetch={false}
              href="/dong-chay-hoang-phap"
              onClick={onClose}
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className="block p-2.5 rounded-xl border border-[#F2C14E]/20 hover:border-[#F2C14E]/60 bg-[#25170E]/70 hover:bg-[#352012] text-center text-xs sm:text-[11px] font-bold uppercase tracking-wider text-[#FFE5A3] hover:text-[#ffde59] transition-all"
            >
              Xem tất cả {dongChay.total} bài
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── TRƯỜNG HỢP 3: TÔNG CHỈ TU HỌC (CHUẨN 5 CHUYÊN MỤC VÀ TABS CHUYỂN NHANH) ──
  const activeGroup = tongChiGroups.find((g) => g.slug === selectedCat) || tongChiGroups[0];
  const currentCategoryArticles = activeGroup?.items ?? [];

  return (
    <div className="w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-[#1C120A]/98 border-2 border-[#F2C14E] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_30px_rgba(242,193,78,0.3)] sm:backdrop-blur-xl p-3 z-[100] text-left">
      {/* 5 Tabs chọn chuyên mục Tông Chỉ Tu Học */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2 mb-2 border-b border-[#F2C14E]/20">
        {tongChiGroups.map((cat) => {
          const isTabActive = activeGroup?.slug === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setSelectedCat(cat.slug)}
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
              className={`px-3 py-2.5 sm:px-2 sm:py-1 rounded-lg text-xs sm:text-[10px] font-bold tracking-wider uppercase whitespace-nowrap transition-all cursor-pointer border ${
                isTabActive
                  ? 'bg-[#F2C14E] text-[#1C120A] border-[#F2C14E] shadow-[0_0_10px_rgba(242,193,78,0.4)]'
                  : 'bg-[#2A1D14]/80 text-[#d4c3ab] hover:text-[#ffde59] border-[#F2C14E]/20 hover:border-[#F2C14E]/60'
              }`}
            >
              {cat.short}
            </button>
          );
        })}
      </div>

      {/* Header chuyên mục đang chọn */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2C14E]/25 px-1">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#F2C14E] shrink-0" />
          <span
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="text-xs sm:text-[11px] font-bold text-[#F2C14E] uppercase tracking-wider truncate"
          >
            {activeGroup?.name ?? 'TÔNG CHỈ TU HỌC'}
          </span>
        </div>
        <span
          style={{ fontFamily: "'UTM Avo', sans-serif" }}
          className="px-2 py-0.5 rounded-full bg-[#3A2718] border border-[#F2C14E]/40 text-xs sm:text-[10px] font-bold text-[#ffde59] shrink-0"
        >
          {currentCategoryArticles.length} bài
        </span>
      </div>

      {/* Danh sách các bài viết trong chuyên mục */}
      <div className="space-y-1.5 max-h-[min(20rem,55svh)] overflow-y-auto overscroll-contain custom-scrollbar pr-1">
        {currentCategoryArticles.map((art) => {
          const href = `/tong-chi-tu-hoc/${art.slug}`;
          const isCurrent =
            pathname === href ||
            pathname.endsWith(`/${art.slug}`) ||
            art.title.toLowerCase().trim() === normalizedTitle;

          return (
            <Link
              prefetch={false}
              key={art.id || art.slug}
              href={href}
              onClick={onClose}
              className={`group flex items-center justify-between gap-2.5 p-2.5 min-h-11 rounded-xl border transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-[#3A2718] border-[#F2C14E] shadow-[0_0_15px_rgba(242,193,78,0.25)]'
                  : 'bg-[#25170E]/70 hover:bg-[#352012] border-[#F2C14E]/20 hover:border-[#F2C14E]/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs sm:text-[10px] font-bold shrink-0 border ${
                    isCurrent
                      ? 'bg-[#F2C14E] text-[#1C120A] border-[#F2C14E]'
                      : 'bg-[#1C120A] text-[#FFE5A3] border-[#F2C14E]/40 group-hover:border-[#F2C14E]'
                  }`}
                >
                  #{art.number}
                </div>

                <div className="min-w-0">
                  <h4
                    style={{ fontFamily: "'UTM Avo', sans-serif" }}
                    className={`text-[13px] uppercase font-bold tracking-wider leading-snug truncate transition-colors ${
                      isCurrent ? 'text-[#ffde59]' : 'text-[#FFE5A3] group-hover:text-[#ffde59]'
                    }`}
                  >
                    {art.title}
                  </h4>
                  {art.subtitle && (
                    <p
                      style={{ fontFamily: "'UTM Avo', sans-serif" }}
                      className="text-xs sm:text-[10px] text-[#c9b896]/80 italic truncate mt-0.5"
                    >
                      {art.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {isCurrent ? (
                <span
                  style={{ fontFamily: "'UTM Avo', sans-serif" }}
                  className="px-1.5 py-0.5 rounded bg-[#F2C14E] text-[#1C120A] text-xs sm:text-[9px] font-bold uppercase shrink-0 flex items-center gap-1 shadow-sm"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Đang xem</span>
                </span>
              ) : (
                <ChevronRight className="w-4 h-4 text-[#F2C14E]/60 group-hover:text-[#F2C14E] group-hover:translate-x-0.5 transition-all shrink-0" />
              )}
            </Link>
          );
        })}

        {currentCategoryArticles.length === 0 && (
          <p style={{ fontFamily: "'UTM Avo', sans-serif" }} className="px-2 py-3 text-xs sm:text-[11px] text-[#c9b896]/80 italic">
            Chưa có bài nào đang hiển thị.
          </p>
        )}
      </div>
    </div>
  );
}
