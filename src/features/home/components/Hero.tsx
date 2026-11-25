'use client';

import { FC, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, BookOpen, Calendar, Search, Volume2, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import GalaxyTimelineGallery from "./GalaxyTimelineGallery";
import type { HomeHero } from "@/lib/v3-home-content";
import type { HeroFrame } from "@/lib/v3-home-hero";

// ⏱️ MỐC THỜI GIAN CẮT BỎ ĐOẠN DÍNH NGƯỜI (TÍNH BẰNG GIÂY)
const CUT_START = 96;   // 1:36 (Bắt đầu đoạn dính người -> Cắt)
const RESUME_TIME = 164; // 2:44 (Hết đoạn dính người -> Phát tiếp)
// Mốc cắt chỉ đúng với video mặc định (hero.cutIntro); video do admin chọn được phát nguyên vẹn.

// Mỗi khung tự chuyển sau chừng này mili giây (dừng khi rê chuột hoặc có tiêu điểm bên trong, và không tự chuyển nếu người xem chọn giảm chuyển động).
const ROTATE_MS = 8000;

const GOLD = "#F2C14E";
const TITLE_FONT = "'UTM Niagara', 'Playfair Display', serif";
const SUBTITLE_FONT = "'UTM ClassizismAntiqua', 'Playfair Display', serif";
const BUTTON_FONT = "'UTM Avo', sans-serif";

// Một khung: dòng nhỏ phía trên, tiêu đề, dòng phụ, đoạn chữ ngắn và nút. Khung đầu là h1 (HTML từ máy chủ), các khung sau là h2.
const FrameView: FC<{ frame: HeroFrame; index: number; total: number; active: boolean }> = ({ frame, index, total, active }) => {
  // Chữ dài thì được xuống dòng thay vì tràn khỏi màn hình; chữ ngắn giữ đúng kiểu dàn đều của V3.
  const titleLength = frame.title.length;
  const titleClass =
    titleLength > 48
      ? "text-3xl sm:text-4xl md:text-6xl text-balance"
      : titleLength > 18
        ? "text-4xl sm:text-5xl md:text-7xl text-balance"
        : "text-6xl sm:text-7xl md:text-9xl whitespace-nowrap";
  const longSubtitle = frame.subtitle.length > 28;
  const Heading = index === 0 ? "h1" : "h2";

  return (
    <div
      role={total > 1 ? "group" : undefined}
      aria-roledescription={total > 1 ? "khung" : undefined}
      aria-label={total > 1 ? `Khung ${index + 1} trên ${total}` : undefined}
      aria-hidden={active ? undefined : true}
      inert={!active}
      className={`col-start-1 row-start-1 flex flex-col items-center gap-4 transition-opacity duration-700 motion-reduce:transition-none ${active ? "opacity-100" : "invisible opacity-0 pointer-events-none"}`}
    >
      {frame.overline && (
        <p
          className="text-xs sm:text-sm uppercase tracking-[0.25em] text-[#F2C14E] font-bold text-center"
          style={{ fontFamily: BUTTON_FONT, textShadow: "0 1px 12px rgba(0,0,0,0.7)" }}
        >
          {frame.overline}
        </p>
      )}

      {/* ── Tiêu đề chính & Phụ tiêu đề cân xứng hoàn hảo ── */}
      <div className="inline-flex flex-col items-stretch max-w-full mx-auto select-none">
        {/* Tiêu đề chính phông UTM Niagara */}
        <Heading
          className={`${titleClass} tracking-normal text-[#F2C14E] uppercase leading-none font-normal text-center`}
          style={{
            fontFamily: TITLE_FONT,
            fontWeight: "normal",
            textShadow: "0 0 36px rgba(242,193,78,0.8), 0 0 72px rgba(242,193,78,0.4)",
          }}
        >
          {frame.title}
        </Heading>

        {/* Phụ tiêu đề phông UTM Classizism Antiqua: Dạng không bold, chiều dài tự động căn đều khít 100% bằng tiêu đề "NƠI ĐỂ TRỞ VỀ" */}
        {frame.subtitle && (longSubtitle ? (
        <p
          className="w-full text-center text-sm sm:text-base md:text-xl lg:text-2xl text-[#e3d2c1] uppercase font-normal leading-tight mt-2 sm:mt-3 tracking-[0.2em]"
          style={{
            fontFamily: SUBTITLE_FONT,
            fontWeight: "normal",
          }}
        >
          {frame.subtitle}
        </p>
        ) : (
        <p
          className="w-full text-sm sm:text-base md:text-xl lg:text-2xl text-[#e3d2c1] uppercase font-normal leading-tight mt-2 sm:mt-3"
          style={{
            fontFamily: SUBTITLE_FONT,
            fontWeight: "normal",
          }}
        >
          {/* Từng chữ cái nằm trong một thẻ riêng để dàn đều; người dùng trình đọc màn hình nghe cả dòng một lần. */}
          <span className="sr-only">{frame.subtitle}</span>
          <span aria-hidden="true" className="flex justify-between items-center">
            {frame.subtitle.split("").map((char, i) => (
              <span
                key={i}
                className={char === " " ? "inline-block w-2 sm:w-3.5 md:w-5" : "inline-block"}
              >
                {char}
              </span>
            ))}
          </span>
        </p>
        ))}
      </div>

      {frame.text && (
        <p
          className="max-w-2xl text-center text-sm sm:text-base md:text-lg text-[#e3d2c1] leading-relaxed line-clamp-2 sm:line-clamp-3"
          style={{ textShadow: "0 1px 14px rgba(0,0,0,0.75)" }}
        >
          {frame.text}
        </p>
      )}

      {frame.cta && <FrameButton cta={frame.cta} />}
    </div>
  );
};

// Nút của khung: nổi bật hơn năm nút cố định bên dưới. Địa chỉ trong trang đi qua bộ định tuyến, địa chỉ https là liên kết thường.
const FrameButton: FC<{ cta: NonNullable<HeroFrame["cta"]> }> = ({ cta }) => {
  const className = "mt-2 inline-flex items-center justify-center min-h-11 px-6 py-3 rounded-full text-[13px] sm:text-sm font-bold uppercase tracking-wider transition-all hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E]";
  const style = { background: `linear-gradient(135deg, ${GOLD} 0%, #D9A22F 100%)`, color: "#1A120B", fontFamily: BUTTON_FONT, fontWeight: "bold", boxShadow: "0 0 24px rgba(242,193,78,0.35)" } as const;
  return cta.external ? (
    <a href={cta.href} rel="noopener noreferrer" className={className} style={style}>
      {cta.label}
    </a>
  ) : (
    <Link prefetch={false} href={cta.href} className={className} style={style}>
      {cta.label}
    </Link>
  );
};

const CONTROL_CLASS = "inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full text-[#F2C14E] transition-colors hover:bg-[#F2C14E]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E]";

// Khung chữ, nút và video là của admin (home.hero, home.welcome); thiếu hoặc sai thì giữ chữ và video sẵn có (lib/v3-home-content.ts).
export const Hero: FC<{ hero: HomeHero }> = ({ hero }) => {
  const [isGalaxyOpen, setIsGalaxyOpen] = useState(false);
  const playerRef = useRef<any>(null);

  const frames = hero.frames;
  const [active, setActive] = useState(0);
  // Người xem bấm "Tạm dừng"; đang rê chuột (chỉ chuột thật) hoặc có tiêu điểm bên trong; chọn giảm chuyển động; đã tự bấm chuyển khung (thì trình đọc màn hình được báo khung mới).
  const [userPaused, setUserPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Mỗi khung được đủ thời gian của nó: hẹn giờ làm lại mỗi khi đổi khung hay hết tạm dừng.
  useEffect(() => {
    if (frames.length < 2 || userPaused || hold || reducedMotion) return;
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % frames.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [active, frames.length, userPaused, hold, reducedMotion]);

  const go = (index: number) => {
    setInteracted(true);
    setActive((index + frames.length) % frames.length);
  };

  const [videoOn, setVideoOn] = useState(false);

  // Video nền (YouTube, ~2 MB và ~500 KB JS) chỉ tải khi người xem bắt đầu tương tác hoặc sau 8 giây,
  // để trang hiện ngay trên điện thoại (trên máy tính, rê chuột là video chạy).
  useEffect(() => {
    if (videoOn) return;
    const start = () => setVideoOn(true);
    const events = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }));
    const timer = window.setTimeout(start, 8000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, start));
      window.clearTimeout(timer);
    };
  }, [videoOn]);

  // ✂️ TỰ ĐỘNG NHẢY CÓC BỎ QUA ĐOẠN 1:36 -> 2:43
  useEffect(() => {
    if (!videoOn) return;
    // 1. Tải script YouTube IFrame API nếu chưa có
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    }

    let intervalId: NodeJS.Timeout;

    // 2. Hàm khởi tạo Player
    const initPlayer = () => {
      if (!document.getElementById('hero-yt-player')) return;

      playerRef.current = new (window as any).YT.Player('hero-yt-player', {
        videoId: hero.videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          showinfo: 0,
          rel: 0,
          playsinline: 1,
          modestbranding: 1,
          start: 0,
        },
        events: {
          onReady: (event: any) => {
            event.target.mute();
            event.target.playVideo();

            // Giám sát thời gian liên tục mỗi 200ms để bỏ đoạn dính người
            intervalId = setInterval(() => {
              if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                const currentTime = playerRef.current.getCurrentTime();

                // Nếu video phát chạm tới mốc 1:36 (96s) -> Bỏ qua đến thẳng 2:44 (164s)
                if (hero.cutIntro && currentTime >= CUT_START && currentTime < RESUME_TIME) {
                  playerRef.current.seekTo(RESUME_TIME, true);
                }
              }
            }, 200);
          },
          onStateChange: (event: any) => {
            // Khi video chạy hết -> Quay về từ 0:00 phát lại
            if (event.data === (window as any).YT.PlayerState.ENDED) {
              event.target.seekTo(0, true);
              event.target.playVideo();
            }
          }
        }
      });
    };

    // 3. Kích hoạt Player khi YouTube API sẵn sàng
    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [videoOn, hero.videoId, hero.cutIntro]);

  return (
    <section className="relative w-full overflow-hidden flex flex-col items-center justify-between min-h-svh" style={{ background: "#1A120B" }}>
      {/* ── Background Video YouTube API (Khóa hoàn toàn chuột, không hiện Pause) ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <div
          id="hero-yt-player"
          className="w-[150%] h-[150%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0 pointer-events-none scale-125"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, rgba(42,29,20,0.3) 0%, rgba(26,15,8,0.85) 75%, rgba(26,15,8,0.98) 100%)",
          }}
        />
      </div>

      {/* ── Top Spacing for Fixed Header ── */}
      <div className="h-28" />

      {/* ── Hero Center Content ── */}
      <div className="relative z-20 max-w-6xl mx-auto px-4 text-center flex flex-col items-center gap-4 my-auto py-8">

        {/* ── Các khung chữ chồng lên nhau trong một ô lưới: ô cao bằng khung cao nhất nên các nút bên dưới không nhảy khi đổi khung ── */}
        <div
          className="flex flex-col items-center gap-4 max-w-full"
          role={frames.length > 1 ? "group" : undefined}
          aria-roledescription={frames.length > 1 ? "trình chiếu" : undefined}
          aria-label={frames.length > 1 ? "Khung đầu trang" : undefined}
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setHold(true); }}
          onPointerLeave={() => setHold(false)}
          onFocus={() => setHold(true)}
          onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false); }}
        >
          <div className="grid max-w-full justify-items-center" aria-live={frames.length > 1 && interacted ? "polite" : "off"}>
            {frames.map((frame, index) => (
              <FrameView key={frame.id} frame={frame} index={index} total={frames.length} active={index === active} />
            ))}
          </div>

          {frames.length > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button type="button" className={CONTROL_CLASS} onClick={() => go(active - 1)} aria-label="Khung trước">
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <ul className="flex items-center list-none m-0 p-0">
                {frames.map((frame, index) => (
                  <li key={frame.id}>
                    <button
                      type="button"
                      onClick={() => go(index)}
                      aria-label={`Xem khung ${index + 1} trên ${frames.length}: ${frame.title}`}
                      aria-current={index === active ? "true" : undefined}
                      className="inline-flex items-center justify-center w-8 h-11 md:w-6 md:h-6 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E]"
                    >
                      <span
                        aria-hidden="true"
                        className="block rounded-full transition-all"
                        style={{ width: index === active ? 22 : 9, height: 9, background: index === active ? GOLD : "rgba(242,193,78,0.4)" }}
                      />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className={CONTROL_CLASS} onClick={() => go(active + 1)} aria-label="Khung sau">
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
              {!reducedMotion && (
                <button
                  type="button"
                  className={`${CONTROL_CLASS} ml-1`}
                  onClick={() => setUserPaused((paused) => !paused)}
                  aria-label={userPaused ? "Tiếp tục tự chuyển khung" : "Tạm dừng tự chuyển khung"}
                >
                  {userPaused ? <Play className="w-4 h-4" aria-hidden="true" /> : <Pause className="w-4 h-4" aria-hidden="true" />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Dải 5 nút thao tác nhanh (nổi rõ rệt trên z-20, không bị lớp gradient che khuất) ── */}
        <div className="relative z-20 grid grid-cols-2 gap-2 sm:gap-2.5 md:flex md:flex-wrap md:items-center md:justify-center md:gap-3.5 mt-4 md:mt-8 w-full max-w-sm md:max-w-6xl">
          {/* 1. PHÁP THOẠI MỚI NHẤT */}
          <Link prefetch={false}
            href="/vu-tru-phat-giao/giang-duong"
            className="min-h-11 px-3 md:px-5 py-2 md:py-2.5 rounded-full text-[12px] md:text-xs font-bold uppercase tracking-wider flex flex-row items-center justify-center gap-2 text-center transition-all hover:scale-105 md:whitespace-nowrap flex-shrink-0 col-span-2 md:col-span-1"
            style={{
              background: "linear-gradient(135deg, #4A3728 0%, #3D2B1F 100%)",
              border: "1.5px solid #F2C14E",
              color: "#F2C14E",
              fontFamily: "'UTM Avo', sans-serif",
              fontWeight: "bold",
              boxShadow: "0 0 20px rgba(242,193,78,0.25)",
            }}
          >
            <Volume2 className="w-4 h-4 text-[#F2C14E] flex-shrink-0" />
            <span className="md:whitespace-nowrap">PHÁP THOẠI MỚI NHẤT</span>
          </Link>

          {/* 2. KHO ẢNH TƯ LIỆU */}
          <button
            onClick={() => setIsGalaxyOpen(true)}
            className="min-h-11 px-3 md:px-5 py-2 md:py-2.5 rounded-full text-[12px] md:text-xs font-bold uppercase tracking-wider flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 text-center transition-all hover:scale-105 md:whitespace-nowrap flex-shrink-0"
            style={{
              background: "rgba(42,29,20,0.85)",
              border: "1px solid rgba(242,193,78,0.5)",
              color: "#e3d2c1",
              fontFamily: "'UTM Avo', sans-serif",
            }}
          >
            <Sparkles className="w-4 h-4 text-[#F2C14E] flex-shrink-0" />
            <span className="md:whitespace-nowrap">KHO ẢNH TƯ LIỆU</span>
          </button>

          {/* 3. ẤN PHẨM PHẬT GIÁO */}
          <Link prefetch={false}
            href="/tri-tue-phat-phap"
            className="min-h-11 px-3 md:px-5 py-2 md:py-2.5 rounded-full text-[12px] md:text-xs font-bold uppercase tracking-wider flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 text-center transition-all hover:scale-105 md:whitespace-nowrap flex-shrink-0"
            style={{
              background: "rgba(42,29,20,0.85)",
              border: "1px solid rgba(242,193,78,0.5)",
              color: "#e3d2c1",
              fontFamily: "'UTM Avo', sans-serif",
            }}
          >
            <BookOpen className="w-4 h-4 text-[#F2C14E] flex-shrink-0" />
            <span className="md:whitespace-nowrap">ẤN PHẨM PHẬT GIÁO</span>
          </Link>

          {/* 4. ĐĂNG KÝ CỘNG TU */}
          <Link prefetch={false}
            href="/dong-chay-hoang-phap"
            className="min-h-11 px-3 md:px-5 py-2 md:py-2.5 rounded-full text-[12px] md:text-xs font-bold uppercase tracking-wider flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 text-center transition-all hover:scale-105 md:whitespace-nowrap flex-shrink-0"
            style={{
              background: "rgba(42,29,20,0.85)",
              border: "1px solid rgba(242,193,78,0.5)",
              color: "#e3d2c1",
              fontFamily: "'UTM Avo', sans-serif",
            }}
          >
            <Calendar className="w-4 h-4 text-[#F2C14E] flex-shrink-0" />
            <span className="md:whitespace-nowrap">ĐĂNG KÝ CỘNG TU</span>
          </Link>

          {/* 5. TÌM KIẾM & THAM VẤN */}
          <Link prefetch={false}
            href="/tim-kiem"
            className="min-h-11 px-3 md:px-5 py-2 md:py-2.5 rounded-full text-[12px] md:text-xs font-bold uppercase tracking-wider flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 text-center transition-all hover:scale-105 md:whitespace-nowrap flex-shrink-0"
            style={{
              background: "rgba(42,29,20,0.85)",
              border: "1px solid rgba(242,193,78,0.5)",
              color: "#e3d2c1",
              fontFamily: "'UTM Avo', sans-serif",
            }}
          >
            <Search className="w-4 h-4 text-[#F2C14E] flex-shrink-0" />
            <span className="md:whitespace-nowrap">TÌM KIẾM &amp; THAM VẤN</span>
          </Link>
        </div>
      </div>

      <div className="h-10" />

      {/* ── Soft Gradient at Bottom of Hero: Seamlessly merges video into page background behind content ── */}
      <div className="absolute bottom-0 inset-x-0 h-32 md:h-44 bg-gradient-to-t from-[#1A120B] via-[#1A120B]/85 to-transparent pointer-events-none z-0" />

      {/* ── Pop-up Galaxy Timeline Gallery Modal ── */}
      {isGalaxyOpen && <GalaxyTimelineGallery onClose={() => setIsGalaxyOpen(false)} />}
    </section>
  );
};

export default Hero;