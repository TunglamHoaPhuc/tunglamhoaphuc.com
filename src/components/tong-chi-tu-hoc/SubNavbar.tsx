'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react';
import { NAV_ITEMS } from '@/data/tong-chi-tu-hoc-data';
import { NavDropdownPanel } from './NavDropdownPanel';
import { fitImage } from '@/utils/image';

interface NavItem {
  id: string;
  label: string;
}

interface SubNavbarProps {
  activeSection: string;
  isScrolled: boolean;
  onScrollToSection: (id: string) => void;
  pageTitle?: string;
  navItems?: NavItem[];
  logoUrl?: string;
}

export function SubNavbar({
  activeSection,
  isScrolled,
  onScrollToSection,
  pageTitle = 'TÔNG CHỈ TU HỌC',
  navItems = NAV_ITEMS,
  logoUrl,
}: SubNavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() || '';

  // Nhận diện phân hệ để hiển thị đúng biểu tượng & đường dẫn trang chủ
  const isUniverse = pathname.includes('/vu-tru-phat-giao');
  const isHoangPhap = pathname.includes('/dong-chay-hoang-phap');

  const homeHref = isUniverse
    ? '/vu-tru-phat-giao'
    : isHoangPhap
    ? '/dong-chay-hoang-phap'
    : '/tong-chi-tu-hoc';

  const homeTitle = isUniverse
    ? 'Quay về trang Vũ Trụ Phật Giáo'
    : isHoangPhap
    ? 'Quay về trang Dòng Chảy Hoằng Pháp'
    : 'Quay về trang Tông Chỉ Tu Học';

  const logoSrc = logoUrl || (
    isHoangPhap
      ? '/images/icons/icon-dong-chay-hoang-phap-128.webp'
      : isUniverse
      ? '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/09-icon-minh-hoa/logo-moc-an.webp'
      : '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/02-tong-chi-tu-hoc/bieu-tuong-tong-chi-tu-hoc-tung-lam-hoa-phuc.webp'
  );

  // Click outside listener
  const anyOpen = isDropdownOpen || isTocOpen;
  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsTocOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsTocOpen(false);
      }
    }
    if (anyOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [anyOpen]);

  return (
    <nav
      className={`sticky md:static top-[64px] z-30 bg-[#2c1c11]/95 w-full py-1.5 md:py-4 flex items-center min-h-[56px] border-t border-[#F2C14E]/20 sm:backdrop-blur-md border-b border-[#f2cc8f]/20 shadow-xl transition-all duration-300 transform-gpu ease-out ${
        // Trên điện thoại thanh này là lối điều hướng duy nhất (thanh dọc bên trái chỉ có từ md), nên không ẩn khi cuộn.
        isScrolled ? 'md:opacity-0 md:-translate-y-full md:pointer-events-none' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 pl-[9.5rem] md:px-4 md:pl-40 lg:pl-48 h-full flex items-center justify-between gap-4 py-0 md:py-1 w-full my-auto">
        {/* KHỐI TRÁI: LOGO + NÚT TRÒN ( > ) MỞ DROPDOWN + TIÊU ĐỀ.
            Điện thoại: khối này chiếm cả hàng (tiêu đề co lại và cắt bớt chữ), các nút cao 44 px; dropdown trải theo chiều ngang thanh. */}
        <div ref={dropdownRef} className="md:relative flex items-center justify-center my-auto gap-1 md:gap-0 md:space-x-3 flex-1 min-w-0 md:flex-none md:flex-shrink-0">
          <div className="hidden md:block h-8 w-[1px] bg-gradient-to-b from-transparent via-[#c8aa6e]/60 to-transparent flex-shrink-0 my-auto" />

          <Link href={homeHref} title={homeTitle} className="hidden md:flex items-center flex-shrink-0">
            <img width={128} height={128}
              src={fitImage(logoSrc, 160)}
              alt={homeTitle}
              decoding="async"
              className="h-9 md:h-12 w-auto object-contain flex-shrink-0 my-auto drop-shadow-[0_0_8px_rgba(242,193,78,0.4)] hover:scale-105 transition-transform"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/anh-goc/media-tunglamhoaphuc/tunglamhoaphuc2/09-icon-minh-hoa/logo-moc-an.webp';
              }}
            />
          </Link>

          {/* NÚT TRÒN ( > ) BẤM VÀO ĐỂ MỞ DROPDOWN MƯỢT MÀ (vùng chạm 44 px trên điện thoại, hình tròn vẫn 28 px) */}
          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
              setIsTocOpen(false);
            }}
            aria-expanded={isDropdownOpen}
            aria-label="Xem danh mục nội dung"
            className="group/chev hidden md:flex w-7 h-7 items-center justify-center flex-shrink-0 my-auto cursor-pointer"
            title="Bấm để xem danh mục nội dung"
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all duration-300 border ${
                isDropdownOpen
                  ? 'bg-[#FFDE59] text-[#1C120A] border-[#FFDE59] shadow-[0_0_12px_#FFDE59] scale-110'
                  : 'bg-[#f2cc8f] group-hover/chev:bg-[#ffde59] text-[#2c1c11] border-[#f2cc8f] group-hover/chev:scale-110'
              }`}
            >
              <ChevronRight
                className={`w-4 h-4 stroke-[2.5] transition-transform duration-300 ${
                  isDropdownOpen ? 'rotate-90' : 'rotate-0'
                }`}
              />
            </span>
          </button>

          {/* TIÊU ĐỀ TRÊN THANH BAR (BẤM ĐỂ MỞ DROPDOWN) */}
          <button
            type="button"
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
              setIsTocOpen(false);
            }}
            style={{ fontFamily: "'UTM Niagara', sans-serif" }}
            className="group/title flex-1 min-w-0 md:flex-none text-xl sm:text-2xl md:text-3xl text-[#ffde59] hover:text-white tracking-wide uppercase drop-shadow-[0_0_10px_rgba(255,222,89,0.4)] md:whitespace-nowrap flex items-center justify-start md:justify-center gap-1.5 my-auto cursor-pointer px-1.5 py-0.5 min-h-11 md:min-h-0 rounded-xl hover:bg-[#F2C14E]/10 transition-colors text-left leading-[1.1] md:leading-9"
            title="Bấm để xem danh mục nội dung"
          >
            <span className="line-clamp-2 md:line-clamp-none">{pageTitle}</span>
            <ChevronDown
              aria-hidden="true"
              className={`md:hidden w-4 h-4 shrink-0 text-[#f2cc8f] transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* MỤC LỤC CỦA TRANG (CHỈ ĐIỆN THOẠI): thay cho dải chấm điều hướng ngang chỉ có từ md */}
          {navItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsTocOpen(!isTocOpen);
                setIsDropdownOpen(false);
              }}
              aria-expanded={isTocOpen}
              aria-label="Mục lục trang"
              title="Mục lục trang"
              className={`md:hidden w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 my-auto cursor-pointer border transition-colors ${
                isTocOpen
                  ? 'bg-[#FFDE59] text-[#1C120A] border-[#FFDE59]'
                  : 'bg-[#3A2718]/80 text-[#ffde59] border-[#F2C14E]/40'
              }`}
            >
              <ListTree className="w-5 h-5" />
            </button>
          )}

          {/* 🪷 DROPDOWN MENU CHUẨN XÁC NỘI DUNG VỚI FONT UTM AVO BOLD VIẾT HOA 🪷 */}
          {isDropdownOpen && (
            <div className="absolute left-3 right-3 md:right-auto md:left-10 top-full mt-2 md:mt-3 z-[100] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
              <NavDropdownPanel
                pageTitle={pageTitle}
                activeSection={activeSection}
                onClose={() => setIsDropdownOpen(false)}
              />
            </div>
          )}

          {isTocOpen && (
            <div
              className="md:hidden absolute left-3 right-3 top-full mt-2 z-[100] rounded-2xl border-2 border-[#F2C14E] bg-[#1C120A]/98 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in-95 duration-200"
              style={{ fontFamily: "'UTM Avo', sans-serif" }}
            >
              <p className="px-2 pb-1.5 mb-1 border-b border-[#F2C14E]/30 text-xs font-bold uppercase tracking-wider text-[#F2C14E]">
                Mục lục trang
              </p>
              <ul className="max-h-[min(22rem,60svh)] overflow-y-auto overscroll-contain space-y-1">
                {navItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsTocOpen(false);
                          onScrollToSection(item.id);
                        }}
                        className={`w-full min-h-11 px-3 py-2 rounded-xl border text-left text-sm font-bold uppercase tracking-wide leading-snug transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#3A2718] border-[#F2C14E] text-[#ffde59]'
                            : 'bg-[#25170E]/70 border-[#F2C14E]/20 text-[#FFE5A3]'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="hidden md:block h-8 w-[1px] bg-gradient-to-b from-transparent via-[#c8aa6e]/60 to-transparent flex-shrink-0 ml-2 my-auto" />
        </div>

        {/* KHỐI PHẢI: NAV NGANG (từ md; điện thoại dùng nút Mục lục ở trên) */}
        <div className="hidden md:flex flex-1 items-center justify-between ml-4 md:ml-8 overflow-x-auto no-scrollbar py-1 my-auto">
          {navItems.map((item, idx) => {
            const isActive = activeSection === item.id;
            return (
              <React.Fragment key={item.id}>
                {idx > 0 && (
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-[#f2cc8f]/10 via-[#f2cc8f]/30 to-[#f2cc8f]/10 min-w-[12px] mx-1 md:mx-2 my-auto" />
                )}

                <button
                  type="button"
                  onClick={() => onScrollToSection(item.id)}
                  className="group relative flex items-center justify-center gap-2 py-1 px-1 transition-all duration-300 focus:outline-none flex-shrink-0 cursor-pointer my-auto"
                >
                  <span
                    className={`block rounded-full transition-all duration-300 flex-shrink-0 my-auto ${
                      isActive
                        ? 'w-3 h-3 bg-[#ffde59] shadow-[0_0_10px_#ffde59] scale-110 ring-2 ring-[#ffde59]/40'
                        : 'w-2 h-2 bg-[#8c6d53]/70 group-hover:bg-[#ffde59] group-hover:scale-125'
                    }`}
                  />

                  <span
                    style={{ fontFamily: "'UTM Niagara', sans-serif" }}
                    className={`text-xl sm:text-2xl whitespace-nowrap uppercase tracking-wider transition-all duration-500 ease-in-out transform flex items-center justify-center my-auto ${
                      isActive
                        ? 'max-w-[280px] opacity-100 text-[#ffde59] drop-shadow-[0_0_8px_rgba(255,222,89,0.5)] translate-x-0'
                        : 'max-w-0 opacity-0 text-[#f2cc8f] group-hover:max-w-[280px] group-hover:opacity-100 group-hover:text-[#ffde59] translate-x-1 group-hover:translate-x-0 overflow-hidden'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default SubNavbar;
