import Link from "next/link";
import AnchorTabs, { type AnchorTab } from "@/components/sections/posts/AnchorTabs";
import PostGallery from "@/components/sections/posts/PostGallery";
import PostVideos from "@/components/sections/posts/PostVideos";
import ReadingFrame from "@/components/sections/posts/ReadingFrame";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import PostCard from "@/components/shared/cards/PostCard";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import type { PostSection } from "@/config/sections";
import { IMAGE_WIDTH, imageAt, topImagePriority } from "@/libs/content/media";
import { getContentRepository } from "@/libs/content/repository";
import type { Post } from "@/libs/content/types";
import { formatDate, formatNumber } from "@/libs/format";
import { listHref } from "@/libs/postList";

const RELATED = 3;

type Props = { section: PostSection; post: Post };

// One article of a section, rendered on the server with its whole text (the old site fetched
// it in the browser and showed "không còn tồn tại" while it loaded). Bexon's sidebar widgets
// and comments are left out.
export default async function PostArticle({ section, post }: Props) {
	const categoryHref = (slug: string) => listHref(section.path, { category: slug, sort: "moi-nhat", page: 1 });
	const related = (await (await getContentRepository()).listPosts({ section: section.slug, category: post.category.slug, pageSize: RELATED + 1 })).items
		.filter((item) => item.id !== post.id)
		.slice(0, RELATED);
	const path = `${section.path}/${post.slug}`;
	const tabs: AnchorTab[] = [
		{ id: "tong-quan", label: "Tổng quan" },
		...(post.contentHtml ? [{ id: "noi-dung", label: "Nội dung chính" }] : []),
		...(post.videos.length ? [{ id: "video", label: "Video" }] : []),
		...(post.gallery.length ? [{ id: "album-anh", label: "Album ảnh" }] : []),
		...(related.length ? [{ id: "tim-hieu-them", label: "Tìm hiểu thêm" }] : []),
	];

	return (
		<main>
			<HeaderSpace />
			<HeroInner
				className="tlhp-article-hero"
				title={post.title}
				text={post.title}
				breadcrums={[
					{ name: section.name, path: section.path },
					...(post.category.name ? [{ name: post.category.name, path: categoryHref(post.category.slug) }] : []),
				]}
			/>
			<article className="tj-blog-section section-gap tlhp-article">
				<div className="container">
					<div className="row">
						<div className="col-12 col-lg-10 col-xl-9 mx-auto">
							<Link className="tlhp-back-link" href={section.path}>
								<i className="tji-arrow-left-long" aria-hidden="true"></i> Quay lại {section.name}
							</Link>
							<AnchorTabs tabs={tabs} path={path} />

							<section id="tong-quan" className="tlhp-article-section" tabIndex={-1} aria-labelledby="tong-quan-tieu-de">
								<h2 id="tong-quan-tieu-de" className="visually-hidden">
									Tổng quan
								</h2>
								<div className="tlhp-article-meta">
									{post.category.name ? (
										<Link className="tlhp-chip" href={categoryHref(post.category.slug)}>
											{post.category.name}
										</Link>
									) : null}
									<span>
										<i className="tji-calendar" aria-hidden="true"></i> <time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
									</span>
									{post.author ? (
										<span>
											<i className="tji-user" aria-hidden="true"></i> {post.author}
										</span>
									) : null}
									{post.views ? (
										<span>
											<i className="tji-eye-box" aria-hidden="true"></i> {formatNumber(post.views)} lượt xem
										</span>
									) : null}
								</div>
								{post.banner ? (
									<div className="tlhp-article-banner">
										<img src={imageAt(post.banner.src, IMAGE_WIDTH.wide)} alt="" width={1200} height={675} style={{ objectPosition: post.banner.position }} fetchPriority={topImagePriority(imageAt(post.banner.src, IMAGE_WIDTH.wide))} />
									</div>
								) : null}
								{post.intro ? <p className="tlhp-article-intro">{post.intro}</p> : null}
							</section>

							{post.contentHtml ? (
								<section id="noi-dung" className="tlhp-article-section" tabIndex={-1} aria-labelledby="noi-dung-tieu-de">
									<h2 id="noi-dung-tieu-de" className="visually-hidden">
										Nội dung chính
									</h2>
									<ReadingFrame>
										<div className="tlhp-reading" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
									</ReadingFrame>
									{post.keywords.length ? (
										<dl className="tlhp-keywords">
											{post.keywords.map((keyword) => (
												<div key={keyword.keyword}>
													<dt>{keyword.title || keyword.keyword}</dt>
													<dd>{keyword.description}</dd>
												</div>
											))}
										</dl>
									) : null}
								</section>
							) : null}

							{post.videos.length ? (
								<section id="video" className="tlhp-article-section" tabIndex={-1} aria-labelledby="video-tieu-de">
									<h2 id="video-tieu-de" className="tlhp-article-heading">
										Video
									</h2>
									<PostVideos videos={post.videos} title={post.title} poster={post.banner} />
								</section>
							) : null}

							{post.gallery.length ? (
								<section id="album-anh" className="tlhp-article-section" tabIndex={-1} aria-labelledby="album-tieu-de">
									<h2 id="album-tieu-de" className="tlhp-article-heading">
										Album ảnh tư liệu <span className="tlhp-article-count">{formatNumber(post.gallery.length)} ảnh</span>
									</h2>
									<PostGallery images={post.gallery} title={post.title} albumId={`album-${post.id}`} />
								</section>
							) : null}
						</div>
					</div>

					{related.length ? (
						<section id="tim-hieu-them" className="tlhp-article-section tlhp-related" tabIndex={-1} aria-labelledby="lien-quan-tieu-de">
							<h2 id="lien-quan-tieu-de" className="tlhp-article-heading">
								Tìm hiểu thêm
							</h2>
							<ul className="row row-gap-4 tlhp-post-grid">
								{related.map((item) => (
									<li key={item.id} className="col-12 col-md-6 col-xl-4">
										<PostCard post={item} href={`${section.path}/${item.slug}`} categoryHref={categoryHref(item.category.slug)} />
									</li>
								))}
							</ul>
						</section>
					) : null}
				</div>
			</article>
			<Cta />
		</main>
	);
}
