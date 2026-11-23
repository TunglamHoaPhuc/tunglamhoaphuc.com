'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FileText,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sparkles,
  ArrowLeft,
  Share2,
  Quote,
  Check,
  Feather,
  Flower2,
} from 'lucide-react';

interface BookSection {
  type: 'poem' | 'essay' | 'dedication' | 'publishing';
  title: string;
  pageNumber?: number;
  author?: string;
  content: string;
}

interface BookChapter {
  chapterNumber: number;
  title: string;
  pageRange?: string;
  quoteHeader?: string;
  quoteAuthor?: string;
  introSummary?: string;
  sections: BookSection[];
}

/** Chương như nằm trong JSON: cuốn đầu có `sections`, bốn quyển còn lại chỉ có `content` (một khối chữ). */
interface RawChapter extends Omit<BookChapter, 'sections'> {
  sections?: BookSection[];
  content?: string;
}

interface ReaderVolume {
  volumeNumber?: number;
  volumeTitle?: string;
  title?: string;
  pageCount?: number;
  chapters: RawChapter[];
}

interface BookData {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  author: string;
  category?: string;
  coverImage?: string;
  description?: string;
  publisher?: string;
  isbn?: string;
  totalPages?: number;
  volume1?: ReaderVolume;
  volumes?: ReaderVolume[];
}

/** Các quyển của sách: cuốn đầu giữ dạng `volume1`, các sách khác là `volumes[]`. */
export function bookVolumes(book: BookData): ReaderVolume[] {
  if (book.volume1) return [book.volume1];
  return Array.isArray(book.volumes) ? book.volumes : [];
}

/** Bài thơ: nhiều dòng ngắn, không câu dài (diễn ca, kệ). */
function looksLikePoem(text: string): boolean {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length >= 4 && Math.max(...lines.map((l) => l.length)) <= 70;
}

/** Chương nào cũng có `sections`: chương chỉ có `content` thành một đoạn (thơ hay văn xuôi); chương đã có `sections` giữ nguyên. */
export function readerChapters(volume?: ReaderVolume): BookChapter[] {
  return (volume?.chapters ?? []).map((chapter) => {
    if (Array.isArray(chapter.sections) && chapter.sections.length > 0) return chapter as BookChapter;
    const content = typeof chapter.content === 'string' ? chapter.content : '';
    return { ...chapter, sections: [{ type: looksLikePoem(content) ? 'poem' : 'essay', title: '', content }] } as BookChapter;
  });
}

/** Cắt một khối chữ dài thành các trang lật vừa khung, ở ranh giới đoạn (hoặc khoảng trắng nếu một đoạn quá dài). */
function chunkText(text: string, max = 1500): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let current = '';
  const push = () => {
    if (current.trim()) out.push(current.trim());
    current = '';
  };
  for (const paragraph of text.split('\n\n')) {
    let rest = paragraph;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(' ', max);
      if (cut < max / 2) cut = max;
      if (current) push();
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut);
    }
    if (current && current.length + rest.length + 2 > max) push();
    current += (current ? '\n\n' : '') + rest;
  }
  push();
  return out;
}

interface BookDualReaderProps {
  book: BookData;
}

