import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import AnchorTabs, { type AnchorTab } from "@/components/sections/posts/AnchorTabs";
import AreaCard from "@/components/sections/vu-tru/AreaCard";
import StatueCard from "@/components/sections/vu-tru/StatueCard";
import TempleMap from "@/components/sections/vu-tru/TempleMap";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { site } from "@/config/site";
import { vuTru } from "@/config/vuTru";
import { IMAGE_WIDTH, imageAt, topImagePriority } from "@/libs/content/media";
import { getContentRepository, slugKey } from "@/libs/content/repository";
import type { StatueSummary } from "@/libs/content/types";
import { areaHref, type MapArea, statuesIn, templeAreas } from "@/libs/vuTru";

// Served from Cloudflare's Workers Cache and made again at most every 5 minutes (T41e).
export const revalidate = 300;
// No pages at build time; each is made on its first visit, then cached (ISR).
export async function generateStaticParams() {
	return [];
}

// How many areas "Khu vực khác" shows: the next stops on the map.
const NEXT_AREAS = 3;

type Props = { params: Promise<{ slug: string }> };

async function findArea(slug: string): Promise<{ area: MapArea; areas: MapArea[] } | null> {
	const areas = templeAreas(await (await getContentRepository()).listAreas());
	const area = areas.find((item) => item.slug === slugKey(slug));
	return area ? { area, areas } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const found = await findArea((await params).slug);
	if (!found) return {};
	const { area } = found;
	const description = area.intro || area.subtitle;
	return {
		title: `${area.name} – ${vuTru.title} – ${site.name}`,
		description,
		openGraph: { title: area.name, description, images: area.cover ? [area.cover.src] : undefined },
	};
}

function StatueList({ id, title, statues }: { id: string; title: string; statues: StatueSummary[] }) {
	return (
		<section id={id} className="tlhp-article-section" tabIndex={-1} aria-labelledby={`${id}-tieu-de`}>
			<h2 id={`${id}-tieu-de`} className="tlhp-article-heading">
				{title} <span className="tlhp-article-count">{statues.length} tôn tượng</span>
			</h2>
			<ul className="row row-gap-4 tlhp-statue-grid">
				{statues.map((statue) => (
					<li key={statue.id} className="col-6 col-md-4">
						<StatueCard statue={statue} />
					</li>
				))}
			</ul>
		</section>
	);
}

// An area of the temple after Bexon's project page (PortfolioDetailsMain): what it is, the
// statues that stand there (the main ones, then the works of Buddhist art), where it is on
// the map, and the next areas of the walk. The album, the stories and Giảng đường's dharma
// talks wait for data the admin's files do not give yet.
export default async function VuTruArea({ params }: Props) {
	const found = await findArea((await params).slug);
	if (!found) notFound();
	const { area, areas } = found;
	const { main, art } = statuesIn(area, await (await getContentRepository()).listStatues());
	const at = areas.indexOf(area);
	const next = Array.from({ length: Math.min(NEXT_AREAS, areas.length - 1) }, (_, step) => areas[(at + step + 1) % areas.length]);
	const tabs: AnchorTab[] = [
		{ id: "gioi-thieu", label: "Giới thiệu" },
		...(main.length ? [{ id: "bao-tuong", label: "Bảo tượng" }] : []),
		...(art.length ? [{ id: "nghe-thuat", label: "Nghệ thuật Phật giáo" }] : []),
		...(next.length ? [{ id: "khu-vuc-khac", label: "Khu vực khác" }] : []),
	];

	return (
		<main>
			<HeaderSpace />
			<HeroInner className="tlhp-article-hero" title={area.name} text={area.name} breadcrums={[{ name: vuTru.title, path: vuTru.path }]} />
			<div className="tj-blog-section section-gap tlhp-article tlhp-area">
				<div className="container">
					<div className="row row-gap-5">
						<article className="col-lg-8">
							<Link className="tlhp-back-link" href={vuTru.path}>
								<i className="tji-arrow-left-long" aria-hidden="true"></i> Quay lại {vuTru.title}
							</Link>
							<AnchorTabs tabs={tabs} path={areaHref(area.slug)} />

							<section id="gioi-thieu" className="tlhp-article-section" tabIndex={-1} aria-labelledby="gioi-thieu-tieu-de">
								<h2 id="gioi-thieu-tieu-de" className="visually-hidden">
									Giới thiệu
								</h2>
								<div className="tlhp-article-meta">
									<span className="tlhp-chip">Khu vực {area.number}</span>
									{area.subtitle ? <span className="tlhp-area-subtitle">{area.subtitle}</span> : null}
								</div>
								{area.cover ? (
									<div className="tlhp-article-banner">
										<img src={imageAt(area.cover.src, IMAGE_WIDTH.wide)} alt="" width={1200} height={675} style={{ objectPosition: area.cover.position }} fetchPriority={topImagePriority(imageAt(area.cover.src, IMAGE_WIDTH.wide))} />
									</div>
								) : null}
								{/* The long text mostly opens with the intro reworded, so the intro stands only alone. */}
								{area.contentHtml ? (
									<div className="tlhp-reading tlhp-area-text" dangerouslySetInnerHTML={{ __html: area.contentHtml }} />
								) : area.intro ? (
									<p className="tlhp-article-intro">{area.intro}</p>
								) : null}
							</section>

							{main.length ? <StatueList id="bao-tuong" title="Bảo tượng" statues={main} /> : null}
							{art.length ? <StatueList id="nghe-thuat" title="Nghệ thuật Phật giáo" statues={art} /> : null}
						</article>

						<aside className="col-lg-4" aria-labelledby="vi-tri-tieu-de">
							<div className="tj-main-sidebar">
								<div className="tj-sidebar-widget tlhp-area-where">
									<h2 id="vi-tri-tieu-de" className="widget-title h4">
										Vị trí trên sơ đồ
									</h2>
									<TempleMap areas={areas} only={area.slug} />
									<Link className="tlhp-area-map-link" href={`${vuTru.path}#so-do`}>
										Xem sơ đồ đầy đủ <i className="tji-arrow-right" aria-hidden="true"></i>
									</Link>
								</div>
							</div>
						</aside>
					</div>

					{next.length ? (
						<section id="khu-vuc-khac" className="tlhp-article-section tlhp-related" tabIndex={-1} aria-labelledby="khu-vuc-khac-tieu-de">
							<h2 id="khu-vuc-khac-tieu-de" className="tlhp-article-heading">
								Khu vực khác
							</h2>
							<ul className="row row-gap-4">
								{next.map((item) => (
									<li key={item.slug} className="col-12 col-md-6 col-lg-4">
										<AreaCard area={item} />
									</li>
								))}
							</ul>
						</section>
					) : null}
				</div>
			</div>
			<Cta />
		</main>
	);
}
