import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AboutCard from "@/components/sections/about/AboutCard";
import AboutMilestones from "@/components/sections/about/AboutMilestones";
import AnchorTabs, { type AnchorTab } from "@/components/sections/posts/AnchorTabs";
import PostGallery from "@/components/sections/posts/PostGallery";
import ReadingFrame from "@/components/sections/posts/ReadingFrame";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { site } from "@/config/site";
import { IMAGE_WIDTH, imageAt, topImagePriority } from "@/libs/content/media";
import { getContentRepository, slugKey } from "@/libs/content/repository";
import type { AboutTopic } from "@/libs/content/types";
import { formatNumber, titleCase } from "@/libs/format";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;
// No pages at build time; each is made on its first visit, then cached (ISR).
export async function generateStaticParams() {
	return [];
}

const PATH = "/gioi-thieu";
const SECTION_NAME = "Giới thiệu";

type Props = { params: Promise<{ slug: string }> };

async function findTopic(slug: string): Promise<{ topic: AboutTopic; topics: AboutTopic[] } | null> {
	const topics = await (await getContentRepository()).listAboutTopics();
	const topic = topics.find((item) => item.slug === slugKey(slug));
	return topic ? { topic, topics } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const found = await findTopic((await params).slug);
	if (!found) return {};
	const { topic } = found;
	const description = topic.subtitle || topic.overview;
	return {
		title: `${titleCase(topic.title)} – ${SECTION_NAME} – ${site.name}`,
		description,
		openGraph: { title: titleCase(topic.title), description, images: topic.banner ? [topic.banner.src] : undefined },
	};
}

// A topic of Giới thiệu after Bexon's team member page (TeamDetails1): the portrait beside
// the overview and the teaching it is known by, then the timeline, the text in the reading
// frame, the album and the other topics of its group.
export default async function GioiThieuTopic({ params }: Props) {
	const found = await findTopic((await params).slug);
	if (!found) notFound();
	const { topic, topics } = found;
	const others = topics.filter((item) => item.id !== topic.id && item.group.slug === topic.group.slug);
	const picture = topic.portrait ?? topic.banner;
	const tabs: AnchorTab[] = [
		{ id: "tong-quan", label: "Tổng quan" },
		...(topic.milestones.length ? [{ id: "moc-nien-bieu", label: "Mốc niên biểu" }] : []),
		...(topic.contentHtml ? [{ id: "noi-dung", label: "Nội dung" }] : []),
		...(topic.gallery.length ? [{ id: "album-anh", label: "Album ảnh" }] : []),
		...(others.length ? [{ id: "cung-nhom", label: "Cùng mục" }] : []),
	];

	return (
		<main>
			<HeaderSpace />
			<HeroInner className="tlhp-article-hero" title={topic.title} text={topic.title} breadcrums={[{ name: SECTION_NAME, path: PATH }]} />
			<article className="section-gap tlhp-article tlhp-about">
				<div className="container">
					<Link className="tlhp-back-link" href={PATH}>
						<i className="tji-arrow-left-long" aria-hidden="true"></i> Tất cả mục {SECTION_NAME}
					</Link>
					<AnchorTabs tabs={tabs} path={`${PATH}/${topic.slug}`} />

					<section id="tong-quan" className="team-details tlhp-about-overview" tabIndex={-1} aria-labelledby="tong-quan-tieu-de">
						<div className="row justify-content-center row-gap-4">
							<div className="col-12 col-md-8 col-lg-5">
								<div className="team-details__img tlhp-about-portrait wow fadeInUp" data-wow-delay=".1s">
									{picture ? (
										<img src={imageAt(picture.src, IMAGE_WIDTH.wide)} alt={`Chân dung: ${topic.title}`} width={600} height={800} fetchPriority={topImagePriority(imageAt(picture.src, IMAGE_WIDTH.wide))} style={{ objectPosition: picture.position }} />
									) : null}
								</div>
							</div>
							<div className="col-12 col-lg-7">
								<div className="team-details__content">
									{topic.tag ? <span className="team-details__desig tlhp-chip">{topic.tag}</span> : null}
									<h2 id="tong-quan-tieu-de" className="team-details__name h3">
										{topic.subtitle || "Tổng quan"}
									</h2>
									{topic.overview ? <p className="tlhp-article-intro">{topic.overview}</p> : null}
									{topic.quote ? (
										<figure className="tlhp-about-quote">
											{topic.quote.title ? <p className="tlhp-about-quote-title">{topic.quote.title}</p> : null}
											<blockquote className="tlhp-verse-text">
												{topic.quote.lines.map((line, idx) => (
													<p key={idx}>{line}</p>
												))}
											</blockquote>
											{topic.quote.author ? <figcaption>— {topic.quote.author}</figcaption> : null}
										</figure>
									) : null}
									{topic.book ? (
										<aside className="tlhp-about-book" aria-label="Tác phẩm">
											{topic.book.cover ? <img src={imageAt(topic.book.cover, IMAGE_WIDTH.card)} alt="" width={120} height={170} loading="lazy" /> : null}
											<div>
												<p className="tlhp-about-book-label">Tác phẩm</p>
												<p className="tlhp-about-book-title">{topic.book.title}</p>
												{topic.book.author ? <p className="tlhp-about-book-author">{topic.book.author}</p> : null}
												{topic.book.description ? <p>{topic.book.description}</p> : null}
											</div>
										</aside>
									) : null}
								</div>
							</div>
						</div>
					</section>

					{topic.milestones.length ? (
						<section id="moc-nien-bieu" className="tlhp-article-section tlhp-about-timeline" tabIndex={-1} aria-labelledby="moc-tieu-de">
							<h2 id="moc-tieu-de" className="tlhp-article-heading">
								Mốc niên biểu
							</h2>
							<AboutMilestones milestones={topic.milestones} />
						</section>
					) : null}

					<div className="row">
						<div className="col-12 col-lg-10 col-xl-9 mx-auto">
							{topic.contentHtml ? (
								<section id="noi-dung" className="tlhp-article-section" tabIndex={-1} aria-labelledby="noi-dung-tieu-de">
									<h2 id="noi-dung-tieu-de" className="visually-hidden">
										Nội dung
									</h2>
									<ReadingFrame>
										<div className="tlhp-reading" dangerouslySetInnerHTML={{ __html: topic.contentHtml }} />
									</ReadingFrame>
								</section>
							) : null}

							{topic.gallery.length ? (
								<section id="album-anh" className="tlhp-article-section" tabIndex={-1} aria-labelledby="album-tieu-de">
									<h2 id="album-tieu-de" className="tlhp-article-heading">
										Album ảnh <span className="tlhp-article-count">{formatNumber(topic.gallery.length)} ảnh</span>
									</h2>
									<PostGallery images={topic.gallery} title={topic.title} albumId={`album-${topic.id}`} />
								</section>
							) : null}
						</div>
					</div>

					{others.length ? (
						<section id="cung-nhom" className="tlhp-article-section tlhp-related" tabIndex={-1} aria-labelledby="cung-nhom-tieu-de">
							<h2 id="cung-nhom-tieu-de" className="tlhp-article-heading">
								{topic.group.name || "Cùng mục"}
							</h2>
							<ul className="row row-gap-4">
								{others.map((item) => (
									<li key={item.id} className="col-12 col-sm-6 col-lg-4">
										<AboutCard topic={item} />
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
