import Link from "next/link";
import type { ReactNode } from "react";
import ListStatus from "@/components/sections/posts/ListStatus";
import SortSelect from "@/components/sections/posts/SortSelect";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import PostCard from "@/components/shared/cards/PostCard";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import NoItems from "@/components/shared/others/NoItems";
import PageLinks from "@/components/shared/others/PageLinks";
import type { PostSection } from "@/config/sections";
import { getContentRepository } from "@/libs/content/repository";
import { formatNumber } from "@/libs/format";
import { type ListState, listHref, readListState, SORTS, sortOf } from "@/libs/postList";

const HEADING_ID = "danh-sach-bai";

type Props = {
	section: PostSection;
	searchParams: Record<string, string | string[] | undefined>;
	/** Shown under the list, before the closing call to action. */
	children?: ReactNode;
};

// The list of a section's posts, filtered, sorted and paged on the server: the page sends 12
// cards, not 472.
export default async function PostListPage({ section, searchParams, children }: Props) {
	const state = readListState(searchParams);
	const repo = await getContentRepository();
	const categories = await repo.listCategories(section.slug);
	const category = categories.find((item) => item.slug === state.category);
	const unknownCategory = !!state.category && !category;
	const result = unknownCategory
		? null
		: await repo.listPosts({ section: section.slug, category: state.category || undefined, sort: sortOf(state), page: state.page });
	const href = (change: Partial<ListState>) => listHref(section.path, { ...state, ...change });

	const allCount = categories.reduce((sum, item) => sum + item.count, 0);
	const status = result
		? `${formatNumber(result.total)} bài${category ? ` trong “${category.name}”` : ""}${result.pageCount > 1 && state.page <= result.pageCount ? ` · trang ${state.page}/${result.pageCount}` : ""}`
		: "Không có chuyên mục này";

	let empty: { title: string; text?: string; navText: string; navUrl: string } | null = null;
	if (unknownCategory) {
		empty = { title: "Không có chuyên mục này", text: `Kính mời quý vị xem tất cả bài của ${section.name}.`, navText: "Xem tất cả bài", navUrl: section.path };
	} else if (result && !result.total) {
		empty = { title: "Chưa có bài trong mục này", navText: "Xem tất cả bài", navUrl: section.path };
	} else if (result && state.page > result.pageCount) {
		empty = {
			title: `Không có trang ${state.page}`,
			text: `Danh sách này có ${result.pageCount} trang.`,
			navText: "Về trang đầu",
			navUrl: href({ page: 1 }),
		};
	}

	return (
		<main>
			<HeaderSpace />
			<HeroInner title={section.name} text={section.name} />
			<section className="tj-blog-section section-gap tlhp-post-list" aria-labelledby={HEADING_ID}>
				<div className="container">
					<h2 id={HEADING_ID} className="visually-hidden" tabIndex={-1}>
						Danh sách bài viết
					</h2>
					<nav aria-label="Chuyên mục">
						<ul className="tlhp-pills">
							<li>
								<Link href={href({ category: "", page: 1 })} scroll={false} aria-current={!state.category ? "page" : undefined}>
									Tất cả <span className="tlhp-pill-count">{formatNumber(allCount)}</span>
								</Link>
							</li>
							{categories.map((item) => (
								<li key={item.slug}>
									<Link
										href={href({ category: item.slug, page: 1 })}
										scroll={false}
										aria-current={item.slug === state.category ? "page" : undefined}
									>
										{item.name} <span className="tlhp-pill-count">{formatNumber(item.count)}</span>
									</Link>
								</li>
							))}
						</ul>
					</nav>
					<div className="tlhp-list-bar">
						<ListStatus text={status} page={state.page} headingId={HEADING_ID} />
						<SortSelect
							value={state.sort}
							action={section.path}
							category={category ? state.category : ""}
							options={SORTS.map((option) => ({ param: option.param, label: option.label, href: href({ sort: option.param, page: 1 }) }))}
						/>
					</div>

					{empty ? (
						<NoItems {...empty} />
					) : (
						<ul className="row row-gap-4 tlhp-post-grid">
							{/* No picture here loads ahead of the rest: an editor's photo can be a 7–9 MB
							    camera original, and React would preload it before the CSS (T41c). */}
							{result!.items.map((post) => (
								<li key={post.id} className="col-12 col-md-6 col-xl-4">
									<PostCard post={post} href={`${section.path}/${post.slug}`} categoryHref={href({ category: post.category.slug, page: 1 })} />
								</li>
							))}
						</ul>
					)}
					{result && !empty ? <PageLinks page={state.page} pageCount={result.pageCount} hrefFor={(page) => href({ page })} /> : null}
				</div>
			</section>
			{children}
			<Cta />
		</main>
	);
}
