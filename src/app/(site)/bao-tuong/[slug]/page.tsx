import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import AnchorTabs, { type AnchorTab } from "@/components/sections/posts/AnchorTabs";
import ReadingFrame from "@/components/sections/posts/ReadingFrame";
import StatueCard from "@/components/sections/vu-tru/StatueCard";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { site } from "@/config/site";
import { areaOfStatue, relatedStatues, STATUES_PATH, statueListHref } from "@/libs/baoTuong";
import { IMAGE_WIDTH, imageAt, imageSrcSet, topImagePriority } from "@/libs/content/media";
import { getContentRepository } from "@/libs/content/repository";
import { areaHref, templeAreas } from "@/libs/vuTru";

const SECTION_NAME = "Bảo Tượng Phật Giáo";

type Props = { params: Promise<{ slug: string }> };

// The old address: /bao-tuong/{name}_{code}. A slug with a wrong code finds no statue: 404.
async function findStatue(slug: string) {
	return (await getContentRepository()).getStatue(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const statue = await findStatue((await params).slug);
	if (!statue) return {};
	const description = [statue.subtitle, statue.cluster, statue.assembly.name].filter(Boolean).join(" · ");
	return {
		title: `${statue.name}${statue.subtitle ? ` – ${statue.subtitle}` : ""} – ${SECTION_NAME} – ${site.name}`,
		description,
		openGraph: { title: statue.name, description, images: statue.image ? [statue.image.src] : undefined },
	};
}

// A statue after Bexon's team member page (TeamDetails1), like the Giới thiệu topics: the
// upright picture beside its titles, its group, assembly and area, and the teaching about it;
// then its story in the reading frame, the works of art of the same figure, and the statues
// beside it. The old page's video has no data yet.
export default async function BaoTuongStatue({ params }: Props) {
	const statue = await findStatue((await params).slug);
	if (!statue) notFound();
	const repo = await getContentRepository();
	const [statues, areas] = await Promise.all([repo.listStatues(), repo.listAreas()]);
	const areaSlug = areaOfStatue(statue);
	const area = areaSlug ? templeAreas(areas).find((item) => item.slug === areaSlug) : undefined;
	const related = relatedStatues(statue, statues);
	const tabs: AnchorTab[] = [
		{ id: "tong-quan", label: "Tổng quan" },
		...(statue.contentHtml ? [{ id: "noi-dung", label: "Câu chuyện" }] : []),
		...(statue.art.length ? [{ id: "nghe-thuat", label: "Nghệ thuật Phật giáo" }] : []),
		...(related.length ? [{ id: "lien-quan", label: "Bảo tượng liên quan" }] : []),
	];

	return (
		<main>
			<HeaderSpace />
			<HeroInner className="tlhp-article-hero" title={statue.name} text={statue.name} breadcrums={[{ name: SECTION_NAME, path: STATUES_PATH }]} />
			<article className="section-gap tlhp-article tlhp-about tlhp-statue">
				<div className="container">
					<Link className="tlhp-back-link" href={STATUES_PATH}>
						<i className="tji-arrow-left-long" aria-hidden="true"></i> Tất cả {SECTION_NAME}
					</Link>
					<AnchorTabs tabs={tabs} path={statue.href} />

					<section id="tong-quan" className="team-details tlhp-about-overview" tabIndex={-1} aria-labelledby="tong-quan-tieu-de">
						<div className="row justify-content-center row-gap-4">
							<div className="col-12 col-md-8 col-lg-5">
								<div className="team-details__img tlhp-about-portrait wow fadeInUp" data-wow-delay=".1s">
									{statue.image ? (
										<img src={imageAt(statue.image.src, IMAGE_WIDTH.wide)} alt={`Tôn tượng ${statue.name}`} width={600} height={800} fetchPriority={topImagePriority(imageAt(statue.image.src, IMAGE_WIDTH.wide))} style={{ objectPosition: statue.image.position }} />
									) : null}
								</div>
							</div>
							<div className="col-12 col-lg-7">
								<div className="team-details__content">
									<span className="team-details__desig tlhp-chip">{statue.main ? "Tượng chính" : "Nghệ thuật Phật giáo"}</span>
									<h2 id="tong-quan-tieu-de" className="team-details__name h3">
										{statue.subtitle || "Tổng quan"}
									</h2>
									<dl className="tlhp-statue-facts">
										{statue.cluster ? (
											<div>
												<dt>Cụm tượng</dt>
												<dd>{statue.cluster}</dd>
											</div>
										) : null}
										{statue.assembly.name ? (
											<div>
												<dt>Chúng hội</dt>
												<dd>
													<Link href={statueListHref({ q: "", assembly: statue.assembly.slug, area: "", kind: "", page: 1 })}>{statue.assembly.name}</Link>
												</dd>
											</div>
										) : null}
										{area ? (
											<div>
												<dt>Tôn trí tại</dt>
												<dd>
													<Link href={areaHref(area.slug)}>{area.name}</Link>
												</dd>
											</div>
										) : null}
										{statue.code ? (
											<div>
												<dt>Mã tượng</dt>
												<dd>{statue.code}</dd>
											</div>
										) : null}
									</dl>
									{statue.quote ? (
										<figure className="tlhp-about-quote">
											<blockquote className="tlhp-verse-text">
												<p>{statue.quote.text}</p>
											</blockquote>
											{statue.quote.author ? <figcaption>— {statue.quote.author}</figcaption> : null}
										</figure>
									) : null}
								</div>
							</div>
						</div>
					</section>

					<div className="row">
						<div className="col-12 col-lg-10 col-xl-9 mx-auto">
							{statue.contentHtml ? (
								<section id="noi-dung" className="tlhp-article-section" tabIndex={-1} aria-labelledby="noi-dung-tieu-de">
									<h2 id="noi-dung-tieu-de" className="tlhp-article-heading">
										Câu chuyện
									</h2>
									<ReadingFrame>
										<div className="tlhp-reading" dangerouslySetInnerHTML={{ __html: statue.contentHtml }} />
									</ReadingFrame>
								</section>
							) : null}
						</div>
					</div>

					{statue.art.length ? (
						<section id="nghe-thuat" className="tlhp-article-section" tabIndex={-1} aria-labelledby="nghe-thuat-tieu-de">
							<h2 id="nghe-thuat-tieu-de" className="tlhp-article-heading">
								Nghệ thuật Phật giáo <span className="tlhp-article-count">{statue.art.length} tác phẩm</span>
							</h2>
							<ul className="row row-gap-4 tlhp-art-grid">
								{statue.art.map((work) => (
									<li key={work.id} className="col-12 col-sm-6 col-lg-4">
										<article className="tlhp-art-card">
											{work.image ? (
												<img
													src={imageAt(work.image.src, IMAGE_WIDTH.card)}
													// One to a row on phones, two or three on wider screens.
													srcSet={imageSrcSet(work.image.src, [IMAGE_WIDTH.small, IMAGE_WIDTH.card])}
													sizes="(min-width: 992px) 400px, (min-width: 576px) 50vw, 100vw"
													alt=""
													width={480}
													height={360}
													loading="lazy"
													decoding="async"
												/>
											) : null}
											<div>
												<h3 className="h5">{work.href ? <Link href={work.href}>{work.title}</Link> : work.title}</h3>
												{work.location ? <p className="tlhp-art-place">{work.location}</p> : null}
												{work.meaning ? <p>{work.meaning}</p> : null}
											</div>
										</article>
									</li>
								))}
							</ul>
						</section>
					) : null}

					{related.length ? (
						<section id="lien-quan" className="tlhp-article-section tlhp-related" tabIndex={-1} aria-labelledby="lien-quan-tieu-de">
							<h2 id="lien-quan-tieu-de" className="tlhp-article-heading">
								Bảo tượng liên quan
							</h2>
							<ul className="row row-gap-4 tlhp-statue-grid">
								{related.map((item) => (
									<li key={item.id} className="col-6 col-md-4 col-lg-3">
										<StatueCard statue={item} />
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
