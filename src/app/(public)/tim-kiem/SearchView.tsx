// Trang kết quả tìm kiếm: biểu mẫu GET thường (chạy khi không có JS), kết quả dựng ở máy chủ. Tất cả chuyên mục một lúc thì mỗi chuyên mục
// hiện vài kết quả đầu kèm đường tới toàn bộ; một chuyên mục thì hiện hết, 12 kết quả một trang. Không có từ khóa hay không có kết quả
// thì gợi ý các chuyên mục. Luật xếp hạng và phân nhóm là của lib/v3-search.ts (bản chép của www).
import Link from "next/link";
import { Search } from "lucide-react";
import PlainHero from "@/components/public/PlainHero";
import {
  groupResults,
  SEARCH_GROUP_SIZE,
  SEARCH_PAGE_SIZE,
  SEARCH_PATH,
  SEARCH_SECTIONS,
  type SearchItem,
  type SearchQuery,
  searchHref,
} from "@/lib/v3-search";

const AVO = { fontFamily: "'UTM Avo', sans-serif" } as const;
const NIAGARA = { fontFamily: "'UTM Niagara', serif" } as const;

const number = (n: number) => n.toLocaleString("vi-VN");
const dateText = (iso: string) => iso.split("-").reverse().join("/");

const PILL = "inline-flex items-center gap-2 min-h-11 px-4 rounded-full border text-sm font-bold transition-colors";
const PILL_OFF = "border-[#F2C14E]/35 bg-[#25170E] text-[#e3d2c1] hover:border-[#F2C14E] hover:text-[#F2C14E]";
const PILL_ON = "border-[#F2C14E] bg-[#F2C14E] text-[#1A120B]";

function Result({ item }: { item: SearchItem }) {
  return (
    <li className="rounded-xl border border-[#F2C14E]/20 bg-[#25170E] p-4 flex flex-col gap-1 relative active:bg-[#2E1D10]">
      <p className="text-lg leading-snug" style={AVO}>
        <Link prefetch={false} className="font-bold text-[#F2C14E] hover:text-white hover:underline underline-offset-4 after:absolute after:inset-0 after:content-['']" href={item.href}>
          {item.title}
        </Link>
      </p>
      {item.text ? <p className="text-[15px] md:text-sm text-[#e3d2c1]/85 leading-relaxed line-clamp-3" style={AVO}>{item.text}</p> : null}
      {item.date ? (
        <p className="text-sm md:text-xs text-[#E2C89B]" style={AVO}>
          <time dateTime={item.date}>{dateText(item.date)}</time>
        </p>
      ) : null}
    </li>
  );
}

