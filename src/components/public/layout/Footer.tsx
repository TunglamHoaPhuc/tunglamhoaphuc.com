'use client';

import { FC } from "react";
import { Phone, Clock, MapPin } from "lucide-react";
import { FaFacebook, FaYoutube, FaInstagram, FaTiktok, FaGlobe, FaUsers } from "react-icons/fa6";
import type { ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSiteChrome } from "@/components/public/SiteChrome";
import { contactGroups, formatPhone, type ContactLine } from "@/lib/contact-format";
import type { SocialNetwork } from "@/lib/v3-menu";

// Các dòng liên hệ có sẵn của V3: chỉ dùng khi D1 chưa có số điện thoại nào do admin lưu.
const BUILT_IN_CONTACTS: ContactLine[] = [
  { role: "Trưởng ban lãnh chúng", name: "Phật tử Bảo Trâm", phone: "0979345373" },
  { role: "Thư ký", name: "Phật tử Liên Vi", phone: "0961533271" },
  { role: "Thư ký", name: "Phật tử Liên Nghi", phone: "0984569134" },
  { role: "Hỗ trợ thông tin", name: "Phật tử Tịnh Hoàng", phone: "0919366751" },
  { role: "Hỗ trợ thông tin", name: "Phật tử Liên Hương", phone: "0348198196" },
  { role: "Hỗ trợ thông tin", name: "Tịnh Hòa Hưng", phone: "0329630394" },
  { role: "Hỗ trợ thông tin", name: "Liên Phúc Huyền", phone: "0328812922" },
];

// Biểu tượng và màu của từng mạng xã hội. Liên kết, tên và thứ tự là của admin (`site.info`.social); ô nào admin chưa nhập thì không có nút.
const ZaloMark: ComponentType<{ className?: string }> = ({ className }) => (
  <span aria-hidden="true" className={`${className ?? ''} flex items-center justify-center font-bold leading-none`}>Z</span>
);
const SOCIAL_LOOK: Record<SocialNetwork, { Icon: ComponentType<{ className?: string }>; bg: string }> = {
  facebook: { Icon: FaFacebook, bg: '#1877F2' },
  'facebook-group': { Icon: FaUsers, bg: '#1877F2' },
  youtube: { Icon: FaYoutube, bg: '#FF0000' },
  tiktok: { Icon: FaTiktok, bg: '#010101' },
  instagram: { Icon: FaInstagram, bg: '#C13584' },
  zalo: { Icon: ZaloMark, bg: '#0068FF' },
  website: { Icon: FaGlobe, bg: '#5C4630' },
};

/**
 * Footer chuẩn hệ thống (Responsive & Grid 12 Cột Optimized):
 * - Logo tròn Tùng Lâm Hòa Phúc chính giữa
 * - Tiêu đề TÙNG LÂM HÒA PHÚC (UTM Niagara, font-normal, text-[#F2C14E] drop-shadow-[0_0_12px_rgba(242,193,78,0.5)])
 * - Subtitle: THÔN HOÀ TRÚC - XÃ PHÚ CÁT - THÀNH PHỐ HÀ NỘI
 * - Cột trái (4 Cột - col-span-12 lg:col-span-4): Mạng xã hội + Ngắt 2 dòng giờ mở cửa
 * - Divider: Vạch dọc mờ ở giữa (Desktop), Vạch ngang mờ (Mobile)
 * - Cột phải (8 Cột - col-span-12 lg:col-span-8): Khối "THÔNG TIN LIÊN HỆ" (4 dòng 2-sub-column alignment)
 */
