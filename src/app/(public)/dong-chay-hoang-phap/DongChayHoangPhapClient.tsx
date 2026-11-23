'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dongChayBadge, type DongChayCategoryInfo, HoangPhapArticle } from '@/data/dong-chay-hoang-phap-data';
import type { DongChayPage } from '@/lib/dong-chay';
import { CategoryFilter } from '@/components/common/CategoryFilter';
import { PostCard } from '@/components/common/PostCard';
import { PostItem } from '@/types/post';
import { fitImage, getImageUrl } from '@/utils/image';

/** Bề rộng của hình nền đầu trang (nền phủ khung, mờ 30%): bậc 1280 của biến thể. */
const HEADER_BG_WIDTH = 1280;

type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a';

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'newest', label: 'Mới nhất' },
  { id: 'oldest', label: 'Cũ nhất' },
  { id: 'a-z', label: 'Từ A đến Z' },
  { id: 'z-a', label: 'Từ Z đến A' },
];

type View = { page: number; category: string; sort: SortOption };

const DEFAULT_VIEW: View = { page: 1, category: 'all', sort: 'newest' };

function viewFromLocation(): View {
  const q = new URLSearchParams(window.location.search);
  const page = Number(q.get('trang'));
  const sort = q.get('sap-xep') as SortOption | null;
  return {
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    category: q.get('danh-muc') || 'all',
    sort: sort && SORT_OPTIONS.some((o) => o.id === sort) ? sort : 'newest',
  };
}

function viewToQuery(v: View): string {
  const q = new URLSearchParams();
  if (v.page > 1) q.set('trang', String(v.page));
  if (v.category !== 'all') q.set('danh-muc', v.category);
  if (v.sort !== 'newest') q.set('sap-xep', v.sort);
  const s = q.toString();
  return s ? `?${s}` : '';
}

const sameView = (a: View, b: View) => a.page === b.page && a.category === b.category && a.sort === b.sort;

