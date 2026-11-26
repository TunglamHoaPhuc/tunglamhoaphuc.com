'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, FileText, Menu, Play, X } from './icons';
import {
  FULL_ESSAY_SECTIONS,
  MUSEUM_YOUTUBE_VIDEO,
  REFERENCE_BOOK,
  VAN_HOA_CHAPTERS,
  type StoryBeat,
  type VanHoaChapter,
} from './data';
import { introSizes, stageSizes, vhImage } from './image';
import './van-hoa-tailwind.css';
import './van-hoa-story.css';

const TOTAL_CHAPTERS = VAN_HOA_CHAPTERS.length;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const COARSE_POINTER = '(hover: none) and (pointer: coarse)';
/** Thời gian thẻ mở chương mờ đi sau khi người xem bấm "Tiếp tục" (chỉ khi cho phép chuyển động). */
const INTRO_CLOSE_MS = 700;
const TEXT_SWAP_MS = 240;
const LAYER_PRUNE_MS = 1250;

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION).matches;

type StageLayout = 'portrait' | 'landscape-full' | 'landscape-side';
const layoutOf = (beat: StoryBeat): StageLayout =>
  beat.imageOrientation === 'portrait' ? 'portrait' : beat.desktopLayout === 'side' ? 'landscape-side' : 'landscape-full';

// Danh sách phẳng các khung hình theo thứ tự xem (thẻ mở chương rồi các khung của phần đó): dùng để
// biết hai khung kế tiếp cần nạp trước. Tính một lần, không đụng tới window.
const FRAMES: Array<{ url: string; sizes: string }> = [];
const CHAPTER_START: number[] = [];
for (const chapter of VAN_HOA_CHAPTERS) {
  CHAPTER_START.push(FRAMES.length);
  FRAMES.push({ url: chapter.introBackdropUrl, sizes: introSizes(chapter.introBackdropWidth, chapter.introBackdropHeight) });
  for (const beat of chapter.beats) {
    FRAMES.push({ url: beat.imageUrl, sizes: stageSizes(beat.imageWidth, beat.imageHeight, layoutOf(beat)) });
  }
}

