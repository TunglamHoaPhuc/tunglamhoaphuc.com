'use client';

import { useEffect, useState, type FC, type FocusEvent } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, Quote } from "lucide-react";
import { SectionHeader } from "@/components/common/SectionHeader";
import { SectionTransitionOverlay } from "@/components/common/SectionTransitionOverlay";
import type { HomeQuoteItem, HomeQuotes } from "@/lib/v3-home-quotes";

/** Thời gian mỗi lời dạy nằm lại trước khi tự chuyển (như www: 9 giây). */
export const QUOTE_DELAY_MS = 9000;

/** Thứ tự ngẫu nhiên (Fisher-Yates); `random` truyền vào được để kiểm thử. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Địa chỉ nguồn chỉ được thành liên kết khi là https:// hoặc đường dẫn nội bộ một dấu "/" (không javascript:, không //host). */
export function quoteLink(value: string): { href: string; external: boolean } | null {
  const url = value.trim();
  if (/[\s\\]/.test(url)) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return { href: url, external: false };
  if (!/^https:\/\/[^/]/.test(url)) return null;
  try {
    return new URL(url).protocol === "https:" ? { href: url, external: true } : null;
  } catch {
    return null;
  }
}

const FONT_BODY = { fontFamily: "'UTM Avo', sans-serif" } as const;
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C14E]";
const ROUND_BUTTON = `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#F2C14E]/50 bg-[#1C120B]/80 text-[#F2C14E] transition-colors hover:bg-[#F2C14E] hover:text-[#1A120B] ${FOCUS}`;

const QuoteSlide: FC<{ quote: HomeQuoteItem; index: number; total: number; active: boolean }> = ({ quote, index, total, active }) => {
  const link = quote.source ? quoteLink(quote.sourceUrl) : null;
  return (
    <figure
      role="group"
      aria-roledescription="lời dạy"
      aria-label={`Lời dạy ${index + 1}/${total}`}
      aria-hidden={active ? undefined : true}
      inert={!active}
      className={`col-start-1 row-start-1 m-0 flex flex-col items-center justify-center px-2 text-center transition-[opacity,visibility] duration-700 motion-reduce:transition-none ${active ? "visible opacity-100" : "invisible opacity-0"}`}
    >
      <Quote aria-hidden="true" className="mb-5 h-9 w-9 text-[#F2C14E]/45 md:h-11 md:w-11" strokeWidth={1.5} />
      <blockquote className="m-0 max-w-3xl space-y-3 text-xl font-medium leading-relaxed text-amber-50/95 md:text-2xl md:leading-relaxed lg:text-[1.75rem]" style={FONT_BODY}>
        {quote.text.split(/\n+/).filter((line) => line.trim()).map((line, i) => (
          <p key={i} className="m-0 text-pretty">
            {line}
          </p>
        ))}
      </blockquote>
      <figcaption className="mt-7 flex flex-col items-center gap-1" style={FONT_BODY}>
        <span aria-hidden="true" className="mb-2 block h-px w-16 bg-gradient-to-r from-transparent via-[#F2C14E]/70 to-transparent" />
        <span className="text-base font-semibold uppercase tracking-[0.14em] text-[#F2C14E] md:text-lg">{quote.author || "Tùng Lâm Hòa Phúc"}</span>
        {quote.source ? (
          <span className="text-sm italic text-amber-100/75 md:text-base">
            {link ? (
              <a
                href={link.href}
                {...(link.external ? { rel: "noopener noreferrer" } : {})}
                className={`underline decoration-[#F2C14E]/50 underline-offset-4 transition-colors hover:text-[#F2C14E] ${FOCUS}`}
              >
                {quote.source}
              </a>
            ) : (
              quote.source
            )}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
};

/**
 * Lời Thầy dạy: các lời dạy (hoặc câu kệ chủ đề tháng) do `loadHomeQuotes` chọn, trượt từng lời một.
 * Tự chuyển sau 9 giây, nhưng dừng khi con trỏ nằm trên khối, khi bàn phím đang ở trong khối, khi người xem bấm nút "Tạm dừng",
 * và không bao giờ tự chuyển khi máy đặt giảm chuyển động (prefers-reduced-motion). Có nút Trước/Kế tiếp và dải chấm chọn lời.
 * `null` hoặc rỗng: không vẽ gì.
 */
export const QuotesSection: FC<{ quotes: HomeQuotes | null }> = ({ quotes }) => {
  const [order, setOrder] = useState<HomeQuoteItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  // Xáo trộn chỉ làm được trong trình duyệt: bản máy chủ giữ thứ tự admin nên hai bản khớp nhau ở lần vẽ đầu (và trang vẫn cache được).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(quotes?.mode === "ngau-nhien" && quotes.items.length > 1 ? shuffled(quotes.items) : null);
  }, [quotes]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const items = order ?? quotes?.items ?? [];
  const total = items.length;
  const current = total ? Math.min(index, total - 1) : 0;
  const running = total > 1 && !reduced && !userPaused && !hovered && !focused;

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % total), QUOTE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [running, current, total]);

  if (!quotes || !total) return null;

  const go = (to: number) => setIndex(((to % total) + total) % total);
  const leave = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  };

  return (
    <section
      aria-roledescription="trình chiếu"
      aria-label="Lời Thầy dạy"
      className="relative w-full overflow-hidden bg-[#1A120B] py-16"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={leave}
    >
      <SectionTransitionOverlay position="both" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(242,193,78,0.10),transparent_65%)]" />

      <SectionHeader title="LỜI THẦY DẠY" subtitle={quotes.eyebrow} icon={<Quote aria-hidden="true" className="h-9 w-9 text-[#F2C14E] md:h-12 md:w-12" strokeWidth={1.5} />} />

      <div className="relative z-20 mx-auto max-w-5xl px-4 md:px-10">
        <div aria-live={running ? "off" : "polite"} aria-atomic="true" className="grid min-h-[16rem] items-center md:min-h-[18rem]">
          {items.map((quote, i) => (
            <QuoteSlide key={quote.id} quote={quote} index={i} total={total} active={i === current} />
          ))}
        </div>

        {total > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-3 md:gap-5">
            <button type="button" className={ROUND_BUTTON} aria-label="Lời dạy trước" onClick={() => go(current - 1)}>
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <div className="flex flex-wrap items-center justify-center">
              {items.map((quote, i) => (
                <button
                  key={quote.id}
                  type="button"
                  aria-label={`Xem lời dạy ${i + 1}/${total}`}
                  aria-current={i === current ? "true" : undefined}
                  onClick={() => go(i)}
                  className={`group inline-flex h-11 w-5 items-center justify-center md:w-6 ${FOCUS}`}
                >
                  <span aria-hidden="true" className={`block h-2.5 w-2.5 rounded-full border border-[#F2C14E]/70 transition-colors ${i === current ? "bg-[#F2C14E]" : "bg-transparent group-hover:bg-[#F2C14E]/40"}`} />
                </button>
              ))}
            </div>
            <button type="button" className={ROUND_BUTTON} aria-label="Lời dạy kế tiếp" onClick={() => go(current + 1)}>
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </button>
            {reduced ? null : (
              <button
                type="button"
                className={ROUND_BUTTON}
                aria-label={userPaused ? "Tiếp tục tự chuyển lời dạy" : "Tạm dừng tự chuyển lời dạy"}
                onClick={() => setUserPaused((value) => !value)}
              >
                {userPaused ? <Play aria-hidden="true" className="h-4 w-4" /> : <Pause aria-hidden="true" className="h-4 w-4" />}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default QuotesSection;
