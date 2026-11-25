"use client";
import { FC, useState } from "react";
import { ChevronRight, Menu, Search, X } from "lucide-react";
import { NAV_LINKS, DROPDOWN } from "@/features/home/data/home-data";
import { useSiteChrome } from "@/components/public/SiteChrome";
import type { ChromeNavItem } from "@/lib/v3-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Menu có sẵn của V3, dùng khi D1 chưa có mục menu đầu trang nào (admin chưa lưu).
const BUILT_IN_NAV: ChromeNavItem[] = NAV_LINKS.map((item) => ({
  label: item.label,
  href: item.href || "#",
  newTab: false,
  children: item.dropdown ? DROPDOWN.map((d) => ({ label: d.label, href: d.href, newTab: false })) : [],
}));

const newTabProps = (newTab: boolean) => (newTab ? { target: "_blank", rel: "noopener noreferrer" } : {});

interface HeaderProps {
  scrolled: boolean;
}

const Header: FC<HeaderProps> = ({ scrolled }) => {
  // Menu đầu trang do admin sửa (D1, qua bố cục gốc); chưa có thì dùng menu có sẵn; không đọc được D1 thì rỗng.
  const { nav } = useSiteChrome();
  const items: ChromeNavItem[] = nav ?? BUILT_IN_NAV;
  const [drop, setDrop] = useState<string | null>(null);
  const [mob, setMob] = useState<boolean>(false);

  const pathname = usePathname();
  const router = useRouter();

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      router.push('/');
    }
  };

  const isLinkActive = (href?: string) => {
    if (!href || href === '#' || !href.startsWith('/')) return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Đi tới địa chỉ của một mục cha có menu con (nhấp vào nút mở menu).
  const goTo = (href: string, newTab: boolean) => {
    if (!href || href === '#') return;
    if (href.startsWith('/')) router.push(href);
    else if (newTab) window.open(href, '_blank', 'noopener,noreferrer');
    else window.location.assign(href);
  };

  return (
    <header
      // backdrop-blur là lớp (không phải style nội tuyến) để globals.css hạ xuống 4 px trên điện thoại: thanh này luôn nằm trên màn hình khi cuộn.
      className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300 border-b overflow-visible py-1.5 md:py-2 bg-[#1A120B] backdrop-blur-[14px]"
      style={{
        height: 64,
        background: scrolled
          ? "rgba(26,15,8,0.96)"
          : "linear-gradient(to bottom, rgba(26,15,8,0.95) 0%, rgba(26,15,8,0.82) 100%)",
        borderColor: "rgba(242,193,78,0.28)",
        boxShadow: "0 4px 28px rgba(0,0,0,0.55)",
      }}
    >
      <div className="max-w-[1360px] mx-auto px-4 md:px-8 h-full flex items-center justify-between lg:justify-start gap-6 md:gap-8 overflow-visible relative z-[100]">

        {/* Logo Mộc Ấn Treo Thò (Hanging Badge) */}
        <Link
          href="/"
          onClick={handleLogoClick}
          className="relative z-50 shrink-0 -mb-10 md:-mb-16 overflow-visible cursor-pointer group"
          title="Tùng Lâm Hòa Phúc"
        >
          {/* Ảnh trên nếp gấp nên không lazy. Hai bản 200/400 px: khung cao 96/128/144 px (rộng 129/172/194 px), màn thường lấy 200, màn DPR 2 lấy 400. */}
          <img
            src="/brand/logo-moc-an.webp"
            srcSet="/brand/logo-moc-an-200.webp 200w, /brand/logo-moc-an.webp 400w"
            sizes="(min-width: 1024px) 194px, (min-width: 768px) 172px, 129px"
            width={400}
            height={297}
            decoding="async"
            alt="Logo Mộc Ấn Tùng Lâm Hòa Phúc"
            className="h-24 md:h-32 lg:h-36 w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.7)] transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.removeAttribute('srcset');
              img.src = '/brand/logo-tung-lam-hoa-phuc-tron-192.webp';
            }}
          />
        </Link>

        {/* Vạch phân cách 1 (Sau Logo) */}
        <div className="w-[1px] h-6 bg-gradient-to-b from-transparent via-[#F2C14E]/50 to-transparent shrink-0 hidden lg:block" />

        {/* Menu Navigation Hoàng Kim Với Hiệu Ứng Hover Đẳng Cấp */}
        <nav className="hidden lg:flex items-center gap-5 xl:gap-7 flex-shrink-0">
          {items.map((item) => {
            const hasChildren = item.children.length > 0;
            const isDropdownActive = hasChildren && (drop === item.label || item.children.some((c) => isLinkActive(c.href)));
            const active = isLinkActive(item.href);

            return (
              <div
                key={item.label}
                className="relative flex-shrink-0 py-2"
                onMouseEnter={() => hasChildren && setDrop(item.label)}
                onMouseLeave={() => hasChildren && setDrop(null)}
              >
                {hasChildren ? (
                  <button
                    className={`group/btn text-[11px] xl:text-[12px] uppercase tracking-[.1em] font-bold flex items-center gap-1.5 py-1.5 cursor-pointer whitespace-nowrap transition-all duration-300 relative ${
                      isDropdownActive
                        ? 'text-[#FFDE59] drop-shadow-[0_0_12px_rgba(242,193,78,0.75)]'
                        : 'text-[#e3d2c1] hover:text-[#FFDE59] hover:drop-shadow-[0_0_10px_rgba(242,193,78,0.6)] hover:-translate-y-0.5'
                    }`}
                    style={{ fontFamily: "'UTM Avo', sans-serif" }}
                    onClick={() => goTo(item.href, item.newTab)}
                  >
                    <span>{item.label}</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-300 ${
                        drop === item.label
                          ? 'rotate-[-90deg] text-[#FFDE59]'
                          : 'rotate-90 text-[#F2C14E] group-hover/btn:text-[#FFDE59] group-hover/btn:translate-y-0.5'
                      }`}
                    />
                    {/* Thanh gạch chân hoàng kim ánh hào quang */}
                    <span
                      className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#F2C14E] to-transparent transition-all duration-300 origin-center ${
                        isDropdownActive
                          ? 'scale-x-100 opacity-100 shadow-[0_0_10px_#F2C14E]'
                          : 'scale-x-0 opacity-0 group-hover/btn:scale-x-100 group-hover/btn:opacity-100 group-hover/btn:shadow-[0_0_8px_#F2C14E]'
                      }`}
                    />
                  </button>
                ) : (
                  <Link
                    href={item.href || "#"}
                    {...newTabProps(item.newTab)}
                    className={`group/link text-[11px] xl:text-[12px] uppercase tracking-[.1em] font-bold flex items-center gap-1 py-1.5 whitespace-nowrap transition-all duration-300 relative ${
                      active
                        ? 'text-[#FFDE59] drop-shadow-[0_0_12px_rgba(242,193,78,0.75)]'
                        : 'text-[#e3d2c1] hover:text-[#FFDE59] hover:drop-shadow-[0_0_10px_rgba(242,193,78,0.6)] hover:-translate-y-0.5'
                    }`}
                    style={{ fontFamily: "'UTM Avo', sans-serif" }}
                  >
                    <span>{item.label}</span>
                    {/* Thanh gạch chân hoàng kim ánh hào quang */}
                    <span
                      className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#F2C14E] to-transparent transition-all duration-300 origin-center ${
                        active
                          ? 'scale-x-100 opacity-100 shadow-[0_0_10px_#F2C14E]'
                          : 'scale-x-0 opacity-0 group-hover/link:scale-x-100 group-hover/link:opacity-100 group-hover/link:shadow-[0_0_8px_#F2C14E]'
                      }`}
                    />
                  </Link>
                )}

                {/* Dropdown Menu Giới Thiệu Hoàng Kim */}
                {hasChildren && drop === item.label && (
                  <div className="absolute top-full left-0 pt-2 w-64 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div
                      className="rounded-2xl py-2.5 border shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl overflow-hidden"
                      style={{
                        background: "linear-gradient(165deg, rgba(42,29,20,0.98) 0%, rgba(26,15,8,0.98) 100%)",
                        borderColor: "rgba(242,193,78,0.45)",
                      }}
                    >
                      {item.children.map((d) => {
                        const isSubActive = pathname === d.href;
                        return (
                          <Link
                            key={d.label}
                            href={d.href}
                            {...newTabProps(d.newTab)}
                            className={`group/sub flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold tracking-wide transition-all duration-200 whitespace-nowrap border-l-3 ${
                              isSubActive
                                ? 'border-[#F2C14E] bg-gradient-to-r from-[#F2C14E]/25 to-transparent text-[#FFDE59] shadow-inner'
                                : 'border-transparent text-[#e3d2c1] hover:border-[#F2C14E] hover:bg-gradient-to-r hover:from-[#F2C14E]/20 hover:to-transparent hover:text-[#FFDE59] hover:translate-x-1'
                            }`}
                            style={{ fontFamily: "'UTM Avo', sans-serif" }}
                            onClick={() => setDrop(null)}
                          >
                            <span className="text-[#F2C14E] text-[10px] opacity-70 group-hover/sub:opacity-100 group-hover/sub:scale-125 transition-all">☸</span>
                            <span className="drop-shadow-sm">{d.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Vạch phân cách 2 (Kết thúc Nav Bar) */}
        <div className="w-[1px] h-6 bg-gradient-to-b from-transparent via-[#F2C14E]/50 to-transparent shrink-0 hidden lg:block" />

        {/* Tìm kiếm: liên kết thường tới /tim-kiem (chạy cả khi không có JS) */}
        <Link
          href="/tim-kiem"
          aria-label="Tìm kiếm"
          title="Tìm kiếm"
          className={`ml-auto -mr-2 lg:mr-0 inline-flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-lg transition-colors ${
            pathname === '/tim-kiem' ? 'text-[#FFDE59]' : 'text-[#F2C14E] hover:text-[#FFDE59]'
          }`}
        >
          <Search className="w-5 h-5" aria-hidden="true" />
        </Link>

        {/* Mobile Hamburger Button */}
        <button
          className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#F2C14E]/40 text-[#F2C14E] hover:text-[#FFDE59] hover:border-[#FFDE59] transition-colors"
          onClick={() => setMob(!mob)}
          aria-label="Menu"
          aria-expanded={mob}
        >
          {mob ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mob && (
        <div
          className="lg:hidden border-t px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-1 shadow-2xl max-h-[calc(100dvh-64px)] overflow-y-auto overscroll-contain relative z-[100] animate-in fade-in slide-in-from-top-4 duration-300"
          style={{
            background: "linear-gradient(180deg, rgba(26,15,8,0.98) 0%, rgba(18,10,5,0.99) 100%)",
            borderColor: "rgba(242,193,78,0.35)",
          }}
        >
          {items.map((item) =>
            item.children.length > 0 ? (
              <div key={item.label} className="flex flex-col gap-1 border-b border-[#F2C14E]/15 pb-2">
                <Link
                  href={item.href || "#"}
                  {...newTabProps(item.newTab)}
                  onClick={() => setMob(false)}
                  className="min-h-11 text-sm uppercase font-bold tracking-widest text-[#FFDE59] flex items-center justify-between hover:text-[#FFE5A3] transition-colors"
                  style={{ fontFamily: "'UTM Avo', sans-serif" }}
                >
                  <span>{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-[#F2C14E]" />
                </Link>
                <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-[#F2C14E]/30">
                  {item.children.map((d) => {
                    const isSubActive = pathname === d.href;
                    return (
                      <Link
                        key={d.label}
                        href={d.href}
                        {...newTabProps(d.newTab)}
                        className={`min-h-11 flex items-center text-sm font-bold tracking-wide transition-colors ${
                          isSubActive
                            ? 'text-[#FFDE59]'
                            : 'text-[#e3d2c1] hover:text-[#FFDE59]'
                        }`}
                        style={{ fontFamily: "'UTM Avo', sans-serif" }}
                        onClick={() => setMob(false)}
                      >
                        › {d.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Link
                key={item.label}
                href={item.href || "#"}
                {...newTabProps(item.newTab)}
                className={`min-h-11 flex items-center text-sm uppercase tracking-widest font-bold border-b border-[#F2C14E]/15 transition-colors ${
                  isLinkActive(item.href)
                    ? 'text-[#FFDE59] drop-shadow-[0_0_8px_rgba(242,193,78,0.6)]'
                    : 'text-[#e3d2c1] hover:text-[#FFDE59]'
                }`}
                style={{ fontFamily: "'UTM Avo', sans-serif" }}
                onClick={() => setMob(false)}
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