// Thiết bị cảm ứng (vuốt) hay chuột và bàn phím: quyết định lời gợi ý điều hướng.
function subscribeCoarsePointer(onChange: () => void) {
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const getCoarsePointer = () => window.matchMedia(COARSE_POINTER).matches;
const getCoarsePointerOnServer = () => false;

/**
 * Brand Guideline Editorial Inline Renderer:
 * Parses ***bold-italic gold***, **bold ivory**, and *italic* cleanly in UTM Avo
 * so citations, book titles, key heritage concepts, and emphasis follow publishing standards.
 */
function renderEditorialText(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('***') && token.endsWith('***') && token.length > 6) {
      // Dùng UTM Avo nghiêng thường (không dùng bản đậm nghiêng: tệp đó làm rơi dấu mũ của "ậ").
      return (
        <em key={idx} className="font-normal italic text-[#FFE8AE]">
          {token.slice(3, -3)}
        </em>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#FFF7E2]">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={idx} className="italic text-[#F3E6CE]">
          {token.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

/** Chữ báo cho trình đọc màn hình ở liên kết mở tab mới. */
function NewTabHint() {
  return <span className="sr-only"> (mở tab mới)</span>;
}

/**
 * Balanced Two-Tier Typography Lockup:
 * - Top line: UTM Niagara (condensed gold display)
 * - Sub line: UTM ClassizismAntiqua (uppercase tracked)
 * Cân độ rộng hai dòng sau khi nạp phông và khi đổi cỡ khung. Cả hai dòng nằm trong MỘT thẻ
 * tiêu đề (h1 hoặc h2 theo `as`) có aria-label là tiêu đề đầy đủ; từng chữ chạy hiệu ứng và
 * hai dòng bên trong là aria-hidden để trình đọc không đọc từng ký tự.
 */
function BalancedTitleLockup({
  top,
  sub,
  as: Heading,
  align = 'left',
  size = 'stage',
  staggerReveal = false,
}: {
  top: string;
  sub: string;
  as: 'h1' | 'h2';
  align?: 'left' | 'center' | 'right';
  size?: 'stage' | 'intro';
  staggerReveal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topMeasureRef = useRef<HTMLSpanElement | null>(null);
  const subMeasureRef = useRef<HTMLSpanElement | null>(null);

  const [topTrackingPx, setTopTrackingPx] = useState<number | null>(null);
  const [subTrackingPx, setSubTrackingPx] = useState<number | null>(null);
  const [canKeepSingleLine, setCanKeepSingleLine] = useState<boolean>(true);
  const [dividerWidthPx, setDividerWidthPx] = useState<number | null>(null);

  useEffect(() => {
    let rafId = 0;
    let cancelled = false;

    const computeBalance = () => {
      const container = containerRef.current;
      const topEl = topMeasureRef.current;
      const subEl = subMeasureRef.current;
      if (cancelled || !container || !topEl || !subEl) return;

      const maxW = container.clientWidth;
      const topNaturalW = topEl.getBoundingClientRect().width;
      const subNaturalW = subEl.getBoundingClientRect().width;

      if (maxW <= 0 || topNaturalW <= 0 || subNaturalW <= 0) return;

      if (topNaturalW > maxW || subNaturalW > maxW) {
        setCanKeepSingleLine(false);
        setTopTrackingPx(null);
        setSubTrackingPx(null);
        setDividerWidthPx(Math.min(maxW, 280));
        return;
      }

      setCanKeepSingleLine(true);
      const topChars = Math.max(1, Array.from(top).length - 1);
      const subChars = Math.max(1, Array.from(sub).length - 1);

      const targetW = Math.min(maxW, Math.max(topNaturalW, subNaturalW));
      const topDiff = Math.max(0, targetW - topNaturalW);
      const subDiff = Math.max(0, targetW - subNaturalW);

      const topPerChar = Math.min(topDiff / topChars, 6);
      const subPerChar = Math.min(subDiff / subChars, 11);

      setTopTrackingPx(Number(topPerChar.toFixed(2)));
      setSubTrackingPx(Number(subPerChar.toFixed(2)));

      const finalTopW = topNaturalW + topPerChar * topChars;
      const finalSubW = subNaturalW + subPerChar * subChars;
      setDividerWidthPx(Math.max(170, Math.min(maxW, Math.round(Math.max(finalTopW, finalSubW)))));
    };

    const schedule = () => {
      if (cancelled) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(computeBalance);
    };

    schedule();
    // Chờ phông nạp xong rồi đo lại; bỏ qua nếu thành phần đã gỡ (cancelled).
    if ('fonts' in document) {
      document.fonts.ready.then(schedule, () => {});
    }

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [top, sub, size]);

  const topSizeClass =
    size === 'intro'
      ? 'text-[2.75rem] sm:text-[4.25rem] lg:text-[5.25rem] leading-[1.02]'
      : 'text-[2.5rem] sm:text-[3.25rem] lg:text-[3.95rem] leading-[1.02]';

  const subSizeClass =
    size === 'intro'
      ? 'text-base sm:text-[1.2rem] lg:text-[1.45rem] leading-[1.35]'
      : 'text-base lg:text-[1.15rem] leading-[1.35]';

  const alignClass =
    align === 'center'
      ? 'items-center text-center'
      : align === 'right'
        ? 'items-start lg:items-end text-left lg:text-right'
        : 'items-start text-left';

  const topCharArray = useMemo(() => Array.from(top), [top]);
  const subCharArray = useMemo(() => Array.from(sub), [sub]);
  const subStartDelayMs = Math.min(900, Math.max(480, topCharArray.length * 42 + 120));
  const dividerDelayMs = subStartDelayMs + Math.min(700, subCharArray.length * 32) + 120;
  const staggered = staggerReveal && canKeepSingleLine;

  return (
    <div ref={containerRef} className={`relative w-full flex flex-col ${alignClass}`}>
      <div aria-hidden="true" className="pointer-events-none invisible fixed -top-[9999px] left-0 whitespace-nowrap">
        <span
          ref={topMeasureRef}
          className={`vh-font-display inline-block uppercase ${topSizeClass}`}
          style={{ letterSpacing: '0px' }}
        >
          {top}
        </span>
        <span
          ref={subMeasureRef}
          className={`vh-font-label inline-block uppercase ${subSizeClass}`}
          style={{ letterSpacing: '0px' }}
        >
          {sub}
        </span>
      </div>

      <Heading aria-label={`${top} ${sub}`} className="vh-title flex flex-col">
        <span
          aria-hidden="true"
          className={`vh-font-display vh-title-top block uppercase text-[#FFE5A3] ${topSizeClass} ${
            canKeepSingleLine ? 'whitespace-nowrap' : ''
          }`}
          style={
            staggered
              ? undefined
              : {
                  letterSpacing: topTrackingPx !== null ? `${topTrackingPx}px` : '0.03em',
                  marginRight:
                    topTrackingPx !== null && (align === 'center' || align === 'right') ? `-${topTrackingPx}px` : undefined,
                }
          }
        >
          {staggered
            ? topCharArray.map((ch, idx) => (
                <span
                  key={`${top}-t-${idx}`}
                  className="vh-char-reveal inline-block"
                  style={{
                    animationDelay: `${idx * 42}ms`,
                    marginRight:
                      idx < topCharArray.length - 1 ? (topTrackingPx !== null ? `${topTrackingPx}px` : '0.03em') : '0px',
                  }}
                >
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))
            : top}
        </span>

        <span
          aria-hidden="true"
          className={`vh-font-label vh-title-sub mt-1.5 block uppercase text-[#F4D99B] ${subSizeClass} ${
            canKeepSingleLine ? 'whitespace-nowrap' : ''
          }`}
          style={
            staggered
              ? undefined
              : {
                  letterSpacing: subTrackingPx !== null ? `${subTrackingPx}px` : '0.16em',
                  marginRight:
                    subTrackingPx !== null && (align === 'center' || align === 'right') ? `-${subTrackingPx}px` : undefined,
                }
          }
        >
          {staggered
            ? subCharArray.map((ch, idx) => (
                <span
                  key={`${sub}-s-${idx}`}
                  className="vh-char-reveal inline-block"
                  style={{
                    animationDelay: `${subStartDelayMs + idx * 32}ms`,
                    marginRight:
                      idx < subCharArray.length - 1 ? (subTrackingPx !== null ? `${subTrackingPx}px` : '0.16em') : '0px',
                  }}
                >
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))
            : sub}
        </span>
      </Heading>

      {/* Gold-gradient lotus divider (trang trí) */}
      <div
        aria-hidden="true"
        className={`vh-divider relative h-8 my-3 sm:my-4 ${staggerReveal ? 'vh-divider-bloom' : ''}`}
        style={{
          width: dividerWidthPx ? `${dividerWidthPx}px` : size === 'intro' ? '260px' : '240px',
          maxWidth: '100%',
          animationDelay: staggerReveal ? `${dividerDelayMs}ms` : undefined,
        }}
      >
        <img
          src="/images/van-hoa-viet-nam/divider-lotus-gold.png"
          alt=""
          width={360}
          height={32}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-contain ${
            align === 'center' ? 'object-center' : align === 'right' ? 'object-left lg:object-right' : 'object-left'
          }`}
        />
      </div>
    </div>
  );
}

/**
 * Nền của thẻ mở chương: ôm đúng tỷ lệ ảnh (đã ghi trong data nên không xê dịch khi ảnh tải xong),
 * bốn cạnh tan như sương. Chỉ MỘT thẻ <img>.
 */
function IntroBackdropExactFit({ chapter, isFirst }: { chapter: VanHoaChapter; isFirst: boolean }) {
  const ratio = chapter.introBackdropWidth / chapter.introBackdropHeight;
  const image = vhImage(chapter.introBackdropUrl);
  return (
    <div className="vh-intro-backdrop absolute inset-0 overflow-hidden bg-[#090705]">
      <div className="vh-photo-stage-box vh-intro-stage-box absolute inset-y-4 inset-x-4 sm:inset-y-6 sm:inset-x-8 flex items-center justify-center">
        <div
          style={{ '--img-ratio': String(Number(ratio.toFixed(4))) } as React.CSSProperties}
          className="vh-exact-fit-frame vh-feather-photo-all overflow-hidden"
        >
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={introSizes(chapter.introBackdropWidth, chapter.introBackdropHeight)}
            width={chapter.introBackdropWidth}
            height={chapter.introBackdropHeight}
            alt=""
            decoding="async"
            fetchPriority={isFirst ? 'high' : 'auto'}
            className="vh-intro-img absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
      <div className="vh-intro-veil absolute inset-0" />
    </div>
  );
}

interface MediaLayerItem {
  layerKey: string;
  beat: StoryBeat;
  isInitial?: boolean;
}

/** Hai khung cùng ảnh và cùng bố cục thì không cần dựng lớp mới (chỉ đổi chữ). */
const sameVisual = (a: StoryBeat, b: StoryBeat) =>
  a.imageUrl === b.imageUrl && a.focalSide === b.focalSide && a.desktopLayout === b.desktopLayout;

/**
 * Lớp hình toàn khung, không cắt ảnh. Mỗi lớp chỉ có MỘT thẻ <img>; bố cục điện thoại / máy tính do
 * CSS chọn theo data-* (không dựng hai bản), cỡ ảnh theo `sizes`. Tỷ lệ ảnh có sẵn trong data.
 */
function FullBleedVisualLayer({ beat, isActive, isInitial }: { beat: StoryBeat; isActive: boolean; isInitial?: boolean }) {
  const image = vhImage(beat.imageUrl);
  const ratio = Number((beat.imageWidth / beat.imageHeight).toFixed(4));

  return (
    <div
      className="vh-layer"
      data-active={isActive}
      data-initial={isInitial ? 'true' : undefined}
      data-orient={beat.imageOrientation}
      data-layout={beat.desktopLayout === 'side' ? 'side' : 'full'}
      data-focal={beat.focalSide}
      aria-hidden={isActive ? undefined : true}
    >
      <div className="vh-photo-stage-box">
        <div style={{ '--img-ratio': String(ratio) } as React.CSSProperties} className="vh-exact-fit-frame overflow-hidden">
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes={stageSizes(beat.imageWidth, beat.imageHeight, layoutOf(beat))}
            width={beat.imageWidth}
            height={beat.imageHeight}
            alt={isActive ? beat.artifactTitle : ''}
            decoding="async"
            fetchPriority={isInitial ? 'high' : 'auto'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
      <div className="vh-scrim pointer-events-none absolute inset-0" />
    </div>
  );
}

type IntroPhase = 'open' | 'closing' | 'closed';

export default function VanHoaScrollytelling() {
  const [nav, setNav] = useState({ chapter: 0, beat: 0 });
  const [introPhase, setIntroPhase] = useState<IntroPhase>('open');
  const [introChapterIdx, setIntroChapterIdx] = useState(0);
  // Thẻ mở chương đầu tiên hiện ngay khi nạp trang (không mờ dần vào, để ảnh đầu hiện sớm); các lần sau mờ dần vào.
  const [introAnimate, setIntroAnimate] = useState(false);

  const [mediaStack, setMediaStack] = useState<MediaLayerItem[]>(() => [
    {
      layerKey: `${VAN_HOA_CHAPTERS[0].beats[0].id}-init`,
      beat: VAN_HOA_CHAPTERS[0].beats[0],
      isInitial: true,
    },
  ]);

  // Chữ đổi chậm hơn ảnh một nhịp (mờ ra, đổi, hiện lại) để thanh tiến trình và ảnh phản hồi ngay.
  const [displayedBeat, setDisplayedBeat] = useState<StoryBeat>(VAN_HOA_CHAPTERS[0].beats[0]);
  const [textFadePhase, setTextFadePhase] = useState<'idle' | 'out-all' | 'out-body'>('idle');

  const [pulseNextChapter, setPulseNextChapter] = useState(false);
  const [isYoutubeModalOpen, setIsYoutubeModalOpen] = useState(false);
  const isCoarsePointer = useSyncExternalStore(subscribeCoarsePointer, getCoarsePointer, getCoarsePointerOnServer);

  const directoryDialogRef = useRef<HTMLDialogElement | null>(null);
  const readerDialogRef = useRef<HTMLDialogElement | null>(null);
  const bookDialogRef = useRef<HTMLDialogElement | null>(null);
  const youtubeDialogRef = useRef<HTMLDialogElement | null>(null);
  const introButtonRef = useRef<HTMLButtonElement | null>(null);
  const forwardButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollRegionRef = useRef<HTMLElement | null>(null);
  const wheelCooldownRef = useRef<number>(0);
  const lastInnerScrollRef = useRef<number>(0);
  const touchRef = useRef<{ y: number; canDown: boolean; canUp: boolean } | null>(null);
  const introCloseTimerRef = useRef<number | null>(null);
  const mediaPruneTimerRef = useRef<number | null>(null);
  const textSwapTimerRef = useRef<number | null>(null);
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  const layerSeqRef = useRef<number>(1);
  const displayedRef = useRef<StoryBeat>(VAN_HOA_CHAPTERS[0].beats[0]);

  const activeChapter: VanHoaChapter = VAN_HOA_CHAPTERS[nav.chapter] ?? VAN_HOA_CHAPTERS[0];
  const chapterBeats = activeChapter.beats;
  const activeBeat: StoryBeat = chapterBeats[nav.beat] ?? chapterBeats[0];
  const beatIndex = nav.beat;
  const chapterIndex = nav.chapter;
  const isLastBeatInChapter = beatIndex === chapterBeats.length - 1;
  const isLastChapter = chapterIndex === TOTAL_CHAPTERS - 1;
  const introOpen = introPhase === 'open';
  const isTextOnRightDesktop = displayedBeat.focalSide === 'left';

  // Nạp trước tối đa HAI khung kế tiếp (kể cả ảnh nền thẻ mở chương), đúng srcset/sizes mà <img>
  // sẽ chọn; không nạp khi người xem bật chế độ tiết kiệm dữ liệu.
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const position = CHAPTER_START[chapterIndex] + 1 + beatIndex;
    for (const frame of FRAMES.slice(position + 1, position + 3)) {
      if (preloadedUrlsRef.current.has(frame.url)) continue;
      preloadedUrlsRef.current.add(frame.url);
      const image = vhImage(frame.url);
      const probe = new window.Image();
      probe.decoding = 'async';
      if (image.srcSet) {
        probe.sizes = frame.sizes;
        probe.srcset = image.srcSet;
      }
      probe.src = image.src;
    }
  }, [chapterIndex, beatIndex]);

  // Gỡ mọi hẹn giờ khi rời trang.
  useEffect(() => {
    return () => {
      if (introCloseTimerRef.current) window.clearTimeout(introCloseTimerRef.current);
      if (mediaPruneTimerRef.current) window.clearTimeout(mediaPruneTimerRef.current);
      if (textSwapTimerRef.current) window.clearTimeout(textSwapTimerRef.current);
    };
  }, []);

  /** Chữ: mờ ra, đổi, hiện lại. Quay về đúng khung đang hiện thì hủy lần đổi đang chờ và hiện lại ngay. */
  const showText = useCallback((next: StoryBeat, instant: boolean) => {
    if (textSwapTimerRef.current) window.clearTimeout(textSwapTimerRef.current);
    const current = displayedRef.current;
    if (current.id === next.id) {
      setTextFadePhase('idle');
      return;
    }
    const sameTitle = current.titleGroupId === next.titleGroupId && current.focalSide === next.focalSide;
    const sameContent = sameTitle && (current.contentGroupId ?? current.id) === (next.contentGroupId ?? next.id);
    const swap = () => {
      displayedRef.current = next;
      setDisplayedBeat(next);
      setTextFadePhase('idle');
    };
    // Cùng tiêu đề và cùng chữ (chỉ đổi ảnh), đang bị thẻ mở chương che, hoặc người xem không muốn
    // chuyển động: đổi ngay.
    if (sameContent || instant || prefersReducedMotion()) {
      swap();
      return;
    }
    setTextFadePhase(sameTitle ? 'out-body' : 'out-all');
    textSwapTimerRef.current = window.setTimeout(swap, TEXT_SWAP_MS);
  }, []);

  /** Ảnh: lớp mới chồng lên lớp cũ, rồi lớp cũ được gỡ. */
  const showMedia = useCallback((beat: StoryBeat) => {
    // Số thứ tự lớp tăng ở đây, ngoài hàm cập nhật state (hàm đó phải thuần túy).
    layerSeqRef.current += 1;
    const nextKey = `${beat.id}-${layerSeqRef.current}`;
    setMediaStack((prev) => {
      const top = prev[prev.length - 1];
      if (top && sameVisual(top.beat, beat)) {
        // Cùng ảnh: giữ lớp, chỉ cập nhật mô tả ảnh của khung mới.
        return [...prev.slice(0, -1), { ...top, beat }];
      }
      return [...(top ? [top] : []), { layerKey: nextKey, beat }];
    });
    if (mediaPruneTimerRef.current) window.clearTimeout(mediaPruneTimerRef.current);
    mediaPruneTimerRef.current = window.setTimeout(() => {
      setMediaStack((prev) => (prev.length > 1 ? [prev[prev.length - 1]] : prev));
    }, LAYER_PRUNE_MS);
  }, []);

  const focusSoon = useCallback((target: React.RefObject<HTMLElement | null>) => {
    window.requestAnimationFrame(() => target.current?.focus({ preventScroll: true }));
  }, []);

  const openIntro = useCallback(
    (chapterIdx: number) => {
      if (introCloseTimerRef.current) window.clearTimeout(introCloseTimerRef.current);
      setIntroChapterIdx(chapterIdx);
      setIntroAnimate(true);
      setIntroPhase('open');
      focusSoon(introButtonRef);
    },
    [focusSoon]
  );

  /** Người xem bấm "Tiếp tục" (hoặc Enter, Space, Esc, cuộn): thẻ mở chương đóng. Không có hẹn giờ tự đóng. */
  const dismissIntro = useCallback(() => {
    if (introCloseTimerRef.current) window.clearTimeout(introCloseTimerRef.current);
    if (prefersReducedMotion()) {
      setIntroPhase('closed');
    } else {
      setIntroPhase('closing');
      introCloseTimerRef.current = window.setTimeout(() => setIntroPhase('closed'), INTRO_CLOSE_MS);
    }
    focusSoon(forwardButtonRef);
  }, [focusSoon]);

  const goTo = useCallback(
    (targetChap: number, targetBeat: number, playIntro: boolean) => {
      const chapter = Math.max(0, Math.min(TOTAL_CHAPTERS - 1, targetChap));
      const beatNo = Math.max(0, Math.min(VAN_HOA_CHAPTERS[chapter].beats.length - 1, targetBeat));
      const beat = VAN_HOA_CHAPTERS[chapter].beats[beatNo];
      const opensIntro = playIntro && beatNo === 0;

      setNav({ chapter, beat: beatNo });
      setPulseNextChapter(false);
      showMedia(beat);
      showText(beat, opensIntro || introPhase === 'open');
      if (opensIntro) {
        openIntro(chapter);
      } else if (introPhase !== 'closed') {
        if (introCloseTimerRef.current) window.clearTimeout(introCloseTimerRef.current);
        setIntroPhase('closed');
      }
    },
    [introPhase, openIntro, showMedia, showText]
  );

  const stepBeat = useCallback(
    (delta: number) => {
      if (introOpen) {
        dismissIntro();
        return;
      }
      if (delta > 0) {
        if (beatIndex < chapterBeats.length - 1) {
          goTo(chapterIndex, beatIndex + 1, false);
        } else if (chapterIndex < TOTAL_CHAPTERS - 1) {
          setPulseNextChapter(true);
        }
      } else if (delta < 0) {
        setPulseNextChapter(false);
        if (beatIndex > 0) {
          goTo(chapterIndex, beatIndex - 1, false);
        } else if (chapterIndex > 0) {
          goTo(chapterIndex - 1, VAN_HOA_CHAPTERS[chapterIndex - 1].beats.length - 1, false);
        }
      }
    },
    [introOpen, dismissIntro, beatIndex, chapterBeats.length, chapterIndex, goTo]
  );

  /** Nút "Tiếp theo": khung kế; hết phần thì sang phần sau (qua thẻ mở chương); hết triển lãm thì mở toàn văn. */
  const goForward = useCallback(() => {
    if (!isLastBeatInChapter) {
      goTo(chapterIndex, beatIndex + 1, false);
    } else if (!isLastChapter) {
      goTo(chapterIndex + 1, 0, true);
    } else {
      readerDialogRef.current?.showModal();
    }
  }, [isLastBeatInChapter, isLastChapter, chapterIndex, beatIndex, goTo]);

  const isAnyDialogOpen = () =>
    Boolean(
      directoryDialogRef.current?.open ||
        readerDialogRef.current?.open ||
        bookDialogRef.current?.open ||
        youtubeDialogRef.current?.open
    );

  const openYoutubePopup = useCallback(() => {
    setIsYoutubeModalOpen(true);
    youtubeDialogRef.current?.showModal();
  }, []);

  // Safari fallback for closedby="any" light-dismiss on native <dialog>
  useEffect(() => {
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const dialogs = [
      directoryDialogRef.current,
      readerDialogRef.current,
      bookDialogRef.current,
      youtubeDialogRef.current,
    ].filter((d): d is HTMLDialogElement => d !== null);
    const cleanups: Array<() => void> = [];
    const isOutside = (e: PointerEvent, dialog: HTMLDialogElement) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of dialogs) {
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e, dialog);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e, dialog) && dialog.open) dialog.close();
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanups.push(() => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      });
    }
    return () => cleanups.forEach((fn) => fn());
  }, []);

  /**
   * Vùng chữ cuộn được (data-vh-scrollable): còn chỗ cuộn theo hướng yêu cầu thì cuộn nội dung,
   * chỉ khi đã chạm đáy / đỉnh mới đổi khung. Trả về true nếu đã cuộn.
   */
  const scrollRegionBy = useCallback((direction: 1 | -1, amount: number) => {
    const region = scrollRegionRef.current;
    if (!region) return false;
    const max = region.scrollHeight - region.clientHeight;
    if (max <= 1) return false;
    if (direction > 0 ? region.scrollTop >= max - 1 : region.scrollTop <= 0) return false;
    region.scrollBy({ top: direction * amount, behavior: 'auto' });
    lastInnerScrollRef.current = Date.now();
    return true;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isAnyDialogOpen()) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const onBody = !target || target === document.body || target === document.documentElement;

      // Ô nhập, thanh trượt, tab, hộp thoại: để phím làm việc của chúng.
      if (target?.closest('input, textarea, select, [role="slider"], [role="tab"], [role="radio"], [contenteditable="true"], dialog')) {
        return;
      }
      const onControl = Boolean(target?.closest('button, a[href], summary'));

      if (e.key === 'Escape') {
        if (introOpen) dismissIntro();
        return;
      }
      if (e.key === 'Enter') {
        // Enter trên nút / liên kết là việc của nút / liên kết; ở nền trang thì tiếp tục thẻ mở chương.
        if (onBody && introOpen) {
          e.preventDefault();
          dismissIntro();
        }
        return;
      }
      // Space và PageUp/PageDown chỉ điều hướng khi không có điều khiển nào giữ tiêu điểm.
      if (e.key === ' ' || e.key === 'PageDown' || e.key === 'PageUp') {
        if (!onBody) return;
        const direction = e.key === 'PageUp' || (e.key === ' ' && e.shiftKey) ? -1 : 1;
        e.preventDefault();
        const region = scrollRegionRef.current;
        if (!introOpen && scrollRegionBy(direction, (region?.clientHeight ?? 400) * 0.85)) return;
        stepBeat(direction);
        return;
      }
      // Mũi tên không có nghĩa gì trên nút và liên kết nên vẫn dùng để điều hướng.
      if (!onBody && !onControl && !target?.closest('[data-vh-scrollable]')) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        e.preventDefault();
        if (!introOpen && scrollRegionBy(direction, 64)) return;
        stepBeat(direction);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (introOpen) {
          dismissIntro();
        } else if (isLastBeatInChapter && chapterIndex < TOTAL_CHAPTERS - 1) {
          goTo(chapterIndex + 1, 0, true);
        } else {
          stepBeat(1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (introOpen) {
          dismissIntro();
        } else if (beatIndex === 0 && chapterIndex > 0) {
          goTo(chapterIndex - 1, 0, true);
        } else {
          stepBeat(-1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || isAnyDialogOpen()) return; // Ctrl + cuộn là phóng to trang
    if (Math.abs(e.deltaY) < 20) return;
    const direction = e.deltaY > 0 ? 1 : -1;
    const region = (e.target as HTMLElement).closest<HTMLElement>('[data-vh-scrollable]');
    if (region && !introOpen) {
      const max = region.scrollHeight - region.clientHeight;
      const canScroll = max > 1 && (direction > 0 ? region.scrollTop < max - 1 : region.scrollTop > 0);
      if (canScroll) {
        // Để trình duyệt cuộn chữ; ghi lại để cú cuộn đà (quán tính) cuối vùng không lật khung ngay.
        lastInnerScrollRef.current = Date.now();
        return;
      }
      if (Date.now() - lastInnerScrollRef.current < 350) return;
    }
    const now = Date.now();
    if (now - wheelCooldownRef.current < 580) return;
    wheelCooldownRef.current = now;
    stepBeat(direction);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isAnyDialogOpen()) return;
    const y = e.touches[0]?.clientY;
    if (y === undefined) return;
    const region = (e.target as HTMLElement).closest<HTMLElement>('[data-vh-scrollable]');
    const max = region ? region.scrollHeight - region.clientHeight : 0;
    touchRef.current = {
      y,
      canDown: region !== null && max > 1 && region.scrollTop < max - 1,
      canUp: region !== null && max > 1 && region.scrollTop > 0,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const endY = e.changedTouches[0]?.clientY ?? start.y;
    const diff = start.y - endY;
    if (Math.abs(diff) < 46) return;
    // Vuốt trong vùng chữ còn cuộn được thì chữ cuộn, không đổi khung.
    if (!introOpen && ((diff > 0 && start.canDown) || (diff < 0 && start.canUp))) return;
    stepBeat(diff > 0 ? 1 : -1);
  };

  const groupedDirectory = useMemo(() => {
    const map = new Map<string, Array<{ chapter: VanHoaChapter; index: number }>>();
    VAN_HOA_CHAPTERS.forEach((chapter, index) => {
      const list = map.get(chapter.directoryGroup) ?? [];
      list.push({ chapter, index });
      map.set(chapter.directoryGroup, list);
    });
    return Array.from(map.entries());
  }, []);

  const beatPercent = chapterBeats.length > 1 ? (beatIndex / (chapterBeats.length - 1)) * 100 : 100;
  const introChapter = VAN_HOA_CHAPTERS[introChapterIdx] ?? activeChapter;
  // Mỗi thời điểm chỉ có MỘT h1: thẻ mở chương khi đang mở, vùng chữ khi thẻ đã đóng.
  const stageHeading = introOpen ? 'h2' : 'h1';
  const forwardLabel = !isLastBeatInChapter ? 'Tiếp theo' : !isLastChapter ? 'Phần tiếp theo' : 'Đọc toàn văn';
  const hint =
    isLastBeatInChapter && !isLastChapter
      ? 'Hết phần này. Bấm “Phần tiếp theo” để đi tiếp'
      : isCoarsePointer
        ? 'Vuốt lên để tiếp tục'
        : 'Cuộn chuột hoặc nhấn phím ↓ để tiếp tục';
  const frameLabel = `Khung ${beatIndex + 1} trên ${chapterBeats.length}: ${activeBeat.beatLabel}`;

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="vh-root vh-stage-bg relative w-full h-dvh overflow-hidden"
    >
      {/* Khi thẻ mở chương đang hiện, phần còn lại bị vô hiệu (inert): Tab và trình đọc màn hình không lọt vào nội dung bị che. */}
      <div className="vh-app contents" inert={introOpen} aria-hidden={introOpen ? true : undefined}>
        {/* SÂN KHẤU ẢNH: các lớp chồng nhau, không cắt ảnh */}
        <div className="fixed inset-0 z-0 overflow-hidden bg-[#0A0806]">
          {mediaStack.map((item, idx) => (
            <FullBleedVisualLayer
              key={item.layerKey}
              beat={item.beat}
              isActive={idx === mediaStack.length - 1}
              isInitial={item.isInitial}
            />
          ))}
        </div>

        {/* Đổi khung thì trình đọc màn hình đọc tên khung mới. */}
        <p className="sr-only" aria-live="polite">
          {frameLabel}
        </p>

        {/* THANH TRÊN */}
        <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-4 sm:px-10 pt-3 sm:pt-5 pointer-events-none">
          <Link href="/" className="vh-chrome-link pointer-events-auto vh-font-label text-base uppercase tracking-[0.06em] sm:tracking-[0.16em]">
            Tùng Lâm Hòa Phúc
          </Link>

          <button
            type="button"
            onClick={() => directoryDialogRef.current?.showModal()}
            className="vh-icon-btn vh-glass-btn pointer-events-auto gap-2 px-3"
          >
            <Menu className="h-5 w-5 shrink-0" />
            <span className="max-sm:sr-only text-base">Mục lục</span>
          </button>
        </header>

        {/* CHÚ THÍCH ẢNH: tên hiện vật của khung đang xem (cũng là alt của ảnh) */}
        <p
          className={`vh-caption fixed z-20 pointer-events-none vh-font-text italic text-base leading-snug ${
            isTextOnRightDesktop ? 'vh-caption-left' : 'vh-caption-right'
          }`}
        >
          {displayedBeat.artifactTitle}
        </p>

        {/* LỚP CHỮ */}
        <main
          className={`relative z-10 w-full h-full max-w-7xl mx-auto px-5 sm:px-12 lg:px-16 pt-20 pb-32 flex flex-col ${
            displayedBeat.slideKind === 'hub'
              ? 'justify-center items-center'
              : `justify-end lg:justify-center ${isTextOnRightDesktop ? 'lg:items-end' : 'lg:items-start'}`
          }`}
        >
          {displayedBeat.slideKind === 'hub' ? (
            /* KHUNG CUỐI: 3 THẺ MỞ HỘP (Sách · YouTube · Toàn văn) */
            <section
              ref={scrollRegionRef}
              data-vh-scrollable
              tabIndex={0}
              aria-label="Tư liệu tham khảo"
              data-fade={textFadePhase === 'out-all' ? 'out' : 'in'}
              className="vh-scroll vh-text-region w-full max-w-5xl max-h-[72dvh] overflow-y-auto overflow-x-hidden px-1 py-2"
            >
              <div key={displayedBeat.titleGroupId} className="vh-title-crossfade max-w-2xl mx-auto">
                <BalancedTitleLockup
                  as={stageHeading}
                  top={displayedBeat.headlineTop}
                  sub={displayedBeat.headlineSub}
                  align="center"
                  size="stage"
                />
              </div>

              <div key={displayedBeat.id} className="vh-body-crossfade mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                {/* THẺ 1: SÁCH */}
                <button
                  type="button"
                  onClick={() => bookDialogRef.current?.showModal()}
                  className="vh-card text-left rounded-2xl p-4 sm:p-5 flex md:flex-col items-center md:items-stretch gap-4"
                >
                  <div className="relative w-20 h-28 md:w-full md:h-44 rounded-xl overflow-hidden border border-[#F2C14E]/35 shrink-0 bg-black/50">
                    <img
                      src={vhImage(REFERENCE_BOOK.coverUrl, [360, 640]).src}
                      srcSet={vhImage(REFERENCE_BOOK.coverUrl, [360, 640]).srcSet}
                      sizes="(max-width: 767px) 80px, 300px"
                      width={REFERENCE_BOOK.coverWidth}
                      height={REFERENCE_BOOK.coverHeight}
                      alt={REFERENCE_BOOK.title}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-contain p-1.5"
                    />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span className="vh-eyebrow">Ấn phẩm tham khảo</span>
                    <h2 className="vh-font-text font-semibold text-lg text-[#FFE5A3] mt-1 leading-snug">{REFERENCE_BOOK.title}</h2>
                    <p className="vh-font-text italic text-base text-[#D6C8B2] mt-1">
                      {REFERENCE_BOOK.author} · {REFERENCE_BOOK.publisher}
                    </p>
                    <span className="vh-card-cta mt-auto pt-3 inline-flex items-center gap-2 vh-font-text text-base text-[#F2C14E]">
                      <BookOpen className="h-4 w-4 shrink-0" />
                      <span>Xem chi tiết &amp; trích đoạn</span>
                    </span>
                  </div>
                </button>

                {/* THẺ 2: CLIP YOUTUBE */}
                <button
                  type="button"
                  onClick={openYoutubePopup}
                  className="vh-card text-left rounded-2xl p-4 sm:p-5 flex md:flex-col items-center md:items-stretch gap-4"
                >
                  <div className="relative w-24 h-20 md:w-full md:h-44 rounded-xl overflow-hidden border border-[#F2C14E]/35 shrink-0 bg-black">
                    <img
                      src={vhImage(MUSEUM_YOUTUBE_VIDEO.thumbnailUrl, [360, 640]).src}
                      srcSet={vhImage(MUSEUM_YOUTUBE_VIDEO.thumbnailUrl, [360, 640]).srcSet}
                      sizes="(max-width: 767px) 96px, 320px"
                      width={MUSEUM_YOUTUBE_VIDEO.thumbnailWidth}
                      height={MUSEUM_YOUTUBE_VIDEO.thumbnailHeight}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#F2C14E] text-[#140C07] flex items-center justify-center">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span className="vh-eyebrow">Phim tư liệu YouTube</span>
                    <h2 className="vh-font-text font-semibold text-lg text-[#FFE5A3] mt-1 leading-snug">{MUSEUM_YOUTUBE_VIDEO.title}</h2>
                    <p className="vh-font-text italic text-base text-[#D6C8B2] mt-1">Không gian di sản &amp; Bảo tượng Tùng Lâm Hòa Phúc</p>
                    <span className="vh-card-cta mt-auto pt-3 inline-flex items-center gap-2 vh-font-text text-base text-[#F2C14E]">
                      <Play className="h-4 w-4 shrink-0" />
                      <span>Xem video ngay tại đây</span>
                    </span>
                  </div>
                </button>

                {/* THẺ 3: TOÀN VĂN */}
                <button
                  type="button"
                  onClick={() => readerDialogRef.current?.showModal()}
                  className="vh-card text-left rounded-2xl p-4 sm:p-5 flex md:flex-col items-center md:items-stretch gap-4"
                >
                  <div className="relative w-20 h-24 md:w-full md:h-44 rounded-xl overflow-hidden border border-[#F2C14E]/35 shrink-0 bg-gradient-to-br from-[#24180D] via-[#171009] to-[#0E0906] flex flex-col items-center justify-center p-3 text-center">
                    <FileText className="h-9 w-9 md:h-11 md:w-11 text-[#F2C14E] mb-2" />
                    <span className="hidden md:block vh-font-label text-base uppercase tracking-[0.12em] text-[#FFE5A3]">I · II · III · IV · V · VI</span>
                    <span className="hidden md:block vh-font-text italic text-base text-[#D6C8B2] mt-1">Nguyên văn chuẩn hóa</span>
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span className="vh-eyebrow">Bài viết toàn văn</span>
                    <h2 className="vh-font-text font-semibold text-lg text-[#FFE5A3] mt-1 leading-snug">Văn Hóa Soi Đường, Đạo Sáng Non Sông</h2>
                    <p className="vh-font-text italic text-base text-[#D6C8B2] mt-1">Trọn bộ 6 phần lập luận, thi kệ &amp; tư liệu Bảo tàng</p>
                    <span className="vh-card-cta mt-auto pt-3 inline-flex items-center gap-2 vh-font-text text-base text-[#F2C14E]">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span>Mở bản đọc toàn văn</span>
                    </span>
                  </div>
                </button>
              </div>
            </section>
          ) : (
            <article
              ref={scrollRegionRef}
              data-vh-scrollable
              tabIndex={0}
              aria-label={`${displayedBeat.headlineTop} ${displayedBeat.headlineSub}`}
              data-fade={textFadePhase === 'out-all' ? 'out' : 'in'}
              className={`vh-scroll vh-text-region w-full lg:w-[46%] xl:w-[45%] max-h-[44dvh] lg:max-h-[72dvh] overflow-y-auto overflow-x-hidden pr-6 lg:pr-3 pb-1 ${
                isTextOnRightDesktop ? 'lg:text-right' : 'text-left'
              }`}
            >
              {/* TIÊU ĐỀ + HOA SEN */}
              <div key={displayedBeat.titleGroupId} className="vh-title-crossfade">
                <BalancedTitleLockup
                  as={stageHeading}
                  top={displayedBeat.headlineTop}
                  sub={displayedBeat.headlineSub}
                  align={isTextOnRightDesktop ? 'right' : 'left'}
                  size="stage"
                />
              </div>

              {/* THÂN BÀI / LỜI TRÍCH */}
              <div
                key={displayedBeat.contentGroupId ?? displayedBeat.id}
                data-fade={textFadePhase === 'out-body' ? 'out' : 'in'}
                className="vh-body-crossfade vh-text-region mt-1"
              >
                {displayedBeat.slideKind === 'prose' && displayedBeat.bodyText && (
                  <p className="vh-font-text text-base sm:text-[1.0625rem] leading-[1.8] text-[#E6DCCD] text-left vh-text-shadow">
                    {renderEditorialText(displayedBeat.bodyText)}
                  </p>
                )}

                {displayedBeat.slideKind === 'quote' && displayedBeat.quote && (
                  <div className="pt-0.5">
                    {displayedBeat.quote.type === 'poem' ? (
                      <div className="py-1 text-left">
                        <div
                          className={`py-1 ${
                            isTextOnRightDesktop
                              ? 'border-l-2 border-[#F2C14E]/70 pl-4 sm:pl-5 lg:border-l-0 lg:border-r-2 lg:pl-0 lg:pr-5 lg:text-right'
                              : 'border-l-2 border-[#F2C14E]/70 pl-4 sm:pl-5'
                          }`}
                        >
                          {displayedBeat.quote.lines.map((line, lIdx) => (
                            <p key={lIdx} className="vh-font-text italic text-base sm:text-[1.0625rem] leading-[1.9] text-[#FFE8AE] vh-text-shadow">
                              {line}
                            </p>
                          ))}
                        </div>
                        <p className={`mt-2.5 vh-font-text italic text-base text-[#EAC980] ${isTextOnRightDesktop ? 'text-left lg:text-right' : 'text-left'}`}>
                          — {displayedBeat.quote.citation}
                        </p>
                      </div>
                    ) : (
                      <div
                        className={
                          isTextOnRightDesktop
                            ? 'pl-4 sm:pl-5 border-l-2 border-[#F2C14E]/70 text-left lg:pl-0 lg:pr-5 lg:border-l-0 lg:border-r-2 lg:text-right'
                            : 'pl-4 sm:pl-5 border-l-2 border-[#F2C14E]/70 text-left'
                        }
                      >
                        {displayedBeat.quote.lines.map((line, lIdx) => (
                          <p key={lIdx} className="vh-font-text italic text-base sm:text-[1.0625rem] leading-[1.8] text-[#F8EDD4] text-left vh-text-shadow">
                            {line}
                          </p>
                        ))}
                        <p className={`mt-2.5 vh-font-text italic text-base text-[#EAC980] ${isTextOnRightDesktop ? 'text-left lg:text-right' : 'text-left'}`}>
                          — {displayedBeat.quote.citation}
                        </p>
                      </div>
                    )}

                    {displayedBeat.externalLink && (
                      <div className={`mt-4 ${isTextOnRightDesktop ? 'text-left lg:text-right' : 'text-left'}`}>
                        <a
                          href={displayedBeat.externalLink.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="vh-link inline-flex items-center gap-2 vh-font-text italic text-base text-[#F2C14E] underline underline-offset-4"
                        >
                          <span>{displayedBeat.externalLink.label}</span>
                          <ExternalLink className="h-4 w-4 shrink-0" />
                          <NewTabHint />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          )}
        </main>

        {/* TIẾN TRÌNH: mỗi khung của phần đang xem là một nút (mục tiêu bấm 24 px trở lên) */}
        <nav aria-label="Tiến trình" className="fixed right-1 sm:right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col">
          {chapterBeats.map((b, idx) => (
            <button
              key={b.id}
              type="button"
              onClick={() => goTo(chapterIndex, idx, false)}
              aria-label={`Khung ${idx + 1}: ${b.beatLabel}`}
              aria-current={idx === beatIndex ? 'step' : undefined}
              className="vh-dot-btn"
            >
              <span className="vh-dot-track">
                <span className="vh-dot-fill" data-reached={idx <= beatIndex ? 'true' : 'false'} />
              </span>
            </button>
          ))}
        </nav>

        {/* THANH ĐIỀU HƯỚNG DƯỚI: gợi ý đúng thiết bị; Trước đó / Tiếp theo luôn nhìn thấy */}
        <div className="vh-dock fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-1.5rem)] max-w-[640px] flex flex-col items-center">
          <p className="vh-hint vh-font-text text-base text-center text-[#FFE5A3] mb-2">{hint}</p>

          <div className="vh-nav-pill w-full rounded-[22px] px-3 py-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => stepBeat(-1)}
              disabled={chapterIndex === 0 && beatIndex === 0}
              className="vh-icon-btn vh-glass-btn gap-2 px-3"
            >
              <ArrowLeft className="h-5 w-5 shrink-0" />
              <span className="max-sm:sr-only text-base">Trước đó</span>
            </button>

            <div className="flex-1 min-w-0 flex items-center gap-3" aria-hidden="true">
              <div className="vh-track flex-1" style={{ '--vh-p': beatPercent } as React.CSSProperties}>
                <div className="vh-track-fill" />
                {chapterBeats.map((b, idx) => {
                  const pct = chapterBeats.length > 1 ? (idx / (chapterBeats.length - 1)) * 100 : 100;
                  return <span key={b.id} className="vh-track-tick" style={{ left: `${pct}%` }} />;
                })}
                <span className="vh-nav-orb" />
              </div>
              <span className="vh-font-text text-base text-[#FFE5A3] shrink-0 tabular-nums">
                {beatIndex + 1} / {chapterBeats.length}
              </span>
            </div>

            <button
              ref={forwardButtonRef}
              type="button"
              onClick={goForward}
              data-emphasis={pulseNextChapter || isLastBeatInChapter ? 'true' : 'false'}
              className="vh-icon-btn vh-primary-btn gap-2 px-3"
            >
              <span className="max-sm:sr-only text-base">{forwardLabel}</span>
              {isLastBeatInChapter && isLastChapter ? <BookOpen className="h-5 w-5 shrink-0" /> : <ArrowRight className="h-5 w-5 shrink-0" />}
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          THẺ MỞ CHƯƠNG: người xem chủ động bấm "Tiếp tục" (hoặc Enter, Space, Esc, cuộn) để vào.
          Không hẹn giờ tự đóng. Đây không phải hộp thoại bật lên mà là một lớp nội dung trọn màn
          hình; phần còn lại của trang bị inert nên không có gì lọt tiêu điểm.
          ===================================================================== */}
      {introPhase !== 'closed' && (
        <section
          key={`intro-${introChapterIdx}`}
          data-phase={introPhase}
          data-animate={introAnimate ? 'true' : undefined}
          aria-label={`Mở đầu phần ${introChapterIdx + 1} trên ${TOTAL_CHAPTERS}: ${introChapter.chapterTitle}`}
          onClick={dismissIntro}
          className="vh-intro fixed inset-0 z-40 flex flex-col items-center justify-center px-6 sm:px-12 text-center"
        >
          <IntroBackdropExactFit chapter={introChapter} isFirst={introChapterIdx === 0} />

          <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center">
            <BalancedTitleLockup
              as={introOpen ? 'h1' : 'h2'}
              top={introChapter.introTitleTop}
              sub={introChapter.introTitleSub}
              align="center"
              size="intro"
              staggerReveal
            />
            <p className="vh-font-label text-base uppercase tracking-[0.14em] text-[#E8CF92]">
              Phần {introChapterIdx + 1} / {TOTAL_CHAPTERS}
            </p>
            <button
              ref={introButtonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissIntro();
              }}
              className="vh-primary-btn vh-intro-btn mt-6 inline-flex items-center justify-center gap-2 rounded-full px-7 text-base font-semibold"
            >
              <span>Tiếp tục</span>
              <ArrowRight className="h-5 w-5 shrink-0" />
            </button>
          </div>
        </section>
      )}

      {/* =====================================================================
          <dialog> 1: MỤC LỤC
          ===================================================================== */}
      <dialog
        ref={directoryDialogRef}
        aria-labelledby="vh-directory-title"
        {...({ closedby: 'any' } as Record<string, string>)}
        className="vh-modal-dialog w-full"
      >
        <div className="rounded-2xl bg-[#140E0A] text-[#E8DFD3] border border-[#F2C14E]/30 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#F2C14E]/20">
            <div>
              <p className="vh-eyebrow">Mục lục triển lãm</p>
              <h2 id="vh-directory-title" className="vh-font-display text-3xl text-[#FFE5A3] mt-0.5">
                Văn Hóa Soi Đường — Đạo Sáng Non Sông
              </h2>
            </div>
            <form method="dialog">
              <button type="submit" aria-label="Đóng mục lục" className="vh-icon-btn vh-glass-btn px-0">
                <X className="h-5 w-5" />
              </button>
            </form>
          </div>

          <div
            className="vh-scroll grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5 sm:p-6 max-h-[68dvh] overflow-y-auto"
            tabIndex={0}
            aria-label="Danh sách các phần của triển lãm"
          >
            {groupedDirectory.map(([groupTitle, items]) => (
              <div key={groupTitle} className="rounded-xl bg-white/[0.04] border border-white/15 p-4">
                <h3 className="vh-font-label text-base uppercase tracking-wide text-[#F2C14E] mb-3">{groupTitle}</h3>
                <ul className="space-y-1.5">
                  {items.map(({ chapter, index }) => {
                    const isCurrent = index === chapterIndex;
                    return (
                      <li key={chapter.id}>
                        <button
                          type="button"
                          aria-current={isCurrent ? 'true' : undefined}
                          onClick={() => {
                            directoryDialogRef.current?.close();
                            goTo(index, 0, true);
                          }}
                          className={`vh-list-btn w-full text-left rounded-lg px-3 py-2.5 vh-font-text ${
                            isCurrent ? 'bg-[#F2C14E]/20 border border-[#F2C14E]/50 text-[#FFE5A3]' : 'text-[#D9CCB6] border border-transparent'
                          }`}
                        >
                          <span className="block text-base leading-snug">{chapter.chapterTitle}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="px-5 sm:px-6 py-4 bg-black/40 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 vh-font-text text-base text-[#D6C8B2]">
            <span className="italic">Tư liệu: Sa Môn Vô Trí · Đi qua khổ vui cuộc đời (Quyển 01)</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => {
                  directoryDialogRef.current?.close();
                  readerDialogRef.current?.showModal();
                }}
                className="vh-link text-[#F2C14E] underline underline-offset-4 min-h-6"
              >
                Đọc toàn văn bài viết
              </button>
              <Link href="/vu-tru-phat-giao/tang-kinh-cac" className="vh-link text-[#F2C14E] underline underline-offset-4 min-h-6">
                Tàng Kinh Các →
              </Link>
            </div>
          </div>
        </div>
      </dialog>

      {/* =====================================================================
          <dialog> 2: BẢN ĐỌC TOÀN VĂN
          ===================================================================== */}
      <dialog
        ref={readerDialogRef}
        aria-labelledby="vh-reader-title"
        {...({ closedby: 'any' } as Record<string, string>)}
        className="vh-modal-dialog w-full"
      >
        <div className="rounded-2xl bg-[#140E0A] text-[#E8DFD3] border border-[#D4AF37]/40 shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]">
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-8 py-4 border-b border-[#D4AF37]/25 bg-[#1B130D]">
            <div>
              <p className="vh-eyebrow">Toàn văn bài viết · Ngày Văn hóa Việt Nam 24/11</p>
              <h2 id="vh-reader-title" className="vh-font-display text-3xl text-[#FFE5A3]">
                Văn Hóa Soi Đường — Đạo Sáng Non Sông
              </h2>
            </div>
            <form method="dialog">
              <button type="submit" aria-label="Đóng bản đọc toàn văn" className="vh-icon-btn vh-glass-btn px-0">
                <X className="h-5 w-5" />
              </button>
            </form>
          </div>

          <article tabIndex={0} aria-label="Nội dung toàn văn, cuộn để đọc" className="vh-scroll overflow-y-auto px-5 sm:px-10 py-8 space-y-8 vh-font-text">
            {FULL_ESSAY_SECTIONS.map((sec, secIdx) => (
              <React.Fragment key={sec.heading}>
                {/* Banner phim tư liệu ngay trước phần kết (VI.) */}
                {secIdx === FULL_ESSAY_SECTIONS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      readerDialogRef.current?.close();
                      openYoutubePopup();
                    }}
                    className="vh-card w-full text-left flex flex-col sm:flex-row items-center gap-5 rounded-2xl p-4 sm:p-5"
                  >
                    <div className="relative w-full sm:w-52 aspect-video rounded-xl overflow-hidden border border-[#F2C14E]/35 shrink-0">
                      <img
                        src={vhImage(MUSEUM_YOUTUBE_VIDEO.thumbnailUrl, [360, 640]).src}
                        srcSet={vhImage(MUSEUM_YOUTUBE_VIDEO.thumbnailUrl, [360, 640]).srcSet}
                        sizes="(max-width: 639px) 100vw, 208px"
                        width={MUSEUM_YOUTUBE_VIDEO.thumbnailWidth}
                        height={MUSEUM_YOUTUBE_VIDEO.thumbnailHeight}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="w-12 h-12 rounded-full bg-[#F2C14E] text-[#140C07] flex items-center justify-center">
                          <Play className="h-5 w-5 fill-current ml-0.5" />
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                      <p className="vh-eyebrow">{MUSEUM_YOUTUBE_VIDEO.badge}</p>
                      <p className="vh-font-label uppercase text-lg sm:text-xl text-[#FFE5A3] mt-1 leading-snug">{MUSEUM_YOUTUBE_VIDEO.title}</p>
                      <p className="vh-font-text italic text-base text-[#EAC980] mt-2 inline-flex items-center gap-2">
                        <span>{MUSEUM_YOUTUBE_VIDEO.subtitle}</span>
                        <Play className="h-4 w-4 shrink-0" />
                      </p>
                    </div>
                  </button>
                )}

                <section className="space-y-4">
                  <h3 className="vh-font-label uppercase tracking-[0.04em] text-lg sm:text-xl text-[#FFDE59] border-b border-[#F2C14E]/25 pb-2">
                    {sec.heading}
                  </h3>
                  {sec.blocks.map((block, bIdx) => {
                    if (block.kind === 'poem') {
                      return (
                        <div key={bIdx} className="my-5 py-4 px-4 text-center mx-auto max-w-2xl">
                          <div className="border-l-2 border-[#F2C14E]/60 px-5 py-1 inline-block text-left">
                            {block.lines.map((line, lIdx) => (
                              <p key={lIdx} className="italic text-base sm:text-lg leading-loose text-[#FFE5A3]">
                                {line}
                              </p>
                            ))}
                          </div>
                          <p className="mt-2 text-base text-[#E0C27E] italic">— {block.citation}</p>
                        </div>
                      );
                    }
                    if (block.kind === 'quote-prose') {
                      return (
                        <blockquote key={bIdx} className="my-5 pl-5 border-l-2 border-[#F2C14E]/60">
                          <p className="text-base sm:text-[1.0625rem] leading-[1.9] text-[#EFE2C6] italic text-left">{block.text}</p>
                          <footer className="mt-2 text-base text-[#E0C27E] italic text-right">— {block.citation}</footer>
                        </blockquote>
                      );
                    }
                    return (
                      <p
                        key={bIdx}
                        className={`text-base sm:text-[1.0625rem] leading-[1.9] text-[#E0D5C1] text-left ${
                          block.isFirstOfSection ? 'vh-drop-cap' : 'indent-6 md:indent-8'
                        }`}
                      >
                        {renderEditorialText(block.text)}
                      </p>
                    );
                  })}
                </section>
              </React.Fragment>
            ))}
          </article>
        </div>
      </dialog>

      {/* =====================================================================
          <dialog> 3: VIDEO YOUTUBE (chỉ gắn iframe khi mở)
          ===================================================================== */}
      <dialog
        ref={youtubeDialogRef}
        onClose={() => setIsYoutubeModalOpen(false)}
        aria-labelledby="vh-youtube-title"
        {...({ closedby: 'any' } as Record<string, string>)}
        className="vh-modal-dialog w-full"
      >
        <div className="rounded-2xl bg-[#140E0A] text-[#E8DFD3] border border-[#D4AF37]/45 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#D4AF37]/25 bg-[#1B130D]">
            <div className="min-w-0">
              <p className="vh-eyebrow">{MUSEUM_YOUTUBE_VIDEO.badge}</p>
              <h2 id="vh-youtube-title" className="vh-font-display text-2xl sm:text-3xl text-[#FFE5A3]">
                {MUSEUM_YOUTUBE_VIDEO.title}
              </h2>
            </div>
            <form method="dialog">
              <button type="submit" aria-label="Đóng video" className="vh-icon-btn vh-glass-btn px-0 shrink-0">
                <X className="h-5 w-5" />
              </button>
            </form>
          </div>

          <div className="relative w-full aspect-video bg-black">
            {isYoutubeModalOpen && (
              <iframe
                title={MUSEUM_YOUTUBE_VIDEO.title}
                src={`https://www.youtube-nocookie.com/embed/${MUSEUM_YOUTUBE_VIDEO.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                loading="lazy"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-0"
              />
            )}
          </div>

          <div className="px-5 sm:px-6 py-3.5 bg-black/45 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 vh-font-text text-base text-[#D6C8B2]">
            <span className="italic">Bảo tàng Văn hóa Phật giáo Tùng Lâm Hòa Phúc</span>
            <a
              href={MUSEUM_YOUTUBE_VIDEO.href}
              target="_blank"
              rel="noopener noreferrer"
              className="vh-link inline-flex items-center gap-2 text-[#F2C14E] underline underline-offset-4 min-h-6"
            >
              <span>Mở trên YouTube</span>
              <ExternalLink className="h-4 w-4" />
              <NewTabHint />
            </a>
          </div>
        </div>
      </dialog>

      {/* =====================================================================
          <dialog> 4: SÁCH THAM KHẢO
          ===================================================================== */}
      <dialog
        ref={bookDialogRef}
        aria-labelledby="vh-book-title"
        {...({ closedby: 'any' } as Record<string, string>)}
        className="vh-modal-dialog w-full"
      >
        <div className="rounded-2xl bg-[#140E0A] text-[#E8DFD3] border border-[#D4AF37]/45 shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]">
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#D4AF37]/25 bg-[#1B130D]">
            <div>
              <p className="vh-eyebrow">Tủ sách Tàng Kinh Các · Nguồn tham khảo chính</p>
              <h2 id="vh-book-title" className="vh-font-display text-2xl sm:text-3xl text-[#FFE5A3]">
                {REFERENCE_BOOK.title}
              </h2>
            </div>
            <form method="dialog">
              <button type="submit" aria-label="Đóng thông tin sách" className="vh-icon-btn vh-glass-btn px-0 shrink-0">
                <X className="h-5 w-5" />
              </button>
            </form>
          </div>

          <div tabIndex={0} aria-label="Thông tin sách, cuộn để đọc" className="vh-scroll overflow-y-auto p-5 sm:p-8 flex flex-col sm:flex-row gap-6 sm:gap-8 vh-font-text">
            <div className="relative w-44 h-64 mx-auto sm:mx-0 rounded-xl overflow-hidden border border-[#F2C14E]/45 shadow-[0_14px_34px_rgba(0,0,0,0.65)] shrink-0 bg-black/50">
              <img
                src={vhImage(REFERENCE_BOOK.coverUrl, [360, 640]).src}
                srcSet={vhImage(REFERENCE_BOOK.coverUrl, [360, 640]).srcSet}
                sizes="176px"
                width={REFERENCE_BOOK.coverWidth}
                height={REFERENCE_BOOK.coverHeight}
                alt={REFERENCE_BOOK.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h3 className="vh-font-label uppercase text-lg text-[#FFE5A3]">{REFERENCE_BOOK.title}</h3>
                <p className="italic text-base text-[#E0C27E] mt-1">
                  Tác giả: {REFERENCE_BOOK.author} · {REFERENCE_BOOK.publisher}
                </p>
                <p className="text-base text-[#D6C8B2] mt-1">Các trang trích dẫn trong triển lãm: {REFERENCE_BOOK.pagesCited}</p>
              </div>

              <div className="space-y-3 pt-1">
                <blockquote className="pl-4 border-l-2 border-[#F2C14E]/60 italic text-base leading-relaxed text-[#F2E5C9]">
                  “Cây có cội, sông có nguồn, con người lấy văn hóa truyền thống làm nền tảng. Nền tảng càng vững càng dễ dàng hội nhập trong bối cảnh toàn cầu hóa.” <span className="text-[#E0C27E]">(tr. 153)</span>
                </blockquote>
                <blockquote className="pl-4 border-l-2 border-[#F2C14E]/60 italic text-base leading-relaxed text-[#F2E5C9]">
                  “Văn là cái đẹp, cái tốt, cái thiện. Hóa là chuyển hóa, lan tỏa. Người biết tiếp thu, lắng nghe chuyển hóa bản thân và lan tỏa điều thiện đến người xung quanh gọi là người văn hóa.” <span className="text-[#E0C27E]">(tr. 194)</span>
                </blockquote>
                <blockquote className="pl-4 border-l-2 border-[#F2C14E]/60 italic text-base leading-relaxed text-[#F2E5C9]">
                  “Đạo nào vượt lên giới hạn của tín ngưỡng, thoát khỏi mặc định của tôn giáo, Đạo đó chính là chỗ con người cần hướng đến.” <span className="text-[#E0C27E]">(tr. 195)</span>
                </blockquote>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link href={REFERENCE_BOOK.libraryHref} className="vh-primary-btn vh-intro-btn inline-flex items-center gap-2 rounded-full px-5 text-base font-semibold">
                  <BookOpen className="h-5 w-5 shrink-0" />
                  <span>Đọc Ebook / PDF tại Tàng Kinh Các</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