export const Footer: FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { contacts, info } = useSiteChrome();
  // Địa chỉ, giờ mở cửa, khẩu hiệu: của admin (D1) khi đã lưu thông tin trang, không thì chữ có sẵn; admin để trống thì không hiện.
  const address = info?.address ?? 'THÔN HOÀ TRÚC - XÃ PHÚ CÁT - THÀNH PHỐ HÀ NỘI';
  const openingHours = info?.openingHours ?? 'Sáng 7:30 – 10:30 | Chiều 13:30 – 17:30 (Ngày thường)';
  const slogan = info?.slogan ?? 'Nơi để trở về – Chốn thiêng bình yên';
  // Tên chùa do admin đặt; chưa có hay để trống thì giữ tên có sẵn.
  const name = info?.name || 'Tùng Lâm Hòa Phúc';
  const mapsUrl = info?.mapsUrl ?? '';
  const social = info?.social ?? [];
  const contactRows = contactGroups(contacts ?? BUILT_IN_CONTACTS).flatMap(({ role, people }) =>
    Array.from({ length: Math.ceil(people.length / 2) }, (_, i) => ({ role, people: people.slice(i * 2, i * 2 + 2) })),
  );

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === '/') {
      // Nếu đang ở trang chủ: Cuộn mượt lên đầu trang
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Nếu đang ở trang con: Chuyển hướng về trang chủ
      router.push('/');
    }
  };

  return (
    <footer
      id="footer"
      className="relative overflow-hidden pt-16 pb-10 px-6 md:px-10 border-t z-10"
      style={{
        background: "linear-gradient(180deg, #3D2B1F 0%, #2A1D14 100%)",
        borderColor: "rgba(242,193,78,0.2)",
      }}
    >
      {/* ── nền núi non họa tiết Phật giáo cổ kính ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg
          viewBox="0 0 1440 320"
          className="absolute bottom-0 left-0 right-0 w-full"
          style={{ opacity: 0.15 }}
          preserveAspectRatio="none"
        >
          <path
            d="M0,192L48,197.3C96,203,192,213,288,197.3C384,181,480,139,576,144C672,149,768,203,864,224C960,245,1056,235,1152,208C1248,181,1344,139,1392,117.3L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            fill="#F2C14E"
          />
          <path
            d="M0,256L60,245.3C120,235,240,213,360,208C480,203,600,213,720,229.3C840,245,960,267,1080,266.7C1200,267,1320,245,1380,234.7L1440,224L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
            fill="#4A3728"
            style={{ opacity: 0.6 }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(242,193,78,0.1) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">

        {/* ── Logo Tròn Chính Giữa + Tiêu Đề UTM Niagara Font-Normal & Subtitle ── */}
        <div className="flex flex-col items-center mb-10 text-center">
          {/* Logo Tròn Căn Giữa + Glow Effect & Dual Logic */}
          <button
            onClick={handleLogoClick}
            type="button"
            title="Tùng Lâm Hòa Phúc"
            className="mx-auto flex justify-center items-center mb-4 md:mb-6 p-[2px] bg-gradient-to-tr from-[#F2C14E] via-[#FFE5A3] to-[#B8860B] rounded-full shadow-[0_0_25px_rgba(242,193,78,0.55)] hover:shadow-[0_0_35px_rgba(242,193,78,0.85)] hover:scale-105 transition-all duration-300 cursor-pointer group"
          >
            <img loading="lazy" decoding="async"
              src="https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/09-icon-minh-hoa/logo-tung-lam-hoa-phuc-tron.webp"
              alt="Logo Tùng Lâm Hòa Phúc"
              className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover bg-white/95 p-[1px] group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = 'https://media-tunglamhoaphuc.s3.us-east-005.backblazeb2.com/tunglamhoaphuc2/09-icon-minh-hoa/logo-moc-an.webp';
              }}
            />
          </button>

          {/* Tiêu đề UTM Niagara font-normal + Glow Effect */}
          <h2
            className="text-3xl md:text-5xl font-normal tracking-widest text-[#F2C14E] uppercase drop-shadow-[0_0_12px_rgba(242,193,78,0.5)] select-none"
            style={{
              fontFamily: "'UTM Niagara', 'Playfair Display', serif",
              fontWeight: "normal",
              textShadow: "0 0 12px rgba(242,193,78,0.5)",
            }}
          >
            {name}
          </h2>

          {address && (
            <p
              className="mt-3 text-xs md:text-sm tracking-wider uppercase text-[#e3d2c1]"
              style={{
                fontFamily: "'UTM Avo', sans-serif",
                fontWeight: "bold",
              }}
            >
              {address}
            </p>
          )}

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Xem bản đồ chỉ đường đến chùa (mở trong tab mới)"
              className="mt-3 inline-flex items-center gap-1.5 text-xs md:text-sm text-[#F2C14E] hover:underline"
              style={{ fontFamily: "'UTM Avo', sans-serif", fontWeight: 'bold' }}
            >
              <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Xem bản đồ chỉ đường</span>
            </a>
          )}
        </div>

        {/* ── Đường Phân Cách Ngang Toàn Chiều Rộng ── */}
        <div className="h-px w-full mb-10" style={{ background: "linear-gradient(to right, transparent, rgba(242,193,78,0.3), transparent)" }} />

        {/* ── Chia Bố Cục 2 Cột Tân Tiến (Symmetric Margins & Inline Flow) ── */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-8 lg:gap-12 w-full">

          {/* ─ Cột Trái (w-full lg:w-auto shrink-0) ─ */}
          <div className="w-full lg:w-auto shrink-0">
            {/* Mạng xã hội: danh sách, tên và liên kết do admin lưu (site.info.social); admin chưa nhập thì không có khối này, không có nút trống. */}
            {social.length > 0 && (
              <>
                <h4
                  className="text-xs uppercase tracking-widest mb-3 text-[#F2C14E]"
                  style={{
                    fontFamily: "'UTM Avo', sans-serif",
                    fontWeight: "bold",
                  }}
                >
                  Theo dõi {name}
                </h4>
                <ul className="flex flex-wrap items-center gap-3 mb-6 list-none p-0 m-0">
                  {social.map(({ label, url, network }) => {
                    const { Icon, bg } = SOCIAL_LOOK[network];
                    return (
                      <li key={`${label}-${url}`}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${label} (mở trong tab mới)`}
                          title={label}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md transition-all hover:scale-110 cursor-pointer"
                          style={{ background: bg }}
                        >
                          <Icon className="w-4 h-4" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* Thông tin mở cửa (Tách 2 dòng thoáng mắt & Không ngắt cụm (Ngày thường)) */}
            {openingHours && (
              <div
                className="flex flex-col gap-1.5 text-sm md:text-base text-[#E2C89B]/90 mt-4"
                style={{
                  fontFamily: "'UTM Avo', sans-serif",
                  fontWeight: "normal",
                }}
              >
                <p className="flex items-center gap-2 font-semibold text-[#F2C14E]">
                  <Clock className="w-4 h-4 text-[#F2C14E] shrink-0" />
                  <span>Giờ mở cửa đón Phật tử:</span>
                </p>
                <p className="pl-6 text-xs sm:text-sm md:text-sm text-[#e3d2c1]">{openingHours}</p>
              </div>
            )}
          </div>

          {/* Vạch kẻ phân cách đứng (Desktop) / Ngang (Mobile) */}
          <div className="w-[1px] self-stretch bg-gradient-to-b from-transparent via-[#F2C14E]/30 to-transparent hidden lg:block shrink-0" />
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#F2C14E]/30 to-transparent my-2 lg:hidden" />

          {/* ─ Cột Phải (w-full lg:w-auto flex-1) ─ */}
          <div className="w-full lg:w-auto flex-1">
            <h4
              className="text-xs sm:text-sm md:text-base uppercase tracking-widest mb-4 text-[#F2C14E]"
              style={{
                fontFamily: "'UTM Avo', sans-serif",
                fontWeight: "bold",
              }}
            >
              THÔNG TIN LIÊN HỆ
            </h4>

            <div className="space-y-3.5" style={{ fontFamily: "'UTM Avo', sans-serif" }}>
              
              {/* Mỗi vai trò một dòng (tối đa hai người một dòng): số điện thoại do admin lưu ở D1, chưa có thì các dòng có sẵn. */}
              {contactRows.map((row, i) => (
                <div key={`${row.role}-${i}`} className="flex items-start md:items-center gap-2 text-xs sm:text-sm lg:text-[15px] text-[#e3d2c1] whitespace-normal md:whitespace-nowrap">
                  <Phone className="w-4 h-4 text-[#F2C14E] shrink-0 mt-0.5 md:mt-0" />
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-2 leading-normal">
                    <span className="font-medium text-[#E2C89B]">{row.role}:</span>
                    {row.people.map((person, j) => (
                      <span key={`${person.name}-${person.phone}`} className="contents">
                        {j > 0 && <span className="text-[#E2C89B]">–</span>}
                        <span className="font-medium text-[#E2C89B]">{person.name}{row.people.length > 1 ? ':' : ''}</span>
                        {row.people.length === 1 && <span className="text-[#E2C89B]">–</span>}
                        <a href={`tel:${person.phone}`} className="font-bold text-[#F2C14E] hover:underline">
                          {formatPhone(person.phone)}
                        </a>
                      </span>
                    ))}
                  </div>
                </div>
              ))}

            </div>
          </div>

        </div>

        {/* ── Bản Quyền (Copyright) ── */}
        <div
          className="mt-12 pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-3 text-xs"
          style={{
            borderColor: "rgba(242,193,78,0.15)",
            color: "#c9b896",
            fontFamily: "'UTM Avo', sans-serif",
            fontWeight: "normal",
          }}
        >
          <p>© 2026 {name}. Bảo lưu mọi quyền.</p>
          {slogan && (
            <p className="italic" style={{ fontFamily: "'UTM Avo', sans-serif", fontStyle: "italic" }}>
              &quot;{slogan}&quot; 🪷
            </p>
          )}
        </div>

      </div>
    </footer>
  );
};

export default Footer;
