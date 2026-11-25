'use client';

import { FC } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { C } from "@/config/theme";
import { PROGRAMS } from "@/features/home/data/home-data";
import type { SectionRef } from "@/features/home/types";
import { SectionHeader } from "@/components/common/SectionHeader";
import type { HomeProgram } from "@/lib/v3-home-programs";
import { fitImage } from "@/utils/image";
import { imageSrcSet } from "@/lib/tlhp-content/media";

interface ProgramsSectionProps {
  /** Optional: the ref a parent uses to scroll to the section. */
  sectionRef?: SectionRef;
  /**
   * The regular ceremonies of the study calendar (Lịch tu học > Khóa lễ thường kỳ), read from D1 by lib/v3-home-programs.ts
   * `loadHomePrograms`. Without any (the admin has none, or D1 could not be read) the cards V3 was written with are drawn.
   */
  programs?: HomeProgram[] | null;
}

/** The mark on each card is design, not data: they come round in turn. */
const MARKS = ["🪷", "🔔", "🌿"];

type Card = { key: string; title: string; schedule: string; imgUrl: string; imgPosition: string; href: string; emoji: string };

const BUILT_IN: Card[] = PROGRAMS.map((p) => ({ key: p.title, title: p.title, schedule: p.schedule, imgUrl: p.img, imgPosition: "center 50%", href: "", emoji: p.emoji }));

const fromAdmin = (list: HomeProgram[]): Card[] =>
  list.map((p, i) => ({ key: p.id, title: p.title, schedule: p.schedule, imgUrl: p.imgUrl, imgPosition: p.imgPosition, href: p.href, emoji: MARKS[i % MARKS.length] }));

const buttonStyle = { borderColor: `rgba(242,193,78,.4)`, color: C.accent };
const buttonClass = "mt-5 inline-block font-inter text-xs md:text-[11px] uppercase tracking-[.15em] border rounded-lg px-5 py-2 transition-colors";
const hoverOn = (e: React.MouseEvent) => ((e.currentTarget as HTMLElement).style.background = "rgba(242,193,78,.1)");
const hoverOff = (e: React.MouseEvent) => ((e.currentTarget as HTMLElement).style.background = "transparent");

/**
 * "Các Chương Trình Cộng Tu" — recurring program cards.
 * NOTE: this section has no direct match in the requested 7-component list
 * (Hero/Introduction/News/Dharma/Calendar/Gallery/Contact); it is real content
 * from the original page, so it's kept as its own component rather than
 * force-fit into an unrelated section.
 */
const ProgramsSection: FC<ProgramsSectionProps> = ({ sectionRef, programs }) => {
  const cards = programs && programs.length > 0 ? fromAdmin(programs) : BUILT_IN;
  return (
    <section
      ref={sectionRef}
      id="cong-tu"
      className="py-24 px-10"
      style={{ background: C.dark }}
    >
      <div className="max-w-[1280px] mx-auto">
        <SectionHeader title="CÁC CHƯƠNG TRÌNH CỘNG TU" subtitle="Tu học định kỳ" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((prog) => (
            <div
              key={prog.key}
              className="group rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 hover:-translate-y-1"
              style={{
                borderColor: C.border,
                background: `linear-gradient(145deg,${C.secondary},${C.bg})`,
                boxShadow: "0 4px 20px rgba(0,0,0,.3)",
              }}
              onMouseEnter={(e) =>
                ((
                  e.currentTarget as HTMLElement
                ).style.borderColor = `${C.accent}88`)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.borderColor = C.border)
              }
            >
              {/* image + badge */}
              <div className="relative overflow-hidden" style={{ height: 240 }}>
                {prog.imgUrl && (
                  <img
                    src={fitImage(prog.imgUrl, 960)}
                    srcSet={imageSrcSet(prog.imgUrl, [360, 640, 960, 1280])}
                    sizes="(min-width: 1280px) 384px, (min-width: 768px) 30vw, calc(100vw - 80px)"
                    loading="lazy"
                    decoding="async"
                    alt={prog.title}
                    style={{ objectPosition: prog.imgPosition }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top,rgba(42,29,20,.65) 0%,transparent 60%)",
                  }}
                />
                {/* badge */}
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10 w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2"
                  style={{
                    background: C.accent,
                    borderColor: C.accentDeep,
                    boxShadow: "0 4px 14px rgba(0,0,0,.35)",
                  }}
                >
                  {prog.emoji}
                </div>
              </div>
              {/* caption */}
              <div className="px-6 pt-10 pb-7 text-center">
                <h3
                  className="font-cinzel text-lg font-bold mb-2"
                  style={{ color: C.cream }}
                >
                  {prog.title}
                </h3>
                {prog.schedule && (
                  <div
                    className="flex items-center justify-center gap-1.5 font-inter text-xs"
                    style={{ color: C.muted }}
                  >
                    <Calendar
                      className="w-3.5 h-3.5"
                      style={{ color: C.accent }}
                    />
                    <span>{prog.schedule}</span>
                  </div>
                )}
                {prog.href ? (
                  <Link href={prog.href} className={buttonClass} style={buttonStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                    Xem chi tiết
                  </Link>
                ) : (
                  <button className={buttonClass} style={buttonStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                    Đăng ký tham gia
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProgramsSection;
