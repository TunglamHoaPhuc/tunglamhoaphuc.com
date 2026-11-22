// The draft of an article as the public site will show it (docs/admin-architecture.md 7.4): posts through the site's
// own PostArticle; Tông Chỉ articles and Giới thiệu pages through frames that use the same components and classes as
// their public pages (those pages keep their markup inside the route files, so it cannot be imported as is).
import type { PreviewData } from "@/admin/content/service";
import { markdownOf, parseSafe } from "@/admin/content/html";
import AboutMilestones from "@/components/sections/about/AboutMilestones";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import PostArticle from "@/components/sections/posts/PostArticle";
import PostVideos from "@/components/sections/posts/PostVideos";
import ReadingFrame from "@/components/sections/posts/ReadingFrame";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { DONG_CHAY, TRI_TUE, type PostSection } from "@/config/sections";
import { tongChi } from "@/config/tongChi";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";
import { renderContent } from "@/libs/content/normalize";
import { tongChiMarkdown } from "@/libs/content/tongChiBody";
import type { Keyword, MediaImage, Milestone, Post } from "@/libs/content/types";
import { formatNumber, titleCase } from "@/libs/format";

const str = (value: unknown) => (typeof value === "string" ? value : "");

function imageOf(data: PreviewData, key: string, positionKey: string): MediaImage | null {
	const id = str(data.state[key]);
	const item = id ? data.media[id] : undefined;
	return item?.url ? { src: item.url, position: str(data.state[positionKey]) || "center 50%" } : null;
}

const SECTIONS: Record<string, PostSection> = {
	[DONG_CHAY.slug]: DONG_CHAY,
	[TRI_TUE.slug]: TRI_TUE,
	"vu-tru-phat-giao": { slug: "vu-tru-phat-giao", path: "/vu-tru-phat-giao", name: "Vũ Trụ Phật Giáo", description: "" },
};

export function PostPreview({ data }: { data: PreviewData }) {
	const state = data.state;
	const section = SECTIONS[str(state.section)] ?? DONG_CHAY;
	const post: Post = {
		id: data.id,
		slug: str(state.slug),
		title: str(state.title),
		subtitle: str(state.subtitle),
		section: section.slug,
		category: data.category,
		author: str(state.author),
		publishedDate: str(state.publishedDate),
		views: data.legacyViews,
		thumbnail: imageOf(data, "thumbnailMediaId", "thumbnailPosition"),
		banner: imageOf(data, "bannerMediaId", "bannerPosition"),
		summary: str(state.summary),
		galleryCount: 0,
		intro: str(state.intro),
		contentHtml: str(state.contentHtml),
		keywords: (Array.isArray(state.keywords) ? state.keywords : []) as Keyword[],
		gallery: [],
		videos: (Array.isArray(state.videos) ? state.videos : []) as Post["videos"],
		pinned: state.pinned === true,
		seoTitle: str(state.seoTitle),
		seoDescription: str(state.seoDescription),
		ogImage: imageOf(data, "ogMediaId", ""),
		extra: { audio: null, youtubeId: null, book: null },
		related: [],
	};
	return <PostArticle section={section} post={post} />;
}

export function TeachingPreview({ data }: { data: PreviewData }) {
	const state = data.state;
	const name = str(state.name) || str(state.title);
	const banner = imageOf(data, "bannerMediaId", "bannerPosition");
	// What the public page will show: the Markdown the body is saved as, read back the way the page reads it.
	const markdown = markdownOf(parseSafe(str(state.contentHtml)));
	const contentHtml = renderContent(tongChiMarkdown(markdown, { title: str(state.title), slug: str(state.slug), targets: [] }).markdown);
	const video = state.video as { id: string; url: string; title: string; description: string } | null;
	return (
		<main>
			<HeaderSpace />
			<HeroInner className="tlhp-article-hero" title={name} text={name} breadcrums={[{ name: tongChi.title, path: tongChi.path }, ...(data.category.name ? [{ name: data.category.name, path: `${tongChi.path}#${data.category.slug}` }] : [])]} />
			<div className="tj-service-area section-gap tlhp-article tlhp-tong-chi-article">
				<div className="container">
					<div className="row row-gap-5">
						<article className="col-lg-8 mx-auto">
							<section className="tlhp-article-section">
								<div className="tlhp-article-meta">
									{data.category.name ? <span className="tlhp-chip">{data.category.name}</span> : null}
									{str(state.author) ? (
										<span>
											<i className="tji-user" aria-hidden="true"></i> {str(state.author)}
										</span>
									) : null}
									{data.legacyViews ? (
										<span>
											<i className="tji-eye-box" aria-hidden="true"></i> {formatNumber(data.legacyViews)} lượt xem
										</span>
									) : null}
								</div>
								{str(state.subtitle) ? <p className="tlhp-tong-chi-subtitle">{str(state.subtitle)}</p> : null}
								{banner ? (
									<div className="tlhp-article-banner">
										<img src={imageAt(banner.src, IMAGE_WIDTH.wide)} alt="" width={1200} height={675} style={{ objectPosition: banner.position }} />
									</div>
								) : null}
								{str(state.excerpt) ? <p className="tlhp-article-intro">{str(state.excerpt)}</p> : null}
							</section>
							{contentHtml ? (
								<section className="tlhp-article-section">
									<ReadingFrame>
										<div className="tlhp-reading" dangerouslySetInnerHTML={{ __html: contentHtml }} />
									</ReadingFrame>
								</section>
							) : null}
							{video?.id ? (
								<section className="tlhp-article-section">
									<h2 className="tlhp-article-heading">Video</h2>
									{video.title ? <p className="tlhp-tong-chi-video-title">{video.title}</p> : null}
									{video.description ? <p>{video.description}</p> : null}
									<PostVideos videos={[{ id: video.id, url: video.url }]} title={video.title || name} poster={banner} />
								</section>
							) : null}
						</article>
					</div>
				</div>
			</div>
			<Cta />
		</main>
	);
}

