import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import AnchorTabs, { type AnchorTab } from "@/components/sections/posts/AnchorTabs";
import PostGallery from "@/components/sections/posts/PostGallery";
import PostVideos from "@/components/sections/posts/PostVideos";
import ReadingFrame from "@/components/sections/posts/ReadingFrame";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { site } from "@/config/site";
import { tongChi } from "@/config/tongChi";
import { IMAGE_WIDTH, imageAt, topImagePriority } from "@/libs/content/media";
import { getContentRepository } from "@/libs/content/repository";
import type { TongChiArticle, TongChiSummary } from "@/libs/content/types";
import { formatNumber } from "@/libs/format";
import { groupTongChi, nameInGroup, tongChiHref } from "@/libs/tongChiGroups";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;
// No pages at build time; each is made on its first visit, then cached (ISR).
export async function generateStaticParams() {
	return [];
}

const PATH = tongChi.path;

type Props = { params: Promise<{ slug: string }> };

async function findArticle(slug: string): Promise<{ article: TongChiArticle; all: TongChiSummary[] } | null> {
	const repository = await getContentRepository();
	const article = await repository.getTongChi(slug);
	return article ? { article, all: await repository.listTongChi() } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const found = await findArticle((await params).slug);
	if (!found) return {};
	const { article } = found;
	const description = article.excerpt || article.subtitle;
	return {
		title: `${article.name} – ${tongChi.title} – ${site.name}`,
		description,
		openGraph: { title: article.name, description, images: article.banner ? [article.banner.src] : undefined },
	};
}

