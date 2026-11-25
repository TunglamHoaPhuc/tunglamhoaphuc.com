"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { bottomOffsetFor, scrollPercent, shouldShowScrollButton } from "@/lib/scroll-progress";

const SIZE = 40;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const BASE_BOTTOM = 20; // khớp bottom-5 của các nút nổi khác

/**
 * Nút tròn nhỏ ở góc dưới phải: vòng cung vàng chạy quanh viền theo phần trăm đã cuộn,
 * số % ở giữa, bấm để cuộn mượt lên đầu trang. Chỉ hiện ở trang dài và sau khi cuộn quá một màn hình.
 * Phần tử cố định khác ở góc dưới (đánh dấu data-fab-avoid) được tránh bằng cách đẩy nút lên cao hơn.
 */
export default function ScrollProgressButton() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [percent, setPercent] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const frame = useRef(0);
  const lastPercent = useRef(-1);
  const lastVisible = useRef(false);

  const update = useCallback(() => {
    frame.current = 0;
    const doc = document.documentElement;
    const y = window.scrollY;
    const p = scrollPercent(y, doc.scrollHeight, window.innerHeight);
    const show = shouldShowScrollButton(y, doc.scrollHeight, window.innerHeight);

    arcRef.current?.style.setProperty("stroke-dashoffset", String(CIRC * (1 - p / 100)));
    if (p !== lastPercent.current) {
      lastPercent.current = p;
      setPercent(p);
    }
    if (show !== lastVisible.current) {
      lastVisible.current = show;
      setVisible(show);
    }

    // Tránh đè các nút/thanh cố định khác ở góc dưới phải
    if (show && btnRef.current) {
      const tops: number[] = [];
      document.querySelectorAll<HTMLElement>("[data-fab-avoid]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.right > window.innerWidth - 72 && r.bottom > window.innerHeight - 240) {
          tops.push(r.top);
        }
      });
      btnRef.current.style.setProperty("--fab-extra", `${bottomOffsetFor(tops, window.innerHeight, BASE_BOTTOM)}px`);
    }
  }, []);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(update);
  }, [update]);

  useEffect(() => {
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    ro?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [schedule, pathname]);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={toTop}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      aria-label={`Cuộn lên đầu trang, đã đọc ${percent}%`}
      title="Lên đầu trang"
      className={`fixed right-3 md:right-5 z-40 grid h-11 w-11 place-items-center rounded-full cursor-pointer bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px)+var(--fab-extra,0px))] transition-[opacity,transform] duration-300 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDE59] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2A1D14] ${
        visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-2"
      }`}
    >
      <span
        className="relative grid place-items-center rounded-full bg-[#2A1D14] shadow-[0_4px_12px_rgba(0,0,0,0.7),0_0_8px_rgba(255,222,89,0.25)] transition-transform duration-300 hover:scale-110 hover:bg-[#3A2718]"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#F2C14E" strokeOpacity="0.28" strokeWidth={STROKE} />
          <circle
            ref={arcRef}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#F2C14E"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC}
          />
        </svg>
        <span
          style={{ fontFamily: "'UTM Avo', sans-serif" }}
          className="relative text-[11px] font-bold leading-none tabular-nums text-[#ffde59]"
        >
          {percent}%
        </span>
      </span>
    </button>
  );
}