export function BookDualReader({ book }: BookDualReaderProps) {
  // Reading Mode: 'text' (Văn Bản & Mục Lục Tự Động) | 'flip' (Lật Sách 3D)
  const [readingMode, setReadingMode] = useState<'text' | 'flip'>('text');

  // Quyển và chương: cuốn đầu một quyển (`volume1`, bố cục riêng), các sách khác theo `volumes[]`.
  const volumes = React.useMemo(() => bookVolumes(book), [book]);
  const [volumeIdx, setVolumeIdx] = useState<number>(0);
  const volume = volumes[volumeIdx] ?? volumes[0];
  const chapters: BookChapter[] = React.useMemo(() => readerChapters(volume), [volume]);
  const legacy = Boolean(book.volume1);
  const multiVolume = volumes.length > 1;
  const showVolumeNo = legacy || multiVolume;
  const volumeNo = volume?.volumeNumber ?? volumeIdx + 1;
  const bookLabel = legacy ? 'Đi qua khổ vui cuộc đời' : book.title;

  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(0);
  const [fontSize, setFontSize] = useState<number>(17); // 15 to 22px
  const [currentFlipPage, setCurrentFlipPage] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentChapter = chapters[selectedChapterIdx] || chapters[0];

  // Flatten all sections into 217 virtual pages for 3D FlipBook
  const flipPages = React.useMemo(() => {
    const pages: Array<{
      pageNumber: number;
      headerLeft: string;
      headerRight: string;
      title?: string;
      author?: string;
      type?: string;
      content: string;
      isPoem?: boolean;
    }> = [];

    if (legacy) {
    // Page 1: Trang Lót
    pages.push({
      pageNumber: 1,
      headerLeft: 'Đi qua khổ vui cuộc đời',
      headerRight: 'Cuốn sách này dành tặng',
      title: 'DÀNH TẶNG',
      content: 'Cuốn sách này dành tặng:\n\n....................................................................................\n\n....................................................................................\n\n....................................................................................',
    });

    // Page 2: Mục Lục
    pages.push({
      pageNumber: 2,
      headerLeft: 'Thích Tâm Hòa',
      headerRight: 'Mục Lục',
      title: 'MỤC LỤC QUYỂN 1',
      content: 'Đi cùng tôi (Trang 03)\nLời giới thiệu (Trang 09)\nChương 1: Yêu thương bắt đầu (Trang 11)\nChương 2: Có mặt cho nhau (Trang 49)\nChương 3: Không còn sợ hãi (Trang 95)\nChương 4: Ruộng tốt cho người (Trang 150)\nĐã về đã tới (Trang 200)\nLịch sử Tùng Lâm Hòa Phúc (Trang 206)\nMấy lời tâm huyết (Trang 214)',
    });
    }

    // Generate remaining content pages from chapters
    chapters.forEach((chap) => {
      if (chap.quoteHeader) {
        pages.push({
          pageNumber: pages.length + 1,
          headerLeft: pages.length % 2 === 0 ? 'Thích Tâm Hòa' : bookLabel,
          headerRight: chap.title,
          title: chap.title,
          content: `CÂU QUAN TRỌNG ĐẦU CHƯƠNG:\n\n"${chap.quoteHeader}"\n\n— ${chap.quoteAuthor || 'Sa Môn Vô Trí (Thích Tâm Hòa)'}${chap.introSummary ? `\n\n${chap.introSummary}` : ''}`,
        });
      }

      chap.sections.forEach((sec) => {
        const isPoem = sec.type === 'poem';
        const title = sec.title || chap.title;
        // Cuốn đầu đã chia trang sẵn; các sách khác một chương là một khối dài nên cắt thành nhiều trang lật.
        const parts = legacy ? [sec.content] : chunkText(sec.content);
        parts.forEach((part, partIdx) => {
          pages.push({
            pageNumber: pages.length + 1,
            headerLeft: pages.length % 2 === 0 ? 'Thích Tâm Hòa' : bookLabel,
            headerRight: title,
            title: partIdx === 0 ? title : undefined,
            author: partIdx === parts.length - 1 ? sec.author : undefined,
            type: sec.type,
            isPoem: isPoem,
            content: part,
          });
        });
      });
    });

    return pages;
  }, [chapters, legacy, bookLabel]);

  const totalFlipPages = flipPages.length;

  const handleNextPage = () => {
    if (currentFlipPage < totalFlipPages - 2) {
      setCurrentFlipPage((prev) => prev + 2);
    } else if (currentFlipPage < totalFlipPages - 1) {
      setCurrentFlipPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentFlipPage > 1) {
      setCurrentFlipPage((prev) => prev - 2);
    } else if (currentFlipPage > 0) {
      setCurrentFlipPage(0);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readingMode === 'flip') {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') handleNextPage();
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') handlePrevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingMode, currentFlipPage, totalFlipPages]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div
      style={{ fontFamily: "'UTM Avo', sans-serif" }}
      className="min-h-screen bg-[#1F140D] text-[#e3d2c1] selection:bg-[#F2C14E] selection:text-black flex flex-col pt-24 md:pt-28"
    >
      {/* ── TOP CONTROL BAR ── */}
      <header className="relative z-40 bg-[#25170E]/95 border-b border-[#F2C14E]/30 backdrop-blur-md px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Back & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/tri-tue-phat-phap"
              className="p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 justify-center rounded-xl bg-[#3A2718] hover:bg-[#4A3220] border border-[#F2C14E]/40 text-[#FFE5A3] transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-[#F2C14E]" />
              <span className="hidden sm:inline">Trí Tuệ Phật Pháp</span>
            </Link>

            <div className="min-w-0">
              <h1
                style={{ fontFamily: "'UTM Niagara', serif" }}
                className="text-2xl sm:text-3xl text-[#ffde59] uppercase tracking-wide sm:truncate font-normal leading-tight sm:leading-none drop-shadow"
              >
                {book.title}{showVolumeNo ? ` (Quyển ${volumeNo})` : ''}
              </h1>
              <p className="text-xs text-[#c9b896]/80 truncate">
                Tác giả: <span className="text-[#F2C14E] font-semibold">{book.author}</span>{legacy ? ' • NXB Hồng Đức' : ''}
              </p>
            </div>
          </div>

          {/* DUAL MODE SWITCHER (NÚT CHUYỂN ĐỔI 2 CHẾ ĐỘ ĐỌC) */}
          <div className="flex w-full sm:w-auto items-center gap-1 p-1 bg-[#1A0F08] rounded-2xl border border-[#F2C14E]/40 shadow-inner">
            <button
              type="button"
              onClick={() => setReadingMode('text')}
              className={`flex-1 sm:flex-none justify-center min-h-11 sm:min-h-0 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                readingMode === 'text'
                  ? 'bg-gradient-to-r from-[#F2C14E] to-[#e5b338] text-[#140D07] shadow-md scale-102'
                  : 'text-[#c9b896] hover:text-[#FFE5A3]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Đọc Văn Bản</span>
            </button>

            <button
              type="button"
              onClick={() => setReadingMode('flip')}
              className={`flex-1 sm:flex-none justify-center min-h-11 sm:min-h-0 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                readingMode === 'flip'
                  ? 'bg-gradient-to-r from-[#F2C14E] to-[#e5b338] text-[#140D07] shadow-md scale-102'
                  : 'text-[#c9b896] hover:text-[#FFE5A3]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lật Sách 3D</span>
            </button>
          </div>

          {/* Quick Reader Tools */}
          <div className="flex items-center gap-2 ml-auto">
            {readingMode === 'text' && (
              <div className="flex items-center gap-1 bg-[#3A2718] p-1 rounded-xl border border-[#F2C14E]/30 text-xs">
                <button
                  type="button"
                  onClick={() => setFontSize((f) => Math.max(15, f - 1))}
                  className="px-3 sm:px-2 min-h-11 sm:min-h-0 py-1 hover:bg-[#4A3220] rounded text-[#FFE5A3] font-bold cursor-pointer"
                  title="Giảm cỡ chữ"
                >
                  A-
                </button>
                <span className="text-xs font-mono text-[#F2C14E] px-1">{fontSize}px</span>
                <button
                  type="button"
                  onClick={() => setFontSize((f) => Math.min(22, f + 1))}
                  className="px-3 sm:px-2 min-h-11 sm:min-h-0 py-1 hover:bg-[#4A3220] rounded text-[#FFE5A3] font-bold cursor-pointer"
                  title="Tăng cỡ chữ"
                >
                  A+
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-xl bg-[#3A2718] hover:bg-[#4A3220] border border-[#F2C14E]/30 text-[#FFE5A3] transition-all cursor-pointer shadow-sm"
              title="Chia sẻ sách này"
            >
              {copiedLink ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-xl bg-[#3A2718] hover:bg-[#4A3220] border border-[#F2C14E]/30 text-[#FFE5A3] transition-all cursor-pointer shadow-sm"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {multiVolume && (
            <div role="group" aria-label="Chọn quyển" className="w-full flex flex-wrap items-center gap-2">
              {volumes.map((vol, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-pressed={idx === volumeIdx}
                  onClick={() => {
                    setVolumeIdx(idx);
                    setSelectedChapterIdx(0);
                    setCurrentFlipPage(0);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`min-h-11 sm:min-h-0 px-4 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${
                    idx === volumeIdx
                      ? 'bg-[#F2C14E] border-[#F2C14E] text-[#140D07]'
                      : 'bg-[#3A2718] border-[#F2C14E]/40 text-[#FFE5A3] hover:bg-[#4A3220]'
                  }`}
                >
                  Quyển {vol.volumeNumber ?? idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 🌟 CHẾ ĐỘ 1: ĐỌC VĂN BẢN & MỤC LỤC TỰ ĐỘNG (TEXT READER MODE) */}
      {/* ========================================================================= */}
      {readingMode === 'text' && (
        <div className="max-w-7xl mx-auto w-full px-4 py-5 sm:py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* LEFT SIDEBAR: MỤC LỤC TỰ ĐỘNG (TABLE OF CONTENTS) */}
          <aside className="lg:col-span-4 space-y-4 order-2 lg:order-none">
            <div className="bg-[#271910] border border-[#F2C14E]/35 rounded-3xl p-4 sm:p-5 shadow-xl lg:sticky lg:top-24 lg:max-h-[calc(100vh-120px)] flex flex-col">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#F2C14E]/20 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-[#3A2718] border border-[#F2C14E]/50 flex items-center justify-center text-[#F2C14E]">
                  <Bookmark className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-xs font-bold text-[#F2C14E] uppercase tracking-widest">
                    MỤC LỤC{showVolumeNo ? ` QUYỂN ${volumeNo}` : ''}
                  </h2>
                  <p className="text-xs text-[#c9b896]/70">
                    {chapters.length} Chương mục{volume?.pageCount ? ` • ${volume.pageCount} Trang bản in` : ''}
                  </p>
                </div>
              </div>

              {/* Chapters list */}
              <div className="flex-1 lg:overflow-y-auto py-3 space-y-2 lg:pr-1">
                {chapters.map((chap, cIdx) => (
                  <button
                    key={cIdx}
                    type="button"
                    onClick={() => {
                      setSelectedChapterIdx(cIdx);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-full text-left p-3.5 min-h-11 rounded-2xl transition-all flex items-start gap-3 cursor-pointer ${
                      selectedChapterIdx === cIdx
                        ? 'bg-[#3A2718] border-2 border-[#F2C14E] text-[#ffde59] shadow-lg scale-[1.01]'
                        : 'hover:bg-[#332014] text-[#c9b896] border border-transparent'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        selectedChapterIdx === cIdx
                          ? 'bg-[#F2C14E] text-[#140D07]'
                          : 'bg-[#1F140D] text-[#c9b896]'
                      }`}
                    >
                      {cIdx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm sm:text-xs font-bold leading-snug">
                        {chap.title}
                      </div>
                      {chap.pageRange && (
                        <div className="text-xs text-[#FFE5A3]/60 italic mt-0.5 font-mono">
                          {chap.pageRange}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* MAIN READING CONTAINER (VĂN BẢN TRANG SÁCH) */}
          <main className="lg:col-span-8 order-1 lg:order-none min-w-0">
            <article className="rounded-3xl p-5 sm:p-10 shadow-2xl border bg-[#F9F5EC] text-[#2C1C11] border-[#E8DCB8]">
              {/* Chapter Header */}
              <div className="border-b border-[#D8C7A0] pb-6 mb-8 text-center space-y-2">
                <span className="px-3.5 py-1 rounded-full bg-[#EFE8D6] text-[#8B4513] text-xs font-bold uppercase tracking-widest border border-[#D8C7A0] inline-block font-sans">
                  {showVolumeNo ? `QUYỂN ${volumeNo} • ` : ''}{currentChapter.pageRange || 'BẢN IN'}
                </span>

                <h2
                  style={{ fontFamily: "'UTM Niagara', serif" }}
                  className="text-3xl sm:text-5xl text-[#8B4513] uppercase tracking-wide font-normal leading-tight drop-shadow-sm pt-1 break-words"
                >
                  {currentChapter.title}
                </h2>

                <div className="w-24 h-[1.5px] bg-gradient-to-r from-transparent via-[#F2C14E] to-transparent mx-auto pt-2" />
              </div>

              {/* 🌟 CÂU QUAN TRỌNG ĐẦU CHƯƠNG (NẾU CÓ) */}
              {currentChapter.quoteHeader && (
                <div className="my-6 p-5 sm:p-6 rounded-2xl bg-[#F2EADB] border-l-4 border-[#F2C14E] shadow-sm text-left space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#8B4513] uppercase tracking-wider font-sans">
                    <Quote className="w-4 h-4 text-[#A67C1E]" />
                    <span>CÂU NÓI QUAN TRỌNG ĐẦU CHƯƠNG</span>
                  </div>
                  <p
                    style={{ fontFamily: "'Noto Serif', 'Playfair Display', Georgia, serif" }}
                    className="text-base italic text-[#4A321D] leading-relaxed"
                  >
                    &ldquo;{currentChapter.quoteHeader}&rdquo;
                  </p>
                  {currentChapter.quoteAuthor && (
                    <div className="text-xs text-[#8B4513] text-right font-bold font-sans">
                      — {currentChapter.quoteAuthor}
                    </div>
                  )}
                  {currentChapter.introSummary && (
                    <p className="text-sm sm:text-xs text-[#665241] pt-2 border-t border-[#D8C7A0]/60 leading-relaxed">
                      {currentChapter.introSummary}
                    </p>
                  )}
                </div>
              )}

              {/* Chapter Sections (Essays / Poems / Dedications) */}
              <div
                style={{ fontSize: `${fontSize}px`, lineHeight: '1.9' }}
                className="space-y-10 text-left sm:text-justify"
              >
                {currentChapter.sections.map((sec, sIdx) => {
                  const isPoem = sec.type === 'poem';

                  return (
                    <section key={sIdx} className="space-y-4 pt-4 border-t border-[#E8DCB8] first:border-t-0 first:pt-0">
                      {/* Section Title */}
                      <div className="text-center space-y-1">
                        {sec.title && <h3
                          style={{ fontFamily: "'UTM Avo', sans-serif" }}
                          className={`font-bold uppercase tracking-wider ${
                            isPoem ? 'text-lg sm:text-xl text-[#A67C1E]' : 'text-base sm:text-lg text-[#8B4513]'
                          }`}
                        >
                          {sec.title}
                        </h3>}
                        {sec.pageNumber && (
                          <div className="text-xs font-mono text-[#8B4513]/60">
                            [Trang {sec.pageNumber}]
                          </div>
                        )}
                      </div>

                      {/* Section Body */}
                      {isPoem ? (
                        /* BÀI THƠ: Canh giữa, font nghiêng tao nhã Noto Serif, ngắt dòng chuẩn */
                        <div className="max-w-xl mx-auto py-3 px-4 bg-[#F2ECE1]/60 rounded-2xl border border-[#D8C7A0]/40">
                          <div
                            style={{ fontFamily: "'Noto Serif', 'Playfair Display', Georgia, serif" }}
                            className="text-center italic text-[#332010] leading-loose whitespace-pre-line text-base sm:text-lg space-y-4"
                          >
                            {sec.content}
                          </div>

                          {/* TÊN SƯ PHỤ: Căn phải, chữ ký nghệ thuật */}
                          {sec.author && (
                            <div className="pt-4 text-right">
                              <span
                                style={{ fontFamily: "'Noto Serif', 'Playfair Display', Georgia, serif" }}
                                className="text-sm sm:text-base font-bold text-[#8B4513] italic inline-flex items-center gap-1.5 border-b border-[#A67C1E]/50 pb-0.5"
                              >
                                <Feather className="w-3.5 h-3.5 text-[#A67C1E]" />
                                <span>{sec.author}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* BÀI VĂN XUÔI / TẢN VĂN: Chữ cái đầu Dropcap có gạch chân */
                        <div className="space-y-4 text-left sm:text-justify font-sans text-[#2C1C11]">
                          {sec.content.split('\n\n').map((paragraph, pIdx) => {
                            if (pIdx === 0 && paragraph.length > 80) {
                              const firstChar = paragraph.charAt(0);
                              const restText = paragraph.slice(1);
                              return (
                                <p key={pIdx} className="leading-relaxed">
                                  <span
                                    style={{ fontFamily: "'Noto Serif', 'Playfair Display', Georgia, serif" }}
                                    className="text-5xl sm:text-6xl font-bold float-left mr-2.5 pb-0.5 leading-none text-[#8B4513] border-b-2 border-[#F2C14E]"
                                  >
                                    {firstChar}
                                  </span>
                                  {restText}
                                </p>
                              );
                            }
                            return (
                              <p key={pIdx} className="leading-relaxed">
                                {paragraph}
                              </p>
                            );
                          })}

                          {sec.author && (
                            <div className="pt-2 text-right">
                              <span className="text-sm sm:text-xs font-bold text-[#8B4513] italic">
                                — {sec.author}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>

              {/* Bottom Chapter Navigation */}
              <div className="mt-10 sm:mt-12 pt-6 border-t border-[#D8C7A0] flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                <button
                  type="button"
                  disabled={selectedChapterIdx === 0}
                  onClick={() => {
                    if (selectedChapterIdx > 0) {
                      setSelectedChapterIdx(selectedChapterIdx - 1);
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-4 sm:px-5 py-2.5 min-h-11 flex-1 sm:flex-none rounded-xl bg-[#3A2718] hover:bg-[#4A3220] border border-[#F2C14E]/40 text-[#FFE5A3] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shadow-md"
                >
                  ← Chương Trước
                </button>

                <span className="text-sm sm:text-xs text-[#8B4513] font-bold order-first sm:order-none w-full sm:w-auto text-center">
                  Chương {selectedChapterIdx + 1} / {chapters.length}
                </span>

                <button
                  type="button"
                  disabled={selectedChapterIdx === chapters.length - 1}
                  onClick={() => {
                    if (selectedChapterIdx < chapters.length - 1) {
                      setSelectedChapterIdx(selectedChapterIdx + 1);
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-4 sm:px-5 py-2.5 min-h-11 flex-1 sm:flex-none rounded-xl bg-[#F2C14E] hover:bg-[#ffde59] text-[#140D07] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shadow-md"
                >
                  Chương Tiếp Theo →
                </button>
              </div>
            </article>
          </main>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌟 CHẾ ĐỘ 2: LẬT TRANG SÁCH 3D CHÂN THỰC (3D FLIPBOOK SPREAD) */}
      {/* ========================================================================= */}
      {readingMode === 'flip' && (
        <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-8 max-w-6xl mx-auto w-full">
          {/* 3D Book Container */}
          <div className="relative w-full flex flex-col md:flex-row md:aspect-[16/10] md:max-h-[75vh] rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] border-4 border-[#3A2718] bg-[#140D07]">
            {/* Book Spine Center Crease */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-8 -translate-x-1/2 z-20 pointer-events-none bg-gradient-to-r from-black/40 via-black/80 to-black/40 shadow-2xl" />

            {/* Left Page */}
            <div className="md:flex-1 p-5 sm:p-8 min-h-[50svh] md:min-h-0 bg-[#F9F5EC] text-[#2C1C11] relative flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#D8C7A0] select-none overflow-x-hidden md:overflow-y-auto">
              {flipPages[currentFlipPage] ? (
                <>
                  <div className="space-y-2">
                    {/* Header bar */}
                    <div className="flex items-center justify-between text-xs text-[#A67C1E] font-bold uppercase tracking-wider pb-2 border-b border-[#E8DCB8]">
                      <span>{flipPages[currentFlipPage].headerLeft}</span>
                      <span>Trang {flipPages[currentFlipPage].pageNumber}</span>
                    </div>

                    {flipPages[currentFlipPage].title && (
                      <h3
                        style={{ fontFamily: "'UTM Avo', sans-serif" }}
                        className="text-base font-bold text-[#8B4513] uppercase tracking-wide pt-1"
                      >
                        {flipPages[currentFlipPage].title}
                      </h3>
                    )}

                    <div
                      style={flipPages[currentFlipPage].isPoem ? { fontFamily: "'Noto Serif', 'Playfair Display', Georgia, serif" } : undefined}
                      className={`pt-1 text-base md:text-sm text-[#332010] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] ${
                        flipPages[currentFlipPage].isPoem
                          ? 'text-center italic'
                          : 'text-left md:text-justify font-sans'
                      }`}
                    >
                      {flipPages[currentFlipPage].content}
                    </div>

                    {flipPages[currentFlipPage].author && (
                      <div
                        style={{ fontFamily: "'Noto Serif', 'Playfair Display', Georgia, serif" }}
                        className="pt-2 text-right text-sm md:text-xs font-bold text-[#8B4513] italic"
                      >
                        — {flipPages[currentFlipPage].author}
                      </div>
                    )}
                  </div>

                  <div className="text-center text-xs font-mono text-[#A67C1E] pt-2 border-t border-[#E8DCB8]/40">
                    — {flipPages[currentFlipPage].pageNumber} —
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#c9b896]">
                  (Bìa trước)
                </div>
              )}
            </div>

            {/* Right Page */}
            <div className="md:flex-1 p-5 sm:p-8 min-h-[50svh] md:min-h-0 bg-[#FAF7F0] text-[#2C1C11] relative flex flex-col justify-between md:border-l border-[#D8C7A0] select-none overflow-x-hidden md:overflow-y-auto">
              {flipPages[currentFlipPage + 1] ? (
                <>
                  <div className="space-y-2">
                    {/* Header bar */}
                    <div className="flex items-center justify-between text-xs text-[#A67C1E] font-bold uppercase tracking-wider pb-2 border-b border-[#E8DCB8]">
                      <span>{flipPages[currentFlipPage + 1].headerRight}</span>
                      <span>Trang {flipPages[currentFlipPage + 1].pageNumber}</span>
                    </div>

                    {flipPages[currentFlipPage + 1].title && (
                      <h3
                        style={{ fontFamily: "'UTM Avo', sans-serif" }}
                        className="text-base font-bold text-[#8B4513] uppercase tracking-wide pt-1"
                      >
                        {flipPages[currentFlipPage + 1].title}
                      </h3>
                    )}

                    <div
                      style={flipPages[currentFlipPage + 1].isPoem ? { fontFamily: "'Noto Serif', 'Playfair Display', Georgia, serif" } : undefined}
                      className={`pt-1 text-base md:text-sm text-[#332010] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] ${
                        flipPages[currentFlipPage + 1].isPoem
                          ? 'text-center italic'
                          : 'text-left md:text-justify font-sans'
                      }`}
                    >
                      {flipPages[currentFlipPage + 1].content}
                    </div>

                    {flipPages[currentFlipPage + 1].author && (
                      <div
                        style={{ fontFamily: "'Noto Serif', 'Playfair Display', Georgia, serif" }}
                        className="pt-2 text-right text-sm md:text-xs font-bold text-[#8B4513] italic"
                      >
                        — {flipPages[currentFlipPage + 1].author}
                      </div>
                    )}
                  </div>

                  <div className="text-center text-xs font-mono text-[#A67C1E] pt-2 border-t border-[#E8DCB8]/40">
                    — {flipPages[currentFlipPage + 1].pageNumber} —
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <Flower2 className="w-10 h-10 text-[#A67C1E]" />
                  <div className="text-sm font-bold text-[#8B4513]">TÙNG LÂM HÒA PHÚC</div>
                  <p className="text-xs text-[#665241] italic">
                    Nguyện đem công đức này hồi hướng khắp mười phương pháp giới chúng sinh.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* FLIPBOOK NAVIGATION CONTROLS */}
          <div className="mt-5 sm:mt-6 w-full sm:w-auto flex flex-wrap items-center justify-center gap-3 sm:gap-4 bg-[#271910] px-3 sm:px-6 py-3 rounded-2xl border border-[#F2C14E]/30 shadow-xl">
            <button
              type="button"
              disabled={currentFlipPage === 0}
              onClick={handlePrevPage}
              className="px-4 py-2 min-h-11 sm:min-h-0 flex-1 sm:flex-none justify-center rounded-xl bg-[#3A2718] hover:bg-[#4A3220] text-[#FFE5A3] border border-[#F2C14E]/40 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-sm"
            >
              <ChevronLeft className="w-4 h-4 text-[#F2C14E]" />
              <span>Lật Trang Trước</span>
            </button>

            {/* Page Slider */}
            <div className="flex items-center justify-center gap-3 w-full sm:w-auto order-first sm:order-none">
              <input
                type="range"
                min={0}
                max={Math.max(0, totalFlipPages - 1)}
                step={2}
                value={currentFlipPage}
                onChange={(e) => setCurrentFlipPage(Number(e.target.value))}
                className="min-w-0 flex-1 sm:flex-none h-11 sm:h-auto sm:w-48 accent-[#F2C14E] cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-[#F2C14E] min-w-[96px] text-center">
                Trang {currentFlipPage + 1} - {Math.min(currentFlipPage + 2, totalFlipPages)} / {totalFlipPages}
              </span>
            </div>

            <button
              type="button"
              disabled={currentFlipPage >= totalFlipPages - 2}
              onClick={handleNextPage}
              className="px-4 py-2 min-h-11 sm:min-h-0 flex-1 sm:flex-none justify-center rounded-xl bg-[#F2C14E] hover:bg-[#ffde59] text-[#140D07] text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-md"
            >
              <span>Lật Trang Tiếp</span>
              <ChevronRight className="w-4 h-4 text-[#140D07]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
