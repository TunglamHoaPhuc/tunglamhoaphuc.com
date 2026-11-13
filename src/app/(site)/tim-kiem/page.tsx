import type { Metadata } from "next";
import Link from "next/link";
import ListStatus from "@/components/sections/posts/ListStatus";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import PageLinks from "@/components/shared/others/PageLinks";
import { site } from "@/config/site";
import { getContentRepository } from "@/libs/content/repository";
import { formatDate, formatNumber } from "@/libs/format";
import { groupResults, readSearchQuery, SEARCH_GROUP_SIZE, SEARCH_PAGE_SIZE, SEARCH_PATH, SEARCH_SECTIONS, type SearchItem, type SearchQuery, searchHref, searchItems } from "@/libs/search";
import { searchIndex } from "@/libs/searchIndex";

const TITLE = "Tìm kiếm";
const HEADING_ID = "ket-qua";

// A results page is not something to find in a search engine.
export const metadata: Metadata = {
	title: `${TITLE} – ${site.name}`,
	robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Result({ item }: { item: SearchItem }) {
	return (
		<li className="tlhp-search-result">
			<p className="tlhp-search-title">
				<Link href={item.href}>{item.title}</Link>
			</p>
			{item.text ? <p className="tlhp-search-text">{item.text}</p> : null}
			{item.date ? (
				<p className="tlhp-search-date">
					<time dateTime={item.date}>{formatDate(item.date)}</time>
				</p>
			) : null}
		</li>
	);
}

function Suggestions() {
	return (
		<nav className="tlhp-search-suggest" aria-label="Gợi ý chuyên mục">
			<p>Hoặc xem theo chuyên mục:</p>
			<ul className="tlhp-pills">
				{SEARCH_SECTIONS.map((section) => (
					<li key={section.slug}>
						<Link href={section.href}>{section.name}</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

// Search over every section, on the server, with a plain GET form (the header's search sends
// here too). Every section at once shows the first few results of each, with the way to all
// of them; one section shows them all, 12 to a page. An empty query or no result offers the
// sections instead.
export default async function TimKiem({ searchParams }: Props) {
	const query = readSearchQuery(await searchParams);
	const results = query.q ? searchItems(await searchIndex(await getContentRepository()), query.q) : [];
	const groups = groupResults(results);
	const group = query.section ? groups.find((item) => item.section.slug === query.section) : undefined;
	const shown = query.section ? (group?.items ?? []) : results;
	const pageCount = Math.max(1, Math.ceil(shown.length / SEARCH_PAGE_SIZE));
	const href = (change: Partial<SearchQuery>) => searchHref({ ...query, ...change });

	let status = "Nhập từ khóa để tìm";
	if (query.q) {
		status = `${formatNumber(shown.length)} kết quả cho “${query.q}”${group ? ` trong ${group.section.name}` : ""}`;
		if (group && pageCount > 1 && query.page <= pageCount) status += ` · trang ${query.page}/${pageCount}`;
	}

	return (
		<main>
			<HeaderSpace />
			<HeroInner title={TITLE} text={TITLE} />
			<section className="section-gap tlhp-search" aria-labelledby={HEADING_ID}>
				<div className="container">
					<div className="row">
						<div className="col-12 col-lg-10 col-xl-9 mx-auto">
							<form className="tlhp-search-form" action={SEARCH_PATH} method="get" role="search" aria-label="Tìm trên trang">
								<label htmlFor="tu-khoa">Từ khóa</label>
								<div className="tlhp-search-row">
									<input id="tu-khoa" type="search" name="q" defaultValue={query.q} placeholder="Ví dụ: niệm Phật, Vu Lan, Quan Âm" autoComplete="off" enterKeyHint="search" />
									<ButtonPrimary type="submit" text="Tìm" />
								</div>
								<p className="tlhp-search-hint">Gõ có dấu hay không dấu đều được.</p>
							</form>

							<h2 id={HEADING_ID} className="visually-hidden" tabIndex={-1}>
								Kết quả tìm kiếm
							</h2>
							<div className="tlhp-list-bar">
								<ListStatus text={status} page={query.page} headingId={HEADING_ID} />
							</div>

							{query.q && results.length ? (
								<nav aria-label="Chuyên mục">
									<ul className="tlhp-pills">
										<li>
											<Link href={href({ section: "", page: 1 })} scroll={false} aria-current={!query.section ? "page" : undefined}>
												Tất cả <span className="tlhp-pill-count">{formatNumber(results.length)}</span>
											</Link>
										</li>
										{groups.map((item) => (
											<li key={item.section.slug}>
												<Link href={href({ section: item.section.slug, page: 1 })} scroll={false} aria-current={item.section.slug === query.section ? "page" : undefined}>
													{item.section.name} <span className="tlhp-pill-count">{formatNumber(item.items.length)}</span>
												</Link>
											</li>
										))}
									</ul>
								</nav>
							) : null}

							{!query.q ? (
								<div className="tlhp-empty tlhp-search-empty">
									<p className="tlhp-empty-title">Quý vị muốn tìm điều gì?</p>
									<p>Tìm trong bài viết, Tông Chỉ, Giới thiệu, các khu vực, tôn tượng và lịch tu học.</p>
									<Suggestions />
								</div>
							) : !shown.length ? (
								<div className="tlhp-empty tlhp-search-empty">
									<p className="tlhp-empty-title">Không tìm thấy kết quả cho “{query.q}”</p>
									<p>Kính mời quý vị thử từ khóa ngắn hơn hoặc khác đi.</p>
									<Suggestions />
								</div>
							) : query.section && query.page > pageCount ? (
								<div className="tlhp-empty tlhp-search-empty">
									<p className="tlhp-empty-title">Không có trang {query.page}</p>
									<Link className="tlhp-text-link" href={href({ page: 1 })}>
										Về trang đầu
									</Link>
								</div>
							) : group ? (
								<>
									<ol className="tlhp-search-results">
										{shown.slice((query.page - 1) * SEARCH_PAGE_SIZE, query.page * SEARCH_PAGE_SIZE).map((item) => (
											<Result key={item.href} item={item} />
										))}
									</ol>
									<PageLinks page={query.page} pageCount={pageCount} hrefFor={(page) => href({ page })} />
								</>
							) : (
								groups.map((item) => (
									<section key={item.section.slug} className="tlhp-search-group" aria-labelledby={`nhom-${item.section.slug}`}>
										<h3 id={`nhom-${item.section.slug}`} className="tlhp-search-group-title">
											{item.section.name} <span className="tlhp-article-count">{formatNumber(item.items.length)} kết quả</span>
										</h3>
										<ol className="tlhp-search-results">
											{item.items.slice(0, SEARCH_GROUP_SIZE).map((result) => (
												<Result key={result.href} item={result} />
											))}
										</ol>
										{item.items.length > SEARCH_GROUP_SIZE ? (
											<Link className="tlhp-text-link" href={href({ section: item.section.slug, page: 1 })}>
												Xem cả {formatNumber(item.items.length)} kết quả trong {item.section.name}
											</Link>
										) : null}
									</section>
								))
							)}
						</div>
					</div>
				</div>
			</section>
			<Cta />
		</main>
	);
}