function Suggestions() {
  return (
    <nav aria-label="Gợi ý chuyên mục" className="mt-4 flex flex-col gap-3">
      <p className="text-sm" style={AVO}>Hoặc xem theo chuyên mục:</p>
      <ul className="flex flex-wrap gap-3 list-none p-0 m-0">
        {SEARCH_SECTIONS.map((section) => (
          <li key={section.slug}>
            <Link prefetch={false} className={`${PILL} ${PILL_OFF}`} style={AVO} href={section.href}>
              {section.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Các số trang: trang đầu, trang cuối và hai trang mỗi bên trang hiện tại, chỗ hở là dấu ba chấm. */
export function pageNumbers(page: number, pageCount: number): (number | "...")[] {
  const keep = new Set([1, pageCount, ...[-2, -1, 0, 1, 2].map((d) => page + d)].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? (["...", n] as const) : [n]));
}

function Pager({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Các trang kết quả" className="mt-6">
      <ul className="flex flex-wrap items-center gap-2 list-none p-0 m-0">
        {page > 1 ? (
          <li>
            <Link prefetch={false} className={`${PILL} ${PILL_OFF}`} style={AVO} href={hrefFor(page - 1)} rel="prev">
              Trang trước
            </Link>
          </li>
        ) : null}
        {pageNumbers(page, pageCount).map((n, i) =>
          n === "..." ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1">…</li>
          ) : (
            <li key={n}>
              <Link prefetch={false} className={`${PILL} ${n === page ? PILL_ON : PILL_OFF} min-w-11 justify-center`} style={AVO} href={hrefFor(n)} aria-current={n === page ? "page" : undefined}>
                <span className="sr-only">Trang </span>
                {n}
              </Link>
            </li>
          ),
        )}
        {page < pageCount ? (
          <li>
            <Link prefetch={false} className={`${PILL} ${PILL_OFF}`} style={AVO} href={hrefFor(page + 1)} rel="next">
              Trang sau
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

export default function SearchView({ query, results }: { query: SearchQuery; results: SearchItem[] }) {
  const groups = groupResults(results);
  const group = query.section ? groups.find((item) => item.section.slug === query.section) : undefined;
  const shown = query.section ? (group?.items ?? []) : results;
  const pageCount = Math.max(1, Math.ceil(shown.length / SEARCH_PAGE_SIZE));
  const href = (change: Partial<SearchQuery>) => searchHref({ ...query, ...change });

  let status = "Nhập từ khóa để tìm";
  if (query.q) {
    status = `${number(shown.length)} kết quả cho “${query.q}”${group ? ` trong ${group.section.name}` : ""}`;
    if (group && pageCount > 1 && query.page <= pageCount) status += ` · trang ${query.page}/${pageCount}`;
  }

  return (
    <div className="min-h-screen bg-[#2A1D14] text-[#e3d2c1] selection:bg-[#F2C14E] selection:text-black">
      <main className="pb-16">
        <PlainHero title="Tìm kiếm" />
        <div className="max-w-[960px] mx-auto px-4 md:px-10 mt-4 flex flex-col gap-6">
          <form action={SEARCH_PATH} method="get" role="search" aria-label="Tìm trên trang" className="flex flex-col gap-2">
            <label htmlFor="tu-khoa" className="text-sm font-bold uppercase tracking-widest text-[#F2C14E]" style={AVO}>
              Từ khóa
            </label>
            <div className="flex gap-3">
              <input
                id="tu-khoa"
                type="search"
                name="q"
                defaultValue={query.q}
                maxLength={100}
                placeholder="Ví dụ: niệm Phật, Vu Lan, Quan Âm"
                autoComplete="off"
                enterKeyHint="search"
                className="flex-1 min-w-0 min-h-12 rounded-full border border-[#F2C14E]/50 bg-[#1A120B] px-5 text-base text-[#e3d2c1] placeholder:text-[#e3d2c1]/50 focus:outline-2 focus:outline-[#F2C14E]"
                style={AVO}
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 min-h-12 px-6 rounded-full text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-[#D4A017] to-[#F2C14E] text-[#1A120B] hover:scale-105 transition-transform cursor-pointer"
                style={AVO}
              >
                <Search className="w-4 h-4" aria-hidden={true} />
                Tìm
              </button>
            </div>
            <p className="text-sm md:text-xs text-[#e3d2c1]/75" style={AVO}>Gõ có dấu hay không dấu đều được.</p>
          </form>

          <h2 id="ket-qua" tabIndex={-1} className="sr-only">
            Kết quả tìm kiếm
          </h2>
          <p className="text-sm font-bold text-[#E2C89B]" style={AVO} role="status">
            {status}
          </p>

          {query.q && results.length ? (
            <nav aria-label="Chuyên mục">
              <ul className="flex flex-wrap gap-3 list-none p-0 m-0">
                <li>
                  <Link prefetch={false} className={`${PILL} ${!query.section ? PILL_ON : PILL_OFF}`} style={AVO} href={href({ section: "", page: 1 })} aria-current={!query.section ? "page" : undefined}>
                    Tất cả <span className="opacity-80">{number(results.length)}</span>
                  </Link>
                </li>
                {groups.map((item) => (
                  <li key={item.section.slug}>
                    <Link
                      prefetch={false}
                      className={`${PILL} ${item.section.slug === query.section ? PILL_ON : PILL_OFF}`}
                      style={AVO}
                      href={href({ section: item.section.slug, page: 1 })}
                      aria-current={item.section.slug === query.section ? "page" : undefined}
                    >
                      {item.section.name} <span className="opacity-80">{number(item.items.length)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {!query.q ? (
            <div className="rounded-2xl border border-[#F2C14E]/30 bg-[#25170E] p-6" style={AVO}>
              <p className="text-3xl text-[#F2C14E]" style={NIAGARA}>Quý vị muốn tìm điều gì?</p>
              <p className="mt-2 text-sm">Tìm trong bài viết, Tông Chỉ, Giới thiệu, các khu vực, tôn tượng và lịch tu học.</p>
              <Suggestions />
            </div>
          ) : !shown.length ? (
            <div className="rounded-2xl border border-[#F2C14E]/30 bg-[#25170E] p-6" style={AVO}>
              <p className="text-3xl text-[#F2C14E]" style={NIAGARA}>Không tìm thấy kết quả cho “{query.q}”</p>
              <p className="mt-2 text-sm">Kính mời quý vị thử từ khóa ngắn hơn hoặc khác đi.</p>
              <Suggestions />
            </div>
          ) : query.section && query.page > pageCount ? (
            <div className="rounded-2xl border border-[#F2C14E]/30 bg-[#25170E] p-6" style={AVO}>
              <p className="text-3xl text-[#F2C14E]" style={NIAGARA}>Không có trang {query.page}</p>
              <Link className="mt-2 inline-flex items-center min-h-12 text-sm font-bold text-[#F2C14E] hover:underline" href={href({ page: 1 })}>
                Về trang đầu
              </Link>
            </div>
          ) : group ? (
            <>
              <ol className="flex flex-col gap-3 list-none p-0 m-0">
                {shown.slice((query.page - 1) * SEARCH_PAGE_SIZE, query.page * SEARCH_PAGE_SIZE).map((item) => (
                  <Result key={item.href} item={item} />
                ))}
              </ol>
              <Pager page={query.page} pageCount={pageCount} hrefFor={(page) => href({ page })} />
            </>
          ) : (
            groups.map((item) => (
              <section key={item.section.slug} aria-labelledby={`nhom-${item.section.slug}`} className="flex flex-col gap-3">
                <h3 id={`nhom-${item.section.slug}`} className="text-2xl md:text-3xl font-normal text-[#F2C14E] uppercase tracking-wide" style={NIAGARA}>
                  {item.section.name} <span className="text-sm normal-case text-[#E2C89B]" style={AVO}>{number(item.items.length)} kết quả</span>
                </h3>
                <ol className="flex flex-col gap-3 list-none p-0 m-0">
                  {item.items.slice(0, SEARCH_GROUP_SIZE).map((result) => (
                    <Result key={result.href} item={result} />
                  ))}
                </ol>
                {item.items.length > SEARCH_GROUP_SIZE ? (
                  <Link className="inline-flex items-center min-h-12 text-sm font-bold text-[#F2C14E] hover:underline underline-offset-4" style={AVO} href={href({ section: item.section.slug, page: 1 })}>
                    Xem cả {number(item.items.length)} kết quả trong {item.section.name}
                  </Link>
                ) : null}
              </section>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