// `categories`: các chuyên mục đang có bài ở D1 (tên và icon do admin đặt), máy chủ dựng ở page.tsx.
export default function DongChayHoangPhapClient({ initial, categories }: { initial: DongChayPage; categories: DongChayCategoryInfo[] }) {
  const [data, setData] = useState<DongChayPage>(initial);
  const [view, setView] = useState<View>({ page: initial.page, category: initial.category, sort: initial.sort });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const gridTopRef = useRef<HTMLDivElement>(null);
  const filterCategories = useMemo(() => [{ id: 'all', label: 'Tất cả' }, ...categories.map(({ id, label }) => ({ id, label }))], [categories]);
  const requestRef = useRef(0);

  const load = useCallback(async (next: View) => {
    const id = ++requestRef.current;
    setView(next);
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/public/dong-chay${viewToQuery(next) || '?trang=1'}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as DongChayPage;
      if (id !== requestRef.current) return;
      setData(json);
      setView({ page: json.page, category: json.category, sort: json.sort });
    } catch {
      if (id === requestRef.current) setFailed(true);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, []);

  // Mở trang bằng một địa chỉ có ?trang=…, và nút Lùi/Tiến của trình duyệt.
  useEffect(() => {
    const fromUrl = viewFromLocation();
    if (!sameView(fromUrl, DEFAULT_VIEW)) load(fromUrl);
    const onPop = () => load(viewFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load]);

  const go = (next: View) => {
    if (sameView(next, view)) return;
    window.history.pushState(null, '', `${window.location.pathname}${viewToQuery(next)}`);
    load(next);
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Ảnh nền đầu trang: bài mới nhất (cố định, không đổi theo trang đang xem).
  const featuredArticle = initial.items[0];
  // Là hình nền mờ 30% trong khung đầu trang: bản 1280 px (biến thể dựng sẵn), không phải ảnh gốc.
  const headerBgImage = fitImage(
    getImageUrl(
      featuredArticle?.bannerUrl ||
      featuredArticle?.thumbnailUrl ||
      '/images/hero/toan-canh-chua-1280.webp'
    ),
    HEADER_BG_WIDTH
  );

  return (
    <div className="min-h-screen bg-[#2A1D14] text-[#e3d2c1] selection:bg-[#F2C14E] selection:text-black">
      {/* ── HEADER VỚI BACKGROUND WATERMARK TÔNG PHONG TRUYỀN THỪA ── */}
      <div className="relative w-full overflow-hidden bg-[#2A1D14] pt-28 pb-10">
        {headerBgImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none mix-blend-luminosity [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
            style={{
              backgroundImage: `url('${headerBgImage}')`,
              backgroundPosition: featuredArticle?.thumbnailPosition || featuredArticle?.imagePosition || 'center 20%',
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2A1D14]/40 via-[#2A1D14]/70 to-[#2A1D14] pointer-events-none" />

        <div className="relative z-10 max-w-[1280px] mx-auto px-4 md:px-10 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-[#3a2718] border border-[#f2cc8f]/40 flex items-center justify-center text-[#ffde59] mb-2 shadow-md">
            <span className="text-xl">☸</span>
          </div>

          <div className="flex items-center justify-center w-full my-4 gap-4 md:gap-8">
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#F2C14E]/50 to-[#F2C14E]" />
            <h1
              style={{ fontFamily: "'UTM Niagara', sans-serif" }}
              className="text-5xl sm:text-6xl md:text-7xl font-normal text-[#ffde59] uppercase tracking-wider drop-shadow-[0_0_18px_rgba(242,193,78,0.7)] whitespace-nowrap flex-shrink-0"
            >
              DÒNG CHẢY HOẰNG PHÁP
            </h1>
            <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-[#F2C14E]/50 to-[#F2C14E]" />
          </div>

          <p
            style={{ fontFamily: "'UTM Avo', sans-serif" }}
            className="text-xs sm:text-sm md:text-base text-[#e3d2c1] tracking-wide font-normal max-w-2xl mx-auto px-4 leading-relaxed text-balance"
          >
            Ghi dấu hành trình phụng&nbsp;sự nhân&nbsp;sinh &amp; hoằng&nbsp;dương chánh&nbsp;pháp của Tùng&nbsp;Lâm&nbsp;Hòa&nbsp;Phúc.
          </p>
        </div>
      </div>

      <main className="pb-20 px-4 md:px-10 max-w-[1280px] mx-auto">
        {/* ── THANH LỰA CHỌN DANH MỤC & SẮP XẾP ── */}
        <div className="mb-12 scroll-mt-24" ref={gridTopRef}>
          <div className="mb-4">
            <h2
              style={{ fontFamily: "'UTM Classic Antiqua', 'UTM ClassizismAntiqua', serif" }}
              className="text-2xl md:text-3xl font-normal text-white uppercase tracking-wider mb-4"
            >
              LỰA CHỌN DANH MỤC
            </h2>
          </div>

          <CategoryFilter
            categories={filterCategories}
            activeCategory={view.category}
            onSelectCategory={(category) => go({ ...view, category, page: 1 })}
            sortOptions={SORT_OPTIONS}
            currentSort={view.sort}
            onSelectSort={(sortId) => go({ ...view, sort: sortId as SortOption, page: 1 })}
            sortLabel="Phân loại"
          />
        </div>

        {/* ── LƯỚI BÀI VIẾT (12 bài mỗi trang) ── */}
        <div className="mb-12" aria-busy={loading}>
          {failed && (
            <div role="alert" className="mb-8 rounded-xl border border-[#F2C14E]/50 bg-[#3a2718] px-5 py-4 text-sm flex flex-wrap items-center gap-3">
              <span>Không tải được danh sách bài. Kiểm tra kết nối rồi thử lại.</span>
              <button
                type="button"
                onClick={() => load(view)}
                className="px-4 py-1.5 rounded-lg border border-[#F2C14E] text-[#F2C14E] hover:bg-[#6B4B2A] font-bold"
              >
                Thử lại
              </button>
            </div>
          )}

          {data.items.length === 0 ? (
            <p className="text-center py-16 text-[#e3d2c1]/80">Danh mục này chưa có bài viết.</p>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 transition-opacity duration-300 ${loading ? 'opacity-50' : ''}`}>
              {data.items.map((art, index) => (
                <PostCard key={art.id} post={mapArticleToPostItem(art, categories)} variant="golden" priority={index === 0} />
              ))}
            </div>
          )}

          <Pagination page={data.page} pageCount={data.pageCount} total={data.total} disabled={loading} onPage={(page) => go({ ...view, page })} />
        </div>
      </main>
    </div>
  );
}

/** Các số trang cần hiện: trang đầu, trang cuối và hai trang quanh trang đang xem; "…" cho khoảng bị bỏ. */
function pageList(page: number, pageCount: number): (number | '…')[] {
  const keep = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

function Pagination({
  page,
  pageCount,
  total,
  disabled,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  disabled: boolean;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const base =
    'min-w-10 h-10 px-3 rounded-lg border text-sm font-bold flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const idle = 'border-[#F2C14E]/40 text-[#e3d2c1] hover:border-[#F2C14E] hover:text-[#F2C14E]';
  return (
    <nav aria-label="Phân trang" className="mt-12 flex flex-col items-center gap-3" style={{ fontFamily: "'UTM Avo', sans-serif" }}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className={`${base} ${idle}`} disabled={disabled || page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pageList(page, pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-[#e3d2c1]/60" aria-hidden="true">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`${base} ${p === page ? 'bg-[#6B4B2A] border-[#F2C14E] text-[#F2C14E]' : idle}`}
              aria-current={p === page ? 'page' : undefined}
              disabled={disabled && p !== page}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          )
        )}
        <button type="button" className={`${base} ${idle}`} disabled={disabled || page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-[#e3d2c1]/70">
        Trang {page}/{pageCount} · {total} bài
      </p>
    </nav>
  );
}

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&#8230;/g, '…')
    .replace(/&hellip;/g, '…')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(parseInt(dec, 10)))
    .normalize('NFC');
}

function mapArticleToPostItem(art: HoangPhapArticle, categories: DongChayCategoryInfo[]): PostItem {
  // Tên và icon của chuyên mục: của admin khi có, không thì thiết kế của bốn chuyên mục cũ (data/dong-chay-hoang-phap-data.ts).
  const { name: categoryName, iconSrc: categoryIconUrl } = dongChayBadge(art.category, categories);

  return {
    id: art.id,
    imageUrl: art.thumbnailUrl || '/images/hero/toan-canh-chua-1280.webp',
    category1: categoryName,
    category1IconUrl: categoryIconUrl,
    title: decodeHtmlEntities(art.title),
    subtitle: decodeHtmlEntities(art.subtitle || ''),
    category2: decodeHtmlEntities(art.subtitle || ''),
    publishedDate: art.date,
    viewsCount: typeof art.views === 'number' ? art.views : (parseInt(art.views as any, 10) || 0),
    description: decodeHtmlEntities(art.summary),
    targetUrl: `/dong-chay-hoang-phap/${art.slug}`,
    large: true,
    thumbnailPosition: art.thumbnailPosition || 'center 20%',
    imagePosition: art.thumbnailPosition || 'center 20%',
  };
}
