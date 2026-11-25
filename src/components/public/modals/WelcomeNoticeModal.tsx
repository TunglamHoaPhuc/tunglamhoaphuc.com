'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, HeartHandshake, ExternalLink } from 'lucide-react';
import { useSiteChrome } from '@/components/public/SiteChrome';
import { noticeIsCurrent } from '@/lib/v3-menu';

// Khóa của chữ có sẵn (khi admin chưa lưu thông báo nào). Thông báo do admin lưu có khóa riêng theo mã của nó,
// nên đổi nội dung thì người đã đóng bản cũ sẽ thấy bản mới.
const STORAGE_KEY = 'tlhp_welcome_notice_v1_0';

export function WelcomeNoticeModal() {
  const { notice } = useSiteChrome();
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  // Chưa lưu: giữ chữ có sẵn. Admin tắt, để trống hay đã hết hạn: không hiện. Đang bật: chữ của admin.
  const custom = notice.state === 'on' ? notice : null;
  const enabled = notice.state !== 'off';
  const storageKey = custom ? `tlhp_notice_${custom.id}` : STORAGE_KEY;
  const endsAt = custom ? custom.endsAt : null;

  useEffect(() => {
    if (!enabled) return;
    // Trang có thể được dựng từ lâu: hết ngày cuối thì không hiện nữa.
    if (!noticeIsCurrent(endsAt, Date.now())) return;
    // Check if user has already dismissed the notice
    let hasSeen: string | null = null;
    try {
      hasSeen = localStorage.getItem(storageKey);
    } catch {
      // trình duyệt chặn lưu trữ: coi như chưa xem
    }
    if (!hasSeen) {
      // Delay slightly for smooth page entrance
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [enabled, endsAt, storageKey]);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(storageKey, 'seen');
      } catch {
        // không lưu được thì lần sau hộp hiện lại
      }
    }
    setIsOpen(false);
  };

  if (!isOpen || !enabled) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tlhp-welcome-notice-title"
        className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] rounded-2xl overflow-hidden border border-[#F2C14E]/60 bg-gradient-to-b from-[#2A1D14] via-[#20140D] to-[#160D08] text-[#e3d2c1] shadow-[0_0_50px_rgba(242,193,78,0.25)] flex flex-col transform transition-all duration-300 scale-100"
        style={{ fontFamily: "'UTM Avo', sans-serif" }}
      >
        {/* Decorative corner ornaments */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#F2C14E] pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#F2C14E] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#F2C14E] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#F2C14E] pointer-events-none" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 w-11 h-11 sm:w-8 sm:h-8 rounded-full bg-[#3a2718] border border-[#F2C14E]/40 text-[#F2C14E] hover:bg-[#F2C14E] hover:text-black transition-colors flex items-center justify-center cursor-pointer shadow-lg"
          aria-label="Đóng thông báo"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Dharma wheel and Mộc Ấn */}
        <div className="shrink-0 pt-6 sm:pt-8 pb-3 sm:pb-4 px-6 text-center relative border-b border-[#F2C14E]/20 bg-[#25170E]/60">
          <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#3a2718] border-2 border-[#F2C14E] flex items-center justify-center text-[#ffde59] mb-2 sm:mb-3 shadow-[0_0_20px_rgba(242,193,78,0.4)]">
            <span className="text-3xl">☸</span>
          </div>

          {!custom && (
            <div className="inline-block px-3 py-1 rounded-full bg-[#F2C14E]/15 border border-[#F2C14E]/40 text-[#F2C14E] text-xs font-bold tracking-widest uppercase mb-2">
              ẤN BẢN SỐ HÓA V1.0.0 (XUẤT BẢN LẦN THỨ NHẤT)
            </div>
          )}

          <h2
            id="tlhp-welcome-notice-title"
            style={{ fontFamily: "'UTM Niagara', serif" }}
            className="text-4xl sm:text-5xl text-[#ffde59] uppercase tracking-wider font-normal drop-shadow-[0_0_12px_rgba(242,193,78,0.6)] leading-tight"
          >
            {custom ? 'THÔNG BÁO CỦA NHÀ CHÙA' : <>KÍNH MỪNG QUÝ PHẬT TỬ &amp; ĐẠI CHÚNG</>}
          </h2>
        </div>

        {/* Body content */}
        {custom ? (
          <div className="p-5 sm:p-8 space-y-4 text-sm sm:text-base leading-relaxed overflow-y-auto overscroll-contain flex-1 min-h-0">
            <div className="p-4 rounded-xl bg-[#321F14]/70 border border-[#F2C14E]/30 space-y-3">
              <p className="whitespace-pre-line">{custom.text}</p>
              {custom.link && (
                <a
                  href={custom.link.href}
                  {...(custom.link.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="inline-flex items-center gap-1.5 font-bold text-[#F2C14E] hover:underline"
                >
                  <span>{custom.link.label}</span>
                  {custom.link.newTab && <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  {custom.link.newTab && <span className="sr-only">(mở trong tab mới)</span>}
                </a>
              )}
            </div>
          </div>
        ) : (
        <div className="p-5 sm:p-8 space-y-4 text-sm leading-relaxed overflow-y-auto overscroll-contain flex-1 min-h-0">
          <p className="font-semibold text-[#F2C14E] text-sm sm:text-base">
            Nam Mô Bổn Sư Thích Ca Mâu Ni Phật!
          </p>

          <p>
            Kính bạch Chư Tôn Đức Tăng Ni, kính thưa quý thiện nam tín nữ Phật tử và quý bạn đọc thập phương,
          </p>

          <div className="p-4 rounded-xl bg-[#321F14]/70 border border-[#F2C14E]/30 space-y-2">
            <p>
              Nhằm phụng sự Chánh pháp và mở rộng nhịp cầu kết nối truyền thông hoằng pháp trong thời đại số, Ban Biên tập và Đạo tràng Tùng Lâm Hòa Phúc trân trọng ra mắt Cổng thông tin điện tử chính thức của bổn tự (Phiên bản thử nghiệm 1.0.0).
            </p>
            <p className="text-[#FFE5A3]/90 italic">
              * Vì đây là ấn bản số hóa phát hành lần thứ nhất, khối lượng dữ liệu lịch sử, hình ảnh và tư liệu giáo lý đang trong quá trình đối chiếu, chuẩn hóa và tiếp tục bổ sung. Kính mong Chư Tôn Đức cùng quý đại chúng từ bi hoan hỷ lượng thứ cho những thiếu sót ban đầu và hoan hỷ gửi ý kiến đóng góp quý báu để bổn tự ngày một hoàn thiện trang nghiêm hơn.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 text-[#e3d2c1]">
            <HeartHandshake className="w-5 h-5 text-[#F2C14E] shrink-0" />
            <span className="text-sm">
              Kính chúc quý vị và gia quyến thân tâm thường lạc, vạn sự hanh thông, Bồ Đề tâm kiên cố!
            </span>
          </div>
        </div>
        )}

        {/* Footer actions */}
        <div className="shrink-0 p-4 sm:p-6 sm:pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-[#F2C14E]/20 bg-[#1C130D] flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
          <label className="flex items-center gap-3 min-h-11 text-sm sm:text-xs text-[#e3d2c1]/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 rounded border-[#F2C14E]/50 text-[#F2C14E] focus:ring-[#F2C14E] accent-[#F2C14E]"
            />
            <span>Không hiển thị lại thông báo này</span>
          </label>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleClose}
              className="flex-1 sm:flex-none min-h-11 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#F2C14E] to-[#E5A93C] text-[#2A1D14] font-bold text-sm sm:text-xs uppercase tracking-wider shadow-lg hover:shadow-[#F2C14E]/30 hover:scale-[1.02] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Hoan Hỷ Tiếp Tục</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
