'use client';

import { FC, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { C } from "@/config/theme";
import type { HomeWelcome } from "@/lib/v3-home-welcome";
import { fitImage } from "@/utils/image";
import { imageSrcSet } from "@/lib/tlhp-content/media";

// "Lời chào": lời chào của chùa, video giới thiệu và các số liệu. Mọi chữ, đường dẫn, video và số do máy chủ đưa vào
// (lib/v3-home-welcome.ts đọc các khối home.welcome, home.stats, home.buddhist_year của admin); component này chỉ vẽ.
// Không có khối (null) thì không vẽ gì. Chỉ import KIỂU từ lib/v3-home-welcome.ts: mã đọc D1 không bao giờ vào trình duyệt.

const COUNT_MS = 1600;

/** 1234 -> "1.234" (viết tay để máy chủ và trình duyệt cho cùng chuỗi, không phụ thuộc ngôn ngữ của máy); năm thì không có dấu chấm. */
export function formatFigure(value: number, year: boolean): string {
  const digits = String(Math.max(0, Math.trunc(value)));
  return year ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Con số đếm từ 0 lên khi cuộn tới. HTML đầu tiên đã mang số thật (người dùng không bật JS, công cụ tìm kiếm và máy đọc màn hình
 * đều đọc số thật: phần hiển thị động là aria-hidden, số thật nằm trong .sr-only). Người đặt "giảm chuyển động" thấy ngay số cuối.
 */
export const CountUp: FC<{ value: number; year?: boolean }> = ({ value, year = false }) => {
  const ref = useRef<HTMLSpanElement>(null);

  // Chữ số được đổi thẳng trên DOM (không qua state): React vẽ số cuối, hiệu ứng chỉ là việc của trình duyệt.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const final = formatFigure(value, year);
    let frame = 0;
    // Đổi nodeValue của chính nút chữ React đang giữ (không thay nút), để lần vẽ lại sau này vẫn ghi đúng chỗ.
    const write = (text: string) => {
      if (node.firstChild) node.firstChild.nodeValue = text;
    };
    write(formatFigure(0, year));
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / COUNT_MS);
          write(progress === 1 ? final : formatFigure(Math.round(value * (1 - Math.pow(1 - progress, 3))), year));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      write(final);
    };
  }, [value, year]);

  return (
    <>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        {formatFigure(value, year)}
      </span>
      <span className="sr-only">{formatFigure(value, year)}</span>
    </>
  );
};

/** Ảnh bìa + nút phát; iframe YouTube chỉ được dựng khi bấm (không tải gì của YouTube lúc mở trang, ngoài ảnh bìa lười). */
const WelcomeVideo: FC<{ video: HomeWelcome["video"]; image: HomeWelcome["image"] }> = ({ video, image }) => {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // Ảnh bìa của D1 (hoặc ảnh YouTube, giữ nguyên) trong khung 16:9 rộng khoảng 477 px (di động ~380 px).
  const cover = image?.src ?? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-2xl border"
      style={{ borderColor: C.border, background: C.dark, boxShadow: "0 18px 50px rgba(0,0,0,.45)" }}
    >
      {playing ? (
        <iframe
          ref={frame}
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`}
          title={video.label}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Xem video: ${video.label}`}
          className="group absolute inset-0 block h-full w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#F2C14E]"
        >
          <img
            src={fitImage(cover, 960)}
            srcSet={imageSrcSet(cover, [640, 960, 1280])}
            sizes="(min-width: 1024px) 477px, calc(100vw - 32px)"
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            style={{ objectPosition: image?.position ?? "center 50%" }}
          />
          <span className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(26,18,11,.7) 0%,rgba(26,18,11,.15) 55%,rgba(26,18,11,.25) 100%)" }} />
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 md:h-20 md:w-20"
              style={{ background: C.accent, borderColor: C.accentDeep, boxShadow: "0 6px 24px rgba(0,0,0,.5)" }}
            >
              <span className="absolute inset-0 rounded-full motion-safe:animate-ping" style={{ background: "rgba(242,193,78,.35)" }} aria-hidden="true" />
              <Play className="relative ml-1 h-8 w-8" style={{ color: C.dark }} fill={C.dark} aria-hidden="true" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
};

export const WelcomeSection: FC<{ welcome: HomeWelcome | null }> = ({ welcome }) => {
  if (!welcome) return null;
  const { title, author, text, link, image, video, stats } = welcome;
  return (
    <section
      id="loi-chao"
      aria-labelledby={title ? "loi-chao-tieu-de" : undefined}
      aria-label={title ? undefined : "Lời chào"}
      className="relative px-4 py-20 md:px-10 md:py-28"
      style={{ background: `linear-gradient(180deg,#1A120B 0%,${C.dark} 50%,#1A120B 100%)` }}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <p className="mb-4 text-xs uppercase tracking-[0.22em] md:text-sm" style={{ color: C.accent, fontFamily: "'UTM Avo', sans-serif" }}>
              Lời chào
            </p>
            {title ? (
              <h2
                id="loi-chao-tieu-de"
                className="text-balance text-3xl font-normal leading-tight md:text-5xl"
                style={{ color: C.accent, fontFamily: "'UTM Niagara', 'UTM_Niagara', serif", textShadow: "0 0 24px rgba(242,193,78,0.35)" }}
              >
                {title}
              </h2>
            ) : null}
            {author ? (
              <p className="mt-4 text-sm italic md:text-base" style={{ color: C.cream, fontFamily: "'UTM Avo', sans-serif" }}>
                — {author}
              </p>
            ) : null}
            {text ? (
              <p className="mt-6 max-w-[62ch] whitespace-pre-line text-base leading-8 md:text-lg" style={{ color: C.muted, fontFamily: "'UTM Avo', sans-serif" }}>
                {text}
              </p>
            ) : null}
            <Link prefetch={false}
              href={link.href}
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg border px-6 py-3 text-xs uppercase tracking-[0.15em] transition-colors hover:bg-[rgba(242,193,78,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E] motion-reduce:transition-none"
              style={{ borderColor: "rgba(242,193,78,.5)", color: C.accent, fontFamily: "'UTM Avo', sans-serif" }}
            >
              {link.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="lg:col-span-5">
            <WelcomeVideo video={video} image={image} />
          </div>
        </div>

        {stats.length ? (
          <dl className={`mt-14 grid gap-5 md:mt-20 ${stats.length > 1 ? "sm:grid-cols-2" : ""} ${stats.length > 2 ? "lg:grid-cols-3" : ""}`}>
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col-reverse justify-end rounded-2xl border px-6 py-7 text-center"
                style={{ borderColor: C.border, background: `linear-gradient(145deg,${C.secondary}55,${C.bg}99)`, boxShadow: "0 4px 20px rgba(0,0,0,.3)" }}
              >
                <dt className="mt-3 text-sm leading-6 md:text-base" style={{ color: C.muted, fontFamily: "'UTM Avo', sans-serif" }}>
                  {stat.label}
                </dt>
                <dd className="m-0 text-5xl leading-none md:text-6xl" style={{ color: C.accent, fontFamily: "'UTM Niagara', 'UTM_Niagara', serif", textShadow: "0 0 20px rgba(242,193,78,0.4)" }}>
                  <CountUp value={stat.value} year={stat.year} />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
};

export default WelcomeSection;