export function PagePreview({ data }: { data: PreviewData }) {
	const state = data.state;
	const picture = imageOf(data, "portraitMediaId", "portraitPosition") ?? imageOf(data, "bannerMediaId", "bannerPosition");
	const quote = state.quote as { title: string; lines: string[]; author: string } | null;
	const book = state.book as { title: string; author: string; cover: string | null; description: string } | null;
	const milestones = (Array.isArray(state.milestones) ? state.milestones : []) as Milestone[];
	const title = str(state.title);
	return (
		<main>
			<HeaderSpace />
			<HeroInner className="tlhp-article-hero" title={title} text={title} breadcrums={[{ name: "Giới thiệu", path: "/gioi-thieu" }]} />
			<article className="section-gap tlhp-article tlhp-about">
				<div className="container">
					<section className="team-details tlhp-about-overview">
						<div className="row justify-content-center row-gap-4">
							<div className="col-12 col-md-8 col-lg-5">
								<div className="team-details__img tlhp-about-portrait">
									{picture ? <img src={imageAt(picture.src, IMAGE_WIDTH.wide)} alt={`Chân dung: ${title}`} width={600} height={800} style={{ objectPosition: picture.position }} /> : null}
								</div>
							</div>
							<div className="col-12 col-lg-7">
								<div className="team-details__content">
									{str(state.kicker) ? <span className="team-details__desig tlhp-chip">{str(state.kicker)}</span> : null}
									<h2 className="team-details__name h3">{str(state.subtitle) || "Tổng quan"}</h2>
									{str(state.overview) ? <p className="tlhp-article-intro">{str(state.overview)}</p> : null}
									{quote ? (
										<figure className="tlhp-about-quote">
											{quote.title ? <p className="tlhp-about-quote-title">{quote.title}</p> : null}
											<blockquote className="tlhp-verse-text">
												{quote.lines.map((line, index) => (
													<p key={index}>{line}</p>
												))}
											</blockquote>
											{quote.author ? <figcaption>— {quote.author}</figcaption> : null}
										</figure>
									) : null}
									{book ? (
										<aside className="tlhp-about-book" aria-label="Tác phẩm">
											{book.cover ? <img src={imageAt(book.cover, IMAGE_WIDTH.card)} alt="" width={120} height={170} loading="lazy" /> : null}
											<div>
												<p className="tlhp-about-book-label">Tác phẩm</p>
												<p className="tlhp-about-book-title">{book.title}</p>
												{book.author ? <p className="tlhp-about-book-author">{book.author}</p> : null}
												{book.description ? <p>{book.description}</p> : null}
											</div>
										</aside>
									) : null}
								</div>
							</div>
						</div>
					</section>
					{milestones.length ? (
						<section className="tlhp-article-section tlhp-about-timeline">
							<h2 className="tlhp-article-heading">Mốc niên biểu</h2>
							<AboutMilestones milestones={milestones} />
						</section>
					) : null}
					<div className="row">
						<div className="col-12 col-lg-10 col-xl-9 mx-auto">
							{str(state.contentHtml) ? (
								<section className="tlhp-article-section">
									<ReadingFrame>
										<div className="tlhp-reading" dangerouslySetInnerHTML={{ __html: str(state.contentHtml) }} />
									</ReadingFrame>
								</section>
							) : null}
						</div>
					</div>
				</div>
			</article>
			<Cta />
		</main>
	);
}

export const previewTitle = (data: PreviewData) => titleCase(str(data.state.title));