// One article of Tông Chỉ Tu Học after Bexon's service page (ServiceDetailsMain): the text in
// the reading frame with its video, album and source book, the articles before and after,
// and beside it the other articles of its group. Rendered on the server: the old site
// fetched it in the browser and showed "Đang tải…" (or nothing of the body at all).
export default async function TongChiArticlePage({ params }: Props) {
	const found = await findArticle((await params).slug);
	if (!found) notFound();
	const { article, all } = found;
	const groups = groupTongChi(all);
	const group = groups.find((item) => item.slug === article.group.slug);
	const at = all.findIndex((item) => item.id === article.id);
	const [previous, next] = [all[at - 1], all[at + 1]];
	const groupHref = `${PATH}#${article.group.slug}`;
	const hasSources = !!(article.book || article.featured);
	const tabs: AnchorTab[] = [
		{ id: "tong-quan", label: "Tổng quan" },
		...(article.contentHtml ? [{ id: "noi-dung", label: "Nội dung chính" }] : []),
		...(article.video ? [{ id: "video", label: "Video" }] : []),
		...(article.gallery.length ? [{ id: "album-anh", label: "Album ảnh" }] : []),
		...(hasSources ? [{ id: "nguon-tham-khao", label: "Nguồn tham khảo" }] : []),
	];

	return (
		<main>
			<HeaderSpace />
			<HeroInner
				className="tlhp-article-hero"
				title={article.name}
				text={article.name}
				breadcrums={[
					{ name: tongChi.title, path: PATH },
					{ name: article.group.name, path: groupHref },
				]}
			/>
			<div className="tj-service-area section-gap tlhp-article tlhp-tong-chi-article">
				<div className="container">
					<div className="row row-gap-5">
						<article className="col-lg-8">
							<Link className="tlhp-back-link" href={PATH}>
								<i className="tji-arrow-left-long" aria-hidden="true"></i> Quay lại {tongChi.title}
							</Link>
							<AnchorTabs tabs={tabs} path={tongChiHref(article.slug)} />

							<section id="tong-quan" className="tlhp-article-section" tabIndex={-1} aria-labelledby="tong-quan-tieu-de">
								<h2 id="tong-quan-tieu-de" className="visually-hidden">
									Tổng quan
								</h2>
								<div className="tlhp-article-meta">
									<Link className="tlhp-chip" href={groupHref}>
										{article.group.name}
									</Link>
									{article.author ? (
										<span>
											<i className="tji-user" aria-hidden="true"></i> {article.authorHref ? <Link href={article.authorHref}>{article.author}</Link> : article.author}
										</span>
									) : null}
									{article.views ? (
										<span>
											<i className="tji-eye-box" aria-hidden="true"></i> {formatNumber(article.views)} lượt xem
										</span>
									) : null}
								</div>
								{article.subtitle ? <p className="tlhp-tong-chi-subtitle">{article.subtitle}</p> : null}
								{article.banner ? (
									<div className="tlhp-article-banner">
										<img src={imageAt(article.banner.src, IMAGE_WIDTH.wide)} alt="" width={1200} height={675} style={{ objectPosition: article.banner.position }} fetchPriority={topImagePriority(imageAt(article.banner.src, IMAGE_WIDTH.wide))} />
									</div>
								) : null}
								{article.excerpt ? <p className="tlhp-article-intro">{article.excerpt}</p> : null}
							</section>

							{article.contentHtml ? (
								<section id="noi-dung" className="tlhp-article-section" tabIndex={-1} aria-labelledby="noi-dung-tieu-de">
									<h2 id="noi-dung-tieu-de" className="visually-hidden">
										Nội dung chính
									</h2>
									<ReadingFrame>
										<div className="tlhp-reading" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
									</ReadingFrame>
									{article.keywords.length ? (
										<dl className="tlhp-keywords">
											{article.keywords.map((keyword) => (
												<div key={keyword.keyword}>
													<dt>{keyword.title || keyword.keyword}</dt>
													<dd>{keyword.description}</dd>
												</div>
											))}
										</dl>
									) : null}
								</section>
							) : null}

							{article.video ? (
								<section id="video" className="tlhp-article-section" tabIndex={-1} aria-labelledby="video-tieu-de">
									<h2 id="video-tieu-de" className="tlhp-article-heading">
										Video
									</h2>
									{article.video.title ? <p className="tlhp-tong-chi-video-title">{article.video.title}</p> : null}
									{article.video.description ? <p>{article.video.description}</p> : null}
									<PostVideos videos={[article.video]} title={article.video.title || article.name} poster={article.banner} />
								</section>
							) : null}

							{article.gallery.length ? (
								<section id="album-anh" className="tlhp-article-section" tabIndex={-1} aria-labelledby="album-tieu-de">
									<h2 id="album-tieu-de" className="tlhp-article-heading">
										Album ảnh tư liệu <span className="tlhp-article-count">{formatNumber(article.gallery.length)} ảnh</span>
									</h2>
									<PostGallery images={article.gallery} title={article.name} albumId={`album-tong-chi-${article.id}`} />
								</section>
							) : null}

							{hasSources ? (
								<section id="nguon-tham-khao" className="tlhp-article-section" tabIndex={-1} aria-labelledby="nguon-tieu-de">
									<h2 id="nguon-tieu-de" className="tlhp-article-heading">
										Nguồn tham khảo
									</h2>
									<div className="tlhp-tong-chi-sources">
										{article.book ? (
											<div className="tlhp-tong-chi-source">
												{article.book.cover ? <img src={imageAt(article.book.cover, IMAGE_WIDTH.card)} alt="" width={120} height={160} loading="lazy" decoding="async" /> : null}
												<div>
													<p className="tlhp-chip">Tác phẩm</p>
													<h3 className="h5">{article.book.href ? <Link href={article.book.href}>{article.book.title}</Link> : article.book.title}</h3>
													{article.book.author ? <p className="tlhp-tong-chi-source-author">Tác giả: {article.book.author}</p> : null}
													{article.book.description ? <p>{article.book.description}</p> : null}
												</div>
											</div>
										) : null}
										{article.featured ? (
											<div className="tlhp-tong-chi-source">
												<div>
													<p className="tlhp-chip">{article.featured.label || "Bài nổi bật"}</p>
													<h3 className="h5">{article.featured.href ? <Link href={article.featured.href}>{article.featured.title}</Link> : article.featured.title}</h3>
													{article.featured.author ? <p className="tlhp-tong-chi-source-author">{article.featured.author}</p> : null}
												</div>
											</div>
										) : null}
									</div>
								</section>
							) : null}

							<nav className="tj-post__navigation tlhp-tong-chi-pager" aria-label="Bài trước và bài sau">
								<div className="tj-nav__post previous">
									{previous ? (
										<div className="tj-nav-post__nav prev_post">
											<Link href={tongChiHref(previous.slug)}>
												<span aria-hidden="true">
													<i className="tji-arrow-left"></i>
												</span>
												<span className="visually-hidden">Bài trước: </span>
												{previous.name}
											</Link>
										</div>
									) : null}
								</div>
								<Link href={PATH} className="tj-nav-post__grid" aria-label={`Tất cả ${tongChi.title}`}>
									<i className="tji-window" aria-hidden="true"></i>
								</Link>
								<div className="tj-nav__post next">
									{next ? (
										<div className="tj-nav-post__nav next_post">
											<Link href={tongChiHref(next.slug)}>
												<span className="visually-hidden">Bài sau: </span>
												{next.name}
												<span aria-hidden="true">
													<i className="tji-arrow-right"></i>
												</span>
											</Link>
										</div>
									) : null}
								</div>
							</nav>
						</article>

						<aside className="col-lg-4" aria-label={`Cùng nhóm ${article.group.name}`}>
							<div className="tj-main-sidebar">
								{group ? (
									<div className="tj-sidebar-widget service-categories">
										<h2 className="widget-title h4">{group.name}</h2>
										<ul>
											{group.articles.map((item) => (
												<li key={item.id}>
													<Link className={item.id === article.id ? "active" : ""} href={tongChiHref(item.slug)} aria-current={item.id === article.id ? "page" : undefined}>
														{nameInGroup(item)}
														<span className="icon" aria-hidden="true">
															<i className="tji-arrow-right"></i>
														</span>
													</Link>
												</li>
											))}
										</ul>
									</div>
								) : null}
								<div className="tj-sidebar-widget service-categories">
									<h2 className="widget-title h4">Các nhóm khác</h2>
									<ul>
										{groups
											.filter((item) => item.slug !== article.group.slug)
											.map((item) => (
												<li key={item.slug}>
													<Link href={`${PATH}#${item.slug}`}>
														{item.name}
														<span className="icon" aria-hidden="true">
															<i className="tji-arrow-right"></i>
														</span>
													</Link>
												</li>
											))}
									</ul>
								</div>
							</div>
						</aside>
					</div>
				</div>
			</div>
			<Cta />
		</main>
	);
}
